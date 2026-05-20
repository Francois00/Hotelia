---
tags: [decisiones, adr, prisma, docker, windows]
fecha: 2026-05-20
estado: ✅ completo
---

# ADR-003 — Prisma sin migrate deploy en Windows + Docker

> Ver también: [[stack-decisiones]], [[adr-001-postgresql-redis]]

---

## Estado

Adoptado — workaround activo, todas las migraciones aplicadas manualmente.

---

## Contexto

El proyecto se desarrolla en Windows con Docker Desktop. Prisma 5.x incluye un binario nativo de Node.js llamado `schema-engine-windows.exe` que se encarga de ejecutar las migraciones cuando se corre `prisma migrate deploy` o `prisma migrate dev` desde el host Windows.

---

## Problema

Cuando PostgreSQL corre dentro de Docker Desktop y el comando `prisma migrate deploy` se ejecuta desde PowerShell en el host Windows:

1. `schema-engine-windows.exe` intenta conectarse usando la `DATABASE_URL` que apunta a `localhost:5432`.
2. Docker Desktop en Windows usa NAT, y el puerto 5432 está expuesto correctamente — sin embargo, el binario de Prisma engine falla con errores de conexión intermitentes o simplemente cuelga.
3. El error más frecuente: `P3000: Failed to create database: ...` o un timeout silencioso que deja la tabla `_prisma_migrations` en estado inconsistente.

**Reproducible en**: Windows 10/11 con Docker Desktop (wsl2 backend).
**No afecta**: entornos Linux/Mac donde el binario nativo es diferente.

---

## Decisión

No usar `prisma migrate deploy` ni `prisma migrate dev` desde el host Windows.

**Workflow adoptado para nuevas migraciones**:

```bash
# Paso 1: Generar el SQL de la migración (solo genera, no aplica)
npx prisma migrate diff \
  --from-schema-datasource \
  --to-schema-datamodel prisma/schema.prisma \
  --script > migration.sql

# Paso 2: Aplicar directamente con psql dentro del contenedor Docker
docker exec -i hotel_db psql -U hotel_user -d hotel_db < migration.sql

# Paso 3: Generar el cliente Prisma (tipos TypeScript)
npx prisma generate
```

**Nota**: las migraciones se guardan manualmente en `backend/prisma/migrations/` con timestamp YYYYMMDDHHMMSS y nombre descriptivo.

---

## Consecuencias

**Positivas**:
- Las migraciones funcionan correctamente — el SQL puro llega directo a Postgres via el CLI dentro del contenedor, sin el overhead del binario de Prisma engine.
- El cliente Prisma (`@prisma/client`) se genera normalmente con `prisma generate` y funciona sin problemas.
- Los tipos TypeScript generados son idénticos a los que generaría `prisma migrate dev`.

**Negativas**:
- La tabla `_prisma_migrations` de Prisma **no se actualiza** — Prisma no tiene registro de qué migraciones se aplicaron.
- `prisma migrate status` siempre reportará las migraciones como "not applied" aunque estén en la BD.
- No se puede usar `prisma migrate reset` para CI/CD en Windows.
- Proceso manual — requiere disciplina para nombrar y ordenar las migraciones correctamente.

---

## Alternativas descartadas

1. **Correr `prisma migrate deploy` dentro del contenedor backend**: requeriría que `prisma` CLI esté instalado en la imagen Docker de producción, aumentando su tamaño significativamente (~200MB de binarios de engines).

2. **Usar WSL2 para ejecutar los comandos**: añade complejidad al workflow de desarrollo; no todos los miembros del equipo tienen WSL2 configurado.

3. **Migrar a Flyway o Liquibase**: cambio de herramienta completo, pérdida del auto-generación de tipos TypeScript de Prisma.

4. **Usar solo Docker para desarrollo** (nunca desde el host): el hot-reload de `ts-node` funciona mejor corriendo localmente que dentro de un contenedor en Windows.

---

## Nota sobre OpenSSL Alpine

Relacionado con este ADR: el Dockerfile del backend usa `node:20-alpine` que incluye OpenSSL 3.x (musl). El cliente Prisma generado en el host Windows usa OpenSSL diferente.

Solución en `schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

Esto descarga el binario correcto para Alpine durante `docker build`, sin afectar el desarrollo local.
