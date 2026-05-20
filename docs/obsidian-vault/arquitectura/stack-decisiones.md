---
tags: [arquitectura, decisiones, stack]
fecha: 2026-05-20
---

# Stack — Decisiones técnicas

> Ver también: [[adr-001-postgresql-redis]], [[adr-002-microservicio-python]], [[adr-003-prisma-docker]]

---

## Lenguaje y runtime

| Decisión | Elección | Razón |
|---|---|---|
| Runtime backend | **Node.js 20 LTS** | Soporte hasta abril 2026, `--experimental-vm-modules` estable, compatible con todas las libs |
| Lenguaje | **TypeScript estricto** (`strict: true`) | Detecta errores en tiempo de compilación; crítico para lógica financiera |
| Ejecución en desarrollo | `ts-node` con `tsconfig-paths` | Evita paso de compilación; paths `@/` resueltos en runtime |
| Ejecución en producción | `tsc` → JS compilado | Sin overhead de transpilación; imagen Docker más pequeña |
| Package manager | **pnpm** | Deduplicación de módulos, workspace listo si se necesita monorepo futuro |

---

## Base de datos

| Decisión | Elección | Razón |
|---|---|---|
| BD principal | **PostgreSQL 15 Alpine** | ACID, extensiones `pgcrypto` / `btree_gist` / `pg_trgm`, constraint EXCLUDE anti-overbooking |
| ORM | **Prisma 5.x** | Tipos TypeScript generados, migraciones, schema como documentación viva |
| Cache | **Redis 7 Alpine** | Solo cache — NUNCA fuente primaria. Rate limiting, locks distribuidos, tarifa fallback |
| Gestión de migraciones | `psql pipe` (no `prisma migrate deploy`) | El `schema-engine-windows.exe` falla con Docker Desktop en Windows. Ver [[adr-003-prisma-docker]] |

---

## Workaround Prisma en Windows + Docker

**Problema**: `prisma migrate deploy` lanza el binario nativo `schema-engine-windows.exe` que no puede conectarse al postgres dentro de Docker cuando se ejecuta desde el host Windows (networking mismatch).

**Solución adoptada**:
```bash
# Generar SQL de la migración:
npx prisma migrate diff --from-schema-datasource --to-schema-datamodel prisma/schema.prisma --script > migration.sql

# Aplicar directamente con psql (conectándose a Docker):
docker exec -i hotel_db psql -U hotel_user -d hotel_db < migration.sql
```

**Consecuencia**: Las migraciones se aplican manualmente, no con el CLI de Prisma. El cliente sigue siendo Prisma (queries, tipos).

---

## OpenSSL Alpine fix

**Problema**: La imagen Docker del backend usa `node:20-alpine` que incluye OpenSSL 3.x. El binario de Prisma client generado para el host (Windows/Linux) usa una versión diferente de OpenSSL.

**Solución** en `schema.prisma`:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

Esto hace que Prisma descargue el binario correcto para Alpine al hacer `prisma generate` dentro del Dockerfile.

---

## Docker Compose — networking

| Servicio | Host interno | Puerto externo |
|---|---|---|
| `db` | `db:5432` | `5432` |
| `redis` | `redis:6379` | `6379` |
| `backend` | `backend:3000` | `3000` |
| `ia-service` | `ia-service:8001` | `8001` |
| `n8n` | `n8n:5678` | `5678` |
| `frontend` | `frontend:80` | `5173` |

Todos en la red `hotel_network` (bridge). Los servicios se comunican por nombre de contenedor. El backend recibe `IA_SERVICE_URL=http://ia-service:8001` en su env Docker; en desarrollo local usa `http://localhost:8001`.

**n8n persistence**: usa `n8n_db` (base de datos separada en el mismo postgres, creada por `docker/postgres/init.sql`). Así n8n no comparte schema con la app.

---

## Autenticación y seguridad

| Decisión | Detalle |
|---|---|
| JWT | HS256, expiración 8h, payload: `{ sub, email, rol }` |
| RBAC | 5 roles: ADMIN, GERENTE, RECEPCIONISTA, HOUSEKEEPING, MANTENIMIENTO |
| Rate limiting | Redis `INCR` + `EXPIRE`; login: 5 intentos/15 min por IP |
| Webhooks externos | HMAC-SHA256 verificado contra `req.rawBody` antes de cualquier procesamiento |
| Idempotency keys | Campo `unique` en `CanalSyncLog` y `Reserva`; evita doble procesamiento de webhooks duplicados |
| Contraseñas | `bcrypt` con salt 10 rondas. El cierre de turno verifica la contraseña del recepcionista como firma del arqueo |
| Service-to-service | Header `X-Service-Token` (token fijo); usado por `ai-service` y `n8n` para llamar a `/api/v1/internal/` |

---

## AI Service

- Python 3.11 + FastAPI
- Prophet 1.1.5 + cmdstanpy 1.3.0
- **Workaround Prophet**: el Dockerfile debe crear un makefile vacío en `bundled/cmdstan-2.33.1/` porque el instalador de cmdstanpy busca ese archivo. Ver [[feedback_prophet_cmdstanpy]].
- Claude (Anthropic API) para el concierge Aria
- Falla gracefully: si el ai-service no responde en 2s, el backend usa la tarifa base de Redis como fallback

---

## Frontend

| Decisión | Elección |
|---|---|
| Framework | React 19 + Vite 5.4 |
| CSS | Tailwind CSS 4.x (Vite plugin) |
| Estado servidor | TanStack Query v5 (polling + invalidation) |
| Routing | React Router v7 |
| HTTP | Axios con interceptor JWT + redirect 401 |
| Tiempo real | Socket.IO client (mismo servidor Express) |
| Gráficos | Recharts |
| Tipos | TypeScript 6.x |
| Bundle | SPA estática servida por nginx en Docker |
