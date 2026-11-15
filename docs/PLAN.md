# Build plan

## Phase 1 — foundation (this delivery)

1. Monorepo, Docker, env, migrations.
2. Go API: config, pgx, migrations, structured logs, graceful shutdown, security headers, CORS, rate limits, request IDs.
3. Auth: register/login/refresh/logout/me, Argon2id, JWT access, rotating refresh tokens with reuse detection, audit log, RBAC.
4. Data: designs, versions, yarns, rates, quotes, share links, settings, subscriptions.
5. Textile math package with unit tests (density, crimp, consumption, cover factor, ERP, sample, loom).
6. React: design system, shell, loading 0-100, auth, onboarding, dashboard, studio, designs, calculations, library, settings, share viewer.
7. i18n ar/en with RTL/LTR, persisted per user and in URL.
8. Exports: WIF, CSV, PNG, print sheet.
9. Hardening + docs + verification.

## Phase 2 — parity extras

- three.js fabric simulation (yarn count, twist, density, roughness, fuzz, lighting).
- Mockups (sofa / shirt / curtain) with pattern scaling.
- Jacquard image import + colour quantisation.
- Double-cloth generator and layer views.
- QR loom cards, vector PDF, email (SMTP), Stripe billing, admin console.

## Phase 3 — scale

- Redis rate limits/cache, object storage for thumbnails, background jobs, observability (Prometheus/Grafana/Sentry), backups + PITR.
