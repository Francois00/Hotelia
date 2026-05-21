#!/bin/bash
# Imports and activates all n8n flows.
# Run from the host: bash scripts/setup-n8n.sh
# Or inside the container: sh /tmp/setup-n8n.sh (after docker cp)
set -e
echo "=== Setting up n8n flows ==="

N8N_URL="http://localhost:5678"
N8N_USER="admin"
N8N_PASS="n8n2026!"
N8N_OWNER_EMAIL="admin@hotelia.pe"
N8N_OWNER_PASS="Admin2026!"
COOKIES="/tmp/n8n_setup_cookies.txt"

# 1. Wait for n8n to be ready
echo "Waiting for n8n..."
for i in $(seq 1 40); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$N8N_URL/healthz" 2>/dev/null)
  [ "$STATUS" = "200" ] && break
  sleep 3; echo "  waiting... (${i})"
done
echo "n8n is up."

# 2. Ensure owner exists (idempotent: fails silently if already set up)
curl -s -X POST "$N8N_URL/rest/owner/setup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$N8N_OWNER_EMAIL\",\"firstName\":\"Admin\",\"lastName\":\"Hotel\",\"password\":\"$N8N_OWNER_PASS\",\"skipInstanceSetup\":true}" \
  > /dev/null 2>&1 || true

# 3. Login and save session cookie
curl -s -X POST "$N8N_URL/rest/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIES" \
  -d "{\"emailOrLdapLoginId\":\"$N8N_OWNER_EMAIL\",\"password\":\"$N8N_OWNER_PASS\"}" \
  > /dev/null

# 4. Import all flows via n8n CLI (inside container) or host API
FLOW_DIR="/home/node/flows"
if command -v n8n > /dev/null 2>&1; then
  # Running inside container — use CLI
  echo "Importing via n8n CLI..."
  n8n import:workflow --separate --input="$FLOW_DIR"
else
  echo "Importing via REST API (host mode)..."
  FLOW_DIR="./n8n-flows"
fi

# 5. Activate each workflow
activate_flow() {
  local WF_ID=$1
  local NAME=$2
  WF=$(curl -s -u "$N8N_USER:$N8N_PASS" "$N8N_URL/rest/workflows/$WF_ID" \
    -b "$COOKIES" 2>/dev/null)
  VERSION=$(echo "$WF" | grep -o '"versionId":"[^"]*"' | head -1 | cut -d'"' -f4)
  RESULT=$(curl -s -X POST -u "$N8N_USER:$N8N_PASS" \
    "$N8N_URL/rest/workflows/$WF_ID/activate" \
    -b "$COOKIES" \
    -H "Content-Type: application/json" \
    -d "{\"versionId\":\"$VERSION\"}" 2>/dev/null)
  ACTIVE=$(echo "$RESULT" | grep -o '"active":[a-z]*' | head -1 | cut -d: -f2)
  echo "  $NAME → active=$ACTIVE"
}

echo "Activating workflows..."
activate_flow "checkin-automatico-flow-001"       "Checkin Automatico"
activate_flow "checkout-automatico-flow-002"      "Checkout Automatico"
activate_flow "encuesta-post-estancia-flow-003"   "Encuesta Post Estancia"
activate_flow "alerta-mantenimiento-flow-004"     "Alerta Mantenimiento"
activate_flow "segmentacion-semanal-flow-005"     "Segmentacion Semanal CRM"

echo ""
echo "=== n8n setup complete ==="
echo "Open: http://localhost:5678"
echo "Login (UI): $N8N_USER / $N8N_PASS"
echo ""
echo "Active workflows:"
curl -s -u "$N8N_USER:$N8N_PASS" "$N8N_URL/rest/workflows" \
  -b "$COOKIES" 2>/dev/null \
  | grep -o '"name":"[^"]*","[^"]*"active":true' | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || true
