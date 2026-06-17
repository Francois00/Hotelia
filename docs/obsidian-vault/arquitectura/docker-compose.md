---
tags: [docker, infraestructura, servicios, deploy]
fecha: 2026-06-16
estado: ✅ completo
---

# Docker Compose — Servicios del sistema

> Ver también: [[vision-general]], [[iniciar-sistema]]

Archivo: `docker-compose.yml` en la raíz del proyecto.
Red interna: `hotel_network` (bridge automático de Docker Compose).

---

## Servicios

### 1. `db` — PostgreSQL 15
| Campo | Valor |
|-------|-------|
| Imagen | `postgres:15-alpine` |
| Contenedor | `hotel_db` |
| Puerto | `5432:5432` |
| Bases de datos | `hotel_db` (PMS), `n8n_db` (creada por `docker/postgres/init.sql`) |
| Variables clave | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| Volumen | `postgres_data:/var/lib/postgresql/data` |
| Init script | `./docker/postgres/init.sql` — crea extensiones (pgcrypto, pg_trgm, btree_gist) y `n8n_db` |
| Health check | `pg_isready -U $DB_USER -d hotel_db` cada 10s, 5 reintentos |
| Restart | `unless-stopped` |

---

### 2. `redis` — Redis 7
| Campo | Valor |
|-------|-------|
| Imagen | `redis:7-alpine` |
| Contenedor | `hotel_redis` |
| Puerto | `6379:6379` |
| Comando | `redis-server --appendonly yes` (persistencia AOF) |
| Volumen | `redis_data:/data` |
| Health check | `redis-cli ping` cada 10s |
| Uso | Cache de disponibilidad, locks anti-race, sesiones concierge IA |

---

### 3. `n8n` — Automatización de flujos
| Campo | Valor |
|-------|-------|
| Imagen | `n8nio/n8n:latest` |
| Contenedor | `hotel_n8n` |
| Puerto | `5678:5678` |
| Persistencia | PostgreSQL `n8n_db` (no volumen local) |
| Auth | `N8N_BASIC_AUTH_ACTIVE=true` + usuario/contraseña de `.env` |
| Timezone | `America/Lima` |
| Variables clave | `BACKEND_URL`, `IA_SERVICE_URL`, `SERVICE_TOKEN`, `BACKEND_SERVICE_TOKEN`, `IA_SECRET_KEY` |
| Health check | ninguno (auto-restart) |
| Flujos montados | `n8n-flows/` (solo versionado — deben importarse manualmente en la UI) |

> ⚠️ `N8N_ENCRYPTION_KEY` y `SERVICE_TOKEN` tienen defaults inseguros. Cambiar en `.env` antes de deploy.

---

### 4. `backend` — Node.js 20 + TypeScript
| Campo | Valor |
|-------|-------|
| Build | `./backend/Dockerfile` |
| Contenedor | `hotel_backend` |
| Puerto | `3000:3000` |
| Depende de | `db` (healthy) + `redis` (healthy) |
| Variables clave | `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `WHATSAPP_*`, `NIUBIZ_*`, `STRIPE_*`, `SUNAT_*` |
| Variables OTA | `WEBHOOK_SECRET_BOOKING`, `WEBHOOK_SECRET_EXPEDIA`, `WEBHOOK_SECRET_AIRBNB` |
| Variables inter-service | `IA_SERVICE_URL`, `IA_SECRET_KEY`, `BACKEND_SERVICE_TOKEN`, `N8N_WEBHOOK_SECRET` |
| Inicio | `node dist/index.js` (compila con `tsc` durante build) |
| Health check | GET `/api/v1/health` |

---

### 5. `ia-service` — Python 3.11 + FastAPI
| Campo | Valor |
|-------|-------|
| Build | `./ia-service/Dockerfile` |
| Contenedor | `hotel_ia_service` |
| Puerto | `8001:8001` |
| Depende de | `db` (healthy) |
| Variables clave | `DATABASE_URL`, `IA_SECRET_KEY`, `BACKEND_INTERNAL_URL`, `BACKEND_SERVICE_TOKEN` |
| Inicio | Uvicorn en puerto 8001 |
| Capacidades | Prophet 1.1.5, pricing dinámico, NLP reviews, segmentación CRM, rutas housekeeping |

> ⚠️ Prophet requiere `cmdstanpy 1.3.0` con makefile vacío en `bundled cmdstan-2.33.1`. Ver [[feedback_prophet_cmdstanpy]] en memoria.

---

### 6. `frontend` — React 18 + Vite → Nginx
| Campo | Valor |
|-------|-------|
| Build | `./frontend/Dockerfile.prod` (multi-stage) |
| Contenedor | `hotel_frontend` |
| Puerto | `5173:80` (nginx sirviendo el build estático) |
| Build args | `VITE_API_URL`, `VITE_IA_URL`, `VITE_SOCKET_URL` |
| Depende de | `backend` |
| Health check | `wget -qO- http://127.0.0.1:80/` cada 30s |

---

## Volúmenes

| Nombre | Contenido |
|--------|-----------|
| `postgres_data` | Datos de PostgreSQL (persiste entre reinicios) |
| `redis_data` | AOF de Redis (persiste entre reinicios) |
| `n8n_data` | No usado — n8n persiste en `n8n_db` de PostgreSQL |

---

## Variables de entorno requeridas (`.env` en raíz)

```bash
# Base de datos
DB_USER=hotel_user
DB_PASSWORD=<fuerte>
DATABASE_URL=postgresql://hotel_user:<pw>@localhost:5432/hotel_db

# JWT
JWT_SECRET=<64 chars random>

# Redis
REDIS_URL=redis://localhost:6379

# n8n
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=<fuerte>
N8N_ENCRYPTION_KEY=<32 chars exactos>

# Inter-servicios
BACKEND_SERVICE_TOKEN=<fuerte>
IA_SECRET_KEY=<fuerte>
N8N_WEBHOOK_SECRET=<fuerte>

# WhatsApp Meta Cloud API
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=

# OTA webhooks
WEBHOOK_SECRET_BOOKING=
WEBHOOK_SECRET_EXPEDIA=
WEBHOOK_SECRET_AIRBNB=

# Pagos
NIUBIZ_API_KEY=
STRIPE_SECRET_KEY=

# SUNAT
SUNAT_RUC=
SUNAT_USUARIO_SOL=
SUNAT_CLAVE_SOL=
SUNAT_CERT_PATH=
SUNAT_CERT_PASSWORD=
SUNAT_MODO=beta

# Ollama (concierge IA)
OLLAMA_URL=http://host.docker.internal:11434
```

---

## Comandos útiles

```bash
# Levantar todo
docker compose up -d

# Ver estado
docker compose ps

# Logs de un servicio
docker compose logs -f backend

# Reiniciar un servicio sin bajar los demás
docker compose restart backend

# Reconstruir imagen después de cambios de código
docker compose build backend && docker compose up -d backend

# Ejecutar migración de BD (workaround Windows)
docker compose exec backend npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script | docker compose exec -T db psql -U $DB_USER hotel_db
```
