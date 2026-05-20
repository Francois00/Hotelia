import 'dotenv/config';
import path from 'path';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import authRouter           from './routes/auth';
import reservasRouter       from './routes/reservas';
import habitacionesRouter   from './routes/habitaciones';
import huespedesRouter      from './routes/huespedes';
import canalesRouter        from './routes/canales';
import revenueRouter        from './routes/revenue';
import alertasRouter        from './routes/alertas';
import internalRouter       from './routes/internal';
import pagosRouter          from './routes/pagos';
import comprobantesRouter   from './routes/comprobantes';
import whatsappRouter       from './routes/whatsapp';
import checkinQRRouter      from './routes/qr';
import reservasQRRouter     from './routes/checkin';
import tiposHabitacionRouter from './routes/tipos-habitacion';
import reglasTemporadaRouter from './routes/reglas-temporada';
import clientesRouter       from './routes/clientes';
import checkinManualRouter  from './routes/checkin-manual';
import conciergeRouter      from './routes/concierge';
import turnosRouter         from './routes/turnos';
import { health } from './controllers/health.controller';
import { errorHandler } from './middleware/error-handler';
import { initSocket, emit } from './services/socket.service';
import { obtenerKPIs } from './services/revenue.service';

const app  = express();
const PORT = process.env.PORT ?? 3000;

// CORS — allow frontend origin and any value configured via env
const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Signature', 'X-N8N-Signature'],
}));

// Capture raw body for HMAC verification on webhook endpoints
app.use(
  express.json({
    verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Servir archivos estáticos (fotos de habitaciones, reportes PDF de turnos)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Rutas ────────────────────────────────────────────────────────────────────

app.get('/health', health);

app.use('/api/v1/auth',              authRouter);
app.use('/api/v1/reservas',          reservasRouter);
app.use('/api/v1/reservas',          reservasQRRouter);       // /:id/qr-checkin
app.use('/api/v1/reservas/checkin-manual', checkinManualRouter);
app.use('/api/v1/habitaciones',      habitacionesRouter);
app.use('/api/v1/tipos-habitacion',  tiposHabitacionRouter);
app.use('/api/v1/reglas-temporada',  reglasTemporadaRouter);
app.use('/api/v1/huespedes',         huespedesRouter);
app.use('/api/v1/clientes',          clientesRouter);
app.use('/api/v1/canales',           canalesRouter);
app.use('/api/v1/revenue',           revenueRouter);
app.use('/api/v1/alertas',           alertasRouter);
app.use('/api/v1/internal',          internalRouter);
app.use('/api/v1/pagos',             pagosRouter);
app.use('/api/v1/comprobantes',      comprobantesRouter);
app.use('/api/v1/webhooks/whatsapp', whatsappRouter);
app.use('/api/v1/concierge',         conciergeRouter);
app.use('/api/v1/checkin',           checkinQRRouter);
app.use('/api/v1/turnos',            turnosRouter);

// Also expose habitacion-scoped alerts under habitaciones prefix
app.use('/api/v1/habitaciones',      alertasRouter);

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── HTTP server + Socket.IO ─────────────────────────────────────────────────

const httpServer = createServer(app);
initSocket(httpServer);

// ─── KPI broadcast cron (every 5 min) ────────────────────────────────────────

setInterval(async () => {
  try {
    const hoy  = new Date().toISOString().slice(0, 10);
    const kpis = await obtenerKPIs(hoy, hoy);
    emit('kpis:update', {
      ocupacion_pct: kpis.ocupacion_pct,
      revpar:        kpis.revpar,
      adr:           kpis.adr,
      ingresos_dia:  kpis.ingresos_totales,
    }, 'dashboard');
  } catch {
    // Non-fatal
  }
}, 5 * 60 * 1000);

// ─── Inicio ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await redis.connect();
  httpServer.listen(PORT, () => {
    console.log(`[server] running on port ${PORT} — env: ${process.env.NODE_ENV ?? 'development'}`);
  });
}

main().catch((err: unknown) => {
  console.error('[server] fatal error', err);
  process.exit(1);
});
