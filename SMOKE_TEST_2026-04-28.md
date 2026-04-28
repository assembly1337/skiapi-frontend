# Production Smoke Test - 2026-04-28

## Latest Result

Current verified SKIAPI side-load:

- URL: `http://43.153.139.136:3003/`
- Backend: `newapi-app-skiapi`, `calciumion/new-api@sha256:a12629e8aacc2a4edcabf032abe19b48fed4cc814f4a668439e9949ae200c560`
- Upstream source reference: `Calcium-Ion/new-api` `db48108d21786eaa510d86d05afde318630ada0f` (`2026-04-28T20:29:23+08:00`)
- Public TCP open: `22`, `80`, `3003`, `8080`
- Public TCP blocked/filtered in the latest workstation probe: `443`, `3001`, `3002`, `7891`, `18080`
- `npm run smoke:skiapi`: passed 13 checks
- Latest public smoke shell hash: `e97043be211c`
- Authenticated API probe at 21:07 JST: passed `options`, `topup info`, `logs refund filter`, `models`, `deployment settings`; `deployments` list correctly returned `success=false` because io.net is not configured. Final 21:11 static redeploy was re-verified with unauthenticated public smoke and backend logs; application admin password was not reset.
- `npm run build`: passed; Vite still warns about large chunks
- Targeted ESLint passed for files without known historical lint debt: `TopUp.jsx`, `Model.jsx`, `ModelDeployment.jsx`, `User.jsx`, `LogFilters.jsx`, `constants/index.js`
- Targeted ESLint still reports pre-existing debt in `Settings.jsx` (`react-hooks/static-components` for inline `SaveBtn`) and `Log.jsx` (`react-hooks/set-state-in-effect` around stats fetch)
- `npm audit --omit=dev`: passed, 0 vulnerabilities
- `npm run lint`: still fails on existing project-wide React/unused/no-empty debt

Latest Nginx hardening verified:

- SPA shell sends `Cache-Control: no-store`
- `/site.webmanifest` serves `application/manifest+json`
- missing root static assets such as `/*.js` return `404`, not SPA fallback HTML
- `POST /api/setup` is blocked at Nginx with `403`; `GET /api/setup` remains available for setup status
- duplicate Nginx backup include warning was removed from `sites-enabled`

## Scope

Requested target:

- SSH host: `43.153.139.136`
- SSH user: `root`

This file includes both the initial target identification smoke test and the later authorized side-load install/hardening on the same host. Temporary `/tmp/smoke_*` files created during HTTP checks were removed.

## Current Active Side-load

Current public SKIAPI side-load target:

- URL: `http://43.153.139.136:3003/`
- Static root: `/var/www/skiapi-new-frontend`
- Nginx site: `/etc/nginx/sites-enabled/skiapi-new-frontend`
- Public listener: `3003`
- Extra listener: `18080` configured locally but blocked/filtered externally
- Backend container: `newapi-app-skiapi`
- Backend image: `calciumion/new-api@sha256:a12629e8aacc2a4edcabf032abe19b48fed4cc814f4a668439e9949ae200c560`
- Backend binding: `127.0.0.1:3001->3000`
- Data: `/opt/skiapi-newapi/data`
- Logs: `/opt/skiapi-newapi/logs`
- Latest DB backup before backend restart: `/opt/skiapi-newapi/data/one-api.db.bak-20260428-205708`

Do not use `43.153.139.136:8080` or port `80` for SKIAPI deployment checks; those ports belong to the existing TH-Platform services.

## SSH Result

- SSH login: success
- Host key: `ssh-ed25519 SHA256:VN0/Q8qVQPXaglqcsxbyR0XYJnAohEcyMUJe9+mdmK8`
- Hostname: `VM-0-7-debian`
- Kernel: `Linux 6.1.0-43-amd64`

## Finding: Provided Host Is Not The SKIAPI/NewAPI Host

Evidence from `43.153.139.136`:

- No `nginx` binary: `nginx: command not found`
- No nginx config dirs: `/etc/nginx`, `/etc/nginx/sites-enabled`, `/etc/nginx/conf.d` missing
- No frontend dir: `/var/www/skiapi-new-frontend` missing
- No NewAPI backend container: `docker inspect newapi-app` returned `no such object`
- No backend on `127.0.0.1:3001`
- Search under `/root`, `/opt`, `/www`, `/var/www`, `/srv` found no `newapi`, `one-api`, or `skiapi` path

Active services indicate this is a TH-Platform node:

- Port `80`: `/opt/th-platform/server/bin/gateway`
- `systemd`: `th-platform.service` active
- Docker:
  - `th-backend-api-1` from `th-backend-api`, exposed as `0.0.0.0:8080->8080`
  - `th_pg`
  - `th_redis`
  - `th_mailpit`
  - `cobalt-api`

HTTP evidence:

- `http://43.153.139.136/`: `200 OK`, title begins `TH-Platform Live Preview`
- `http://43.153.139.136:8080/`: `404 Not Found`
- `http://127.0.0.1:8080/api/status` on host: `404 Not Found`

## Finding: `skiapi.dev` Points Elsewhere And Is Currently 502

Local DNS:

- `skiapi.dev` CNAME: `us.xn--6krz1l.xn--io0a7i`
- Resolved A record: `152.32.146.205`

External HTTP checks:

- `https://skiapi.dev/`: `502 Bad Gateway`
- `http://skiapi.dev/api/status`: `502 Bad Gateway`
- `https://152.32.146.205/` with `Host: skiapi.dev`: `502 Bad Gateway`
- `http://152.32.146.205/` with `Host: skiapi.dev`: `502 Bad Gateway`

## Impact

The provided SSH target cannot validate or deploy this `skiapi` frontend because it is not running the expected NewAPI/nginx stack. The actual `skiapi.dev` host appears to be `152.32.146.205`, but SSH credentials for that host were not provided.

## Next Required Evidence

To continue production smoke testing or deployment, provide SSH access for `152.32.146.205` or the actual host behind `skiapi.dev`.

Minimum next smoke test once access is available:

- identify web server and config path
- verify backend process/container and image digest
- verify `/api/status`
- verify frontend static root
- deploy or stage current `dist/`
- verify security headers
- verify `/api/assistant/config` and `/api/assistant/chat` behavior

## Side Install On `43.153.139.136` - 2026-04-28

Installed without taking over the existing TH-Platform ports:

- Frontend files: `/var/www/skiapi-new-frontend`
- Nginx site: `/etc/nginx/sites-enabled/skiapi-new-frontend`
- Nginx listen port: `18080`
- NewAPI container: `newapi-app-skiapi`
- NewAPI image: `calciumion/new-api:latest`
- NewAPI host binding: `127.0.0.1:3001->3000`
- NewAPI data: `/opt/skiapi-newapi/data`
- NewAPI logs: `/opt/skiapi-newapi/logs`

Local-on-host smoke test passed:

- `http://127.0.0.1:18080/`: `200 OK`
- `http://127.0.0.1:18080/api/status`: `200 OK`
- `http://127.0.0.1:3001/api/status`: `200 OK`
- Security headers present on frontend responses: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy-Report-Only`

External TCP port test from local workstation:

- Open: `22`, `80`, `3003`, `8080`
- Blocked/filtered despite local listener: `18080`

Host firewall check:

- `ufw`: inactive
- `iptables INPUT`: accept policy

Conclusion: `18080` is blocked by upstream cloud firewall/security group, not by the Linux host firewall. To expose the side install publicly, open TCP `18080` in the cloud security group, or explicitly move SKIAPI onto one of the already-open ports after deciding what to do with the existing TH-Platform services.

## Port Cutover - 2026-04-28

The existing service on public port `3003` was:

- PM2 app: `windsurf-api`
- Process: `node /root/WindsurfAPI/src/index.js`
- CWD: `/root/WindsurfAPI`

Per operator instruction, port `3003` was replaced:

- `pm2 stop windsurf-api`
- `pm2 delete windsurf-api`
- `pm2 save --force`
- Files under `/root/WindsurfAPI` were not deleted.

Nginx now listens on both:

- `3003` public, verified reachable
- `18080` still configured locally, but blocked/filtered externally

Final external port check:

- `22`: open
- `80`: open, existing TH-Platform gateway
- `3003`: open, SKIAPI frontend + `/api` proxy
- `8080`: open, existing TH backend
- Latest workstation probe also saw `443`, `3002`, `7891`, and `18080` as blocked/filtered.
- `3001`: closed/filtered externally; NewAPI remains bound to `127.0.0.1:3001`
- `7891`: closed/filtered
- `18080`: closed/filtered externally

Final public smoke:

- `http://43.153.139.136:3003/`: `200 OK`
- `http://43.153.139.136:3003/api/status`: `200 OK`, NewAPI `v1.0.0-alpha.1`
- Security headers present on public `3003`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy-Report-Only`
- `npm run smoke:skiapi`: passed 13 checks after the final deploy; SPA shell hash `e97043be211c`
