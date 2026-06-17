---
tags: [n8n, workflows, automatizacion, whatsapp, encuesta]
fecha: 2026-06-16
estado: ✅ completo
---

# n8n — Workflows detallados

> Ver también: [[estado-actual]], [[concierge-llama3]], [[webhook-whatsapp]]

n8n corre en `http://localhost:5678`. Los JSONs están en `n8n-flows/`.
**Importante**: deben importarse manualmente desde la UI — el montaje `:ro` es solo para versionado.

---

## Cómo importar un workflow

1. Abrir http://localhost:5678
2. Login con `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`
3. Menú lateral → Workflows → Import → Upload file
4. Seleccionar el JSON de `n8n-flows/`
5. Activar con el toggle "Active" en la esquina superior derecha
6. Verificar que las variables de entorno en Docker Compose estén configuradas

---

## Workflow 1: `concierge-wpp-reservas.json` ✅ Activo

**Propósito**: Gestionar conversaciones de reserva por WhatsApp usando IA (Llama3).

**Trigger**: Webhook POST de Meta Cloud API
URL: `http://localhost:5678/webhook/concierge-wpp`
(expuesto públicamente via localtunnel)

**Nodos**:
| Nodo | Tipo | Qué hace |
|------|------|----------|
| WhatsApp Webhook | Webhook | Recibe payload de Meta |
| Extraer mensaje | Function | Extrae `from` y `body.text.body` del payload |
| Filtrar no-texto | IF | Descarta imágenes, stickers, etc. |
| Llamar backend | HTTP Request | POST `/api/v1/n8n/interpretar-mensaje` |
| Enviar respuesta WPP | HTTP Request | POST `graph.facebook.com/v18.0/{PHONE_ID}/messages` |

**Headers requeridos en backend**: `x-n8n-secret: $N8N_WEBHOOK_SECRET`

**Flujo completo**: ver [[concierge-llama3]]

---

## Workflow 2: `encuesta-post-estancia.json` ✅ Activo

**Propósito**: Enviar encuesta de satisfacción 24h después del checkout.

**Trigger**: Webhook interno del backend
URL: `http://localhost:5678/webhook/encuesta-post-estancia`
Llamado por: `POST /api/v1/n8n/programar-encuesta`

**Nodos**:
| Nodo | Tipo | Qué hace |
|------|------|----------|
| Encuesta Trigger | Webhook | Recibe `{ reserva_id, huesped_id, telefono, nombre }` |
| Wait 24h | Wait | Espera 24 horas antes de enviar |
| ¿Tiene teléfono? | IF | Ramifica según disponibilidad de contacto |
| Enviar WPP | HTTP Request | POST Meta Cloud API con mensaje de encuesta |
| Guardar en BD | HTTP Request | POST `/api/v1/n8n/guardar-encuesta` |

**Mensaje de encuesta enviado**:
```
Hola {nombre}, ¿cómo fue tu estancia en Hotel Hotelia? 😊
Nos ayudaría mucho si calificaras tu experiencia:
⭐⭐⭐⭐⭐ — Excelente
⭐⭐⭐⭐ — Muy buena
⭐⭐⭐ — Buena
⭐⭐ — Regular
⭐ — Mejorable
```

**Tabla destino**: `encuestas_satisfaccion` via `POST /api/v1/n8n/guardar-encuesta`

---

## Workflow 3: `checkin_automatico.json` ✅ JSON listo, pendiente activar

**Propósito**: Auto check-in de reservas confirmadas para el día de hoy.

**Trigger**: Cron cada 15 minutos
**Lógica**: GET reservas CONFIRMADA con fecha_entrada = hoy → PATCH estado = CHECKIN_REALIZADO

---

## Workflow 4: `checkout_automatico.json` ✅ JSON listo, pendiente activar

**Propósito**: Auto checkout de reservas cuya fecha_salida fue ayer.

**Trigger**: Cron cada 15 minutos
**Lógica**: 
1. GET reservas CHECKIN_REALIZADO con fecha_salida ≤ ayer
2. PATCH estado = CHECKOUT_REALIZADO
3. PATCH habitación = LIMPIEZA
4. Trigger encuesta post-estancia

---

## Workflow 5: `alerta_mantenimiento.json` ✅ JSON listo, pendiente activar

**Propósito**: Procesar alertas de mantenimiento y notificar por email/Slack.

**Trigger**: Webhook — llamado por ia-service o housekeeping
**Nodos**: POST `/internal/alertas` → IF nivel=alta → envío email gerente/mantenimiento

---

## Workflow 6: `segmentacion_semanal.json` ✅ JSON listo, pendiente activar

**Propósito**: Recalcular segmentos CRM todos los domingos.

**Trigger**: Cron domingos 03:00 AM Lima
**Lógica**: POST `/ia/v1/crm/segmentar` → GET `/ia/v1/crm/top-vip` → email gerente

---

## Endpoints del backend que n8n consume

| Endpoint | Auth | Usado por |
|----------|------|-----------|
| `POST /n8n/interpretar-mensaje` | x-n8n-secret | concierge-wpp |
| `POST /n8n/disponibilidad` | x-n8n-secret | concierge-wpp |
| `POST /n8n/upsert-huesped` | x-n8n-secret | concierge-wpp |
| `POST /n8n/crear-reserva` | x-n8n-secret | concierge-wpp |
| `POST /n8n/guardar-mensaje` | x-n8n-secret | concierge-wpp |
| `POST /n8n/generar-voucher` | x-n8n-secret | concierge-wpp |
| `POST /n8n/programar-encuesta` | x-n8n-secret | checkout_automatico |
| `POST /n8n/guardar-encuesta` | x-n8n-secret | encuesta-post-estancia |
| `POST /n8n/concierge` | x-n8n-secret | concierge-wpp (alternativo) |
| `POST /internal/alertas` | x-service-token | alerta_mantenimiento |
| `POST /internal/notificaciones` | x-service-token | checkout_automatico |
| `PATCH /reservas/:id/estado` | JWT Bearer | checkin/checkout auto |
| `PATCH /habitaciones/:id/estado` | JWT Bearer | checkout_automatico |
| `POST /ia/v1/crm/segmentar` | X-IA-Key | segmentacion_semanal |

---

## Variables de entorno que n8n necesita

Configuradas en la sección `environment` del servicio `n8n` en `docker-compose.yml`:

| Variable | Valor default (dev) |
|----------|---------------------|
| `BACKEND_URL` | `http://backend:3000` |
| `IA_SERVICE_URL` | `http://ia-service:8001` |
| `SERVICE_TOKEN` | Cambiar en `.env` |
| `BACKEND_SERVICE_TOKEN` | Cambiar en `.env` |
| `IA_SECRET_KEY` | Cambiar en `.env` |
| `ADMIN_EMAIL` | admin@hotelia.pe |
| `GERENTE_EMAIL` | gerente@hotelia.pe |
| `MANTENIMIENTO_EMAIL` | mantenimiento@hotelia.pe |

> ⚠️ En expresiones n8n se accede como `$env.BACKEND_URL` o `{{$env.BACKEND_SERVICE_TOKEN}}`
