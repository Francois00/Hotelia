# ============================================================
# setup-hotel-proyecto.ps1
# Ejecutar como Administrador desde PowerShell:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup-hotel-proyecto.ps1
# ============================================================

$root = "C:\Hotel-Proyecto"

# ---- CARPETAS -----------------------------------------------
$folders = @(
    "$root\backend",
    "$root\frontend",
    "$root\ai-service",
    "$root\n8n-flows",
    "$root\docker",
    "$root\tests",
    "$root\scripts",
    "$root\docs\obsidian-vault\arquitectura",
    "$root\docs\obsidian-vault\api",
    "$root\docs\obsidian-vault\base-de-datos",
    "$root\docs\obsidian-vault\flujos-n8n",
    "$root\docs\obsidian-vault\decisiones",
    "$root\.claude\skills"
)
foreach ($f in $folders) {
    New-Item -ItemType Directory -Force -Path $f | Out-Null
    Write-Host "OK  $f"
}

# ---- CLAUDE.md -----------------------------------------------
Set-Content -Path "$root\CLAUDE.md" -Encoding UTF8 -Value @'
# CLAUDE.md — Hotel Management System
## Contexto del proyecto
PMS propio con capa de IA. Stack: Node.js + TypeScript (backend), Python 3.11 + FastAPI (AI service), React + Vite + Tailwind (frontend), PostgreSQL 15, Redis, n8n self-hosted, Docker Compose.
## Regla crítica de división de trabajo
- CLAUDE CODE maneja: backend/, ai-service/, n8n-flows/, docker/, base de datos, integraciones externas (Booking.com, Expedia, SUNAT, Niubiz, WhatsApp), lógica de negocio
- CODEX maneja: frontend/ únicamente — componentes React, UI, Tailwind, dashboard visual
- NUNCA mezclar: no generar código de backend dentro de frontend ni viceversa
## PostgreSQL es la fuente de verdad
- Redis es solo cache — nunca fuente primaria
- Toda operación de reserva debe ser atómica (BEGIN / COMMIT / ROLLBACK explícito)
- Usar FOR UPDATE NOWAIT en queries de disponibilidad para prevenir overbooking
- No doble booking permitido bajo ninguna circunstancia
## Convenciones de código
- TypeScript estricto (strict: true) en todo el backend
- Manejo de errores: siempre try/catch con logging estructurado
- Variables de entorno: nunca hardcodear credenciales, siempre .env
- Nombres en español para entidades del dominio (reserva, huesped, habitacion, folio)
- Nombres en inglés para código técnico (controller, service, middleware)
## Integraciones externas
- Todo webhook externo debe validar firma HMAC antes de procesar
- Toda llamada externa requiere retry con backoff exponencial (3 intentos)
- Webhooks pueden llegar duplicados — implementar idempotency key
- Si el AI service falla, el backend sigue funcionando con última tarifa en Redis
## Subagentes en Claude Code
- [database-engineer]: migraciones, índices, queries PostgreSQL
- [backend-engineer]: endpoints REST, JWT, RBAC
- [ai-engineer]: pricing Python, Prophet, NLP
- [n8n-engineer]: flujos de automatización
- [devops-engineer]: Docker, scripts
- [integrations-engineer]: Booking.com, SUNAT, Niubiz, WhatsApp
- [security-engineer]: JWT, pgcrypto, validaciones
## Skills activas
- .claude/skills/backend-pms.md
- .claude/skills/database.md
- .claude/skills/n8n.md
- .claude/skills/integrations.md
- .claude/skills/security.md
- .claude/skills/ai-service.md
## Obsidian vault
Documentación en docs/obsidian-vault/. Después de cada módulo, crear nota con: decisión tomada, por qué, alternativas descartadas.
## Codex — frontend solamente
El frontend/ es territorio exclusivo de Codex. Claude Code no toca esa carpeta salvo para leer contratos de API.
'@

# ---- SKILLS --------------------------------------------------
Set-Content -Path "$root\.claude\skills\backend-pms.md" -Encoding UTF8 -Value @'
# Skill: Backend PMS
## Reglas de disponibilidad
- Siempre verificar disponibilidad con SELECT ... FOR UPDATE NOWAIT
- Bloquear en Redis (SET NX EX 30) antes del INSERT de reserva
- Liberar lock Redis en el FINALLY del try/catch
- Si NOWAIT lanza error, retornar 409 HABITACION_OCUPADA
## Ciclo de vida de reserva
Estados válidos: confirmada → checkin_realizado → checkout_realizado → cancelada
Transiciones inválidas deben lanzar error TRANSICION_INVALIDA
## Folio
- Un folio_item por noche de habitación
- Cargos adicionales como folio_items separados
- Total del folio calculado en runtime, nunca guardado desnormalizado
## Errores estándar
- HABITACION_NO_DISPONIBLE: 409
- RESERVA_NO_ENCONTRADA: 404
- TRANSICION_INVALIDA: 422
- LOCK_TIMEOUT: 503
'@

Set-Content -Path "$root\.claude\skills\database.md" -Encoding UTF8 -Value @'
# Skill: PostgreSQL Avanzado
## Extensiones requeridas
- pgcrypto: gen_random_uuid(), crypt()
- btree_gist: índices de exclusión por rango de fechas
- pg_trgm: búsqueda fuzzy de huéspedes
## Índice anti-overbooking
CREATE EXTENSION btree_gist;
ALTER TABLE reservas ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    habitacion_id WITH =,
    daterange(fecha_entrada, fecha_salida, '[)') WITH &&
  )
  WHERE (estado NOT IN ('cancelada', 'no_show'));
## Convenciones de índices
- idx_{tabla}_{columna} para índices simples
- idx_{tabla}_{col1}_{col2} para compuestos
- Siempre indexar: FK columns, campos de búsqueda, campos de estado
## Transacciones
- Siempre BEGIN explícito para operaciones multi-tabla
- COMMIT solo si todas las operaciones son exitosas
- ROLLBACK en catch, luego lanzar error al controller
'@

Set-Content -Path "$root\.claude\skills\n8n.md" -Encoding UTF8 -Value @'
# Skill: n8n Automatización
## Flujos existentes en n8n-flows/
1. checkin_automatico.json — trigger: 2h antes de llegada
2. checkout_automatico.json — trigger: 8am día de salida
3. encuesta_post_estancia.json — trigger: 24h post checkout
4. alerta_mantenimiento.json — trigger: habitación supera umbral de noches
5. limpieza_trigger.json — trigger: checkout registrado
## Eventos que emite el backend hacia n8n
reserva_creada, checkin_realizado, checkout_realizado, mantenimiento_requerido, limpieza_requerida
Todos via POST con header X-N8N-SECRET validado en n8n.
## Seguridad
Validar X-N8N-SECRET siempre. Secret en variable N8N_WEBHOOK_SECRET.
'@

Set-Content -Path "$root\.claude\skills\integrations.md" -Encoding UTF8 -Value @'
# Skill: Integraciones Externas
## Booking.com / Expedia
- Webhooks en XML — parsear con xml2js
- Validar firma HMAC-SHA256 con header X-Booking-Signature
- Idempotency: guardar booking_external_id en canal_sync_log
- Flujo: crear reserva local → bloquear Redis → notificar demás canales
## SUNAT (Perú)
- Formato: UBL 2.1 XML firmado con certificado .pfx
- Boleta para DNI/extranjero, Factura para RUC
- Endpoint beta: https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService
- Guardar CDR en tabla pagos siempre
## Niubiz
- Auth: Basic Auth con merchantId + apiKey
- POST /api.json para generar sessionkey
- Tokenizar tarjeta — nunca guardar datos de tarjeta en DB
## WhatsApp Business API
- Verificar webhook con hub.verify_token en GET /webhook
- Templates: confirmacion_reserva, recordatorio_checkin, encuesta_nps
- Rate limit: 80 mensajes/segundo por número
'@

Set-Content -Path "$root\.claude\skills\security.md" -Encoding UTF8 -Value @'
# Skill: Seguridad
## JWT
- Secret mínimo 64 caracteres en JWT_SECRET
- Expiración: 8 horas
- Payload: { id, email, rol, iat, exp } — sin datos sensibles
## RBAC por rol
- gerente: acceso total
- recepcionista: reservas, check-in, check-out, folio, pagos
- housekeeping: solo PATCH /habitaciones/:id/estado
- mantenimiento: solo órdenes de trabajo
## Passwords
- bcrypt cost factor 12
- Nunca loguear passwords ni tokens
## Rate limiting
- /auth/login: 5 intentos por IP cada 15 minutos
- API general: 100 requests/minuto por usuario
- Webhooks externos: sin límite pero validar firma siempre
'@

Set-Content -Path "$root\.claude\skills\ai-service.md" -Encoding UTF8 -Value @'
# Skill: AI Service Python
## Comunicación backend → AI service
- HTTP interno: POST http://ai-service:8001/
- Timeout: 3 segundos — si falla, usar tarifa fallback de Redis
- El backend nunca bloquea una reserva esperando al AI service
## Endpoints
- POST /pricing/calcular — body: {habitacion_id, fecha, canal, ocupacion_actual}
- GET /forecast/ocupacion — query: ?dias=30|60|90
- POST /reviews/analizar — body: {texto, fuente}
- GET /housekeeping/ruta — query: ?fecha=YYYY-MM-DD
## Fallback de pricing
1. Intentar AI service
2. Si falla: Redis key pricing:{habitacion_tipo}:{temporada}
3. Si falla: tarifa_base de tabla habitaciones
## Modelos
- Pricing: scikit-learn GradientBoostingRegressor
- Forecast: Prophet con seasonality_mode='multiplicative'
- NLP: pysentimiento/robertuito-sentiment-analysis
'@

# ---- OBSIDIAN VAULT ------------------------------------------
Set-Content -Path "$root\docs\obsidian-vault\arquitectura\sistema-overview.md" -Encoding UTF8 -Value @'
---
fecha: 2025
estado: borrador
resumen: Los 3 servicios del sistema y cómo se comunican entre sí
---
# Sistema Overview
## Servicios
- Backend Node.js (puerto 3000): lógica de negocio, reservas, facturación, CRM
- AI Service Python (puerto 8001): pricing, forecast, NLP, housekeeping
- Frontend React (puerto 5173): dashboard, mapa de habitaciones, CRM visual
## Infraestructura
- PostgreSQL 15: fuente de verdad
- Redis: cache de disponibilidad y sesiones
- n8n self-hosted: automatización de flujos operativos
- Docker Compose: orquestación
'@

Set-Content -Path "$root\docs\obsidian-vault\arquitectura\division-trabajo.md" -Encoding UTF8 -Value @'
---
fecha: 2025
estado: final
resumen: Qué construye Claude Code vs qué construye Codex
---
# División de Trabajo entre Agentes
## Claude Code
Todo excepto el frontend: backend, AI service, Docker, n8n flows, integraciones, base de datos.
## Codex
Exclusivamente frontend/: componentes React, UI con Tailwind, dashboard visual, gráficos.
## Regla
Los dos agentes nunca tocan los mismos archivos. La interfaz entre ellos son los contratos de API documentados en docs/obsidian-vault/api/.
'@

Set-Content -Path "$root\docs\obsidian-vault\decisiones\adr-001-postgresql-redis.md" -Encoding UTF8 -Value @'
---
fecha: 2025
estado: final
resumen: PostgreSQL es fuente de verdad, Redis es solo cache
---
# ADR-001: PostgreSQL como fuente de verdad
## Decisión
PostgreSQL 15 es el único sistema de verdad. Redis solo acelera lecturas.
## Por qué
Las operaciones de reserva requieren ACID completo y constraints de exclusión (no_double_booking). Redis no garantiza consistencia suficiente para operaciones financieras.
## Consecuencia
Toda escritura va a PostgreSQL primero. Redis se actualiza después o se invalida. Si Redis y PostgreSQL difieren, PostgreSQL gana siempre.
'@

Set-Content -Path "$root\docs\obsidian-vault\decisiones\adr-002-microservicio-python.md" -Encoding UTF8 -Value @'
---
fecha: 2025
estado: final
resumen: El AI service es un microservicio Python separado del backend Node.js
---
# ADR-002: AI Service como microservicio Python
## Decisión
Prophet, scikit-learn y transformers corren en un proceso Python separado en el puerto 8001.
## Por qué
No hay equivalente maduro de Prophet o transformers en Node.js. Separar permite escalar el servicio de IA de forma independiente y actualizar modelos sin afectar el backend.
## Consecuencia
Si el AI service cae, el backend sigue funcionando con la última tarifa guardada en Redis. Las llamadas al AI service tienen timeout de 3 segundos.
'@

# ---- .env.example --------------------------------------------
Set-Content -Path "$root\.env.example" -Encoding UTF8 -Value @'
# Base de datos
DATABASE_URL=postgresql://usuario:password@localhost:5432/hotel_db
# Redis
REDIS_URL=redis://localhost:6379/0
# JWT
JWT_SECRET=cadena-aleatoria-minimo-64-caracteres
# WhatsApp Business API (Meta)
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
# Niubiz (pagos Perú)
NIUBIZ_MERCHANT_ID=
NIUBIZ_API_KEY=
# Stripe (pagos internacional)
STRIPE_SECRET_KEY=
# SUNAT (facturación electrónica)
SUNAT_RUC=
SUNAT_USUARIO_SOL=
SUNAT_CLAVE_SOL=
SUNAT_CERT_PATH=
SUNAT_CERT_PASSWORD=
SUNAT_MODO=beta
# AI Service
IA_SERVICE_URL=http://localhost:8001
# n8n
N8N_WEBHOOK_SECRET=token-secreto-compartido
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=
# Anthropic (chatbot concierge)
ANTHROPIC_API_KEY=
# Revenue management
TARIFA_MINIMA_SIMPLE=80
TARIFA_MINIMA_DOBLE=120
TARIFA_MINIMA_SUITE=200
MAX_INCREMENTO_TARIFA_PCT=150
OCUPACION_UMBRAL_ALTO=75
# CRM
LTV_UMBRAL_VIP=2000
MESES_INACTIVIDAD_REACTIVAR=18
'@

# ---- .gitignore ----------------------------------------------
Set-Content -Path "$root\.gitignore" -Encoding UTF8 -Value @'
.env
node_modules/
__pycache__/
*.pyc
venv/
dist/
build/
*.log
.DS_Store
'@

Write-Host ""
Write-Host "============================================="
Write-Host " Hotel-Proyecto creado exitosamente en $root"
Write-Host "============================================="
Get-ChildItem -Path $root -Recurse | Select-Object FullName
