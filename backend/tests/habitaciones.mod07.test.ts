import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { RolPersonal, EstadoHabitacion, TipoHabitacion } from '@prisma/client';
import { errorHandler } from '../src/middleware/error-handler';
import { prisma } from '../src/lib/prisma';
import habitacionesRouter from '../src/routes/habitaciones';
import tiposRouter from '../src/routes/tipos-habitacion';
import reglasRouter from '../src/routes/reglas-temporada';

// ─── Test app setup ───────────────────────────────────────────────────────────

function buildApp(rol: RolPersonal = RolPersonal.GERENTE) {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    (req as express.Request & { user?: unknown }).user = {
      sub:   'test-user-id',
      email: 'test@test.com',
      rol,
    };
    next();
  });

  app.use('/api/v1/habitaciones',     habitacionesRouter);
  app.use('/api/v1/tipos-habitacion', tiposRouter);
  app.use('/api/v1/reglas-temporada', reglasRouter);
  app.use(errorHandler);
  return app;
}

// ─── Tests: GET /habitaciones con filtros ─────────────────────────────────────

describe('GET /api/v1/habitaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.habitacion.count).mockResolvedValue(1);
    vi.mocked(prisma.habitacion.findMany).mockResolvedValue([
      {
        id:               'uuid-hab-1',
        numero:           '101',
        tipo:             TipoHabitacion.DOBLE,
        piso:             1,
        capacidad:        2,
        capacidad_adultos: null,
        capacidad_ninos:  0,
        tarifa_base:      150 as unknown as import('@prisma/client').Prisma.Decimal,
        tarifa_minima:    null,
        tarifa_maxima:    null,
        moneda_tarifa:    'PEN',
        estado:           EstadoHabitacion.DISPONIBLE,
        visible_otas:     true,
        fotos:            [],
        amenidades:       null,
        descripcion:      null,
        tipo_custom_id:   null,
        created_at:       new Date(),
        updated_at:       new Date(),
        tipo_custom:      null,
      } as unknown as never,
    ]);
  });

  it('retorna lista paginada de habitaciones', async () => {
    const res = await request(buildApp()).get('/api/v1/habitaciones');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
  });

  it('aplica filtro de estado', async () => {
    await request(buildApp()).get('/api/v1/habitaciones?estado=DISPONIBLE');
    const llamada = vi.mocked(prisma.habitacion.findMany).mock.calls[0][0];
    expect((llamada?.where as Record<string, unknown>)?.estado).toBe(EstadoHabitacion.DISPONIBLE);
  });

  it('aplica filtro de tipo', async () => {
    await request(buildApp()).get('/api/v1/habitaciones?tipo=DOBLE');
    const llamada = vi.mocked(prisma.habitacion.findMany).mock.calls[0][0];
    expect((llamada?.where as Record<string, unknown>)?.tipo).toBe(TipoHabitacion.DOBLE);
  });

  it('aplica filtro de piso', async () => {
    await request(buildApp()).get('/api/v1/habitaciones?piso=2');
    const llamada = vi.mocked(prisma.habitacion.findMany).mock.calls[0][0];
    expect((llamada?.where as Record<string, unknown>)?.piso).toBe(2);
  });
});

// ─── Tests: POST /habitaciones (requiere GERENTE) ─────────────────────────────

describe('POST /api/v1/habitaciones', () => {
  it('retorna 403 si el usuario es RECEPCIONISTA', async () => {
    const res = await request(buildApp(RolPersonal.RECEPCIONISTA))
      .post('/api/v1/habitaciones')
      .send({ numero: '101', tipo: 'DOBLE', piso: 1, capacidad: 2, tarifa_base: 150 });
    expect(res.status).toBe(403);
  });

  it('retorna 400 si tarifa_minima >= tarifa_base', async () => {
    const res = await request(buildApp())
      .post('/api/v1/habitaciones')
      .send({
        numero:        '102',
        tipo:          'DOBLE',
        piso:          1,
        capacidad:     2,
        tarifa_base:   100,
        tarifa_minima: 100,
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TARIFA_INVALIDA');
  });

  it('retorna 400 si tarifa_maxima <= tarifa_base', async () => {
    const res = await request(buildApp())
      .post('/api/v1/habitaciones')
      .send({
        numero:        '103',
        tipo:          'DOBLE',
        piso:          1,
        capacidad:     2,
        tarifa_base:   100,
        tarifa_maxima: 100,
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TARIFA_INVALIDA');
  });

  it('crea habitación correctamente con datos válidos', async () => {
    vi.mocked(prisma.habitacion.create).mockResolvedValue({
      id: 'new-id', numero: '201', tipo: TipoHabitacion.SUITE, piso: 2,
      capacidad: 3, tarifa_base: 200 as unknown as import('@prisma/client').Prisma.Decimal,
      estado: EstadoHabitacion.DISPONIBLE, tipo_custom: null,
    } as unknown as never);

    const res = await request(buildApp())
      .post('/api/v1/habitaciones')
      .send({ numero: '201', tipo: 'SUITE', piso: 2, capacidad: 3, tarifa_base: 200, tarifa_minima: 150, tarifa_maxima: 300 });
    expect(res.status).toBe(201);
  });
});

// ─── Tests: DELETE /habitaciones/:id ──────────────────────────────────────────

describe('DELETE /api/v1/habitaciones/:id (baja lógica)', () => {
  it('retorna 409 si hay reservas activas', async () => {
    vi.mocked(prisma.habitacion.findUnique).mockResolvedValue({
      id: 'hab-1', estado: EstadoHabitacion.DISPONIBLE,
    } as never);
    vi.mocked(prisma.reserva.count).mockResolvedValue(2);

    const res = await request(buildApp()).delete('/api/v1/habitaciones/hab-1');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HABITACION_CON_RESERVAS_ACTIVAS');
  });

  it('hace baja lógica si no hay reservas activas', async () => {
    vi.mocked(prisma.habitacion.findUnique).mockResolvedValue({
      id: 'hab-2', estado: EstadoHabitacion.DISPONIBLE,
    } as never);
    vi.mocked(prisma.reserva.count).mockResolvedValue(0);
    vi.mocked(prisma.habitacion.update).mockResolvedValue({
      id: 'hab-2', estado: EstadoHabitacion.FUERA_DE_SERVICIO,
    } as never);

    const res = await request(buildApp()).delete('/api/v1/habitaciones/hab-2');
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.habitacion.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estado: EstadoHabitacion.FUERA_DE_SERVICIO } }),
    );
  });
});

// ─── Tests: reglas de temporada ───────────────────────────────────────────────

describe('POST /api/v1/reglas-temporada', () => {
  it('crea regla de temporada y retorna 201', async () => {
    vi.mocked(prisma.reglaTemporada.create).mockResolvedValue({
      id: 'regla-1', nombre: 'Fiestas Patrias', tipo: 'EVENTO_ESPECIAL',
      ajuste_porcentaje: 20, activo: true,
    } as never);

    const res = await request(buildApp())
      .post('/api/v1/reglas-temporada')
      .send({
        nombre:            'Fiestas Patrias',
        tipo:              'EVENTO_ESPECIAL',
        fecha_inicio:      '2026-07-28',
        fecha_fin:         '2026-07-30',
        ajuste_porcentaje: 20,
      });
    expect(res.status).toBe(201);
  });

  it('retorna 422 si falta fecha_inicio para EVENTO_ESPECIAL', async () => {
    const res = await request(buildApp())
      .post('/api/v1/reglas-temporada')
      .send({ nombre: 'Test', tipo: 'EVENTO_ESPECIAL', ajuste_porcentaje: 10 });
    expect(res.status).toBe(422);
  });
});
