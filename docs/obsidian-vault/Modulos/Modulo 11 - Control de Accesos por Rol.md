---
tags: [hotel-pms, modulo, roles, permisos, seguridad, prioridad-critica]
modulo: 11
prioridad: CRÍTICA
tiempo_estimado: 1 semana
estado: pendiente
fase: 1
---

# Módulo 11 — Control de Accesos por Rol

← [[Modulo 10 - Almacen e Inventario]] | [[INDEX]] | → [[Modulo 12 - Confort del Huesped]]

> **Prioridad CRÍTICA — Desarrollar en Fase 1 junto a [[Modulo 07 - Gestion de Habitaciones]]**

Define qué puede ver y hacer cada tipo de usuario. El recepcionista solo accede a lo necesario para su turno. El gerente tiene visibilidad total.

---

## Matriz de accesos

| Módulo / Funcionalidad | GERENTE | RECEPCIÓN | HOUSEKP. | MANTENIM. |
|------------------------|:-------:|:---------:|:--------:|:---------:|
| Dashboard KPIs y métricas | ✅ | — | — | — |
| Revenue Manager IA (ver y aprobar tarifas) | ✅ | — | — | — |
| Mapa de habitaciones (ver estado) | ✅ | ✅ | ✅ | ✅ |
| Gestión de habitaciones (crear/editar) | ✅ | — | — | — |
| Reservas: ver lista completa | ✅ | ✅ | — | — |
| Reservas: crear y modificar | ✅ | ✅ | — | — |
| Reservas: cancelar | ✅ | — | — | — |
| Check-in (realizar) | ✅ | ✅ | — | — |
| Check-out (realizar) | ✅ | ✅ | — | — |
| Facturación: emitir comprobantes | ✅ | ✅ | — | — |
| Reporte de turno: abrir/cerrar turno | ✅ | ✅ | — | — |
| Reporte de turno: ver histórico | ✅ | — | — | — |
| CRM: ver perfil básico del huésped | ✅ | ✅ | — | — |
| CRM: análisis LTV y segmentación | ✅ | — | — | — |
| CRM: campañas automáticas | ✅ | — | — | — |
| Mantenimiento: ver órdenes | ✅ | ✅ | — | ✅ |
| Mantenimiento: crear y cerrar órdenes | ✅ | — | — | ✅ |
| Housekeeping: ver plan del día | ✅ | ✅ | ✅ | — |
| Housekeeping: marcar habitación como lista | ✅ | — | ✅ | — |
| Almacén: ver stock | ✅ | ✅ | — | — |
| Almacén: registrar entradas y salidas | ✅ | ✅ | — | — |
| Almacén: hacer inventariado físico | ✅ | — | — | — |
| Channel Manager: ver estado canales | ✅ | — | — | — |
| Channel Manager: abrir/cerrar hab. OTAs | ✅ | — | — | — |
| Concierge IA: bandeja reservas WPP | ✅ | ✅ | — | — |
| Concierge IA: supervisión y métricas | ✅ | — | — | — |
| Notificaciones grupo WPP: configurar | ✅ | — | — | — |
| Multi-sede: gestión de sedes | ✅ | — | — | — |
| Gestión de personal (crear/editar) | ✅ | — | — | — |
| Configuración del sistema | ✅ | — | — | — |
| Gastos de caja: registrar | ✅ | ✅ | — | — |
| Gastos de caja: ver histórico completo | ✅ | — | — | — |

---

## Vistas del sistema por rol

### Vista de Recepcionista
Menú simplificado — solo aparece:
- 🗺️ Habitaciones (mapa)
- 📅 Reservas
- 🛎️ Check-in / Check-out
- 💰 Turno (caja)
- 📦 Almacén (consulta y movimientos)
- 💬 Concierge WPP (bandeja)

### Vista de Gerente
Header completo con todos los módulos. Dashboard como pantalla de inicio.

### Vista de Housekeeping
Solo: plan del día con habitaciones a limpiar por prioridad. Puede marcar como "Lista para ocupar". Sin acceso a reservas ni datos de huéspedes.

### Vista de Mantenimiento
Solo: órdenes de trabajo asignadas. Puede cambiar estado a "En proceso" o "Resuelto".

---

## Implementación técnica

| Aspecto | Detalle |
|---------|---------|
| JWT con roles | Token incluye: `id, nombre, rol, hotel_ids[], permisos_extra[]` |
| Middleware backend | Cada endpoint valida el rol. Si no tiene permiso: 403 Forbidden |
| Frontend rutas protegidas | React Router por rol. Si recepcionista va a `/dashboard-kpis`: redirección automática |
| Log de auditoría | Tabla `audit_log`: quién, cuándo, desde qué IP, qué cambió. Solo gerente puede ver |
| Contraseña obligatoria | Al crear usuario: contraseña temporal. Cambio obligatorio en primer login. Mínimo 10 caracteres |

---

## Endpoints necesarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login. Retorna JWT con rol, hotel_ids y permisos |
| POST | `/api/v1/auth/cambiar-password` | Requiere contraseña actual |
| POST | `/api/v1/auth/reset-password` | Reset por gerente: envía temporal por email |
| GET | `/api/v1/personal` | Lista empleados. Filtros: rol, activo, hotel |
| POST | `/api/v1/personal` | Crear empleado. Solo gerente |
| PUT | `/api/v1/personal/:id` | Editar nombre, rol, sedes, permisos extra |
| DELETE | `/api/v1/personal/:id` | Baja lógica. Solo gerente |
| GET | `/api/v1/audit-log` | Historial de acciones. Solo gerente |

---

## Conexiones

- Todos los módulos dependen de este para autorización
- [[Modulo 08 - Multi-sede]] — los roles se validan por sede
- Tabla existente `personal` ya tiene campo `rol` — solo se extiende con `hotel_ids[]` y `permisos_extra[]`

