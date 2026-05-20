---
tags: [api, logica-negocio, checkin, turnos, reservas]
fecha: 2026-05-20
estado: ✅ completo
---

# Lógica de Negocio — Flujos críticos

> Ver también: [[endpoints-implementados]], [[schema-actual]], [[indices-constraints]]

---

## 1. Check-in Manual — Flujo anti-overbooking

El endpoint `POST /api/v1/reservas/checkin-manual` es la operación más crítica del PMS.

### Secuencia completa

```
Cliente HTTP
   │
   ├─ 1. Validación Zod (input mínimo)
   │       numero_noches > 0, pagos.sum == total, huesped_id válido
   │
   ├─ 2. Redis distributed lock
   │       SET lock:checkin:<habitacion_id> 1 NX EX 30
   │       Si falla → HABITACION_BLOQUEADA (409)
   │
   └─ 3. prisma.$transaction([...])
           │
           ├─ 3a. FOR UPDATE NOWAIT
           │       SELECT * FROM habitaciones WHERE id = $1
           │       NOWAIT → HABITACION_NO_DISPONIBLE si otro proceso la tiene
           │
           ├─ 3b. Verificar estado = DISPONIBLE
           │       Si OCUPADA/MANTENIMIENTO → HABITACION_NO_DISPONIBLE (409)
           │
           ├─ 3c. Verificar capacidad
           │       Si personas > capacidad → CAPACIDAD_EXCEDIDA (409)
           │
           ├─ 3d. Verificar reserva solapada activa
           │       (constraint GIST también lo haría, pero verificamos antes)
           │
           ├─ 3e. reserva.create — genera código CHK-YYYYMMDD-XXXXXX
           │
           ├─ 3f. pago.createMany — uno por método de pago
           │
           ├─ 3g. folioItem.create — cargo "Estancia N noches"
           │
           └─ 3h. habitacion.update — estado = OCUPADA
   │
   ├─ 4. Liberar Redis lock (Lua script atómico)
   │
   └─ 5. Fire-and-forget (no bloquea respuesta)
           ├─ sunat.emitirComprobante() si tipo_comprobante definido
           ├─ whatsapp.enviarBienvenida() si tiene teléfono
           └─ n8n.notificarCheckin() vía webhook
```

### Códigos de error

| Código | HTTP | Causa |
|--------|------|-------|
| `FECHAS_INVALIDAS` | 400 | numero_noches = 0 o negativo |
| `PAGOS_NO_COINCIDEN` | 400 | Suma de pagos ≠ total (precio × noches) |
| `HABITACION_BLOQUEADA` | 409 | Redis lock no adquirido |
| `HABITACION_NO_DISPONIBLE` | 409 | Estado ≠ DISPONIBLE o FOR UPDATE NOWAIT falló |
| `CAPACIDAD_EXCEDIDA` | 409 | Personas > capacidad de la habitación |

---

## 2. Máquina de estados de Reservas

```
CONFIRMADA ──────────────────────────────────────────► CANCELADA
     │                                                       ▲
     │ check-in manual                                       │
     ▼                                                       │
CHECKIN_REALIZADO ───────── (gerente/admin solo) ───────────┤
     │                                                       │
     │ checkout                                              │
     ▼                                                       │
CHECKOUT_REALIZADO                                           │
                                                             │
CONFIRMADA ──────────────────────────────────────────► NO_SHOW
```

Transiciones válidas:
- `CONFIRMADA` → `CHECKIN_REALIZADO` (via checkin-manual o cambio de estado manual)
- `CONFIRMADA` → `CANCELADA` (GERENTE/ADMIN)
- `CONFIRMADA` → `NO_SHOW` (GERENTE/ADMIN)
- `CHECKIN_REALIZADO` → `CHECKOUT_REALIZADO` (cualquier rol con acceso)
- `CHECKIN_REALIZADO` → `CANCELADA` (solo GERENTE/ADMIN)

El constraint GIST excluye `CANCELADA` y `NO_SHOW`, por lo que no bloquean disponibilidad.

---

## 3. Cierre de Turno — Flujo de firma digital

```
POST /api/v1/turnos/:id/cerrar { pin }
   │
   ├─ 1. Buscar turno con recepcionista.password_hash
   │
   ├─ 2. bcrypt.compare(pin, password_hash)
   │       Si falla → PIN_INVALIDO (401)
   │
   ├─ 3. calcularResumenTurno(turnoId, horaApertura)
   │       Agrega pagos por método desde hora_apertura
   │       Cuenta check-ins y check-outs del turno
   │
   ├─ 4. Construir JSON del reporte
   │       { encabezado, transacciones, gastos_caja, resumen_pagos, totales, firma }
   │
   ├─ 5. SHA256(JSON_stringify(reporte)) → firma_hash
   │       Garantiza integridad del reporte (audit trail)
   │
   ├─ 6. prisma.$transaction
   │       turno.update — estado=CERRADO, hora_cierre, saldo_final, firma_hash
   │
   ├─ 7. generarPDFReporte(reporte) → Buffer PDF (PDFKit)
   │
   ├─ 8. reporte_turno_cache.upsert — guarda JSON + ruta PDF en disco
   │
   └─ 9. n8n notificación cierre de turno (fire-and-forget)
```

El PIN de cierre es la contraseña de sesión del recepcionista — actúa como firma electrónica del arqueo de caja.

---

## 4. Cálculo de tarifa sugerida

El ia-service calcula la tarifa dinámica considerando en orden de prioridad:

1. **Reglas de temporada** (`reglas_temporada`): si la fecha cae dentro de una regla activa, aplica el `ajuste_porcentaje`.
2. **Ocupación actual**: si la ocupación supera `OCUPACION_UMBRAL_ALTO` (por defecto 75%), incrementa la tarifa.
3. **Predicción Prophet**: si el modelo tiene datos suficientes, ajusta según ocupación predicha.
4. **Canal**: factores por canal (BOOKING_COM ×1.05, EXPEDIA ×1.08, DIRECTO ×1.0, etc.).
5. **Fallback Redis**: si el ia-service no responde en 2s, usa la `tarifa_base` de la BD.
6. **Tarifa mínima/máxima**: el resultado se clampea entre `tarifa_minima` y `tarifa_maxima` si están definidas.

---

## 5. LTV y Segmentación CRM

El `ltv` (Lifetime Value) de un huésped se actualiza en cada check-in sumando el total pagado.

Segmentación automática basada en LTV y frecuencia de estancias:

| Segmento | Criterio |
|----------|----------|
| NUEVO | Primera estancia |
| NORMAL | LTV < 500 PEN |
| RECURRENTE | 2-5 estancias |
| OCASIONAL | Activo hace > 6 meses, LTV bajo |
| VIP | LTV ≥ 2000 PEN (configurable `LTV_UMBRAL_VIP`) |
| CORPORATIVO | Reserva vía RUC/factura |
| INACTIVO | Sin estancias en `MESES_INACTIVIDAD_REACTIVAR` meses (default 18) |

El ia-service ejecuta la segmentación semanalmente via n8n (`segmentacion_semanal.json`).

---

## 6. Channel Manager — Idempotencia de webhooks

Flujo de recepción de webhook OTA:

```
POST /api/v1/canales/webhook/:canal
   │
   ├─ 1. Verificar firma HMAC-SHA256
   │       hmac = sha256(rawBody, WEBHOOK_SECRET_<CANAL>)
   │       Si falla → 401 inmediato, no se procesa nada
   │
   ├─ 2. Extraer idempotency_key del payload
   │       (booking_id + tipo_evento + timestamp del canal)
   │
   ├─ 3. canal_sync_log.findUnique({ idempotency_key })
   │       Si existe → responder 200 OK sin reprocesar (webhook duplicado)
   │
   ├─ 4. otaNormalizer → Reserva interna
   │       Booking.com / Expedia / Airbnb → formato estándar interno
   │
   ├─ 5. Crear/actualizar reserva en BD
   │
   └─ 6. canal_sync_log.create — registra idempotency_key + resultado
```

---

## 7. Concierge IA (Aria)

```
WhatsApp → POST /whatsapp/webhook
              │
              ├─ 1. Responder 200 inmediato a Meta (< 200ms)
              │
              ├─ 2. Buscar huésped por teléfono
              │
              ├─ 3. Buscar reserva activa (CHECKIN_REALIZADO)
              │
              └─ 4. ia-service POST /ia/v1/concierge/mensaje
                        │
                        ├─ Claude Anthropic API (claude-3-haiku/sonnet)
                        │   con contexto: reserva, habitación, preferencias
                        │
                        ├─ Detecta intent: solicitud_servicio, queja, info_hotel
                        │
                        └─ Si escalado → POST /api/v1/internal/alertas
```

El concierge también es accesible desde la UI frontend en `/concierge`.

---

## 8. QR Check-in

```
Recepcionista: GET /reservas/:id/qr-checkin
   → JWT firmado { reserva_id, habitacion_id, exp: 24h }
   → Base64 → QR code (qrcode npm)
   → Huésped escanea QR con teléfono

Huésped: POST /checkin/qr { token }
   → jwt.verify(token) — sin autenticación JWT de usuario
   → qrcheckin.service.procesarQRCheckin(token)
   → Valida reserva CONFIRMADA y habitación DISPONIBLE
   → Ejecuta check-in (versión simplificada, sin pagos nuevos)
```
