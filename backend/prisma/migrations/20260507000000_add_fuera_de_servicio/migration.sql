-- AlterEnum: agrega FUERA_DE_SERVICIO para habitaciones fuera de operación permanente
ALTER TYPE "EstadoHabitacion" ADD VALUE IF NOT EXISTS 'FUERA_DE_SERVICIO';
