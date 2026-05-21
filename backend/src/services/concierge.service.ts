import axios from 'axios';
import {
  CanalReserva,
  EstadoHabitacion,
  EstadoReserva,
  SegmentoHuesped,
  TipoDocumento,
} from '@prisma/client';
import { prisma } from '../lib/prisma';

const OLLAMA_URL   = () => process.env.OLLAMA_URL           ?? 'http://localhost:11434';
const WPP_TOKEN    = () => process.env.WHATSAPP_ACCESS_TOKEN  ?? '';
const WPP_PHONE_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';

// ─── Date parser (regex-first, no LLM needed for common patterns) ───────────

const MESES: Record<string, string> = {
  enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
  julio:'07', agosto:'08', septiembre:'09', octubre:'10', noviembre:'11', diciembre:'12',
  jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
  jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
};

function toISO(dia: string, mes: string, anio?: string): string {
  const m = MESES[mes.toLowerCase()] ?? mes.padStart(2, '0');
  const y = anio ?? new Date().getFullYear().toString();
  return `${y}-${m}-${dia.padStart(2, '0')}`;
}

function extraerFechas(texto: string): { entrada: string; salida: string } | null {
  const t = texto.toLowerCase().trim();
  const anioActual = new Date().getFullYear().toString();

  // "del 25 al 27 de mayo" / "del 25 al 27 mayo"
  let m = t.match(/del?\s+(\d{1,2})\s+al?\s+(\d{1,2})\s+(?:de\s+)?([a-záéíóúü]+)(?:\s+(\d{4}))?/);
  if (m) return { entrada: toISO(m[1], m[3], m[4] ?? anioActual), salida: toISO(m[2], m[3], m[4] ?? anioActual) };

  // "25 al 27 de mayo"
  m = t.match(/(\d{1,2})\s+al?\s+(\d{1,2})\s+(?:de\s+)?([a-záéíóúü]+)(?:\s+(\d{4}))?/);
  if (m) return { entrada: toISO(m[1], m[3], m[4] ?? anioActual), salida: toISO(m[2], m[3], m[4] ?? anioActual) };

  // "25/05 al 27/05" or "25/05/2026 al 27/05/2026"
  m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+(?:al?|hasta|a)\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (m) return {
    entrada: toISO(m[1], m[2], m[3] ?? anioActual),
    salida:  toISO(m[4], m[5], m[6] ?? anioActual),
  };

  // "2026-05-25 al 2026-05-27" (already ISO)
  m = t.match(/(\d{4}-\d{2}-\d{2})\s+(?:al?|hasta|a)\s+(\d{4}-\d{2}-\d{2})/);
  if (m) return { entrada: m[1], salida: m[2] };

  return null;
}

// ─── State machine types ────────────────────────────────────────────────────

type Paso =
  | 'inicio'
  | 'pidiendo_fechas'
  | 'pidiendo_personas'
  | 'mostrando_habitaciones'
  | 'pidiendo_nombre'
  | 'pidiendo_dni'
  | 'confirmando'
  | 'finalizado';

interface HabOpcion {
  id:               string;
  numero:           string;
  tipo:             string;
  tarifa_base:      number;
  capacidad_adultos: number | null;
}

interface ConversacionState {
  paso:          Paso;
  fecha_entrada?: string;
  fecha_salida?:  string;
  personas?:     number;
  opciones?:     HabOpcion[];
  habitacion?:   HabOpcion;
  nombre?:       string;
  dni?:          string;
  historial:     Array<{ rol: 'user' | 'assistant'; contenido: string }>;
}

// ─── In-memory store (Redis in prod) ────────────────────────────────────────

const conversaciones: Record<string, ConversacionState> = {};

function getConversacion(telefono: string): ConversacionState {
  if (!conversaciones[telefono]) {
    conversaciones[telefono] = { paso: 'inicio', historial: [] };
  }
  return conversaciones[telefono];
}

function limpiarConversacion(telefono: string): void {
  delete conversaciones[telefono];
}

export function getEstadoPaso(telefono: string): string {
  return conversaciones[telefono]?.paso ?? 'finalizado';
}

// ─── Send via WhatsApp ───────────────────────────────────────────────────────

export async function enviarWPP(telefono: string, texto: string): Promise<void> {
  if (!WPP_TOKEN() || !WPP_PHONE_ID()) {
    console.log(`[WPP OUT] ${telefono}: ${texto}`);
    return;
  }
  await axios
    .post(
      `https://graph.facebook.com/v18.0/${WPP_PHONE_ID()}/messages`,
      {
        messaging_product: 'whatsapp',
        to:   telefono,
        type: 'text',
        text: { body: texto },
      },
      { headers: { Authorization: `Bearer ${WPP_TOKEN()}` } },
    )
    .catch((e: unknown) => {
      const err = e as { response?: { data: unknown }; message?: string };
      console.error('[WPP ERROR]', err.response?.data ?? err.message);
    });
}

// ─── Llama3 helper ───────────────────────────────────────────────────────────

async function llama3(prompt: string, sistema: string): Promise<string> {
  try {
    const r = await axios.post<{ response: string }>(
      `${OLLAMA_URL()}/api/generate`,
      { model: 'llama3', system: sistema, prompt, stream: false },
      { timeout: 30_000 },
    );
    return r.data.response?.trim() ?? '';
  } catch {
    return '';
  }
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function getDisponibles(
  fechaEntrada: string,
  fechaSalida: string,
  personas: number,
): Promise<HabOpcion[]> {
  const rows = await prisma.habitacion.findMany({
    where: {
      estado:            EstadoHabitacion.DISPONIBLE,
      capacidad_adultos: { gte: personas },
      reservas: {
        none: {
          estado:        { in: [EstadoReserva.CONFIRMADA, EstadoReserva.CHECKIN_REALIZADO] },
          fecha_entrada: { lte: new Date(fechaSalida) },
          fecha_salida:  { gte: new Date(fechaEntrada) },
        },
      },
    },
    select: {
      id:               true,
      numero:           true,
      tipo:             true,
      tarifa_base:      true,
      capacidad_adultos: true,
    },
    take: 5,
  });

  return rows.map((h) => ({
    id:               h.id,
    numero:           h.numero,
    tipo:             String(h.tipo),
    tarifa_base:      Number(h.tarifa_base),
    capacidad_adultos: h.capacidad_adultos,
  }));
}

function generarCodigo(): string {
  const fecha  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sufijo = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WPP-${fecha}-${sufijo}`;
}

async function crearReserva(
  state: ConversacionState,
  telefono: string,
): Promise<{ codigo: string; noches: number; total: number; adelanto: number }> {
  const raw = state.dni ?? '';
  let tipoDoc: TipoDocumento = TipoDocumento.DOC_EXTRANJERO;
  if (/^\d{8}$/.test(raw))  tipoDoc = TipoDocumento.DNI;
  else if (/^\d{11}$/.test(raw)) tipoDoc = TipoDocumento.RUC;
  else if (/^[A-Z0-9]{6,12}$/i.test(raw)) tipoDoc = TipoDocumento.PASAPORTE;

  const partes = (state.nombre ?? '').trim().split(/\s+/);
  const nombre  = partes[0] ?? 'HUÉSPED';
  const apellido = partes.slice(1).join(' ') || 'S/A';

  const huesped = await prisma.huesped.upsert({
    where:  { numero_documento: raw },
    create: {
      nombre,
      apellido,
      tipo_documento:  tipoDoc,
      numero_documento: raw,
      telefono,
      segmento: SegmentoHuesped.NUEVO,
    },
    update: {},
  });

  const noches = Math.ceil(
    (new Date(state.fecha_salida!).getTime() -
     new Date(state.fecha_entrada!).getTime()) / 86_400_000,
  );
  const tarifa  = state.habitacion!.tarifa_base;
  const total   = tarifa * noches;
  const adelanto = total * 0.5;

  const reserva = await prisma.reserva.create({
    data: {
      codigo:          generarCodigo(),
      huesped_id:      huesped.id,
      habitacion_id:   state.habitacion!.id,
      canal:           CanalReserva.WHATSAPP,
      estado:          EstadoReserva.CONFIRMADA,
      fecha_entrada:   new Date(state.fecha_entrada!),
      fecha_salida:    new Date(state.fecha_salida!),
      tarifa_acordada: tarifa,
      adultos:         state.personas ?? 1,
      notas:           `Reserva via WhatsApp IA. Tel: ${telefono}. Adelanto pendiente: S/ ${adelanto.toFixed(2)}`,
    },
  });

  return { codigo: reserva.codigo, noches, total, adelanto };
}

// ─── Main processor ──────────────────────────────────────────────────────────

export async function procesarMensaje(
  telefono: string,
  texto: string,
  enviarFn: (tel: string, msg: string) => Promise<void> = enviarWPP,
): Promise<void> {
  const state = getConversacion(telefono);
  state.historial.push({ rol: 'user', contenido: texto });
  console.log(`[WPP IN] ${telefono} [paso:${state.paso}]: ${texto}`);

  // ── PASO 0: Inicio ──────────────────────────────────────────────────────
  if (state.paso === 'inicio') {
    if (/reserv|habitaci|cuarto|disponib|quiero|necesito|busco/i.test(texto)) {
      state.paso = 'pidiendo_fechas';
      await enviarFn(
        telefono,
        `¡Hola! 👋 Soy el asistente del *Hotel Hotelia* en Arequipa.\n\n` +
        `Con gusto te ayudo a reservar. 🏨\n\n` +
        `¿Para qué fechas necesitas la habitación?\n` +
        `Por favor dime: *fecha de entrada* y *fecha de salida*\n` +
        `_(Ejemplo: "del 25 al 27 de mayo")_`,
      );
      return;
    }

    const resp = await llama3(
      texto,
      'Eres el asistente del Hotel Hotelia en Arequipa, Perú. ' +
      'Responde brevemente en español. Si el cliente quiere reservar, ' +
      'pregúntale para qué fechas necesita la habitación.',
    );
    await enviarFn(telefono, resp || '¡Hola! ¿En qué te puedo ayudar?');
    return;
  }

  // ── PASO 1: Pidiendo fechas ─────────────────────────────────────────────
  if (state.paso === 'pidiendo_fechas') {
    // Try direct regex first (handles "del 25 al 27 de mayo", "25/05 al 27/05", etc.)
    const fechas = extraerFechas(texto);
    if (fechas) {
      state.fecha_entrada = fechas.entrada;
      state.fecha_salida  = fechas.salida;
      state.paso = 'pidiendo_personas';
      await enviarFn(
        telefono,
        `📅 Perfecto: *${fechas.entrada}* al *${fechas.salida}*\n\n` +
        `¿Cuántas personas se hospedarán? 👥`,
      );
      return;
    }

    // Fallback: ask Llama3 to parse and return any date values
    const hoy = new Date().toISOString().split('T')[0];
    const extraccion = await llama3(
      `Mensaje del usuario: "${texto}"\nHoy: ${hoy}\n` +
      `Responde SOLO este JSON con las fechas en YYYY-MM-DD:\n` +
      `{"entrada":"YYYY-MM-DD","salida":"YYYY-MM-DD"}\n` +
      `Ejemplo: si dice "del 5 al 8 de junio 2026" responde {"entrada":"2026-06-05","salida":"2026-06-08"}`,
      'Extractor de fechas. Solo JSON puro, sin texto adicional.',
    );

    try {
      // Extract any JSON object from the response
      const match = extraccion.match(/\{[^}]+\}/);
      if (match) {
        const obj = JSON.parse(match[0]) as Record<string, string>;
        // Accept any key that looks like entry/exit date
        const entrada = obj['entrada'] ?? obj['fecha_entrada'] ?? obj['fecha_inicio'] ??
                        obj['entry'] ?? obj['check_in'] ?? '';
        const salida  = obj['salida']  ?? obj['fecha_salida']  ?? obj['fecha_fin']   ??
                        obj['exit']    ?? obj['check_out'] ?? '';
        if (entrada && salida && /\d{4}-\d{2}-\d{2}/.test(entrada) && /\d{4}-\d{2}-\d{2}/.test(salida)) {
          state.fecha_entrada = entrada;
          state.fecha_salida  = salida;
          state.paso = 'pidiendo_personas';
          await enviarFn(
            telefono,
            `📅 Perfecto: *${entrada}* al *${salida}*\n\n` +
            `¿Cuántas personas se hospedarán? 👥`,
          );
          return;
        }
      }
    } catch { /* fall through */ }

    await enviarFn(
      telefono,
      'No pude entender las fechas 😅\n\n' +
      'Por favor escríbelo así:\n*"del 25 al 27 de mayo"*\no *"25/05 al 27/05/2026"*',
    );
    return;
  }

  // ── PASO 2: Pidiendo personas ───────────────────────────────────────────
  if (state.paso === 'pidiendo_personas') {
    const num = parseInt(texto.match(/\d+/)?.[0] ?? '0', 10);
    if (num >= 1 && num <= 6) {
      state.personas = num;
      state.paso = 'mostrando_habitaciones';

      const disponibles = await getDisponibles(
        state.fecha_entrada!,
        state.fecha_salida!,
        num,
      );

      if (disponibles.length === 0) {
        state.paso = 'pidiendo_fechas';
        await enviarFn(
          telefono,
          `Lo siento 😔, no tenemos habitaciones disponibles para *${num} persona(s)* en esas fechas.\n\n` +
          `¿Te gustaría consultar otras fechas?`,
        );
        return;
      }

      const noches = Math.ceil(
        (new Date(state.fecha_salida!).getTime() -
         new Date(state.fecha_entrada!).getTime()) / 86_400_000,
      );

      let msg = `✅ Encontré *${disponibles.length} habitaciones* disponibles para *${num} persona(s)*:\n\n`;
      disponibles.forEach((h, i) => {
        const total = h.tarifa_base * noches;
        msg += `*${i + 1}. Habitación ${h.numero}* — ${h.tipo}\n`;
        msg += `   💰 S/ ${h.tarifa_base}/noche · Total ${noches} noches: *S/ ${total}*\n\n`;
      });
      msg += `¿Cuál te interesa? Responde el *número* (1, 2, 3...)`;

      state.opciones = disponibles;
      await enviarFn(telefono, msg);
      return;
    }

    await enviarFn(telefono, 'Por favor dime el número de personas (1 al 6) 👥');
    return;
  }

  // ── PASO 3: Mostrando habitaciones ─────────────────────────────────────
  if (state.paso === 'mostrando_habitaciones') {
    const opciones = state.opciones ?? [];
    const idx = parseInt(texto.match(/\d+/)?.[0] ?? '0', 10) - 1;

    if (idx >= 0 && idx < opciones.length) {
      state.habitacion = opciones[idx];
      state.paso = 'pidiendo_nombre';

      await enviarFn(
        telefono,
        `🛏️ *Habitación ${state.habitacion.numero}* seleccionada.\n\n` +
        `📋 Para completar la reserva necesito tus datos:\n\n` +
        `¿Cuál es tu *nombre completo*? 👤`,
      );
      return;
    }

    await enviarFn(telefono, 'Por favor elige un número de la lista.');
    return;
  }

  // ── PASO 4: Nombre ──────────────────────────────────────────────────────
  if (state.paso === 'pidiendo_nombre') {
    if (texto.trim().length >= 3) {
      state.nombre = texto.trim().toUpperCase();
      state.paso = 'pidiendo_dni';
      await enviarFn(
        telefono,
        `Gracias, *${state.nombre}* 😊\n\n` +
        `¿Cuál es tu número de *DNI o documento de identidad*? 🪪`,
      );
      return;
    }
    await enviarFn(telefono, 'Por favor escribe tu nombre completo.');
    return;
  }

  // ── PASO 5: DNI ─────────────────────────────────────────────────────────
  if (state.paso === 'pidiendo_dni') {
    const dni = texto.replace(/\s/g, '').trim();
    if (dni.length >= 7) {
      state.dni  = dni;
      state.paso = 'confirmando';

      const noches = Math.ceil(
        (new Date(state.fecha_salida!).getTime() -
         new Date(state.fecha_entrada!).getTime()) / 86_400_000,
      );
      const total   = state.habitacion!.tarifa_base * noches;
      const adelanto = total * 0.5;

      const resumen =
        `📋 *RESUMEN DE TU RESERVA*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏨 Hotel Hotelia — Arequipa\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Nombre:    ${state.nombre}\n` +
        `🪪 Documento: ${state.dni}\n` +
        `🛏️ Hab.:      ${state.habitacion!.numero} (${state.habitacion!.tipo})\n` +
        `👥 Personas:  ${state.personas}\n` +
        `📅 Entrada:   ${state.fecha_entrada}\n` +
        `📅 Salida:    ${state.fecha_salida}\n` +
        `🌙 Noches:    ${noches}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 Total:     S/ ${total.toFixed(2)}\n` +
        `💳 Adelanto (50%): *S/ ${adelanto.toFixed(2)}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Para pagar el adelanto:\n` +
        `📱 *Yape:* 987 654 321\n` +
        `📱 *Plin:* 987 654 321\n` +
        `🏦 Transferencia: BCP 123-456789-0-01\n\n` +
        `Envía la foto del comprobante de pago.\n\n` +
        `¿Confirmas la reserva? Responde *SI* para confirmar o *NO* para cancelar.`;

      await enviarFn(telefono, resumen);
      return;
    }
    await enviarFn(telefono, 'Por favor escribe tu número de documento.');
    return;
  }

  // ── PASO 6: Confirmación ────────────────────────────────────────────────
  if (state.paso === 'confirmando') {
    if (/^si$|^sí$|^yes$|^confirmo$|^ok$/i.test(texto.trim())) {
      try {
        const { codigo, noches, total, adelanto } = await crearReserva(state, telefono);

        const voucher =
          `✅ *¡RESERVA CONFIRMADA!*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🏨 *Hotel Hotelia* — Arequipa\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📌 *Código:* ${codigo}\n` +
          `👤 *Huésped:* ${state.nombre}\n` +
          `🪪 *Documento:* ${state.dni}\n` +
          `🛏️ *Habitación:* ${state.habitacion!.numero} — ${state.habitacion!.tipo}\n` +
          `👥 *Personas:* ${state.personas}\n` +
          `📅 *Check-in:*  ${state.fecha_entrada} desde las 14:00\n` +
          `📅 *Check-out:* ${state.fecha_salida} hasta las 12:00\n` +
          `🌙 *Noches:* ${noches}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 *Total:* S/ ${total.toFixed(2)}\n` +
          `💳 *Adelanto pendiente:* S/ ${adelanto.toFixed(2)}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📍 Dirección: Calle del Hotel, Arequipa\n` +
          `📞 Recepción: +51 987 654 321\n\n` +
          `Guarda este mensaje como comprobante.\n` +
          `¡Te esperamos! 🎉`;

        await enviarFn(telefono, voucher);
        limpiarConversacion(telefono);
        return;
      } catch (err) {
        console.error('[RESERVA ERROR]', err);
        await enviarFn(
          telefono,
          'Hubo un problema al registrar la reserva. Por favor llama a recepción: +51 987 654 321',
        );
        return;
      }
    }

    if (/^no$|^cancel/i.test(texto.trim())) {
      limpiarConversacion(telefono);
      await enviarFn(
        telefono,
        'Reserva cancelada. ¡Cuando quieras volver a consultar estamos aquí! 😊',
      );
      return;
    }

    await enviarFn(
      telefono,
      'Por favor responde *SI* para confirmar o *NO* para cancelar.',
    );
    return;
  }
}
