---
tags: [ia, concierge, llama3, ollama, whatsapp, state-machine]
fecha: 2026-06-16
estado: ✅ completo
---

# Concierge IA — Llama3 + máquina de estados

> Ver también: [[Modulo 06 - Concierge IA Reservas WPP]], [[webhook-whatsapp]], [[workflows]]

Archivo: `backend/src/services/concierge.service.ts`
Endpoint de prueba: `POST /api/v1/concierge/chat`
Integración n8n: `POST /api/v1/n8n/interpretar-mensaje`

---

## Cómo se llama a Llama3

```typescript
// POST http://localhost:11434/api/generate
const response = await axios.post(`${OLLAMA_URL()}/api/generate`, {
  model:  'llama3',
  prompt: `${systemPrompt}\n\n${historial}\n\nUsuario: ${mensaje}\nAria:`,
  stream: false,
  options: { temperature: 0.4, num_predict: 300 },
});
const texto: string = response.data.response;
```

**Variables de entorno:**
- `OLLAMA_URL`: `http://localhost:11434` (dev) / `http://host.docker.internal:11434` (Docker)

**Modelo usado:** `llama3` (8B parámetros). Temperatura 0.4 para respuestas consistentes.

---

## Máquina de estados

```
[inicio]
    │ "quiero reservar" / "habitación"
    ▼
[pidiendo_fechas]
    │ regex detecta fechas (del X al Y de mes)
    ▼
[pidiendo_personas]
    │ número de personas (1, 2, "dos adultos")
    ▼
[mostrando_habitaciones]
    │ GET /habitaciones/disponibles → lista opciones
    │ huésped elige (número, tipo, o "la doble")
    ▼
[pidiendo_nombre]
    │ nombre completo
    ▼
[pidiendo_dni]
    │ DNI (8 dígitos) / Pasaporte
    ▼
[confirmando]
    │ resumen: hab, fechas, tarifa, nombre
    │ "¿confirmo?" → SÍ
    ▼
[finalizado]
    → POST /huespedes (upsert)
    → POST /reservas (crea reserva canal=WHATSAPP)
    → limpiarConversacion(telefono)
```

### Pasos en detalle

| Paso | Trigger entrada | Acción | Trigger salida |
|------|----------------|--------|---------------|
| `inicio` | Cualquier mensaje | Saluda como "Aria", pide fechas | Mensaje con intención de reserva |
| `pidiendo_fechas` | Huésped menciona habitación/reserva | Extrae fechas con 4 patrones regex | Fechas válidas encontradas |
| `pidiendo_personas` | Fechas detectadas | Pide número de personas | Número extraído del mensaje |
| `mostrando_habitaciones` | Personas conocidas | Consulta disponibilidad, muestra opciones numeradas con precios | Huésped elige una opción |
| `pidiendo_nombre` | Habitación seleccionada | Pide nombre completo | Nombre con mínimo 5 chars |
| `pidiendo_dni` | Nombre capturado | Pide DNI/Pasaporte | DNI (8 dígitos) detectado |
| `confirmando` | DNI capturado | Muestra resumen completo + tarifa total | Huésped confirma ("sí", "ok", "confirmo") |
| `finalizado` | Confirmación recibida | Crea huésped + reserva en BD, envía código | — |

---

## Cómo se mantiene el estado por sesión

```typescript
// Store en memoria (Redis en prod)
const conversaciones: Record<string, ConversacionState> = {};

interface ConversacionState {
  paso:           Paso;           // estado actual de la máquina
  fecha_entrada?: string;         // ISO: "2026-07-25"
  fecha_salida?:  string;         // ISO: "2026-07-27"
  personas?:      number;
  opciones?:      HabOpcion[];    // habitaciones disponibles mostradas
  habitacion?:    HabOpcion;      // habitación elegida
  nombre?:        string;
  dni?:           string;
  historial:      Array<{ rol: 'user' | 'assistant'; contenido: string }>;
}

// La clave es el número de teléfono (sesión única por teléfono)
// TTL implícito: se limpia al finalizar la reserva
// Para WhatsApp: session_id = número de teléfono del huésped
// Para pruebas directas: session_id = cualquier string (ej: "test_51987")
```

---

## Parser de fechas (sin LLM)

El servicio tiene un parser regex para las fechas más comunes, evitando llamar a Llama3:

```typescript
// Patrones soportados:
"del 25 al 27 de julio"           // → 2026-07-25 al 2026-07-27
"25 al 27 julio"                   // → idem
"25/07 al 27/07"                   // → idem
"25/07/2026 al 27/07/2026"         // → idem
"2026-07-25 al 2026-07-27"         // → ISO directo
```

Meses en español e inglés soportados: enero/january → 01, ..., diciembre/december → 12.

---

## Flujo de reserva completo paso a paso

```
Huésped: "Hola, quiero una habitación"
Aria:    "¡Hola! Soy Aria. ¿Para qué fechas y cuántas personas?"

Huésped: "Del 25 al 27 de julio, 2 personas"
Aria:    "Tenemos 3 opciones disponibles:
          1. Hab. 101 — SIMPLE — S/ 120/noche
          2. Hab. 205 — DOBLE — S/ 180/noche
          3. Hab. 310 — SUITE — S/ 320/noche
          ¿Cuál prefieres?"

Huésped: "La doble"
Aria:    "Perfecto. ¿Tu nombre completo?"

Huésped: "María García López"
Aria:    "Gracias, María. ¿Tu número de DNI?"

Huésped: "45678901"
Aria:    "Resumen de tu reserva:
          🏨 Hab. 205 — DOBLE
          📅 25 al 27 de julio (2 noches)
          👤 María García López — DNI: 45678901
          💰 Total: S/ 360 (2 noches × S/ 180)
          ¿Confirmo?"

Huésped: "Sí"
Aria:    "✅ ¡Reserva confirmada!
          Código: HOT-2026-0042
          Te esperamos el 25 de julio. ¡Hasta pronto!"
```

---

## Integración con n8n

El workflow `concierge-wpp-reservas.json` en n8n:
1. Recibe mensaje entrante de Meta via webhook
2. Extrae `from` (teléfono) y `body` (texto)
3. Llama `POST /api/v1/n8n/interpretar-mensaje` con el texto y teléfono
4. El backend devuelve `{ respuesta: string, paso: string }`
5. n8n envía la respuesta de vuelta al huésped via WhatsApp

Otros endpoints n8n que usa el concierge:
- `POST /n8n/disponibilidad` — verificar habitaciones disponibles
- `POST /n8n/upsert-huesped` — crear/actualizar huésped
- `POST /n8n/crear-reserva` — crear la reserva final
- `POST /n8n/guardar-mensaje` — log en concierge_mensajes
- `POST /n8n/generar-voucher` — generar PDF voucher de reserva

Todos requieren header: `x-n8n-secret: $N8N_WEBHOOK_SECRET`

---

## Endpoint de prueba directa

```bash
# POST /api/v1/concierge/chat (requiere JWT)
curl http://localhost:3000/api/v1/concierge/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "session_id": "test_51987654321",
    "mensaje": "Quiero reservar una habitación del 25 al 27 de julio para 2 personas"
  }'

# Respuesta: { "respuesta": "Tenemos 3 opciones...", "paso": "mostrando_habitaciones" }

# Limpiar sesión de prueba
curl http://localhost:3000/api/v1/concierge/chat/test_51987654321 \
  -X DELETE \
  -H "Authorization: Bearer $TOKEN"
```
