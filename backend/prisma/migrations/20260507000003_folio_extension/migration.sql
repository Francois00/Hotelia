-- TipoFolioItem: categorías adicionales de cargo
ALTER TYPE "TipoFolioItem" ADD VALUE IF NOT EXISTS 'TELEFONO';
ALTER TYPE "TipoFolioItem" ADD VALUE IF NOT EXISTS 'SPA';
ALTER TYPE "TipoFolioItem" ADD VALUE IF NOT EXISTS 'PARKING';
ALTER TYPE "TipoFolioItem" ADD VALUE IF NOT EXISTS 'SERVICIO_EXTRA';

-- MetodoPago: distinguir crédito de débito
ALTER TYPE "MetodoPago" ADD VALUE IF NOT EXISTS 'TARJETA_CREDITO';
ALTER TYPE "MetodoPago" ADD VALUE IF NOT EXISTS 'TARJETA_DEBITO';

-- folio_items: anulación lógica + auditoría de quien registró el cargo
ALTER TABLE folio_items
  ADD COLUMN IF NOT EXISTS anulado     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS personal_id UUID    REFERENCES personal(id),
  ADD COLUMN IF NOT EXISTS notas       TEXT;

-- pagos: notas de pago + auditoría
ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS notas       TEXT,
  ADD COLUMN IF NOT EXISTS personal_id UUID    REFERENCES personal(id);
