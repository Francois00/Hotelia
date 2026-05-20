---
tags: [hotel-pms, modulo, whatsapp, notificaciones, prioridad-alta]
modulo: 2
prioridad: ALTA
tiempo_estimado: 1 semana
estado: completo
fase: 2
---

# Módulo 02 — Notificaciones al Grupo WhatsApp Empresarial

**Backend: ✅ | Frontend: ✅ | Tests: ⬜**

## Estado 2026-05-20

Página implementada en `/notificaciones` (solo gerente).

### Pantallas creadas
- `NotificacionesPage.tsx` — configurar Group ID, toggles por evento (check-in, checkout, mantenimiento, cierre turno, stock bajo, gasto caja), log de notificaciones

### Notas de integración
- Config de Group ID y toggles persiste en localStorage
- "Enviar mensaje de prueba" requiere endpoint backend de grupo (no existe aún)
- Log de notificaciones vacío hasta que se implemente el endpoint de historial

### Pendiente
- Endpoint backend para leer/guardar configuración de grupo
- Endpoint de envío de mensaje de prueba al grupo
- Endpoint de log de notificaciones enviadas
- Configurar Group ID real del grupo WhatsApp del hotel
- Activar cuenta Meta Business con plantillas aprobadas

← [[Modulo 01 - Registro Manual RENIEC]] | [[INDEX]] | → [[Modulo 03 - Reporte de Turno]]

> **Prioridad ALTA** — Depende de [[Modulo 01 - Registro Manual RENIEC]] y [[Modulo 09 - Channel Manager]]

Envía mensajes automáticos al grupo de WhatsApp interno del hotel ante cada evento clave. Mejora la coordinación entre turnos sin llamadas ni mensajes manuales.

---

## Eventos y plantillas de mensajes

### ✅ Check-in
```
🛎️ CHECK-IN
Cliente: {nombre_completo}
Doc: {tipo_doc} {nro_doc}
Habitación: {nro_hab} · {tipo_hab}
Estadía: {noches} noches ({fecha_entrada} → {fecha_salida})
Precio/noche: S/ {precio}
Total: S/ {total}
Registrado por: {recepcionista}
```

### 🚪 Checkout
```
🏁 CHECKOUT
Cliente: {nombre_completo}
Habitación: {nro_hab}
Estadía real: {noches} noches
Total cobrado: S/ {total}
Comprobante: {tipo} {serie}-{numero}
Recepcionista: {recepcionista}
```

### ⚠️ Alerta IA Concierge
```
⚠️ ALERTA CONCIERGE IA
[nivel: INFO / WARN / URGENTE]
Habitación: {nro_hab}
Mensaje: {descripcion}
Acción sugerida: {accion}
```

### 💸 Gasto de caja
```
💸 GASTO DE CAJA
Concepto: {concepto}
Monto: S/ {monto}
Registrado por: {recepcionista}
Saldo caja: S/ {saldo_actual}
```

### 📋 Cierre de turno
```
📋 CIERRE DE TURNO {turno}
Turno: {hora_apertura} → {hora_cierre}
Recepcionista: {nombre}
Check-ins: {qty} · Checkouts: {qty}
Efectivo: S/ {ef} · Yape/Plin: S/ {dig}
Total turno: S/ {total}
Reporte disponible en el sistema.
```

---

## Pantallas necesarias

| Pantalla | Descripción |
|----------|-------------|
| Configuración Grupo WPP (Admin) | Ingresar Group ID del grupo. Toggle por tipo de evento. Preview del mensaje. Botón "Enviar mensaje de prueba". Solo gerente. |
| Log de Notificaciones | Historial: mensaje, estado (enviado/fallido/pendiente), botón reenviar. |

> Los mensajes se disparan automáticamente desde otros módulos. Solo la configuración y el log son pantallas nuevas.

---

## Endpoints necesarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/notificaciones/grupo/checkin` | Llamado por el flujo de check-in |
| POST | `/api/v1/notificaciones/grupo/checkout` | Llamado por el flujo de checkout |
| POST | `/api/v1/notificaciones/grupo/alerta` | Usado por Concierge IA, mantenimiento, caja |
| POST | `/api/v1/notificaciones/grupo/turno` | Llamado al cerrar el turno |
| GET | `/api/v1/notificaciones/grupo/log` | Historial con estado y timestamp |
| PUT | `/api/v1/config/whatsapp-grupo` | Actualiza Group ID y preferencias. Solo gerente |

---

## Notas técnicas

- **Rate limiting**: Meta limita mensajes/minuto. Si hay varios eventos simultáneos: cola con delay de 2s entre mensajes
- **Errores**: Si WPP API falla → encola en Redis, reintento cada 2min × 3 intentos → después: email al gerente
- **No bloquea** el flujo principal (check-in/checkout continúa aunque falle la notificación)
- La misma cuenta/token ya existente para mensajes a huéspedes

---

## Disparado desde

- [[Modulo 01 - Registro Manual RENIEC]] — evento `checkin_completado`
- [[Modulo 03 - Reporte de Turno]] — evento `turno_cerrado`
- [[Modulo 06 - Concierge IA Reservas WPP]] — alertas IA
- [[Modulo 10 - Almacen e Inventario]] — alerta stock mínimo

