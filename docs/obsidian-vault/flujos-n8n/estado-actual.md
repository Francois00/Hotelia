---
tags: [n8n, automatizacion, flujos]
fecha: 2026-05-20
estado: 🔄 en progreso
---

# n8n — Flujos de automatización

> Ver también: [[stack-decisiones]], [[logica-negocio]]

n8n self-hosted corre en `http://localhost:5678` (Docker container `hotel_n8n`).
Persiste en PostgreSQL — base de datos separada `n8n_db` creada por `docker/postgres/init.sql`.
Los flujos JSON están en `n8n-flows/` y se montan en `/home/node/flows:ro`.

**Importante**: los flujos deben importarse manualmente desde la UI de n8n — el montaje `:ro` es solo para versionado, no se auto-importan.

---

## Flujos implementados

### 1. `checkin_automatico.json` ✅ JSON listo

**Trigger**: Cron cada 15 minutos.

**Lógica**:
1. GET `/api/v1/reservas?estado=CONFIRMADA&limit=100` (Authorization: Bearer token)
2. Filtra reservas cuya `fecha_entrada` sea igual a hoy
3. Para cada una: POST `/api/v1/reservas/:id/estado` → `CHECKIN_REALIZADO` (auto check-in)
4. Envía notificación WhatsApp al huésped via backend

**Variables de entorno n8n usadas**:
- `BACKEND_URL`: `http://backend:3000`
- `SERVICE_TOKEN`: token de servicio backend
- `HOTEL_NAME`: nombre del hotel para notificaciones

**Estado**: JSON disponible, pendiente importar en n8n y activar.

---

### 2. `checkout_automatico.json` ✅ JSON listo

**Trigger**: Cron cada 15 minutos.

**Lógica**:
1. GET reservas en estado `CHECKIN_REALIZADO` con `fecha_salida` = ayer (late checkout procesado) o hoy
2. Para cada una: PATCH estado → `CHECKOUT_REALIZADO`
3. PATCH habitación estado → `LIMPIEZA`
4. Notifica al equipo de housekeeping (Socket.IO via `/api/v1/internal/notificaciones`)
5. Envía encuesta de satisfacción al huésped (trigger del flujo `encuesta_post_estancia`)

**Estado**: JSON disponible, pendiente importar en n8n y activar.

---

### 3. `encuesta_post_estancia.json` ✅ JSON listo

**Trigger**: Webhook interno (llamado por `checkout_automatico`).

**Lógica**:
1. Recibe `{ reserva_id, huesped_id, email, telefono }`
2. Construye enlace de encuesta: `SURVEY_URL?reserva_id=...`
3. Envía por WhatsApp si tiene teléfono, por email (SendGrid) si tiene email
4. Espera 30 segundos antes de enviar para dar tiempo al sistema

**Variables de entorno n8n usadas**:
- `SURVEY_URL`: URL del frontend de encuesta
- `SENDGRID_API_KEY`: API key de SendGrid para emails
- `HOTEL_EMAIL`: email del hotel (remitente)

**Estado**: JSON disponible, pendiente configurar SendGrid y activar.

---

### 4. `alerta_mantenimiento.json` ✅ JSON listo

**Trigger**: Webhook — activado cuando el ia-service detecta una alerta o cuando housekeeping escala un problema.

**Lógica**:
1. Recibe alerta con `{ habitacion_id, tipo, descripcion, nivel_alerta }`
2. POST `/api/v1/internal/alertas` → guarda en BD y emite Socket.IO
3. Si `nivel_alerta = alta`: envía email a `MANTENIMIENTO_EMAIL`
4. Si `nivel_alerta = alta` + `tipo = INCENDIO/INUNDACION`: envía Slack + email gerente

**Variables de entorno n8n usadas**:
- `MANTENIMIENTO_EMAIL`
- `GERENTE_EMAIL`
- `SLACK_WEBHOOK_URL` (opcional)

**Estado**: JSON disponible, pendiente configurar emails y activar.

---

### 5. `segmentacion_semanal.json` ✅ JSON listo

**Trigger**: Cron — todos los lunes a las 03:00 AM (hora Lima).

**Lógica**:
1. POST `/ia/v1/crm/segmentar` → ia-service recalcula segmentos de todos los huéspedes
2. GET `/ia/v1/crm/top-vip` → lista top VIP
3. Envía resumen semanal por email a `GERENTE_EMAIL`
4. Si hay huéspedes INACTIVOS: activa campaña de reactivación (próximo paso de roadmap)

**Variables de entorno n8n usadas**:
- `IA_SERVICE_URL`: `http://ia-service:8001`
- `IA_SECRET_KEY`
- `GERENTE_EMAIL`
- `SENDGRID_API_KEY`

**Estado**: JSON disponible, pendiente activar.

---

## Endpoints del backend que n8n consume

| Endpoint | Usado por |
|----------|-----------|
| `GET /api/v1/reservas` | checkin_automatico, checkout_automatico |
| `PATCH /api/v1/reservas/:id/estado` | checkin_automatico, checkout_automatico |
| `PATCH /api/v1/habitaciones/:id/estado` | checkout_automatico |
| `POST /api/v1/internal/alertas` | alerta_mantenimiento |
| `POST /api/v1/internal/notificaciones` | checkout_automatico, alerta_mantenimiento |
| `POST /ia/v1/crm/segmentar` | segmentacion_semanal |
| `GET /ia/v1/crm/top-vip` | segmentacion_semanal |

---

## Pasos para activar los flujos

1. Levantar el stack: `docker compose up -d`
2. Acceder a n8n: http://localhost:5678 (credenciales en `.env`: `N8N_BASIC_AUTH_USER/PASSWORD`)
3. Importar cada JSON desde: Settings → Import workflow → Upload file
4. Configurar credenciales en n8n (Settings → Credentials):
   - No son necesarias: los flujos usan HTTP Request nodes con Authorization por header, tomando los valores de las variables de entorno de Docker Compose
5. Activar cada flujo (toggle "Active" en la esquina superior derecha)
6. Verificar que `BACKEND_SERVICE_TOKEN` y `IA_SECRET_KEY` en `docker-compose.yml` coincidan con los valores reales de `.env`

---

## Riesgos

- `SERVICE_TOKEN: change_me_backend_token_dev` es el valor por defecto en `docker-compose.yml` — **cambiar antes de deploy**.
- Los flujos usan `http://backend:3000` (red Docker interna) — solo funcionan dentro del stack de Docker, no en desarrollo local sin Docker.
- n8n no tiene retry configurado por defecto en los nodos HTTP — si el backend está caído, el flujo fallará silenciosamente.
