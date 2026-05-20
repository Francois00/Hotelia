---
tags: [hotel-pms, modulo, ia, whatsapp, reservas, concierge, prioridad-alta]
modulo: 6
prioridad: ALTA
tiempo_estimado: 3-4 semanas
estado: pendiente
fase: 4
---

# Módulo 06 — IA Concierge: Reservas desde WhatsApp

← [[Modulo 05 - Mantenimiento por Habitacion]] | [[INDEX]] | → [[Modulo 07 - Gestion de Habitaciones]]

> **Prioridad ALTA** — El más complejo. Depende de [[Modulo 01 - Registro Manual RENIEC]], [[Modulo 02 - Notificaciones WhatsApp Grupo]], [[Modulo 04 - Historial Mejorado Clientes]], [[Modulo 09 - Channel Manager]]

El Concierge IA procesa mensajes de WPP, detecta intenciones de reserva, extrae información, consulta disponibilidad y crea la reserva. Requiere un adelanto del 50% para confirmar.

---

## Flujo completo (16 pasos)

| # | Actor | Acción | Sistema |
|---|-------|--------|---------|
| 1 | Huésped | "Quiero una hab. para 2 personas del 20 al 23 de mayo" | n8n recibe via webhook WPP |
| 2 | IA Concierge | Analiza intención: "reserva". Extrae fechas y personas | NLP con LLM. Entidades faltantes = pregunta al huésped |
| 3 | IA Concierge | Si faltan datos: pregunta de forma natural | Flujo conversacional. Redis guarda contexto |
| 4 | Backend | Consulta disponibilidad | GET /habitaciones/disponibles |
| 5 | IA Concierge | Presenta opciones con precios | Mensaje formateado con emojis |
| 6 | Huésped | "La doble estándar está bien" | IA confirma y pide nombre + DNI |
| 7 | IA Concierge | "¿Tu nombre completo y DNI?" | Valida formato de DNI |
| 8 | Backend | Consulta RENIEC | → [[Modulo 01 - Registro Manual RENIEC]] |
| 9 | IA Concierge | Resumen + info del adelanto: "Para confirmar se requiere el **50%** (S/ {monto}). El saldo restante (S/ {saldo}) se paga al check-in." | Huésped puede modificar o confirmar |
| 10 | Huésped | "Sí, quiero confirmar" | IA explica métodos de pago |
| 11 | IA Concierge | "Puedes pagar por Yape al {nro}, Plin al {nro} o transferencia a {cuenta}. Envíame la foto del comprobante." | Datos de pago configurados por el hotel |
| 12 | Huésped | Envía foto del comprobante | n8n recibe adjunto |
| 13 | Backend | Registra adelanto con estado `adelanto_wpp_pendiente_verificacion` | Reserva en estado `pendiente_confirmacion_wpp` |
| 14 | Recepcionista | Revisa bandeja WPP: ve comprobante y hace clic "Verificar y confirmar" | Si pago OK: reserva pasa a "confirmada" |
| 15 | Backend | Crea reserva confirmada, bloquea habitación, registra adelanto en folio | canal = "whatsapp_ia" |
| 16 | IA Concierge | Envía confirmación con código de reserva, adelanto pagado y saldo al check-in | Plantilla aprobada por Meta |

---

## Casos especiales

| Caso | Manejo |
|------|--------|
| Huésped ya registrado | "¡Bienvenido de vuelta, {nombre}! ¿Quieres la misma habitación?" |
| Disponibilidad limitada | Ofrece alternativa o fechas distintas |
| Pide descuento | "Los precios especiales los maneja recepción directamente." → deriva a humano |
| Adelanto no recibido en 2h | Recordatorio automático. +1h sin respuesta → reserva "expirada", hab. se libera |
| Comprobante ilegible | Pide reenviar. Si falla 2 veces → deriva a recepción |
| Adelanto insuficiente | Recepcionista puede aprobar con nota o pedir diferencia |
| Conversación ambigua | Si confianza NLP < 70%: pide confirmación. Después de 2 intentos → deriva |
| Fuera de horario | "Disponible de 6am a 11pm. Anotamos tu interés." |
| Reserva en < 2 horas | No confirma automáticamente → alerta URGENTE a recepción |

---

## Pantallas del dashboard

| Pantalla | Descripción |
|----------|-------------|
| Bandeja de Reservas WPP | Lista con estado: pendiente_confirmacion / confirmada / modificada. Conversación expandible. |
| Detalle de reserva WPP | Thread completo. Sección de adelanto: monto requerido, imagen del comprobante, estado. Botones: "Verificar y confirmar", "Rechazar", "Modificar", "Cancelar". |
| Panel supervisión IA (Gerencia) | Métricas: reservas IA vs manual, tasa conversión, tiempo respuesta, tasa derivación. |
| Configuración Concierge IA | Horario atención, tipos de hab. ofrecibles, rango precios, umbral derivación, mensajes. |

---

## Modelo de datos (cambios y tablas nuevas)

| Campo / Tabla | Cambio |
|---------------|--------|
| `reservas.canal` | Agregar: `whatsapp_ia` |
| `reservas.estado` | Agregar: `pendiente_confirmacion_wpp`, `expirada` |
| `reservas.monto_adelanto` | decimal — 50% del total |
| `reservas.adelanto_pagado` | decimal — monto verificado |
| `reservas.adelanto_verificado_por` | UUID FK — recepcionista que verificó |
| `pagos.tipo_pago` | Agregar: `adelanto_wpp` |
| `pagos.comprobante_imagen_url` | URL foto del comprobante del huésped |
| `wpp_conversaciones` | id, huesped_telefono, thread_id, contexto_ia (jsonb), reserva_id |
| `wpp_mensajes` | id, conversacion_id, direccion, contenido, intencion_detectada, confianza_pct |
| `ia_extracciones` | id, conversacion_id, entidad, valor, confianza, confirmado_por_huesped |

---

## Endpoints necesarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/concierge/webhook-wpp` | Recibe mensajes entrantes de Meta |
| POST | `/api/v1/concierge/procesar-mensaje` | Python NLP: extracción + generación de respuesta |
| GET | `/api/v1/concierge/conversaciones` | Lista conversaciones activas |
| POST | `/api/v1/concierge/adelanto/registrar` | Registra comprobante de adelanto |
| POST | `/api/v1/concierge/adelanto/:pagoId/verificar` | Recepcionista aprueba o rechaza el adelanto |
| POST | `/api/v1/concierge/conversaciones/:id/confirmar` | Confirma la reserva WPP |
| POST | `/api/v1/concierge/conversaciones/:id/derivar` | Deriva a recepcionista humano |
| GET | `/api/v1/concierge/metricas` | KPIs de la IA |

---

## Integración Python

- **NLP**: `POST /ia/concierge/extraer-entidades` — intención + entidades + siguiente pregunta si faltan datos
- **Respuesta**: `POST /ia/concierge/generar-respuesta` — texto en español natural, tono amigable
- **Memoria**: Contexto en Redis TTL 24h
- **Modelo sugerido**: GPT-4o / Claude. Temperatura 0.3 para respuestas consistentes

