# Security Policy

## Scope

This repository is the SKIAPI frontend for a NewAPI-compatible backend. Treat the backend contract as pinned in `BACKEND_CONTRACT.md`; custom or fork-only routes must be verified against production before release.

## Secret Handling

- Do not log API keys, bearer tokens, redemption codes, channel keys, or assistant provider tokens.
- Do not send raw tool results containing secrets back to LLM providers.
- `AiAssistantAuth` must remain server-side only. No assistant config endpoint may return it to browsers.
- Full token or channel-key reveal flows must rely on backend authorization and verification checks.

## Local Development

- The Vite dev proxy defaults to `http://127.0.0.1:3001`.
- To point at another backend, copy `.env.example` to `.env.local` and set `VITE_PROXY_TARGET` explicitly.
- Avoid using a production backend as the default development target.

## Dependency Gate

Required checks before release:

```powershell
npm ci
npm audit --omit=dev
npm run check:ai-security
npm run build
```

`npm run lint` is intended to become a release gate, but the current tree still has historical lint debt recorded in `SECURITY_AUDIT_2026-04-28.md`.

## Deployment

- SSH host keys must be pinned with `HOST_KEY_SHA256` or present in a trusted known-hosts file.
- `ALLOW_UNKNOWN_HOST = True` is only acceptable for one-off bootstrap in a controlled environment.
- Deployment scripts stage extracted assets before replacing the live directory. Do not reintroduce direct `rm -rf <live-dir>/*` publish flows.

## Reporting

For internal findings, include:

- affected component and route
- trigger and impact
- non-destructive reproduction steps
- expected remediation
- verification evidence after fix
