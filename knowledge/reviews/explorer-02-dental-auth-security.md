# Explorer report 2: dental-auth-security

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 2 (Understand phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, explorer, dental-auth-security

## Summary

The dental repo ("Smile Notes") has a genuinely production-grade authentication and authorization layer for what it currently is: a single-practice, single-tenant, de-identified clinical-note builder that holds NO patient records. Auth is Auth.js/NextAuth v5 w…

## Scope

dental-auth-security

## Summary

The dental repo ("Smile Notes") has a genuinely production-grade authentication and authorization layer for what it currently is: a single-practice, single-tenant, de-identified clinical-note builder that holds NO patient records. Auth is Auth.js/NextAuth v5 with a Credentials provider over bcrypt(cost 12), a 12-hour JWT session, optional TOTP MFA, and a database-backed failed-attempt throttle. The critical architectural decision — and the one most worth carrying into the merged PMS — is that `src/middleware.ts` is explicitly treated as convenience only: its `authorized()` callback returns `true` for every `/api/*` path, and all API authorization is re-derived per request by `requireRole()` in `src/lib/auth/guards.ts`, which does a fresh primary-key read of the user row on every call. Role, active state, clinical scope, and a session-revocation watermark are therefore read from the database, never from the token, so demoting or deactivating a user bites on their very next request rather than at token expiry.

The code quality in this subsystem is unusually high and the comments are a written record of bugs found on a running server and then fixed: the throttle's lock-decay state machine (`throttle.ts` lines 131-204) documents and fixes a self-renewing lock that held correct passwords out indefinitely; `clientIp.ts` documents and fixes an index-then-validate ordering bug that would have handed an attacker their own forged XFF entry; `maskPhi.ts` documents and fixes two masking bugs that left half-redacted identifiers behind while the re-audit reported PASS; `hashGate.ts` exists because bcryptjs is pure JS and chunks over the same event loop that serves signed-in clinicians. The security-header block in `next.config.mjs` is applied to `/:path*` (pages, API, and static alike) with a route-scoped `no-referrer` + `no-store` override on `/reset/*`, and `e2e/headers.mjs` asserts all of it off the wire of a production build.

The role model is two orthogonal axes, deliberately not one ladder. `src/lib/auth/roles.ts` defines an administrative rank ladder (readonly < user < lead < manager < admin) used only for "do you have at least this much access", and a separate set of named capability predicates keyed on ACTOR × TARGET role via a `MANAGE_CEILING` matrix, so a Hierarchy Manager who sits at the top of the practice may still only ever create Team Leads and may never read a password. `src/lib/auth/clinicalRoles.ts` carries an entirely separate scope-of-practice axis (unset/assistant/hygienist/dentist/smilenotes) grounded in Tenn. Comp. R. & Regs. 0460, which gates who may write a diagnosis or plan and, via `approval.ts`, who may file a note into the permanent record. Both axes are enforced server-side from the freshly-read row, and `capabilityTier()` gates AI capabilities by licence on the server before any provider call.

What it is NOT, and this is the whole gap: there is no tenant, no organization, no patient entity, and no ePHI read logging anywhere. Seventeen tables in `src/lib/db/schema.ts` and not one `tenant_id`. Access control is "your own notes" or "the whole practice" — there is no minimum-necessary scoping, no treatment-relationship authorization, and no break-the-glass. The audit log is a plain serial table with no hash chain, no append-only enforcement, and no IP/user-agent columns (auth source IP is stuffed into the free-text `detail` field as "from <ip>"). MFA is default-OFF and self-service opt-in with no recovery codes and no policy enforcement. TOTP secrets sit in a plaintext `text` column. And `src/lib/client/draftBackup.ts` mirrors full note state plus title into `localStorage` and an 8-deep IndexedDB ring on shared operatory glass, cleared only on server-save ack — never on logout, author switch, or session revoke. Both adversarial panels in `knowledge/sources/` call that out as a pilot-killer, and they are right; for a product that WILL hold PHI it is unencrypted ePHI at rest on an unmanaged endpoint.

## Architecture

ENTRY POINTS AND LAYERS

1. `src/middleware.ts` (50 lines) — runs on the NODE runtime, not Edge (deliberate: `jose` reaches for CompressionStream and warned on every build; the app is self-hosted next to the practice DB so there is no edge network to exploit). It instantiates NextAuth with the db-free `authConfig` only. Its matcher excludes `/login`, `/setup`, `/reset`, `/api/auth`, `/api/setup`, `/api/reset`, `_next/static`, `_next/image`, `fonts/`, `characters/`, `brand/`, `favicon.ico`, `icon.svg` — every exclusion anchored to a segment boundary so a future `/login-help` is not silently public. Middleware gates PAGE navigation only.

2. `src/lib/auth/auth.config.ts` (67 lines) — the edge-safe config (imports nothing from db/bcrypt/node builtins). Session: `{ strategy: "jwt", maxAge: 60*60*12, updateAge: 60*15 }`. `authorized()` returns `true` for anything under `/api/`, so API routes answer with JSON 401/403 rather than following a login redirect into HTML. This is the load-bearing design decision: the API layer is DEFAULT-ALLOW at the middleware and default-deny only via per-route `requireRole` calls.

3. `src/lib/auth/auth.ts` (242 lines) — the Credentials provider, node runtime. Sign-in order is deliberate and each step is documented: (a) `clientIp(request)`; (b) READ-ONLY `checkThrottle` on `loginPairKey(ip, username)` — never a write, because the previous write-as-gate design made every attempt (including correct-password ones) re-arm the lock, measured as still-refusing after 70 seconds of guessing; (c) user lookup by username then lowercased username; (d) `withHashSlot(() => verifyPassword(password, user?.active ? user.passHash : TIMING_DUMMY_HASH))` — the gate wraps BOTH the real verify and the timing dummy so a saturated server refuses known and unknown usernames identically; `{ok:false}` means "too busy", not "wrong password"; (e) on failure, `chargeFailure()` writes the pair budget and, separately, an IP-only spray DETECTOR that never gates; (f) TOTP checked only AFTER the password verified, and only when `mfaFeatureEnabled()`; (g) success clears the pair streak, writes an `auth.signin` audit row, and mints a token stamped with `sessionWatermark(user)`.

4. `src/lib/auth/guards.ts` (79 lines) — `requireRole(min, {requireAck})` is THE API authorization authority. Per call it: resolves the session, 401s if absent; reads the user row by PK; 403s if missing or `!active`; 401s if `isTokenRevoked(row, sessionUser.pwAt)`; 403s if `!meetsRole(row.role, min)`; 403s if `noticeAckAt === null` unless `requireAck:false`; then returns a `SessionUser` built from the FRESH row including `resolveClinicalRole(row.role, row.clinicalRole)`.

5. `src/lib/auth/freshUser.ts` (41 lines) — `freshSessionUser()` is the page-side twin, wrapped in React `cache()` so layout+page share one PK read. It mirrors requireRole's checks exactly (active, watermark, clinical role resolution) so a page and its API can never disagree.

ENFORCEMENT IS SERVER-SIDE THROUGHOUT. Of 41 route files under `src/app/api/**`, 37 call `requireRole` at the top of every handler. The four that do not are all deliberate: `api/auth/[...nextauth]` (NextAuth itself), `api/setup` (allowed only while `countUsers(db) === 0`, with an atomic `createFirstAdminGuarded` count-recheck-plus-insert in one serialized transaction), `api/reset` (unauthenticated by design — the token IS the credential), and `api/law-watch/alert` (CRON_SECRET bearer, compared via SHA-256-digest `timingSafeEqual`, fails closed when unset).

SESSION REVOCATION. `src/lib/auth/sessionWatermark.ts` (35 lines) is the single rule: `sessionWatermark(row) = max(passwordChangedAt, sessionsRevokedAt)`; a token is dead when minted strictly before it. The same pure function is used in three places that must agree — token minting in `auth.ts`, `requireRole`, and `freshSessionUser` — or a token could be born already dead. `DELETE /api/me/sessions` sets `sessionsRevokedAt` and deliberately takes no user id (acts only on the caller, cannot be aimed at a colleague). `POST /api/me/password` calls `setPasswordAndRevokeLinks` which kills every prior token including the caller's own.

THROTTLING. `src/lib/auth/throttle.ts` (298 lines) is a DB-backed counter in the `auth_throttle` table (in DB, not memory, so a restart or a second isolate cannot hand out a fresh budget). Keys are namespaced: `login:<ip>|<username>` (pair, 5 free, doubling lock capped at 15 min), `loginip:<ip>` (30 free, 60s cap, DETECTOR ONLY — writes an `auth.spray` audit row and never refuses, because an office behind one NAT would go offline), `pwcheck:<userId>`, `resend:<draftId>`, `resetlink:<userId>`, `invite:<actorId>`, `export:<actorId>`, `assist:<userId>`. `recordFailure` is a single upsert with a three-branch CASE (live lock → freeze count; served lock → reset to 1; stale window → reset to 1) plus a compare-and-set UPDATE guarded on `lockedUntil IS NULL OR < now`, so `justLocked` is exactly-once even under a hundred parallel attempts. Rows are pruned on the same path that grows them (the table is attacker-writable via unknown usernames), and keys are truncated to 80 chars and lowercased.

CPU BOUND. `src/lib/auth/hashGate.ts` (72 lines) caps CONCURRENT bcrypt process-wide at 4 (`MAX_CONCURRENT_HASHES`), refusing rather than queueing, and returns a discriminated `{ok:false}` rather than throwing so "too busy" can never be miscaught as "wrong password" (503 vs 401). It is the only defence keyed on something an attacker cannot forge, which is what makes the header-trusting `clientIp` default survivable.

CLIENT IP. `src/lib/auth/clientIp.ts` (118 lines): tries `x-vercel-forwarded-for`, then `x-real-ip`, then `x-forwarded-for` read `TRUSTED_PROXY_HOPS` entries FROM THE RIGHT — indexed on the RAW list and validated after, never filtered-then-indexed (filtering junk first slides the index onto the attacker's own entry). Full IPv4/IPv6 validation, `[v6]:port` and `v4:port` and RFC 4007 zone handling, lowercased so one address is one budget. `TRUST_PROXY_HEADERS=none` disables header trust entirely.

MFA. `src/lib/auth/totp.ts` (56 lines) wraps `otpauth` with SHA1/6 digits/30s and a ±1 period window. `POST /api/me/mfa` implements start → confirm → disable; `start` REFUSES while MFA is already on (a prior version cleared `mfaEnabled` on start, a complete second-factor bypass for any stolen cookie); `disable` requires a current code so a walked-away session cannot strip the factor; code checks are metered on `passwordCheckKey`. `POST /api/admin/users/[id]/mfa-reset` requires `admin` AND `canSetPasswordDirectly` AND refuses `id === guard.user.id`, so the recovery path is a second person by construction and lands in the audit log. `mfaFeature.ts` gates the whole feature on `MFA_ENABLED === "1"`, default off.

RESET TOKENS. `src/lib/auth/resetToken.ts` (59 lines): 32 CSPRNG bytes base64url, only the SHA-256 hash stored, 1-hour TTL, `resetTokenMatches` uses `timingSafeEqual` on equal-length hex, and `resetLinkUrl` builds from `APP_URL`/`NEXTAUTH_URL` config — never the Host header, which would let an attacker mail a victim a link pointing at their own harvesting server. `issueResetLink.ts` invalidates prior tokens, refuses BEFORE writing a token if no base URL is configured, and returns the raw token to nobody. `POST /api/reset` returns one deliberately vague message for expired/used/nonexistent, and bcrypt only runs after a live token row is found (so it is not an unauthenticated CPU sink).

PHI GATE (server-side, before any provider call). `POST /api/assist` and `POST /api/bytestar` both run `runPhiRule(input)` (`src/lib/audit/rules/phi.ts`, 573 lines, ~18 rule patterns at S0/S2 — SSN, phone, 8 date shapes, email, MRN, names, obfuscated digits, hidden characters) merged with `scanPhiForProvider` (`phi-secondary.ts`, adds email-address, MRN-label, street-address, city/state/ZIP, plus an injectable `ScanPhiFn` that may only ADD findings, never clear one). ANY phi finding blocks the call, and the refusal is returned BEFORE the run meter is charged. The browser never talks to a provider; `connect-src 'self'` in CSP enforces that at the browser too. Licence gating (`capabilityTier(guard.user.clinicalRole, capability)`) is checked on the server against the DB-read clinical role, before the throttle and before the model call.

PHI ATTESTATION. `POST /api/drafts/[id]/submit` re-runs the audit server-side, PHI-scans `draft.title` too (because `slugifyTitle(title)` becomes the emailed attachment filename), and validates the override reason with `isValidPhiAttestation` (`src/lib/audit/attestation.ts`, 81 lines) — the same validator the dialog uses, requiring ≥4 words / ≥20 chars of characters that certainly render (an inverted allowlist, after a denylist of invisible characters lost to Braille blank, Hangul fillers, variation selectors, and tag characters).

AUDIT. `src/lib/db/repo/auditLog.ts` (147 lines) is the single write point, with per-column caps (action 64, name 200, target 200, detail 1000) and MARKED truncation (`…[truncated]`), because ~30 call sites would each have to remember otherwise and several log caller-supplied input. Actor name is frozen "Display (username)" at write time with no FK, so the log outlives deleted accounts. Reads are ordered by `(at DESC, id DESC)` because ties are routine. Filters: `all` / `auth` (`auth.%`) / `security` (everything except routine `auth.signin`).

SECURITY HEADERS. `next.config.mjs` (192 lines) applies a 14-directive CSP plus X-Frame-Options DENY, nosniff, `Referrer-Policy: same-origin`, Permissions-Policy (`microphone=(self)`, camera and everything else `()`), HSTS `max-age=63072000; includeSubDomains` with opt-in `preload` behind `HSTS_PRELOAD=1`, COOP/CORP same-origin, X-DNS-Prefetch-Control off, `poweredByHeader: false` — to `source: "/:path*"`, i.e. pages, API routes, and static assets. `/reset/:path*` gets `Cache-Control: no-store` and a `Referrer-Policy: no-referrer` override placed AFTER the spread so it wins (Next keeps the last same-key header), because the reset token lives in the URL path.

TRANSPORT/STORAGE. `src/lib/db/backend.ts` refuses to boot in production without `POSTGRES_URL` (a silent PGlite fallback under /tmp looks healthy until the next cold start wipes everything), with a two-hands `ALLOW_EPHEMERAL_DB=1` escape for test harnesses. `src/lib/db/postgresUrl.ts` rewrites `sslmode=require|prefer|verify-ca` to `verify-full` and APPENDS `sslmode=verify-full` to any URL with no sslmode that is not loopback — so Supabase/RDS/Railway/self-hosted strings that would otherwise have connected in plaintext are forced onto verified TLS.

## Key files


### Item 1
- **path**: /home/user/catcorner22/dental/src/lib/auth/guards.ts
- **purpose**: requireRole() — the single API authorization authority. Fresh per-request DB read for role, active state, session-revocation watermark, legal-notice acknowledgment, and clinical scope. Every one of 37 guarded API routes calls this.
- **loc estimate**: 79

### Item 2
- **path**: /home/user/catcorner22/dental/src/lib/auth/auth.ts
- **purpose**: NextAuth Credentials provider. Full sign-in ordering: read-only pair throttle -> user lookup -> hash-gated bcrypt with timing dummy -> failure charging + lockout/spray audit rows -> TOTP after password -> watermark-stamped token.
- **loc estimate**: 242

### Item 3
- **path**: /home/user/catcorner22/dental/src/lib/auth/roles.ts
- **purpose**: The role/capability model: rank ladder (readonly<user<lead<manager<admin) PLUS actor-x-target capability predicates via a MANAGE_CEILING matrix. seesAllNotes is an explicit allowlist, not an exclusion.
- **loc estimate**: 230

### Item 4
- **path**: /home/user/catcorner22/dental/src/lib/auth/throttle.ts
- **purpose**: DB-backed failed-attempt throttle. Pair key (ip|username) gates; IP-only key is a detector that never gates. Three-branch lock-decay CASE plus compare-and-set so justLocked is exactly-once under concurrency. Key namespaces for login, pwcheck, resend, resetlink, invite, export.
- **loc estimate**: 298

### Item 5
- **path**: /home/user/catcorner22/dental/src/lib/auth/hashGate.ts
- **purpose**: Process-wide concurrency cap on bcrypt (default 4). Refuses rather than queues; returns a discriminated result so 'too busy' (503) can never be miscaught as 'wrong password' (401). The only unforgeable-key defence in the login path.
- **loc estimate**: 72

### Item 6
- **path**: /home/user/catcorner22/dental/src/lib/auth/clientIp.ts
- **purpose**: Proxy-aware client IP derivation. Reads x-forwarded-for TRUSTED_PROXY_HOPS from the RIGHT, indexed on the raw list and validated after. Full IPv4/IPv6 validation with port and zone stripping. TRUST_PROXY_HEADERS=none escape hatch.
- **loc estimate**: 118

### Item 7
- **path**: /home/user/catcorner22/dental/src/lib/auth/sessionWatermark.ts
- **purpose**: The whole JWT-revocation trick in one pure function: max(passwordChangedAt, sessionsRevokedAt) vs the token's pwAt stamp. Used identically at minting, API guard, and page guard.
- **loc estimate**: 35

### Item 8
- **path**: /home/user/catcorner22/dental/src/lib/auth/clinicalRoles.ts
- **purpose**: Scope-of-practice axis (unset/assistant/hygienist/dentist/smilenotes), orthogonal to the admin ladder, grounded in Tenn. Comp. R. & Regs. 0460. Derives rather than stores; DENTIST_OWNED_SECTIONS gates diagnosis/plan authorship.
- **loc estimate**: 144

### Item 9
- **path**: /home/user/catcorner22/dental/src/lib/auth/totp.ts
- **purpose**: RFC 6238 TOTP via otpauth. SHA1/6-digit/30s with a +/-1 period window, strict 6-digit input validation, enrollment URI generation.
- **loc estimate**: 56

### Item 10
- **path**: /home/user/catcorner22/dental/src/lib/auth/password.ts
- **purpose**: bcrypt cost 12, PASSWORD_MIN 10 / PASSWORD_MAX 72 bytes (bcrypt truncation), single-repeated-char rejection, and a 19-entry common-password blocklist. One policy shared by setup, admin create, admin reset, and self-change.
- **loc estimate**: 76

### Item 11
- **path**: /home/user/catcorner22/dental/src/lib/auth/resetToken.ts
- **purpose**: Reset-link bearer credential hygiene: 32 CSPRNG bytes base64url, SHA-256 hash stored, 1h TTL, timingSafeEqual comparison, link base from config never the Host header.
- **loc estimate**: 59

### Item 12
- **path**: /home/user/catcorner22/dental/src/lib/auth/issueResetLink.ts
- **purpose**: Mints and mails a single-use reset link. Retires prior tokens, refuses before writing if no base URL is configured, returns the raw token to nobody so a manager can restore access without holding a credential.
- **loc estimate**: 79

### Item 13
- **path**: /home/user/catcorner22/dental/src/lib/auth/approval.ts
- **purpose**: checkFilingAuthority — who may FILE a note into the permanent record, as distinct from who may write in it. Dentist-filed modules (sedation-anesthesia, robotic-surgery) plus any note carrying Assessment/Plan.
- **loc estimate**: 85

### Item 14
- **path**: /home/user/catcorner22/dental/src/lib/auth/mfaFeature.ts
- **purpose**: Deployment-level MFA switch (MFA_ENABLED === '1', default OFF). Documents the live lockout that made default-off the choice.
- **loc estimate**: 19

### Item 15
- **path**: /home/user/catcorner22/dental/src/lib/auth/freshUser.ts
- **purpose**: Page-side twin of requireRole, wrapped in React cache() so layout and page share one PK read. Mirrors the guard's checks exactly so a page and its API cannot disagree.
- **loc estimate**: 41

### Item 16
- **path**: /home/user/catcorner22/dental/src/middleware.ts
- **purpose**: Node-runtime NextAuth middleware gating page navigation only. Segment-anchored public-path matcher. Documents that /api/* is deliberately passed through to requireRole.
- **loc estimate**: 50

### Item 17
- **path**: /home/user/catcorner22/dental/src/lib/auth/auth.config.ts
- **purpose**: Edge-safe session config: JWT strategy, 12h maxAge, 15min updateAge, jwt/session callbacks carrying id/username/role/noticeAcked/pwAt, and the authorized() callback that returns true for /api/*.
- **loc estimate**: 67

### Item 18
- **path**: /home/user/catcorner22/dental/next.config.mjs
- **purpose**: All security headers, applied to /:path* including API and static. Full CSP, HSTS with opt-in preload, Permissions-Policy, COOP/CORP, and the /reset/* no-store + no-referrer override.
- **loc estimate**: 192

### Item 19
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts
- **purpose**: logAction — the single audit write point with per-column caps and marked truncation, frozen actor names, and the all/auth/security read filters plus action-prefix queries for the drift monitor.
- **loc estimate**: 147

### Item 20
- **path**: /home/user/catcorner22/dental/src/lib/audit/maskPhi.ts
- **purpose**: PHI pseudonymization: random (not derived) tokens, consistent within a note, deliberately inconsistent across notes, single-pass index-based application with leftmost-then-longest overlap resolution. Never builds a regex from user text.
- **loc estimate**: 183

### Item 21
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/phi.ts
- **purpose**: The primary deterministic PHI detector: ~18 patterns (SSN, phone, 8 date shapes, email, MRN, honorific+name, bare SSN, long numbers, obfuscated digits, hidden characters) at S0/S2 severity.
- **loc estimate**: 573

### Item 22
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/phi-secondary.ts
- **purpose**: Provider-bound second-line PHI gate: email-address, MRN-label, street-address, city/state/ZIP, plus an injectable scanner that may only ADD findings. mergePhiScans never removes a primary finding.
- **loc estimate**: 98

### Item 23
- **path**: /home/user/catcorner22/dental/src/lib/audit/attestation.ts
- **purpose**: isValidPhiAttestation — server-enforced override attestation validator. Inverted from a denylist of invisible characters to a floor of characters that certainly render, after the denylist lost to Braille blank / Hangul fillers / tag characters.
- **loc estimate**: 81

### Item 24
- **path**: /home/user/catcorner22/dental/src/app/api/assist/route.ts
- **purpose**: The AI-assist route: requireRole('user'), server-side licence tier gate, PHI gate before the run meter, 20s provider timeout, and one parseable assist.drift audit row per call recording outcome/capability/prompt version/model/tokens and never content.
- **loc estimate**: 262

### Item 25
- **path**: /home/user/catcorner22/dental/src/app/api/export/[table]/route.ts
- **purpose**: CSV export whose authorization mirrors the SCREEN not the table: canManageUsers for users, canReadAuditLog for the log, seesAllNotes row scoping for submissions, email masking by canSendResetLink, per-actor metering, and a row count derived from rendered rows not CSV lines.
- **loc estimate**: 197

### Item 26
- **path**: /home/user/catcorner22/dental/src/app/api/me/mfa/route.ts
- **purpose**: Self-service TOTP lifecycle. start refuses while MFA is on (closing a full second-factor bypass), confirm proves the device holds the secret, disable requires a current code. All code checks metered on passwordCheckKey.
- **loc estimate**: 122

### Item 27
- **path**: /home/user/catcorner22/dental/src/app/api/me/password/route.ts
- **purpose**: Self-service password change. Both the verify and the new-password hash go through hashGate; a correct change revokes every session including the caller's.
- **loc estimate**: 83

### Item 28
- **path**: /home/user/catcorner22/dental/src/app/api/admin/users/[id]/mfa-reset/route.ts
- **purpose**: Admin MFA reset (lost device). requireRole('admin') + canSetPasswordDirectly + explicit refusal of a self-target, so the recovery path is a second person by construction and is named in the audit log.
- **loc estimate**: 57

### Item 29
- **path**: /home/user/catcorner22/dental/src/app/api/law-watch/alert/route.ts
- **purpose**: The only bearer-token endpoint. timingSafeEqualStr compares SHA-256 digests of both sides so a length mismatch cannot throw and leak the secret's length; fails closed when CRON_SECRET is unset.
- **loc estimate**: 82

### Item 30
- **path**: /home/user/catcorner22/dental/src/lib/db/postgresUrl.ts
- **purpose**: pinPostgresSslMode — rewrites require/prefer/verify-ca to verify-full and APPENDS verify-full to any non-loopback URL with no sslmode, closing the plaintext-PHI-over-the-wire hole for every provider whose dashboard omits sslmode.
- **loc estimate**: 58

### Item 31
- **path**: /home/user/catcorner22/dental/src/lib/db/backend.ts
- **purpose**: Refuses to boot in production without POSTGRES_URL; two-hands ALLOW_EPHEMERAL_DB=1 escape for test harnesses so a pasted PGLITE_DIR=memory:// cannot silently produce a database wiped on every cold start.
- **loc estimate**: 79

### Item 32
- **path**: /home/user/catcorner22/dental/src/lib/http/readJson.ts
- **purpose**: Safe body reader: 1MB cap checked on both declared Content-Length and actual bytes, non-object/array/null rejected so 'key in body' can never throw a 500.
- **loc estimate**: 44

### Item 33
- **path**: /home/user/catcorner22/dental/src/lib/auth/loginFormState.ts
- **purpose**: sanitizeCallbackPath — reduces an attacker-influenceable callbackUrl to pathname+search, making the result same-origin by construction rather than by an origin match. Also the no-oracle login failure copy.
- **loc estimate**: 100

### Item 34
- **path**: /home/user/catcorner22/dental/src/lib/auth/loginAction.ts
- **purpose**: The repo's only server action. Makes the login form work pre-hydration as a native POST (MPA mode) so a fast typist on bad wifi is actually signed in; every authorize() refusal returns identical copy.
- **loc estimate**: 68

### Item 35
- **path**: /home/user/catcorner22/dental/src/lib/client/draftBackup.ts
- **purpose**: THE PHI LIABILITY: mirrors full NoteState + title + officeId to localStorage and an 8-deep IndexedDB ring, cleared only on server-save ack. Not bound to a principal, not wiped on logout, author switch, or session revoke.
- **loc estimate**: 222

### Item 36
- **path**: /home/user/catcorner22/dental/src/components/builder/SharedTabletIdleLock.tsx
- **purpose**: Client-only 10-minute idle lock offering Switch author / Still me. Purely cosmetic from a security standpoint: it does not invalidate the cookie and is dismissible.
- **loc estimate**: 82

### Item 37
- **path**: /home/user/catcorner22/dental/e2e/headers.mjs
- **purpose**: Wire-level security-header regression probe against a production build: pins no unsafe-eval in prod CSP, frame-ancestors none, no x-powered-by, no HSTS preload without opt-in, and that the /reset override WINS over the globals.
- **loc estimate**: 57

### Item 38
- **path**: /home/user/catcorner22/dental/e2e/lockout.mjs
- **purpose**: Throttle behavioural probe posting directly to /api/auth/callback/credentials with explicit x-real-ip: pair lock, lock lapse, correct-password recovery, the auth.lockout row, and the IP spray detector never gating.
- **loc estimate**: 140

### Item 39
- **path**: /home/user/catcorner22/dental/e2e/mfa.totp.mjs
- **purpose**: Full TOTP lifecycle probe including the no-oracle property (byte-identical failure copy for enrolled and unknown accounts) and the no-JS MPA login path.
- **loc estimate**: 340

### Item 40
- **path**: /home/user/catcorner22/dental/.env.example
- **purpose**: 107 lines of annotated configuration. Documents AUTH_SECRET, MFA_ENABLED default-off rationale, the ADMIN_PASSWORD_RESET break-glass and its 'remove immediately' warning, POSTGRES_URL production requirement, CRON_SECRET, and the AI/email third-party keys.
- **loc estimate**: 107

### Item 41
- **path**: /home/user/catcorner22/dental/knowledge/sources/adversarial-it-hipaa-security.md
- **purpose**: Red-team IT/HIPAA security officer panel: 7 vulnerabilities (2 KILL) and 5 non-negotiable controls, each mapped to a code touchpoint. A ready-made requirements list for the merged PMS.
- **loc estimate**: 111

### Item 42
- **path**: /home/user/catcorner22/dental/knowledge/sources/adversarial-privacy-hipaa-attorney-hate.md
- **purpose**: Red-team plaintiff privacy attorney panel: six deposition angles with repo evidence, four product demands, and the 'privacy theater' framing — gates look adult, egress paths are adolescent.
- **loc estimate**: 91

## Reusable assets


### Item 1
- **name**: requireRole guard pattern (fresh-row authorization)
- **path**: /home/user/catcorner22/dental/src/lib/auth/guards.ts
**why reusable**

The single most important pattern to carry forward: never trust the token for role/active/scope, do one PK read per request instead. It makes deactivation, demotion, and session revocation take effect on the very next request rather than at token expiry — which is exactly the property a PHI system needs when a staff member is terminated mid-shift. The GuardResult discriminated union means a route physically cannot forget to return the refusal. Extend with tenant_id and patient-relationship scoping and it is the PMS's authorization spine.

- **quality**: production-grade
- **coupling**: Imports auth() from NextAuth, getDb/getUserById from drizzle repos, and the local roles/clinicalRoles/sessionWatermark modules. The SHAPE lifts cleanly to any stack; the body is ~30 lines to rewrite against a new user table.

### Item 2
- **name**: Capability predicate model (rank ladder + actor-x-target ceiling matrix)
- **path**: /home/user/catcorner22/dental/src/lib/auth/roles.ts
**why reusable**

Solves the exact problem a dental PMS has: an office manager must be able to reset a front-desk password but never see one, and must never be able to act on the owner's account. MANAGE_CEILING expresses 'the highest role this actor may act upon' so authority can never be escalated by acting on someone more powerful, and every call site uses a NAMED predicate rather than an inline role === 'admin' check. seesAllNotes is deliberately an allowlist so a newly added role defaults to seeing nothing. Directly reusable for segregation-of-duties enforcement, which is Precog's whole thesis.

- **quality**: production-grade
- **coupling**: Zero runtime dependencies — pure functions over a string union. Lift the file verbatim and replace the role names. 211-line companion test file already exercises the matrix exhaustively.

### Item 3
- **name**: Database-backed throttle with correct lock decay
- **path**: /home/user/catcorner22/dental/src/lib/auth/throttle.ts
**why reusable**

Genuinely hard-won. The three-branch CASE (live lock freezes the count, served lock resets to 1, stale window resets to 1) plus the compare-and-set lock application is the difference between a throttle and a permanent ban that a running server proved could hold correct passwords out forever. justLocked being exactly-once under concurrency is what makes it safe to hang audit rows, emails, and metrics off a lock transition without handing an attacker an amplifier. The key-namespacing convention (login/pwcheck/resend/resetlink/invite/export/assist) generalizes to every expensive or mail-sending operation in a PMS.

- **quality**: production-grade
- **coupling**: drizzle-orm + one table (key, fail_count, first_fail_at, locked_until). Portable to Kysely with a mechanical rewrite of the upsert; the SQL CASE logic is the valuable part and is dialect-portable.

### Item 4
- **name**: hashGate — process-wide bcrypt concurrency cap
- **path**: /home/user/catcorner22/dental/src/lib/auth/hashGate.ts
- **why reusable**: 72 lines, zero dependencies, no state outside a module-level counter. It is the only login defence keyed on something an attacker cannot forge, and the SlotResult discriminated union structurally prevents 'we were too busy' being caught as 'the password was wrong'. Any Node auth stack using a pure-JS hash needs this.
- **quality**: production-grade
- **coupling**: None. Copy the file.

### Item 5
- **name**: clientIp — proxy-aware, forgery-resistant IP derivation
- **path**: /home/user/catcorner22/dental/src/lib/auth/clientIp.ts
**why reusable**

Contains two non-obvious correctness properties most implementations get wrong: (1) reading x-forwarded-for from the RIGHT by a configured hop count, and (2) indexing the RAW list then validating, never filtering-then-indexing (which slides the index onto the attacker's own entry). Plus proper IPv4/IPv6 validation that catches the Azure/nginx ip:port append that silently defeats any throttle keyed on it.

- **quality**: production-grade
- **coupling**: None. Takes a standard Request. Copy the file.

### Item 6
- **name**: sessionWatermark — stateless JWT revocation
- **path**: /home/user/catcorner22/dental/src/lib/auth/sessionWatermark.ts
**why reusable**

35 lines that give a stateless JWT the one property it normally lacks: revocability. Two independent kill switches (password change, sign-out-everywhere) collapse into one max() comparison, and the same pure function is used at mint time and both check sites so a token can never be born already dead. If the merged PMS keeps JWTs, this is the whole answer; if it moves to server-side sessions, this is the belt-and-braces layer.

- **quality**: production-grade
- **coupling**: None. Copy the file.

### Item 7
- **name**: Security header block + wire-level header probe
- **path**: /home/user/catcorner22/dental/next.config.mjs
**why reusable**

A complete, commented, opinionated header set applied to /:path* including API routes and static assets — with each directive justified by a real failure (why not upgrade-insecure-requests, why same-origin instead of no-referrer globally, why the /reset override must come after the spread). e2e/headers.mjs asserts every one of them off the wire of a production build, so it is a regression suite as well as a config.

- **quality**: production-grade
- **coupling**: Next.js-specific config format, but the header VALUES are framework-agnostic. The CSP needs revisiting for a PMS (see weaknesses).

### Item 8
- **name**: maskPhi — safe pseudonymization
- **path**: /home/user/catcorner22/dental/src/lib/audit/maskPhi.ts
**why reusable**

The four documented properties (random not derived; consistent within a note; deliberately inconsistent ACROSS notes so masked notes cannot be linked into a durable patient key; obviously a mask) are exactly right for HIPAA de-identification, and rare to see stated. The single-pass index-based application with leftmost-then-longest overlap resolution fixes two real bugs that left identifiers in the note while the re-audit reported PASS. Never builds a regex from user text.

- **quality**: production-grade
- **coupling**: Imports only AuditFinding from ../types. Essentially standalone; useful in a PHI-holding PMS for de-identified exports, research extracts, and AI calls.

### Item 9
- **name**: PHI detection rules + provider gate + attestation validator
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/phi.ts
**why reusable**

~750 lines across phi.ts / phi-secondary.ts / attestation.ts with six dedicated test files (phi-evasion, phi-names, phi-regressions, phi-secondary, phi-spans, plus maskPhi.test). The additive-only merge contract (a model scanner may ADD blocks, never clear a rule hit) is the right architecture for adding an ONNX de-ID model later. The attestation validator's inversion from an invisible-character denylist to a renders-certainly allowlist is a subtle fix most products would never find.

- **quality**: production-grade
- **coupling**: Depends on the local AuditFinding type only. The rules are US/dental-flavoured but the framework is generic.

### Item 10
- **name**: Reset-link issuance and redemption
- **path**: /home/user/catcorner22/dental/src/lib/auth/resetToken.ts
**why reusable**

Textbook bearer-credential handling: CSPRNG bytes not a UUID, hash-at-rest, short TTL, single-use enforced in a transaction guarded on the token still being unused, prior tokens retired on issue, uniform vague error for expired/used/nonexistent, link base from config never the Host header, and refuse-before-write when the link would be unusable. The product property it enables — 'nobody at the practice can see or set your password' — is a real anti-impersonation control worth keeping.

- **quality**: production-grade
- **coupling**: resetToken.ts is pure node:crypto. issueResetLink.ts couples to Resend and the drizzle resetTokens repo; swap the mailer.

### Item 11
- **name**: logAction — bounded, frozen-actor audit writer
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts
**why reusable**

Two properties worth keeping: bounds enforced at the single write rather than re-derived at ~30 call sites (because several log caller-supplied input into a table that is rendered on a page and exported to CSV), and truncation that is MARKED so a cut value never reads as a complete fact in a record whose purpose is being trusted. The frozen 'Display (username)' snapshot with no FK means the log outlives deleted accounts.

- **quality**: production-grade
- **coupling**: drizzle + one table. Needs hash chaining, IP/UA columns, and append-only enforcement added before it is HIPAA-adequate (see weaknesses).

### Item 12
- **name**: pinPostgresSslMode
- **path**: /home/user/catcorner22/dental/src/lib/db/postgresUrl.ts
- **why reusable**: Fixes a real and widespread plaintext-over-the-wire hole: the rule is inverted from 'pin TLS for neon.tech' to 'pin verify-full for everything except loopback', because the host in the URL is not what decides whether bytes leave the machine. For a PHI system this is a §164.312(e)(1) transmission-security control in 58 lines.
- **quality**: production-grade
- **coupling**: Pure string manipulation over a connection URL. Copy the file.

### Item 13
- **name**: TOTP wrapper
- **path**: /home/user/catcorner22/dental/src/lib/auth/totp.ts
- **why reusable**: Thin, correct otpauth wrapper with a justified +/-1 window and strict 6-digit input validation before the library is touched. The lifecycle enforcement around it in /api/me/mfa (start refuses while enabled; disable requires a current code; admin reset refuses self-target) is the genuinely valuable part and is the pattern to lift.
- **quality**: solid
- **coupling**: otpauth dependency plus APP_NAME from lib/brand. Needs recovery codes and forced-enrollment policy added for a PHI product.

### Item 14
- **name**: readJsonRecord — bounded body reader
- **path**: /home/user/catcorner22/dental/src/lib/http/readJson.ts
- **why reusable**: 44 lines that close two real holes: unbounded body buffering before any validation runs, and JSON.parse returning null/number/string so that a later 'key in body' throws a 500 instead of returning a 400. Checks both declared Content-Length and actual bytes because chunked encoding omits the former.
- **quality**: production-grade
- **coupling**: None. Copy the file. Should gain a Content-Type check as CSRF defence-in-depth.

### Item 15
- **name**: sanitizeCallbackPath — open-redirect reduction
- **path**: /home/user/catcorner22/dental/src/lib/auth/loginFormState.ts
- **why reusable**: Takes only pathname+search from an attacker-influenceable callbackUrl, so the result is same-origin BY CONSTRUCTION rather than by an origin match that has to know its own origin. Strictly better than the usual allowlist approach.
- **quality**: production-grade
- **coupling**: None. ~20 lines within a 100-line file.

### Item 16
- **name**: timingSafeEqualStr — digest-of-digest constant-time compare
- **path**: /home/user/catcorner22/dental/src/app/api/law-watch/alert/route.ts
- **why reusable**: Five lines that solve the standard timingSafeEqual footgun (it throws on length mismatch, which itself leaks the secret's length) by hashing both sides to fixed width first. Needed anywhere a PMS compares a webhook secret, API key, or cron token.
- **quality**: production-grade
- **coupling**: node:crypto only. Lines 18-22 of the route file; should be extracted to a shared module in the merged product.

### Item 17
- **name**: Export authorization mirroring the screen
- **path**: /home/user/catcorner22/dental/src/app/api/export/[table]/route.ts
**why reusable**

The stated principle — 'authorization mirrors the screen, not the table' — plus row scoping by the same predicate that scopes the page, email masking by canSendResetLink, per-actor metering, and a row count derived from RENDERED rows rather than by splitting the CSV on newlines (which a user could inflate just by pressing Enter). For a PMS, 'who exported the patient list and how many rows' is the embezzlement question, so getting this shape right matters more here than in Smile Notes.

- **quality**: production-grade
- **coupling**: Couples to the repo layer and the csv helper; the PATTERN is what lifts.

### Item 18
- **name**: e2e security probes (headers / lockout / MFA / PHI mask-override)
- **path**: /home/user/catcorner22/dental/e2e/
- **why reusable**: Plain .mjs + Playwright, no framework. They pin properties no unit test can reach: that the reset Referrer-Policy override actually wins on the wire, that a lapsed lock genuinely admits one attempt, that the IP spray detector never gates, and that login failure copy is byte-identical whether or not the account is enrolled in MFA (the no-oracle property). Directly portable to the merged PMS.
- **quality**: solid
- **coupling**: Playwright + a running server + a seeded smoke admin. Not wired into package.json scripts or the blocking CI job — that is a gap, not a coupling problem.

### Item 19
- **name**: Pre-hydration server-action login
- **path**: /home/user/catcorner22/dental/src/lib/auth/loginAction.ts
**why reusable**

Closes a real window where a submit before React hydrates reloaded the page and silently discarded typed credentials. The form SSRs with a real method=POST so a pre-hydration submit actually signs the user in (MPA mode, session cookie and redirect on the same response), and the identical form submits via fetch after hydration. On operatory phones and bad wifi this is a genuine reliability win, and every refusal path returns identical copy.

- **quality**: production-grade
- **coupling**: Next.js server actions + NextAuth signIn. Concept transfers; code does not.

### Item 20
- **name**: Clinical scope-of-practice axis + filing authority
- **path**: /home/user/catcorner22/dental/src/lib/auth/clinicalRoles.ts
**why reusable**

A second authorization axis orthogonal to seniority, because in Tennessee what you may write in a clinical record is decided by licence, not by rank — an office administrator may run every account and hold no licence, while a dentist may hold the lowest system role. resolveClinicalRole DERIVES rather than stores so demoting a developer takes the tier with it. approval.ts separates 'who may write a diagnosis' from 'who may make the note final', with the transfer rail as the mechanism rather than a parallel approval state machine that could desynchronize. Both are directly needed in a PMS that charts, prescribes, and bills.

- **quality**: solid
- **coupling**: Pure functions plus a dentistOwnedKeys import from the schema layer. Tennessee-specific content; the two-axis architecture is the reusable part and would need per-state configuration.

## Weaknesses

- NO TENANCY WHATSOEVER. src/lib/db/schema.ts declares 17 tables and not one carries a tenant_id, organization_id, or practice_id. The product is single-practice-per-deployment. A commercial multi-tenant PMS needs tenant scoping on every table, tenant-scoped guards, and ideally Postgres row-level security, and retrofitting that after the fact is the single largest piece of work implied by the merge.
- NO PATIENT ENTITY, THEREFORE NO PATIENT-LEVEL ACCESS CONTROL. Authorization granularity is exactly two levels: 'notes you own' (canWriteNote / draft.ownerId) and 'all notes in the practice' (seesAllNotes allowlist). There is no minimum-necessary scoping, no treatment-relationship check, no per-patient restriction (VIP/employee/family records), and no break-the-glass with justification capture. HIPAA minimum-necessary cannot be satisfied by an owner-or-everything model.
- NO ePHI READ LOGGING. The audit log records writes, sign-ins, user management, exports, and AI calls. It does NOT record reads: GET /api/drafts/[id], GET /api/drafts, GET /api/submissions and the pages behind them log nothing. For a system holding PHI, §164.312(b) audit controls and §164.308(a)(1)(ii)(D) information-system-activity review effectively require an access log of who viewed which record when — that is also the only way to detect the snooping half of insider abuse.
- AUDIT LOG IS NOT TAMPER-EVIDENT. audit_log is a plain serial+timestamp table (schema.ts:256) with no hash chain, no signature, no append-only grant or RLS, no external WORM sink, and no retention enforcement for the 6-year requirement. Anyone with database credentials — including a future admin-tier account or a compromised connection string — can rewrite or delete history. Given the market research finding that only 17% of dental thefts are caught by designed controls, a rewritable log is the wrong foundation for the fraud-detection story.
- AUDIT LOG HAS NO IP OR USER-AGENT COLUMNS. Authentication source IP is written into the free-text `detail` field as the string `from <ip>` (auth.ts:52). It is therefore not queryable, not indexable, not reportable, and not present at all on non-auth events. An access log you cannot filter by source is not an investigation tool.
- MFA IS DEFAULT-OFF AND OPTIONAL FOREVER. mfaFeature.ts gates the entire feature on MFA_ENABLED === '1' (default off), and even when enabled it is per-account self-service opt-in. There is no policy enforcement ('role X must have MFA'), no admin-forced enrollment, no enrollment deadline, no recovery/backup codes (the only recovery paths are another Developer's reset or the env break-glass), and no WebAuthn/passkey option. The repo's own adversarial IT panel rates this a KILL for production PHI.
- TOTP SECRETS STORED IN PLAINTEXT. users.mfa_secret is a plain `text` column (schema.ts:70). No application-layer encryption, no KMS envelope encryption, no separate secrets table. There is no field-level encryption anywhere in the schema — the product relies entirely on the hosting provider's disk encryption, which does not protect against a leaked connection string, a SQL-injection read, or a backup copied to the wrong bucket.
- BREAK-GLASS IS AN ENVIRONMENT VARIABLE THAT RE-FIRES ON EVERY COLD START. ADMIN_PASSWORD_RESET=1 (with ADMIN_USERNAME/ADMIN_PASSWORD) resets the admin password AND clears MFA on every boot while it is set, per .env.example lines 17-23 and db/client.ts:235-243. There is no dual control, no expiry, no one-shot consumption, and no audit of who set the variable. The .env.example says 'remove this flag immediately' — which is a policy, not a control. This is a standing credential-reset backdoor in the deployment configuration.
- NO SERVER-ENFORCED IDLE TIMEOUT. Session maxAge is 12 hours absolute with updateAge 15 minutes (auth.config.ts:32). SharedTabletIdleLock.tsx is a 10-minute CLIENT-ONLY overlay that is dismissible with 'Still me' and does not invalidate the cookie — disable JavaScript, close the dialog, or read the cookie out of the browser and the session is untouched. On shared operatory glass, which the code comments explicitly identify as the realistic way a dental practice loses control of an identity, the actual control is a 12-hour window.
- API LAYER IS DEFAULT-ALLOW. authorized() in auth.config.ts returns true for every /api/* path, so the ONLY thing standing between an anonymous caller and a route is that route remembering to call requireRole. This has already failed once in production code: the comment at src/app/api/bytestar/route.ts:34-42 documents that GET shipped with no guard, leaking AI configuration and prompt version to anonymous callers and running getDb() plus two audit queries per anonymous hit against a pool that defaults to one connection per isolate. Nothing structural prevents a recurrence — no lint rule, no route-manifest test, no wrapper that a handler must be passed through.
- NO CSRF OR ORIGIN VERIFICATION ON STATE-CHANGING JSON ROUTES. There is no explicit CSRF token, no Origin/Sec-Fetch-Site check, and readJsonRecord does not inspect Content-Type — so there is no 'this request required a preflight' backstop. Protection rests entirely on NextAuth's default SameSite=Lax session cookie, which is not stated anywhere in the code as the control it is. For a PHI system this needs to be an explicit, tested, documented check.
- FORWARDING HEADERS ARE TRUSTED BY DEFAULT. clientIp.ts:24 defaults TRUST_PROXY_HEADERS to 'auto'. On a deployment where Node is exposed directly (no nginx, no Vercel), any caller sets x-real-ip to anything and rotates it for an unlimited throttle budget. The file states this honestly and points at hashGate as the compensating control, but hashGate bounds CPU, not guess count — an attacker with header control gets unlimited guesses at a 10-character-minimum password with a 19-entry blocklist.
- CSP GRANTS script-src 'unsafe-inline'. Documented in next.config.mjs:13-18 as unavoidable for Next App Router's inline hydration bootstrap, and justified on the grounds that 'the app renders no user-supplied HTML anywhere'. That justification does not survive the merge: a PMS with a patient portal, intake forms, insurance-remittance text, or clinician-entered rich text has a live XSS surface, and the mitigation (per-request nonce threaded through Next's own script tags) is not available on a static header.
- PASSWORD POLICY IS THIN FOR PHI. 10-character minimum, a 19-entry hardcoded common-password blocklist, single-repeated-character rejection. No breach-corpus check (HIBP k-anonymity range API), no password history, no rotation, and deliberately no per-account lockout (a considered DoS trade-off, documented in throttle.ts:227-232 — but it does mean an attacker who defeats the IP throttle faces only bcrypt cost and a 19-word blocklist).
- UNENCRYPTED CLINICAL TEXT PERSISTS ON THE ENDPOINT. draftBackup.ts writes full NoteState + title + officeId to localStorage key `smile-notes.draft-backup.${id}` AND an 8-deep IndexedDB ring, cleared only when the server confirms a save. It is keyed by draftId, not bound to the signed-in principal, and is never wiped on logout, author switch, or session revoke. Both adversarial panels rate this KILL/PAIN. In a PHI-holding PMS this is unencrypted ePHI at rest on an unmanaged, shared device recoverable by the next user or by anyone with Web Inspector.
- CLIPBOARD IS AN UNLOGGED DISCLOSURE CHANNEL. The primary handoff is navigator.clipboard.writeText of the composed note (BuilderShell), with a checkbox 'the correct chart is open and I matched two identifiers' as the only control — and the product itself admits it cannot see which chart is open. The copy is not recorded as a disclosure event in the audit log, and on clipboard-permission failure the app falls back to downloading a plaintext .md file.
- TWO DIFFERENT PHI THRESHOLDS IN ONE PRODUCT. The AI gate blocks on ANY phi-category finding (assist/route.ts:104-116). The export/Copy/email gate lets S2 bare names through, including into the emailed attachment filename derived from the note title. The product therefore treats a bare patient name as an identifier when talking to a model and as a review-only note when writing it to the clipboard, to disk, and to an email subject line — the exact asymmetry the plaintiff-attorney panel builds deposition angle 5 on.
- THIRD PARTIES WITH NO BAA PLUMBING. Resend (email export and reset links), the Vercel AI Gateway / Anthropic (assist and ByteStar), and the hosting/database provider all receive or hold data. There is no BAA registry, no data-processing inventory, no per-tenant ability to disable a subprocessor beyond global feature flags, and no configurable data-residency. Today the PHI gate makes the AI hop defensible; once the product holds PHI by design, that premise inverts and the gate has to become 'this specific field is safe to send', not 'the whole app is de-identified'.
- requireRole ITSELF IS UNTESTED. src/lib/auth/guards.test.ts is 18 lines and only re-tests meetsRole from roles.ts. The revocation check, the active check, the notice-ack gate, and the fresh-row clinical-role resolution — the four behaviours that make the guard the authorization authority — have no unit test. They are exercised only by e2e/account.lifecycle.mjs, which is not in the blocking CI job.
- SECURITY E2E IS NOT IN CI. The 17 .mjs probes in e2e/ (headers, lockout, mfa.totp, phi.mask-override, account.lifecycle, submission.immutability) require a running server and are not referenced by any package.json script. .github/workflows/ci.yml's blocking job runs tsc --noEmit, vitest, and next build only; the cross-browser job is continue-on-error: true. So the header set, the throttle semantics, and the MFA no-oracle property are verified by hand, not by the merge gate.
- NO KEY ROTATION STORY. AUTH_SECRET appears nowhere in the source (NextAuth reads it internally) and there is no dual-key/rollover window, so rotating it signs out every user simultaneously. There is no documented rotation cadence for AUTH_SECRET, CRON_SECRET, RESEND_API_KEY, or AI_GATEWAY_API_KEY, and no secret-scanning step in CI.
- NO ALERTING OFF SECURITY EVENTS. auth.lockout and auth.spray write audit rows a Hierarchy Manager must navigate to a page to see. There is no email/SMS/webhook alert, no anomaly detection, no impossible-travel or new-device check, no failed-login digest, and no IP allowlisting or device-posture requirement. The detection story ends at 'a row exists'.
- ONE DATABASE READ PER GUARDED REQUEST WITH NO CACHE. requireRole does an unconditional getUserById on every API call, and PG_POOL_MAX defaults to 1 connection per serverless isolate. Correct and cheap at one practice's scale; at PMS request volumes (a scheduler polling, a chart with many panels, a claims worklist) this needs a short-TTL session cache with explicit invalidation on the revocation events, or a server-side session store.

## Phi security observations

- The product's entire compliance premise today is that it holds NO PHI: notes are de-identified by construction, identity and dates are stamped by the practice's separate charting system (Curve Hero), and the PHI rules exist to keep identifiers OUT. Every control in the repo is built on that premise. The merged PMS inverts it — patients, schedules, ledgers, claims, and charts are PHI by definition — which means the PHI gate stops being a boundary and becomes at most a field-level classifier, and the 'we don't hold PHI' answer to every hard question is gone.
- Encryption in transit to the database is genuinely well handled: pinPostgresSslMode (src/lib/db/postgresUrl.ts) forces sslmode=verify-full onto any non-loopback connection string, explicitly because a Supabase/RDS/Railway/self-hosted URL without ?sslmode= would otherwise connect in plaintext with clinical notes crossing the wire. HSTS max-age=63072000; includeSubDomains is sent unconditionally (harmless over plain HTTP) with preload behind an explicit HSTS_PRELOAD=1 opt-in because preload is the one irreversible commitment.
- Encryption at rest is entirely absent at the application layer. No column is encrypted, no KMS or envelope encryption exists, and users.mfa_secret in particular is a plaintext text column. The product relies wholly on the hosting provider's volume encryption, which is a real §164.312(a)(2)(iv) addressable-implementation answer but leaves no defence against a leaked POSTGRES_URL, a mis-scoped backup, or a read-only SQL compromise.
- Content is deliberately kept out of logs everywhere, and this is stated as a rule rather than a habit: the assist route logs codes, versions, model identity, and token counts but 'never the note, never the prompt, never the model's draft — logging content to improve quality is how a log becomes the least protected copy of the clinical record' (assist/route.ts:199-201). Login logs record username and IP but deliberately DO NOT log unknown usernames, because that would let anyone write arbitrary rows into the audit log and turn it into a list of guessed usernames (auth.ts:194-196). Both principles transfer directly.
- There is no tenancy boundary of any kind, so 'PHI isolation between practices' is not a property the current code has or could be configured to have. This is the first thing the merged product must decide: single-tenant-per-deployment (matching Smile Notes' self-hosted-next-to-the-practice assumption) or multi-tenant SaaS with tenant-scoped guards plus Postgres RLS as a defence-in-depth backstop against a missing WHERE clause.
- Access to ePHI is not logged. The audit log covers create/update/delete, exports, sign-ins, user administration, and AI calls — but opening a record is invisible. For a PMS this is the single biggest audit-controls gap, and it is also the control that the market research's embezzlement finding actually needs: seeing who looked at which ledger, which patient, and which claim is how you catch the 83% of thefts that designed controls currently miss.
- The audit log is rewritable. Plain serial table, no hash chain, no append-only role, no external sink. For a compliance product whose sibling (Precog) is built around internal controls and residual risk, an audit trail that the person being audited could alter with database access undermines the whole proposition. A per-row HMAC chained to the previous row's digest is cheap and would make tampering detectable; an append-only Postgres role with REVOKE UPDATE/DELETE makes it hard.
- Session posture is fit for a 12-hour shift, not for shared operatory glass. 12h absolute maxAge with no server-enforced idle timeout; the 10-minute idle lock is a dismissible client overlay that leaves the cookie valid. The revocation watermark is excellent and works (password change and sign-out-everywhere both kill prior tokens on the next request), but it is user-initiated — nothing evicts an abandoned session automatically. A PHI-holding PMS needs a server-enforced idle timeout, an active-sessions list the user can see and kill individually, and probably a shorter absolute lifetime on operatory device profiles.
- MFA is off by default and, when on, is opt-in per account with no recovery codes. The default-off decision is honestly reasoned (mfaFeature.ts documents a live lockout in the week the site launched: one Developer, one lost phone, nobody left to reset), but the answer for a commercial product is recovery codes plus a mandatory second admin, not disarming the factor. The admin MFA-reset route's refusal of a self-target is exactly right and should be kept — it makes the recovery path a second person by construction and names them in the log.
- Secrets hygiene in the repository is clean: .gitignore excludes .env, .env.local, .env.*.local and even the stability-battery stash file; git ls-files shows only .env.example tracked; a scan for sk-/AKIA/re_ prefixed keys across src, scripts, and docs found nothing. AUTH_SECRET has no fallback default in code. What is missing is rotation policy, a dual-key rollover window, and a secret-scanning step in CI.
- Third-party data flows are narrow and deliberate today: Resend for email (reset links, invites, note export to ONE fixed CORPORATE_EMAIL that 'notes can never be emailed anywhere else'), and the AI Gateway for assist/ByteStar, both server-side only with connect-src 'self' preventing any browser-to-provider call. GO-LIVE.md instructs the operator to 'confirm the corporate inbox is inside the practice's HIPAA boundary'. None of this is BAA-tracked in software, and the merged product will need a real subprocessor inventory with per-tenant controls.
- The single-fixed-recipient email design (CORPORATE_EMAIL) is a genuinely strong egress control worth preserving in some form: there is exactly one destination for exported clinical content and it is set at deployment, so no user can redirect a note anywhere. A PMS with patient communications, referrals, and claims obviously needs more destinations, but the principle — enumerate allowed egress destinations in configuration, not in a user-supplied field — should survive.
- The endpoint is the weakest link and both adversarial panels say so independently. Unencrypted clinical drafts in localStorage and an 8-deep IndexedDB ring on shared tablets, not bound to a principal and not wiped on logout; the system clipboard as the primary handoff with a checkbox standing in for chart identity; a plaintext .md download as the clipboard-failure fallback. In a PHI-holding PMS, the local mirror must be either eliminated, encrypted with a key derived from the authenticated session and discarded on sign-out, or offered as an explicit 'this is a shared device' mode that disables local backup entirely.
- Enforcement is genuinely server-side, not client-decorated, and this is the most important positive finding. Every capability gate the UI shows is re-derived on the server from a freshly-read database row: role, active state, revocation, notice acknowledgment, clinical scope, filing authority, AI capability tier, PHI attestation validity, and export row scoping. The PHI override attestation in particular was moved server-side after the browser-only minimum meant 'a tampered client could waive every privacy stop with {confirmed:true} and no reason' — the comment at submit/route.ts:166-170 is a model of the right instinct.
- Password handling is correct throughout: bcrypt cost 12, a constant never-matching TIMING_DUMMY_HASH so unknown usernames burn identical CPU, the hash gate placed to cover BOTH the real verify and the dummy so a saturated server cannot undo the equalization, and a login failure message that is byte-identical for wrong password, unknown user, wrong MFA code, and throttle refusal (asserted verbatim in e2e/mfa.totp.mjs). There is no username-enumeration oracle anywhere in the sign-in path, including MFA.

## Product insights

- THE TWO-AXIS ROLE MODEL IS THE SINGLE BIGGEST THING TO CARRY FORWARD. Administrative rank (who may manage accounts, read the audit log, export) and clinical licence (who may write a diagnosis, who may file a sedation record) are separate axes, because 'a Hierarchy Manager running the practice's accounts may be an office administrator with no licence at all, while a dentist may hold the lowest system role in the app' (clinicalRoles.ts:9-11). A PMS that charts, prescribes, and bills needs a third axis too — financial authority (who may write off a balance, post an adjustment, void a claim) — and Precog's segregation-of-duties detection is precisely a query over that third axis.
- CAPABILITY PREDICATES KEYED ON ACTOR x TARGET, NOT ON RANK, PREVENT AUTHORITY CREEP. MANAGE_CEILING (lead->user, manager->lead, admin->admin) means a manager can never act on someone more powerful, and canSetPasswordDirectly is admin-only while canSendResetLink is lead+ — so a practice manager can restore a clinician's access without ever learning a credential. In a PMS this is directly the anti-embezzlement control: the person who can reset the front desk's password must not be the person who can adjust their own till.
- 'NOBODY AT THE PRACTICE CAN SEE OR SET YOUR PASSWORD' IS A PRODUCT PROMISE, NOT JUST AN IMPLEMENTATION DETAIL. It appears verbatim in the reset email (issueResetLink.ts) and is enforced by canSetPasswordDirectly being admin-only. Combined with the frozen actor name in the audit log and the MFA-reset route's refusal of a self-target, it means every credential-adjacent action requires a second person by construction and is named in a record the affected person can read. That is exactly the 'designed control that catches the theft' the 17% statistic says is missing.
- DELIBERATELY NO PER-ACCOUNT LOCKOUT, BECAUSE A WHOLE DENTAL OFFICE SITS BEHIND ONE NAT ADDRESS. This is a real operational insight the code arrived at by measuring a running server: a username-keyed lock hands strangers a denial-of-service against any clinician they can name, and an IP-keyed lock takes the entire practice offline when one temp fumbles a password. The pair key (ip|username) scopes the blast radius to 'you must already be inside the practice network AND targeting that colleague by name'. Any PMS with a front desk and a shared network needs this exact reasoning.
- THE IP KEY IS KEPT AS A DETECTOR THAT NEVER GATES. Spraying many usernames from one source writes a single auth.spray audit row per window and never refuses a request. Separating 'signal a manager should see' from 'thing that blocks work' is a pattern the whole merged product should adopt — most compliance signals should be visible without being obstructive.
- SESSION LENGTH TUNED TO A SHIFT, NOT A CALENDAR. 12 hours with 15-minute refresh, chosen because 'this app runs on shared operatory workstations reached by whoever is standing at them' and next-auth's 30-day default is 'a standing key to the clinical record for anyone who picks up that tablet' (auth.config.ts:19-31). Sign-out-on-all-devices deliberately takes no user id so it can only ever act on the caller. Both decisions are dental-workflow-shaped and should survive.
- THE LEGAL-NOTICE ACKNOWLEDGMENT IS SERVER-ENFORCED, NOT A DISMISSIBLE MODAL. Until noticeAckAt is set, every API refuses with 403 except the acknowledgment itself and sign-out-everywhere. The comment says it plainly: 'Without this, the notice is only a dismissible modal — curl could file and email notes with no attestation on record.' The merged PMS has more of these (HIPAA training attestation, consent capture, e-prescribing attestations) and this is the right shape for all of them.
- AUDIT LOG FILTERS EXIST BECAUSE SUCCESSFUL SIGN-INS BURY THE SIGNAL. The 'security' filter is defined as everything EXCEPT routine auth.signin — 'a successful login is the noise; a failed one is the signal'. The export honours the same filter as the screen after a bug where exporting from a filtered view silently shipped the superset. Both are small, real reporting lessons for a PMS whose audit volume will be orders of magnitude larger.
- REFUSALS ARE THE MORE INFORMATIVE HALF OF AI TELEMETRY. The assist route logs ONE parseable row per call covering every outcome including successes, because 'a refusal rate needs a denominator, and a prose row cannot supply one', and it records model identity because 'anthropic/claude-sonnet-4.5 is a pointer, not a version, and a rate that moves while nothing in the practice changed is unattributable without it'. Directly applicable to Precog's LLM coach, which today has no drift instrumentation.
- 'AUTHORIZATION MIRRORS THE SCREEN, NOT THE TABLE.' Every export is gated by the same predicate that gates the page showing the same data, and scoped the same way, 'otherwise the export becomes a side door around a carefully scoped view'. In a PMS where the patient list, the A/R aging report, and the claims worklist are all exportable, this principle is the difference between a scoped product and a data-exfiltration tool with a nice UI.
- MASKING AS THE ONE-CLICK PATH, OVERRIDE AS THE FRICTIONFUL ONE. maskPhi exists because 'under time pressure between patients the waiver is the path of least resistance. That is a bad default for the one gate the whole PII-free premise rests on.' The lesson generalizes: whenever a compliance stop has an override, the compliant path must be the fastest one, or the override becomes the workflow. The plaintiff-attorney panel's demand #3 ('Kill override-as-default: mask-first hard path') is the same point from the other side.
- THE TWO ADVERSARIAL PANELS ARE A READY-MADE REQUIREMENTS DOCUMENT. adversarial-it-hipaa-security.md gives 7 vulnerabilities with severity and 5 non-negotiable controls (C1 hard author switch on shared devices, C2 MFA on for all clinical accounts, C3 clipboard/export accounting as disclosure events, C4 local mirror hygiene with wipe-on-logout, C5 session lifetime fit for chairside), each with a stated stop-condition if refused. adversarial-privacy-hipaa-attorney-hate.md adds four product demands and, crucially, a falsifier table (cleartext draft bytes on shared device: keep 0 / kill any; override rate vs mask rate: keep mask dominant). Adopt these as acceptance criteria for the merged PMS's security posture rather than re-deriving them.
- THE 'PRIVACY THEATER' WARNING IS THE MOST VALUABLE PARAGRAPH IN THE REPO. 'Deterministic PHI rules + Privacy stop dialog + reason codes + two-identifiers checkbox + AI PHI gate is the trap. It photographs as a covered-entity-grade control environment... the gates look adult; the egress paths are adolescent.' A merged PMS that markets HIPAA compliance while leaving unencrypted drafts on shared tablets and unlogged clipboard exports inherits exactly this exhibit. Fix custody of the text, or do not make the claim.
- OPAQUE FAILURE COPY AS A DELIBERATE PRODUCT DECISION. Every login refusal — wrong password, unknown user, missing code, wrong code, throttle pause — returns byte-identical copy, and e2e/mfa.totp.mjs asserts the exact strings because 'the no-oracle property lives in these strings being independent of enrollment'. This is a case where the security requirement and the UX requirement conflict and security wins explicitly, with a test to keep it that way.
- DEPLOYMENT SAFETY RAILS AS PRODUCT FEATURES. Production refuses to boot without POSTGRES_URL, and PGLITE_DIR=memory:// is rejected in production unless ALLOW_EPHEMERAL_DB=1 is ALSO set — because 'this repo's own .env.local carries that exact line, and an operator who copies their working local env into the Vercel dashboard gets a deployment that looks perfectly healthy while every isolate holds its own empty database that is wiped on the next cold start'. A commercial PMS sold to non-technical practice owners needs many more of these: refuse to start rather than silently lose records.

## Test and ci posture

["UNIT TESTS: 201 .test.ts/.tsx files under src/, run by vitest (node environment by default, jsdom opt-in per file via a // @vitest-environment jsdom pragma on line 1). 15 of those are in src/lib/auth/: approval, capabilities (211 lines exercising the actor-x-target matrix exhaustively), clientIp, clinicalRoles, emails, genPassword, guards, hashGate, loginFormState, mfaFeature, passwordPolicy, sessionWatermark, throttle, totp, username. The PHI rules carry six dedicated test files (phi-evasion, phi-names, phi-regressions, phi-secondary, phi-spans, maskPhi).","COVERAGE IS UNEVEN IN A REVEALING WAY. The pure functions are covered thoroughly — roles.ts, throttle's lockMsFor and key namespacing, clientIp parsing, sessionWatermark, hashGate, totp, the password policy, the attestation validator. The stateful, database-touching paths are covered thinly or not at all: src/lib/auth/guards.test.ts is 18 lines and only re-tests meetsRole, so requireRole's four load-bearing behaviours (active check, revocation check, notice-ack gate, fresh clinical-role resolution) have no unit test. throttle.test.ts (50 lines) tests only lockMsFor and the key functions — the three-branch CASE upsert and the compare-and-set justLocked semantics, which are the hard part and the part that was previously wrong, are not exercised against a real database.","NO COVERAGE THRESHOLD is configured in vitest.config.ts, and there is no coverage step in CI.","E2E: 17 hand-rolled .mjs probes in e2e/ driven by Playwright against a running production build. The security-relevant ones are headers.mjs (asserts the full header set off the wire on a page, an API route, and a static chunk, plus that the /reset no-referrer + no-store override WINS over the globals), lockout.mjs (posts directly to /api/auth/callback/credentials with explicit x-real-ip to exercise the pair lock, the lapse, correct-password recovery, the auth.lockout row, and that the IP spray detector never gates), mfa.totp.mjs (the full enrollment->login->disable lifecycle including the no-oracle property and the no-JS MPA path, asserting failure copy verbatim), phi.mask-override.mjs, account.lifecycle.mjs, submission.immutability.mjs, setup.firstboot.mjs, and prehydration.login.mjs.","THE E2E SUITE IS NOT WIRED INTO ANYTHING. package.json defines only dev/build/start/test/test:watch — there is no e2e script, and .github/workflows/ci.yml does not invoke any e2e/*.mjs file. Each probe documents its own invocation in a header comment (BASE_URL=http://127.0.0.1:3000 node e2e/headers.mjs) and requires a freshly-booted server with a seeded smoke admin, and some require specific env (mfa.totp.mjs needs MFA_ENABLED=1). These are therefore hand-run tools, not gates.","CI (.github/workflows/ci.yml) has one blocking job, test-and-build: checkout with fetch-depth 0, Node 22, npm ci, npx tsc --noEmit, npm test (vitest), then three PR-only version-stamp guards, then npm run build. The second job, cross-browser, drives the production build in Chromium/Firefox/WebKit and is explicitly continue-on-error: true with a 15-minute timeout — so it is informational only and never blocks a merge. This is where the Safari-specific fixes actually execute rather than being reasoned about.","THE VERSION-STAMP GUARDS ARE A GENUINELY GOOD CI IDEA WORTH COPYING. Three diff-based checks fail the PR when (a) anything under src/lib/vocab|modules or src/lib/audit/rules|maskPhi changes without bumping RULESET_VERSION, because a stamped audit report would otherwise be a lie about which rules ran; (b) src/lib/assist/prompts.ts changes without touching ASSIST_PROMPT_VERSION; (c) src/lib/db/ddl.ts changes without bumping SCHEMA_BOOT_VERSION, because ensureSchema skips all DDL when the stored version matches, so new DDL would reach a fresh local database and never reach production, surfacing as 'column does not exist' on a route nobody tested against a stamped database. All three encode a real production failure into an automated gate.","WHAT CI DOES NOT DO: no lint step (no ESLint config invoked), no dependency audit (npm audit / Dependabot / Snyk), no secret scanning, no SAST or CodeQL, no license check, no coverage gate, and — the sharpest gap for this scope — no test or lint rule enforcing that every file under src/app/api/**/route.ts calls requireRole. That invariant is currently maintained by discipline alone, and it has already failed once (GET /api/bytestar shipped unguarded). A ~15-line test that globs the route files and asserts each exported handler references a guard would have caught it and would cost nothing.","NET ASSESSMENT: the pure-logic security surface is well tested and the behavioural probes that exist are unusually thoughtful (asserting header override precedence on the wire, asserting failure copy byte-for-byte to pin a no-oracle property). But nothing in the blocking merge gate verifies any of it — the merge gate is types, unit tests, and a successful build. For a product that will hold PHI, the header probe, the lockout probe, and a route-guard-coverage test all belong in the blocking job."]

## Open questions

- TENANCY MODEL — single-tenant-per-deployment (matching Smile Notes' 'self-hosted next to the practice's own database, there is no edge network in front of it and never will be' assumption in middleware.ts) or multi-tenant SaaS? This decision gates everything else: whether every table needs a tenant_id, whether Postgres RLS is required as a defence-in-depth backstop against a missing WHERE clause, whether encryption keys are per-tenant, and whether the guard signature becomes requireRole(tenantId, min).
- SESSION ARCHITECTURE — keep the stateless JWT plus watermark, or move to a server-side session store? The watermark is elegant and works, but a PHI product wants server-enforced idle timeout, a user-visible list of active sessions with individual revocation, forced logout of a specific device, and an admin ability to terminate a terminated employee's session immediately rather than on their next request. A session table gives all of that; the watermark should be kept as the belt-and-braces layer either way.
- DOES AI ASSIST SURVIVE THE INVERSION? Today the PHI gate is a boundary — 'de-identified text is the condition for any AI assistance, with no exception and no override'. In a PMS that holds PHI by design, either the gate becomes a field-level classifier ('this specific note body may go, the patient header may not'), or the product needs a BAA-covered model endpoint and the gate becomes a minimum-necessary filter rather than a hard stop. This is a legal/commercial decision before it is a technical one.
- WHAT HAPPENS TO THE DE-IDENTIFIED NOTE BUILDER? Is Smile Notes' 'the practice charting system stamps identity and dates, we write the de-identified body' premise retired entirely when the PMS holds the chart, kept as an optional export mode (research extracts, referrals, consultant review), or preserved as a distinct product? maskPhi and the phi rules are excellent assets in all three worlds but their role changes completely.
- AUDIT IMMUTABILITY MECHANISM — per-row HMAC chained to the previous row's digest (cheap, detects tampering, verifiable in-app), an append-only Postgres role with REVOKE UPDATE/DELETE (prevents rather than detects, but the migration/retention path gets awkward), or an external WORM sink (S3 Object Lock / a managed log service)? And what is the retention policy — HIPAA's 6 years for documentation, but clinical records under Tennessee law and malpractice statutes of repose may be longer.
- READ-LOGGING SCOPE AND VOLUME — log every PHI read (every patient chart open, every ledger view, every claim inspection), or only 'sensitive' reads? Full read logging on a busy practice is a large write volume against the same database serving the app, and it makes the audit log itself a PHI-adjacent asset requiring its own access controls. Needs a decision on sink, sampling policy (probably none), and whether the log is queryable by practice staff or only by the compliance role.
- BREAK-GLASS DESIGN to replace ADMIN_PASSWORD_RESET. What replaces an environment variable that re-fires on every cold start? Options: a time-boxed one-shot recovery code delivered out of band, a dual-control unlock requiring two admins, a vendor-side support path with its own audit trail, or a mandatory-second-owner requirement enforced at setup. All of them need the emergency-access-procedure documentation §164.312(a)(2)(ii) expects.
- LOCAL DRAFT MIRRORS — eliminate, encrypt with a key derived from the authenticated session and discarded on sign-out, or offer an explicit 'shared device' mode that disables local backup entirely (the privacy panel's open question #1)? The reliability rationale in knowledge/sources/draft-autosave-reliability.md is real — tab crashes and operatory wifi are real — so this is a genuine trade, not an obvious win.
- EXPORT/COPY GATE ALIGNMENT — does the export gate become as strict as the AI gate for all phi.* findings including S2 bare names (the privacy panel's open question #2), accepting more friction on the most-used button in the app? And is clipboard/download recorded as a disclosure event in the audit log? In a PMS the equivalent question is broader: which of print, export, email, fax, and clipboard count as disclosures requiring an accounting.
- DUAL CONTROL ON PHI OVERRIDE — keep the single-writer attestation, or require a Lead/second signature for S0 overrides (the privacy panel's open question #3)? This is the same architectural question as segregation of duties in Precog, and answering it once for both halves of the merged product would be coherent.
- MFA POLICY — which roles must have it, is enrollment forced at first login or at a deadline, what is the recovery mechanism (backup codes, admin reset, both), and does the product support WebAuthn/passkeys? Related: does the deployment-level MFA_ENABLED switch survive at all, or does a commercial PMS simply require MFA with recovery codes as the answer to the lockout risk that made default-off seem necessary?
- BAA AND SUBPROCESSOR INVENTORY — which third parties (email provider, model provider, hosting, database, error tracking, analytics) receive PHI, which have BAAs, can a tenant opt out of any of them, and is data residency configurable? None of this is modelled in software today.
- CSP AND USER-GENERATED CONTENT — the 'unsafe-inline' script-src is currently justified by 'the app renders no user-supplied HTML anywhere'. Does the merged PMS render patient-portal content, intake-form responses, insurance remittance text, or clinician rich text? If so, is a nonce-based CSP achievable on the chosen framework (TanStack Start may make this easier than Next App Router), and what is the plan until it is?
- FRAMEWORK CONSOLIDATION — dental is Next 15 / NextAuth v5 / Drizzle, precog is TanStack Start / better-auth / Kysely. Which auth library survives? better-auth has first-class server-side sessions, organizations/multi-tenancy, and MFA primitives that would answer several weaknesses above out of the box; NextAuth is what the tested, hardened code in this repo is built on. The throttle, hashGate, clientIp, sessionWatermark, roles, and PHI modules are all portable either way — the coupling is thin and deliberate.
- IS THE ROUTE-GUARD INVARIANT ENFORCED MECHANICALLY IN THE MERGED PRODUCT? Given that default-allow at the middleware plus per-route requireRole has already produced one anonymous route, does the new architecture flip to default-deny (a wrapper every handler must be passed through, or a middleware that denies /api/* unless a route opts out), or keep the current shape plus a CI test that globs route files and asserts a guard reference?
