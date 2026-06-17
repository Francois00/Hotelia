---
tags: [arquitectura, vision, sistema, diagrama]
fecha: 2026-06-16
estado: ✅ completo
---

# Visión General del Sistema — Hotel Hotelia PMS

> Ver también: [[sistema-overview]], [[docker-compose]], [[stack-decisiones]]

---

## Diagrama ASCII del sistema completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          INTERNET / CLIENTES                            │
│                                                                         │
│  📱 WhatsApp     🌐 Booking.com    ✈️ Expedia     🏠 Airbnb             │
│  (Meta Cloud)    (webhook OTA)     (webhook OTA)  (webhook OTA)         │
└──────────┬───────────┬────────────────┬─────────────────────────────────┘
           │           │                │
           ▼           ▼                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    BACKEND — Node.js 20 + TypeScript                     │
│                    Docker: hotel_backend  :3000                          │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐                │
│  │  Auth/JWT    │  │  REST API    │  │  Socket.IO     │                │
│  │  bcrypt      │  │  67 endpts   │  │  tiempo real   │                │
│  └──────────────┘  └──────────────┘  └────────────────┘                │
│                                                                          │
│  Módulos: reservas · checkin/checkout · housekeeping · almacén          │
│           reportes · campañas CRM · concierge IA · turnos               │
│           channel manager · mantenimiento · comprobantes SUNAT          │
│                                                                          │
│  Jobs cron: NO-SHOW(02:00) | Sync-habs(*/15min) | CRM(dom) | WPP(08:00)│
└────────┬──────────────────────┬───────────────────────────────┬─────────┘
         │                      │                               │
         ▼                      ▼                               ▼
┌─────────────────┐   ┌──────────────────────┐    ┌─────────────────────┐
│  PostgreSQL 15  │   │  Redis 7             │    │  n8n self-hosted    │
│  hotel_db       │   │  cache + sesiones    │    │  hotel_n8n  :5678   │
│  hotel_n8n_db   │   │  hotel_redis  :6379  │    │  7 workflows        │
│  hotel_db :5432 │   └──────────────────────┘    │  checkin/checkout   │
│  Fuente verdad  │                                │  concierge WPP      │
│  18+ tablas     │                                │  encuesta           │
│  GIST anti-dup  │                                │  alertas mant.      │
└────────┬────────┘                                └──────────┬──────────┘
         │                                                    │
         ▼                                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   AI SERVICE — Python 3.11 + FastAPI                    │
│                   Docker: hotel_ia_service  :8001                       │
│                                                                         │
│  ┌───────────────┐  ┌─────────────────┐  ┌──────────────────┐         │
│  │  Pricing IA   │  │  Prophet        │  │  NLP Reviews     │         │
│  │  tarifa dinámica│  │  forecast 90d  │  │  sentimiento     │         │
│  └───────────────┘  └─────────────────┘  └──────────────────┘         │
│  ┌───────────────┐  ┌─────────────────┐                                │
│  │  CRM segment. │  │  Housekeeping   │                                │
│  │  LTV, segmentos│  │  rutas óptimas  │                                │
│  └───────────────┘  └─────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   FRONTEND — React 18 + Vite + Tailwind                 │
│                   Docker: hotel_frontend  :5173 (nginx)                 │
│                                                                         │
│  Dashboard · Reservas · Housekeeping · Almacén · CRM · Reportes        │
│  Concierge IA · Channel Manager · Check-in QR · Turnos · Configuración │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│  OLLAMA (host nativo, no Docker)                         │
│  localhost:11434  — Llama3 para concierge IA             │
│  ollama pull llama3                                      │
└──────────────────────────────────────────────────────────┘
```

---

## Los 4 flujos principales del sistema

### Flujo 1 — Reserva directa (recepción)
```
Recepcionista → Frontend:Reservas → POST /reservas
  → Redis SETNX lock (anti race)
  → BEGIN tx
  → SELECT hab FOR UPDATE NOWAIT  (previene overbooking)
  → INSERT reserva
  → UPDATE habitacion.estado = RESERVADA
  → COMMIT
  → Socket.IO "habitacion-actualizada" (todos los clientes)
  → WhatsApp confirmación al huésped (opcional)
```

### Flujo 2 — Reserva vía WhatsApp (Concierge IA)
```
Huésped → WhatsApp → Meta webhook → POST /whatsapp/webhook
  → concierge.service.ts (state machine 8 pasos)
  → Llama3 (localhost:11434) para NLP y respuestas
  → GET /habitaciones/disponibles (verifica stock)
  → POST /huespedes (upsert si es nuevo)
  → POST /reservas (crea reserva)
  → enviarWPP() → respuesta al huésped
```

### Flujo 3 — OTA (Channel Manager)
```
Booking.com/Expedia → POST /canales/webhook/:canal
  → Validar HMAC-SHA256 (firma del canal)
  → Idempotency check (canal_sync_log)
  → BEGIN tx → INSERT reserva → COMMIT
  → Log en canal_sync_log
  → Notificación Socket.IO al dashboard
  → WhatsApp al recepcionista de turno
```

### Flujo 4 — Checkout completo
```
Recepcionista → CheckoutPage (wizard 3 pasos)
  Paso 1: Ver folio → items de habitación + extras
  Paso 2: Cobro → POST /reservas/:id/folio/pagos
  Paso 3: Comprobante → POST /comprobantes/emitir (SUNAT)
  → PATCH /reservas/:id/estado = CHECKOUT_REALIZADO
  → PATCH /habitaciones/:id/estado = LIMPIEZA
  → n8n trigger → encuesta post-estancia (24h delay)
  → WhatsApp encuesta al huésped
```

---

## Cómo se comunican los servicios

| Origen | Destino | Protocolo | Auth |
|--------|---------|-----------|------|
| Frontend | Backend | REST + Socket.IO | JWT Bearer |
| n8n | Backend | HTTP REST | X-Service-Token |
| n8n | Backend /n8n/* | HTTP REST | N8N_WEBHOOK_SECRET header |
| Backend | ia-service | HTTP REST | X-IA-Key header |
| ia-service | Backend /internal/* | HTTP REST | X-Service-Token |
| Backend | Llama3 (Ollama) | HTTP REST | ninguna (localhost) |
| Backend | WhatsApp Meta | HTTPS | Bearer WPP token |
| Backend | SUNAT | HTTPS | SOL + certificado |
| Backend | Niubiz/Stripe | HTTPS | API key |
| OTA | Backend | HTTPS webhook | HMAC-SHA256 |

---

## Puertos locales

| Servicio | Puerto | URL |
|----------|--------|-----|
| Backend Node.js | 3000 | http://localhost:3000 |
| Frontend React | 5173 | http://localhost:5173 |
| AI Service Python | 8001 | http://localhost:8001 |
| n8n workflows | 5678 | http://localhost:5678 |
| PostgreSQL | 5432 | localhost:5432/hotel_db |
| Redis | 6379 | localhost:6379 |
| Ollama (host) | 11434 | http://localhost:11434 |
