import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermiso } from '../middleware/permisos';
import axios from 'axios';

const router = Router();
router.use(authenticate);

// ─── Helpers ──────────────────────────────────────────────────────────────────

type HuespedEnvio = { id: string; nombre: string; apellido: string; telefono: string; segmento: string };

async function obtenerDestinatarios(segmento: string): Promise<HuespedEnvio[]> {
  const seg = segmento.toUpperCase();
  if (seg === 'VIP') {
    return prisma.$queryRaw<HuespedEnvio[]>`
      SELECT id, nombre, apellido, telefono, segmento::text
      FROM huespedes
      WHERE segmento = 'VIP' AND telefono IS NOT NULL AND telefono != ''
      ORDER BY nombre
    `;
  }
  if (seg === 'CORPORATIVO') {
    return prisma.$queryRaw<HuespedEnvio[]>`
      SELECT id, nombre, apellido, telefono, segmento::text
      FROM huespedes
      WHERE segmento = 'CORPORATIVO' AND telefono IS NOT NULL AND telefono != ''
      ORDER BY nombre
    `;
  }
  if (seg === 'NORMAL') {
    return prisma.$queryRaw<HuespedEnvio[]>`
      SELECT id, nombre, apellido, telefono, segmento::text
      FROM huespedes
      WHERE segmento = 'NORMAL' AND telefono IS NOT NULL AND telefono != ''
      ORDER BY nombre
    `;
  }
  // TODOS — todos con teléfono válido
  return prisma.$queryRaw<HuespedEnvio[]>`
    SELECT id, nombre, apellido, telefono, segmento::text
    FROM huespedes
    WHERE telefono IS NOT NULL AND telefono != '' AND activo = true
    ORDER BY nombre
  `;
}

async function enviarWppMensaje(telefono: string, texto: string): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token   = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) throw new Error('WhatsApp no configurado');
  await axios.post(
    `https://graph.facebook.com/v18.0/${phoneId}/messages`,
    { messaging_product: 'whatsapp', to: telefono, type: 'text', text: { body: texto } },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

// ─── GET /campanas ────────────────────────────────────────────────────────────

router.get('/campanas', requirePermiso('crm.campanas.gestionar'), async (_req: Request, res: Response) => {
  try {
    const campanas = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT c.*,
             p.nombre || ' ' || p.apellido AS creado_por_nombre,
             (SELECT COUNT(*) FROM campanas_envios ce WHERE ce.campana_id = c.id) AS total_envios_registrados
      FROM campanas_crm c
      LEFT JOIN personal p ON p.id = c.personal_id
      ORDER BY c.created_at DESC
    `;
    res.json(campanas);
  } catch (err) {
    console.error('[campanas] listar error', err);
    res.status(500).json({ code: 'ERROR_INTERNO', message: 'Error listando campañas' });
  }
});

// ─── POST /campanas/preview ───────────────────────────────────────────────────

router.post('/campanas/preview', requirePermiso('crm.campanas.gestionar'), async (req: Request, res: Response) => {
  const { segmento } = req.body as { segmento?: string };
  if (!segmento) {
    res.status(400).json({ code: 'SEGMENTO_REQUERIDO', message: 'Se requiere el campo segmento' });
    return;
  }
  try {
    const huespedes = await obtenerDestinatarios(segmento);
    res.json({
      total: huespedes.length,
      segmento: segmento.toUpperCase(),
      huespedes: huespedes.map(h => ({
        id:      h.id,
        nombre:  `${h.nombre} ${h.apellido}`,
        telefono: h.telefono,
        segmento: h.segmento,
      })),
    });
  } catch (err) {
    console.error('[campanas] preview error', err);
    res.status(500).json({ code: 'ERROR_INTERNO', message: 'Error calculando preview' });
  }
});

// ─── POST /campanas ───────────────────────────────────────────────────────────

router.post('/campanas', requirePermiso('crm.campanas.gestionar'), async (req: Request, res: Response) => {
  const { nombre, mensaje, segmento_objetivo, tipo } = req.body as {
    nombre?: string; mensaje?: string; segmento_objetivo?: string; tipo?: string;
  };
  if (!nombre || !mensaje || !segmento_objetivo) {
    res.status(400).json({ code: 'CAMPOS_REQUERIDOS', message: 'nombre, mensaje y segmento_objetivo son obligatorios' });
    return;
  }
  try {
    const destinatarios = await obtenerDestinatarios(segmento_objetivo);
    const segUpper = segmento_objetivo.toUpperCase() as 'NORMAL' | 'VIP' | 'CORPORATIVO' | 'TODOS';
    const tipoUpper = (tipo ?? 'WHATSAPP').toUpperCase() as 'EMAIL' | 'WHATSAPP' | 'AMBOS';

    const [campana] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      INSERT INTO campanas_crm (nombre, tipo, segmento_objetivo, estado, mensaje_whatsapp,
                                total_destinatarios, personal_id, updated_at)
      VALUES (${nombre}, ${tipoUpper}::"TipoCampana", ${segUpper}::"SegmentoCampana",
              'BORRADOR'::"EstadoCampana", ${mensaje},
              ${destinatarios.length}, ${req.user?.sub ?? null}::uuid, NOW())
      RETURNING *
    `;
    res.status(201).json({ ...campana, total_destinatarios: destinatarios.length });
  } catch (err) {
    console.error('[campanas] crear error', err);
    res.status(500).json({ code: 'ERROR_INTERNO', message: 'Error creando campaña' });
  }
});

// ─── POST /campanas/:id/enviar ────────────────────────────────────────────────

router.post('/campanas/:id/enviar', requirePermiso('crm.campanas.gestionar'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM campanas_crm WHERE id = ${id}::uuid
    `;
    if (!rows.length) {
      res.status(404).json({ code: 'NO_ENCONTRADO', message: 'Campaña no encontrada' });
      return;
    }
    const campana = rows[0];
    if (campana.estado !== 'BORRADOR' && campana.estado !== 'PROGRAMADA') {
      res.status(409).json({
        code: 'ESTADO_INVALIDO',
        message: `No se puede enviar una campaña en estado ${campana.estado}`,
      });
      return;
    }

    // Cambiar estado a ENVIADA inmediatamente
    await prisma.$executeRaw`
      UPDATE campanas_crm SET estado = 'ENVIADA'::"EstadoCampana", updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    res.json({ ok: true, mensaje: 'Enviando en background', campana_id: id });

    // ── Background: enviar WhatsApp a cada destinatario ──
    setImmediate(async () => {
      try {
        const destinatarios = await obtenerDestinatarios(String(campana.segmento_objetivo));
        const mensaje = String(campana.mensaje_whatsapp ?? '');

        // Registrar envíos pendientes
        for (const h of destinatarios) {
          await prisma.$executeRaw`
            INSERT INTO campanas_envios (campana_id, huesped_id, telefono, estado)
            VALUES (${id}::uuid, ${h.id}::uuid, ${h.telefono}, 'pendiente')
            ON CONFLICT DO NOTHING
          `;
        }

        let enviados = 0;
        let fallidos = 0;

        for (const h of destinatarios) {
          const texto = mensaje
            .replace(/\{\{nombre\}\}/gi, h.nombre)
            .replace(/\{\{apellido\}\}/gi, h.apellido);
          try {
            await enviarWppMensaje(h.telefono, texto);
            await prisma.$executeRaw`
              UPDATE campanas_envios
              SET estado = 'enviado', enviado_at = NOW()
              WHERE campana_id = ${id}::uuid AND huesped_id = ${h.id}::uuid
            `;
            enviados++;
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Error desconocido';
            await prisma.$executeRaw`
              UPDATE campanas_envios
              SET estado = 'fallido', error_msg = ${errMsg}
              WHERE campana_id = ${id}::uuid AND huesped_id = ${h.id}::uuid
            `;
            fallidos++;
          }
          // 1s entre envíos para respetar rate limit de WhatsApp
          await new Promise(r => setTimeout(r, 1000));
        }

        await prisma.$executeRaw`
          UPDATE campanas_crm
          SET total_enviados = ${enviados}, fecha_enviada = NOW(), updated_at = NOW()
          WHERE id = ${id}::uuid
        `;

        console.log(`[campanas] ${id} completada: ${enviados} enviados, ${fallidos} fallidos`);
      } catch (bgErr) {
        console.error('[campanas] background error', bgErr);
      }
    });
  } catch (err) {
    console.error('[campanas] enviar error', err);
    res.status(500).json({ code: 'ERROR_INTERNO', message: 'Error iniciando envío' });
  }
});

// ─── GET /campanas/:id/estado ─────────────────────────────────────────────────

router.get('/campanas/:id/estado', requirePermiso('crm.campanas.gestionar'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM campanas_crm WHERE id = ${id}::uuid
    `;
    if (!rows.length) {
      res.status(404).json({ code: 'NO_ENCONTRADO', message: 'Campaña no encontrada' });
      return;
    }
    const c = rows[0];

    const enviosRecientes = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ce.estado, ce.telefono, ce.enviado_at, ce.error_msg,
             hue.nombre || ' ' || hue.apellido AS huesped
      FROM campanas_envios ce
      JOIN huespedes hue ON hue.id = ce.huesped_id
      WHERE ce.campana_id = ${id}::uuid
      ORDER BY ce.enviado_at DESC NULLS LAST
      LIMIT 5
    `;

    const total = Number(c.total_destinatarios ?? 0);
    const enviados = Number(c.total_enviados ?? 0);
    const pct = total > 0 ? Math.round((enviados / total) * 100) : 0;

    res.json({
      estado: c.estado,
      total_destinatarios: total,
      total_enviados: enviados,
      total_abiertos: Number(c.total_abiertos ?? 0),
      pct_completado: pct,
      fecha_enviada: c.fecha_enviada,
      envios_recientes: enviosRecientes,
    });
  } catch (err) {
    console.error('[campanas] estado error', err);
    res.status(500).json({ code: 'ERROR_INTERNO', message: 'Error consultando estado' });
  }
});

export default router;
