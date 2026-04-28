# SKIAPI Frontend

SKIAPI 的 Admin 控制台前端，对接 [NewAPI](https://github.com/Calcium-Ion/new-api)。

基于 **React 19 + Vite + MUI v7**。

---

## 技术栈

- React 19
- Vite
- MUI (Material UI) v7
- ESLint

## 开发

```bash
git clone https://github.com/dwgx/skiapi-frontend.git
cd skiapi-frontend
npm install
npm run dev
```

本地 Vite proxy 默认指向 `http://127.0.0.1:3001`。如果需要临时连当前 side-load 后端代理，显式设置 `VITE_PROXY_TARGET=http://43.153.139.136:3003`，不要把公网目标写成默认值。

## 构建

```bash
npm run build
```

预览构建产物：

```bash
npm run preview
```

## 相关项目

- [NewAPI](https://github.com/Calcium-Ion/new-api) — 后端网关
- [YuKiKo](https://github.com/dwgx/YuKiKo) — SKIAPI 配套项目

## 当前 Side-load

- Frontend: `http://43.153.139.136:3003/`
- Static root: `/var/www/skiapi-new-frontend/`
- Backend container: `newapi-app-skiapi`
- Backend binding: `127.0.0.1:3001->3000`
- Data: `/opt/skiapi-newapi/data/one-api.db`

`43.153.139.136:80` 和 `:8080` 是现有 TH-Platform 服务，不是 SKIAPI 发布目标。
