# SKIAPI Frontend Release Notes

Release date: 2026-04-29

## Scope

This release packages the React/MUI admin console for a NewAPI-compatible backend. It includes the latest NewAPI contract alignment work, deployment hardening scripts, smoke-test tooling, and audit documentation.

Public deployment hostnames and IP addresses are intentionally not stored in Markdown docs or release examples. Use local private configuration files or runtime arguments for authorized targets.

## Highlights

- Aligned frontend API calls with latest upstream NewAPI contracts.
- Updated model, channel, top-up, settings, log, pricing, and deployment pages for current backend behavior.
- Added release smoke testing through `scripts/smoke-skiapi.mjs`.
- Hardened deployment scripts with staged extraction, host-key controls, and configurable nginx paths.
- Documented backend contracts, security posture, and residual release risks.

## Build

```bash
npm ci
npm run build
```

Production files are emitted to `dist/`.

## Smoke Test

Local default:

```bash
npm run smoke:skiapi
```

Authorized remote target:

```bash
npm run smoke:skiapi -- --base-url <authorized-frontend-url>
```

## Deploy

Copy the example config and fill private values locally:

```bash
cp scripts/config.example.py scripts/config.py
python scripts/deploy.py --no-build
```

Do not commit `scripts/config.py`, `.env.local`, deployment credentials, or public infrastructure targets.

## Verification Checklist

- `npm audit --omit=dev`
- `npm run check:ai-security`
- `npm run build`
- `npm run smoke:skiapi -- --base-url <authorized-frontend-url>`

`npm run lint` still has historical project debt and is tracked in `SECURITY_AUDIT_2026-04-28.md`.
