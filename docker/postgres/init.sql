-- Crea la base de datos de n8n en el mismo servidor PostgreSQL.
-- hotel_db se crea automáticamente via POSTGRES_DB en docker-compose.
-- Este script corre solo la primera vez que se inicializa el volumen.
CREATE DATABASE n8n_db;
