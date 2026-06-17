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

---

## Actualizado 2026-06-16 — Endpoints del sprint

### Almacén (`/api/v1/almacen/*`)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/almacen/dashboard` | todos | KPIs: total, normal, bajo, crítico, valor total stock |
| GET | `/almacen/categorias` | todos | 8 categorías con count de artículos |
| GET | `/almacen/articulos` | todos | Listado con filtros (categoria, alerta, busqueda) |
| POST | `/almacen/articulos` | GERENTE, ADMIN | Crear artículo |
| PUT | `/almacen/articulos/:id` | GERENTE, ADMIN | Editar artículo |
| POST | `/almacen/movimientos/entrada` | todos los staff | Registrar ingreso de stock |
| POST | `/almacen/movimientos/salida` | todos los staff | Registrar salida de stock |
| GET | `/almacen/movimientos` | todos | Historial con filtros (tipo, articulo, desde, hasta) |
| GET | `/almacen/alertas` | todos | Artículos con stock ≤ mínimo |
| POST | `/almacen/inventariados` | GERENTE, ADMIN | Iniciar proceso de inventariado |
| GET | `/almacen/inventariados/activo` | todos | Inventariado activo con items |
| PATCH | `/almacen/inventariados/:id/items/:itemId` | todos los staff | Actualizar conteo real de un ítem |
| POST | `/almacen/inventariados/:id/cerrar` | GERENTE, ADMIN | Cerrar inventariado y aplicar diferencias |

### Housekeeping (`/api/v1/housekeeping/*`)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/housekeeping/plan-dia` | HK, RECEP, GER | Plan del día con prioridades y timer |
| PATCH | `/housekeeping/habitaciones/:numero/estado` | HK, RECEP, GER | Cambiar estado de habitación |
| GET | `/housekeeping/habitaciones/:numero/detalle` | HK, RECEP, GER | Detalle + historial de la habitación |

### Reportes (`/api/v1/reportes/*`)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/reportes/mensual` | GERENTE, ADMIN | JSON del reporte mensual (`?mes=2026-06`) |
| GET | `/reportes/mensual/pdf` | GERENTE, ADMIN | PDF descargable del reporte |
| GET | `/reportes/mensual/excel` | GERENTE, ADMIN | Excel (.xlsx) descargable |
| GET | `/reportes/comparativo` | GERENTE, ADMIN | Comparativo mes actual vs anterior |

### Campañas CRM (`/api/v1/campanas/*`)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/campanas` | GERENTE, ADMIN | Listar campañas con estado |
| POST | `/campanas/preview` | GERENTE, ADMIN | Vista previa: cuántos recibirán la campaña |
| POST | `/campanas` | GERENTE, ADMIN | Crear campaña en estado BORRADOR |
| POST | `/campanas/:id/enviar` | GERENTE, ADMIN | Lanzar envío en background (202 Accepted) |
| GET | `/campanas/:id/estado` | GERENTE, ADMIN | Progreso: enviados/total |

### Solicitudes de Huéspedes (`/api/v1/solicitudes/*`)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/solicitudes` | todos | Listar solicitudes (filtro: pendientes, reserva_id) |
| POST | `/solicitudes` | público (token reserva) | Crear solicitud desde QR del huésped |
| PATCH | `/solicitudes/:id` | RECEP, GER, ADMIN | Actualizar estado de la solicitud |

### Concierge IA (`/api/v1/concierge/*`)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/concierge/chat` | autenticado | Enviar mensaje al concierge (pruebas directas) |
| DELETE | `/concierge/chat/:session_id` | autenticado | Limpiar sesión de conversación |

### n8n endpoints internos (`/api/v1/n8n/*`)

Autenticación: header `x-n8n-secret: $N8N_WEBHOOK_SECRET`

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/n8n/interpretar-mensaje` | Procesar mensaje concierge WPP |
| POST | `/n8n/disponibilidad` | Verificar habitaciones disponibles |
| POST | `/n8n/upsert-huesped` | Crear/actualizar huésped |
| POST | `/n8n/crear-reserva` | Crear reserva final desde n8n |
| POST | `/n8n/guardar-mensaje` | Guardar en concierge_mensajes |
| POST | `/n8n/generar-voucher` | Generar PDF voucher de reserva |
| POST | `/n8n/programar-encuesta` | Trigger encuesta post-estancia en n8n |
| POST | `/n8n/guardar-encuesta` | Guardar respuesta de encuesta |
| POST | `/n8n/concierge` | Endpoint alternativo concierge |

### Mantenimiento por habitación (`/api/v1/mantenimiento/*`)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/mantenimiento` | GER, ADMIN, MANT | Listar registros de mantenimiento |
| POST | `/mantenimiento` | GER, ADMIN, MANT | Crear registro de trabajo |
| PATCH | `/mantenimiento/:id` | GER, ADMIN, MANT | Actualizar estado (completado, etc.) |

### Total actualizado

| Grupo | Endpoints |
|-------|-----------|
| Backend total previo | 67 |
| Almacén (nuevos) | 13 |
| Housekeeping (nuevos) | 3 |
| Reportes (nuevos) | 4 |
| Campañas CRM (nuevos) | 5 |
| Solicitudes (nuevos) | 3 |
| Concierge directa (nuevos) | 2 |
| n8n internos (nuevos) | 9 |
| Mantenimiento (nuevos) | 3 |
| **Backend total actualizado** | **109** |
| AI Service | 14 |
| **Total proyecto actualizado** | **123** |
