---
tags: [operacion, setup, deploy, comandos]
fecha: 2026-06-16
estado: ✅ completo
---

# Iniciar el sistema — Guía paso a paso

> Ver también: [[docker-compose]], [[webhook-whatsapp]], [[credenciales]]

---

## Requisitos previos

| Herramienta | Versión mínima | Notas |
|-------------|---------------|-------|
| Docker Desktop | 4.x | Con Docker Compose v2 incluido |
| Node.js | 18+ | Solo para desarrollo local fuera de Docker |
| Git | cualquiera | Para clonar el repo |
| Ollama | última | Para el concierge IA con Llama3 |

### Instalar Ollama y descargar el modelo
```bash
# Instalar Ollama (Windows: descargar instalador de https://ollama.com)
# Luego descargar el modelo:
ollama pull llama3
# Verificar que corre:
curl http://localhost:11434/api/tags
```

---

## Levantar desde cero

```bash
# 1. Clonar el repositorio
git clone https://github.com/Francois00/Hotelia.git
cd Hotelia

# 2. Crear archivo de variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con las credenciales reales (ver docs/obsidian-vault/usuarios/credenciales.md)

# 3. Levantar todos los servicios
docker compose up -d

# 4. Esperar a que los servicios estén healthy (aprox. 15-20s)
sleep 15
docker compose ps

# Resultado esperado: todos en estado "healthy" o "running"
# NAME                STATUS
# hotel_backend       running
# hotel_db            healthy
# hotel_frontend      running
# hotel_ia_service    running
# hotel_n8n           running
# hotel_redis         healthy
```

---

## Cargar datos iniciales (seed)

```bash
# Cargar habitaciones, personal y datos de prueba
psql $DATABASE_URL -f seed_hotelia.sql

# O dentro de Docker:
docker compose exec db psql -U $DB_USER hotel_db -f /docker-entrypoint-initdb.d/seed_hotelia.sql
```

---

## Verificar funcionamiento

```bash
# 1. Health check del backend
curl http://localhost:3000/api/v1/health
# Esperado: {"status":"ok","db":"connected","redis":"connected"}

# 2. Login con gerente
curl http://localhost:3000/api/v1/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"gerente@hotel.com","password":"Hotel2024!"}'
# Esperado: {"token":"eyJ...","usuario":{...}}

# 3. Health del AI service
curl http://localhost:8001/ia/v1/health
# Esperado: {"status":"ok"}

# 4. Frontend (abrir en navegador)
# http://localhost:5173
```

---

## Aplicar migraciones de BD

> En Windows con Docker Desktop, el workaround estándar es:

```bash
# Verificar estado de migraciones
docker compose exec backend npx prisma migrate status

# Si hay migraciones pendientes — aplicar via psql pipe
docker compose exec backend npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script \
  | docker compose exec -T db psql -U $DB_USER hotel_db
```

---

## Activar webhook WhatsApp

Ver [[webhook-whatsapp]] para instrucciones completas.

```bash
# Exponer el backend públicamente con localtunnel
npx lt --port 3000 --subdomain hotelia-webhook
# URL: https://hotelia-webhook.loca.lt
```

---

## Importar workflows en n8n

1. Abrir http://localhost:5678 (usuario/contraseña del `.env`)
2. Ir a Settings → Import workflow → Upload file
3. Importar cada JSON de `n8n-flows/`:
   - `concierge-wpp-reservas.json`
   - `encuesta-post-estancia.json`
   - `checkin_automatico.json`
   - `checkout_automatico.json`
   - `alerta_mantenimiento.json`
   - `segmentacion_semanal.json`
4. Activar cada workflow con el toggle "Active"

---

## Solución de problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| Backend no arranca | DB no está healthy | `docker compose logs db` — verificar credenciales en `.env` |
| "Cannot connect to Redis" | Redis no inició | `docker compose restart redis && docker compose restart backend` |
| Concierge IA no responde | Ollama no está corriendo | `ollama serve` en terminal separada |
| Migración falla en Windows | schema-engine bug | Usar el workaround de `migrate diff \| psql` |
| n8n workflows no se activan | Token cambiado | Verificar `BACKEND_SERVICE_TOKEN` en `.env` y en `docker-compose.yml` |
| Frontend 502 Bad Gateway | Backend caído | `docker compose logs backend` y revisar errores |
