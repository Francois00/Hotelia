---
tags: [hotel-pms, mantenimiento, habitaciones, drawer, m05]
estado: completo
fecha_implementacion: 2026-05-21
---

# M05 — Mantenimiento por Habitación

← [[Modulo 05 - Mantenimiento por Habitacion]] | [[INDEX]]

## Implementación

### Frontend

`HabitacionDrawer.tsx` — drawer lateral que abre al hacer clic en una fila de la Lista de Habitaciones.

Tabs:
- **Info**: datos de la habitación (número, piso, tipo, capacidad, tarifa, amenidades)
- **Mantenimiento**: stats + formulario de reporte + lista de órdenes activas
- **Historial**: órdenes resueltas y canceladas

### Formulario de reporte
| Campo | Tipo | Notas |
|-------|------|-------|
| Tipo | select | electrico, plomeria, mobiliario, climatizacion, limpieza_profunda, otro |
| Descripción | textarea | mínimo 10 chars |
| Prioridad | select | baja, media, alta, urgente |
| Técnico | input | opcional |
| Costo estimado | decimal | opcional |

Si prioridad = **urgente** → habitación pasa a `MANTENIMIENTO` automáticamente (backend).

### Cambio de estado inline
- `pendiente` → [Iniciar] → `en_proceso`
- `en_proceso` → [Cerrar orden] → pide notas de cierre → `resuelto`
- Cualquier estado activo → [Cancelar] → `cancelado`

### Badge de prioridad
| Prioridad | Color |
|-----------|-------|
| urgente | Rojo |
| alta | Naranja |
| media | Azul |
| baja | Gris |

## Backend

### Tabla `mantenimiento_registros`
Aplicada con raw SQL (sin modelo Prisma). Ver migración: `20260521000001_mantenimiento_registros`.

### Endpoints
| Método | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/v1/habitaciones/:id/mantenimiento` | JWT (todos los roles) |
| POST | `/api/v1/habitaciones/:id/mantenimiento` | ADMIN, GERENTE, RECEPCIONISTA, MANTENIMIENTO |
| PATCH | `/api/v1/mantenimiento/:id` | ADMIN, GERENTE, RECEPCIONISTA, MANTENIMIENTO |

### Controller
`backend/src/controllers/mantenimiento.controller.ts` — usa `prisma.$queryRaw` y `prisma.$queryRawUnsafe` (tabla fuera del schema Prisma).

## Decisión técnica

**Por qué raw queries y no agregar al schema Prisma:**
- Agregar el modelo a `schema.prisma` requiere `prisma generate` y rebuild del contenedor
- La tabla es auxiliar y no tiene relaciones complejas que Prisma deba manejar
- Raw queries son suficientes y más rápidos de implementar

**Por qué drawer y no página dedicada:**
- El contexto de la habitación ya está en la lista — el drawer evita navegación adicional
- Recepción usa la lista constantemente; el drawer es más fluido que ir a otra página

## Conexiones

- [[Modulo 07 - Gestion de Habitaciones]] — Habitaciones.tsx es el host del drawer
- [[checkout.md]] — después del checkout, la habitación puede necesitar mantenimiento
