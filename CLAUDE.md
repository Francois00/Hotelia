# CLAUDE.md — Hotel Management System
## Contexto del proyecto
PMS propio con capa de IA. Stack: Node.js + TypeScript (backend), Python 3.11 + FastAPI (AI service), React + Vite + Tailwind (frontend), PostgreSQL 15, Redis, n8n self-hosted, Docker Compose.
## Regla crítica de división de trabajo
- CLAUDE CODE maneja: backend/, ai-service/, n8n-flows/, docker/, base de datos, integraciones externas (Booking.com, Expedia, SUNAT, Niubiz, WhatsApp), lógica de negocio
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

