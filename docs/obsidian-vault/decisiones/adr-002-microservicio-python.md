---
fecha: 2025
estado: final
resumen: El AI service es un microservicio Python separado del backend Node.js
---
# ADR-002: AI Service como microservicio Python
## Decisión
Prophet, scikit-learn y transformers corren en un proceso Python separado en el puerto 8001.
## Por qué
No hay equivalente maduro de Prophet o transformers en Node.js. Separar permite escalar el servicio de IA de forma independiente y actualizar modelos sin afectar el backend.
## Consecuencia
Si el AI service cae, el backend sigue funcionando con la última tarifa guardada en Redis. Las llamadas al AI service tienen timeout de 3 segundos.
