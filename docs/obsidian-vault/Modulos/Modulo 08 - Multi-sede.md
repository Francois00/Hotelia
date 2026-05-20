---
tags: [hotel-pms, modulo, multi-sede, empresa, prioridad-alta]
modulo: 8
prioridad: ALTA
tiempo_estimado: 2 semanas
estado: pendiente
fase: 2
---

# Módulo 08 — Multi-sede: Varias Propiedades

← [[Modulo 07 - Gestion de Habitaciones]] | [[INDEX]] | → [[Modulo 09 - Channel Manager]]

> **Prioridad ALTA** — Depende de [[Modulo 07 - Gestion de Habitaciones]] y [[Modulo 11 - Control de Accesos por Rol]]

Una empresa, múltiples hoteles desde un único sistema. Cada sede tiene su propio inventario, personal, tarifas y canales.

---

## Tabla `hoteles` (nueva — raíz de todo el sistema)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador único de la sede |
| empresa_id | UUID FK | Agrupa todas las sedes de la misma empresa |
| nombre | string | Nombre comercial (ej: Hotel Mirador Arequipa) |
| nombre_corto | string | Código para reportes (ej: MIR-AQP) |
| ruc | string | RUC fiscal para comprobantes SUNAT |
| razon_social | string | Razón social del establecimiento |
| direccion | string | Dirección física completa |
| ciudad / pais | string | Ubicación |
| telefono / email_contacto | string | Contacto público |
| zona_horaria | string | Para check-in/out. Ej: America/Lima |
| moneda_default | enum | PEN \| USD |
| hora_checkin | time | Default: 14:00 |
| hora_checkout | time | Default: 12:00 |
| configuracion | jsonb | Política cancelación, % adelanto WPP, etc. |

---

## Tablas afectadas (agregar `hotel_id`)

| Tabla | Cambio |
|-------|--------|
| `habitaciones` | Agregar `hotel_id` FK |
| `personal` | Agregar `hotel_id` FK nullable (null = corporativo) |
| `turnos` | Agregar `hotel_id` FK |
| `tarifas_historial` | Agregar `hotel_id` FK |
| `canal_sync_log` | Agregar `hotel_id` FK |
| `config_integraciones` | Tabla nueva por sede (credenciales WPP, Booking, Expedia) |

---

## Niveles de acceso

| Tipo de usuario | Acceso | Qué puede hacer |
|-----------------|--------|-----------------|
| Superadmin / Dueño | Todas las sedes | Dashboard corporativo, crear/editar sedes, reportes cualquier sede |
| Gerente corporativo | Todas las sedes | KPIs consolidados, ver reportes. Sin editar configuración |
| Gerente de sede | Solo su sede | Acceso completo a su sede |
| Recepcionista | Solo su sede | Reservas, check-in/out, habitaciones |
| Housekeeping / Mantenimiento | Solo su sede | Solo su función |

> El JWT incluye `hotel_ids: []`. El middleware valida que cada request acceda solo a sedes del token.

---

## Pantallas necesarias

| Pantalla | Descripción |
|----------|-------------|
| Selector de sede (header global) | Dropdown en el header. Cambiar sede filtra todos los datos. Gerentes corporativos: opción "Todas las sedes". |
| Dashboard corporativo | KPIs comparativos: ocupación %, ingresos hoy, RevPAR por sede. Ranking de sedes. Alertas. |
| Gestión de sedes | Lista de sedes, crear nueva, editar, activar/desactivar, ver personal. |
| Asignación de personal | Ver empleados por sede, mover entre sedes, crear usuario corporativo. |

---

## Endpoints necesarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/hoteles` | Sedes accesibles para el usuario autenticado |
| POST | `/api/v1/hoteles` | Crear sede. Solo superadmin |
| PUT | `/api/v1/hoteles/:id` | Editar datos de sede |
| GET | `/api/v1/hoteles/:id/dashboard` | KPIs en tiempo real de una sede |
| GET | `/api/v1/hoteles/consolidado` | Dashboard corporativo: KPIs de todas las sedes |
| POST | `/api/v1/hoteles/:id/personal` | Asignar empleado a esta sede |

---

## Conexiones

- [[Modulo 07 - Gestion de Habitaciones]] — cada hab. tiene `hotel_id`
- [[Modulo 11 - Control de Accesos por Rol]] — los roles se validan por sede
- [[Modulo 09 - Channel Manager]] — cada sede tiene sus propias credenciales de OTA
- [[Modulo 03 - Reporte de Turno]] — los reportes son por sede

