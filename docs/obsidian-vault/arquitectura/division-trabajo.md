---
fecha: 2025
estado: final
resumen: Qué construye Claude Code vs qué construye Codex
---
# División de Trabajo entre Agentes
## Claude Code
Todo excepto el frontend: backend, AI service, Docker, n8n flows, integraciones, base de datos.
## Codex
Exclusivamente frontend/: componentes React, UI con Tailwind, dashboard visual, gráficos.
## Regla
Los dos agentes nunca tocan los mismos archivos. La interfaz entre ellos son los contratos de API documentados en docs/obsidian-vault/api/.
