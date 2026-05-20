import axios from 'axios';
import { prisma } from '../lib/prisma';
import { EstadoReserva, EstadoHabitacion } from '@prisma/client';

const OLLAMA_URL   = () => process.env.OLLAMA_URL ?? 'http://localhost:11434';
const WPP_TOKEN    = () => process.env.WHATSAPP_ACCESS_TOKEN ?? '';
const WPP_PHONE_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';

const SYSTEM_PROMPT = `Eres el Concierge IA del Hotel Hotelia en Arequipa, Perú.
Ayudas a los huéspedes a hacer reservas, consultar disponibilidad y responder preguntas.
Siempre responde en español, de forma amable y profesional.
Cuando el huésped quiera reservar, pide: fechas, número de personas y tipo de habitación.
Los precios van desde S/ 30 (habitación personal) hasta S/ 265 (suite).
Para confirmar una reserva se requiere el 50% de adelanto.`;

export async function obtenerDisponibilidad(fechaEntrada: string, fechaSalida: string) {
  return prisma.habitacion.findMany({
    where: {
      estado: EstadoHabitacion.DISPONIBLE,
      reservas: {
        none: {
          estado: { in: [EstadoReserva.CONFIRMADA, EstadoReserva.CHECKIN_REALIZADO] },
          fecha_entrada: { lte: new Date(fechaSalida) },
          fecha_salida:  { gte: new Date(fechaEntrada) },
        },
      },
    },
    select: {
      numero:            true,
      tipo:              true,
      tarifa_base:       true,
      tarifa_minima:     true,
      capacidad_adultos: true,
    },
  });
}

export async function preguntarLlama3(
  mensaje: string,
  contextoExtra?: string,
): Promise<string> {
  const prompt = `${SYSTEM_PROMPT}
${contextoExtra ?? ''}

Huésped dice: ${mensaje}
Concierge:`;

  try {
    const resp = await axios.post<{ response: string }>(
      `${OLLAMA_URL()}/api/generate`,
      { model: 'llama3', prompt, stream: false },
      { timeout: 30000 },
    );
    return resp.data.response?.trim() || 'Disculpa, no pude procesar tu mensaje.';
  } catch (err) {
    console.error('[concierge] Error Llama3:', err);
    return 'En este momento no puedo atenderte. Por favor llama a recepción.';
  }
}

export async function enviarMensajeWPP(telefono: string, texto: string): Promise<void> {
  const token   = WPP_TOKEN();
  const phoneId = WPP_PHONE_ID();

  if (!token || !phoneId) {
    console.log(`[concierge][DEV] Respuesta para ${telefono}: ${texto}`);
    return;
  }

  await axios.post(
    `https://graph.facebook.com/v18.0/${phoneId}/messages`,
    {
      messaging_product: 'whatsapp',
      to:   telefono,
      type: 'text',
      text: { body: texto },
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}
