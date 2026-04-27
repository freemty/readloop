# Dev Server Startup

> ReadLoop 开发环境一键启动和分步启动。

## Problem
ReadLoop 需要同时启动 Vite dev server 和 Node.js proxy，之前需要手动开两个 tmux session。

## Solution

### 一键启动
```bash
npm start
```
`start.sh` 会：加载 `.env` → 后台启动 proxy (:3001) → 后台启动 vite (:5174) → Ctrl+C 同时停掉两个。

### 分步启动
```bash
npm run dev        # Vite dev server (http://localhost:5174/)
npm run proxy      # Proxy: Bedrock + Z-Library + Wiki (http://localhost:3001/)
```

### 常见问题

**端口被占用 (EADDRINUSE)**
```bash
lsof -ti:3001 | xargs kill -9   # proxy
lsof -ti:5174 | xargs kill -9   # vite
```

**Bedrock "security token invalid"**
Proxy 启动时必须加载 `.env`。如果直接 `node proxy.mjs` 不会读 `.env`，需要：
```bash
set -a && source .env && set +a && node proxy.mjs
```
或者用 `npm run proxy` / `npm start`（已内置 source .env）。

**更换 AWS 凭证后**
必须重启 proxy，proxy 在启动时读取 env 创建 BedrockRuntimeClient，运行中不会重新读取。

## Commands
```bash
npm start                    # 一键启动
npm run test:providers       # 验证所有 AI provider 连通性
npm run test:providers -- bedrock  # 验证单个
```

## Notes
- Date: 2026-04-27
- Vite 端口: 5174, Proxy 端口: 3001
- `.env` 中的 `VITE_` 前缀变量会被 Vite 注入前端代码
