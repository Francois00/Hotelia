import { vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock authenticate as a pass-through — tests inject req.user themselves via app middleware
vi.mock('../src/middleware/auth', async (importActual) => {
  const actual = await importActual<typeof import('../src/middleware/auth')>();
  return {
    ...actual,
    authenticate: (_req: Request, _res: Response, next: NextFunction) => next(),
  };
});

// Mock Prisma globally so tests don't need a real database
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    habitacion: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      count:      vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
    },
    reserva: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      findFirst:  vi.fn(),
      count:      vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
    },
    huesped: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      findFirst:  vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
    },
    pago:        { createMany: vi.fn(), findMany: vi.fn() },
    folioItem:   { create: vi.fn() },
    turno: {
      findMany:   vi.fn(),
      findFirst:  vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
      count:      vi.fn(),
    },
    gastoCaja:            { findMany: vi.fn(), create: vi.fn() },
    reporteTurnoCache:    { findUnique: vi.fn(), upsert: vi.fn() },
    reglaTemporada:       { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    tipoHabitacionCustom: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    personal:             { findUnique: vi.fn() },
    $transaction:         vi.fn(),
    $queryRaw:            vi.fn(),
  },
}));

// Mock Redis globally
vi.mock('../src/lib/redis', () => ({
  redis: {
    get:     vi.fn().mockResolvedValue(null),
    set:     vi.fn().mockResolvedValue('OK'),
    lpush:   vi.fn().mockResolvedValue(1),
    eval:    vi.fn().mockResolvedValue(1),
    connect: vi.fn().mockResolvedValue(undefined),
  },
}));

// Silence noisy console output during tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
