---
tags: [api, endpoints, rest]
fecha: 2026-05-20
estado: ✅ completo
---

# Endpoints implementados

> Ver también: [[logica-negocio]], [[backend-estructura]]

Base URL: `http://localhost:3000/api/v1`
Autenticación: `Authorization: Bearer <JWT>` salvo donde se indica.

---

## Auth

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/auth/login` | público | Login email+password → JWT 8h. Rate limit: 5 intentos/15min por IP |

---

## Habitaciones

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/habitaciones` | todos | Listado paginado con filtros (estado, tipo, piso) |
| GET | `/habitaciones/disponibles` | todos | Habitaciones DISPONIBLE con tarifa sugerida del ia-service |
| GET | `/habitaciones/:id` | todos | Detalle de una habitación |
| POST | `/habitaciones` | GERENTE, ADMIN | Crear habitación |
| PUT | `/habitaciones/:id` | GERENTE, ADMIN | Actualizar habitación |
| DELETE | `/habitaciones/:id` | GERENTE, ADMIN | Baja lógica → FUERA_DE_SERVICIO (rechaza si hay reservas activas) |
| POST | `/habitaciones/:id/fotos` | GERENTE, ADMIN | Subir fotos (multer, max 5MB×10 archivos) |
| PATCH | `/habitaciones/:id/fotos` | GERENTE, ADMIN | Reordenar fotos |
| PATCH | `/habitaciones/:id/estado` | ADMIN, GERENTE, HOUSEKEEPING, MANTENIMIENTO | Cambiar estado operativo |
| GET | `/habitaciones/habitacion/:id` (alias) | ADMIN, GERENTE, MANTENIMIENTO | Alertas de mantenimiento de una habitación |

---

## Tipos de Habitación

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/tipos-habitacion` | todos | Listar tipos custom activos |
| POST | `/tipos-habitacion` | GERENTE, ADMIN | Crear tipo custom |
| PUT | `/tipos-habitacion/:id` | GERENTE, ADMIN | Actualizar tipo custom |
| DELETE | `/tipos-habitacion/:id` | GERENTE, ADMIN | Desactivar tipo custom |

---

## Reglas de Temporada

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/reglas-temporada` | todos | Listar reglas activas |
| POST | `/reglas-temporada` | GERENTE, ADMIN | Crear regla (valida fecha_inicio para EVENTO_ESPECIAL) |
| PUT | `/reglas-temporada/:id` | GERENTE, ADMIN | Actualizar regla |
| DELETE | `/reglas-temporada/:id` | GERENTE, ADMIN | Desactivar regla |

---

## Reservas

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/reservas` | todos | Listado con filtros (estado, fecha, huesped, habitacion, turno_id) |
| POST | `/reservas` | ADMIN, GERENTE, RECEPCIONISTA | Crear reserva (verificación GIST) |
| GET | `/reservas/:id` | todos | Detalle de reserva con folio y pagos |
| PATCH | `/reservas/:id/estado` | ADMIN, GERENTE, RECEPCIONISTA | Cambiar estado (máquina de estados) |
| DELETE | `/reservas/:id` | ADMIN, GERENTE | Cancelar reserva (soft-delete) |
| GET | `/reservas/:id/folio` | todos | Folio completo de la reserva |
| POST | `/reservas/:id/folio/items` | ADMIN, GERENTE, RECEPCIONISTA | Agregar cargo al folio |
| DELETE | `/reservas/:id/folio/items/:itemId` | ADMIN, GERENTE, RECEPCIONISTA | Anular cargo del folio |
| POST | `/reservas/:id/folio/pagos` | ADMIN, GERENTE, RECEPCIONISTA | Registrar pago en folio |
| GET | `/reservas/:id/qr-checkin` | todos | Generar QR token de check-in (JWT firmado TTL 24h) |

---

## Check-in Manual

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/reservas/checkin-manual/disponibles` | ADMIN, GERENTE, RECEPCIONISTA | Habitaciones disponibles para check-in inmediato |
| POST | `/reservas/checkin-manual` | ADMIN, GERENTE, RECEPCIONISTA | Ejecutar check-in manual completo (Redis lock + FOR UPDATE NOWAIT + tx atómica) |

---

## Check-in QR

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/checkin/qr` | público (usa QR token) | Procesar token QR para auto check-in del huésped |

---

## Huéspedes

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/huespedes` | todos | Listado con búsqueda fuzzy por nombre/documento |
| POST | `/huespedes` | ADMIN, GERENTE, RECEPCIONISTA | Crear huésped |
| GET | `/huespedes/:id` | todos | Detalle con estadísticas LTV |
| GET | `/huespedes/:id/historial` | todos | Historial de estancias del huésped |
| PATCH | `/huespedes/:id` | ADMIN, GERENTE, RECEPCIONISTA | Actualizar huésped |
| DELETE | `/huespedes/:id` | ADMIN, GERENTE | Baja lógica (activo = false) |

---

## Clientes (proxy RENIEC/SUNAT)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/clientes/reniec/:dni` | ADMIN, GERENTE, RECEPCIONISTA | Consulta DNI en API RENIEC (con retry+timeout 5s) |
| GET | `/clientes/sunat/:ruc` | ADMIN, GERENTE, RECEPCIONISTA | Consulta RUC en API SUNAT |

---

## Canales OTA (Channel Manager)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/canales/webhook/:canal` | HMAC (no JWT) | Webhook de OTA (Booking.com, Expedia, Airbnb) — valida firma HMAC-SHA256 |
| GET | `/canales/sync-log` | ADMIN, GERENTE | Historial de sincronizaciones con canales |

---

## Revenue / KPIs

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/revenue/kpis` | ADMIN, GERENTE | KPIs del día (ocupación, ADR, RevPAR, ingresos, comparativa mes anterior) |
| GET | `/revenue/forecast` | ADMIN, GERENTE | Forecast de ocupación 90 días via ia-service (Prophet) |

---

## Alertas de Mantenimiento

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/alertas` | ADMIN, GERENTE | Todas las alertas activas |
| GET | `/alertas/habitacion/:id` | ADMIN, GERENTE, MANTENIMIENTO | Alertas de una habitación |
| PATCH | `/alertas/:id/resolver` | ADMIN, GERENTE, MANTENIMIENTO | Marcar alerta como resuelta |

---

## Pagos (Niubiz/Stripe)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/pagos/iniciar` | RECEPCIONISTA, GERENTE, ADMIN | Iniciar sesión de pago Niubiz |
| POST | `/pagos/confirmar` | RECEPCIONISTA, GERENTE, ADMIN | Confirmar pago Niubiz |
| POST | `/pagos/:id/reembolso` | GERENTE, ADMIN | Iniciar reembolso |
| GET | `/pagos/reserva/:reserva_id` | todos | Pagos de una reserva específica |

---

## Comprobantes SUNAT

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/comprobantes/emitir` | RECEPCIONISTA, GERENTE, ADMIN | Emitir boleta o factura electrónica SUNAT |
| GET | `/comprobantes/reserva/:reserva_id` | todos | Comprobante de una reserva |
| GET | `/comprobantes` | GERENTE, ADMIN | Listado de comprobantes emitidos |

---

## WhatsApp (Meta Cloud API)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/whatsapp/webhook` | público | Verificación Meta (hub.challenge) |
| POST | `/whatsapp/webhook` | público | Mensajes entrantes → concierge IA → respuesta |

---

## Turnos de Caja

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/turnos` | GERENTE, RECEPCIONISTA, ADMIN | Historial de turnos con paginación y filtros |
| POST | `/turnos/abrir` | GERENTE, RECEPCIONISTA, ADMIN | Abrir nuevo turno (falla si ya hay uno abierto) |
| GET | `/turnos/activo` | GERENTE, RECEPCIONISTA, ADMIN | Turno activo con resumen en tiempo real |
| GET | `/turnos/:id/reporte` | GERENTE, RECEPCIONISTA, ADMIN | Reporte JSON del turno |
| GET | `/turnos/:id/reporte/pdf` | GERENTE, RECEPCIONISTA, ADMIN | PDF del reporte (PDFKit) |
| POST | `/turnos/:id/gastos` | GERENTE, RECEPCIONISTA, ADMIN | Registrar gasto de caja |
| GET | `/turnos/:id/gastos` | GERENTE, RECEPCIONISTA, ADMIN | Listar gastos del turno |
| POST | `/turnos/:id/cerrar` | GERENTE, RECEPCIONISTA, ADMIN | Cerrar turno (bcrypt PIN + SHA256 firma) |

---

## Endpoints internos (service-to-service)

Autenticación: header `X-Service-Token` (no JWT). Usados por ia-service y n8n.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/internal/alertas` | Crear/actualizar alerta de mantenimiento desde ia-service o n8n |
| POST | `/internal/notificaciones` | Emitir evento Socket.IO a salas específicas |

---

## Health

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado de DB y Redis (sin autenticación) |

---

## AI Service endpoints (`http://localhost:8001/ia/v1/`)

Autenticación: header `X-IA-Key`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health del ia-service |
| GET | `/forecast` | Predicción de ocupación (Prophet, 90 días por defecto) |
| GET | `/forecast/status` | Estado del modelo Prophet (última vez entrenado, métricas) |
| POST | `/forecast/retrain` | Forzar re-entrenamiento del modelo |
| GET | `/pricing/tarifa` | Calcular tarifa dinámica para una habitación y fechas |
| POST | `/pricing/batch` | Calcular tarifas para múltiples habitaciones |
| GET | `/crm/segmentos` | Resumen de segmentos de huéspedes |
| GET | `/crm/top-vip` | Top 10 huéspedes por LTV |
| POST | `/crm/segmentar` | Ejecutar segmentación CRM |
| GET | `/housekeeping/rutas` | Optimización de rutas de limpieza |
| GET | `/mantenimiento/predicciones` | Predicción de fallos por habitación |
| POST | `/reviews/analizar` | Análisis de sentimiento de reseña |
| POST | `/concierge/mensaje` | Respuesta del concierge IA (Claude Anthropic) |

---

## Total de endpoints

| Grupo | Endpoints |
|-------|-----------|
| Auth | 1 |
| Habitaciones | 10 |
| Tipos habitación | 4 |
| Reglas temporada | 4 |
| Reservas | 10 |
| Check-in manual | 2 |
| Check-in QR | 1 |
| Huéspedes | 6 |
| Clientes (RENIEC/SUNAT) | 2 |
| Canales OTA | 2 |
| Revenue/KPIs | 2 |
| Alertas | 3 |
| Pagos | 4 |
| Comprobantes | 3 |
| WhatsApp | 2 |
| Turnos | 8 |
| Internal | 2 |
| Health | 1 |
| **Backend total** | **67** |
| AI Service | 14 |
| **Total proyecto** | **81** |
