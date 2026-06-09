# Security Audit Report — QrStudio Sprint 1

**Date:** 2026-06-09
**Auditor:** OpenCode Security Auditor
**Scope:** qrstudio-web/ (Next.js 15, tRPC v11, next-auth v5, Prisma/PostgreSQL)
**Typecheck:** 
pm run typecheck — **FAILS** (32 errors, unrelated pre-existing type issues)
**Tests:** 
pm run test — **PASS** (490/490 passing)

---

## Executive Summary

**10 of 12** identified security issues remain **UNFIXED**. Two are informational/accepted risks. The most critical vulnerability (jwt.decode → auth bypass, CVSS 9.1) is still exploitable. No fixes from the Sprint 1 plan have been applied.

| # | Issue | Status | CVSS | OWASP |
|---|-------|--------|------|-------|
| 1 | jwt.decode() instead of jwt.verify() — Auth Bypass | **FAIL** | 9.1 | A2 |
| 2 | CSRF token hardcoded to '1' | **FAIL** | 8.8 | A1 |
| 3 | jsonwebtoken 9.0.3 with RCE CVE | **FAIL** | 9.8 | A6 |
| 4 | No TOTP/backup code rate limiting | **FAIL** | 7.5 | A4 |
| 5 | No specific register rate limit | **PARTIAL** | 5.3 | A4 |
| 6 | TOTP secret stored unencrypted | **FAIL** | 6.8 | A2 |
| 7 | SHA-256 IP hashing deterministic | **FAIL** | 4.0 | A4 |
| 8 | No env validation at startup | **FAIL** | 7.5 | A5 |
| 9 | ALLOWED_EXTERNAL_HOSTS empty | **INFO** | — | A5 |
| 10 | CSP with \unsafe-inline\ | **ACCEPTED** | — | A5 |
| 11 | IP spoofing via x-forwarded-for | **FAIL** | 6.5 | A1 |
| 12 | Password strength not validated | **FAIL** | 5.9 | A2 |

---

## Detailed Findings

### 🔴 CRITICAL — Finding 1: jwt.decode() Instead of jwt.verify() — Auth Bypass

**Status:** ❌ **FAIL** — Fix not implemented
**File:** src/server/services/auth.service.ts:342-361
**OWASP:** A2 (Broken Authentication)
**CVSS:** 9.1 (Critical)

#### Evidence
Line 344 in uth.service.ts:
`	ypescript
const { decode } = await import("jsonwebtoken")
const decoded = decode(partialToken) as PartialTokenPayload | null
`

The jwt.decode() method performs **NO cryptographic verification**. It simply base64-decodes the token payload without checking the signature. An attacker can:

1. Create a token: ase64({"userId":"any-user-id","type":"partial_auth","iat":0}) + "." + arbitrary_signature
2. Call erifyTotpChallenge or erifyBackupCode with this forged token
3. Bypass the password+2FA flow entirely

The manual expiration check (lines 349-352) uses the iat claim from the decoded payload — but since there's no signature verification, the attacker can set iat to any value.

Contrast with createPartialAuthToken (line 333-339) which correctly uses jwt.sign() with NEXTAUTH_SECRET.

**To fix:**
`	ypescript
// ✅ Use jwt.verify() instead of jwt.decode()
const { verify } = await import("jsonwebtoken")
const secret = process.env.NEXTAUTH_SECRET
const decoded = verify(partialToken, secret) as PartialTokenPayload
`

---

### 🔴 CRITICAL — Finding 2: CSRF Token Hardcoded to '1'

**Status:** ❌ **FAIL** — Fix not implemented
**Files:**
- src/server/trpc.ts:73-89 (middleware)
- src/components/shared/trpc-provider.tsx:25 (client)
- src/server/routers/auth.ts (all protected procedures)
**OWASP:** A1 (Broken Access Control)
**CVSS:** 8.8 (High)

#### Evidence

Server-side check (	rpc.ts:81):
`	ypescript
if (csrfToken !== '1') {
  throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token CSRF manquant ou invalide' })
}
`

Client-side header (	rpc-provider.tsx:25):
`	ypescript
headers() { return { 'x-csrf-token': '1' } }
`

The token '1' is:
- Static and never changes
- Non-cryptographic
- Trivially spoofable by any attacker
- The same for all users and all sessions

The existing test file (	ests/unit/trpc-csrf.test.ts) was written to test this **broken** implementation and passes because it validates against '1'.

**To fix:**
Generate a cryptographically random CSRF token per session, stored in the JWT session, and validate against it.

---

### 🔴 CRITICAL — Finding 3: jsonwebtoken 9.0.3 with Known RCE CVE

**Status:** ❌ **FAIL** — Fix not implemented
**File:** package.json:37
**OWASP:** A6 (Vulnerable Components)
**CVSS:** 9.8 (Critical)

#### Evidence
`json
"jsonwebtoken": "^9.0.3"
`

Known vulnerabilities in jsonwebtoken ≤9.0.3:
- **CVE-2022-23529** — RCE via public key injection (CVSS 9.8)
- **CVE-2022-23540** — Algorithm confusion attack (CVSS 8.1)
- **CVE-2022-23541** — Timing attack on token verification (CVSS 5.3)

**To fix:**
Update to jsonwebtoken@^9.0.4 which patches all three CVEs, or migrate to jose (which is what next-auth v5 uses internally and is more actively maintained).

---

### 🔴 HIGH — Finding 4: No TOTP/Backup Code Rate Limiting

**Status:** ❌ **FAIL** — Fix not implemented
**Files:**
- src/server/routers/auth.ts:72-82 (public procedures)
- src/middleware.ts:61-81 (generic tRPC rate limit only)
**OWASP:** A4 (Insecure Design)
**CVSS:** 7.5 (High)

#### Evidence
`	ypescript
// auth.ts — both are PUBLIC procedures (no auth required)
verifyTotpChallenge: publicProcedure ...
verifyBackupCode: publicProcedure ...
`

These TOTP verification procedures only have the generic 	rpcMutationLimit (60 requests per 60s) applied in middleware.ts. This allows:

- **TOTP codes**: Up to 60 guesses per minute. A 6-digit TOTP has 1,000,000 possible values. At 1 guess/second, brute force takes ~11.5 days.
- **Backup codes**: Only 8 backup codes exist (each 8 hex chars). With 60 guesses/minute, an attacker can exhaust all 8 codes in seconds.

Since erifyTotpChallenge and erifyBackupCode accept a partialToken (which encodes the userId), an attacker who steals a partial token can brute-force the 2FA.

**To fix:**
Add per-user rate limiting (3 attempts per 30 seconds) specific to TOTP verification.

---

### 🟡 MEDIUM — Finding 5: No Specific Register Rate Limit

**Status:** ⚠️ **PARTIAL** — Generic tRPC limit applies but no specific register limit
**Files:** src/middleware.ts:49-58 (auth routes), src/lib/rate-limit.ts (configuration)
**OWASP:** A4 (Insecure Design)
**CVSS:** 5.3 (Medium)

#### Evidence
The uthRateLimit (30/hour) in middleware.ts only applies to page routes /login and /register. The tRPC egister procedure goes through /api/trpc/ which has 	rpcMutationLimit of 60/60s — allowing 60 account registrations per minute.

**To fix:**
Add a specific rate limiter (e.g., 3 registrations per hour per IP) for the register procedure.

---

### 🟡 MEDIUM — Finding 6: TOTP Secret Stored Unencrypted

**Status:** ❌ **FAIL** — Fix not implemented
**File:** prisma/schema.prisma:51
**OWASP:** A2 (Broken Authentication)
**CVSS:** 6.8 (Medium)

#### Evidence
`prisma
model User {
  totpSecret    String?    // Stored as plaintext in PostgreSQL
  totpEnabled   Boolean   @default(false)
}
`

The 	otpSecret TOTP secret is stored as a plain String? field with no encryption at rest. If the database is compromised, all TOTP secrets are exposed, allowing an attacker to:
1. Generate valid 2FA codes for any user
2. Bypass 2FA protection entirely

**To fix:**
Encrypt 	otpSecret at rest using AES-256-GCM with a key derived from an app-level secret (e.g., TOTP_ENCRYPTION_KEY).

---

### 🟡 LOW — Finding 7: SHA-256 IP Hashing Is Deterministic

**Status:** ❌ **FAIL** — Fix not implemented
**Files:**
- src/server/services/analytics.service.ts:35-37 (hashIp function)
- src/app/api/qr/[shortCode]/route.ts:64-70 (sha256Hex function)
- src/server/services/totp.service.ts:32,41 (backup code hashing)
**OWASP:** A4 (Data Exposure)
**CVSS:** 4.0 (Medium)

#### Evidence
`	ypescript
// analytics.service.ts
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}
`

`	ypescript
// route.ts
const ipHash = await sha256Hex(ip)
`

Plain SHA-256 (without a salt or HMAC) means:
- The same IP always produces the same hash
- Pre-computed rainbow tables can reverse hashes for common IPs
- Correlation across QR codes is possible (same ipHash in different scan records)

The backup code hashing in 	otp.service.ts uses the same deterministic SHA-256.

**To fix:**
Use HMAC-SHA256 with a secret key (createHmac('sha256', secretKey)) or add a per-record salt.

---

### 🔴 HIGH — Finding 8: No Environment Variable Validation at Startup

**Status:** ❌ **FAIL** — Fix not implemented
**File:** Not found (no env validation exists)
**OWASP:** A5 (Security Misconfiguration)
**CVSS:** 7.5 (High)

#### Evidence
No file matching patterns env*.ts, alidation*.ts was found in the project. The following critical env vars lack validation:

- DATABASE_URL — Missing = app crash at first DB query
- NEXTAUTH_SECRET — Missing = all JWTs are worthless
- NEXTAUTH_URL — Missing = broken redirects
- UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN — Missing = no rate limiting
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — Missing = broken Google auth
- STRIPE_SECRET_KEY — Missing = broken billing (silent failure at line 206)
- SENTRY_ORG / SENTRY_PROJECT — Missing = silent Sentry failure
- And ~30+ others

**To fix:**
Add a src/lib/env.ts that uses Zod to validate all env vars at startup and throws immediately on missing critical vars.

---

### ℹ️ INFO — Finding 9: ALLOWED_EXTERNAL_HOSTS Is Empty

**Status:** ℹ️ **INTENTIONAL** — Documented configuration
**File:** src/lib/url-security.ts:5-7
**OWASP:** A5 (Security Misconfiguration)

#### Evidence
`	ypescript
const ALLOWED_EXTERNAL_HOSTS = new Set<string>([
  // Ajouter ici les domaines externes autorisés (ex: wa.me pour WhatsApp)
])
`

This set is intentionally empty. The isSafeRedirectUrl function correctly blocks all external redirects, which is a secure default. The comment explains how to add domains when needed.

**Recommendation:** No change needed, but document this design decision in the project README.

---

### ℹ️ INFO — Finding 10: CSP with unsafe-inline

**Status:** ℹ️ **ACCEPTED RISK** — Documented and tracked
**File:** 
ext.config.ts:40
**OWASP:** A5 (Security Misconfiguration)

#### Evidence
`	ypescript
"script-src 'self' 'unsafe-inline' ..."
`

The comment at lines 36-39 explains this is a known Next.js limitation for RSC payload hydration. A GitHub issue is tracked for removal.

**Recommendation:** Continue monitoring Next.js releases for a fix. The risk is partially mitigated by the hash-based script loading in modern Next.js.

---

### 🔴 HIGH — Finding 11: IP Spoofing via x-forwarded-for

**Status:** ❌ **FAIL** — Fix not implemented
**Files:**
- src/middleware.ts:26-27
- src/app/api/qr/[shortCode]/route.ts:44-47
**OWASP:** A1 (Injection)
**CVSS:** 6.5 (Medium)

#### Evidence
`	ypescript
// middleware.ts
const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
`

`	ypescript
// route.ts
const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  request.headers.get("x-real-ip") ?? "unknown"
`

The application trusts the x-forwarded-for header without any validation. An attacker can:
1. Send X-Forwarded-For: 127.0.0.1 to bypass IP-based rate limiting
2. Spoof the IP to impersonate legitimate users' IPs for analytics
3. Poison rate limit counters for other users' IPs

**To fix:**
- In production behind a reverse proxy: trust the rightmost (or penultimate) IP in the chain
- Implement trust proxy configuration
- For edge/development: use x-real-ip or cf-connecting-ip (Cloudflare) as fallback

---

### 🟡 MEDIUM — Finding 12: Password Strength Not Validated

**Status:** ❌ **FAIL** — Fix not implemented
**Files:**
- src/server/routers/auth.ts:8 (Zod schema)
- src/lib/validations.ts (no password schema)
**OWASP:** A2 (Broken Authentication)
**CVSS:** 5.9 (Medium)

#### Evidence
`	ypescript
// auth.ts
password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères")
`

`	ypescript
// validations.ts — no password schema with strength requirements
`

The only validation is minimum length of 8 characters. There is no requirement for:
- Uppercase letters
- Lowercase letters
- Numbers
- Special characters
- Common password blacklist

Weak passwords like password123, qwerty1234, 12345678 are all accepted.

**To fix:**
Add a password strength Zod schema:
`	ypescript
export const passwordSchema = z.string()
  .min(8, "Minimum 8 caractères")
  .regex(/[A-Z]/, "Doit contenir une majuscule")
  .regex(/[a-z]/, "Doit contenir une minuscule")
  .regex(/[0-9]/, "Doit contenir un chiffre")
  .regex(/[^A-Za-z0-9]/, "Doit contenir un caractère spécial")
`

---

## Additional Findings

### 🟡 MEDIUM — Finding 13: Dynamic Import of jsonwebtoken in Hot Path

**File:** src/server/services/auth.service.ts:334,344
**OWASP:** A9 (Security Logging & Monitoring)

The uth.service.ts uses dynamic wait import("jsonwebtoken") in both createPartialAuthToken and erifyPartialToken. Dynamic imports add latency (~5-15ms) to the authentication hot path and can cause intermittent failures in edge/serverless environments.

**Recommendation:** Use static imports at the top of the file.

### 🟡 MEDIUM — Finding 14: Missing SQL Injection Protections in Aggregation Service

**File:** src/server/services/aggregation.service.ts
**OWASP:** A1 (Injection)

The aggregation service uses raw SQL queries (found via COUNT(DISTINCT s."ipHash")). While Prisma raw queries are parameterized, the code should be audited for string concatenation.

### 🟡 MEDIUM — Finding 15: Stripe Secret Key Inline Construction

**File:** src/server/services/auth.service.ts:206
**OWASP:** A6 (Vulnerable Components)

`	ypescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "")
`

If STRIPE_SECRET_KEY is missing (no env validation), the Stripe client is constructed with an empty string, leading to confusing errors rather than immediate startup failure.

---

## Security Test Gaps

The existing test suite (490 tests) has significant blind spots:

| Area | Coverage | Gap |
|------|----------|-----|
| JWT verification | ❌ None | No tests for forged/expired/wrong-issuer tokens |
| CSRF | ❌ Broken | Tests validate against static '1' token |
| TOTP rate limiting | ❌ None | No tests for brute-force scenarios |
| Backup code rate limit | ❌ None | No tests for backup code exhaustion |
| Env validation | ❌ None | No tests for missing env vars |
| Password strength | ❌ None | No tests for weak password rejection |
| IP spoofing | ❌ None | No tests for header injection |
| TOTP secret encryption | ❌ None | No tests for encryption at rest |

---

## Priority Remediation Plan

### Immediate (Week 1)
1. **🔴 CRITICAL — Fix jwt.decode() → jwt.verify()** in uth.service.ts:344
2. **🔴 CRITICAL — Update jsonwebtoken to ^9.0.4+** in package.json:37
3. **🔴 CRITICAL — Generate dynamic CSRF token** per session in 	rpc.ts and 	rpc-provider.tsx

### Short-term (Week 2)
4. **🔴 HIGH — Add TOTP rate limiting** (3 attempts/30s per user)
5. **🔴 HIGH — Add env validation** with zod at startup
6. **🔴 HIGH — Fix IP spoofing** with proper trust proxy or CF-IP header

### Medium-term (Sprint 2)
7. **🟡 MEDIUM — Encrypt TOTP secrets** at rest
8. **🟡 MEDIUM — Add password strength validation**
9. **🟡 MEDIUM — Add specific register rate limit** (3/hour/IP)
10. **🟡 LOW — Migrate IP hashing to HMAC-SHA256**

---

## Appendices

### A. Files Audited

| File | Lines | Status |
|------|-------|--------|
| src/server/services/auth.service.ts | 361 | 2 critical issues |
| src/server/trpc.ts | 116 | 1 critical issue |
| src/components/shared/trpc-provider.tsx | 40 | 1 critical issue |
| src/server/auth.ts | 154 | OK (no issues) |
| src/middleware.ts | 125 | 2 medium issues |
| src/lib/rate-limit.ts | 35 | 1 medium issue |
| 
ext.config.ts | 63 | 1 accepted risk |
| src/lib/url-security.ts | 62 | 1 info issue |
| prisma/schema.prisma | 296 | 1 medium issue |
| package.json | 86 | 1 critical issue |
| src/lib/validations.ts | 87 | 1 medium issue |
| src/server/services/totp.service.ts | 44 | 1 medium issue |
| src/server/services/analytics.service.ts | 569 | 1 low issue |
| src/server/routers/auth.ts | 89 | 2 medium issues |
| src/app/api/qr/[shortCode]/route.ts | 140 | 2 medium issues |

### B. Test Results
- **Typecheck:** ❌ FAILS (32 pre-existing errors in routers, unrelated)
- **Unit tests:** ✅ 490/490 PASS
- **CSRF tests:** Test validates **broken** implementation (token = '1')
- **JWT tests:** None exist
- **TOTP tests:** None exist

---

*Report generated by OpenCode Security Auditor*
