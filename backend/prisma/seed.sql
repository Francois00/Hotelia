-- Seed credentials for development: all users use password Hotel2024!
-- Run manually: psql -U hotel_user -d hotel_db -f backend/prisma/seed.sql
INSERT INTO personal (id, nombre, apellido, email, password_hash, rol, activo, updated_at)
VALUES
  (gen_random_uuid(), 'Carlos',  'Mendoza',  'admin@hotel.com',        '$2b$12$ZF9m5Wefi3vNJX34tMkKOeigYy53qGgORjvIN86OdH41ZaX0CWFCa', 'ADMIN',         true, now()),
  (gen_random_uuid(), 'Lucía',   'Torres',   'gerente@hotel.com',      '$2b$12$ZF9m5Wefi3vNJX34tMkKOeigYy53qGgORjvIN86OdH41ZaX0CWFCa', 'GERENTE',       true, now()),
  (gen_random_uuid(), 'Miguel',  'Quispe',   'recepcion1@hotel.com',   '$2b$12$ZF9m5Wefi3vNJX34tMkKOeigYy53qGgORjvIN86OdH41ZaX0CWFCa', 'RECEPCIONISTA', true, now()),
  (gen_random_uuid(), 'Ana',     'Paredes',  'recepcion2@hotel.com',   '$2b$12$ZF9m5Wefi3vNJX34tMkKOeigYy53qGgORjvIN86OdH41ZaX0CWFCa', 'RECEPCIONISTA', true, now()),
  (gen_random_uuid(), 'Rosa',    'Huanca',   'housekeeping@hotel.com', '$2b$12$ZF9m5Wefi3vNJX34tMkKOeigYy53qGgORjvIN86OdH41ZaX0CWFCa', 'HOUSEKEEPING',  true, now())
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      rol           = EXCLUDED.rol,
      activo        = EXCLUDED.activo,
      updated_at    = now();
