---
tags: [hotel-pms, modulo, habitaciones, inventario, tarifas, prioridad-critica]
modulo: 7
prioridad: CRÍTICA
tiempo_estimado: 1 semana
estado: pendiente
fase: 1
---

# Módulo 07 — Gestión de Habitaciones

← [[Modulo 06 - Concierge IA Reservas WPP]] | [[INDEX]] | → [[Modulo 08 - Multi-sede]]

> **Prioridad CRÍTICA — Desarrollar primero. Es la base de todo el sistema.**

Configura el inventario completo de habitaciones: tipos, tarifas, amenities, capacidades y estados. Alimenta el Revenue Manager IA, el mapa visual y los canales externos.

---

## Pantallas necesarias

| Pantalla | Descripción |
|----------|-------------|
| Lista de habitaciones | Tabla con: nro., piso, tipo, estado, capacidad, tarifa base/min/max, amenities, acciones. Filtros: piso, tipo, estado. Botón "Nueva habitación". |
| Formulario nueva / editar | Datos generales + tarifas + amenities (checkboxes) + fotos (hasta 10) + notas internas. |
| Vista por tipo | Agrupa por tipo. Muestra cuántas hay, cuántas disponibles, tarifa promedio, ocupación 30 días. Permite editar tarifa base de un tipo completo. |
| Galería de fotos | Drag & drop para ordenar. Marcar foto principal. Hasta 10 fotos por hab. |
| Tipos personalizados | El gerente crea tipos propios con nombre, descripción y color en el mapa. |

---

## Datos que maneja

| Campo | Tipo | Descripción |
|-------|------|-------------|
| numero | string | Identificador visible (101, PH1). Único por hotel |
| piso | int | Para agrupación en el mapa |
| tipo | enum / FK | simple \| doble \| triple \| suite \| familiar + personalizados |
| descripcion | text | Visible al huésped en Booking, web propia |
| capacidad_adultos | int | Validado en check-in |
| capacidad_ninos | int | Puede ser 0 |
| metros_cuadrados | int | Opcional, visible en OTAs |
| tarifa_base | decimal | Punto de partida del Revenue Manager |
| tarifa_minima | decimal | Revenue Manager no baja de aquí |
| tarifa_maxima | decimal | Revenue Manager no sube de aquí |
| moneda_tarifa | enum | PEN \| USD |
| amenities | jsonb | ["wifi","ac","tv_cable","frigobar","caja_fuerte",...] |
| fotos | jsonb | [{url, orden, es_principal}] |
| estado | enum | disponible \| ocupada \| limpieza \| mantenimiento \| bloqueada \| fuera_servicio |
| visible_otas | boolean | Si false: no aparece en Booking/Expedia |
| hotel_id | UUID FK | Multi-sede: → [[Modulo 08 - Multi-sede]] |

### Amenities predefinidos (checkboxes)
WiFi · AC · TV cable · Frigobar · Caja fuerte · Bañera · Ducha · Balcón · Vista al mar · Vista ciudad · Escritorio · Plancha · Secador de pelo + campo libre para amenity personalizado

---

## Reglas de tarifas por temporada

| Tipo | Ejemplo | Ajuste | Cómo funciona |
|------|---------|--------|---------------|
| Temporada alta | Fiestas patrias, Navidad | +30% sobre tarifa base | Revenue Manager parte de la base ajustada |
| Temporada baja | Meses de menor demanda | -10% hasta tarifa mínima | Nunca baja del mínimo configurado |
| Fin de semana | Viernes y sábado | +15% automático | Aplica sobre cualquier otra regla activa |
| Evento especial | Concierto, feria, fecha específica | +X% configurable | Gerente agrega fecha y porcentaje |
| Estadía larga | 7+ noches | -8% descuento volumen | Incentiva estadías largas |

---

## Endpoints necesarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/habitaciones` | Lista con filtros. Incluye tarifa_sugerida_hoy del Revenue Manager |
| POST | `/api/v1/habitaciones` | Crear hab. Solo gerente |
| GET | `/api/v1/habitaciones/:id` | Detalle: datos, fotos, historial precios 30 días, reserva activa |
| PUT | `/api/v1/habitaciones/:id` | Editar todos los datos. Solo gerente |
| PATCH | `/api/v1/habitaciones/:id/estado` | Cambiar estado según rol |
| DELETE | `/api/v1/habitaciones/:id` | Baja lógica. Solo si no hay reservas activas |
| POST | `/api/v1/habitaciones/:id/fotos` | Subir fotos. Máximo 10 |
| GET | `/api/v1/tipos-habitacion` | Lista tipos disponibles |
| POST | `/api/v1/tipos-habitacion` | Crear tipo personalizado. Solo gerente |
| POST | `/api/v1/habitaciones/tarifas/temporada` | Crear regla de temporada |

---

## Conexiones

- [[Modulo 01 - Registro Manual RENIEC]] — usa disponibilidad y tarifa base
- [[Modulo 05 - Mantenimiento por Habitacion]] — cada hab. tiene su historial
- [[Modulo 09 - Channel Manager]] — sincroniza disponibilidad con Booking/Expedia
- [[Modulo 08 - Multi-sede]] — cada hab. tiene `hotel_id`
- [[Modulo 11 - Control de Accesos por Rol]] — solo gerente puede crear/editar

