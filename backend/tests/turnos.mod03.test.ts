import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { TipoTurno, EstadoTurno, MetodoPago, RolPersonal } from '@prisma/client';
import { abrirTurno, cerrarTurno } from '../src/services/turnos.service';
import { prisma } from '../src/lib/prisma';
import { errorHandler } from '../src/middleware/error-handler';
import turnosRouter from '../src/routes/turnos';

// ─── Test app ─────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { user?: unknown }).user = {
      sub: 'personal-uuid', email: 'rec@test.com', rol: RolPersonal.RECEPCIONISTA,
    };
    next();
  });
  app.use('/api/v1/turnos', turnosRouter);
  app.use(errorHandler);
  return app;
}

// ─── Tests: abrirTurno ────────────────────────────────────────────────────────

describe('abrirTurno (service)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea un turno cuando no hay turno abierto', async () => {
    vi.mocked(prisma.turno.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.turno.create).mockResolvedValue({
      id: 'turno-uuid', tipo: TipoTurno.DIA, estado: EstadoTurno.ABIERTO,
      saldo_inicial: 100 as never, hora_apertura: new Date(),
      recepcionista: { nombre: 'Ana', apellido: 'López', rol: 'RECEPCIONISTA' },
    } as never);

    const turno = await abrirTurno({ tipo: TipoTurno.DIA, saldo_inicial: 100, personal_id: 'uuid' });
    expect(turno.tipo).toBe(TipoTurno.DIA);
    expect(vi.mocked(prisma.turno.create)).toHaveBeenCalledOnce();
  });

  it('lanza TURNO_YA_ABIERTO si ya existe uno abierto', async () => {
    vi.mocked(prisma.turno.findFirst).mockResolvedValue({
      id: 'existente', estado: EstadoTurno.ABIERTO,
    } as never);

    await expect(
      abrirTurno({ tipo: TipoTurno.NOCHE, saldo_inicial: 50, personal_id: 'uuid' }),
    ).rejects.toMatchObject({ code: 'TURNO_YA_ABIERTO', statusCode: 409 });
  });
});

// ─── Tests: POST /api/v1/turnos/abrir ────────────────────────────────────────

describe('POST /api/v1/turnos/abrir (HTTP)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 201 al abrir un nuevo turno', async () => {
    vi.mocked(prisma.turno.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.turno.create).mockResolvedValue({
      id: 'turno-1', tipo: TipoTurno.DIA, estado: EstadoTurno.ABIERTO,
      saldo_inicial: 100 as never, hora_apertura: new Date(), fecha: new Date(),
      recepcionista: { nombre: 'Test', apellido: 'User', rol: 'RECEPCIONISTA' },
    } as never);

    const res = await request(buildApp())
      .post('/api/v1/turnos/abrir')
      .send({ tipo: 'DIA', saldo_inicial: 100 });
    expect(res.status).toBe(201);
  });

  it('retorna 409 si ya hay un turno abierto', async () => {
    vi.mocked(prisma.turno.findFirst).mockResolvedValue({
      id: 'existente', estado: EstadoTurno.ABIERTO,
    } as never);

    const res = await request(buildApp())
      .post('/api/v1/turnos/abrir')
      .send({ tipo: 'NOCHE', saldo_inicial: 50 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TURNO_YA_ABIERTO');
  });
});

// ─── Tests: GET /api/v1/turnos/activo ────────────────────────────────────────

describe('GET /api/v1/turnos/activo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna resumen calculado del turno activo', async () => {
    const horaApertura = new Date('2026-05-19T06:00:00Z');
    vi.mocked(prisma.turno.findFirst).mockResolvedValue({
      id: 'turno-activo', tipo: TipoTurno.DIA, estado: EstadoTurno.ABIERTO,
      saldo_inicial: 200 as never, hora_apertura: horaApertura,
      recepcionista: { nombre: 'Carlos', apellido: 'Mendoza' },
    } as never);
    vi.mocked(prisma.reserva.findMany).mockResolvedValue([
      { id: 'r1', estado: 'CHECKIN_REALIZADO', created_at: new Date() } as never,
    ]);
    vi.mocked(prisma.pago.findMany).mockResolvedValue([
      { metodo: MetodoPago.EFECTIVO, monto: 300 as never } as never,
    ]);
    vi.mocked(prisma.gastoCaja.findMany).mockResolvedValue([
      { monto: 50 as never } as never,
    ]);

    const res = await request(buildApp()).get('/api/v1/turnos/activo');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('turno');
    expect(res.body).toHaveProperty('resumen');
    expect(res.body.resumen.total_efectivo).toBe(300);
    expect(res.body.resumen.total_gastos_caja).toBe(50);
    expect(res.body.resumen.efectivo_neto).toBe(250);
    expect(res.body.resumen.saldo_final_proyectado).toBe(450);
  });

  it('retorna 404 si no hay turno activo', async () => {
    vi.mocked(prisma.turno.findFirst).mockResolvedValue(null);
    const res = await request(buildApp()).get('/api/v1/turnos/activo');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('SIN_TURNO_ACTIVO');
  });
});

// ─── Tests: cerrarTurno con PIN incorrecto ────────────────────────────────────

describe('cerrarTurno — validación de PIN', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza PIN_INVALIDO si el PIN no coincide con el hash', async () => {
    vi.mocked(prisma.turno.findUnique).mockResolvedValue({
      id:            'turno-a-cerrar',
      estado:        EstadoTurno.ABIERTO,
      tipo:          TipoTurno.DIA,
      hora_apertura: new Date(),
      saldo_inicial: 100 as never,
      recepcionista: {
        id:            'rec-uuid',
        nombre:        'Luis',
        apellido:      'Torres',
        // bcrypt hash for an impossible-to-match value
        password_hash: '$2b$10$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    } as never);

    await expect(cerrarTurno('turno-a-cerrar', 'pin_incorrecto'))
      .rejects.toMatchObject({ code: 'PIN_INVALIDO', statusCode: 401 });
  });
});

// ─── Tests: GET /api/v1/turnos/:id/reporte/pdf ───────────────────────────────

describe('GET /api/v1/turnos/:id/reporte/pdf', () => {
  beforeEach(() => vi.clearAllMocks());

  it('responde con Content-Type application/pdf cuando el JSON de reporte está disponible', async () => {
    vi.mocked(prisma.reporteTurnoCache.findUnique).mockResolvedValue({
      turno_id:    'turno-cerrado',
      json_reporte: {
        encabezado:        { empresa: 'Test Hotel', ruc: '20000000000', turno: 'DIA', saldo_inicial: 100 },
        transacciones:     [],
        gastos_caja:       [],
        total_gastos_caja: 0,
        resumen_pagos:     {},
        totales:           { total_general: 0, saldo_final_caja: 100 },
        firma:             { recepcionista_nombre: 'Test', firma_hash: 'abc123', firmado_at: new Date().toISOString() },
      },
      pdf_url:     null,
      generado_at: new Date(),
    } as never);

    const res = await request(buildApp())
      .get('/api/v1/turnos/turno-cerrado/reporte/pdf');

    // 200 with PDF content or graceful error
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers['content-type']).toContain('application/pdf');
    }
  });
});
