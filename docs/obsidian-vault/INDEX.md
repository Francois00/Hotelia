---
tags: [hotel-pms, indice, documentacion]
---

# 🏨 Hotel Management System — Documentación

> Sistema PMS hotelero: Node.js + React + Python IA
> Ver arquitectura completa → [[README-hotel-management-system]]

---

## 📋 Estado del proyecto

| Fase | Módulos | Estado |
|------|---------|--------|
| Fase 1 — Base operativa | 7, 11, 1, 3 | ✅ Completo |
| Fase 2 — Canales y sedes | 9, 8, 2 | ✅ Completo |
| Fase 3 — Operaciones | 10, 5, 4 | ✅ Completo |
| Fase 4 — IA y experiencia | 6, 12a, 12b | ✅ Completo |
| Fase 5 — Fidelización | 12c, 12d, 12e | 🔴 Pendiente |

---

## 🗂️ Módulos — Parte I: Nuevas Funcionalidades

| # | Módulo | Prioridad | Tiempo |
|---|--------|-----------|--------|
| 01 | [[Modulo 01 - Registro Manual RENIEC]] | 🔴 CRÍTICA | 2–3 sem |
| 02 | [[Modulo 02 - Notificaciones WhatsApp Grupo]] | 🟠 ALTA | 1 sem |
| 03 | [[Modulo 03 - Reporte de Turno]] | 🟠 ALTA | 2 sem |
| 04 | [[Modulo 04 - Historial Mejorado Clientes]] | 🟡 MEDIA | 1–2 sem |
| 05 | [[Modulo 05 - Mantenimiento por Habitacion]] | 🟡 MEDIA | 1–2 sem |
| 06 | [[Modulo 06 - Concierge IA Reservas WPP]] | 🟠 ALTA | 3–4 sem |

## 🗂️ Módulos — Parte II: Infraestructura y Experiencia

| # | Módulo | Prioridad | Tiempo |
|---|--------|-----------|--------|
| 07 | [[Modulo 07 - Gestion de Habitaciones]] | 🔴 CRÍTICA | 1 sem |
| 08 | [[Modulo 08 - Multi-sede]] | 🟠 ALTA | 2 sem |
| 09 | [[Modulo 09 - Channel Manager]] | 🔴 CRÍTICA | 2–3 sem |
| 10 | [[Modulo 10 - Almacen e Inventario]] | 🟠 ALTA | 2 sem |
| 11 | [[Modulo 11 - Control de Accesos por Rol]] | 🔴 CRÍTICA | 1 sem |
| 12 | [[Modulo 12 - Confort del Huesped]] | 🟡 MEDIA | 2–3 sem |

---

## 🗄️ Base de datos

- [[Tablas y Modelos de Datos]] — todas las tablas, campos y relaciones
- [[README-hotel-management-system]] — arquitectura general del sistema

---

## 📎 Documentos fuente

- `nuevas-funcionalidades-hotel-pms.docx`
- `modulos-adicionales-hotel-pms-v2.docx`


## Actualizado 2026-06-16

### Módulos adicionales implementados (fuera de fases originales)

| Módulo | Estado | Archivo |
|--------|--------|---------|
| Checkout wizard | ✅ Completo | [[checkout]] |
| Mantenimiento por habitación | ✅ Completo | [[mantenimiento]] |
| M10 Almacén e Inventario | ✅ Completo | [[Modulo 10 - Almacen e Inventario]] |
| Housekeeping plan del día | ✅ Completo | [[housekeeping]] |
| Jobs cron (4 automáticos) | ✅ Completo | [[jobs-cron]] |
| Reportes mensuales PDF/Excel | ✅ Completo | [[reportes]] |
| CRM Campañas WhatsApp | ✅ Completo | [[campanas-crm]] |
| Encuesta post-estancia | ✅ Completo | [[workflows]] |
| Solicitudes huéspedes | ✅ Completo | — |

### Arquitectura y operación

- [[vision-general]] — Diagrama ASCII completo + 4 flujos principales
- [[docker-compose]] — Todos los servicios documentados
- [[iniciar-sistema]] — Comandos exactos para arrancar desde cero
- [[webhook-whatsapp]] — Configuración Meta Business Manager
- [[credenciales]] — Usuarios y puertos del sistema
- [[concierge-llama3]] — Máquina de estados IA + integración Llama3
- [[workflows]] — 6 workflows n8n documentados
