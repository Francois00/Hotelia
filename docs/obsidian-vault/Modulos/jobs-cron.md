---
tags: [modulo, cron, jobs, automatizacion, scheduler]
fecha: 2026-06-16
estado: ✅ Completo e implementado
---

# Jobs Cron — Automatización del servidor

> Ver también: [[housekeeping]], [[campanas-crm]], [[Modulo 02 - Notificaciones WhatsApp Grupo]]

---

## Estado

✅ **Completo** — implementado en sprint 2026-05-21 (commit `646ffc0`)

Archivo: `backend/src/jobs/scheduler.ts`
Librería: `node-cron` (integrado en el proceso Node.js del backend)

Los jobs se inician automáticamente cuando arranca el backend. No requieren configuración adicional.

---

## Resumen de jobs

| Hora | Expresión cron | Job | Descripción |
|------|---------------|-----|-------------|
| 02:00 diario | `0 2 * * *` | NO-SHOW | Marca reservas sin check-in como NO_SHOW |
| Cada 15 min | `*/15 * * * *` | Sync habitaciones | Corrige estados habitaciones vs reservas activas |
| Dom 03:00 | `0 3 * * 0` | CRM segmentos | Recalcula segmentos vip/recurrente/ocasional/inactivo |
| 08:00 diario | `0 8 * * *` | Alertas checkouts | Envía plan de checkouts del día al grupo WPP |

Todos los horarios son en la zona horaria del servidor (configurada como `America/Lima` en Docker).

---

## Job 1 — NO-SHOW (02:00 AM diario)

**Propósito**: Liberar habitaciones y limpiar el sistema de reservas fantasma.

**Lógica**:
```sql
UPDATE reservas
SET estado = 'NO_SHOW'
WHERE estado = 'CONFIRMADA'
  AND fecha_entrada >= <ayer 00:00>
  AND fecha_entrada <= <ayer 23:59>
```

**Resultado**: Las reservas con `fecha_entrada` de ayer que nunca hicieron check-in pasan a estado `NO_SHOW`. Esto libera la habitación para nuevas reservas.

**Log**: `[CRON] NO-SHOW: N reservas marcadas`

---

## Job 2 — Sincronización de habitaciones (cada 15 min)

**Propósito**: Mantener consistencia entre el estado de la habitación y las reservas activas.

**Dos correcciones automáticas**:

```sql
-- Corrección 1: Hab con check-in activo que no está como OCUPADA
UPDATE habitaciones h
SET estado = 'OCUPADA'
FROM reservas r
WHERE r.habitacion_id = h.id
  AND r.estado = 'CHECKIN_REALIZADO'
  AND h.estado NOT IN ('OCUPADA', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO')

-- Corrección 2: Hab marcada como OCUPADA sin check-in activo
UPDATE habitaciones h
SET estado = 'DISPONIBLE'
WHERE h.estado = 'OCUPADA'
  AND NOT EXISTS (
    SELECT 1 FROM reservas r
    WHERE r.habitacion_id = h.id
      AND r.estado = 'CHECKIN_REALIZADO'
  )
```

**Log**: Solo loguea si hay correcciones: `[CRON] Sync habitaciones: N → OCUPADA, M → DISPONIBLE`

**Impacto en housekeeping**: garantiza que el plan del día siempre esté sincronizado.

---

## Job 3 — Recalcular segmentos CRM (domingos 03:00 AM)

**Propósito**: Clasificar huéspedes según su historial real de reservas.

**Orden de clasificación** (de más exclusivo a menos):

| Segmento | Criterio SQL |
|----------|-------------|
| VIP | COUNT(checkout) >= 5 AND ltv >= 1000 |
| RECURRENTE | COUNT(checkout) >= 3 (no VIP) |
| OCASIONAL | COUNT(checkout) = 2 (no VIP, no REC) |
| INACTIVO | COUNT(checkout) = 1 AND última > 90 días |

**Nota**: Los segmentos `NUEVO`, `CORPORATIVO` no se tocan por este job — se asignan en otros contextos (alta de huésped, datos de empresa).

**Log**: `[CRON] Segmentos CRM actualizados`

**Uso posterior**: el módulo de campañas CRM usa estos segmentos para envíos segmentados. Ver [[campanas-crm]].

---

## Job 4 — Alertas de checkouts del día (08:00 AM diario)

**Propósito**: Preparar al equipo de recepción con el plan de salidas del día.

**Lógica**:
1. Consulta reservas en estado `CHECKIN_REALIZADO` con `fecha_salida` = hoy
2. Si no hay checkouts, termina silenciosamente
3. Construye mensaje WhatsApp con formato:
```
📋 *PLAN DEL DÍA — MARTES 16 DE JUNIO*

🏁 *Checkouts hoy: 4*
  • Hab. 101 — Juan García
  • Hab. 205 — María López
  • Hab. 308 — Carlos Vega
  • Hab. 410 — Ana Torres

🧹 Recuerden revisar el plan de housekeeping.
```
4. POST al endpoint de notificaciones grupo WhatsApp

**Endpoint llamado**: `POST /api/v1/notificaciones/grupo/alerta` (con `x-service-token`)

**Variable de entorno requerida**: `BACKEND_SERVICE_TOKEN` y `BACKEND_INTERNAL_URL`

---

## Inicialización

```typescript
// Al arrancar el backend, scheduler.ts imprime:
[CRON] Jobs programados: NO-SHOW(02:00) | Sync-habs(*/15min) | CRM(dom 03:00) | Alertas(08:00)
```

El archivo se importa en `backend/src/index.ts` y los jobs quedan activos mientras el proceso está corriendo.

---

## Monitoreo

Para verificar que los jobs corren:
```bash
# Ver logs del backend en tiempo real
docker compose logs -f backend | grep "\[CRON\]"

# Output esperado cada 15 min:
# (silencioso si no hay correcciones que hacer)
# [CRON] Sync habitaciones: 0 → OCUPADA, 0 → DISPONIBLE
```

Para pruebas manuales de un job específico, puedes llamar directamente la lógica editando temporalmente la expresión cron a `* * * * *` (cada minuto), ejecutar, y revertir.
