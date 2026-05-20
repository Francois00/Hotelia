---
tags: [hotel-pms, modulo, mantenimiento, habitaciones, prioridad-media]
modulo: 5
prioridad: MEDIA
tiempo_estimado: 1-2 semanas
estado: pendiente
fase: 3
---

# Módulo 05 — Historial de Mantenimiento por Habitación

← [[Modulo 04 - Historial Mejorado Clientes]] | [[INDEX]] | → [[Modulo 06 - Concierge IA Reservas WPP]]

> **Prioridad MEDIA** — Extiende el mantenimiento predictivo existente. Depende de [[Modulo 07 - Gestion de Habitaciones]]

Registra el historial completo de intervenciones por habitación: quién lo hizo, cuánto tardó, cuánto costó y el tiempo fuera de servicio.

---

## Pantallas necesarias

| Pantalla | Descripción |
|----------|-------------|
| Ficha de habitación (tab Mantenimiento) | Stats: total intervenciones, costo total, días fuera de servicio. Lista cronológica de trabajos. |
| Registro de trabajo | Modal: tipo problema, descripción, técnico, fecha inicio/fin, costo estimado, prioridad, fotos. |
| Lista global de mantenimiento | Todas las habitaciones. Alertas: sin revisión > X días, costo acumulado alto, más incidencias. |
| Dashboard de costos (Gerencia) | Gráficas por habitación, tipo problema, período. ROI preventivo vs correctivo. |

---

## Tabla `mantenimiento_registros` (nueva)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador único |
| habitacion_id | UUID FK | → [[Modulo 07 - Gestion de Habitaciones]] |
| tipo_problema | enum | electrico \| plomeria \| mobiliario \| climatizacion \| limpieza_profunda \| otro |
| descripcion | text | Detalle del problema o trabajo |
| tecnico_nombre | string | Nombre del técnico |
| tecnico_id | UUID FK nullable | Si es personal interno: FK a tabla personal |
| fecha_inicio | timestamp | Inicio intervención (hab. entra a mantenimiento) |
| fecha_fin | timestamp nullable | Fin intervención (hab. vuelve a disponible) |
| horas_fuera_servicio | decimal | Calculado: fecha_fin − fecha_inicio |
| costo_estimado | decimal | Costo estimado en soles |
| costo_real | decimal nullable | Costo real final |
| estado | enum | pendiente \| en_proceso \| resuelto \| cancelado |
| prioridad | enum | baja \| media \| alta \| urgente |
| reportado_por | UUID FK | FK a personal |
| fotos_urls | jsonb | Array de URLs (S3 o almacenamiento propio) |
| notas_cierre | text nullable | Observaciones al resolver |

---

## Integración con IA Python

| Función | Detalle |
|---------|---------|
| Datos que consume | Historial de `mantenimiento_registros` + patrones de uso por habitación |
| Predicciones | "Hab. 205 tiene alta probabilidad de problema eléctrico en las próximas 2 semanas" |
| Alertas preventivas | Si detecta riesgo: crea registro tipo "preventivo" + notifica al grupo WPP → [[Modulo 02 - Notificaciones WhatsApp Grupo]] |
| KPIs calculados | MTBF (tiempo medio entre fallos), costo de mantenimiento por noche ocupada |

---

## Endpoints necesarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/habitaciones/:id/mantenimiento` | Historial completo. Filtros: tipo, estado, fecha |
| POST | `/api/v1/habitaciones/:id/mantenimiento` | Registra nueva orden. Cambia estado hab. a "mantenimiento" |
| PATCH | `/api/v1/mantenimiento/:registroId` | Actualiza: asignar técnico, cambiar estado, agregar costo real |
| GET | `/api/v1/mantenimiento` | Lista global. Filtros: hab., estado, prioridad, técnico |
| GET | `/api/v1/mantenimiento/stats` | KPIs: costo por hab., días fuera servicio, tipos frecuentes |
| POST | `/api/v1/ia/mantenimiento/predicciones` | Python: genera predicciones preventivas para todas las habs. |

---

## Conexiones

- [[Modulo 07 - Gestion de Habitaciones]] — cada hab. tiene su historial de mantenimiento
- [[Modulo 02 - Notificaciones WhatsApp Grupo]] — alertas de mantenimiento urgente al grupo
- [[Modulo 11 - Control de Accesos por Rol]] — personal de mantenimiento puede ver y gestionar sus órdenes

