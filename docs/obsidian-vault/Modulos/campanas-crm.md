---
tags: [modulo, crm, campanas, whatsapp, segmentacion, marketing]
fecha: 2026-06-16
estado: ✅ Completo e implementado
---

# CRM — Campañas WhatsApp

> Ver también: [[Modulo 04 - Historial Mejorado Clientes]], [[Modulo 02 - Notificaciones WhatsApp Grupo]], [[jobs-cron]]

---

## Estado

✅ **Completo** — implementado en sprint 2026-05-21 (commit `fc6eaa5`)

Archivos:
- `backend/src/routes/campanas.ts`
- `frontend/src/pages/CRM.tsx`

---

## Segmentos objetivo

| Segmento | Criterio | Caso de uso |
|----------|----------|-------------|
| `VIP` | 5+ reservas completadas y LTV ≥ S/ 1000 | Ofertas exclusivas, upgrades |
| `RECURRENTE` | 3+ reservas completadas | Descuento fidelidad |
| `INACTIVO` | 1 reserva, hace +90 días | Campaña de reactivación |
| `SIN_RETORNO` | Huéspedes sin reservas en el último año | Recuperar cliente |
| `TODOS` | Toda la base de contactos | Comunicados generales |

Los segmentos se recalculan automáticamente cada domingo a las 03:00 AM por el Job CRM. Ver [[jobs-cron]].

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/campanas` | GERENTE, ADMIN | Listar todas las campañas con estado |
| POST | `/api/v1/campanas/preview` | GERENTE, ADMIN | Vista previa: quién recibirá la campaña |
| POST | `/api/v1/campanas` | GERENTE, ADMIN | Crear nueva campaña (estado: BORRADOR) |
| POST | `/api/v1/campanas/:id/enviar` | GERENTE, ADMIN | Ejecutar envío en background |
| GET | `/api/v1/campanas/:id/estado` | GERENTE, ADMIN | Progreso del envío (enviados/total) |

---

## Flujo de creación y envío

```
1. POST /campanas → crea campaña en BORRADOR
   { nombre, tipo: "WHATSAPP", segmento_objetivo, mensaje_whatsapp }

2. POST /campanas/preview → simula quiénes recibirían
   { segmento_objetivo } → devuelve { total, muestra: [...5 primeros] }

3. POST /campanas/:id/enviar → ejecuta el envío
   → consulta huéspedes del segmento con teléfono activo
   → actualiza campana.total_destinatarios
   → itera: por cada huésped con teléfono:
       delay 1000ms entre envíos (rate limiting Meta)
       POST graph.facebook.com/v18.0/{PHONE_ID}/messages
       INSERT campanas_envios (estado: ENVIADO o FALLIDO)
       campana.total_enviados++
   → estado final: ENVIADA + fecha_enviada

4. GET /campanas/:id/estado → polling del frontend
   { total_destinatarios, total_enviados, porcentaje, estado }
```

---

## Tablas de base de datos

### `campanas_crm`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| nombre | VARCHAR(255) | Nombre descriptivo de la campaña |
| tipo | TipoCampana | WHATSAPP (implementado) / EMAIL |
| segmento_objetivo | SegmentoCampana | VIP / RECURRENTE / INACTIVO / TODOS |
| estado | EstadoCampana | BORRADOR → ENVIADA |
| fecha_programada | TIMESTAMPTZ | null en envío inmediato |
| fecha_enviada | TIMESTAMPTZ | Cuando termina el envío |
| total_destinatarios | INT | Total del segmento |
| total_enviados | INT | Enviados exitosamente |
| total_abiertos | INT | Abiertos (no rastreado aún en WPP) |
| mensaje_whatsapp | TEXT | Contenido del mensaje |
| personal_id | UUID | Quién creó la campaña |

### `campanas_envios`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| campana_id | UUID | FK → campanas_crm |
| huesped_id | UUID | FK → huespedes |
| estado | VARCHAR | ENVIADO / FALLIDO |
| mensaje_id_wpp | VARCHAR | ID de mensaje de Meta (para tracking) |
| error | TEXT | Mensaje de error si falló |
| created_at | TIMESTAMPTZ | Timestamp del intento |

---

## Rate limiting y seguridad

- **Delay de 1 segundo** entre envíos para no exceder límites de Meta (80 mensajes/segundo tier standard)
- El envío ocurre en background: el endpoint devuelve `202 Accepted` inmediatamente
- Usar `GET /campanas/:id/estado` para hacer polling del progreso
- Solo se envía a huéspedes con `telefono NOT NULL` y `activo = true`
- Si un envío falla, se registra el error en `campanas_envios` y continúa con el siguiente

---

## Vista frontend (CRM.tsx)

Ruta: `/crm`
Roles: GERENTE, ADMIN

Componentes:
- Lista de campañas con badges de estado (BORRADOR, ENVIADA)
- Modal "Nueva campaña": selector de segmento, campo de mensaje, preview
- Barra de progreso de envío en tiempo real (polling cada 2s)
- Estadísticas: total enviados, fallidos, tasa de entrega
