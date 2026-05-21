---
tags: [hotel-pms, checkout, wizard, comprobante, folio]
estado: completo
fecha_implementacion: 2026-05-21
---

# Checkout Wizard — 3 pasos

← [[Modulo 01 - Registro Manual RENIEC]] | [[INDEX]]

## Descripción

Wizard de 3 pasos para realizar el checkout de una reserva en estado `CHECKIN_REALIZADO`.

## Pasos del wizard

### Paso 1 — Folio y cargos
- Lista todos los cargos de la estancia (habitación × noches + extras)
- Permite agregar cargos extra (minibar, servicio, lavandería, otro)
- Muestra pagos ya registrados (depósitos, adelantos)
- Panel de saldo pendiente: verde si 0, rojo si > 0
- Si saldo = 0 → salta directamente al Paso 3

### Paso 2 — Cobrar saldo pendiente
- Multi-método: Efectivo, Yape, Plin, Débito, Crédito, Transferencia
- Cálculo automático de vuelto si hay Efectivo
- Validación: suma de pagos ≥ saldo pendiente para continuar
- `POST /api/v1/reservas/:id/folio/pagos` por cada método

### Paso 3 — Comprobante y confirmar
- Resumen completo: hab., huésped, estadía, total, saldo
- Selección boleta / factura (factura pide RUC, razón social, dir., email)
- `PATCH /api/v1/reservas/:id/estado` → `CHECKOUT_REALIZADO`
- Manejo de errores: `FOLIO_CON_SALDO_PENDIENTE`, `SUNAT_NO_DISPONIBLE`

## ModalCheckoutExitoso

Overlay con animación de check verde:
- Resumen: hab., huésped, noches, total, comprobante
- "La habitación queda en estado: 🧹 Limpieza"
- Botones: Imprimir comprobante | Nuevo checkout | Ver reservas

## Acceso

- **Desde Reservas**: botón 🏁 Checkout en fila con estado `CHECKIN_REALIZADO`
- **Desde Habitaciones**: botón 🏁 Checkout en tarjetas de habitaciones OCUPADAS
- **Ruta**: `/checkout/:reservaId` — roles: gerente, recepcionista

## Decisión técnica

Se usa `PATCH /reservas/:id/estado` (no un endpoint `/checkout` específico) para mantener consistencia con el modelo de estados de reserva. El backend valida que el saldo sea 0 antes de permitir el cambio de estado.

## Después del checkout

1. La reserva pasa a `CHECKOUT_REALIZADO`
2. La habitación pasa automáticamente a estado `LIMPIEZA` (backend)
3. El mapa de habitaciones se actualiza vía polling

## Conexiones

- [[Modulo 01 - Registro Manual RENIEC]] — el check-in genera el folio inicial
- [[Modulo 03 - Reporte de Turno]] — el checkout suma al total del turno activo
