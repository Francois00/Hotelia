import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { TipoTurno, EstadoTurno, MetodoPago } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { generarPDFReporte } from './reporte-turno.service';
import fs from 'fs';
import path from 'path';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AbrirTurnoInput {
  tipo:          TipoTurno;
  saldo_inicial: number;
  personal_id:   string;
}

export interface RegistrarGastoInput {
  turno_id:              string;
  concepto:              string;
  monto:                 number;
  comprobante_proveedor?: string;
  registrado_por_id:     string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METODOS_TARJETA: MetodoPago[] = [MetodoPago.TARJETA_CREDITO, MetodoPago.TARJETA_DEBITO, MetodoPago.TARJETA, MetodoPago.NIUBIZ, MetodoPago.STRIPE];

async function calcularResumenTurno(turnoId: string, horaApertura: Date) {
  const [reservas, pagos, gastos] = await Promise.all([
    // Reservas creadas durante el turno
    prisma.reserva.findMany({
      where: {
        created_at: { gte: horaApertura },
        estado:     { in: ['CHECKIN_REALIZADO', 'CHECKOUT_REALIZADO', 'CONFIRMADA'] as const },
      },
      select: { id: true, estado: true, created_at: true },
    }),

    // Todos los pagos de reservas creadas en el turno
    prisma.pago.findMany({
      where:  { created_at: { gte: horaApertura } },
      select: { metodo: true, monto: true },
    }),

    // Gastos del turno
    prisma.gastoCaja.findMany({
      where:  { turno_id: turnoId },
      select: { monto: true },
    }),
  ]);

  const sumar = (metodo: MetodoPago) =>
    pagos.filter((p) => p.metodo === metodo).reduce((s, p) => s + Number(p.monto), 0);

  const total_efectivo      = sumar(MetodoPago.EFECTIVO);
  const total_yape          = sumar(MetodoPago.YAPE);
  const total_plin          = sumar(MetodoPago.PLIN);
  const total_tarjetas      = METODOS_TARJETA.reduce((s, m) => s + sumar(m), 0);
  const total_transferencias= sumar(MetodoPago.TRANSFERENCIA);
  const total_general       = pagos.reduce((s, p) => s + Number(p.monto), 0);
  const total_gastos_caja   = gastos.reduce((s, g) => s + Number(g.monto), 0);
  const efectivo_neto       = total_efectivo - total_gastos_caja;

  const checkins  = reservas.filter((r) => ['CHECKIN_REALIZADO', 'CHECKOUT_REALIZADO'].includes(r.estado)).length;
  const checkouts = reservas.filter((r) => r.estado === 'CHECKOUT_REALIZADO').length;

  return {
    total_checkins:        checkins,
    total_checkouts:       checkouts,
    total_efectivo,
    total_yape,
    total_plin,
    total_tarjetas,
    total_transferencias,
    total_general,
    total_gastos_caja,
    efectivo_neto,
  };
}

async function notificarCierreTurno(reporte: Record<string, unknown>): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await axios.post(`${url}/webhook/cierre-turno`, { evento: 'turno_cerrado', reporte }, { timeout: 5000 });
  } catch { /* non-fatal */ }
}

// ─── Operaciones ──────────────────────────────────────────────────────────────

export async function abrirTurno(input: AbrirTurnoInput) {
  const turnoAbierto = await prisma.turno.findFirst({
    where: { estado: EstadoTurno.ABIERTO },
  });

  if (turnoAbierto) {
    throw new AppError(
      'TURNO_YA_ABIERTO',
      409,
      'Ya existe un turno abierto. Debe cerrarlo antes de abrir uno nuevo.',
    );
  }

  const turno = await prisma.turno.create({
    data: {
      tipo:             input.tipo,
      recepcionista_id: input.personal_id,
      fecha:            new Date(),
      saldo_inicial:    input.saldo_inicial,
      estado:           EstadoTurno.ABIERTO,
    },
    include: {
      recepcionista: { select: { nombre: true, apellido: true, rol: true } },
    },
  });

  return turno;
}

export async function obtenerTurnoActivo() {
  const turno = await prisma.turno.findFirst({
    where:   { estado: EstadoTurno.ABIERTO },
    include: { recepcionista: { select: { nombre: true, apellido: true } } },
  });

  if (!turno) throw new AppError('SIN_TURNO_ACTIVO', 404, 'No hay ningún turno abierto actualmente');

  const resumen = await calcularResumenTurno(turno.id, turno.hora_apertura);

  return {
    turno: {
      id:             turno.id,
      tipo:           turno.tipo,
      recepcionista:  `${turno.recepcionista.nombre} ${turno.recepcionista.apellido}`.trim(),
      hora_apertura:  turno.hora_apertura,
      saldo_inicial:  Number(turno.saldo_inicial),
    },
    resumen: {
      ...resumen,
      saldo_final_proyectado: Number(turno.saldo_inicial) + resumen.efectivo_neto,
    },
  };
}

export async function registrarGasto(input: RegistrarGastoInput) {
  const turno = await prisma.turno.findUnique({
    where:  { id: input.turno_id },
    select: { id: true, estado: true },
  });
  if (!turno) throw new AppError('TURNO_NO_ENCONTRADO', 404, 'Turno no encontrado');
  if (turno.estado !== EstadoTurno.ABIERTO) {
    throw new AppError('TURNO_CERRADO', 409, 'No se pueden agregar gastos a un turno cerrado');
  }

  return prisma.gastoCaja.create({
    data: {
      turno_id:              input.turno_id,
      concepto:              input.concepto,
      monto:                 input.monto,
      comprobante_proveedor: input.comprobante_proveedor ?? null,
      registrado_por_id:     input.registrado_por_id,
    },
    include: { registrado_por: { select: { nombre: true, apellido: true } } },
  });
}

export async function listarGastos(turnoId: string) {
  const turno = await prisma.turno.findUnique({ where: { id: turnoId }, select: { id: true } });
  if (!turno) throw new AppError('TURNO_NO_ENCONTRADO', 404, 'Turno no encontrado');

  return prisma.gastoCaja.findMany({
    where:   { turno_id: turnoId },
    include: { registrado_por: { select: { nombre: true, apellido: true } } },
    orderBy: { created_at: 'desc' },
  });
}

export async function cerrarTurno(turnoId: string, pin: string) {
  const turno = await prisma.turno.findUnique({
    where:   { id: turnoId },
    include: { recepcionista: true },
  });
  if (!turno) throw new AppError('TURNO_NO_ENCONTRADO', 404, 'Turno no encontrado');
  if (turno.estado !== EstadoTurno.ABIERTO) {
    throw new AppError('TURNO_YA_CERRADO', 409, 'El turno ya está cerrado');
  }

  // Verificar PIN contra password del recepcionista
  const pinValido = await bcrypt.compare(pin, turno.recepcionista.password_hash);
  if (!pinValido) {
    throw new AppError('PIN_INVALIDO', 401, 'PIN o contraseña incorrectos');
  }

  const resumen    = await calcularResumenTurno(turnoId, turno.hora_apertura);
  const horaCierre = new Date();
  const saldoFinal = Number(turno.saldo_inicial) + resumen.efectivo_neto;

  // Construir el JSON del reporte
  const gastos = await prisma.gastoCaja.findMany({
    where:   { turno_id: turnoId },
    include: { registrado_por: { select: { nombre: true, apellido: true } } },
    orderBy: { created_at: 'asc' },
  });

  const reservasTurno = await prisma.reserva.findMany({
    where:  { created_at: { gte: turno.hora_apertura } },
    include: {
      huesped:    { select: { nombre: true, apellido: true, tipo_documento: true, numero_documento: true } },
      habitacion: { select: { numero: true } },
      pagos:      { select: { metodo: true, monto: true, tipo_comprobante: true } },
      comprobante: { select: { serie: true, correlativo: true } },
    },
    orderBy: { created_at: 'asc' },
  });

  const transacciones = reservasTurno.flatMap((r, i) =>
    r.pagos.map((p, pi) => ({
      nro_transaccion:           String(i * 10 + pi + 1).padStart(4, '0'),
      tipo_comprobante:          p.tipo_comprobante ?? r.tipo_comprobante ?? 'BOLETA',
      nro_documento_comprobante: r.comprobante
        ? `${r.comprobante.serie}-${r.comprobante.correlativo}`
        : null,
      fecha_emision: r.created_at,
      cliente:       `${r.huesped.nombre} ${r.huesped.apellido}`.trim(),
      doc_cliente:   `${r.huesped.tipo_documento}: ${r.huesped.numero_documento}`,
      nro_habitacion: r.habitacion.numero,
      observacion:   r.notas ?? null,
      moneda:        'PEN',
      monto:         Number(p.monto),
      metodo_pago:   p.metodo,
      total_a_pagar: Number(r.tarifa_acordada),
    })),
  );

  const sumarMetodo = (m: MetodoPago) => ({
    cantidad: transacciones.filter((t) => t.metodo_pago === m).length,
    total:    transacciones.filter((t) => t.metodo_pago === m).reduce((s, t) => s + t.monto, 0),
  });

  const reporte = {
    encabezado: {
      empresa:        process.env.HOTEL_NOMBRE          ?? 'Hotel',
      ruc:            process.env.SUNAT_RUC              ?? '',
      establecimiento: process.env.HOTEL_ESTABLECIMIENTO ?? '',
      direccion:      process.env.HOTEL_DIRECCION        ?? '',
      vendedor:       `${turno.recepcionista.nombre} ${turno.recepcionista.apellido}`.trim(),
      turno:          turno.tipo,
      fecha_reporte:  turno.fecha,
      hora_apertura:  turno.hora_apertura,
      hora_cierre:    horaCierre,
      estado_caja:    'CERRADA',
      saldo_inicial:  Number(turno.saldo_inicial),
    },
    transacciones,
    gastos_caja: gastos.map((g) => ({
      fecha:                 g.created_at,
      concepto:              g.concepto,
      monto:                 Number(g.monto),
      comprobante_proveedor: g.comprobante_proveedor ?? null,
      registrado_por:        `${g.registrado_por.nombre} ${g.registrado_por.apellido}`.trim(),
    })),
    total_gastos_caja: resumen.total_gastos_caja,
    resumen_pagos: {
      efectivo:       sumarMetodo(MetodoPago.EFECTIVO),
      yape:           sumarMetodo(MetodoPago.YAPE),
      plin:           sumarMetodo(MetodoPago.PLIN),
      tarjeta_debito: sumarMetodo(MetodoPago.TARJETA_DEBITO),
      tarjeta_credito: sumarMetodo(MetodoPago.TARJETA_CREDITO),
      transferencia:  sumarMetodo(MetodoPago.TRANSFERENCIA),
    },
    totales: {
      total_efectivo_bruto:       resumen.total_efectivo,
      total_gastos_caja:          resumen.total_gastos_caja,
      efectivo_neto:              resumen.efectivo_neto,
      total_billeteras_digitales: resumen.total_yape + resumen.total_plin,
      total_tarjetas:             resumen.total_tarjetas,
      total_transferencias:       resumen.total_transferencias,
      total_general:              resumen.total_general,
      saldo_final_caja:           saldoFinal,
    },
    firma: {
      recepcionista_id:     turno.recepcionista_id,
      recepcionista_nombre: `${turno.recepcionista.nombre} ${turno.recepcionista.apellido}`.trim(),
      firma_hash:           '',
      firmado_at:           horaCierre,
    },
  };

  // SHA256 del reporte para firma
  const firma_hash = createHash('sha256')
    .update(JSON.stringify(reporte) + turnoId + horaCierre.toISOString())
    .digest('hex');

  reporte.firma.firma_hash = firma_hash;

  // Generar PDF
  const pdfBuffer = await generarPDFReporte(reporte);
  const pdfDir    = path.join(process.cwd(), 'uploads', 'reportes');
  fs.mkdirSync(pdfDir, { recursive: true });
  const pdfPath = path.join(pdfDir, `turno_${turnoId}.pdf`);
  fs.writeFileSync(pdfPath, pdfBuffer);
  const pdfUrl = `/uploads/reportes/turno_${turnoId}.pdf`;

  // Guardar todo en BD y cerrar el turno
  await prisma.$transaction(async (tx) => {
    await tx.turno.update({
      where: { id: turnoId },
      data:  {
        estado:       EstadoTurno.CERRADO,
        hora_cierre:  horaCierre,
        saldo_final:  saldoFinal,
        firma_hash,
      },
    });

    await tx.reporteTurnoCache.upsert({
      where:  { turno_id: turnoId },
      create: {
        turno_id:     turnoId,
        json_reporte: reporte as unknown as import('@prisma/client').Prisma.InputJsonValue,
        pdf_url:      pdfUrl,
        generado_at:  horaCierre,
      },
      update: {
        json_reporte: reporte as unknown as import('@prisma/client').Prisma.InputJsonValue,
        pdf_url:      pdfUrl,
        generado_at:  horaCierre,
      },
    });
  });

  // Fire-and-forget: notificar a n8n
  notificarCierreTurno(reporte as unknown as Record<string, unknown>).catch(() => null);

  return { turno_id: turnoId, reporte, pdf_url: pdfUrl, firma_hash };
}

export async function obtenerReporte(turnoId: string) {
  const cache = await prisma.reporteTurnoCache.findUnique({
    where: { turno_id: turnoId },
  });

  if (cache) return cache.json_reporte;

  // Si no hay cache, el turno debe estar abierto — generar resumen en tiempo real
  const turno = await prisma.turno.findUnique({
    where:   { id: turnoId },
    include: { recepcionista: { select: { nombre: true, apellido: true } } },
  });
  if (!turno) throw new AppError('TURNO_NO_ENCONTRADO', 404, 'Turno no encontrado');

  const resumen = await calcularResumenTurno(turnoId, turno.hora_apertura);
  return { turno_id: turnoId, estado: turno.estado, resumen };
}

export async function obtenerPDF(turnoId: string): Promise<Buffer> {
  const cache = await prisma.reporteTurnoCache.findUnique({
    where: { turno_id: turnoId },
  });

  if (cache?.pdf_url) {
    const pdfPath = path.join(process.cwd(), cache.pdf_url.replace(/^\//, ''));
    if (fs.existsSync(pdfPath)) {
      return fs.readFileSync(pdfPath);
    }
  }

  // Regenerar PDF desde el JSON del reporte si existe
  if (cache?.json_reporte) {
    return generarPDFReporte(cache.json_reporte as Record<string, unknown>);
  }

  throw new AppError('REPORTE_NO_DISPONIBLE', 404, 'El reporte PDF no está disponible para este turno');
}

export async function listarTurnos(query: {
  fecha?:            string;
  tipo?:             TipoTurno;
  recepcionista_id?: string;
  page?:             number;
  limit?:            number;
  solo_propios?:     boolean;
  personal_id?:      string;
}) {
  const page  = query.page  ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);

  const where: import('@prisma/client').Prisma.TurnoWhereInput = {
    estado: EstadoTurno.CERRADO,
  };

  if (query.fecha)            where.fecha            = new Date(query.fecha);
  if (query.tipo)             where.tipo             = query.tipo;
  if (query.recepcionista_id) where.recepcionista_id = query.recepcionista_id;
  if (query.solo_propios && query.personal_id) {
    where.recepcionista_id = query.personal_id;
  }

  const [total, turnos] = await Promise.all([
    prisma.turno.count({ where }),
    prisma.turno.findMany({
      where,
      include: { recepcionista: { select: { nombre: true, apellido: true } } },
      orderBy: { fecha: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ]);

  return { data: turnos, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}
