---
tags: [usuarios, credenciales, accesos, roles]
fecha: 2026-06-16
estado: ✅ completo
---

# Credenciales y accesos — Entorno de desarrollo

> ⚠️ Este archivo documenta el entorno de DESARROLLO. Nunca usar estas credenciales en producción.

---

## Usuarios del sistema (base de datos)

Contraseña de desarrollo para todos: **`Hotel2024!`**

| Email | Rol | Acceso |
|-------|-----|--------|
| `admin@hotel.com` | ADMIN | Todo el sistema |
| `gerente@hotel.com` | GERENTE | Dashboard, reportes, CRM, configuración |
| `recepcion@hotel.com` | RECEPCIONISTA | Reservas, check-in/out, turnos, almacén (lectura) |
| `housekeeping@hotel.com` | HOUSEKEEPING | Plan del día, cambio de estado de habitaciones |
| `mantenimiento@hotel.com` | MANTENIMIENTO | Alertas de mantenimiento, registro de trabajos |

### Roles y permisos resumidos

| Módulo | ADMIN | GERENTE | RECEPCIONISTA | HOUSEKEEPING | MANTENIMIENTO |
|--------|-------|---------|---------------|--------------|---------------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reservas (CRUD) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Check-in / Checkout | ✅ | ✅ | ✅ | ❌ | ❌ |
| Housekeeping plan | ✅ | ✅ | ✅ | ✅ | ❌ |
| Almacén (lectura) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Almacén (escritura) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Almacén (inventariado) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reportes mensuales | ✅ | ✅ | ❌ | ❌ | ❌ |
| CRM / Campañas | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configuración hotel | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mantenimiento (ver) | ✅ | ✅ | ✅ | ❌ | ✅ |
| Mantenimiento (resolver) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Turnos de caja | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## Servicios locales y puertos

| Servicio | URL | Usuario/Contraseña |
|---------|-----|--------------------|
| Frontend (app) | http://localhost:5173 | Ver usuarios arriba |
| Backend API | http://localhost:3000/api/v1 | JWT Bearer |
| n8n workflows | http://localhost:5678 | Ver `N8N_BASIC_AUTH_*` en `.env` |
| PostgreSQL | localhost:5432/hotel_db | `$DB_USER` / `$DB_PASSWORD` |
| Redis | localhost:6379 | Sin contraseña (dev) |
| AI Service | http://localhost:8001/ia/v1 | Header `X-IA-Key` |
| Ollama (Llama3) | http://localhost:11434 | Sin auth |

---

## Variables de entorno requeridas (solo nombres)

```bash
# Base de datos
DATABASE_URL
DB_USER
DB_PASSWORD

# Autenticación
JWT_SECRET

# Redis
REDIS_URL

# n8n
N8N_BASIC_AUTH_USER
N8N_BASIC_AUTH_PASSWORD
N8N_ENCRYPTION_KEY

# Inter-servicios
BACKEND_SERVICE_TOKEN
IA_SECRET_KEY
N8N_WEBHOOK_SECRET

# WhatsApp Meta
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_VERIFY_TOKEN
WHATSAPP_GRUPO_ID

# Ollama
OLLAMA_URL

# OTA webhooks
WEBHOOK_SECRET_BOOKING
WEBHOOK_SECRET_EXPEDIA
WEBHOOK_SECRET_AIRBNB

# Pagos
NIUBIZ_API_KEY
NIUBIZ_MERCHANT_ID
STRIPE_SECRET_KEY

# SUNAT
SUNAT_RUC
SUNAT_USUARIO_SOL
SUNAT_CLAVE_SOL
SUNAT_CERT_PATH
SUNAT_CERT_PASSWORD
SUNAT_MODO

# RENIEC / SUNAT consulta
RENIEC_API_TOKEN
SUNAT_API_TOKEN

# App
PORT
NODE_ENV
JWT_EXPIRES_IN
CORS_ORIGINS
FRONTEND_URL
```

---

## Obtener JWT por curl

```bash
curl http://localhost:3000/api/v1/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"gerente@hotel.com","password":"Hotel2024!"}'
```
