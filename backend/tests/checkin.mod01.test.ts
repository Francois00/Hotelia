import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consultarDNI } from '../src/services/reniec.service';
import { upsertHuesped, ejecutarCheckinManual } from '../src/services/checkin-manual.service';
import { MetodoPago, TipoComprobante, EstadoReserva } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';

// ─── Tests: consultarDNI ──────────────────────────────────────────────────────

describe('consultarDNI', () => {
  it('retorna null para DNI con formato inválido (< 8 dígitos)', async () => {
    expect(await consultarDNI('123')).toBeNull();
  });

  it('retorna null para DNI con letras', async () => {
    expect(await consultarDNI('1234567A')).toBeNull();
  });

  it('retorna null si RENIEC_API_URL no está configurado', async () => {
    const original = process.env.RENIEC_API_URL;
    delete process.env.RENIEC_API_URL;
    const result = await consultarDNI('12345678');
    expect(result).toBeNull();
    if (original) process.env.RENIEC_API_URL = original;
  });
});

// ─── Tests: upsertHuesped ────────────────────────────────────────────────────

describe('upsertHuesped', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna is_returning: true si el documento ya existe', async () => {
    vi.mocked(prisma.huesped.findFirst).mockResolvedValue({
      id: 'uuid-existente', nombre: 'Juan', apellido: 'Pérez',
      numero_documento: '12345678',
    } as never);
    vi.mocked(prisma.huesped.update).mockResolvedValue({
      id: 'uuid-existente', nombre: 'Juan Actualizado', apellido: 'Pérez',
    } as never);

    const result = await upsertHuesped({
      tipo_documento: 'DNI', numero_documento: '12345678',
      nombres: 'Juan Actualizado', apellidos: 'Pérez',
    });

    expect(result.is_returning).toBe(true);
    expect(vi.mocked(prisma.huesped.update)).toHaveBeenCalled();
  });

  it('retorna is_returning: false si el documento es nuevo', async () => {
    vi.mocked(prisma.huesped.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.huesped.create).mockResolvedValue({
      id: 'uuid-nuevo', nombre: 'Ana', apellido: 'García',
    } as never);

    const result = await upsertHuesped({
      tipo_documento: 'DNI', numero_documento: '87654321',
      nombres: 'Ana', apellidos: 'García',
    });

    expect(result.is_returning).toBe(false);
    expect(vi.mocked(prisma.huesped.create)).toHaveBeenCalled();
  });
});

// ─── Tests: ejecutarCheckinManual ─────────────────────────────────────────────

describe('ejecutarCheckinManual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.set).mockResolvedValue('OK');
    vi.mocked(redis.eval).mockResolvedValue(1);
  });

  const inputBase = {
    huesped_id:              'huesped-uuid',
    habitacion_id:           'hab-uuid',
    fecha_entrada:           '2026-06-01',
    numero_noches:           2,
    numero_personas:         2,
    precio_por_noche:        150,
    pagos:                   [{ metodo: MetodoPago.EFECTIVO, monto: 300 }],
    tipo_comprobante:        TipoComprobante.BOLETA,
    datos_facturacion:       null,
    canal_envio_comprobante: 'whatsapp',
  };

  it('lanza FECHAS_INVALIDAS con numero_noches = 0', async () => {
    await expect(
      ejecutarCheckinManual({ ...inputBase, numero_noches: 0, pagos: [{ metodo: MetodoPago.EFECTIVO, monto: 0 }] }),
    ).rejects.toMatchObject({ code: 'FECHAS_INVALIDAS' });
  });

  it('lanza PAGOS_NO_COINCIDEN si la suma de pagos no cuadra', async () => {
    await expect(
      ejecutarCheckinManual({ ...inputBase, pagos: [{ metodo: MetodoPago.EFECTIVO, monto: 200 }] }),
    ).rejects.toMatchObject({ code: 'PAGOS_NO_COINCIDEN' });
  });

  it('lanza HABITACION_NO_DISPONIBLE si la habitación está OCUPADA', async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      return (fn as Function)({
        $queryRaw: vi.fn().mockResolvedValue([
          { id: 'hab-uuid', numero: '101', tipo: 'DOBLE', estado: 'OCUPADA', capacidad: 3 },
        ]),
        reserva:    { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
        huesped:    { findUnique: vi.fn() },
        habitacion: { update: vi.fn() },
        pago:       { createMany: vi.fn() },
        folioItem:  { create: vi.fn() },
      });
    });

    await expect(ejecutarCheckinManual(inputBase))
      .rejects.toMatchObject({ code: 'HABITACION_NO_DISPONIBLE' });
  });

  it('lanza CAPACIDAD_EXCEDIDA si número de personas supera la capacidad', async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      return (fn as Function)({
        $queryRaw: vi.fn().mockResolvedValue([
          { id: 'hab-uuid', numero: '101', tipo: 'SIMPLE', estado: 'DISPONIBLE', capacidad: 1 },
        ]),
        reserva:    { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
        huesped:    { findUnique: vi.fn() },
        habitacion: { update: vi.fn() },
        pago:       { createMany: vi.fn() },
        folioItem:  { create: vi.fn() },
      });
    });

    await expect(ejecutarCheckinManual({ ...inputBase, numero_personas: 5 }))
      .rejects.toMatchObject({ code: 'CAPACIDAD_EXCEDIDA' });
  });

  it('ejecuta check-in exitoso y retorna datos de la reserva', async () => {
    const reservaCreada = {
      id:               'reserva-uuid',
      codigo:           'CHK-20260601-ABCDEF',
      estado:           EstadoReserva.CHECKIN_REALIZADO,
      tipo_comprobante: TipoComprobante.BOLETA,
      notas:            null,
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      return (fn as Function)({
        $queryRaw: vi.fn().mockResolvedValue([
          { id: 'hab-uuid', numero: '101', tipo: 'DOBLE', estado: 'DISPONIBLE', capacidad: 3 },
        ]),
        reserva: {
          findFirst: vi.fn().mockResolvedValue(null),
          create:    vi.fn().mockResolvedValue(reservaCreada),
        },
        huesped: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'huesped-uuid', activo: true, nombre: 'Ana', apellido: 'García', telefono: null,
          }),
        },
        habitacion: { update: vi.fn().mockResolvedValue({}) },
        pago:       { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
        folioItem:  { create: vi.fn().mockResolvedValue({}) },
      });
    });

    const result = await ejecutarCheckinManual(inputBase);
    expect(result).toHaveProperty('reserva_id', 'reserva-uuid');
    expect(result).toHaveProperty('codigo_reserva');
    expect(result.total).toBe(300);
  });
});
