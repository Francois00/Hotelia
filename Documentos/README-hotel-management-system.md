# hotel-management-system

Sistema inteligente de gestión hotelera con automatización operativa e inteligencia artificial. Cubre reservas, habitaciones, facturación, revenue management dinámico, CRM con LTV y automatización de flujos operativos via n8n.

---

## Índice

- [Resumen del sistema](#resumen-del-sistema)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Módulos principales](#módulos-principales)
- [Modelo de datos](#modelo-de-datos)
- [Instalación y configuración](#instalación-y-configuración)
- [Variables de entorno](#variables-de-entorno)
- [Flujos n8n automatizados](#flujos-n8n-automatizados)
- [Roadmap de desarrollo](#roadmap-de-desarrollo)
- [Decisiones de diseño](#decisiones-de-diseño)

---

## Resumen del sistema

Sistema PMS (Property Management System) propio con capa de IA encima. Las funciones clave son:

- **Channel manager bidireccional** — sincronización en tiempo real con Booking.com, Expedia y OTAs. Una reserva en cualquier canal bloquea disponibilidad en todos los demás automáticamente.
- **Revenue manager IA** — calcula la tarifa óptima por habitación en tiempo real considerando ocupación, lead time, régimen de temporada, tarifas de competencia y segmento del cliente.
- **Predictor de ocupación** — forecast a 30/60/90 días con Prophet. Base de todas las decisiones de precio y personal.
- **CRM con LTV** — perfil histórico de cada huésped con cálculo de Lifetime Value. Identifica VIPs, activa campañas automáticas de retención.
- **Mantenimiento predictivo** — programa revisiones de habitaciones antes de que ocurran fallos, basado en historial de uso.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend principal | Node.js (Express) |
| Microservicio IA | Python 3.11+ (FastAPI) |
| Base de datos | PostgreSQL 15 |
| Cache | Redis |
| Automatización | n8n (self-hosted) |
| Frontend dashboard | React + Recharts |
| Chatbot IA | OpenAI API / Anthropic API |
| Forecast | `prophet` (Python) |
| Revenue ML | `scikit-learn` |
| Facturación | SUNAT (Perú) — API facturación electrónica |
| Pagos | Niubiz / Stripe |
| Comunicación | WhatsApp Business API, Twilio SMS |
| Contenedores | Docker + Docker Compose |

---

## Arquitectura

```
Canales de entrada
├── WhatsApp Business API → reservas y consultas de huéspedes
├── Channel manager       → Booking.com, Expedia, Airbnb (bidireccional)
├── Web directa           → motor de reservas propio (sin comisión)
├── App / kiosco          → check-in digital self-service
└── Teléfono / IVR        → integrado con chatbot IA

        ↓

Núcleo PMS
├── Gestión de reservas   → disponibilidad, bloqueos, grupos, modificaciones
├── Gestión habitaciones  → estados: disponible / ocupado / limpieza / mantenimiento
└── Facturación + folio   → cargos por habitación, pagos, SUNAT

        ↓

IA y automatización
├── Chatbot concierge     → atención 24/7, upsell de servicios, FAQ
├── Revenue manager IA    → pricing dinámico + segmentación por canal  ← +15-30% RevPAR
├── Predictor ocupación   → forecast 30/60/90 días con Prophet          ← base de decisiones
└── Housekeeping IA       → rutas y prioridades de limpieza optimizadas

        ↓

Integraciones externas
├── Pasarela de pagos     → Niubiz (Perú), Stripe (internacional)
├── POS restaurante       → cargos directos a folio de habitación
├── Facturación SUNAT     → boleta / factura electrónica automática
└── Tarifas competencia   → scraping ético + OTA Insight para pricing contextual

        ↓

Analytics y CRM
├── Dashboard KPIs        → RevPAR, ADR, ocupación, ingresos en tiempo real
├── Análisis reviews NLP  → Google, TripAdvisor, Booking procesados automáticamente
├── CRM con LTV           → segmentación, historial, score VIP, Lifetime Value
└── Campañas automáticas  → email, SMS, retención post-estancia

        ↓

Automatización n8n
├── Check-in / check-out automático
├── Encuesta post-estancia (24h después del checkout)
├── Mantenimiento predictivo (alerta por umbrales de uso)
└── Alertas de limpieza en tiempo real

        ↓ Feedback loop

CRM → PMS: historial de huéspedes retroalimenta disponibilidad, pricing y campañas
```

---

## Estructura del repositorio

```
hotel-management-system/
│
├── README.md
├── .env.example
├── docker-compose.yml
│
├── backend/                        # Node.js — PMS core
│   ├── package.json
│   ├── src/
│   │   ├── app.js
│   │   ├── routes/
│   │   │   ├── reservas.js         # CRUD reservas
│   │   │   ├── habitaciones.js     # Estados y disponibilidad
│   │   │   ├── facturacion.js      # Folio, pagos, SUNAT
│   │   │   ├── huespedes.js        # Perfil CRM + historial
│   │   │   └── canales.js          # Channel manager sync
│   │   ├── services/
│   │   │   ├── channel_manager.js  # Sync bidireccional con OTAs
│   │   │   ├── disponibilidad.js   # Motor de disponibilidad en tiempo real
│   │   │   ├── sunat.js            # Integración facturación electrónica
│   │   │   ├── pagos.js            # Niubiz + Stripe
│   │   │   └── notificaciones.js   # WhatsApp, SMS, email
│   │   ├── models/                 # Sequelize models
│   │   │   ├── Reserva.js
│   │   │   ├── Habitacion.js
│   │   │   ├── Huesped.js
│   │   │   ├── Folio.js
│   │   │   └── EventoMantenimiento.js
│   │   └── middleware/
│   │       ├── auth.js
│   │       └── validacion.js
│   └── tests/
│
├── ia-service/                     # Python FastAPI — módulos IA
│   ├── requirements.txt
│   ├── main.py
│   ├── revenue/
│   │   ├── pricing_engine.py       # Cálculo tarifa óptima por habitación
│   │   ├── segmentacion.py         # Precio por canal: web directa, OTA, corp.
│   │   └── competencia_scraper.py  # Tarifas competencia (scraping ético)
│   ├── forecast/
│   │   ├── predictor_ocupacion.py  # Prophet: forecast 30/60/90 días
│   │   └── calendario_eventos.py   # Eventos locales que afectan demanda
│   ├── crm/
│   │   ├── ltv_calculator.py       # Lifetime Value por huésped
│   │   ├── segmentacion_crm.py     # Clusters: VIP, recurrente, ocasional
│   │   └── reviews_nlp.py          # Análisis sentimiento Google/TripAdvisor
│   ├── housekeeping/
│   │   └── optimizador_rutas.py    # Orden óptimo de limpieza por piso/prioridad
│   ├── mantenimiento/
│   │   └── predictor_fallos.py     # Alertas preventivas por historial de uso
│   └── chatbot/
│       └── concierge.py            # Wrapper LLM para atención a huéspedes
│
├── frontend/                       # React — dashboard interno
│   ├── package.json
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx       # KPIs en tiempo real
│       │   ├── Reservas.jsx        # Vista y gestión de reservas
│       │   ├── Habitaciones.jsx    # Mapa visual del hotel
│       │   ├── Revenue.jsx         # Pricing y forecast
│       │   └── CRM.jsx             # Perfiles y segmentación
│       └── components/
│           ├── HotelMap.jsx        # Grid visual de habitaciones por estado
│           ├── OcupacionChart.jsx  # Forecast 90 días
│           └── RevPARGauge.jsx     # KPI principal
│
├── n8n-flows/                      # Flujos n8n exportados en JSON
│   ├── checkin_automatico.json
│   ├── checkout_automatico.json
│   ├── encuesta_post_estancia.json
│   ├── alerta_mantenimiento.json
│   └── limpieza_trigger.json
│
├── db/
│   ├── migrations/                 # Sequelize migrations
│   └── seeds/
│       └── habitaciones_seed.js    # Carga inicial de habitaciones
│
└── docs/
    ├── api.md                      # Documentación endpoints REST
    ├── channel_manager_setup.md    # Configuración sync con OTAs
    └── n8n_setup.md                # Instalación y configuración n8n
```

---

## Módulos principales

### `channel_manager.js`
Sincronización bidireccional con OTAs. Cuando entra una reserva por Booking.com, este módulo cierra esa disponibilidad en Expedia, Airbnb y el motor propio en menos de 30 segundos.

**Integración recomendada:** API de Cloudbeds o SiteMinder como middleware de channel manager, o integración directa via XML/REST con cada OTA.

```javascript
// Cuando llega una reserva por cualquier canal:
channelManager.bloquearDisponibilidad({
  habitacion_id: 'HAB-101',
  fecha_entrada: '2024-03-15',
  fecha_salida: '2024-03-18',
  canal_origen: 'booking_com'
})
// → actualiza disponibilidad en TODOS los canales simultáneamente
```

---

### `pricing_engine.py`
Calcula la tarifa óptima por habitación en tiempo real.

**Factores considerados:**
- Ocupación actual del hotel (% de rooms vendidas hoy)
- Lead time de la reserva (días hasta llegada)
- Forecast de ocupación para esas fechas
- Temporada / día de la semana
- Eventos locales (conciertos, feriados, congresos)
- Tarifas actuales de la competencia
- Segmento del canal (web directa vs OTA vs corporativo)

**Output:** tarifa recomendada por tipo de habitación, con tarifa mínima y máxima como guardianes.

---

### `predictor_ocupacion.py`
Forecast de ocupación para los próximos 30, 60 y 90 días usando Prophet.

**Entrenamiento:** historial de reservas propio (mínimo 12 meses para buena calidad)  
**Features adicionales:** feriados nacionales, calendario de eventos de la ciudad, patrones de temporada del hotel  
**Re-entrenamiento:** automático cada lunes con los datos más recientes

---

### `ltv_calculator.py`
Calcula el Lifetime Value de cada huésped para segmentación CRM.

```
LTV = (gasto_promedio_por_estancia × estancias_por_año × años_retencion) - costo_adquisicion
```

**Segmentos automáticos:**
- VIP: LTV > umbral configurable Y frecuencia > 3 visitas/año
- Recurrente: 2-3 visitas/año
- Ocasional: 1 visita/año
- Inactivo: sin visita en los últimos 18 meses → activa campaña de reactivación

---

### `reviews_nlp.py`
Procesa comentarios de Google Maps, TripAdvisor y Booking.com automáticamente.

**Output por review:**
- Sentimiento: positivo / negativo / neutro
- Aspectos mencionados: limpieza, atención, ubicación, precio, desayuno
- Habitación mencionada (si aplica)

**Uso operativo:** si 3 reviews en 7 días mencionan negativamente la misma habitación, genera alerta de mantenimiento/inspección.

---

## Modelo de datos

Tablas principales en PostgreSQL:

```
reservas
├── id, codigo_reserva
├── huesped_id → huespedes
├── habitacion_id → habitaciones
├── fecha_entrada, fecha_salida
├── canal_origen (web_directa | booking | expedia | whatsapp | telefono)
├── tarifa_noche, tarifa_total
├── estado (confirmada | checkin | checkout | cancelada)
└── created_at

habitaciones
├── id, numero, piso, tipo (simple|doble|suite)
├── estado (disponible | ocupada | limpieza | mantenimiento | bloqueada)
├── tarifa_base
└── ultima_revision_mantenimiento

huespedes
├── id, nombre, email, telefono, documento
├── ltv_calculado, segmento_crm (vip | recurrente | ocasional | inactivo)
├── total_estancias, gasto_total_historico
└── fecha_ultimo_checkout

folio
├── id, reserva_id
├── concepto (habitacion | restaurante | minibar | servicio)
├── monto, fecha
└── pagado (bool)

eventos_mantenimiento
├── id, habitacion_id
├── tipo (preventivo | correctivo | limpieza_profunda)
├── fecha_programada, fecha_realizada
└── descripcion

tarifas_historial
├── id, habitacion_id, fecha
├── tarifa_publicada, tarifa_competencia_promedio
└── ocupacion_hotel_ese_dia
```

---

## Instalación y configuración

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-usuario/hotel-management-system.git
cd hotel-management-system

# 2. Levantar servicios base
docker-compose up -d db redis n8n

# 3. Backend Node.js
cd backend
npm install
npx sequelize db:migrate
npx sequelize db:seed:all  # carga habitaciones iniciales
npm run dev

# 4. Microservicio IA (Python)
cd ../ia-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# 5. Frontend React
cd ../frontend
npm install
npm run dev

# 6. n8n (acceder en http://localhost:5678)
# → Importar los JSONs de /n8n-flows/ desde la interfaz de n8n
```

---

## Variables de entorno

```env
# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/hotel_db

# Redis
REDIS_URL=redis://localhost:6379/0

# WhatsApp Business
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Pagos
NIUBIZ_MERCHANT_ID=
NIUBIZ_API_KEY=
STRIPE_SECRET_KEY=

# SUNAT (facturación electrónica Perú)
SUNAT_RUC=
SUNAT_USUARIO_SOL=
SUNAT_CLAVE_SOL=
SUNAT_CERT_PATH=

# LLM para chatbot concierge
ANTHROPIC_API_KEY=

# n8n
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=

# Revenue management
TARIFA_MINIMA_SIMPLE=80        # S/ mínimo por habitación simple
TARIFA_MINIMA_DOBLE=120
TARIFA_MINIMA_SUITE=200
MAX_INCREMENTO_TARIFA_PCT=150  # máximo 150% sobre tarifa base
OCUPACION_UMBRAL_ALTO=75       # a partir de este % activa pricing agresivo

# CRM
LTV_UMBRAL_VIP=2000            # S/ LTV para clasificar como VIP
MESES_INACTIVIDAD_REACTIVAR=18
```

---

## Flujos n8n automatizados

### `checkin_automatico.json`
**Trigger:** 2 horas antes de la llegada del huésped  
**Acciones:** envía WhatsApp con código de check-in, enlace al formulario digital, instrucciones de parking

### `checkout_automatico.json`
**Trigger:** 8am del día de salida  
**Acciones:** envía recordatorio de checkout, genera pre-folio para revisión, notifica a housekeeping que la habitación estará disponible

### `encuesta_post_estancia.json`
**Trigger:** 24 horas después del checkout  
**Acciones:** envía encuesta NPS por WhatsApp o email, guarda respuesta en CRM, si NPS < 7 genera alerta para seguimiento manual

### `alerta_mantenimiento.json`
**Trigger:** habitación supera umbral de noches activas (configurable, default: 30 noches)  
**Acciones:** crea evento de mantenimiento preventivo, notifica al responsable de mantenimiento, bloquea la habitación si es necesario

### `limpieza_trigger.json`
**Trigger:** checkout registrado en el PMS  
**Acciones:** notifica a housekeeping con número de habitación y prioridad, actualiza estado a "en limpieza", cuando housekeeping marca como lista actualiza estado a "disponible"

---

## Roadmap de desarrollo

### Fase 1 — PMS core (semanas 1–3)
- [ ] Modelos de base de datos y migrations
- [ ] CRUD reservas con validación de disponibilidad
- [ ] Gestión de estados de habitaciones
- [ ] Frontend básico: mapa de habitaciones

### Fase 2 — Integraciones (semanas 4–6)
- [ ] Channel manager (empezar con Booking.com)
- [ ] Integración WhatsApp Business API
- [ ] Pasarela de pagos Niubiz
- [ ] Facturación electrónica SUNAT

### Fase 3 — IA core (semanas 7–10)
- [ ] Predictor de ocupación con Prophet
- [ ] Pricing engine básico (sin competencia aún)
- [ ] CRM con cálculo de LTV
- [ ] Chatbot concierge

### Fase 4 — IA avanzada (semanas 11–14)
- [ ] Scraping tarifas competencia
- [ ] Revenue manager con todos los factores
- [ ] Reviews NLP automático
- [ ] Mantenimiento predictivo
- [ ] Segmentación CRM completa

### Fase 5 — Automatización y analytics (semanas 15–17)
- [ ] Todos los flujos n8n
- [ ] Dashboard KPIs completo
- [ ] Campañas automáticas de retención
- [ ] Reportes automáticos

---

## Decisiones de diseño

**¿Por qué Node.js para el backend y Python separado para IA?**  
Node.js es superior para manejar muchas conexiones simultáneas (websockets del dashboard, webhooks de OTAs, notificaciones). Python es el ecosistema natural para ML (Prophet, scikit-learn). Separar en microservicios permite escalar y desplegar cada parte independientemente.

**¿Por qué channel manager bidireccional y no solo recibir reservas?**  
Sin sincronización bidireccional, un overbooking ocurre cuando dos canales venden la misma habitación simultáneamente. El canal manager debe bloquear disponibilidad en todos los canales en cuanto entra una reserva, no solo recibirla.

**¿Por qué Prophet para el forecast y no LSTM?**  
Prophet es más interpretable, maneja bien los efectos de temporada y feriados con configuración explícita, y requiere menos datos históricos para dar resultados útiles. LSTM sería mejor con 5+ años de datos y mayor complejidad en los patrones. Para un hotel con 1-2 años de historial, Prophet es más práctico.

**¿Por qué LTV para CRM y no solo frecuencia de visitas?**  
La frecuencia no distingue entre un huésped que viene 3 veces al año en habitación simple y uno que viene 3 veces en suite. LTV pondera el valor económico real, permitiendo priorizar correctamente los recursos de retención.

**¿Por qué n8n en lugar de código personalizado para automatizaciones?**  
Los flujos operativos cambian frecuentemente (horarios, condiciones, canales). n8n permite modificar flujos sin tocar código, lo que es crítico para un solo desarrollador que también opera el negocio.
