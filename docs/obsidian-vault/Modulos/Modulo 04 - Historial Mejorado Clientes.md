---
tags: [hotel-pms, modulo, crm, clientes, historial, prioridad-media]
modulo: 4
prioridad: MEDIA
tiempo_estimado: 1-2 semanas
estado: pendiente
fase: 3
---

# Módulo 04 — Historial Mejorado de Clientes

← [[Modulo 03 - Reporte de Turno]] | [[INDEX]] | → [[Modulo 05 - Mantenimiento por Habitacion]]

> **Prioridad MEDIA** — Extiende el CRM existente. Depende de [[Modulo 01 - Registro Manual RENIEC]]

Mejora el perfil de huésped para que sea accesible desde recepción. Añade historial de habitaciones, gasto total, frecuencia de visitas y preferencias detectadas automáticamente por la IA.

---

## Pantallas necesarias

### Vista rápida (modal desde mapa)
Accesible desde el mapa de habitaciones o lista de check-ins:
- Nombre, tipo/nro. documento, teléfono, email
- Segmento CRM: `VIP` / `recurrente` / `ocasional` / `nuevo`
- Total visitas · Gasto total histórico (S/.) · Última visita
- Botón "Ver perfil completo"

### Perfil completo — 4 tabs

**Tab 1: Resumen (KPIs)**
- Total visitas · Total gastado · Promedio por estancia
- Fecha primera visita / última visita
- Tipo de habitación más frecuente
- Método de pago favorito · Score LTV

**Tab 2: Historial de estancias**
Tabla cronológica: Fecha entrada/salida, Habitación, Noches, Precio/noche, Total, Método pago, Comprobante (link)
Filtros: por año, por habitación, por monto

**Tab 3: Preferencias (IA)**
Detectadas automáticamente con % de confianza. El staff puede confirmar o descartar:
- Prefiere habitaciones altas
- Siempre paga en efectivo
- Viaja en fines de semana
- Solicita almohada extra frecuentemente

**Tab 4: Notas del personal**
Notas manuales: fecha, quién la escribió, texto libre. Visibles para todo el personal autorizado.

### Buscador de huéspedes
Búsqueda rápida desde el header del dashboard: nombre, DNI, RUC, teléfono, email.
Resultados con segmento CRM visible.

---

## Preferencias detectadas automáticamente (IA Python)

| Preferencia | Cómo se detecta |
|-------------|-----------------|
| Tipo de habitación preferida | Frecuencia > 60% sobre historial de reservas |
| Piso / ubicación preferida | Patrón en habitaciones elegidas históricamente |
| Franja horaria de llegada | Hora de check-in en las últimas 5 estancias |
| Método de pago habitual | Método más usado en últimas 5 estancias |
| Tipo de comprobante | Boleta o factura según historial |
| Solicitudes recurrentes | Registros del Concierge IA: late checkout, almohada, etc. |
| Temporada de visita | Alta, media o baja. Útil para campañas CRM |

---

## Cambios en el modelo de datos

| Campo / Tabla | Tipo | Notas |
|---------------|------|-------|
| `huespedes.preferencias_detectadas` | jsonb | Array de {tipo, valor, confianza_pct, confirmado, fecha} |
| `huespedes.notas_personal` | tabla aparte | `huespedes_notas` con FK |
| `huespedes.total_visitas` | int | Calculado por trigger |
| `huespedes.gasto_total` | decimal | Actualizado en cada checkout |
| `huespedes.ultima_visita` | date | Actualizada automáticamente en checkout |
| `huespedes.segmento_crm` | enum | vip \| recurrente \| ocasional \| inactivo \| nuevo — recalculado semanalmente por Python |

---

## Endpoints necesarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/huespedes/:id/perfil-completo` | Resumen, historial, preferencias, notas |
| GET | `/api/v1/huespedes/:id/estancias` | Historial paginado. Filtros: año, tipo_hab, monto |
| GET | `/api/v1/huespedes/:id/preferencias` | Lista con % de confianza |
| PATCH | `/api/v1/huespedes/:id/preferencias/:prefId` | Confirmar o descartar preferencia |
| POST | `/api/v1/huespedes/:id/notas` | Agregar nota del personal |
| GET | `/api/v1/huespedes/buscar` | Full-text: nombre, doc., email, teléfono |
| POST | `/api/v1/ia/preferencias/recalcular/:id` | Python: recalcula preferencias del huésped |

---

## Conexiones

- [[Modulo 01 - Registro Manual RENIEC]] — cada check-in actualiza el perfil
- [[Modulo 06 - Concierge IA Reservas WPP]] — personaliza la conversación con el historial
- [[Modulo 11 - Control de Accesos por Rol]] — recepcionista ve perfil básico; gerente ve CRM completo con LTV

