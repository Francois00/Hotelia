---
fecha: 2025
estado: borrador
resumen: Los 3 servicios del sistema y cómo se comunican entre sí
---
# Sistema Overview
## Servicios
- Backend Node.js (puerto 3000): lógica de negocio, reservas, facturación, CRM
- AI Service Python (puerto 8001): pricing, forecast, NLP, housekeeping
- Frontend React (puerto 5173): dashboard, mapa de habitaciones, CRM visual
## Infraestructura
- PostgreSQL 15: fuente de verdad
- Redis: cache de disponibilidad y sesiones
- n8n self-hosted: automatización de flujos operativos
- Docker Compose: orquestación

## Actualizado 2026-06-16
Ver [[vision-general]] para el diagrama ASCII completo y los 4 flujos principales del sistema.
