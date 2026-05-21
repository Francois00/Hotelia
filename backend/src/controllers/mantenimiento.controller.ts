import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const CrearSchema = z.object({
  tipo_problema: z.enum(['electrico','plomeria','mobiliario','climatizacion','limpieza_profunda','otro']),
  descripcion:   z.string().min(10).max(1000),
  prioridad:     z.enum(['baja','media','alta','urgente']).default('media'),
  tecnico_nombre: z.string().max(100).optional(),
  costo_estimado: z.number().positive().optional(),
});

const ActualizarSchema = z.object({
  estado:        z.enum(['pendiente','en_proceso','resuelto','cancelado']).optional(),
  notas_cierre:  z.string().max(1000).optional(),
  tecnico_nombre: z.string().max(100).optional(),
  costo_estimado: z.number().positive().optional(),
  fecha_fin:     z.string().datetime().optional(),
});

interface MRow {
  id: string; habitacion_id: string; tipo_problema: string; descripcion: string;
  tecnico_nombre: string | null; fecha_inicio: Date; fecha_fin: Date | null;
  horas_fuera_servicio: string | null; costo_estimado: string | null;
  estado: string; prioridad: string; reportado_por: string | null;
  notas_cierre: string | null; created_at: Date;
}

export async function listar(req: Request, res: Response): Promise<void> {
  const { id: habitacion_id } = req.params;
  const rows = await prisma.$queryRaw<MRow[]>(
    Prisma.sql`SELECT * FROM mantenimiento_registros WHERE habitacion_id = ${habitacion_id}::uuid ORDER BY created_at DESC LIMIT 50`,
  );
  res.json({ ok: true, data: rows });
}

export async function crear(req: Request, res: Response): Promise<void> {
  const { id: habitacion_id } = req.params;
  const body = CrearSchema.parse(req.body);
  const user = req.user as { id?: string } | undefined;

  const [row] = await prisma.$queryRaw<MRow[]>(Prisma.sql`
    INSERT INTO mantenimiento_registros
      (habitacion_id, tipo_problema, descripcion, prioridad, tecnico_nombre, costo_estimado, reportado_por)
    VALUES
      (${habitacion_id}::uuid, ${body.tipo_problema}, ${body.descripcion},
       ${body.prioridad}, ${body.tecnico_nombre ?? null}, ${body.costo_estimado ?? null},
       ${user?.id ?? null}::uuid)
    RETURNING *
  `);

  if (body.prioridad === 'urgente') {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE habitaciones SET estado = 'MANTENIMIENTO', updated_at = NOW()
      WHERE id = ${habitacion_id}::uuid AND estado NOT IN ('OCUPADA','RESERVADA')
    `);
  }

  res.status(201).json({ ok: true, data: row });
}

export async function actualizar(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = ActualizarSchema.parse(req.body);

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (body.estado !== undefined)        { sets.push(`estado = $${idx++}`);        vals.push(body.estado); }
  if (body.notas_cierre !== undefined)  { sets.push(`notas_cierre = $${idx++}`);  vals.push(body.notas_cierre); }
  if (body.tecnico_nombre !== undefined){ sets.push(`tecnico_nombre = $${idx++}`);vals.push(body.tecnico_nombre); }
  if (body.costo_estimado !== undefined){ sets.push(`costo_estimado = $${idx++}`);vals.push(body.costo_estimado); }

  if (body.estado === 'resuelto') {
    sets.push(`fecha_fin = $${idx++}`);
    vals.push(body.fecha_fin ?? new Date().toISOString());
  }

  if (sets.length === 0) { res.status(400).json({ ok: false, error: 'Sin cambios' }); return; }

  vals.push(id);
  const sql = `UPDATE mantenimiento_registros SET ${sets.join(', ')} WHERE id = $${idx}::uuid RETURNING *`;
  const rows = await prisma.$queryRawUnsafe<MRow[]>(sql, ...vals);

  res.json({ ok: true, data: rows[0] ?? null });
}
