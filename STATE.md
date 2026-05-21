# Estado del Proyecto Hotelia

**Última actualización:** 2026-05-21 (M10 + Encuesta + Solicitudes)

---

## Estado general

El proyecto está en **Fase de consolidación**: el backend (API REST completa), el frontend (React SPA) y el ai-service (Python/FastAPI) están implementados y conectados. Los módulos 01, 03 y 07 fueron completados en el último sprint. Faltan tests del ia-service, integración real de pagos (Niubiz/Stripe en producción), emisión real de comprobantes SUNAT y los módulos 04-12 del roadmap.

---

## Módulos y su estado

| Módulo | Descripción | Backend | Frontend | Tests | Estado general |
|--------|-------------|---------|----------|-------|----------------|
| M01 | Check-in Manual + RENIEC | ✅ | ✅ | ✅ | ✅ Completo |
| M01+ | Modificar / Anular registro + bitácora | ✅ | ✅ | ⬜ | ✅ Completo |
| M02 | Notificaciones WhatsApp | ✅ | ✅ | ⬜ | ✅ Completo |
| M03 | Turno de Caja / Reporte | ✅ | ✅ | ✅ | ✅ Completo |
| M04 | Historial mejorado huéspedes | ✅ | ✅ | ⬜ | ✅ Completo |
| M05 | Mantenimiento por habitación | ✅ | ✅ | ⬜ | ✅ Completo |
| M06 | Concierge IA + WPP | ✅ | ✅ | ⬜ | ✅ Completo |
| M07 | Gestión de habitaciones | ✅ | ✅ | ✅ | ✅ Completo |
| M07+ | Baja lógica habitaciones (frontend) | ✅ | ✅ | ⬜ | ✅ Completo |
| M08 | Multi-sede | ⬜ | ⬜ | ⬜ | ⬜ Pendiente |
| M09 | Channel Manager (OTA) | ✅ | ✅ | ⬜ | ✅ Completo |
| M10 | Almacén e Inventario | ✅ | ✅ | ⬜ | ✅ Completo |
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
| — | Encuesta post-estancia | ✅ | N/A | ⬜ | ✅ Completo |
| — | Solicitudes de huéspedes | ✅ | ✅ | ⬜ | ✅ Completo |

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
- **M10 Almacén e Inventario**: 7 tablas DB, 13 endpoints `/api/v1/almacen/*`, `AlmacenPage.tsx` (dashboard cards, tabs categorías, progress bars stock, historial drawer, modales entrada/salida)
- **Solicitudes de huéspedes**: 3 endpoints `/api/v1/solicitudes`, `SolicitudesWidget.tsx` con polling 30s, alerta sonora, integrado en Dashboard
- **Encuesta post-estancia**: endpoints `POST /n8n/programar-encuesta` y `POST /n8n/guardar-encuesta`, flujo n8n `encuesta-post-estancia.json` con Wait 24h

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

- 2026-05-21: M10 Almacén + Encuesta post-estancia + Solicitudes huéspedes completados
  - 5 tablas DB: almacen_categorias (8 rows), almacen_articulos (20 seed), almacen_movimientos, almacen_inventariados, almacen_inventariado_items + encuestas_satisfaccion + solicitudes_huesped
  - Backend: /api/v1/almacen/* (13 endpoints), /api/v1/solicitudes (3 endpoints), n8n encuesta endpoints
  - Frontend: AlmacenPage.tsx (tabs, progress bars, modales), SolicitudesWidget.tsx (polling 30s, alerta sonora), Sidebar actualizado
  - n8n: encuesta-post-estancia.json (Wait 24h + WPP)
- 2026-05-21: Sprint inmediato completado
  - Checkout wizard 3 pasos (folio → cobro → comprobante): `CheckoutPage.tsx` + `ModalCheckoutExitoso.tsx`
  - M05 Mantenimiento: `HabitacionDrawer.tsx` (tabs Info/Mantenimiento/Historial), 3 endpoints, tabla en DB
  - Fix n8n executions "running": `EXECUTIONS_TIMEOUT=60` + restart
- 2026-05-21: Concierge IA vía n8n + Llama3 — flujo completo 7 pasos, reserva WPP-20260521-DNLGLZ confirmada en DB
- 2026-05-20: Fix login (rate limit + password hash)
- 2026-05-20: Fix habitaciones y CRM (parseo de respuesta paginada)
- 2026-05-20: M09 Channel Manager frontend completo (ChannelManagerPage + ModalConfigCanal)
- 2026-05-20: M02 Notificaciones WPP frontend completo (NotificacionesPage con toggles y log)
- 2026-05-20: M04 Historial huéspedes con HuespedDrawer (tabs: Resumen / Historial / Notas)
- 2026-05-20: CRM búsqueda mejorada con debounce 400ms, spinner y mensaje sin resultados

---

## Próximos pasos recomendados (en orden de prioridad)

1. WhatsApp Business número real (para clientes reales en producción)
2. M10 Almacén e Inventario — backend + frontend (nuevas tablas productos/movimientos_stock)
3. Encuesta post-estancia automática (n8n + 24h delay tras checkout)
4. Deploy a servidor con dominio fijo
5. SUNAT en producción (actualmente en modo sandbox)
6. M08 Multi-sede (si la empresa abre otra propiedad)
