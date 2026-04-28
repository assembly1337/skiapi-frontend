# Deployment Guide

## Configuration

Deployment target details are private and must stay in local-only config files.

1. Copy `scripts/config.example.py` to `scripts/config.py`.
2. Set `HOST`, `PORT`, `USER`, `PASSWORD`, `REMOTE_DIR`, `NGINX_CONF`, `BACKEND_PORT`, and `FRONTEND_PORT`.
3. Prefer `HOST_KEY_SHA256` or a trusted `KNOWN_HOSTS_PATH`; avoid `ALLOW_UNKNOWN_HOST = True` except for controlled bootstrap.
4. Keep `scripts/config.py` out of Git.

## Build And Upload

```bash
npm ci
npm run build
python scripts/deploy.py --no-build
```

`scripts/deploy.py` uploads `dist/` as a tarball, extracts to a staging directory, swaps it into the configured static root, and reloads nginx after `nginx -t`.

## Local Development Proxy

The default Vite proxy target is local:

```env
VITE_PROXY_TARGET=http://127.0.0.1:3001
```

For authorized remote testing, set `VITE_PROXY_TARGET` in `.env.local` or the shell for that session only. Do not write public remote targets into committed Markdown or examples.

## Post-Deploy Checks

```bash
npm run smoke:skiapi -- --base-url <authorized-frontend-url>
```

Confirm:

- SPA shell returns `200`.
- `/api/status` returns NewAPI status JSON.
- security headers are present.
- missing static assets return `404`.
- unsafe setup mutation paths remain blocked at the edge.
