#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
LOG_FILE="$PROJECT_DIR/deploy.log"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"; }

log "═══════════════════════════════════════════════════"
log "Hotel PMS — Production Deploy"
log "═══════════════════════════════════════════════════"

cd "$PROJECT_DIR"

# ─── 1. Pull latest code ─────────────────────────────────────────────────────
log "1/6 — Pulling latest code..."
git pull --ff-only
log "     Git HEAD: $(git rev-parse --short HEAD)"

# ─── 2. Validate env ─────────────────────────────────────────────────────────
log "2/6 — Validating .env.prod..."
if [[ ! -f .env.prod ]]; then
  log "ERROR: .env.prod not found — copy .env.prod.example and fill in values"
  exit 1
fi

for VAR in POSTGRES_PASSWORD JWT_SECRET REDIS_PASSWORD DOMAIN; do
  VAL=$(grep "^${VAR}=" .env.prod | cut -d= -f2-)
  if [[ -z "$VAL" || "$VAL" == CHANGE_ME* ]]; then
    log "ERROR: $VAR is not set or still has placeholder value"
    exit 1
  fi
done
log "     All required vars present"

# ─── 3. Build images ─────────────────────────────────────────────────────────
log "3/6 — Building Docker images..."
docker compose -f "$COMPOSE_FILE" build --no-cache --parallel
log "     Build complete"

# ─── 4. Run Prisma migrations ────────────────────────────────────────────────
log "4/6 — Running database migrations..."
docker compose -f "$COMPOSE_FILE" run --rm backend \
  npx prisma migrate deploy
log "     Migrations applied"

# ─── 5. Restart services ─────────────────────────────────────────────────────
log "5/6 — Restarting services..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
log "     Services started"

# ─── 6. Health checks ────────────────────────────────────────────────────────
log "6/6 — Waiting for health checks..."
ATTEMPTS=0
MAX_ATTEMPTS=30

until docker compose -f "$COMPOSE_FILE" exec -T backend \
    wget -qO- http://localhost:3000/health > /dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; then
    log "ERROR: Backend health check failed after ${MAX_ATTEMPTS} attempts"
    docker compose -f "$COMPOSE_FILE" logs --tail=50 backend
    exit 1
  fi
  log "     Attempt $ATTEMPTS/$MAX_ATTEMPTS — waiting 5s..."
  sleep 5
done

log "     Backend healthy"

# ─── 7. Auto-backup before finishing ─────────────────────────────────────────
log "Running post-deploy backup..."
bash "$SCRIPT_DIR/backup.sh" && log "     Backup saved" || log "     WARN: Backup failed (non-fatal)"

log "═══════════════════════════════════════════════════"
log "Deploy complete — $(git rev-parse --short HEAD)"
log "═══════════════════════════════════════════════════"
