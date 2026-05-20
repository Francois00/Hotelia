---
tags: [arquitectura, backend, estructura]
fecha: 2026-05-20
---

# Backend — Estructura de archivos

## Árbol general

```
backend/
├── prisma/
│   ├── schema.prisma          ← Fuente de verdad del modelo de datos (18 tablas)
│   ├── seed.sql               ← Datos iniciales (admin, habitaciones demo)
│   └── migrations/            ← 11 migraciones aplicadas (ver schema-actual.md)
├── src/
│   ├── index.ts               ← Entry point: Express app, rutas, Socket.IO, cron KPI
│   ├── controllers/           ← Handlers HTTP — validan input con Zod, delegan a services
│   ├── services/              ← Lógica de negocio — transacciones, integraciones externas
│   ├── routes/                ← Montaje de routers Express con authorize() por rol
│   ├── middleware/            ← Auth JWT, RBAC, rate-limit, error handler
│   └── lib/                   ← Instancias compartidas (Prisma client, Redis client, errors)
└── node_modules/              ← Gestionado con pnpm
```

---

## `src/index.ts`

Entry point. Responsabilidades:
- Levanta Express con CORS configurable por `CORS_ORIGINS`
- Captura `rawBody` en el middleware JSON para validación HMAC de webhooks
- Sirve `/uploads` como static (fotos de habitaciones, PDFs de turno)
- Monta todos los 20+ routers bajo `/api/v1/`
- Crea el servidor HTTP, inicializa Socket.IO
- Cron cada 5 min: emite `kpis:update` a la sala `dashboard`

---

## `src/controllers/`

Cada controller valida con **Zod** y delega a un service. No contienen lógica de negocio.

| Archivo | Responsabilidad |
|---|---|
| `auth.controller.ts` | Login: bcrypt compare + signToken JWT 8h |
| `habitaciones.controller.ts` | CRUD habitaciones + fotos + cambio de estado |
| `tipos-habitacion.controller.ts` | CRUD tipos personalizados (además del enum) |
| `reglas-temporada.controller.ts` | CRUD reglas de tarifa por temporada/evento |
| `reservas.controller.ts` | CRUD reservas + cambio de estado |
| `checkin-manual.controller.ts` | Disponibilidad + ejecutar check-in manual completo |
| `huespedes.controller.ts` | CRUD huéspedes + historial de estancias |
| `clientes.controller.ts` | Proxy a RENIEC (DNI) y SUNAT (RUC) |
| `canales.controller.ts` | Webhook OTA (HMAC) + log de sincronización |
| `revenue.controller.ts` | KPIs diarios + forecast (delega a ai-service) |
| `alertas.controller.ts` | Alertas de mantenimiento por habitación |
| `folio.controller.ts` | Cargos y pagos anidados bajo una reserva |
| `pagos.controller.ts` | Iniciar/confirmar pago Niubiz + reembolsos |
| `comprobantes.controller.ts` | Emitir comprobante SUNAT + consultas |
| `turnos.controller.ts` | Abrir/cerrar turno, gastos, resumen, PDF |
| `health.controller.ts` | GET /health → estado de DB y Redis |

---

## `src/services/`

Lógica de negocio. Usan `prisma.$transaction` para operaciones atómicas.

| Archivo | Lógica clave |
|---|---|
| `auth.service.ts` | bcrypt.compare + JWT sign |
| `habitaciones.service.ts` | CRUD + upload fotos (disk) + emit socket |
| `checkin-manual.service.ts` | **Operación crítica**: Redis lock + `FOR UPDATE NOWAIT` + transacción atómica (reserva + pagos + folio + estado hab) + fire-and-forget SUNAT/WhatsApp/n8n |
| `turnos.service.ts` | Abrir turno (unicidad), calcular resumen en tiempo real, cerrar con bcrypt verify + SHA256 firma + PDF |
| `reservas.service.ts` | CRUD + máquina de estados + verificación GIST constraint |
| `huespedes.service.ts` | CRUD + upsert + cálculo LTV + segmentación CRM |
| `reniec.service.ts` | Proxy a API RENIEC con retry + timeout 5s |
| `sunat.service.ts` | Emisión de comprobante electrónico (beta/producción) |
| `niubiz.service.ts` | Tokenización + pago Niubiz |
| `revenue.service.ts` | Consulta BD + proxy al ai-service para forecast |
| `tarifas.service.ts` | Calcula tarifa sugerida considerando reglas de temporada |
| `channelManager.service.ts` | Normaliza webhooks OTA → modelo interno |
| `otaNormalizer.service.ts` | Mapeo Booking.com/Expedia/Airbnb → Reserva |
| `qrcheckin.service.ts` | Genera y valida tokens QR (firmados con JWT, TTL 24h) |
| `alertas.service.ts` | Upsert de alertas + frecuencia + emit socket |
| `whatsapp.service.ts` | Envío de templates via Meta Cloud API |
| `folio.service.ts` | Agregar cargos y pagos al folio de una reserva |
| `pagos.service.ts` | Flujo Niubiz: iniciar sesión + confirmar pago |
| `socket.service.ts` | Singleton Socket.IO + helpers `emit`/`emitMulti` |
| `sync.service.ts` | Procesa eventos de canales (idempotency_key) |
| `reporte-turno.service.ts` | Genera PDF con PDFKit a partir del JSON del reporte |

---

## `src/routes/`

Todos los routers usan `authenticate` como primer middleware salvo casos especiales.

| Archivo | Prefijo | Nota especial |
|---|---|---|
| `auth.ts` | `/api/v1/auth` | Rate limit 5 intentos / 15 min por IP |
| `habitaciones.ts` | `/api/v1/habitaciones` | Multer 5 MB para fotos |
| `tipos-habitacion.ts` | `/api/v1/tipos-habitacion` | — |
| `reglas-temporada.ts` | `/api/v1/reglas-temporada` | — |
| `reservas.ts` | `/api/v1/reservas` | Incluye subrouter `folio.ts` en `/:id/folio` |
| `checkin-manual.ts` | `/api/v1/reservas/checkin-manual` | Montado ANTES de `reservas` para evitar colisión de rutas |
| `checkin.ts` | `/api/v1/reservas` | Agrega `/:id/qr-checkin` |
| `qr.ts` | `/api/v1/checkin` | `POST /qr` sin JWT (usa QR token) |
| `huespedes.ts` | `/api/v1/huespedes` | — |
| `clientes.ts` | `/api/v1/clientes` | Proxy RENIEC/SUNAT |
| `canales.ts` | `/api/v1/canales` | Webhook HMAC-only; sync-log con JWT |
| `revenue.ts` | `/api/v1/revenue` | Solo gerente/admin |
| `alertas.ts` | `/api/v1/alertas` | También montado bajo `/api/v1/habitaciones` |
| `pagos.ts` | `/api/v1/pagos` | Flujo Niubiz |
| `comprobantes.ts` | `/api/v1/comprobantes` | SUNAT |
| `whatsapp.ts` | `/api/v1/whatsapp` | GET = Meta challenge; POST = mensajes entrantes |
| `folio.ts` | (sub) `/:id/folio` | `mergeParams: true` |
| `turnos.ts` | `/api/v1/turnos` | Orden cuidadoso: `/activo` y `/abrir` ANTES de `/:id` |
| `internal.ts` | `/api/v1/internal` | `serviceAuth` (token fijo, no JWT) |

---

## `src/middleware/`

| Archivo | Función |
|---|---|
| `auth.ts` | `authenticate` (JWT Bearer) + `authorize(...roles)` (RBAC) + `signToken` |
| `error-handler.ts` | Captura `AppError` (código + status + mensaje) y errores Prisma; formatea JSON uniforme |
| `rate-limit.ts` | Implementación con Redis `INCR` + `EXPIRE`; bloquea con 429 |
| `serviceAuth.ts` | Valida header `X-Service-Token` contra `BACKEND_SERVICE_TOKEN` env |

---

## `src/lib/`

| Archivo | Contenido |
|---|---|
| `prisma.ts` | Singleton `PrismaClient` con log de queries en development |
| `redis.ts` | Cliente Redis (ioredis) con manejo de reconexión |
| `errors.ts` | Clase `AppError(code, httpStatus, message)` usada en toda la capa de service |
