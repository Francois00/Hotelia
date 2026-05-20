# Estado del Proyecto Hotelia

**Última actualización:** 2026-05-20 (sprint 2)

---

## Estado general

El proyecto está en **Fase de consolidación**: el backend (API REST completa), el frontend (React SPA) y el ai-service (Python/FastAPI) están implementados y conectados. Los módulos 01, 03 y 07 fueron completados en el último sprint. Faltan tests del ia-service, integración real de pagos (Niubiz/Stripe en producción), emisión real de comprobantes SUNAT y los módulos 04-12 del roadmap.

---

## Módulos y su estado

| Módulo | Descripción | Backend | Frontend | Tests | Estado general |
|--------|-------------|---------|----------|-------|----------------|
| M01 | Check-in Manual + RENIEC | ✅ | ✅ | ✅ | ✅ Completo |
| M01+ | Modificar / Anular registro + bitácora | ✅ | ✅ | ⬜ | ✅ Completo |
| M02 | Notificaciones WhatsApp | ✅ | N/A | ⬜ | 🔄 En progreso |
| M03 | Turno de Caja / Reporte | ✅ | ✅ | ✅ | ✅ Completo |
| M04 | Historial mejorado huéspedes | ✅ | 🔄 | ⬜ | 🔄 En progreso |
| M05 | Mantenimiento por habitación | ✅ | 🔄 | ⬜ | 🔄 En progreso |
| M06 | Concierge IA + WPP | ✅ | ✅ | ⬜ | 🔄 En progreso |
| M07 | Gestión de habitaciones | ✅ | ✅ | ✅ | ✅ Completo |
| M07+ | Baja lógica habitaciones (frontend) | ✅ | ✅ | ⬜ | ✅ Completo |
| M08 | Multi-sede | ⬜ | ⬜ | ⬜ | ⬜ Pendiente |
| M09 | Channel Manager (OTA) | ✅ | ⬜ | ⬜ | 🔄 En progreso |
| M10 | Almacén e Inventario | ⬜ | ⬜ | ⬜ | ⬜ Pendiente |
| M11 | Control de accesos por rol | ✅ | ✅ | ⬜ | ✅ Completo |
| M11+ | useRol() hook + menú dinámico Sidebar | ✅ | ✅ | ⬜ | ✅ Completo |
| M12 | Confort del huésped | ⬜ | ⬜ | ⬜ | ⬜ Pendiente |
| — | Dashboard / Revenue | ✅ | ✅ | ⬜ | ✅ Completo |
| — | Checkout Wizard | ✅ | ✅ | ⬜ | ✅ Completo |
| — | Reservas CRUD + tabs + modales | ✅ | ✅ | ⬜ | ✅ Completo |
| — | CRM / Segmentación | ✅ | ✅ | ⬜ | ✅ Completo |
| — | QR Check-in | ✅ | ✅ | ⬜ | ✅ Completo |
| — | Comprobantes SUNAT | ✅ | ⬜ | ⬜ | 🔄 En progreso |
| — | Pagos Niubiz/Stripe | ✅ | ⬜ | ⬜ | 🔄 En progreso |
| — | n8n Automatización | ✅ | N/A | ⬜ | 🔄 En progreso |

---

## Qué está completo

- **Backend API**: 20+ rutas, 65+ endpoints bajo `/api/v1/`, con JWT, RBAC, rate limiting, HMAC en webhooks
- **Base de datos**: 19 tablas (+ `audit_log`), 12 migraciones aplicadas, constraint GIST anti-overbooking, extensiones pgcrypto/btree_gist/pg_trgm
- **Check-in Manual (M01)**: wizard completo con Redis lock + `FOR UPDATE NOWAIT`, fuego-y-olvida a SUNAT/WhatsApp/n8n
- **Modificar/Anular Reservas**: `PATCH /reservas/:id/modificar` con audit log, `DELETE /reservas/:id` (soft delete CANCELADA); campo tarifa bloqueado para RECEPCIONISTA; `GET /reservas/:id/auditoria` solo GERENTE
- **Turno de Caja (M03)**: apertura/cierre con bcrypt PIN, SHA256 firma_hash, resumen en tiempo real, PDF con PDFKit
- **Gestión de Habitaciones (M07)**: CRUD completo, fotos, tipos custom, reglas de temporada, tarifa sugerida via ia-service, botón "Dar de baja" en lista con modal de confirmación
- **Checkout Wizard**: wizard 3 pasos (folio + cargos, pagos multi-método, comprobante BOLETA/FACTURA), modal éxito con impresión; botón [Checkout] en tabla Reservas para estado CHECKIN_REALIZADO
- **Frontend SPA**: Login, Dashboard (KPIs + forecast), Habitaciones (con baja), Reservas (tabs Activos/Todos/Histórico + Modificar/Anular), Check-in Manual, Turno Activo, Historial Turnos, Revenue, CRM, Concierge IA, Checkout Wizard
- **useRol() hook**: hook React que lee el rol del JWT y expone flags `isGerente`, `isRecepcionista`, `isHousekeeping`, `isMantenimiento`, `canModificarPrecio`
- **Sidebar por rol (M11)**: menú dinámico con `useRol()` — HOUSEKEEPING/MANTENIMIENTO ven solo Habitaciones; Reservas y Turno solo para recepción+; Revenue/CRM solo para gerente
- **AI Service**: FastAPI con 7 routers — forecast (Prophet), pricing dinámico, CRM/segmentación, housekeeping, alertas, reviews NLP, concierge (Claude Anthropic)
- **n8n Flows**: 5 flujos JSON listos para importar (checkin, checkout, encuesta, alerta mantenimiento, segmentación semanal)
- **Docker Compose**: stack completo con 6 servicios (db, redis, n8n, backend, ia-service, frontend) en red `hotel_network`
- **Tests unitarios backend**: 3 archivos (checkin.mod01, turnos.mod03, habitaciones.mod07) con Vitest + mocks de Prisma/Redis

---

## Qué está en progreso

- **WhatsApp M02**: el service y webhook están implementados; el flujo n8n de grupo/notificación grupal no está completo
- **Comprobantes SUNAT**: servicio implementado en modo beta; no hay UI frontend para listar/consultar comprobantes
- **Pagos Niubiz/Stripe**: services completos; no hay pantalla frontend de flujo de pago independiente (solo integrado en check-in)
- **Channel Manager (M09)**: webhook HMAC + normalizador Booking.com/Expedia/Airbnb implementado; falta UI de canal sync log
- **ConciergeIA (M06)**: página frontend básica lista; no hay historial de conversaciones persistente en UI; WhatsApp bidireccional implementado a nivel de route pero sin UI de gestión

---

## Qué falta implementar

- **M04 Historial mejorado**: timeline de estancias anterior de un huésped (datos en BD, falta UI dedicada)
- **M05 Mantenimiento**: alertas existen en backend + ia-service predictor de fallos; falta página frontend de gestión de alertas
- **M08 Multi-sede**: no iniciado; requeriría campo `sede_id` en todas las tablas y RBAC por sede
- **M10 Almacén e Inventario**: no iniciado; requeriría nuevas tablas (`productos`, `movimientos_stock`)
- **M12 Confort del huésped**: no iniciado; requeriría portal huésped separado
- **Tests del ia-service**: ningún test Python implementado
- **Tests E2E**: no hay Playwright/Cypress configurado
- **Pantalla de comprobantes SUNAT**: frontend lista/detalle
- **Pantalla de pagos independiente**: flujo Niubiz fuera del wizard de check-in
- **Pantalla de canal sync log**: historial de webhooks OTA recibidos
- **Frontend para alertas de mantenimiento**: página dedicada para HOUSEKEEPING/MANTENIMIENTO

---

## Errores detectados

| Archivo | Causa probable | Solución sugerida |
|---------|---------------|-------------------|
| `backend/src/routes/whatsapp.ts` | El flujo de concierge usa `checkin_bienvenida` como template proxy para respuestas — solo funciona en ventana 24h | Usar Meta free-form text endpoint o template específico de respuesta |
| `docker-compose.yml` | `N8N_ENCRYPTION_KEY` tiene valor por defecto hardcodeado `change_me_n8n_encryption_key_32chars` | Forzar variable de entorno sin default o validar en startup |
| `.gitignore` raíz | Solo excluye `.env` singular, no cubre `.env.local`, `.env.production`, `.env.prod` | Ampliar con patrón `.env.*` |
| `backend/.env` | Existe un `.env` real en `backend/` (no solo `.env.example`) con credenciales reales potenciales | Verificar que no tenga credenciales reales antes de commit |
| `ia-service/.env` | Mismo riesgo que el anterior | Verificar antes de push |
| `frontend/.env` | Mismo riesgo | Verificar antes de push |
| `backend/src/services/turnos.service.ts` | `calcularResumenTurno` filtra por `created_at >= horaApertura` en pagos — si un pago se procesa fuera del turno activo queda fuera del resumen | Considerar asociar turno_id a pagos directamente |
| `scripts/deploy.sh` | No verificado si funciona con el docker-compose actual | Revisar antes de producción |

---

## Riesgos técnicos

1. **Credenciales reales en archivos .env**: Existen `backend/.env`, `ia-service/.env` y `frontend/.env`. Si alguno tiene credenciales reales (JWT_SECRET, API keys de Meta, Anthropic, SUNAT) y se sube al repo, son comprometidas de forma permanente.

2. **Prisma migration apply manual**: El workaround de `migrate diff → psql pipe` no es automatizable en CI/CD. Si alguien ejecuta `prisma migrate deploy` en el host Windows, el schema-engine falla silenciosamente. Riesgo de drift entre schema.prisma y la BD en producción.

3. **Prophet en ia-service sin tests**: El motor de forecast usa Prophet 1.1.5 + cmdstanpy con un workaround de makefile vacío. Si el modelo no tiene suficientes datos históricos (mínimo recomendado: 2 temporadas), las predicciones serán inválidas sin error explícito — el sistema simplemente devolverá extrapolaciones sin sentido.

4. **WhatsApp concierge usa template como proxy de respuesta libre**: El sistema responde mensajes de huéspedes usando el template `checkin_bienvenida` reutilizado. Esto viola las políticas de Meta para templates y puede causar suspensión del WABA.

5. **n8n con token por defecto**: `SERVICE_TOKEN: change_me_backend_token_dev` en docker-compose.yml. Si se despliega sin cambiar esta variable, cualquier persona puede llamar a `/api/v1/internal/` sin autenticación real.

---

## Últimos cambios detectados

_No hay git history disponible — el repositorio no estaba inicializado al momento de la auditoría._

Orden probable de implementación según las migraciones:
1. `20260506000000_init` — tablas core (personal, habitaciones, huespedes, reservas, pagos, folio_items, canal_sync_log, reviews, tarifas_historial, campanas_crm)
2. `20260507000000` a `20260507000008` — extensiones incrementales (FUERA_DE_SERVICIO, RESERVADA, Airbnb, reviews NLP, alertas, concierge, comprobantes, QR check-in)
3. `20260519000000_mod07_01_03` — Módulos 07, 01 y 03: tipos_habitacion, reglas_temporada, turnos, gastos_caja, reporte_turno_cache

---

## Próximos pasos recomendados (en orden de prioridad)

1. **[SEGURIDAD CRÍTICA]** Verificar que `backend/.env`, `ia-service/.env` y `frontend/.env` no contienen credenciales reales antes de hacer cualquier push. Agregar `.env.*` al `.gitignore` raíz.

2. **[SEGURIDAD ALTA]** Cambiar el `N8N_ENCRYPTION_KEY` y `BACKEND_SERVICE_TOKEN` por defecto en `docker-compose.yml` antes de deploy.

3. ~~**[FUNCIONALIDAD]** Implementar checkout wizard en frontend~~ ✅ Completado 2026-05-20

4. **[FUNCIONALIDAD]** Crear página frontend de alertas de mantenimiento para roles HOUSEKEEPING y MANTENIMIENTO.

5. **[FUNCIONALIDAD]** Crear página frontend de canal sync log (channel manager) para GERENTE/ADMIN.

6. **[CALIDAD]** Ejecutar y hacer pasar los 3 test suites del backend (`pnpm test` en `/backend`).

7. **[CALIDAD]** Agregar tests Python para el ia-service (pytest + FastAPI TestClient).

8. **[INTEGRACIÓN]** Completar configuración SUNAT modo producción (certificado `.pfx`, credenciales SOL reales).

9. **[OPERACIONES]** Configurar CI/CD (GitHub Actions) con: typecheck, lint, test, docker build.

10. **[ROADMAP]** Comenzar M04 (historial huéspedes) — los datos ya están en BD, solo falta UI.
