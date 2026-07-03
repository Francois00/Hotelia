import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { resolverLocal, requirePermiso } from '../middleware/permisos';

const router = Router();
router.use(authenticate);

// ─── Helpers de scoping por local ──────────────────────────────────────────────

/**
 * Fragmento SQL condicional para filtrar por local en tablas con `local_id` NOT NULL
 * (almacen_articulos) o a través de un JOIN aliaseado. `alias` es siempre un literal
 * fijo (nunca input de usuario) — seguro para Prisma.raw.
 */
function filtroLocal(alias: string, localId: string | null | undefined) {
  return localId ? Prisma.sql`AND ${Prisma.raw(alias)}.local_id = ${localId}::uuid` : Prisma.empty;
}

/**
 * Igual que filtroLocal pero para tablas con `local_id` NULLABLE (almacen_categorias),
 * donde NULL = taxonomía compartida visible para cualquier local.
 */
function filtroLocalOCompartido(alias: string, localId: string | null | undefined) {
  return localId
    ? Prisma.sql`AND (${Prisma.raw(alias)}.local_id = ${localId}::uuid OR ${Prisma.raw(alias)}.local_id IS NULL)`
    : Prisma.empty;
}

// ─── GET /almacen/dashboard ────────────────────────────────────────────────────

router.get('/almacen/dashboard', resolverLocal, async (req: Request, res: Response) => {
  const localId = req.localId;
  try {
    const rows = await prisma.$queryRaw<Array<{
      total: bigint; normal: bigint; bajo: bigint; critico: bigint; valor_total: number;
    }>>(Prisma.sql`
      SELECT
        COUNT(*)                                                                 AS total,
        COUNT(*) FILTER (WHERE a.stock_actual > a.stock_minimo)                  AS normal,
        COUNT(*) FILTER (WHERE a.stock_actual <= a.stock_minimo AND a.stock_actual > 0) AS bajo,
        COUNT(*) FILTER (WHERE a.stock_actual = 0)                               AS critico,
        COALESCE(SUM(a.stock_actual * a.costo_promedio), 0)                      AS valor_total
      FROM almacen_articulos a
      WHERE a.activo = true
        ${filtroLocal('a', localId)}
    `);

    const alertas = await prisma.$queryRaw<Array<{ articulo: string; unidad: string; stock_actual: number; stock_minimo: number }>>(Prisma.sql`
      SELECT a.nombre AS articulo, a.unidad, a.stock_actual::float AS stock_actual, a.stock_minimo::float AS stock_minimo
      FROM almacen_articulos a
      WHERE a.activo = true AND a.stock_actual <= a.stock_minimo
        ${filtroLocal('a', localId)}
      ORDER BY a.stock_actual ASC
      LIMIT 10
    `);

    const r = rows[0];
    res.json({
      total:       Number(r.total),
      normal:      Number(r.normal),
      bajo:        Number(r.bajo),
      critico:     Number(r.critico),
      valor_total: Number(r.valor_total),
      alertas,
    });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── GET /almacen/categorias ───────────────────────────────────────────────────

router.get('/almacen/categorias', resolverLocal, async (req: Request, res: Response) => {
  const localId = req.localId;
  try {
    const cats = await prisma.$queryRaw<Array<{
      id: string; nombre: string; icono: string; color: string; total_articulos: bigint; alertas: bigint;
    }>>(Prisma.sql`
      SELECT
        c.id, c.nombre, c.icono, c.color,
        COUNT(a.id)                                                        AS total_articulos,
        COUNT(a.id) FILTER (WHERE a.stock_actual <= a.stock_minimo)        AS alertas
      FROM almacen_categorias c
      LEFT JOIN almacen_articulos a ON a.categoria_id = c.id AND a.activo = true ${filtroLocal('a', localId)}
      WHERE c.activo = true ${filtroLocalOCompartido('c', localId)}
      GROUP BY c.id, c.nombre, c.icono, c.color
      ORDER BY c.nombre
    `);
    res.json(cats.map(c => ({ ...c, total_articulos: Number(c.total_articulos), alertas: Number(c.alertas) })));
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── GET /almacen/articulos ───────────────────────────────────────────────────

router.get('/almacen/articulos', resolverLocal, async (req: Request, res: Response) => {
  const { categoria_id, buscar, alerta } = req.query as Record<string, string>;
  const localId = req.localId;

  try {
    const condiciones: Prisma.Sql[] = [Prisma.sql`a.activo = true`];
    if (categoria_id)   condiciones.push(Prisma.sql`a.categoria_id = ${categoria_id}::uuid`);
    if (buscar)         condiciones.push(Prisma.sql`a.nombre ILIKE ${'%' + buscar + '%'}`);
    if (alerta === '1') condiciones.push(Prisma.sql`a.stock_actual <= a.stock_minimo`);
    if (localId)        condiciones.push(Prisma.sql`a.local_id = ${localId}::uuid`);
    const where = Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`;

    const articulos = await prisma.$queryRaw<Array<{
      id: string; nombre: string; unidad: string; stock_actual: number; stock_minimo: number;
      stock_optimo: number; costo_promedio: number; proveedor_habitual: string | null;
      categoria_id: string; categoria_nombre: string; categoria_color: string; categoria_icono: string;
    }>>(Prisma.sql`
      SELECT
        a.id, a.nombre, a.unidad,
        a.stock_actual::float   AS stock_actual,
        a.stock_minimo::float   AS stock_minimo,
        a.stock_optimo::float   AS stock_optimo,
        a.costo_promedio::float AS costo_promedio,
        a.proveedor_habitual,
        a.categoria_id,
        c.nombre AS categoria_nombre,
        c.color  AS categoria_color,
        c.icono  AS categoria_icono
      FROM almacen_articulos a
      JOIN almacen_categorias c ON c.id = a.categoria_id
      ${where}
      ORDER BY c.nombre, a.nombre
    `);

    res.json(articulos);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── POST /almacen/articulos ──────────────────────────────────────────────────

router.post('/almacen/articulos', requirePermiso('almacen.administrar'), async (req: Request, res: Response) => {
  const { nombre, categoria_id, unidad = 'unidades', stock_actual = 0, stock_minimo, stock_optimo, costo_promedio = 0, proveedor_habitual } = req.body as {
    nombre: string; categoria_id: string; unidad?: string; stock_actual?: number;
    stock_minimo: number; stock_optimo: number; costo_promedio?: number; proveedor_habitual?: string;
  };

  if (!nombre || !categoria_id || stock_minimo == null || stock_optimo == null) {
    res.status(400).json({ error: 'nombre, categoria_id, stock_minimo y stock_optimo son requeridos' });
    return;
  }

  const localId = req.localId;
  if (!localId) {
    res.status(400).json({ code: 'LOCAL_REQUERIDO', message: 'Debe especificar el local (header X-Local-Id)' });
    return;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO almacen_articulos (nombre, categoria_id, unidad, stock_actual, stock_minimo, stock_optimo, costo_promedio, proveedor_habitual, local_id)
      VALUES (${nombre}, ${categoria_id}::uuid, ${unidad}, ${Number(stock_actual)}, ${Number(stock_minimo)}, ${Number(stock_optimo)}, ${Number(costo_promedio)}, ${proveedor_habitual ?? null}, ${localId}::uuid)
      RETURNING id
    `;
    res.status(201).json({ id: rows[0].id });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── PUT /almacen/articulos/:id ───────────────────────────────────────────────

router.put('/almacen/articulos/:id', requirePermiso('almacen.administrar'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const localId = req.localId;
  const { nombre, unidad, stock_minimo, stock_optimo, proveedor_habitual } = req.body as {
    nombre?: string; unidad?: string; stock_minimo?: number; stock_optimo?: number; proveedor_habitual?: string;
  };

  try {
    await prisma.$executeRaw`
      UPDATE almacen_articulos
      SET
        nombre             = COALESCE(${nombre ?? null}, nombre),
        unidad             = COALESCE(${unidad ?? null}, unidad),
        stock_minimo       = COALESCE(${stock_minimo != null ? Number(stock_minimo) : null}::numeric, stock_minimo),
        stock_optimo       = COALESCE(${stock_optimo != null ? Number(stock_optimo) : null}::numeric, stock_optimo),
        proveedor_habitual = COALESCE(${proveedor_habitual ?? null}, proveedor_habitual),
        updated_at         = NOW()
      WHERE id = ${id}::uuid
        ${localId ? Prisma.sql`AND local_id = ${localId}::uuid` : Prisma.empty}
    `;
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── POST /almacen/movimientos/entrada ───────────────────────────────────────

router.post('/almacen/movimientos/entrada', requirePermiso('almacen.movimiento.registrar'), async (req: Request, res: Response) => {
  const localId = req.localId;
  const { articulo_id, cantidad, precio_unitario, motivo } = req.body as {
    articulo_id: string; cantidad: number; precio_unitario?: number; motivo?: string;
  };

  if (!articulo_id || !cantidad || Number(cantidad) <= 0) {
    res.status(400).json({ error: 'articulo_id y cantidad > 0 son requeridos' });
    return;
  }

  try {
    const art = await prisma.$queryRaw<Array<{ stock_actual: number; costo_promedio: number }>>`
      SELECT stock_actual::float AS stock_actual, costo_promedio::float AS costo_promedio
      FROM almacen_articulos WHERE id = ${articulo_id}::uuid
        ${localId ? Prisma.sql`AND local_id = ${localId}::uuid` : Prisma.empty}
    `;
    if (!art.length) { res.status(404).json({ error: 'Artículo no encontrado' }); return; }

    const anterior  = Number(art[0].stock_actual);
    const nuevo     = anterior + Number(cantidad);
    const costoAnt  = Number(art[0].costo_promedio);
    const costoUnit = precio_unitario != null ? Number(precio_unitario) : costoAnt;
    // Costo promedio ponderado
    const costoPromedio = nuevo > 0
      ? (anterior * costoAnt + Number(cantidad) * costoUnit) / nuevo
      : costoUnit;

    await prisma.$executeRaw`
      UPDATE almacen_articulos
      SET stock_actual = ${nuevo}, costo_promedio = ${costoPromedio}, updated_at = NOW()
      WHERE id = ${articulo_id}::uuid
        ${localId ? Prisma.sql`AND local_id = ${localId}::uuid` : Prisma.empty}
    `;

    await prisma.$executeRaw`
      INSERT INTO almacen_movimientos (articulo_id, tipo, cantidad, stock_resultante, precio_unitario, motivo, responsable_id)
      VALUES (${articulo_id}::uuid, 'entrada', ${Number(cantidad)}, ${nuevo}, ${costoUnit}, ${motivo ?? 'Entrada manual'}, ${req.user!.sub}::uuid)
    `;

    res.json({ ok: true, stock_anterior: anterior, stock_nuevo: nuevo, costo_promedio: Number(costoPromedio.toFixed(2)) });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── POST /almacen/movimientos/salida ────────────────────────────────────────

router.post('/almacen/movimientos/salida', requirePermiso('almacen.movimiento.registrar'), async (req: Request, res: Response) => {
  const localId = req.localId;
  const { articulo_id, cantidad, motivo, referencia_doc, habitacion_id } = req.body as {
    articulo_id: string; cantidad: number; motivo?: string; referencia_doc?: string; habitacion_id?: string;
  };

  if (!articulo_id || !cantidad || Number(cantidad) <= 0) {
    res.status(400).json({ error: 'articulo_id y cantidad > 0 son requeridos' });
    return;
  }

  try {
    const art = await prisma.$queryRaw<Array<{ stock_actual: number; stock_minimo: number; nombre: string; costo_promedio: number }>>`
      SELECT stock_actual::float AS stock_actual, stock_minimo::float AS stock_minimo, nombre, costo_promedio::float AS costo_promedio
      FROM almacen_articulos WHERE id = ${articulo_id}::uuid
        ${localId ? Prisma.sql`AND local_id = ${localId}::uuid` : Prisma.empty}
    `;
    if (!art.length) { res.status(404).json({ error: 'Artículo no encontrado' }); return; }

    const anterior = Number(art[0].stock_actual);
    if (anterior < Number(cantidad)) {
      res.status(400).json({ error: `Stock insuficiente. Disponible: ${anterior}` });
      return;
    }

    const nuevo = anterior - Number(cantidad);

    await prisma.$executeRaw`
      UPDATE almacen_articulos SET stock_actual = ${nuevo}, updated_at = NOW()
      WHERE id = ${articulo_id}::uuid
        ${localId ? Prisma.sql`AND local_id = ${localId}::uuid` : Prisma.empty}
    `;

    await prisma.$executeRaw`
      INSERT INTO almacen_movimientos (articulo_id, tipo, cantidad, stock_resultante, precio_unitario, motivo, responsable_id, habitacion_id, referencia_doc)
      VALUES (${articulo_id}::uuid, 'salida', ${Number(cantidad)}, ${nuevo}, ${Number(art[0].costo_promedio)}, ${motivo ?? 'Salida manual'}, ${req.user!.sub}::uuid, ${habitacion_id ?? null}, ${referencia_doc ?? null})
    `;

    res.json({
      ok: true,
      stock_anterior: anterior,
      stock_nuevo: nuevo,
      alerta_stock: nuevo <= Number(art[0].stock_minimo),
    });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── GET /almacen/movimientos ─────────────────────────────────────────────────

router.get('/almacen/movimientos', resolverLocal, async (req: Request, res: Response) => {
  const page  = Math.max(1, Number(req.query.page  ?? 1));
  const limit = Math.min(50, Number(req.query.limit ?? 20));
  const offset = (page - 1) * limit;
  const articulo_id = req.query.articulo_id as string | undefined;
  const localId = req.localId;

  try {
    const condiciones: Prisma.Sql[] = [];
    if (articulo_id) condiciones.push(Prisma.sql`m.articulo_id = ${articulo_id}::uuid`);
    if (localId)      condiciones.push(Prisma.sql`a.local_id = ${localId}::uuid`);
    const filtro = condiciones.length ? Prisma.sql`AND ${Prisma.join(condiciones, ' AND ')}` : Prisma.empty;

    const movimientos = await prisma.$queryRaw<Array<{
      id: string; tipo: string; cantidad: number; stock_resultante: number;
      precio_unitario: number | null; motivo: string | null; created_at: string;
      articulo_nombre: string; articulo_unidad: string; personal_nombre: string | null;
    }>>(Prisma.sql`
      SELECT
        m.id, m.tipo, m.cantidad::float AS cantidad,
        m.stock_resultante::float AS stock_resultante,
        m.precio_unitario::float AS precio_unitario,
        m.motivo, m.created_at,
        a.nombre AS articulo_nombre, a.unidad AS articulo_unidad,
        CONCAT(p.nombre, ' ', p.apellido) AS personal_nombre
      FROM almacen_movimientos m
      JOIN almacen_articulos a ON a.id = m.articulo_id
      LEFT JOIN personal p ON p.id = m.responsable_id
      WHERE 1=1 ${filtro}
      ORDER BY m.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*) FROM almacen_movimientos m
      JOIN almacen_articulos a ON a.id = m.articulo_id
      WHERE 1=1 ${filtro}
    `);

    res.json({
      data:  movimientos,
      total: Number(total[0].count),
      page,
      pages: Math.ceil(Number(total[0].count) / limit),
    });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── GET /almacen/alertas ─────────────────────────────────────────────────────

router.get('/almacen/alertas', resolverLocal, async (req: Request, res: Response) => {
  const localId = req.localId;
  try {
    const alertas = await prisma.$queryRaw<Array<{
      id: string; nombre: string; unidad: string; stock_actual: number; stock_minimo: number;
      stock_optimo: number; categoria: string; color: string; icono: string;
    }>>(Prisma.sql`
      SELECT
        a.id, a.nombre, a.unidad,
        a.stock_actual::float AS stock_actual,
        a.stock_minimo::float AS stock_minimo,
        a.stock_optimo::float AS stock_optimo,
        c.nombre AS categoria, c.color, c.icono
      FROM almacen_articulos a
      JOIN almacen_categorias c ON c.id = a.categoria_id
      WHERE a.activo = true AND a.stock_actual <= a.stock_minimo
        ${filtroLocal('a', localId)}
      ORDER BY a.stock_actual ASC, a.nombre
    `);
    res.json(alertas);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── POST /almacen/inventariados ──────────────────────────────────────────────

router.post('/almacen/inventariados', requirePermiso('almacen.administrar'), async (req: Request, res: Response) => {
  const { observaciones } = req.body as { observaciones?: string };
  const localId = req.localId;

  try {
    const activo = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM almacen_inventariados WHERE estado = 'en_proceso' LIMIT 1
    `;
    if (activo.length) {
      res.status(409).json({ error: 'Ya existe un inventariado en proceso', inventariado_id: activo[0].id });
      return;
    }

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO almacen_inventariados (responsable_id, observaciones)
      VALUES (${req.user!.sub}::uuid, ${observaciones ?? null})
      RETURNING id
    `;
    const inventariado_id = rows[0].id;

    await prisma.$executeRaw`
      INSERT INTO almacen_inventariado_items (inventariado_id, articulo_id, stock_teorico)
      SELECT ${inventariado_id}::uuid, id, stock_actual
      FROM almacen_articulos WHERE activo = true
        ${localId ? Prisma.sql`AND local_id = ${localId}::uuid` : Prisma.empty}
    `;

    res.status(201).json({ id: inventariado_id });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── GET /almacen/inventariados/activo ───────────────────────────────────────

router.get('/almacen/inventariados/activo', resolverLocal, async (req: Request, res: Response) => {
  const localId = req.localId;
  try {
    const inv = await prisma.$queryRaw<Array<{ id: string; fecha_inicio: string; responsable_nombre: string }>>`
      SELECT i.id, i.fecha_inicio, CONCAT(p.nombre, ' ', p.apellido) AS responsable_nombre
      FROM almacen_inventariados i
      LEFT JOIN personal p ON p.id = i.responsable_id
      WHERE i.estado = 'en_proceso'
      LIMIT 1
    `;
    if (!inv.length) { res.json(null); return; }

    const items = await prisma.$queryRaw<Array<{
      id: string; articulo_id: string; articulo_nombre: string; unidad: string;
      stock_teorico: number; stock_contado: number | null; diferencia: number | null;
      categoria: string; color: string; icono: string;
    }>>(Prisma.sql`
      SELECT
        ii.id, ii.articulo_id, a.nombre AS articulo_nombre, a.unidad,
        ii.stock_teorico::float  AS stock_teorico,
        ii.stock_contado::float  AS stock_contado,
        ii.diferencia::float     AS diferencia,
        c.nombre AS categoria, c.color, c.icono
      FROM almacen_inventariado_items ii
      JOIN almacen_articulos a ON a.id = ii.articulo_id
      JOIN almacen_categorias c ON c.id = a.categoria_id
      WHERE ii.inventariado_id = ${inv[0].id}::uuid
        ${filtroLocal('a', localId)}
      ORDER BY c.nombre, a.nombre
    `);

    res.json({ ...inv[0], items });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── PATCH /almacen/inventariados/:id/items/:itemId ──────────────────────────

router.patch('/almacen/inventariados/:id/items/:itemId', requirePermiso('almacen.movimiento.registrar'), async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const localId = req.localId;
  const { stock_contado } = req.body as { stock_contado: number };

  if (stock_contado == null || Number(stock_contado) < 0) {
    res.status(400).json({ error: 'stock_contado >= 0 es requerido' });
    return;
  }

  try {
    // El local se deriva transitivamente vía articulo_id → almacen_articulos.local_id.
    await prisma.$executeRaw`
      UPDATE almacen_inventariado_items ii
      SET stock_contado = ${Number(stock_contado)},
          diferencia    = ${Number(stock_contado)} - ii.stock_teorico
      FROM almacen_articulos a
      WHERE ii.id = ${itemId}::uuid
        AND a.id = ii.articulo_id
        ${localId ? Prisma.sql`AND a.local_id = ${localId}::uuid` : Prisma.empty}
    `;
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

// ─── POST /almacen/inventariados/:id/cerrar ───────────────────────────────────

router.post('/almacen/inventariados/:id/cerrar', requirePermiso('almacen.administrar'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const localId = req.localId;
  const { observaciones } = req.body as { observaciones?: string };

  try {
    const inv = await prisma.$queryRaw<Array<{ id: string; estado: string }>>`
      SELECT id, estado FROM almacen_inventariados WHERE id = ${id}::uuid
    `;
    if (!inv.length) { res.status(404).json({ error: 'Inventariado no encontrado' }); return; }
    if (inv[0].estado !== 'en_proceso') { res.status(400).json({ error: 'El inventariado ya está cerrado' }); return; }

    const items = await prisma.$queryRaw<Array<{
      articulo_id: string; stock_teorico: number; stock_contado: number | null; diferencia: number | null;
    }>>(Prisma.sql`
      SELECT ii.articulo_id, ii.stock_teorico::float AS stock_teorico, ii.stock_contado::float AS stock_contado, ii.diferencia::float AS diferencia
      FROM almacen_inventariado_items ii
      JOIN almacen_articulos a ON a.id = ii.articulo_id
      WHERE ii.inventariado_id = ${id}::uuid AND ii.stock_contado IS NOT NULL AND ii.diferencia != 0
        ${filtroLocal('a', localId)}
    `);

    for (const item of items) {
      await prisma.$executeRaw`
        UPDATE almacen_articulos SET stock_actual = ${Number(item.stock_contado)}, updated_at = NOW()
        WHERE id = ${item.articulo_id}::uuid
          ${localId ? Prisma.sql`AND local_id = ${localId}::uuid` : Prisma.empty}
      `;
      await prisma.$executeRaw`
        INSERT INTO almacen_movimientos (articulo_id, tipo, cantidad, stock_resultante, motivo, responsable_id, referencia_doc)
        VALUES (${item.articulo_id}::uuid, 'inventariado', ${Math.abs(Number(item.diferencia))}, ${Number(item.stock_contado)}, 'Ajuste por inventario físico', ${req.user!.sub}::uuid, ${id})
      `;
    }

    await prisma.$executeRaw`
      UPDATE almacen_inventariados
      SET estado = 'completado', fecha_fin = NOW(),
          total_diferencias = ${items.length},
          observaciones = COALESCE(${observaciones ?? null}, observaciones)
      WHERE id = ${id}::uuid
    `;

    res.json({ ok: true, ajustes_aplicados: items.length });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error' });
  }
});

export default router;
