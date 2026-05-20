---
tags: [ia-service, python, fastapi, prophet, claude]
fecha: 2026-05-20
estado: 🔄 en progreso
---

# AI Service — Estado actual

> Ver también: [[stack-decisiones]], [[logica-negocio]], [[adr-002-microservicio-python]]

---

## Stack

- Python 3.11 + FastAPI 0.111
- Prophet 1.1.5 + cmdstanpy 1.3.0 (forecast de ocupación)
- PyTorch 2.3.0 + Transformers 4.41.0 (análisis de sentimiento/NLP reviews)
- scikit-learn 1.4.2 (segmentación CRM)
- Anthropic SDK 0.28.0 (concierge IA Aria — Claude)
- SQLAlchemy 2.0.29 + psycopg2-binary (acceso directo a PostgreSQL)
- httpx 0.27.0 (llamadas HTTP al backend)
- Uvicorn (ASGI server)

Puerto: `8001` (interno: `ia-service:8001`)
Autenticación: header `X-IA-Key` (valor en `IA_SECRET_KEY` env)

---

## Routers implementados

### `/ia/v1/forecast` ✅

Predicción de ocupación con Prophet.

- `GET /forecast?dias=90` — predice ocupación para los próximos N días
- `GET /forecast/status` — estado del modelo (última vez entrenado, métricas)
- `POST /forecast/retrain` — fuerza re-entrenamiento
- Datos de entrada: `tarifas_historial` de PostgreSQL
- Fallback backend: si no responde en 2s, el backend usa `tarifa_base` de Redis

**Workaround Prophet + cmdstanpy**: el Dockerfile crea un `Makefile` vacío en `bundled/cmdstan-2.33.1/` porque el instalador de cmdstanpy busca ese archivo. Sin este workaround, la imagen no construye correctamente.

### `/ia/v1/pricing` ✅

Tarifa dinámica.

- `GET /pricing/tarifa?habitacion_id=...&fecha_entrada=...&fecha_salida=...&canal=...`
- `POST /pricing/batch` — múltiples habitaciones a la vez
- Considera: ocupación actual, reglas de temporada, canal, predicción Prophet
- Factores por canal: `BOOKING_COM ×1.05, EXPEDIA ×1.08, AIRBNB ×1.03, DIRECTO ×1.0`

### `/ia/v1/crm` ✅

Segmentación de huéspedes.

- `GET /crm/segmentos` — resumen por segmento
- `GET /crm/top-vip` — top 10 por LTV
- `POST /crm/segmentar` — recalcula segmentos de todos los huéspedes en BD

### `/ia/v1/housekeeping` ✅

Optimización de rutas de limpieza.

- `GET /housekeeping/rutas` — orden óptimo de habitaciones a limpiar (algoritmo greedy por piso y proximidad)

### `/ia/v1/mantenimiento` ✅

Predicción de fallos.

- `GET /mantenimiento/predicciones` — predicción de probabilidad de fallo por habitación basada en historial de alertas

### `/ia/v1/reviews` ✅

Análisis NLP de reseñas.

- `POST /reviews/analizar` — análisis de sentimiento (PyTorch Transformers) y extracción de tópicos

### `/ia/v1/concierge` ✅

Chatbot Aria — Claude Anthropic.

- `POST /concierge/mensaje` — respuesta contextualizada con historial de conversación
- Claude recibe contexto de: reserva actual, habitación, preferencias del huésped, historial de mensajes previos
- Detecta intents: `solicitud_servicio`, `queja`, `info_hotel`, `info_reserva`
- Si `escalado = true`: llama a `POST /api/v1/internal/alertas` del backend

---

## Servicios internos

| Archivo | Responsabilidad |
|---------|----------------|
| `services/predictor_ocupacion.py` | Entrenamiento y predicción Prophet con caché en memoria |
| `services/pricing_engine.py` | Cálculo de tarifa dinámica, factores por canal |
| `services/segmentacion_crm.py` | Segmentación k-means o por reglas de LTV/frecuencia |
| `services/ltv_calculator.py` | Cálculo de LTV acumulado por huésped |
| `services/optimizador_rutas.py` | Greedy routing para housekeeping |
| `services/predictor_fallos.py` | Predicción de mantenimiento por historial de alertas |
| `services/reviews_nlp.py` | Análisis de sentimiento con Transformers |
| `services/concierge.py` | Integración Claude Anthropic con contexto hotelero |

---

## Pendiente

- ⬜ Tests unitarios Python (ninguno implementado)
- ⬜ Logs estructurados (actualmente `print` y exception strings)
- ⬜ Métricas del modelo Prophet (MAPE, RMSE) expuestas en `/forecast/status`
- ⬜ Rate limiting para el endpoint del concierge (costo por token de Anthropic)
- ⬜ Caché de respuestas frecuentes del concierge en Redis
- ⬜ Endpoint para listar/responder conversaciones del concierge desde el backend

---

## Consideraciones de producción

1. **Anthropic API key**: se configura en `ia-service/.env` como `ANTHROPIC_API_KEY`. Si está vacía, el concierge lanza excepción no manejada.
2. **Modelo Prophet**: necesita al menos 2-3 meses de datos en `tarifas_historial` para predicciones útiles. Con datos insuficientes, Prophet extrapola de forma lineal sin alertas.
3. **PyTorch CPU**: el `requirements.txt` instala `torch==2.3.0+cpu` (extra index PyTorch CPU). La imagen Docker tiene ~2.5GB — considerar imagen multi-stage en producción.
4. **Timeout backend**: el backend espera máximo 2 segundos al ia-service antes de usar el fallback de Redis. Si el modelo Prophet tarda en responder (primer request después de reinicio), el backend usará la tarifa base.
