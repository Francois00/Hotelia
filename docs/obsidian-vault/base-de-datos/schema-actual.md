---
tags: [base-de-datos, schema, prisma]
fecha: 2026-05-20
estado: ✅ completo
---

# Schema actual — 18 tablas

> Ver también: [[indices-constraints]], [[stack-decisiones]], [[adr-003-prisma-docker]]

Fuente de verdad: `backend/prisma/schema.prisma`
Migraciones aplicadas: 11 (última: `20260519000000_mod07_01_03`)

---

## Enums (26)

| Enum | Valores |
|------|---------|
| `RolPersonal` | ADMIN, GERENTE, RECEPCIONISTA, HOUSEKEEPING, MANTENIMIENTO |
| `TipoHabitacion` | SIMPLE, DOBLE, SUITE, FAMILIAR |
| `EstadoHabitacion` | DISPONIBLE, OCUPADA, RESERVADA, MANTENIMIENTO, LIMPIEZA, FUERA_DE_SERVICIO |
| `TipoDocumento` | DNI, PASAPORTE, CE, RUC, DOC_EXTRANJERO |
| `SegmentoHuesped` | NUEVO, NORMAL, RECURRENTE, OCASIONAL, VIP, CORPORATIVO, INACTIVO |
| `IdiomaPreferido` | ES, EN, PT, FR, DE |
| `EstadoReserva` | CONFIRMADA, CHECKIN_REALIZADO, CHECKOUT_REALIZADO, CANCELADA, NO_SHOW |
| `CanalReserva` | DIRECTO, BOOKING_COM, EXPEDIA, WHATSAPP, TELEFONO, AIRBNB |
| `TipoFolioItem` | HABITACION, SERVICIO, MINIBAR, RESTAURANTE, LAVANDERIA, OTRO, TELEFONO, SPA, PARKING, SERVICIO_EXTRA |
| `MetodoPago` | EFECTIVO, TARJETA, TRANSFERENCIA, NIUBIZ, STRIPE, TARJETA_CREDITO, TARJETA_DEBITO, YAPE, PLIN |
| `EstadoPago` | PENDIENTE, COMPLETADO, FALLIDO, REEMBOLSADO |
| `TipoComprobante` | BOLETA, FACTURA |
| `CanalSync` | BOOKING_COM, EXPEDIA, AIRBNB |
| `TipoEventoSync` | RESERVA_NUEVA, MODIFICACION, CANCELACION, DISPONIBILIDAD |
| `EstadoSync` | PROCESADO, ERROR, PENDIENTE |
| `CanalReview` | DIRECTO, BOOKING_COM, EXPEDIA, GOOGLE, TRIPADVISOR |
| `SentimientoReview` | POSITIVO, NEUTRAL, NEGATIVO |
| `FuenteTarifa` | MANUAL, AI, CHANNEL_MANAGER |
| `TipoCampana` | EMAIL, WHATSAPP, AMBOS |
| `SegmentoCampana` | NORMAL, VIP, CORPORATIVO, TODOS |
| `EstadoCampana` | BORRADOR, PROGRAMADA, ENVIADA, PAUSADA |
| `TipoTemporada` | TEMPORADA_ALTA, TEMPORADA_BAJA, FIN_DE_SEMANA, EVENTO_ESPECIAL, ESTADIA_LARGA |
| `TipoTurno` | DIA, NOCHE |
| `EstadoTurno` | ABIERTO, CERRADO |

---

## Tablas

### 1. `personal`
Staff del hotel.

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK, gen_random_uuid() |
| nombre | VARCHAR(100) | NOT NULL |
| apellido | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | UNIQUE NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL — bcrypt |
| rol | RolPersonal | NOT NULL |
| activo | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | @updatedAt |

Relaciones: → Reserva (personal que creó), → CampanaCrm, → FolioItem, → Pago, → Turno, → GastoCaja

---

### 2. `tipos_habitacion`
Tipos personalizados además del enum `TipoHabitacion`.

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| nombre | VARCHAR(50) | NOT NULL |
| descripcion | TEXT | nullable |
| color_mapa | VARCHAR(7) | DEFAULT '#3B82F6' |
| activo | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Relaciones: → Habitacion (tipo_custom_id)

---

### 3. `habitaciones`
Habitaciones del hotel. Columnas extendidas en migración `20260519000000`.

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| numero | VARCHAR(10) | UNIQUE NOT NULL |
| tipo | TipoHabitacion | NOT NULL |
| piso | INT | NOT NULL |
| capacidad | INT | DEFAULT 2 |
| capacidad_adultos | INT | nullable |
| capacidad_ninos | INT | DEFAULT 0 |
| tarifa_base | DECIMAL(10,2) | NOT NULL |
| tarifa_minima | DECIMAL(10,2) | nullable |
| tarifa_maxima | DECIMAL(10,2) | nullable |
| moneda_tarifa | VARCHAR(3) | DEFAULT 'PEN' |
| estado | EstadoHabitacion | DEFAULT DISPONIBLE |
| descripcion | TEXT | nullable |
| amenidades | JSON | nullable |
| fotos | JSON | DEFAULT '[]' |
| visible_otas | BOOLEAN | DEFAULT true |
| tipo_custom_id | UUID | FK → tipos_habitacion, nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | @updatedAt |

Índices: `estado`, `numero` (unique)

---

### 4. `huespedes`
Clientes del hotel. Columnas extendidas en `20260507000002` y `20260519000000`.

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| nombre | VARCHAR(100) | NOT NULL |
| apellido | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | UNIQUE nullable |
| telefono | VARCHAR(20) | nullable |
| tipo_documento | TipoDocumento | NOT NULL |
| numero_documento | VARCHAR(20) | UNIQUE NOT NULL |
| nacionalidad | VARCHAR(100) | nullable |
| fecha_nacimiento | DATE | nullable |
| fecha_vencimiento_doc | DATE | nullable |
| ltv | DECIMAL(12,2) | DEFAULT 0 |
| segmento | SegmentoHuesped | DEFAULT NUEVO |
| notas | TEXT | nullable |
| idioma_preferido | IdiomaPreferido | DEFAULT ES |
| preferencias | JSON | nullable |
| activo | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | @updatedAt |

Índices: `numero_documento`, GIN trgm en `nombre` y `apellido` (búsqueda fuzzy)

---

### 5. `reservas`
Núcleo del PMS. Protegida por constraint GIST anti-overbooking.

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| codigo | VARCHAR(20) | UNIQUE NOT NULL |
| huesped_id | UUID | FK → huespedes NOT NULL |
| habitacion_id | UUID | FK → habitaciones NOT NULL |
| fecha_entrada | DATE | NOT NULL |
| fecha_salida | DATE | NOT NULL |
| estado | EstadoReserva | DEFAULT CONFIRMADA |
| canal | CanalReserva | DEFAULT DIRECTO |
| tarifa_acordada | DECIMAL(10,2) | NOT NULL |
| adultos | INT | DEFAULT 1 |
| ninos | INT | DEFAULT 0 |
| notas | TEXT | nullable |
| idempotency_key | VARCHAR(100) | UNIQUE nullable |
| personal_id | UUID | FK → personal nullable |
| qr_token | TEXT | nullable |
| qr_generado_en | TIMESTAMPTZ | nullable |
| tipo_comprobante | TipoComprobante | nullable |
| datos_facturacion | JSON | nullable (RUC, razón social para factura) |
| canal_envio_comprobante | VARCHAR(20) | DEFAULT 'whatsapp' |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | @updatedAt |

Índices: `huesped_id`, `habitacion_id`, `(fecha_entrada, fecha_salida)`, `estado`
Constraint GIST anti-overbooking: ver [[indices-constraints]]

---

### 6. `folio_items`
Ítems del folio de cada reserva (cargos por noche, servicios, extras).

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| reserva_id | UUID | FK → reservas NOT NULL |
| descripcion | VARCHAR(255) | NOT NULL |
| tipo | TipoFolioItem | DEFAULT HABITACION |
| cantidad | INT | DEFAULT 1 |
| precio_unitario | DECIMAL(10,2) | NOT NULL |
| fecha | DATE | NOT NULL |
| anulado | BOOLEAN | DEFAULT false |
| personal_id | UUID | FK → personal nullable |
| notas | TEXT | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Índice: `reserva_id`

---

### 7. `pagos`
Pagos asociados a reservas.

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| reserva_id | UUID | FK → reservas NOT NULL |
| monto | DECIMAL(12,2) | NOT NULL |
| moneda | VARCHAR(3) | DEFAULT 'PEN' |
| metodo | MetodoPago | NOT NULL |
| estado | EstadoPago | DEFAULT PENDIENTE |
| referencia_externa | VARCHAR(255) | nullable (Niubiz/Stripe ID) |
| numero_comprobante | VARCHAR(50) | nullable |
| tipo_comprobante | TipoComprobante | nullable |
| sunat_cdr | TEXT | nullable (CDR XML de SUNAT) |
| notas | TEXT | nullable |
| personal_id | UUID | FK → personal nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | @updatedAt |

Índice: `reserva_id`

---

### 8. `reglas_temporada`
Reglas de ajuste de tarifa por temporada/evento.

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| nombre | VARCHAR(100) | NOT NULL |
| tipo | TipoTemporada | NOT NULL |
| fecha_inicio | DATE | nullable |
| fecha_fin | DATE | nullable |
| ajuste_porcentaje | DECIMAL(5,2) | NOT NULL (positivo = incremento, negativo = descuento) |
| estadia_minima_noches | INT | nullable |
| aplica_a_tipos | JSON | DEFAULT '[]' (array de TipoHabitacion) |
| activo | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |

---

### 9. `canal_sync_log`
Log de sincronización con canales externos (Booking.com, Expedia, Airbnb).

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| canal | CanalSync | NOT NULL |
| tipo_evento | TipoEventoSync | NOT NULL |
| payload_entrada | JSON | NOT NULL |
| payload_salida | JSON | nullable |
| reserva_id | UUID | FK → reservas nullable |
| estado | EstadoSync | DEFAULT PENDIENTE |
| idempotency_key | VARCHAR(100) | UNIQUE NOT NULL |
| error_mensaje | TEXT | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Índice: `(canal, estado)`

---

### 10. `reviews`
Reseñas de huéspedes, propias y de canales externos.

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| reserva_id | UUID | UNIQUE FK → reservas NOT NULL |
| huesped_id | UUID | FK → huespedes NOT NULL |
| canal | CanalReview | NOT NULL |
| puntuacion | INT | NOT NULL |
| texto | TEXT | nullable |
| sentimiento | SentimientoReview | nullable (análisis NLP) |
| respondido | BOOLEAN | DEFAULT false |
| respuesta | TEXT | nullable |
| fecha_review | DATE | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Índice: `huesped_id`

---

### 11. `tarifas_historial`
Historial de tarifas aplicadas (alimenta el modelo Prophet del ia-service).

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| habitacion_id | UUID | FK → habitaciones NOT NULL |
| fecha | DATE | NOT NULL |
| tarifa_base | DECIMAL(10,2) | NOT NULL |
| tarifa_aplicada | DECIMAL(10,2) | NOT NULL |
| ocupacion_pct | DECIMAL(5,2) | nullable |
| canal | CanalReserva | nullable |
| fuente | FuenteTarifa | DEFAULT MANUAL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Índice: `(habitacion_id, fecha)`

---

### 12. `alertas_mantenimiento`
Alertas generadas por NLP del ia-service o escalamiento manual.

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| habitacion_id | UUID | FK → habitaciones NOT NULL |
| tipo | VARCHAR(50) | NOT NULL |
| descripcion | TEXT | NOT NULL |
| frecuencia | INT | DEFAULT 1 (veces que se reportó) |
| nivel_alerta | VARCHAR(10) | NOT NULL (alta/media/baja) |
| activa | BOOLEAN | DEFAULT true |
| resuelta_en | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | @updatedAt |

Índices: `habitacion_id`, `activa`

---

### 13. `concierge_mensajes`
Mensajes del chatbot concierge IA (Aria).

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| huesped_id | UUID | FK → huespedes NOT NULL |
| reserva_id | UUID | FK → reservas nullable |
| mensaje_huesped | TEXT | NOT NULL |
| respuesta_aria | TEXT | nullable |
| intent_detectado | VARCHAR(50) | nullable |
| escalado | BOOLEAN | DEFAULT false |
| escalado_motivo | VARCHAR(200) | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Índices: `huesped_id`, `escalado`

---

### 14. `campanas_crm`
Campañas de marketing (email y WhatsApp por segmento de huésped).

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| nombre | VARCHAR(255) | NOT NULL |
| tipo | TipoCampana | NOT NULL |
| segmento_objetivo | SegmentoCampana | DEFAULT TODOS |
| estado | EstadoCampana | DEFAULT BORRADOR |
| fecha_programada | TIMESTAMPTZ | nullable |
| fecha_enviada | TIMESTAMPTZ | nullable |
| total_destinatarios | INT | DEFAULT 0 |
| total_enviados | INT | DEFAULT 0 |
| total_abiertos | INT | DEFAULT 0 |
| mensaje_whatsapp | TEXT | nullable |
| asunto_email | VARCHAR(255) | nullable |
| cuerpo_email | TEXT | nullable |
| personal_id | UUID | FK → personal nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | @updatedAt |

Índice: `(estado, segmento_objetivo)`

---

### 15. `comprobantes`
Comprobantes electrónicos SUNAT (boleta/factura).

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| reserva_id | UUID | UNIQUE FK → reservas NOT NULL |
| tipo | VARCHAR(10) | NOT NULL (BOLETA/FACTURA) |
| serie | VARCHAR(10) | NOT NULL |
| correlativo | VARCHAR(10) | NOT NULL |
| fecha_emision | DATE | NOT NULL |
| total | DECIMAL(10,2) | NOT NULL |
| xml_generado | TEXT | nullable |
| cdr_respuesta | TEXT | nullable |
| estado | VARCHAR(20) | NOT NULL |
| pdf_url | TEXT | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Índices: `estado`, `fecha_emision`

---

### 16. `turnos`
Turnos de recepción (día/noche).

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| tipo | TipoTurno | NOT NULL |
| recepcionista_id | UUID | FK → personal NOT NULL |
| fecha | DATE | DEFAULT CURRENT_DATE |
| hora_apertura | TIMESTAMPTZ | DEFAULT now() |
| hora_cierre | TIMESTAMPTZ | nullable |
| saldo_inicial | DECIMAL(10,2) | DEFAULT 0 |
| saldo_final | DECIMAL(10,2) | nullable |
| estado | EstadoTurno | DEFAULT ABIERTO |
| firma_hash | VARCHAR(64) | nullable (SHA256 del JSON de cierre) |
| observaciones | TEXT | nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Índices: `estado`, `fecha`
Constraint único parcial: `idx_turnos_un_abierto` — solo un turno ABIERTO simultáneo

---

### 17. `gastos_caja`
Gastos de caja registrados durante un turno.

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| turno_id | UUID | FK → turnos NOT NULL, ON DELETE CASCADE |
| concepto | VARCHAR(200) | NOT NULL |
| monto | DECIMAL(10,2) | NOT NULL |
| comprobante_proveedor | VARCHAR(50) | nullable |
| registrado_por_id | UUID | FK → personal NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Índice: `turno_id`

---

### 18. `reporte_turno_cache`
Cache del JSON y PDF del reporte de turno cerrado.

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | UUID | PK |
| turno_id | UUID | UNIQUE FK → turnos NOT NULL, ON DELETE CASCADE |
| json_reporte | JSON | NOT NULL |
| pdf_url | TEXT | nullable |
| generado_at | TIMESTAMPTZ | DEFAULT now() |

---

## Historial de migraciones

| Orden | Nombre | Qué agrega |
|-------|--------|------------|
| 1 | `20260506000000_init` | Tablas core, extensiones, constraint GIST |
| 2 | `20260507000000_add_fuera_de_servicio` | EstadoHabitacion::FUERA_DE_SERVICIO |
| 3 | `20260507000001_add_reservada_airbnb` | EstadoHabitacion::RESERVADA, CanalReserva::AIRBNB |
| 4 | `20260507000002_huespedes_extension` | IdiomaPreferido, SegmentoHuesped (nuevos valores), activo, preferencias en huespedes |
| 5 | `20260507000003_folio_extension` | TipoFolioItem (nuevos), anulado, notas en folio_items |
| 6 | `20260507000004_add_airbnb_canalsync` | CanalSync::AIRBNB |
| 7 | `20260507000005_reviews_alertas` | Tablas reviews y alertas_mantenimiento |
| 8 | `20260507000006_concierge` | Tabla concierge_mensajes |
| 9 | `20260507000007_comprobantes` | Tabla comprobantes |
| 10 | `20260507000008_qr_checkin` | qr_token, qr_generado_en en reservas |
| 11 | `20260519000000_mod07_01_03` | YAPE/PLIN/RUC/DOC_EXTRANJERO enums, tipos_habitacion, reglas_temporada, turnos, gastos_caja, reporte_turno_cache, extensiones habitaciones |
