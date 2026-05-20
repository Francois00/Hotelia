---
tags: [hotel-pms, modulo, checkin, reniec, sunat, prioridad-critica]
modulo: 1
prioridad: CRÍTICA
tiempo_estimado: 2-3 semanas
estado: pendiente
fase: 1
---

# Módulo 01 — Registro Manual Multi-Documento

← [[INDEX]] | Siguiente → [[Modulo 02 - Notificaciones WhatsApp Grupo]]

> **Prioridad CRÍTICA** — Base de toda la operación. Sin esto no hay check-in, no hay comprobante, no hay reporte.

Permite al recepcionista registrar un huésped ingresando su documento. El sistema consulta RENIEC o SUNAT automáticamente y completa los datos del cliente.

---

## Tipos de documento soportados

| Tipo | Fuente | Datos que trae | Nota |
|------|--------|----------------|------|
| DNI | RENIEC API | Nombres, apellidos, fecha nac., dirección | Peruanos |
| RUC | SUNAT API | Razón social, dirección fiscal, estado | Empresas → factura automática |
| Pasaporte | Ingreso manual | Nombre, apellido, nacionalidad, vencimiento | Extranjeros |
| Carnet Extranjería | Ingreso manual | Nombre, apellido, país origen, vencimiento | Residentes extranjeros |
| Doc. Extranjero | Ingreso manual | Libre: nombre, apellido, país, nro. doc. | Fallback general |

---

## Flujo de pantallas (orden de registro)

```
PASO 1 → Selección de habitación
PASO 2 → Datos del cliente (doc. existente = autocomplete / nuevo = RENIEC/SUNAT)
PASO 3 → Método de pago
PASO 4 → Tipo de comprobante
PASO 5 → Resumen y confirmación
→ Modal post check-in
```

### PASO 1 — Selección de habitación
- Mapa visual con estado en tiempo real (disponible / ocupada / limpieza / mantenimiento)
- Al seleccionar: muestra tipo, capacidad, precio sugerido por IA
- Campos: fecha entrada, noches o fecha salida (se calculan mutuamente), número de personas
- Precio/noche: sugerido por **Revenue Manager IA**, editable
- Totales en tiempo real: subtotal, IGV, total a pagar

### PASO 2 — Datos del cliente
- **Si el documento YA EXISTE** en el sistema → autocomplete (nombre, apellidos, tel., email) + banner verde
- **Si el documento NO EXISTE** → consulta RENIEC/SUNAT para nombre/apellidos, recepcionista completa tel. y email → se crea el cliente nuevo al confirmar

### PASO 3 — Método de pago
Efectivo · Yape · Plin · Tarjeta débito · Tarjeta crédito (Niubiz) · Transferencia bancaria
- Se puede dividir el pago entre varios métodos
- Campo "monto recibido" para calcular vuelto en efectivo
- Validación: suma de métodos = total a pagar

### PASO 4 — Comprobante
- **Boleta** (default para DNI, pasaporte, carnet)
- **Factura** (automático si se ingresó RUC; o cambio manual)
- Para factura: RUC empresa, razón social, dirección fiscal, email

### PASO 5 — Resumen y confirmación
- Vista completa de todos los datos antes de confirmar
- Fecha de check-out destacada
- Canal de envío: WhatsApp / Correo / Ambos / Solo imprimir

---

## Flujo completo del sistema

| # | Acción | Sistema hace |
|---|--------|-------------|
| 1 | Recepcionista selecciona habitación | Muestra disponibles. Precio sugerido por IA |
| 2 | Ingresa datos de estancia | Valida fechas, personas ≤ capacidad, calcula total |
| 3 | Ingresa tipo + nro. de documento | Busca en BD interna primero |
| 4 | Cliente existente o nuevo | Existente: autocomplete. Nuevo: RENIEC/SUNAT + crea registro |
| 5 | Selecciona método(s) de pago | Valida suma = total. Calcula vuelto si hay efectivo |
| 6 | Elige boleta o factura | RUC → factura por defecto |
| 7 | Confirma check-in | Transacción atómica: reserva + folio + pagos + cambia estado habitación |
| 8 | Sistema emite comprobante SUNAT | XML UBL 2.1. Si falla: encola para reintento cada 30min |
| 9 | Envía por WhatsApp/email | n8n dispara flujo. PDF adjunto |
| 10 | Notifica al grupo WPP del hotel | → [[Modulo 02 - Notificaciones WhatsApp Grupo]] |

---

## Datos que maneja

| Campo | Tipo | Notas |
|-------|------|-------|
| tipo_documento | enum | dni \| ruc \| pasaporte \| carnet_extranjeria \| doc_extranjero |
| numero_documento | string | Validación de formato por tipo |
| nombres / apellidos | string | Auto desde RENIEC/SUNAT o manual |
| email | string | Opcional, para envío de comprobante |
| telefono | string | Con código país para WhatsApp (+51...) |
| habitacion_id | UUID FK | → tabla habitaciones |
| fecha_entrada | date | Por defecto: hoy |
| numero_noches | int | Mínimo 1 |
| fecha_salida | date | Calculada: entrada + noches |
| numero_personas | int | Mínimo 1, máximo = capacidad habitación |
| precio_por_noche | decimal | Sugerido por IA, editable |
| metodos_pago | jsonb | Array: [{metodo, monto}] |
| tipo_comprobante | enum | boleta \| factura |
| canal_envio | enum | whatsapp \| email \| ambos \| ninguno |

---

## Endpoints necesarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/clientes/reniec/:dni` | Consulta RENIEC. Cache Redis 24h |
| GET | `/api/v1/clientes/sunat/:ruc` | Consulta SUNAT. Cache Redis 1h |
| POST | `/api/v1/huespedes` | Crea o actualiza cliente (upsert por doc.) |
| GET | `/api/v1/habitaciones/disponibles` | Lista disponibles para rango de fechas y personas |
| POST | `/api/v1/reservas/checkin-manual` | Crea reserva + folio + pagos (transacción atómica) |
| POST | `/api/v1/comprobantes/emitir` | Genera XML, firma, envía a SUNAT |
| POST | `/api/v1/notificaciones/whatsapp` | Envía comprobante PDF por WPP al huésped |

---

## Integración con módulos existentes

- **[[Modulo 07 - Gestion de Habitaciones]]** — trae disponibilidad y precio base
- **[[Modulo 09 - Channel Manager]]** — bloquea disponibilidad en OTAs al confirmar
- **[[Modulo 02 - Notificaciones WhatsApp Grupo]]** — notifica al equipo tras el check-in
- **[[Modulo 03 - Reporte de Turno]]** — cada transacción queda registrada en el turno activo
- **[[Modulo 04 - Historial Mejorado Clientes]]** — actualiza perfil del huésped con la nueva estancia
- Revenue Manager IA → sugerencia de precio al seleccionar habitación
- Redis → cache de RENIEC/SUNAT
- n8n → envío de comprobante y notificación de grupo

