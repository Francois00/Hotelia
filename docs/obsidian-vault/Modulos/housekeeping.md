---
tags: [modulo, housekeeping, limpieza, habitaciones, plan-dia]
fecha: 2026-06-16
estado: ✅ Completo e implementado
---

# Housekeeping — Plan del Día

> Ver también: [[Modulo 07 - Gestion de Habitaciones]], [[jobs-cron]], [[Modulo 12 - Confort del Huesped]]

---

## Estado

✅ **Completo** — implementado en sprint 2026-05-21

Archivos:
- `frontend/src/pages/HousekeepingPage.tsx`
- `backend/src/routes/housekeeping.ts`

---

## Sistema de prioridades

| Prioridad | Criterio | Color |
|-----------|----------|-------|
| 🔴 URGENTE | Habitación tiene check-in hoy en menos de 2 horas | Rojo |
| 🟠 ALTA | Habitación tiene check-in hoy (más de 2h) | Naranja |
| 🟡 NORMAL | Habitación en estado LIMPIEZA sin check-in hoy | Amarillo |

El plan se calcula en tiempo real al llamar `GET /housekeeping/plan-dia`: compara el estado de cada habitación con las reservas confirmadas del día.

---

## Frontend (HousekeepingPage.tsx)

**Ruta**: `/housekeeping`
**Roles con acceso**: HOUSEKEEPING, RECEPCIONISTA, GERENTE, ADMIN

**Componentes**:
- Cards agrupadas por prioridad (urgente → alta → normal)
- **Timer en vivo**: muestra tiempo restante hasta check-in (actualiza cada minuto)
- Botón **"Iniciar limpieza"** → PATCH estado a `LIMPIEZA`
- Botón **"Marcar lista"** → PATCH estado a `DISPONIBLE`
- **Filtros**: por piso (1°, 2°, 3°) y por estado (todas, pendientes, en limpieza)
- Badge de count por categoría de prioridad
- Nombre del huésped que hace check-in (si aplica)

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/housekeeping/plan-dia` | HK, RECEP, GER | Plan del día con prioridades calculadas |
| PATCH | `/api/v1/housekeeping/habitaciones/:numero/estado` | HK, RECEP, GER | Cambiar estado (→ LIMPIEZA o → DISPONIBLE) |
| GET | `/api/v1/housekeeping/habitaciones/:numero/detalle` | HK, RECEP, GER | Detalle: historial + reserva activa |

### Respuesta de GET /plan-dia

```json
{
  "urgentes": [
    {
      "numero": "205",
      "tipo": "DOBLE",
      "piso": 2,
      "estado": "LIMPIEZA",
      "prioridad": "urgente",
      "minutos_hasta_checkin": 87,
      "huesped_entrante": "María García"
    }
  ],
  "altas": [...],
  "normales": [...],
  "total": 8
}
```

---

## Roles y permisos

| Acción | HOUSEKEEPING | RECEPCIONISTA | GERENTE/ADMIN |
|--------|-------------|---------------|---------------|
| Ver plan del día | ✅ | ✅ | ✅ |
| Cambiar estado a LIMPIEZA | ✅ | ✅ | ✅ |
| Marcar como DISPONIBLE | ✅ | ✅ | ✅ |
| Ver historial de habitación | ✅ | ✅ | ✅ |

---

## Integración con Jobs cron

El Job 2 (sync habitaciones cada 15min) corrige automáticamente los estados:
- Habitación OCUPADA sin reserva activa → `DISPONIBLE`
- Habitación en otro estado con check-in activo → `OCUPADA`

Esto garantiza que el plan de housekeeping siempre refleje la realidad, incluso si alguien cambió el estado manualmente.

Ver [[jobs-cron]] para detalles del scheduler.
