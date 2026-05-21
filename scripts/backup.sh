#!/usr/bin/env bash
set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../db/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/hotel_prod_$TIMESTAMP.sql.gz"

# Load env if .env.prod exists alongside this script
ENV_FILE="$(dirname "$0")/../.env.prod"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -o allexport && source "$ENV_FILE" && set +o allexport
fi

POSTGRES_USER="${POSTGRES_USER:-hotel_user}"
POSTGRES_DB="${POSTGRES_DB:-hotel_prod}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting backup → $BACKUP_FILE"

docker compose -f "$(dirname "$0")/../docker-compose.prod.yml" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-password \
  | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] Backup complete — size: $SIZE"

# ─── Prune old backups ───────────────────────────────────────────────────────
echo "[$(date -Iseconds)] Pruning backups older than $KEEP_DAYS days..."
find "$BACKUP_DIR" -name "hotel_prod_*.sql.gz" -mtime +"$KEEP_DAYS" -delete
REMAINING=$(find "$BACKUP_DIR" -name "hotel_prod_*.sql.gz" | wc -l)
echo "[$(date -Iseconds)] Done — $REMAINING backup(s) retained"
