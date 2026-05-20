---
tags: [hotel-pms, modulo, channel-manager, booking, expedia, prioridad-critica]
modulo: 9
prioridad: CRÍTICA
tiempo_estimado: 2-3 semanas
estado: completo
fase: 2
---

# Módulo 09 — Channel Manager: Booking, Expedia y WhatsApp

**Backend: ✅ | Frontend: ✅ | Tests: ⬜**

## Estado 2026-05-20

Panel central implementado en `/channel-manager` (solo gerente).

### Pantallas creadas
- `ChannelManagerPage.tsx` — cards de estado por canal con semáforo, placeholder calendario 30 días, acciones rápidas, log de sync
- `ModalConfigCanal.tsx` — formularios por canal (Booking/Expedia/WhatsApp/Web), botón probar conexión

### Endpoints usados
- `GET /api/v1/canales/sync-log` ✅ — log de sincronizaciones
- `POST /api/v1/canales/sync/:canal` ❌ — no existe; UI muestra aviso
- `POST /api/v1/channel-manager/canales/:canal/test` ❌ — no existe; UI captura error gracefully
- Config de credenciales: persiste en localStorage (no hay endpoint backend de config aún)

### Pendiente
- Endpoint backend para guardar/leer credenciales de canal
- Endpoint de sync manual por canal
- Endpoint de disponibilidad por canal (calendario)
- Configurar credenciales reales de Booking.com y Expedia en producción

← [[Modulo 08 - Multi-sede]] | [[INDEX]] | → [[Modulo 10 - Almacen e Inventario]]

> **Prioridad CRÍTICA** — Evita overbooking. Depende de [[Modulo 07 - Gestion de Habitaciones]] y [[Modulo 11 - Control de Accesos por Rol]]

Panel de control para conectar el PMS con canales externos. Permite abrir y cerrar habitaciones en Booking.com y Expedia desde el dashboard.

---

## Canales soportados

| Canal | Protocolo | Flujo | Qué se sincroniza |
|-------|-----------|-------|-------------------|
| Booking.com | API REST + Webhooks | Bidireccional | Disponibilidad, tarifas, restricciones (stop_sell, min_noches, closed_to_arrival) |
| Expedia / VRBO | EPS API + Webhooks | Bidireccional | Disponibilidad, tarifas, políticas cancelación |
| WhatsApp Business | Meta Graph API | Saliente + entrante | Mensajes huéspedes, chatbot, notificaciones grupo |
| Web propia | API interna | Bidireccional | Motor de reservas del sitio web del hotel |
| Airbnb (futuro) | API Airbnb | Bidireccional | Requiere cuenta host verificada |

---

## Pantallas necesarias

| Pantalla | Descripción |
|----------|-------------|
| Panel principal | Semáforo por canal: CONECTADO (verde) / ADVERTENCIA (naranja) / ERROR (rojo) / NO CONFIGURADO (gris). Última sync, errores recientes, botones "Ver detalles" y "Sincronizar ahora". |
| Configuración de canal | Formulario de credenciales por canal. Botón "Probar conexión" antes de guardar. |
| Gestión de disponibilidad | Calendario mensual con estado por fecha: abierta/cerrada en cada canal, tarifa, restricciones. Acciones masivas sobre rango de fechas. |
| Abrir / Cerrar habitación | Modal: hab.(s), rango de fechas, canal(es), acción (abrir/cerrar). Vista previa. Resultado por canal. |
| Log de sincronización | Historial de operaciones. Permite reintentar fallidos. |

---

## Credenciales por canal

**Booking.com**: Hotel ID · Username API · Password API · URL webhook
**Expedia**: EQC Partner ID · Username · Password · Property ID
**WhatsApp**: Phone Number ID · Access Token permanente · Webhook Secret

> Las credenciales se guardan **encriptadas con AES-256** en la tabla `config_integraciones`

---

## Flujo de sincronización bidireccional

| Dirección | Evento | Qué hace el sistema | Manejo de error |
|-----------|--------|---------------------|-----------------|
| PMS → OTA | Reserva manual creada | Bloquea fechas en todos los canales activos simultáneamente | Si canal falla: encola en Redis, reintento cada 5min × 12 intentos |
| PMS → OTA | Checkout completado | Libera disponibilidad en todos los canales | Si el hotel sigue cerrado esas fechas: no abre |
| PMS → OTA | Gerente cierra hab. manualmente | Envía `stop_sell` a los canales seleccionados | Log de fallo visible en el panel |
| OTA → PMS | Nueva reserva de Booking | Webhook → valida disponibilidad → crea reserva → sincroniza a Expedia | Si no hay disponibilidad: responde 409 a Booking |
| OTA → PMS | Cancelación desde Expedia | Cancela reserva en PMS, libera disponibilidad en todos | Si pagó: genera reembolso según política |

---

## Tabla `config_integraciones` (nueva)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| canal | enum | booking \| expedia \| whatsapp \| web_propia \| airbnb |
| hotel_id | UUID FK | → [[Modulo 08 - Multi-sede]] |
| activo | boolean | Si false: canal desconectado temporalmente |
| credenciales | jsonb (encriptado) | Credenciales específicas del canal |
| webhook_url | string | URL que apunta a nuestro backend |
| webhook_secret | string | Para validar firma de webhooks entrantes |
| sync_automatica | boolean | Si true: sincroniza cada hora |
| ultima_sync_exitosa | timestamp | Para el semáforo de estado |
| errores_consecutivos | int | Si llega a 5: alerta al gerente |
| restricciones_globales | jsonb | {min_noches, precio_minimo_canal, cierre_llegadas_dates[]} |

---

## Endpoints necesarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/channel-manager/canales` | Lista canales con estado de sync |
| POST | `/api/v1/channel-manager/canales/:canal/config` | Guardar credenciales. Solo gerente |
| POST | `/api/v1/channel-manager/canales/:canal/test` | Probar conexión |
| POST | `/api/v1/channel-manager/sync` | Forzar sincronización manual |
| POST | `/api/v1/channel-manager/disponibilidad` | Abrir o cerrar habitaciones en OTAs |
| PATCH | `/api/v1/channel-manager/tarifas` | Actualizar tarifas en canales externos |
| GET | `/api/v1/channel-manager/log` | Log de sincronizaciones |
| POST | `/api/v1/webhooks/booking` | Receptor de webhooks de Booking.com |
| POST | `/api/v1/webhooks/expedia` | Receptor de webhooks de Expedia |
| POST | `/api/v1/webhooks/whatsapp` | Receptor de mensajes de WhatsApp |

---

## Conexiones

- [[Modulo 07 - Gestion de Habitaciones]] — inventario que se sincroniza
- [[Modulo 08 - Multi-sede]] — cada sede tiene sus propias credenciales
- [[Modulo 01 - Registro Manual RENIEC]] — check-in manual bloquea disponibilidad en OTAs
- [[Modulo 06 - Concierge IA Reservas WPP]] — usa el mismo webhook de WhatsApp
- [[Modulo 11 - Control de Accesos por Rol]] — solo gerente puede configurar canales

