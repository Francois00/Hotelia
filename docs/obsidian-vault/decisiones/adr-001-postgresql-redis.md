---
fecha: 2025
estado: final
resumen: PostgreSQL es fuente de verdad, Redis es solo cache
---
# ADR-001: PostgreSQL como fuente de verdad
## Decisión
PostgreSQL 15 es el único sistema de verdad. Redis solo acelera lecturas.
## Por qué
Las operaciones de reserva requieren ACID completo y constraints de exclusión (no_double_booking). Redis no garantiza consistencia suficiente para operaciones financieras.
## Consecuencia
Toda escritura va a PostgreSQL primero. Redis se actualiza después o se invalida. Si Redis y PostgreSQL difieren, PostgreSQL gana siempre.
