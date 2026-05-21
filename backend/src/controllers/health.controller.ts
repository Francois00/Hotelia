import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

export async function health(_req: Request, res: Response): Promise<void> {
  const startedAt = Date.now();

  const checks = {
    postgres: { ok: false, version: undefined as string | undefined },
    redis: { ok: false },
  };

  await Promise.allSettled([
    (async () => {
      const rows = await prisma.$queryRaw<[{ version: string }]>`SELECT version()`;
      checks.postgres = { ok: true, version: rows[0].version.split(' ').slice(0, 2).join(' ') };
    })(),
    (async () => {
      const pong = await redis.ping();
      checks.redis = { ok: pong === 'PONG' };
    })(),
  ]);

  const allOk = checks.postgres.ok && checks.redis.ok;

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    uptime_seconds: Math.floor(process.uptime()),
    latency_ms: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
    services: checks,
  });
}
