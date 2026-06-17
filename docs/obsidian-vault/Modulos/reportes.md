---
tags: [modulo, reportes, pdf, excel, gerencia, kpis]
fecha: 2026-06-16
estado: ✅ Completo e implementado
---

# Reportes Mensuales

> Ver también: [[jobs-cron]], [[campanas-crm]]

---

## Estado

✅ **Completo** — implementado en sprint 2026-05-21 (commit `fc6eaa5`)

Archivos:
- `backend/src/routes/reportes.ts`
- Frontend: integrado en ruta `/reportes` (solo GERENTE/ADMIN)

Dependencias: `pdfkit`, `exceljs`

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/reportes/mensual` | GERENTE, ADMIN | Datos JSON del reporte mensual |
| GET | `/api/v1/reportes/mensual/pdf` | GERENTE, ADMIN | PDF descargable del reporte |
| GET | `/api/v1/reportes/mensual/excel` | GERENTE, ADMIN | Excel (.xlsx) descargable |
| GET | `/api/v1/reportes/comparativo` | GERENTE, ADMIN | Comparativo mes actual vs mes anterior |

**Parámetro requerido**: `?mes=2026-06` (formato YYYY-MM)

---

## Contenido del reporte mensual

### JSON (`/reportes/mensual`)
```json
{
  "mes": "JUNIO 2026",
  "resumen": {
    "total_reservas": 42,
    "cancelaciones": 3,
    "no_shows": 1,
    "checkins": 38,
    "ingresos": "12840.00",
    "noches": 76
  },
  "metodos_pago": [
    { "metodo": "EFECTIVO", "total": "5200.00", "cantidad": 18 },
    { "metodo": "TARJETA", "total": "4800.00", "cantidad": 15 }
  ],
  "tipos_habitacion": [
    { "tipo": "DOBLE", "reservas": 22, "ingresos": "7920.00" }
  ],
  "top_huespedes": [
    { "nombre": "Juan Pérez", "reservas": 3, "total_pagado": "1080.00" }
  ],
  "detalle_reservas": [...]
}
```

### PDF (`/reportes/mensual/pdf`)
Headers de respuesta: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename=reporte-...pdf`

Estructura del PDF:
1. **Portada**: Logo hotel, título "REPORTE MENSUAL", mes y año
2. **Resumen ejecutivo**: tabla con reservas, cancelaciones, NO-SHOW, ingresos totales, noches totales
3. **Métodos de pago**: tabla con monto e cantidad por método
4. **Tipos de habitación**: ingresos y ocupación por tipo
5. **Top 5 huéspedes**: ranking por monto pagado
6. **Detalle de reservas**: tabla completa con código, huésped, habitación, fechas, estado, monto

### Excel (`/reportes/mensual/excel`)
Headers: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

Hojas del archivo:
- `Resumen` — KPIs del mes
- `Detalle Reservas` — una fila por reserva con todas las columnas
- `Métodos de Pago` — para análisis de cobros

### Comparativo (`/reportes/comparativo`)
Compara el mes actual vs el mes anterior:
```json
{
  "actual":   { "mes": "2026-06", "ingresos": 12840, "reservas": 42, "ocupacion_pct": 67 },
  "anterior": { "mes": "2026-05", "ingresos": 11200, "reservas": 38, "ocupacion_pct": 61 },
  "variacion_ingresos_pct": 14.6,
  "variacion_reservas_pct": 10.5
}
```

---

## Acceso frontend

Ruta: `/reportes`
Roles: GERENTE, ADMIN (bloqueado para otros roles)

Controles:
- Selector de mes (month picker)
- Botón "Ver reporte" → carga JSON
- Botón "Descargar PDF" → stream del PDF
- Botón "Descargar Excel" → stream del Excel
- Cards de KPIs principales
- Gráfico de ocupación por semana (si disponible)
