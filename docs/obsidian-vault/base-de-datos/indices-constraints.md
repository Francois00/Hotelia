---
tags: [base-de-datos, indices, constraints, postgresql]
fecha: 2026-05-20
estado: ✅ completo
---

# Índices y Constraints

> Ver también: [[schema-actual]], [[stack-decisiones]]

---

## Extensiones PostgreSQL requeridas

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid() para PKs
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- Constraint EXCLUDE anti-overbooking
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- Búsqueda fuzzy en nombres de huéspedes
```

Creadas en `docker/postgres/init.sql` y también en la migración `20260506000000_init`.

---

## Constraint crítico: Anti-overbooking

```sql
ALTER TABLE reservas ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    habitacion_id WITH =,
    daterange(fecha_entrada, fecha_salida, '[)') WITH &&
  )
  WHERE (estado NOT IN ('CANCELADA', 'NO_SHOW'));
```

**Qué hace**: Impide que dos reservas activas (no canceladas, no no-show) se solapen para la misma habitación. Usa el operador `&&` (solapamiento de rangos) sobre un índice GIST con `daterange` semiabierto `[)` — la noche de salida no cuenta, así que reservas consecutivas son válidas.

**Por qué**: Es el último escudo contra el overbooking. El backend también usa Redis lock + `FOR UPDATE NOWAIT`, pero este constraint es la garantía absoluta a nivel de BD.

---

## Índice único parcial: Un solo turno abierto

```sql
CREATE UNIQUE INDEX idx_turnos_un_abierto
  ON turnos (estado)
  WHERE estado = 'ABIERTO';
```

**Qué hace**: Solo puede existir una fila con `estado = 'ABIERTO'` en la tabla `turnos`. Impone la invariante de negocio a nivel de BD, complementando la validación en `abrirTurno()`.

---

## Índices GIN para búsqueda fuzzy (pg_trgm)

```sql
CREATE INDEX idx_huespedes_nombre_trgm   ON huespedes USING gin(nombre   gin_trgm_ops);
CREATE INDEX idx_huespedes_apellido_trgm ON huespedes USING gin(apellido  gin_trgm_ops);
```

**Qué hacen**: Permiten búsqueda por similitud de texto (`%` LIKE, `ILIKE`, `similarity()`) sobre nombres y apellidos de huéspedes. Fundamental para el wizard de check-in al buscar un huésped por nombre cuando no se sabe el DNI exacto.

---

## Índices regulares (B-tree)

| Tabla | Índice | Columnas | Tipo |
|-------|--------|----------|------|
| personal | `personal_email_key` | email | UNIQUE |
| habitaciones | `habitaciones_numero_key` | numero | UNIQUE |
| habitaciones | `habitaciones_estado_idx` | estado | B-tree |
| huespedes | `huespedes_email_key` | email | UNIQUE |
| huespedes | `huespedes_numero_documento_key` | numero_documento | UNIQUE |
| huespedes | `huespedes_numero_documento_idx` | numero_documento | B-tree |
| reservas | `reservas_codigo_key` | codigo | UNIQUE |
| reservas | `reservas_idempotency_key_key` | idempotency_key | UNIQUE |
| reservas | `reservas_huesped_id_idx` | huesped_id | B-tree |
| reservas | `reservas_habitacion_id_idx` | habitacion_id | B-tree |
| reservas | `reservas_fecha_entrada_fecha_salida_idx` | (fecha_entrada, fecha_salida) | B-tree |
| reservas | `reservas_estado_idx` | estado | B-tree |
| folio_items | `folio_items_reserva_id_idx` | reserva_id | B-tree |
| pagos | `pagos_reserva_id_idx` | reserva_id | B-tree |
| canal_sync_log | `canal_sync_log_idempotency_key_key` | idempotency_key | UNIQUE |
| canal_sync_log | `canal_sync_log_canal_estado_idx` | (canal, estado) | B-tree |
| reviews | `reviews_reserva_id_key` | reserva_id | UNIQUE (1 review por reserva) |
| reviews | `reviews_huesped_id_idx` | huesped_id | B-tree |
| tarifas_historial | `tarifas_historial_habitacion_id_fecha_idx` | (habitacion_id, fecha) | B-tree |
| campanas_crm | `campanas_crm_estado_segmento_objetivo_idx` | (estado, segmento_objetivo) | B-tree |
| comprobantes | (en estado) | estado | B-tree |
| comprobantes | (en fecha_emision) | fecha_emision | B-tree |
| turnos | `idx_turnos_un_abierto` | estado WHERE ABIERTO | UNIQUE parcial |
| turnos | `idx_turnos_fecha` | fecha | B-tree |
| turnos | `idx_turnos_estado` | estado | B-tree |
| gastos_caja | `idx_gastos_caja_turno` | turno_id | B-tree |
| alertas_mantenimiento | (en habitacion_id) | habitacion_id | B-tree |
| alertas_mantenimiento | (en activa) | activa | B-tree |
| concierge_mensajes | (en huesped_id) | huesped_id | B-tree |
| concierge_mensajes | (en escalado) | escalado | B-tree |

---

## Foreign keys con comportamiento especial

| FK | ON DELETE |
|----|-----------|
| `gastos_caja.turno_id` → `turnos` | CASCADE — al borrar turno se borran sus gastos |
| `reporte_turno_cache.turno_id` → `turnos` | CASCADE — al borrar turno se borra su caché |
| `reservas.personal_id` → `personal` | SET NULL — la reserva sobrevive si se borra el personal |
| `campanas_crm.personal_id` → `personal` | SET NULL |
| Resto de FKs | RESTRICT (comportamiento por defecto de Prisma) |

---

## Idempotency keys

Dos tablas tienen `idempotency_key UNIQUE`:

1. **`reservas.idempotency_key`**: para webhooks de canales OTA. Si el mismo evento llega dos veces, el segundo INSERT falla con violación de unique y se descarta.

2. **`canal_sync_log.idempotency_key`**: log de cada webhook procesado. El `sync.service.ts` verifica que el key no exista antes de procesar.

---

## Generación de UUIDs

Todos los PKs usan `gen_random_uuid()` de la extensión `pgcrypto` (PostgreSQL nativo), no el `uuid_generate_v4()` de la extensión `uuid-ossp`. Ventaja: no requiere extensión separada, compatible con Alpine.
