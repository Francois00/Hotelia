---
tags: [hotel-pms, modulo, experiencia, huesped, whatsapp, encuesta, prioridad-media]
modulo: 12
prioridad: MEDIA
tiempo_estimado: 2-3 semanas (por submodulo)
estado: pendiente
fase: 4-5
---

# Módulo 12 — Confort del Huésped

← [[Modulo 11 - Control de Accesos por Rol]] | [[INDEX]]

Funcionalidades experienciales que mejoran la percepción del hotel y generan diferenciación frente a la competencia. Ninguna bloquea la operación, pero impactan en las reseñas y en la fidelización.

---

## Resumen de submodulos

| Submodulo | Prioridad | Qué hace | Canal | Fase |
|-----------|-----------|----------|-------|------|
| 12a — Check-in Digital QR | 🟠 ALTA | QR por WPP → check-in sin esperar en recepción | WhatsApp + Dashboard | 4 |
| 12b — Solicitudes en tiempo real | 🟠 ALTA | Huésped pide toallas/mantenimiento/room service por WPP → llega al dashboard | WhatsApp → Dashboard | 4 |
| 12c — Encuesta de satisfacción | 🟠 ALTA | 24h post-checkout: 5 preguntas. Resultados en el dashboard | WhatsApp / Email | 5 |
| 12d — Carta digital de servicios | 🟡 MEDIA | QR en la habitación → menú web: restaurante, room service, solicitudes | Web / QR | 5 |
| 12e — Late Checkout / Early Check-in IA | 🟡 MEDIA | Huésped pide por WPP. IA verifica y cobra en folio | WhatsApp → Folio | 5 |
| 12f — Guía del destino | 🔵 BAJA | Al check-in: chatbot envía restaurantes y actividades cercanas | WhatsApp | 5 |
| 12g — Gestor de reseñas | 🟡 MEDIA | Detecta reseñas de Google/Booking. IA sugiere respuestas. Análisis de sentimiento | Dashboard | 5 |
| 12h — Programa de fidelización | 🔵 BAJA | Puntos por estadía → descuentos o upgrades. Gestión desde CRM | WPP / Email | 5 |

---

## 12b — Solicitudes en tiempo real por WhatsApp (ALTA prioridad)

| Tipo | Mensaje del huésped | Cómo lo maneja el sistema |
|------|---------------------|--------------------------|
| Toallas extra | "Necesito 2 toallas más para la hab 203" | IA detecta `solicitud_housekeeping`. Crea solicitud y notifica al personal en el dashboard |
| Problema técnico | "El AC hace un ruido raro" | IA detecta `mantenimiento`. Crea orden urgente → [[Modulo 05 - Mantenimiento por Habitacion]] |
| Room service | "¿Puedo pedir un sándwich y dos jugos?" | IA responde con opciones y precios. Al confirmar: pedido en el folio |
| Late checkout | "¿Puedo quedarme hasta las 2pm?" | IA verifica disponibilidad. Si libre: aprueba y cobra extra al folio |
| Info general | "¿A qué hora cierra el restaurante?" | Respuesta automática desde la base de conocimiento del hotel |

**Pantalla de solicitudes (recepción)**:
Bandeja de solicitudes entrantes. Nro. habitación, tipo, hora, estado (pendiente/atendido). Notificación sonora. Botón "Marcar como atendido".

---

## 12c — Encuesta de satisfacción automática (ALTA prioridad)

- **Disparador**: n8n ejecuta el flujo `encuesta_post_estancia` 24h después de cada checkout
- **Formato**: 5 preguntas con estrellas 1–5: Limpieza · Comodidad · Atención · Relación calidad/precio · ¿Recomendarías el hotel?
- **Campo libre**: Comentarios adicionales
- **Canal**: WhatsApp (si tiene teléfono) · Email (si tiene email) · Ambos si tiene los dos
- **Dashboard**: NPS por período, puntuación promedio por categoría, comentarios recientes
- **Alerta**: Si un huésped da 1–2 estrellas → alerta inmediata al gerente
- **CRM**: La puntuación se guarda en el perfil del huésped → [[Modulo 04 - Historial Mejorado Clientes]]

---

## 12a — Check-in Digital QR

**Flujo**:
1. Confirmación de reserva → n8n genera QR único
2. Envío por WhatsApp → [[Modulo 02 - Notificaciones WhatsApp Grupo]]
3. Huésped escanea al llegar → check-in en 10 segundos
4. Recepcionista solo confirma en el dashboard

**Pantallas nuevas**:
- Lector QR en el dashboard (modo pantalla completa para tablet de recepción)
- Modal de confirmación con foto del huésped si existe en el CRM

---

## Tablas nuevas requeridas

| Tabla | Campos clave |
|-------|-------------|
| `solicitudes_huesped` | id, hotel_id, habitacion_id, reserva_id, tipo, descripcion, estado, atendido_por, created_at, atendido_at |
| `encuestas_satisfaccion` | id, reserva_id, huesped_id, puntuaciones (jsonb), comentario, nps_score, canal_envio, respondida_at |
| `reviews_externas` | id, hotel_id, plataforma, texto, puntuacion, fecha_review, sentimiento_ia, respuesta_gerente |
| `puntos_fidelizacion` | id, huesped_id, hotel_id, puntos_acumulados, puntos_usados, historial (jsonb) |

---

## Conexiones

- [[Modulo 02 - Notificaciones WhatsApp Grupo]] — solicitudes y alertas llegan al grupo
- [[Modulo 04 - Historial Mejorado Clientes]] — encuestas se guardan en el perfil del huésped
- [[Modulo 05 - Mantenimiento por Habitacion]] — solicitudes técnicas crean órdenes de mantenimiento
- [[Modulo 06 - Concierge IA Reservas WPP]] — el concierge IA también maneja las solicitudes en estancia
- [[Modulo 09 - Channel Manager]] — reseñas externas de Booking y Google

