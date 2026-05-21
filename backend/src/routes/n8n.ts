import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import {
  CanalReserva,
  EstadoHabitacion,
  EstadoReserva,
  SegmentoHuesped,
  TipoDocumento,
} from '@prisma/client';
import { prisma } from '../lib/prisma';

const router = Router();

const N8N_TOKEN = process.env.N8N_SECRET_TOKEN ?? 'n8n_hotelia_2025';

function authN8n(req: Request, res: Response, next: NextFunction): void {
  if (req.headers['x-n8n-token'] !== N8N_TOKEN) {
    res.status(401).json({ error: 'Token inválido' });
    return;
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Interpretar intención del mensaje con Llama3
// ─────────────────────────────────────────────────────────────────────────────
router.post('/n8n/interpretar-mensaje', authN8n, async (req: Request, res: Response) => {
  const { telefono, mensaje, historial = [] } = req.body as {
    telefono: string;
    mensaje: string;
    historial: Array<{ rol: string; contenido: string }>;
  };

  const historialStr = (historial as Array<{ rol: string; contenido: string }>)
    .slice(-4)
    .map((h) => `${h.rol === 'user' ? 'Huésped' : 'Asistente'}: ${h.contenido}`)
    .join('\n');

  const prompt = `${historialStr ? historialStr + '\n' : ''}Huésped: ${mensaje}`;

  const hoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const sistema = `Eres el asistente de reservas del Hotel Hotelia en Arequipa, Perú.
Analiza el mensaje y responde SOLO con JSON:
{
  "intencion": "reservar|consultar_precio|consultar_disponibilidad|confirmar|cancelar|dar_nombre|dar_dni|dar_fechas|dar_personas|elegir_habitacion|otro",
  "datos_extraidos": {
    "fecha_entrada": "YYYY-MM-DD o null",
    "fecha_salida": "YYYY-MM-DD o null",
    "personas": null_o_numero,
    "nombre": "nombre completo o null",
    "dni": "numero o null",
    "numero_habitacion": "numero o null",
    "confirmacion": null_o_true_o_false
  },
  "respuesta_sugerida": "mensaje corto para el huésped si no es suficiente info"
}
Hoy es ${hoy}.`;

  try {
    const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
    const r = await axios.post<{ response: string }>(
      `${ollamaUrl}/api/generate`,
      { model: 'llama3', system: sistema, prompt, stream: false },
      { timeout: 25_000 },
    );
    const raw  = r.data.response ?? '{}';
    const match = raw.match(/\{[\s\S]*\}/);
    const json = JSON.parse(match?.[0] ?? '{}') as Record<string, unknown>;
    res.json({ ok: true, ...json });
  } catch {
    res.json({
      ok: false, intencion: 'otro',
      datos_extraidos: {}, respuesta_sugerida: 'Un momento por favor.',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Consultar disponibilidad
// ─────────────────────────────────────────────────────────────────────────────
router.post('/n8n/disponibilidad', authN8n, async (req: Request, res: Response) => {
  const { fecha_entrada, fecha_salida, personas = 1 } = req.body as {
    fecha_entrada: string;
    fecha_salida: string;
    personas?: number;
  };

  try {
    const habs = await prisma.habitacion.findMany({
      where: {
        estado:            EstadoHabitacion.DISPONIBLE,
        capacidad_adultos: { gte: Number(personas) },
        reservas: {
          none: {
            estado:        { in: [EstadoReserva.CONFIRMADA, EstadoReserva.CHECKIN_REALIZADO] },
            fecha_entrada: { lte: new Date(fecha_salida) },
            fecha_salida:  { gte: new Date(fecha_entrada) },
          },
        },
      },
      select: {
        id: true, numero: true, tipo: true,
        tarifa_base: true, tarifa_minima: true,
        capacidad_adultos: true, amenidades: true,
      },
      take: 6,
    });

    const noches = Math.ceil(
      (new Date(fecha_salida).getTime() - new Date(fecha_entrada).getTime()) / 86_400_000,
    );

    res.json({
      ok: true,
      disponibles: habs.map((h) => ({
        id:               h.id,
        numero:           h.numero,
        tipo:             h.tipo,
        tarifa_base:      Number(h.tarifa_base),
        amenidades:       h.amenidades,
        capacidad_adultos: h.capacidad_adultos,
        noches,
        total:    Number(h.tarifa_base) * noches,
        adelanto: Number(h.tarifa_base) * noches * 0.5,
      })),
      total_encontradas: habs.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    res.json({ ok: false, error: msg, disponibles: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Crear o actualizar huésped
// ─────────────────────────────────────────────────────────────────────────────
router.post('/n8n/upsert-huesped', authN8n, async (req: Request, res: Response) => {
  const { nombre, dni, telefono } = req.body as {
    nombre: string; dni: string; telefono: string;
  };

  const raw = (dni ?? '').trim();
  let tipoDoc: TipoDocumento = TipoDocumento.DOC_EXTRANJERO;
  if (/^\d{8}$/.test(raw))  tipoDoc = TipoDocumento.DNI;
  else if (/^\d{11}$/.test(raw)) tipoDoc = TipoDocumento.RUC;
  else if (/^[A-Z0-9]{6,12}$/i.test(raw)) tipoDoc = TipoDocumento.PASAPORTE;

  const partes  = (nombre ?? '').trim().toUpperCase().split(/\s+/);
  // In Peru: APELLIDO1 APELLIDO2 NOMBRE1 [NOMBRE2]
  const apellido = partes.slice(0, 2).join(' ') || 'S/A';
  const nombre_  = partes.slice(2).join(' ') || (partes[0] ?? 'HUÉSPED');

  const huesped = await prisma.huesped.upsert({
    where:  { numero_documento: raw },
    create: {
      nombre:           nombre_,
      apellido,
      tipo_documento:   tipoDoc,
      numero_documento: raw,
      telefono,
      segmento: SegmentoHuesped.NUEVO,
    },
    update: { telefono },
  });

  res.json({
    ok: true,
    huesped_id: huesped.id,
    nombre:    huesped.nombre,
    apellido:  huesped.apellido,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Crear reserva
// ─────────────────────────────────────────────────────────────────────────────
router.post('/n8n/crear-reserva', authN8n, async (req: Request, res: Response) => {
  const {
    huesped_id, habitacion_id, fecha_entrada, fecha_salida,
    personas, precio_noche, telefono,
  } = req.body as {
    huesped_id: string; habitacion_id: string;
    fecha_entrada: string; fecha_salida: string;
    personas: number; precio_noche: number; telefono: string;
  };

  try {
    const noches = Math.ceil(
      (new Date(fecha_salida).getTime() - new Date(fecha_entrada).getTime()) / 86_400_000,
    );

    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sufijo = Math.random().toString(36).slice(2, 8).toUpperCase();
    const codigo = `WPP-${fecha}-${sufijo}`;

    const reserva = await prisma.reserva.create({
      data: {
        codigo,
        huesped_id,
        habitacion_id,
        canal:           CanalReserva.WHATSAPP,
        estado:          EstadoReserva.CONFIRMADA,
        fecha_entrada:   new Date(fecha_entrada),
        fecha_salida:    new Date(fecha_salida),
        tarifa_acordada: Number(precio_noche),
        adultos:         Number(personas),
        notas:           `Reserva vía WhatsApp IA Concierge. Tel: ${telefono}`,
      },
    });

    res.json({ ok: true, reserva_id: reserva.id, codigo: reserva.codigo });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    res.json({ ok: false, error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Guardar mensaje en historial (audit log)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/n8n/guardar-mensaje', authN8n, async (req: Request, res: Response) => {
  const { telefono, rol, contenido, reserva_id } = req.body as {
    telefono: string; rol: string; contenido: string; reserva_id?: string;
  };

  const nullUUID = '00000000-0000-0000-0000-000000000000';

  await prisma.auditLog.create({
    data: {
      entidad:    'conversacion_wpp',
      entidad_id: reserva_id ?? nullUUID,
      accion:     rol === 'user' ? 'mensaje_huesped' : 'mensaje_concierge',
      campos_modificados: { telefono, contenido },
      actor_email: `wpp:${telefono}`,
    },
  }).catch(() => { /* non-fatal */ });

  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Generar voucher de confirmación
// ─────────────────────────────────────────────────────────────────────────────
router.post('/n8n/generar-voucher', authN8n, async (req: Request, res: Response) => {
  const { reserva_id } = req.body as { reserva_id: string };

  const r = await prisma.reserva.findUnique({
    where:   { id: reserva_id },
    include: {
      habitacion: { select: { numero: true, tipo: true } },
      huesped:    { select: { nombre: true, apellido: true, numero_documento: true } },
    },
  });

  if (!r) {
    res.json({ ok: false, voucher: 'Error al generar voucher: reserva no encontrada' });
    return;
  }

  const noches  = Math.ceil(
    (r.fecha_salida.getTime() - r.fecha_entrada.getTime()) / 86_400_000,
  );
  const total   = Number(r.tarifa_acordada) * noches;
  const adelanto = total * 0.5;

  const yape = process.env.HOTEL_YAPE ?? '987654321';
  const plin = process.env.HOTEL_PLIN ?? '987654321';

  const voucher =
    `✅ *¡RESERVA CONFIRMADA!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏨 *Hotel Hotelia* — Arequipa\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 *Código:* ${r.codigo}\n` +
    `👤 *Huésped:* ${r.huesped?.nombre} ${r.huesped?.apellido}\n` +
    `🪪 *Documento:* ${r.huesped?.numero_documento}\n` +
    `🛏️ *Habitación:* ${r.habitacion?.numero} — ${r.habitacion?.tipo}\n` +
    `👥 *Personas:* ${r.adultos}\n` +
    `📅 *Check-in:*  ${r.fecha_entrada.toISOString().split('T')[0]} · desde 14:00\n` +
    `📅 *Check-out:* ${r.fecha_salida.toISOString().split('T')[0]} · hasta 12:00\n` +
    `🌙 *Noches:* ${noches}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *Total:* S/ ${total.toFixed(2)}\n` +
    `💳 *Adelanto 50%:* S/ ${adelanto.toFixed(2)}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Pago del adelanto:\n` +
    `📱 Yape: ${yape}\n` +
    `📱 Plin: ${plin}\n\n` +
    `Guarda este mensaje. ¡Te esperamos! 🎉`;

  res.json({ ok: true, voucher });
});

export default router;
