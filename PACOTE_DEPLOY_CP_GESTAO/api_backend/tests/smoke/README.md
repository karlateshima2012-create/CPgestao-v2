# Smoke Test Results

## Latest Execution Results (2026-01-26)

| Test | Status | Note |
| :--- | :--- | :--- |
| 1. Admin Login | PASS | Successfully received Sanctum token |
| 2. Client Login | PASS | Successfully received Sanctum token |
| 3. RBAC Check | PASS | Client hit 403 on admin routes |
| 4. Terminal Security | PASS | Invalid UID returned 404 |
| 5. Throttle Check | FAIL/WARN | 429 not detected in high-speed burst (investigate cache/rate-limiting config if critical) |

## Standard Expected Status Codes
- **200 OK**: Generic success
- **401 Unauthorized**: Authentication failure or Invalid PIN
- **403 Forbidden**: Correct Role but unauthorized resource
- **404 Not Found**: Resource doesn't exist or is from another Tenant (Security)
- **409 Conflict**: Duplicate phone or Insufficient balance
- **422 Unprocessable Entity**: Validation failure
- **429 Too Many Requests**: Rate limit hit (Terminal actions)
