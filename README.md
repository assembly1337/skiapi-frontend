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

本地 Vite proxy 默认指向 `http://127.0.0.1:3001`。如果需要临时连授权的远端后端代理，显式设置 `VITE_PROXY_TARGET=<authorized-backend-url>`，不要把公网目标写成默认值。

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

## 部署

复制 `scripts/config.example.py` 为 `scripts/config.py`，填写私有主机、SSH、目录和端口配置后执行：

```bash
python scripts/deploy.py
```

本仓库不在公开文档中保存公网部署目标。远端测试请通过运行时参数指定：

```bash
npm run smoke:skiapi -- --base-url <authorized-frontend-url>
```
