---
tags: [hotel-pms, modulo, almacen, inventario, stock, prioridad-alta]
modulo: 10
prioridad: ALTA
tiempo_estimado: 2 semanas
estado: pendiente
fase: 3
---

# Módulo 10 — Almacén e Inventario del Hotel

← [[Modulo 09 - Channel Manager]] | [[INDEX]] | → [[Modulo 11 - Control de Accesos por Rol]]

> **Prioridad ALTA** — Depende de [[Modulo 11 - Control de Accesos por Rol]]

Control de todos los artículos físicos del hotel. Incluye alertas de stock mínimo, ciclos de inventariado y trazabilidad de salidas por habitación.

---

## Categorías y frecuencias de inventariado

| Categoría | Ejemplos | Frecuencia | Unidad |
|-----------|---------|------------|--------|
| 🛏️ Lencería | Sábanas, almohadas, fundas, colchas, mantas | Mensual | Unidades |
| 🛁 Toallas y baño | Toallas de baño, de mano, piso de baño, bata | Mensual | Unidades |
| 🧴 Amenities desechables | Shampoo, jabón, gel, kit dental, pantuflas | Semanal | Unidades |
| 🍾 Frigobar / Minibar | Gaseosas, agua, cervezas, jugos, snacks | Por check-out | Unidades |
| 🧹 Limpieza | Detergente, desinfectante, bolsas, guantes, trapeadores | Semanal | Litros / unidades |
| ⚡ Equipos | Plancha, secador, TV, control remoto, caja fuerte | Trimestral | Unidades con serial |
| 🍽️ Cocina / Desayuno | Vasos, tazas, cubiertos, café, azúcar, leche | Semanal | Unidades / gramos |
| 📦 Suministros oficina | Papel higiénico, papel impresora, lapiceros | Mensual | Unidades / rollos |

---

## Pantallas necesarias

| Pantalla | Descripción |
|----------|-------------|
| Dashboard de almacén | Stock normal (verde) · Stock bajo (naranja, < mínimo) · Stock cero (rojo). Alertas de inventariado próximo. |
| Catálogo de artículos | Lista: nombre, categoría, stock actual, mínimo, óptimo, unidad, costo promedio. Botón "Nuevo artículo". |
| Formulario artículo | Nombre, categoría, unidad, stock mínimo, stock óptimo, proveedor, precio promedio, número de serie (equipos). |
| Registrar entrada de stock | Artículo(s), cantidad, precio de compra, proveedor, nro. factura del proveedor. Suma al stock. |
| Registrar salida de stock | Artículo, cantidad, motivo (consumo / rotura / pérdida / asignación a hab.), habitación si aplica. |
| Inventariado periódico | Muestra stock teórico. Operario ingresa stock real. Sistema calcula diferencia. Al confirmar: ajusta stock. |
| Alertas y pedidos sugeridos | Lista de artículos bajo el mínimo + cantidad a pedir. Botón "Generar lista de pedido" (PDF/Excel). |

---

## Reglas de inventariado por categoría

| Categoría | Regla |
|-----------|-------|
| Minibar/frigobar | Revisar y reponer en cada checkout. Consumos → cargo automático al folio del huésped |
| Amenities desechables | Stock mínimo = consumo estimado 1 semana + 20% de buffer |
| Lencería y toallas | Contar antes del lavado masivo. Desgaste normal = "baja por uso" |
| Artículos de limpieza | Crítico: sin esto housekeeping no puede operar |
| Equipos con serial | Asociar a habitación específica. Trimestral con número de serie |

> ⚠️ Cuando cualquier artículo cae bajo el stock mínimo → alerta automática al grupo WPP → [[Modulo 02 - Notificaciones WhatsApp Grupo]]

---

## Modelo de datos

| Tabla | Campos clave |
|-------|-------------|
| `almacen_articulos` | id, hotel_id, nombre, categoria, unidad, stock_actual, stock_minimo, stock_optimo, costo_promedio, proveedor_habitual, activo |
| `almacen_movimientos` | id, articulo_id, tipo (entrada\|salida\|ajuste), cantidad, stock_resultante, motivo, habitacion_id, reserva_id, responsable_id, precio_unitario, referencia_doc |
| `almacen_inventariados` | id, hotel_id, fecha_inicio, fecha_fin, responsable_id, estado, total_diferencias |
| `almacen_inventariado_items` | id, inventariado_id, articulo_id, stock_teorico, stock_contado, diferencia, justificacion |
| `almacen_equipos_habitacion` | id, articulo_id, habitacion_id, numero_serie, fecha_asignacion, estado |

---

## Endpoints necesarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/almacen/articulos` | Lista con stock actual y estado de alerta |
| POST | `/api/v1/almacen/articulos` | Crear artículo |
| PUT | `/api/v1/almacen/articulos/:id` | Editar artículo |
| POST | `/api/v1/almacen/movimientos/entrada` | Registrar ingreso de stock |
| POST | `/api/v1/almacen/movimientos/salida` | Registrar salida de stock |
| GET | `/api/v1/almacen/movimientos` | Historial con filtros |
| POST | `/api/v1/almacen/inventariados` | Iniciar proceso de inventariado |
| POST | `/api/v1/almacen/inventariados/:id/items` | Ingresar conteo real |
| POST | `/api/v1/almacen/inventariados/:id/cerrar` | Cerrar inventariado y aplicar diferencias |
| GET | `/api/v1/almacen/alertas/pdf` | PDF de lista de pedido sugerido |

---

## Conexiones

- [[Modulo 02 - Notificaciones WhatsApp Grupo]] — alerta de stock bajo
- [[Modulo 07 - Gestion de Habitaciones]] — equipos asignados a habitaciones específicas
- [[Modulo 11 - Control de Accesos por Rol]] — recepcionista puede ver y registrar; gerente hace inventariado

