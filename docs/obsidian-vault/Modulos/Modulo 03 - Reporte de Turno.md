---
tags: [hotel-pms, modulo, reporte, turno, caja, prioridad-alta]
modulo: 3
prioridad: ALTA
tiempo_estimado: 2 semanas
estado: pendiente
fase: 1
---

# Módulo 03 — Reporte de Turno (Día / Noche)

← [[Modulo 02 - Notificaciones WhatsApp Grupo]] | [[INDEX]] | → [[Modulo 04 - Historial Mejorado Clientes]]

> **Prioridad ALTA** — Puede desarrollarse en paralelo con [[Modulo 01 - Registro Manual RENIEC]]

Documento exportable que resume toda la actividad del turno. Sirve como herramienta de rendición y cambio de guardia.

- **Turno día**: 06:00 – 18:00
- **Turno noche**: 18:00 – 06:00

---

## Sección A — Encabezado del turno

| Campo | Tipo | Notas |
|-------|------|-------|
| Empresa | string | Nombre del hotel (desde config) |
| RUC | string | RUC del hotel |
| Establecimiento / Dirección | string | Nombre y dirección de la sede |
| Vendedor / Cajero | string | Recepcionista que abrió el turno |
| Turno | enum | DÍA (06-18) \| NOCHE (18-06) |
| Fecha del reporte | date | Fecha del turno |
| Hora apertura caja | timestamp | Cuando el recepcionista abrió el turno |
| Hora cierre caja | timestamp | Cuando se genera el reporte de cierre |
| Estado caja | enum | ABIERTA \| CERRADA |
| Saldo inicial | decimal | Efectivo al inicio (ingresado manualmente) |

---

## Sección B — Detalle de transacciones

> Una fila por transacción realizada durante el turno

| Nro Transac. | Tipo Comprobante | Nro Doc. | Fecha Emisión | Cliente | Doc. Cliente | **Hab.** | Moneda | Monto |
|:---:|---|---|---|---|---|:---:|:---:|---:|
| 0001 | Boleta B001-0032 | … | 14/05 14:32 | Carlos Ríos | DNI 45123456 | **101** | PEN | 180.00 |

Campos adicionales por fila: Observación, Total a pagar, Método de pago.

---

## Sección C — Gastos de caja

| Campo | Descripción |
|-------|-------------|
| Fecha / Hora | Cuándo se realizó el gasto |
| Concepto | Ej: "Compra papel higiénico", "Artículos limpieza" |
| Monto | Importe en soles |
| Comprobante proveedor | Nro. boleta/factura del proveedor (opcional) |
| Registrado por | Recepcionista |
| **Total gastos turno** | Suma de todos los egresos |

---

## Sección D — Resumen por método de pago

| Método de Pago | Cant. Transacciones | Monto Total |
|---|:---:|---:|
| 💵 Efectivo | — | — |
| 📱 Yape | — | — |
| 📱 Plin | — | — |
| 💳 Tarjeta Débito | — | — |
| 💳 Tarjeta Crédito | — | — |
| 🏦 Transferencia | — | — |
| **TOTAL TURNO** | — | — |

---

## Sección E — Totales de caja y cierre

| Campo | Descripción |
|-------|-------------|
| Total efectivo bruto | Suma transacciones en efectivo |
| Total gastos de caja | Suma de egresos del turno |
| Efectivo neto | Total efectivo – Total gastos |
| Total billeteras digitales | Yape + Plin |
| Total tarjetas | Débito + Crédito |
| Total transferencias | Suma transferencias bancarias |
| **TOTAL GENERAL TURNO** | Suma de todos los métodos |
| Saldo final caja (efectivo) | Saldo inicial + Efectivo neto |

---

## Apertura y cierre de turno

**Apertura**: Recepcionista ingresa saldo inicial en efectivo físico. Sistema registra fecha/hora y responsable.

**Cierre**:
1. Botón "Cerrar turno" en el dashboard
2. Sistema genera el reporte completo
3. Recepcionista revisa y hace clic en "Confirmar y firmar cierre"
4. Se registra timestamp + firma digital (PIN de 4 dígitos o contraseña)

**Exportar**:
- 📄 Descargar PDF
- 📱 Enviar al grupo WPP del hotel → [[Modulo 02 - Notificaciones WhatsApp Grupo]]
- 📧 Enviar por correo al gerente

---

## Tablas nuevas en base de datos

| Tabla | Campos clave |
|-------|-------------|
| `turnos` | id, hotel_id, tipo, recepcionista_id, fecha, hora_apertura, hora_cierre, saldo_inicial, saldo_final, estado, firma_hash |
| `gastos_caja` | id, turno_id, concepto, monto, comprobante_proveedor, registrado_por, created_at |
| `reporte_turno_cache` | id, turno_id, json_reporte, pdf_url, generado_at |

---

## Endpoints necesarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/turnos/abrir` | Abre turno. Body: {tipo, saldo_inicial} |
| GET | `/api/v1/turnos/activo` | Turno abierto con resumen en tiempo real |
| POST | `/api/v1/turnos/:id/gastos` | Registra gasto de caja |
| GET | `/api/v1/turnos/:id/gastos` | Lista gastos del turno |
| POST | `/api/v1/turnos/:id/cerrar` | Cierra turno. Requiere PIN para firma |
| GET | `/api/v1/turnos/:id/reporte` | JSON completo del reporte |
| GET | `/api/v1/turnos/:id/reporte/pdf` | Descarga el PDF |
| GET | `/api/v1/turnos` | Historial de turnos con filtros |

