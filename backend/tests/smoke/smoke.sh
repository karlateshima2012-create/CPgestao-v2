#!/bin/bash

# CPgestao-fidelidadeV1 - Smoke Test Script (CURL)
BASE_URL="http://localhost:8000/api"
ADMIN_EMAIL="admin@creativeprint.com"
ADMIN_PASS="admin123"
CLIENT_EMAIL="dono-v3@loja.com"
CLIENT_PASS="loja123"
SLUG="loja-smoke-v3"
DEVICE_UID="premium-device-v3"

echo "=== STARTING SMOKE TEST ==="

# 1. Login Admin
echo -n "1. Admin Login: "
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\", \"password\":\"$ADMIN_PASS\"}")

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$ADMIN_TOKEN" ]; then echo "OK"; else echo "FAIL"; fi

# 1.5 Create Tenant (Self-contained)
echo -n "1.5 Create Tenant: "
RAND_SUFFIX=$(date +%s)
TENANT_RES=$(curl -s -X POST "$BASE_URL/admin/tenants" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke Auto $RAND_SUFFIX\", \"email\":\"auto$RAND_SUFFIX@test.com\", \"plan\":\"Pro\"}")

# Extract ID and Slug
# Response: {ok:true, data:{id:..., slug:..., ...}}
TENANT_ID=$(echo $TENANT_RES | grep -o '"id":[^,]*' | cut -d'"' -f4)
SLUG=$(echo $TENANT_RES | grep -o '"slug":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$TENANT_ID" ]; then echo "OK ($SLUG)"; else echo "FAIL"; fi

# 1.6 Create Batch to get Fresh Device
echo -n "1.6 Create Batch (Dynamic UID): "
BATCH_RES=$(curl -s -X POST "$BASE_URL/admin/tenants/$TENANT_ID/premium-batches" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity":1, "label":"Smoke Dynamic"}')

BATCH_ID=$(echo $BATCH_RES | grep -o '"id":[^,]*' | cut -d'"' -f4)

DEVICES_RES=$(curl -s -X GET "$BASE_URL/admin/tenants/$TENANT_ID/premium-batches/$BATCH_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
  
DEVICE_UID=$(echo $DEVICES_RES | grep -o '"uid":"[^"]*' | head -1 | cut -d'"' -f4)

if [ ! -z "$DEVICE_UID" ]; then echo "OK ($DEVICE_UID)"; else echo "FAIL"; fi

# 2. Login Client
echo -n "2. Client Login: "
CLIENT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CLIENT_EMAIL\", \"password\":\"$CLIENT_PASS\"}")

CLIENT_TOKEN=$(echo $CLIENT_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$CLIENT_TOKEN" ]; then echo "OK"; else echo "FAIL"; fi

# 3. RBAC Check (Client trying admin)
echo -n "3. RBAC Check (403 expected): "
RBAC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/admin/tenants" \
  -H "Authorization: Bearer $CLIENT_TOKEN")

if [ "$RBAC_STATUS" == "403" ]; then echo "OK"; else echo "FAIL ($RBAC_STATUS)"; fi

# 4. Public Terminal Validation (Invalid UID)
echo -n "4. Terminal Security (404 expected): "
TERM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/public/terminal/$SLUG/invalid-uid")

if [ "$TERM_STATUS" == "404" ]; then echo "OK"; else echo "FAIL ($TERM_STATUS)"; fi

# 5. Throttle Check (Quick hits on validate-pin)
echo -n "5. Throttle Check: "
for i in {1..50}; do
  THROTTLE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/public/terminal/$SLUG/$DEVICE_UID/validate-pin" \
    -H "Content-Type: application/json" \
    -d '{"pin":"0000"}')
  
  if [ "$THROTTLE_STATUS" == "429" ]; then
    echo "OK (Detected 429)"
    break
  fi
done

if [ "$THROTTLE_STATUS" != "429" ]; then echo "FAIL (Status: $THROTTLE_STATUS)"; fi

echo "=== SMOKE TEST COMPLETE ==="
