# Backend Contract

Last verified: 2026-04-28

This frontend targets NewAPI-compatible APIs. The local upstream reference used for this audit is:

- Repository: `https://github.com/Calcium-Ion/new-api.git`
- Branch: `origin/main`
- Commit: `db48108d21786eaa510d86d05afde318630ada0f`
- Commit date: `2026-04-28T20:29:23+08:00`
- Subject: `feat(logs): enhance usage logs table with log type indicators and improve UI elements`

Production may be a fork. Any endpoint listed as custom below must be confirmed against the deployed backend before treating it as a stable contract.

## Current 3003 Side-load

Current non-production side-load target:

- Public URL: `http://43.153.139.136:3003/`
- Frontend static root: `/var/www/skiapi-new-frontend/`
- Backend container: `newapi-app-skiapi`
- Backend image: `calciumion/new-api@sha256:a12629e8aacc2a4edcabf032abe19b48fed4cc814f4a668439e9949ae200c560`
- Backend binding: `127.0.0.1:3001->3000`
- Backend data path: `/opt/skiapi-newapi/data/one-api.db`
- Latest DB backup before refresh/restart: `/opt/skiapi-newapi/data/one-api.db.bak-20260428-205708`
- Public smoke: `GET http://43.153.139.136:3003/api/status` returned `200 OK`, NewAPI `v1.0.0-alpha.1`
- Edge hardening smoke passed: index `no-store`, `/site.webmanifest` `application/manifest+json`, missing static asset `404`, and `POST /api/setup` blocked with `403`.

This side-load is not `skiapi.dev` production. `43.153.139.136:80` and `:8080` belong to the existing TH-Platform stack.

## Auth Contract

- Browser auth is session/cookie based, not Bearer-token based.
- Authenticated frontend API calls must send cookies and `New-Api-User`.
- The upstream middleware checks that `New-Api-User` matches the authenticated session or access token user id.
- Frontend role guards are UI only. Effective authorization is always enforced by backend `UserAuth`, `AdminAuth`, or `RootAuth`.

## Confirmed Upstream Routes Used By This Frontend

| Feature | Frontend contract | Upstream requirement |
| --- | --- | --- |
| Options | `GET /api/option/`, `PUT /api/option/` | Root-only in upstream |
| Channel list | `GET /api/channel/?p=<1-based>&page_size=<n>` | Returns paginated items and `type_counts` |
| Channel create | `POST /api/channel/` with `{ mode, channel }` | Create body is nested |
| Channel update | `PUT /api/channel/` with flat channel body | Update body is flat |
| Channel fetch models, new channel | `POST /api/channel/fetch_models` with `{ type, key, base_url }` | Root-only in upstream |
| Channel fetch models, existing channel | `GET /api/channel/fetch_models/:id` | Preferred for existing channels because key stays server-side |
| Models | `GET/POST/PUT/DELETE /api/models/` using `model_name`, `status`, `sync_official`, `name_rule`, `vendor_id`, `endpoints`, `tags`, `icon`, `description` | Current upstream `model.Model` schema; no `display_name` field |
| Model deployments | `GET /api/deployments/settings` before list calls | If io.net is disabled or missing API key, list endpoints return `success:false`; UI must show disabled state instead of empty list |
| Token key reveal | `POST /api/token/:id/key` | Returns full token key after server-side checks |
| Top-up info | `GET /api/user/topup/info` | May include `waffo_pay_methods` and `creem_products` in addition to ePay/Stripe |
| Waffo pay | `POST /api/user/waffo/pay` with `{ amount, pay_method_index? }` | `pay_method_index` is the current safe selector; client-submitted Waffo type/name are deprecated |
| Waffo options | `WaffoMerchantId`, `WaffoApiKey`, `WaffoPrivateKey`, `WaffoPublicCert`, sandbox keys, notify/return URLs, currency/unit/min top-up | Current upstream OptionMap keys; old `WaffoId`/`WaffoKey` are not persisted by latest NewAPI |
| Creem pay | `POST /api/user/creem/pay` with `{ product_id, payment_method: "creem" }` | Returns `data.checkout_url` |
| Creem options | `CreemApiKey`, `CreemWebhookSecret`, `CreemTestMode`, `CreemProducts` | Webhook secret/test mode are required for reliable callback verification |
| Logs | `GET /api/log/` and `GET /api/log/self` support `type=6` refunds | Usage log `other.billing_source="subscription"` means wallet quota was not deducted |
| Subscription plans | `GET /api/subscription/admin/plans`, `POST /api/subscription/admin/plans`, `PUT /api/subscription/admin/plans/:id`, `PATCH /api/subscription/admin/plans/:id` | Plan create/update wraps body as `{ plan }` except patch status |
| Users | `POST /api/user/` creates with `username`, `password`, `display_name`, `role`; group/quota are edit/manage-only | Latest upstream `CreateUser` ignores client-submitted group/quota, so create UI must not imply those values are applied |

## Custom Or Fork-Only Routes

The following routes are not present in the verified upstream NewAPI route table and require production fork confirmation:

| Feature | Frontend route | Required backend behavior |
| --- | --- | --- |
| AI Assistant config | `GET /api/assistant/config` | Must not return provider secrets or admin-only options |
| AI Assistant chat proxy | `POST /api/assistant/chat` | Must authenticate user when tools can read/write account data, rate-limit, and avoid logging raw tool secrets |

If these routes are absent, the frontend should hide or disable the AI Assistant instead of presenting a broken UI. If these routes are public, tool execution must remain read-only and anonymous-safe.

## Current Frontend Safeguards

- `src/api/index.js` sets `withCredentials` and injects `New-Api-User` for axios calls.
- `src/components/common/AiAssistant.jsx` manually injects `New-Api-User` for assistant `fetch()` calls because they do not use the axios singleton.
- `src/components/common/aiTools.js` redacts assistant tool output before it can be sent back to the model.
- Mutating assistant tools require local browser confirmation before HTTP mutation.

## Known Contract Risks To Re-Test Against Production

- New-channel model fetching still uses `POST /api/channel/fetch_models`, which is RootAuth upstream. Existing-channel model fetching is fixed to `GET /api/channel/fetch_models/:id`.
- `AiAssistantAuth` as an option key is not masked by upstream sensitive-key suffix filtering. Per current operator direction, assistant compatibility is out of scope for upstream NewAPI refresh, but any forked assistant config route must never expose it to browsers.
- The 3003 side-load runs upstream container image `calciumion/new-api@sha256:a12629e8aacc2a4edcabf032abe19b48fed4cc814f4a668439e9949ae200c560`; fork commit evidence is still not available because this deployment uses an image, not a checked-out backend tree.

## Required Evidence Before Promotion

Before promoting the 3003 side-load or any `skiapi.dev` release that depends on custom routes, capture:

- Docker image name and digest for the running backend.
- Backend git commit or fork diff.
- `curl`/browser evidence for `/api/assistant/config` and `/api/assistant/chat` auth behavior.
- Permission behavior for `POST /api/channel/fetch_models` as admin versus root.
