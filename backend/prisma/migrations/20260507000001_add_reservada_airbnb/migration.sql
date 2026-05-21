-- EstadoHabitacion: estado gestionado por el sistema cuando check-in es en menos de 24h
ALTER TYPE "EstadoHabitacion" ADD VALUE IF NOT EXISTS 'RESERVADA';

-- CanalReserva: canal de distribución Airbnb
ALTER TYPE "CanalReserva" ADD VALUE IF NOT EXISTS 'AIRBNB';
