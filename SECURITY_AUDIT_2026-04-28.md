# skiapi 安全审计与 NewAPI 上游差异报告

日期: 2026-04-28
范围: `D:\Project\skiapi` 前端、部署脚本、依赖树，以及最新 `Calcium-Ion/new-api` 上游关键 API 合约对照。

## 当前状态更新

本文件下方保留了审计初始发现与证据。当前已经完成的修复/验证：

- AI Assistant tool result 已做 secret redaction，mutating/secret/payment 类工具需要本地确认后才执行。
- 移除 `@lobehub/icons` 传递依赖链，`dompurify` 作为直接生产依赖管理。
- `npm audit --omit=dev`: 0 vulnerabilities。
- `npm run check:ai-security`: passed。
- `npm run build`: passed；仍有 Vite large chunk warning。
- `npm run smoke:skiapi`: passed 13 checks against `http://43.153.139.136:3003/`。
- 上游 NewAPI 源码已刷新到 `db48108d21786eaa510d86d05afde318630ada0f` (`2026-04-28T20:29:23+08:00`)。
- 远端 `calciumion/new-api:latest` 已拉取确认，当前 digest 仍是 `sha256:a12629e8aacc2a4edcabf032abe19b48fed4cc814f4a668439e9949ae200c560`；容器已重启，`/api/status` 返回 `v1.0.0-alpha.1`。
- 远端 SQLite 已在重启前备份到 `/opt/skiapi-newapi/data/one-api.db.bak-20260428-205708`。
- 已适配 latest NewAPI 非 assistant 兼容项：existing-channel `fetch_models/:id`、Models 当前 schema、Waffo `pay_method_index` 和真实 OptionMap 键、Creem webhook/test mode/products、Stripe promotion save key、退款日志筛选、订阅抵扣显示、MokaAI 渠道类型、`tiered_expr` 定价、1-based 分页、io.net deployment disabled state、deploy/status 脚本端口/配置。
- 最新登录态探针通过：`options`、`topup info`、`logs type=6`、`models`、`deployments/settings`；`/api/deployments/` 因 io.net 未配置返回 `success=false`，前端已改为显式 disabled state。
- 远端 Nginx 已加固：index `no-store`、manifest MIME、missing static 404、`POST /api/setup` edge-blocked。

仍需高价值继续项：

- `npm run lint` 仍失败：81 errors / 3 warnings，主要是既有 React hooks、unused vars、empty block、static component 规则债务。
- 3003 side-load 仍是 HTTP-only，promotion 前需要域名/HTTPS/HSTS/secure cookie 验证。
- 当前 NewAPI image 是 `calciumion/new-api:latest`/`v1.0.0-alpha.1`，需要 pin digest 或明确升级策略。
- 上游 NewAPI 没有 `/api/assistant/*`；本轮按 operator 指示不处理自研 Assistant。
- 当前目录已接入 `https://github.com/dwgx/skiapi-frontend`，可在本地提交并推送。

## 结论

当前前端可以构建，但不满足可上线安全基线。

最高风险点是内置 AI Assistant 的 tool-calling：模型返回的 `tool_calls` 会被前端直接执行，并且 `create_token` 会拉取完整 API key 后把 key 放回 tool result，再作为下一轮 `role: "tool"` 内容发回 LLM 代理。这会把用户新建的 API key 泄露给外部模型/代理服务，同时缺少本地强制确认，模型可以触发删 token、兑换码充值等变更动作。

第二类高风险是供应链和部署面：生产依赖审计仍有 13 个漏洞，其中 6 个 high；`dompurify` 被源码直接 import 但未在 `package.json` 直接声明，只是靠 `@lobehub/icons -> @lobehub/ui -> mermaid` 的传递依赖碰巧存在。部署脚本使用 Paramiko `AutoAddPolicy()`，并把配置路径直接拼进远端 shell 命令。

第三类是 NewAPI 上游契约漂移：本项目有 `/api/assistant/*` 自定义依赖，但最新上游 NewAPI 没有这些路由；订阅计划状态切换、渠道模型获取也和最新上游路由不一致。必须确认生产后端是 NewAPI v0.12.1、最新上游、还是本地 fork，否则前端会在升级后失效。

## 我们查了什么

- 本地代码: `src/api`, `src/contexts`, `src/components`, `src/pages`, `src/utils`, `scripts`, `vite.config.js`, `package.json`, `eslint.config.js`。
- 认证链路: cookie/session、`New-Api-User` header、localStorage 用户状态、前端路由 guard。
- 危险渲染: `dangerouslySetInnerHTML`, `ReactMarkdown`, URL/link/image 过滤。
- secret/API key 面: token reveal、playground localStorage、assistant tool result、Authorization header。
- 支付/OAuth 跳转: `window.open`, dynamic form POST, OAuth callback query construction。
- 部署脚本: SSH host-key policy、远端 shell 拼接、nginx 配置生成。
- 依赖供应链: `npm audit`, `npm audit --omit=dev`, `npm ls`, `npm explain`, `npm audit fix --dry-run`。
- 上游 NewAPI: clone 最新 `Calcium-Ion/new-api` 到 `.audit/new-api` 并检查 auth middleware 与 router。

## 验证结果

```text
git clone --depth 1 https://github.com/Calcium-Ion/new-api.git .audit/new-api
HEAD: db48108d21786eaa510d86d05afde318630ada0f
commit date: 2026-04-28 20:29:23 +0800
subject: feat(logs): enhance usage logs table with log type indicators and improve UI elements
```

```text
npm ci
result: success
audit summary: 15 vulnerabilities total, 8 moderate, 7 high
```

```text
npm run build
result: success
warning: large chunks, especially index bundle around 2.7 MB before gzip
```

```text
npm run lint
result: failed
project result after ignoring .audit: 104 problems, 100 errors, 4 warnings
major classes: empty catch blocks, unused vars, React hook/static-component rules, react-refresh export warnings
```

```text
npm audit --omit=dev --json
result: failed
production dependency vulnerabilities: 13 total, 7 moderate, 6 high
main chain: @lobehub/icons -> @lobehub/ui -> mermaid -> dompurify/langium/chevrotain/lodash-es/uuid
direct: axios
```

## 高危问题

### P0 - AI Assistant 泄露新建 API key 给模型代理

证据:

- `src/components/common/aiTools.js:312-338` 的 `create_token()` 创建 token 后调用 `POST /api/token/:id/key` 拉取完整 key，并返回 `{ key, message: "Token created! Key: ..." }`。
- `src/components/common/AiAssistant.jsx:380-388` 将 `executeTool()` 的完整结果 `JSON.stringify(result)` 作为 `role: "tool"` 推回 `llmMsgs`，下一轮请求会发到 `/api/assistant/chat`。
- `src/components/common/AiAssistant.jsx:320-321` 明确所有 LLM 调用都走后端代理 `/api/assistant/chat`，后端再接外部或配置的模型服务。

影响:

- 用户让助手创建 token 时，完整 API key 会进入模型上下文或后端代理日志。
- 如果模型服务、代理日志、调试输出、第三方网关被访问，key 可被复用。
- 这是 secret exfiltration，不是普通 UI 暴露。

修复:

1. `create_token` 不得把 raw key 放入 tool result 或 assistant message。
2. key 只允许进入本地 UI-only state，用一次性 copy action 展示；发给 LLM 的 tool result 只返回 `{ success: true, token_id, key_revealed_to_user: true }`。
3. 对 LLM 请求做 redaction: `sk-*`, bearer token, webhook secret, redemption code 一律脱敏。
4. 后端 `/api/assistant/chat` 禁止记录原始 messages，或至少对 tool result 做字段级脱敏。

### P0 - AI Assistant 可直接执行变更动作，缺少确定性确认

证据:

- `src/components/common/AiAssistant.jsx:380-384` 对模型返回的任意 tool call 直接执行。
- `src/components/common/aiTools.js:341-345` 的 `delete_token` 直接 `DELETE /api/token/:id`。
- `src/components/common/aiTools.js` 还包含 `create_token`, `redeem_code` 等有副作用动作。

影响:

- 提示词、模型漂移、注入内容或代理返回被污染时，可以触发删 token、创建 token、兑换码消耗等动作。
- 当前“Ask user to confirm”如果只写在 prompt 中，不构成安全边界。

修复:

1. tool 定义增加 `risk: "read" | "write" | "secret" | "payment"`。
2. 默认只允许 read tools 自动执行。
3. write/secret/payment tools 进入 pending action UI，由本地用户点击确认后执行。
4. 对每个 mutating tool 建立本地 allowlist 和参数 schema 校验，不接受模型自由拼接未知字段。
5. tool result 回传模型时只给最小状态，不回传 secret、余额敏感明细、完整兑换码。

### P1 - dev proxy 默认打到公网 VPS，容易误改真实环境（已修复）

历史证据:

- `vite.config.js:8-9` 将 `/api` 和 `/v1` 代理到 `http://43.153.139.136:8080`。
- 项目文档说 dev server 代理到 localhost/backend，本地配置和文档不一致。

当前状态:

- `vite.config.js` 默认 `VITE_PROXY_TARGET || "http://127.0.0.1:3001"`。
- `.env.example` 保持本地 backend 默认值，不默认连接公网。
- 如果必须临时连当前 3003 side-load，应显式运行 `VITE_PROXY_TARGET=http://43.153.139.136:3003 npm run dev`。

影响:

- 本地开发时的登录、设置、token、用户管理、充值等操作会打到公网/测试 VPS。
- cookie/session 状态混杂，容易把调试操作变成真实环境变更。

修复:

1. 改为 `process.env.VITE_PROXY_TARGET || "http://127.0.0.1:3001"`。
2. `.env.production` 不参与 Vite dev proxy。
3. README/AGENTS 同步真实开发后端端口。
4. 如果必须连 VPS，要求显式 `VITE_PROXY_TARGET=http://43.153.139.136:3003 npm run dev`。

### P1 - 生产依赖存在 high advisories，且 `dompurify` 是隐藏直接依赖

证据:

- `package.json:21` 使用 `@lobehub/icons`.
- `package.json:26` 使用 `axios`.
- `src/utils/security.js:1` 直接 `import DOMPurify from 'dompurify'`，但 `package.json` 没有声明 `dompurify`。
- `npm audit --omit=dev` 报 13 个 production 漏洞，6 high。
- `npm explain dompurify` 显示它来自 `@lobehub/icons -> @lobehub/ui -> mermaid`。

影响:

- 生产包包含存在 advisories 的链路。
- `dompurify` 的安全版本不受项目直接控制，后续移除图标依赖可能导致构建失败。
- 本项目有 `dangerouslySetInnerHTML`，DOMPurify 版本必须显式可控。

修复:

1. 直接添加并固定 `dompurify >= 3.4.1`。
2. 更新 `axios` 到 audit 建议版本。
3. 对 `@lobehub/icons` 做二选一：
   - 升级到 audit fix 建议版本并跑视觉/构建回归；
   - 或移除该大依赖，改为本地 provider icon 映射，避免拉入 `@lobehub/ui/mermaid`。
4. 加 `npm audit --omit=dev` 到 CI 阻断。

### P1 - Playground 持久化 API key 到 localStorage，且自动取 key 与上游 masked token 不匹配

证据:

- `src/pages/Playground.jsx:381` 从 `localStorage.getItem('playground_key')` 初始化。
- `src/pages/Playground.jsx:386-392` 自动读取 `/api/token/?p=0&page_size=1` 的 `items[0].key` 并存入 localStorage。
- 最新 NewAPI 路由中 token reveal 是 `POST /api/token/:id/key`，见 `.audit/new-api/router/api-router.go:253-260`。

影响:

- XSS、浏览器扩展、共享设备或调试导出可读到 API key。
- 上游 v0.12.6+ token 列表不返回完整 key，该自动逻辑可能存 masked key 或失效。

修复:

1. Playground key 默认只保存在内存或 `sessionStorage`，并提供显式“记住本机”开关。
2. 自动创建/获取 key 必须通过明确按钮和确认，不在 mount 时静默执行。
3. reveal 使用 `POST /api/token/:id/key`，并复用 Token 页已有逻辑。
4. debug 面板禁止展示 Authorization header 和完整 secret。

### P1 - 部署脚本 SSH host-key 与 shell 拼接不安全

证据:

- `scripts/vps.py:10` 使用 `paramiko.AutoAddPolicy()`。
- `scripts/deploy.py:188` 生产部署路径也使用 `paramiko.AutoAddPolicy()`。
- `scripts/deploy.py:133`, `scripts/deploy.py:202`, `scripts/deploy.py:242-244` 把 `REMOTE_DIR`/`PROD_REMOTE_DIR` 直接拼进 `rm -rf`/`tar`/`chown` shell 命令。
- `scripts/config.example.py` 没有定义 `PROD_HOST`, `PROD_PORT`, `PROD_USER`, `PROD_PASSWORD`, `PROD_REMOTE_DIR`，但 `deploy.py:26` 无条件 import。

影响:

- 首次连接或 DNS/网络被劫持时可能被 MITM。
- 配置文件被误改或污染时，远端 shell 命令有命令注入/误删路径风险。
- example config 不能支持完整 deploy path，新人复制后会直接 import failure。

修复:

1. 使用 pinned known_hosts，禁止 `AutoAddPolicy()` 默认信任。
2. shell 参数用 `shlex.quote()`，并在 Python 侧验证远端目录必须位于 `/var/www/` 下。
3. 删除或隔离 `PROD_*` legacy deploy path，或者补全 `config.example.py` 并加注释。
4. `rm -rf` 前先 `test -n "$dir" && test "$dir" != "/" && test "${dir#/var/www/}" != "$dir"`。

## 中风险和契约漂移

### M1 - 最新上游没有 `/api/assistant/config` 和 `/api/assistant/chat`

证据:

- `src/components/common/AiAssistant.jsx:252` 调用 `/api/assistant/config`。
- `src/components/common/AiAssistant.jsx:321` 调用 `/api/assistant/chat`。
- 最新 `.audit/new-api` 中未发现 assistant router/controller。

影响:

- 如果生产后端是原版最新 NewAPI，AI Assistant 直接不可用。
- 如果生产后端是 custom fork，必须把 fork patch 固化到仓库或文档，否则升级会丢功能。

修复:

1. 确认生产后端 commit/fork。
2. 将 assistant backend patch 纳入独立仓库或 `backend-patches/`。
3. 给前端加 capability detection，后端不存在时隐藏入口，不显示假可用状态。

### M1 - 订阅计划状态切换与最新上游路由不一致

证据:

- `src/pages/Subscription.jsx:72` 调用 `POST /api/subscription/admin/plans/${plan.id}/status`。
- 最新上游 `.audit/new-api/router/api-router.go:154-158` 是:
  - `GET /api/subscription/admin/plans`
  - `POST /api/subscription/admin/plans`
  - `PUT /api/subscription/admin/plans/:id`
  - `PATCH /api/subscription/admin/plans/:id`

影响:

- 升级到最新上游后状态切换可能 404/405。

修复:

1. 改为 `PATCH /api/subscription/admin/plans/:id`，body 按上游 controller 要求发送。
2. 若生产 fork 仍使用 `/status`，需要兼容层或版本探测。

### M1 - 渠道模型获取与最新上游路由不一致

证据:

- `src/components/channel/ChannelDialog.jsx:53-55` 用 `GET /api/channel/fetch_models`，query 里带 type/key/base_url。
- 最新上游 `.audit/new-api/router/api-router.go:232-233` 是:
  - `GET /api/channel/fetch_models/:id`
  - `POST /api/channel/fetch_models`，且 root auth

影响:

- 最新上游不接受当前 GET query 形态。
- key/base_url 通过 URL query 传输也更容易进入 access log、browser history、proxy log。

修复:

1. 新建渠道预拉模型改为 `POST /api/channel/fetch_models`，body 传参。
2. 已存在渠道拉模型用 `GET /api/channel/fetch_models/:id`。
3. 不在 query string 放 provider key。

### M2 - OAuth callback 未编码 query 参数

证据:

- `src/pages/OAuthCallback.jsx:21` 拼接 `/api/oauth/${provider}?code=${code}&state=${state || ''}`。

影响:

- `code`/`state` 中的 `&`, `=`, `%` 可改变 query 结构或造成兼容问题。

修复:

- 使用 `encodeURIComponent(code)`, `encodeURIComponent(state || '')`。
- 对 `provider` 做 allowlist 或至少 path segment encode。

### M2 - 支付跳转缺少 URL 校验和 opener 隔离

证据:

- `src/pages/TopUp.jsx:168-169` 直接 `window.open(pay_link, '_blank')`。
- `src/pages/TopUp.jsx:179-180` 动态 form 的 `action = url`, `target = '_blank'`。

影响:

- 如果支付 URL 被配置污染或后端返回异常，可打开非预期 scheme/site。
- 新窗口可以通过 opener 反控原页面，除非浏览器默认隔离。

修复:

1. 复用 `src/utils/security.js:isSafeUrl()` 校验。
2. `window.open(url, '_blank', 'noopener,noreferrer')` 后显式 `win.opener = null`。
3. form POST 场景优先后端返回可信 payment session URL；前端只接受 `https:`。

### M2 - Markdown link allowlist 接受 protocol-relative URL

证据:

- `src/components/common/AiAssistant.jsx:48` 和 `src/pages/Playground.jsx:27` 使用 `/^(https?:|mailto:|\/)/i`。
- `//evil.example/path` 会匹配 `/`。
- `src/utils/security.js:21-23` 已经有更严格的 `isSafeUrl()`。

影响:

- 不是直接 XSS，但可生成看似站内的外链/钓鱼链接。

修复:

- ReactMarkdown `a` renderer 统一调用 `isSafeUrl()`。

### M2 - nginx 安全头缺失

证据:

- nginx 配置由 `scripts/deploy.py` 内联生成，当前未看到 CSP、`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`/`X-Frame-Options`。

影响:

- 当前 app 有 markdown/html 渲染和大量 admin 表单，缺少浏览器侧防护纵深。

修复:

建议最小 headers:

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header X-Frame-Options "DENY" always;
```

CSP 需要结合 MUI inline style/Vite bundle 实测，先用 Report-Only，再收紧。

## 已确认不是直接漏洞但要保留边界

### `New-Api-User` header 不是单独可伪造身份

前端从 localStorage 读取 user id 并设置 `New-Api-User`:

- `src/api/index.js:9-15`

最新上游后端会校验 session/access-token 用户 id 与 header 一致:

- `.audit/new-api/middleware/auth.go:95-122`

因此在最新上游里，单独篡改 localStorage 中的 `id` 不会越权，只会导致 `MsgAuthUserIdMismatch`。但前端 role guard 仍只是 UI 边界:

- `src/contexts/AuthContext.jsx:50`
- `src/components/auth/Guards.jsx`

所有 admin/root 权限必须以后端 `AdminAuth()`/`RootAuth()` 为准。

## 质量门禁缺失

当前 `npm run lint` 失败 104 个项目问题，代表 CI 不能作为变更阻断。安全相关的不是每一条 lint，但以下类目会降低审计可信度:

- empty catch block: 静默吞掉 token reveal、OAuth、请求错误。
- unused vars: 逻辑漂移和死代码。
- React hooks/static component rule: 运行时状态问题和重复渲染风险。
- react-refresh only-export-components: 开发态行为不稳定。

修复顺序:

1. 先修 empty catch 和安全路径相关 lint。
2. 再处理 Settings 页 inline component/static-components。
3. 最后处理 Fast Refresh export 结构。

## 需要补的东西

### 必须补的仓库文档/配置

- `BACKEND_CONTRACT.md`: 写明当前生产后端到底是哪一个 commit/fork，哪些 API 是 upstream，哪些是 custom。
- `SECURITY.md`: 报告漏洞、secret 处理、部署安全要求。
- `.env.example`: 明确 `VITE_PROXY_TARGET`，不要默认连公网。
- `scripts/config.example.py`: 补齐或移除 `PROD_*`，避免 deploy import failure。
- CI: `npm ci`, `npm run lint`, `npm run build`, `npm audit --omit=dev`。

### 必须补的测试

- Assistant mutating tool confirmation: 未确认时不得触发 HTTP mutation。
- Assistant tool redaction: raw `sk-*` 不得进入 LLM message。
- OAuth callback encoding。
- Markdown URL safety: 拒绝 `//host/path`, `javascript:`, `data:`。
- Channel fetch models route contract。
- Subscription admin status route contract。

## 推荐修复顺序

1. 禁用或降级 AI Assistant mutating tools，先只保留 read-only tools。
2. 修 `create_token` secret exfiltration，确保 key 不进入 tool result/LLM context。
3. 修改 dev proxy 默认目标，避免误打公网。
4. 明确后端版本/fork，并修 route contract drift。
5. 升级/替换供应链风险依赖，直接声明 `dompurify`。
6. 修 deploy SSH host-key/pathed shell 拼接。
7. 修 Playground key storage/reveal 逻辑。
8. 补 URL safety/OAuth encoding/payment opener。
9. 清 lint，建立 CI gate。
10. 增加 nginx 安全头，CSP 先 Report-Only。

## 本次对仓库做过的非业务改动

- `eslint.config.js`: 添加 `.audit` ignore，避免上游 NewAPI clone 被本项目 ESLint 扫描。
- `.gitignore`: 添加 `.audit/`，避免把审计拉取的上游源码纳入项目。

## 当前未完成/需确认

- 未连接生产 VPS 验证运行中 backend commit/container image digest。
- 未运行 `npm audit fix`，因为会升级 `@lobehub/icons/@lobehub/ui/mermaid` 链路并可能影响 UI，需要单独回归。
- 未修复业务代码漏洞，本报告是审计基线和修复计划。
- 本节为接入 GitHub 前的审计基线；后续已把本目录接入 `https://github.com/dwgx/skiapi-frontend`。

## 第二轮修复进展 - 2026-04-28

本轮开启 5 个 subagent 并并行覆盖：3 个研究、1 个测试、1 个修复。结论已合并到当前工作区。

### 已修复/缓解

- AI Assistant P0 secret exfiltration: `create_token` 不再把 raw key 作为 enumerable tool result 送回 LLM；tool result、assistant message、error path 增加 redaction；mutating/secret/payment 类工具加本地确认门。
- Assistant authenticated request: `/api/assistant/*` 请求补 `New-Api-User` header，避免后端按 NewAPI auth middleware 拒绝。
- Assistant URL rendering: Markdown link 增加 `isSafeUrl` 校验，拒绝 `javascript:`/`data:` 等危险 URL。
- NewAPI contract drift: subscription plan enable/disable 改为 `PATCH /api/subscription/admin/plans/:id`；channel fetch models 改为 body 传参；Settings route 改为 Root-only；分页查询改为 NewAPI 的 `p=page+1`。
- Channel stats drift: 通道类型统计改用后端 `type_counts`，避免只统计当前分页数据。
- OAuth/OIDC/payment URL hardening: OAuth callback 参数改为 `URLSearchParams` 编码；OIDC authorize endpoint 与 payment redirect/open window 增加安全 URL 校验；`window.open` 使用 `noopener,noreferrer`。
- Dev proxy hardening: Vite dev proxy 默认改为 `http://127.0.0.1:3001`，可用 `VITE_PROXY_TARGET` 显式覆盖，避免本地开发误打公网。
- Supply-chain high risk: 升级 `axios`、`vite`、`@lobehub/icons` 链路并直接声明 `dompurify`；`npm audit --omit=dev` 从 6 high + 7 moderate 降到 0 high + 4 moderate。
- Security guardrail: 新增 `scripts/check-ai-assistant-security.mjs` 和 `npm run check:ai-security`，专门阻断 Assistant raw tool result、缺确认门、缺 redaction、缺 URL 校验等回归。

### 已验证

- `npm run check:ai-security`: pass。
- Targeted ESLint: `src/components/common/AiAssistant.jsx`, `src/components/common/aiTools.js`, `src/pages/OAuthCallback.jsx`, `src/hooks/usePaginatedList.js`, `src/pages/router.jsx`, `src/pages/Channel.jsx`, `scripts/check-ai-assistant-security.mjs` 均 pass。
- `npm run build -- --outDir $TEMP/skiapi-final3-verify --emptyOutDir`: pass。
- `npm audit --omit=dev`: 仍 fail，但剩余为 4 moderate，0 high。
- `npm run lint`: 仍 fail，剩余 84 个历史/全局 lint 问题，未全部纳入本轮安全修复范围。

### 剩余风险

- `@lobehub/icons -> @lobehub/ui -> mermaid -> uuid` 仍有 moderate audit 链路；`npm audit fix --force` 会降级/破坏图标链路，不应盲目执行。建议下一步移除或替换 `@lobehub/icons` 的实际使用点。
- `/api/assistant/*` 不是 upstream NewAPI v0.12.1 标准接口；需要确认生产 fork 是否真实实现，并补 `BACKEND_CONTRACT.md`。
- Channel fetch models 的 new-channel POST 在 upstream 为 RootAuth；编辑现有 channel 时更稳的是使用 `GET /api/channel/fetch_models/:id`，需要按当前生产后端行为再做一次实测。
- Deploy 脚本 SSH host-key、remote shell 拼接、nginx security headers 仍未修，本轮只完成前端高危与 NewAPI 合约主线。

## 第三轮修复进展 - 2026-04-28

### 已修复/缓解

- 完全移除 `@lobehub/icons`，`VendorIcon` 改为本地 dependency-free 圆标实现，切断 `@lobehub/icons -> @lobehub/ui -> mermaid -> uuid` 供应链链路。
- 移除未使用的 `marked` 和 `rehype-highlight`，进一步缩小生产依赖面。
- 新增 `BACKEND_CONTRACT.md`，记录当前 NewAPI upstream 基线 `28f7e9eb2ea40950b3d1b6665a8095caf211909d`，并区分 upstream routes 与 fork-only `/api/assistant/*` routes。
- 新增 `.env.example`，明确本地 Vite proxy 默认目标为 `http://127.0.0.1:3001`。
- 新增 `SECURITY.md`，固定 secret handling、assistant redaction、dependency gate、deployment host-key 要求。
- `scripts/vps.py` 移除 `AutoAddPolicy`，改为 known_hosts / SHA256 host-key pin / 显式 bootstrap warning policy。
- `scripts/deploy.py` 移除 `tempfile.mktemp()`，远程路径使用 shell quote，发布改为 staging directory 解压后切换 live directory，并对远程发布目录做 allowlist 校验。
- Nginx template 增加 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy` 和 `Content-Security-Policy-Report-Only`，`/assets/` location 重复关键 header 以规避 nginx `add_header` 继承规则。
- `scripts/config.example.py` 补齐 host-key pin 和 `PROD_*` 示例字段，避免生产部署配置边界不清。

### 已验证

- `.audit/new-api` 已 fetch，`origin/main` 当前仍为 `28f7e9eb2ea40950b3d1b6665a8095caf211909d`。
- `npm audit --omit=dev`: pass，0 vulnerabilities。
- `npm run check:ai-security`: pass。
- `npm run build -- --outDir $TEMP/skiapi-build-final-high-value --emptyOutDir`: pass。
- `python -m py_compile scripts/deploy.py scripts/vps.py scripts/config.example.py`: pass。
- Targeted ESLint: `src/components/common/VendorIcon.jsx` 与 `scripts/check-ai-assistant-security.mjs` pass。
- Static scan: no `AutoAddPolicy`, no `mktemp`, no direct `rm -rf {REMOTE_DIR}/*` / `rm -rf {PROD_REMOTE_DIR}/*` / `rm -rf {LEGACY_REMOTE_DIR}/*` patterns remain.

### 当前剩余风险

- `npm run lint` 仍 fail，当前 84 problems: 主要是历史 `react-hooks/static-components`、`no-unused-vars`、`no-empty`、`set-state-in-effect`、Fast Refresh export 问题。
- 未连接生产 VPS，因此尚未确认运行中 backend image digest、fork commit、`/api/assistant/*` 实际认证行为。
- Nginx security headers 已写入 deploy template，但未连接 VPS 执行 `--nginx`，因此生产响应头状态仍未验证。
- Channel fetch models 仍需按生产权限实测：upstream 新 channel POST 是 RootAuth，existing channel GET 更适合 admin 编辑流。

## 生产冒烟测试 - 2026-04-28

详见 `SMOKE_TEST_2026-04-28.md`。

结论:

- `43.153.139.136` SSH 可达，但该主机不是当前 `skiapi`/NewAPI 生产节点。
- 该主机运行的是 TH-Platform: port 80 为 `/opt/th-platform/server/bin/gateway`，docker 中有 `th-backend-api-1`，没有 `newapi-app`，没有 nginx，缺少 `/var/www/skiapi-new-frontend`。
- `skiapi.dev` DNS 当前解析到 `152.32.146.205`，不是 `43.153.139.136`。
- `https://skiapi.dev/`、`http://skiapi.dev/api/status`、以 `Host: skiapi.dev` 访问 `152.32.146.205` 均返回 `502 Bad Gateway`。
- 未执行部署，未持久修改远端；冒烟测试临时 `/tmp/smoke_*` 文件已清理。

下一步需要 `152.32.146.205` 或实际 `skiapi.dev` 后端主机的 SSH 凭据，才能验证 backend image digest、fork commit、nginx config、安全头和 `/api/assistant/*` 行为。

## 第四轮低风险同步 - 2026-04-28

本轮仅同步本地文档/部署配置到当前 3003 side-load 现实，未连接或修改远端服务器。上面的“生产冒烟测试”结论仍用于说明 `skiapi.dev` 生产域名未验证；当前可用的 SKIAPI 临时入口是 `http://43.153.139.136:3003/`，详见 `SMOKE_TEST_2026-04-28.md` 的 side-load 和 port cutover 记录。

### 已同步

- `scripts/config.example.py`: 默认示例目标从旧 `8080` 改为当前 `43.153.139.136:3003` side-load；补充 `newapi-app-skiapi`、`/opt/skiapi-newapi/data/one-api.db`、`FRONTEND_EXTRA_PORTS=(18080,)`。
- `scripts/deploy.py`: nginx listen 端口改为配置驱动，支持额外 side-load 监听端口；部署成功输出使用配置里的 `HOST`；`--link-ui` 不再硬编码旧 `newapi-app` 和 `/opt/newapi/data/one-api.db`。
- `scripts/status.py`: 端口探测改为包含配置里的 `FRONTEND_PORT`、`FRONTEND_EXTRA_PORTS` 和 `BACKEND_PORT`，避免漏看 public `3003`。
- `AGENTS.md`、`CLAUDE.md`、`README.md`: 标明 `43.153.139.136:3003` 是当前 SKIAPI side-load，`43.153.139.136:80` 与 `:8080` 仍属于 TH-Platform，不是 SKIAPI 发布目标。
- `BACKEND_CONTRACT.md`、`SMOKE_TEST_2026-04-28.md`: 补当前 3003 side-load 的可用性、容器、数据路径与仍未验证项。

### 当前仍未做

- 未执行 `python scripts/deploy.py`、`--nginx`、`--link-ui` 或任何远端命令。
- 未验证运行中 Docker image digest、真实 fork commit、`/api/assistant/*` 行为。

## 第五轮 NewAPI latest 兼容与远端部署 - 2026-04-28

本轮按用户要求忽略自研 assistant，只对最新 upstream NewAPI 合约做查漏补缺，并把当前前端部署到 3003 side-load。

### 已修复/缓解

- 上游 NewAPI 源码刷新到 `Calcium-Ion/new-api` `db48108d21786eaa510d86d05afde318630ada0f` (`2026-04-28T20:29:23+08:00`)；远端 `calciumion/new-api:latest` 已拉取确认，运行 digest 为 `sha256:a12629e8aacc2a4edcabf032abe19b48fed4cc814f4a668439e9949ae200c560`。
- 远端 backend 容器 `newapi-app-skiapi` 已重启在 `127.0.0.1:3001->3000`；重启前 DB 备份为 `/opt/skiapi-newapi/data/one-api.db.bak-20260428-205708`。
- Channel 编辑现有通道时改用 `GET /api/channel/fetch_models/:id`，避免前端重新提交密钥；新通道仍用 upstream RootAuth 的 `POST /api/channel/fetch_models`。
- Model 管理改为最新 schema: `model_name`, `description`, `icon`, `tags`, `vendor_id`, `endpoints`, `status`, `sync_official`, `name_rule`；CSV 不再导出不存在的 `display_name`。
- Top-up 适配 Waffo `pay_method_index` 和 Creem `checkout_url`/products；Settings 同步最新 Stripe/Creem/Waffo option keys。
- Model deployments 在调用列表前先读 `/api/deployments/settings`；io.net 未启用或缺 key 时显示禁用态，不再把 backend `success:false` 渲染成空数据。
- Logs 增加 refund `type=6`，并识别 `other.billing_source="subscription"` 的订阅抵扣。
- Dashboard/Playground 的日志/token 请求修正为 NewAPI 1-based `p=1`。
- 用户创建弹窗移除 group/quota 字段；最新 upstream `CreateUser` 不应用这两个客户端字段，避免 UI 暗示创建时已设置。
- Channel type 常量补 `44 MokaAI`。
- `scripts/deploy.py` 的 nginx 写入路径改为配置驱动；`scripts/status.py` 区分 SKIAPI 端口和同机 TH-Platform 邻居端口。

### 已验证

- `git -C .audit/new-api fetch origin main --prune`: `origin/main` 仍为 `db48108d21786eaa510d86d05afde318630ada0f`。
- `npm run build`: pass；Vite 仍有大 chunk warning。
- `npm run smoke:skiapi`: pass 13 checks against `http://43.153.139.136:3003/`，最终 SPA shell hash `e97043be211c`。
- `npm run check:ai-security`: pass。
- `npm audit --omit=dev`: pass，0 vulnerabilities。
- Targeted ESLint: `TopUp.jsx`, `Model.jsx`, `ModelDeployment.jsx`, `User.jsx`, `LogFilters.jsx`, `constants/index.js` pass。
- 远端 nginx `nginx -t`: pass；`curl http://127.0.0.1:3003/` 返回 `200`。
- 端口复测: `22`, `80`, `3003`, `8080` open；`443`, `3001`, `3002`, `7891`, `18080` closed/filtered。`3001` 未公网暴露，符合预期。

### 当前剩余风险

- 3003 side-load 仍是 HTTP-only；上正式域名前需要 HTTPS、HSTS、Secure/SameSite cookie 策略与真实域名 CSP 回归。
- 本目录已接入 `https://github.com/dwgx/skiapi-frontend`；本轮变更可以正常 commit/push。
- `npm run lint` 仍有历史全局 debt，主要是 `react-hooks/static-components`、`set-state-in-effect`、unused/no-empty/Fast Refresh export；本轮只对触达文件做 targeted ESLint。
- 自研 `/api/assistant/*` 已按用户要求排除在 NewAPI latest 适配范围外；正式发布前仍应单独做 assistant auth/secret-flow 回归。
