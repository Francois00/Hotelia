#!/usr/bin/env bash
set -euo pipefail

# Usage: ./restore.sh <backup_file.sql.gz>

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh "$(dirname "$0")/../db/backups/"*.sql.gz 2>/dev/null || echo "  (none found)"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Error: file not found — $BACKUP_FILE"
  exit 1
fi

# Load env if .env.prod exists
ENV_FILE="$(dirname "$0")/../.env.prod"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -o allexport && source "$ENV_FILE" && set +o allexport
fi

POSTGRES_USER="${POSTGRES_USER:-hotel_user}"
POSTGRES_DB="${POSTGRES_DB:-hotel_prod}"

echo "[$(date -Iseconds)] Restoring from $BACKUP_FILE..."
echo "[$(date -Iseconds)] Target: $POSTGRES_DB as $POSTGRES_USER"
echo ""
read -rp "This will OVERWRITE the current database. Type 'yes' to continue: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

COMPOSE_FILE="$(dirname "$0")/../docker-compose.prod.yml"

# Drop & recreate the database
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$POSTGRES_DB' AND pid <> pg_backend_pid();" \
  > /dev/null

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS $POSTGRES_DB;" \
  > /dev/null

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER;" \
  > /dev/null

echo "[$(date -Iseconds)] Database recreated — streaming restore..."

gunzip -c "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --quiet

echo "[$(date -Iseconds)] Restore complete."
