# Textile CAD Studio — Production Web App

منصة **غزل ونسيج** كاملة (Full-Stack) مبنية من نموذج HTML قديم، بمعمارية إنتاجية:

- **Backend:** Go 1.26 + chi + pgx + PostgreSQL 18
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4
- **Auth:** JWT access token + rotating refresh token (httpOnly cookie) + Argon2id
- **i18n:** عربي RTL / English LTR — كل النصوص من ملفات ترجمة، مفيش نص مخلوط
- **Design:** مستوحى 1:1 من مرجع `i-CORE` (سايدبار كحلي، خلفية فاتحة، أكسنت أحمر)

## Quick start (Docker)

```bash
cp .env.example .env
# عدّل JWT_SECRET وكلمة سر الداتابيز
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:8080
- Health: http://localhost:8080/healthz

## نشر مجاني على الإنترنت (بدون بطاقة)

خطوة بخطوة في [`docs/DEPLOY-FREE-AR.md`](docs/DEPLOY-FREE-AR.md):
حاوية واحدة (`deploy/free/Dockerfile` — nginx + API) على Render Free،
وقاعدة بيانات Supabase Free، عبر `render.yaml`.

## Quick start (Local dev)

```bash
# 1) Database
docker compose up -d db

# 2) API
cd backend
cp ../.env.example .env
go run ./cmd/api

# 3) Web
cd frontend
npm install
npm run dev
```

Vite dev server: http://localhost:5173 (proxies `/api` → `:8080`).

On Windows without Docker, use the native service instead of `docker compose up -d db`:

```powershell
Get-Service postgresql-x64-18 | Start-Service   # needs an elevated shell
# database textile_cad, role textile, password from .env
```

## Structure

```
backend/
  cmd/api            # HTTP server
  cmd/migrate        # migration runner
  internal/api       # handlers + router
  internal/auth      # argon2id + JWT
  internal/calc      # textile math (pure, tested)
  internal/db        # pgx pool + embedded migrations
  internal/middleware
  internal/store     # data access
frontend/
  src/components     # design system + shell
  src/features       # studio, calculations
  src/pages          # loading, auth, onboarding, app, settings, share
  src/lib            # api client, i18n, utils
docs/                # design + plan + security notes
```

## Accounts & plans

- `free`: grid ≤ 16×16, 5 designs, basic calculations
- `pro`: grid ≤ 100×100, unlimited designs, WIF export, ERP, loom setup, sample analyzer, share links
- `admin`: everything + user administration

Plan checks are enforced **server-side**. The old client-side license-key check and Firebase were removed.

## Phase 1 delivered

- Loading 0→100 with real asset/auth bootstrap progress
- Login / Register / refresh / logout / password change
- Onboarding page
- App shell + dashboard matching the reference design
- Weave studio: canvas editor, pencil/line/rect/fill/eraser, undo/redo, zoom, weave generators (plain, rib, twill, satin, mock leno, honeycomb, crepe), repeat, warp/weft palettes, stripe generator, colorways
- **Draft engine** (`draft.ts`): every structure is a real draft (threading + tie-up + treadling, or a lift/peg plan) and the visible weave is derived from it. 24-structure library with live previews, per-structure parameters, compound cloth (double/triple), colour-and-weave effects and algorithmic generation.
- **Draft-plan viewer**: industrial four-quadrant layout (tie-up / threading / treadling / weave), peg-plan mode for cell and pile fabrics, PNG export.
- **AI studio assistant** (`AssistantPanel`): chat in Arabic or English, executes typed actions (apply structure, colourway, colours, resize, clear, open draft plan, navigate), analyses a photographed fabric sample into a weave + yarn colours, and falls back to a fully offline engine when no API key is set.
- Designs CRUD + autosave + duplicate + share links
- Yarn library + price rates
- Calculations: density/crimp, yarn consumption & pricing, ERP order, sample analyzer, loom setup
- Exports: WIF, CSV, PNG (client), print sheet
- Settings: language (ar/en + RTL/LTR), profile, security, plan
- Security hardening (OWASP Top 10), migrations, Docker, tests

## Phase 2 (next)

QR loom cards and design QR, vector PDF export (COVELO-style marketing sheet), email delivery (SMTP), Stripe subscriptions, richer 3D drape physics.

## AI assistant configuration

The assistant is optional and safe by default:

- **No key** → offline intent engine (structures, colourways, colours, resize, navigation) plus the deterministic Go image analyser (`backend/internal/ai`). Nothing leaves the server.
- **With key** → set `AI_API_KEY` (OpenRouter or any OpenAI-compatible endpoint) and optionally `AI_MODEL` / `AI_VISION_MODEL`. Free model ids rotate; if the provider returns 401/402/429 the UI silently falls back to the offline engine.

Endpoints: `GET /api/ai/status`, `POST /api/ai/chat`, `POST /api/ai/analyze` (authenticated, per-user rate limited).

## Security notes

See [`docs/SECURITY.md`](docs/SECURITY.md). Report issues privately, not in public issues.
