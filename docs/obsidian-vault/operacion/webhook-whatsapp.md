---
tags: [whatsapp, webhook, meta, operacion, concierge]
fecha: 2026-06-16
estado: ✅ completo
---

# Webhook WhatsApp — Configuración y pruebas

> Ver también: [[concierge-llama3]], [[workflows]], [[iniciar-sistema]]

---

## Activar el túnel (localtunnel)

```bash
# Instalar localtunnel globalmente (una sola vez)
npm install -g localtunnel

# Exponer el backend en un subdominio fijo
npx lt --port 3000 --subdomain hotelia-webhook

# URL pública resultante:
# https://hotelia-webhook.loca.lt

# ⚠️ Localtunnel pide contraseña al primer acceso desde browser
# Visitar https://loca.lt/mytunnelpassword para obtenerla
```

---

## Configuración en Meta Business Manager

1. Ir a https://developers.facebook.com → Tu app → WhatsApp → Configuration
2. En **Webhook URL**: `https://hotelia-webhook.loca.lt/api/v1/whatsapp/webhook`
3. En **Verify Token**: el valor de `WHATSAPP_VERIFY_TOKEN` en tu `.env` (ej: `hotelia_webhook_2025`)
4. Clic en **Verify and Save**
5. En **Webhook fields**, activar: `messages` (mínimo requerido)
6. Suscribir el número de WhatsApp Business al webhook

---

## Variables de entorno requeridas

```bash
# En backend/.env
WHATSAPP_ACCESS_TOKEN=EAAxxxx...          # Token permanente del WABA
WHATSAPP_PHONE_NUMBER_ID=12345678901234   # ID del número en Meta
WHATSAPP_VERIFY_TOKEN=hotelia_webhook_2025 # Token de verificación (tú lo defines)
```

---

## Probar sin WhatsApp real (curl)

```bash
# Simular mensaje entrante de un huésped
curl http://localhost:3000/api/v1/whatsapp/webhook \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123456789",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "messages": [{
            "id": "wamid.test123",
            "from": "51987654321",
            "timestamp": "1748000000",
            "type": "text",
            "text": { "body": "Hola, quiero reservar una habitación" }
          }]
        },
        "field": "messages"
      }]
    }]
  }'

# El backend procesará el mensaje y logeará la respuesta en consola
# (si no hay TOKEN real configurado, solo hace console.log)
```

---

## Flujo completo: mensaje WPP → n8n → Llama3 → respuesta

```
Huésped WhatsApp
      │
      ▼ POST (Meta Cloud API)
[n8n webhook: concierge-wpp-reservas]
      │ Extrae: from, body, timestamp
      │
      ▼ POST http://backend:3000/api/v1/n8n/interpretar-mensaje
[Backend: concierge.service.ts — state machine]
      │
      ├─ Si paso = 'inicio' → saluda, pide fechas
      ├─ Si paso = 'pidiendo_fechas' → extrae fechas con regex
      ├─ Si paso = 'pidiendo_personas' → extrae número personas
      ├─ Si paso = 'mostrando_habitaciones' → GET /habitaciones/disponibles
      ├─ Si paso = 'pidiendo_nombre' → captura nombre
      ├─ Si paso = 'pidiendo_dni' → valida DNI
      └─ Si paso = 'confirmando' → POST /n8n/crear-reserva
      │
      ▼ (para respuestas NLP complejas)
[Ollama: POST http://localhost:11434/api/generate]
      │ model: llama3
      │ prompt: contexto + historial + instrucción
      │
      ▼ texto generado
[Backend] → respuesta al huésped
      │
      ▼ POST graph.facebook.com/v18.0/{PHONE_ID}/messages
[Meta Cloud API] → WhatsApp del huésped
```

---

## Endpoint de verificación Meta (GET)

```bash
# Meta llama este endpoint para verificar el webhook
GET /api/v1/whatsapp/webhook?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=hotelia_webhook_2025

# El backend responde con: 12345 (el challenge)
# Si el verify_token no coincide → responde 403
```

---

## Probar el concierge directamente (sin n8n)

```bash
# Obtener JWT primero
TOKEN=$(curl -s http://localhost:3000/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"gerente@hotel.com","password":"Hotel2024!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Enviar mensaje al concierge
curl http://localhost:3000/api/v1/concierge/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"session_id":"test_51987654321","mensaje":"Quiero reservar una habitación doble del 25 al 27 de julio"}'

# Limpiar sesión
curl http://localhost:3000/api/v1/concierge/chat/test_51987654321 \
  -X DELETE \
  -H "Authorization: Bearer $TOKEN"
```
