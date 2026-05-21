-- IdiomaPreferido: enum para el idioma de comunicación preferido del huésped
CREATE TYPE "IdiomaPreferido" AS ENUM ('ES', 'EN', 'PT', 'FR', 'DE');

-- SegmentoHuesped: agregar valores CRM (mantener NORMAL y CORPORATIVO por compatibilidad)
ALTER TYPE "SegmentoHuesped" ADD VALUE IF NOT EXISTS 'RECURRENTE';
ALTER TYPE "SegmentoHuesped" ADD VALUE IF NOT EXISTS 'OCASIONAL';
ALTER TYPE "SegmentoHuesped" ADD VALUE IF NOT EXISTS 'INACTIVO';
ALTER TYPE "SegmentoHuesped" ADD VALUE IF NOT EXISTS 'NUEVO';

-- Extender tabla huespedes
ALTER TABLE huespedes
  ADD COLUMN IF NOT EXISTS idioma_preferido "IdiomaPreferido" NOT NULL DEFAULT 'ES',
  ADD COLUMN IF NOT EXISTS preferencias     JSONB,
  ADD COLUMN IF NOT EXISTS activo           BOOLEAN NOT NULL DEFAULT true;

-- Los nuevos huéspedes parten desde NUEVO, no NORMAL
ALTER TABLE huespedes ALTER COLUMN segmento SET DEFAULT 'NUEVO';
