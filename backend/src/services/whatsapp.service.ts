import axios from 'axios';

const WA_URL   = () => process.env.WHATSAPP_API_URL    ?? 'https://graph.facebook.com/v19.0';
const PHONE_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
const TOKEN    = () => process.env.WHATSAPP_ACCESS_TOKEN    ?? '';

// ─── Template definitions ─────────────────────────────────────────────────────

const TEMPLATES: Record<string, { name: string; params: string[] }> = {
  confirmacion_reserva:   { name: 'hotel_reserva_confirmada',   params: ['nombre', 'codigo_reserva', 'habitacion', 'fecha_entrada', 'fecha_salida'] },
  checkin_bienvenida:     { name: 'hotel_checkin_bienvenida',   params: ['nombre', 'habitacion', 'wifi_password', 'checkout_hora'] },
  checkout_recordatorio:  { name: 'hotel_checkout_recordatorio',params: ['nombre', 'hora_checkout', 'saldo_pendiente'] },
  saldo_pendiente:        { name: 'hotel_saldo_pendiente',      params: ['nombre', 'monto', 'link_pago'] },
  encuesta_satisfaccion:  { name: 'hotel_encuesta',             params: ['nombre', 'link_encuesta'] },
};

// ─── Phone normalizer ─────────────────────────────────────────────────────────

function normalizarTelefono(tel: string): string {
  const digits = tel.replace(/\D/g, '');
  if (digits.startsWith('51')) return `+${digits}`;
  if (digits.length === 9)     return `+51${digits}`;
  return `+${digits}`;
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function enviarMensaje(
  telefono: string,
  tipo: string,
  variables: Record<string, string>,
): Promise<{ message_id: string; estado: string }> {
  const token = TOKEN();
  if (!token) {
    console.warn('[whatsapp] WHATSAPP_ACCESS_TOKEN no configurado — omitiendo envío');
    return { message_id: 'stub-' + Date.now(), estado: 'omitido' };
  }

  const tpl = TEMPLATES[tipo];
  if (!tpl) {
    console.warn(`[whatsapp] Tipo de plantilla desconocido: ${tipo}`);
    return { message_id: 'stub-' + Date.now(), estado: 'omitido' };
  }

  const components = [
    {
      type:       'body',
      parameters: tpl.params.map((key) => ({
        type: 'text',
        text: variables[key] ?? '',
      })),
    },
  ];

  try {
    const { data } = await axios.post<{
      messages: Array<{ id: string }>;
    }>(
      `${WA_URL()}/${PHONE_ID()}/messages`,
      {
        messaging_product: 'whatsapp',
        to:                normalizarTelefono(telefono),
        type:              'template',
        template: {
          name:     tpl.name,
          language: { code: 'es_PE' },
          components,
        },
      },
      {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    return { message_id: data.messages[0].id, estado: 'enviado' };
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 0;
      const detail = err.response?.data as { error?: { message: string } } | undefined;
      if (status >= 400 && status < 500) {
        const error = new Error(`WhatsApp template error: ${detail?.error?.message ?? err.message}`);
        (error as Error & { code: string }).code = 'WHATSAPP_TEMPLATE_ERROR';
        throw error;
      }
    }
    const error = new Error('WhatsApp no disponible');
    (error as Error & { code: string }).code = 'WHATSAPP_UNAVAILABLE';
    throw error;
  }
}
