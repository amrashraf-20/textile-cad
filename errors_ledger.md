# Error ledger

> Rule: every execution error gets appended here with cause + fix.

## Environment notes (2026-10-30)

- `docker` CLI exists but daemon pipe failed with `500 Internal Server Error`. Cause: WSL2 failed to start because CPU virtualization (VT-x / AMD-V / Hyper-V) is disabled in the computer firmware (`HCS_E_HYPERV_NOT_INSTALLED`).
- Fix for database: Local native PostgreSQL 18 service (`postgresql-x64-18`) was discovered running on `127.0.0.1:5432`. User `textile` and database `textile_cad` were connected with credentials in `.env`.
- `psql` path: Located at `C:\Program Files\PostgreSQL\18\bin\psql.exe`.
- PowerShell mangles inline scripts with quotes/regex; scripts are saved to files before execution.
- Frontend build: TypeScript check (`tsc --noEmit`) and Vite bundling completed with 0 errors (`dist/assets/index-*.js`, 15.37s).
- i18n parity check: Verified 546 keys in `ar.json` and 546 keys in `en.json` (0 missing keys on both sides).
- Go backend migrations & seeding: Applied successfully (`0001_init.sql`, `0002_seed.sql`), admin user `admin@example.com` initialized.
- E2E API Verification: All 9 flows tested and verified passing (Admin Login, /auth/me, Dashboard KPIs, Weave Design creation, Textile Calculations, Share Link generation, Public shared view, WIF export, and User Registration).
- 2026-10-30 afternoon: Project moved from the OneDrive Desktop to `D:\New folder\textile-cad` (OneDrive sync locks and long paths broke builds).
- PostgreSQL as an ordinary user process fails: `pg_ctl start` logs `autovacuum worker ... terminated by exception 0xC0000142` then `could not reserve shared memory region ... error code 487`. Only the Windows service (`postgresql-x64-18`) is stable; starting it needs elevation (`Start-Service` → `Cannot open ... service` without admin). A UAC prompt (`consent.exe`) blocks until approved, so the agent cannot start it unattended.
- Frontend build errors after the draft-engine refactor: `generateStructure` / `StructureDef` / `StructureOptions` were imported into `weave.ts` but not re-exported; fixed by exporting both values and types. Unused `hasAny`, `def`, `treadH` removed (`tsc` treats them as errors).
- Go test failure `uint32(8) * 2654435761` constant overflow: replaced the inline LCG with a package-level precomputed `crepeCells` table using `int64` arithmetic.
- Image analyser picked the first strong autocorrelation harmonic (thread pitch 6 instead of 8) and then reduced a 4-end twill to 2×2. Fixed with `bestPitch` (smallest strong local maximum), pixel-period detection limited to 4 repeats, thread-centre sampling, and `smallestPeriod` that only trims on a ≤2% mismatch.

