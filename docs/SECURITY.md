# Security — OWASP Top 10 (2021) mapping

| Risk | Control in this repo |
|---|---|
| A01 Broken Access Control | Bearer auth on every private route; ownership checked in SQL (`WHERE user_id=$1`); role middleware; plan checks server-side; share tokens are 256-bit random, hashed at rest, expiring, revocable; no client-side premium flags. |
| A02 Cryptographic Failures | Argon2id (64 MiB, t=3, p=2) with per-user salt; refresh tokens stored as SHA-256; TLS terminated at nginx; HSTS in production; secrets only via env; Secure/httpOnly/SameSite cookies. |
| A03 Injection | pgx parameterised queries only; no string-built SQL; JSON bodies decoded with `DisallowUnknownFields` + size limits; React escapes by default; no `dangerouslySetInnerHTML`; CSP blocks inline script. |
| A04 Insecure Design | Server is the source of truth for calculations, quotas and plans; login rate limit + lockout backoff; design size/quota validation; explicit threat notes in docs. |
| A05 Security Misconfiguration | CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy; debug off in prod; non-root containers; least-privilege DB role; no default credentials. |
| A06 Vulnerable Components | Pinned modules, `go vet` + `govulncheck` in CI, `npm audit`, Dependabot, minimal dependencies, self-hosted fonts/icons (no runtime CDN). |
| A07 Identification & Auth Failures | Generic auth errors, timing-equalised login, refresh rotation + reuse detection revokes the family, password policy, session revocation on password change, audit trail. |
| A08 Software & Data Integrity | Reproducible builds, CI gates, signed images (optional cosign), migrations reviewed and versioned, no untrusted deserialisation. |
| A09 Logging & Monitoring | JSON slog with request ID, audit table for security events, no secrets/PII in logs, `/healthz` + `/readyz`, alerting hooks documented. |
| A10 SSRF | Outbound calls restricted to an allow-list (exchange-rate host), 5s timeout, no user-supplied URLs, private IP ranges rejected. |

## Known gaps to close before public launch

- SMTP delivery for verification/reset (tokens already modelled).
- Redis-backed rate limiting for multi-instance deployments.
- WAF / CDN in front of nginx.
- Secrets manager (Vault / cloud KMS) instead of `.env` on the host.
- Penetration test + dependency policy.
