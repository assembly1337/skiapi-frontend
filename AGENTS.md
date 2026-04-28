# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

React + MUI v7 (Material Design 3) rewrite of the NewAPI admin console (https://skiapi.dev/).
Backend: NewAPI v0.12.1 (Go/Gin) running in Docker, unchanged — frontend must match its API contracts exactly.

## Commands

```bash
npm run dev          # Dev server, proxies /api and /v1 to localhost:3001 by default
npm run build        # Production build to dist/
python scripts/deploy.py          # Build + upload + deploy to VPS
python scripts/deploy.py --no-build  # Upload existing dist/ only
python scripts/ssh.py "command"   # Run command on VPS
python scripts/logs.py            # View nginx error logs
```

## Architecture

**Stack**: React 19 + MUI v7 + Vite 8 + axios + react-router-dom v6 + notistack + @mui/x-charts

**Key directories**:
- `src/api/index.js` — Singleton axios instance with request interceptor (dynamic `New-Api-User` header), GET dedup, 401 auto-redirect
- `src/theme/index.js` — M3 theme factory (`createAppTheme(mode)`), custom component overrides, SlideUp dialog transition
- `src/hooks/` — `usePaginatedList` (shared fetch/pagination for 9+ table pages), `useModuleVisible`
- `src/constants/` — CHANNEL_TYPES (40+), USER_ROLES, CHANNEL_STATUS, PAYMENT_METHODS
- `src/components/common/` — AnimatedPage, AnimatedDialog, EmptyState, TableSkeleton, PageHeader, ConfirmDialog, SearchBar, StatusChip
- `src/contexts/` — AuthContext (user state + localStorage), StatusContext (/api/status), ThemeContext (dark/light)

## Critical API Patterns

**Auth**: Session/cookie-based (gin-sessions), NOT Bearer token. `withCredentials: true` on axios. Backend requires `New-Api-User` header (user ID) on every authenticated request — set dynamically via request interceptor.

**List responses**: NewAPI v0.12+ returns `{success, data: {items: [...], total, page, page_size}}`. Always use `extractList(res.data)` from `src/utils/` — never assume `res.data.data` is an array.

**Channel creation**: POST `/api/channel/` expects nested body `{mode: "single", channel: {...}}`. Update (PUT) uses flat body. Subscription plan create/update expects `{plan: {...}}`. All other CRUD endpoints (token, user, redemption) use flat bodies.

**Options API**: GET `/api/option/` returns `[{key, value}]`. PUT `/api/option/` with `{key, value}` to save.

## MUI v7 Grid

MUI v7 removed `<Grid item xs={12}>` syntax. Must use `<Grid size={{ xs: 12, sm: 6, lg: 3 }}>` or `<Grid size={12}>`. The `item` prop does not exist. Using the old syntax causes Grid children to collapse to auto width.

## Deploy

Deployment target details are private. Copy `scripts/config.example.py` to `scripts/config.py` and fill in the authorized host, ports, backend container, and data path locally. Do not commit `scripts/config.py`.

The deploy script serves static files from the configured `REMOTE_DIR` and proxies `/api/` and `/v1/` to the configured backend port. Keep public hostnames/IPs out of Markdown docs and examples.

## Chunk Loading

Lazy-loaded routes use `lr()` wrapper in `src/pages/router.jsx` that auto-reloads on stale chunk errors (deploy cache mismatch). `sessionStorage.chunk_retry` prevents infinite loops.
