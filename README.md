# ReadLoop

**AI 始终在环路的严肃阅读系统**

读经典读不进去？AI 总结又太浅？ReadLoop 填补两者之间的空白——一个 AI 始终在环路的阅读伙伴，帮你逐段导读、随时提问、把思考痕迹钉在原文上。

## 为什么需要 ReadLoop

读《国富论》这种书，16世纪英国西班牙的事你根本读不进去。但让 AI 给你一个摘要？等于什么都没读。

你需要的是**一边读一边有人讲**，遇到不懂的随时问，问完继续读，所有对话都留在原文的精确位置上。

ReadLoop 就是干这个的。

## 功能

### 阅读
- **EPUB 阅读器** — 连续滚动、字体大小调节、章节导航、暖色护眼主题
- **PDF 阅读器** — 缩放、翻页、文字层选中
- **Z-Library 集成** — 搜索 → 下载 → 自动导入，一条龙
- **本地书籍扫描** — 自动发现 Downloads/Documents/Desktop 里的 EPUB/PDF

### AI 对话
- **选中提问** — 选中任意文字，弹出菜单点 "Ask AI" 直接聊
- **当前页提问** — 右侧面板随时输入，自动带上当前页内容作为上下文
- **导读模式** — 开启后 AI 自动逐段生成导读卡片：这段讲什么、历史背景、与今天的关联
- **PDF 截图问 AI** — 影印本文字选不了？框选区域截图直接发给 AI（支持 Vision）
- **三种对话风格** — Intellectual（知识伙伴）/ Socratic（追问式）/ ELI5（简单直白）

### 批注
- **高亮** — 四种颜色，EPUB 中即时渲染
- **笔记** — 手写备注锚定在原文位置
- **对话记录** — 每次 AI 问答自动保存为批注
- **批注跳转** — 左侧点击批注，自动滚动到原文位置

### 数据
- **IndexedDB 本地存储** — 书籍、批注、对话、封面全部存在浏览器本地
- **JSON 导出** — 一键导出所有数据备份
- **EPUB 封面提取** — 书架自动显示真实封面

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite |
| EPUB 渲染 | epub.js（连续滚动模式） |
| PDF 渲染 | pdfjs-dist v5（官方 TextLayer） |
| 样式 | Tailwind CSS + CSS Variables |
| 动画 | Framer Motion |
| 图标 | Lucide React |
| 存储 | IndexedDB（via idb） |
| AI | Claude (Bedrock) / OpenAI / Yunstorm 等 |
| 代理 | Node.js proxy（Z-Library + Bedrock） |

## 快速开始

```bash
# 克隆
git clone https://github.com/freemty/readloop.git
cd readloop

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 AWS 凭证和 API key

# 启动开发服务器
npx vite --host

# 启动代理（Z-Library 搜索 + Bedrock AI）
node proxy.mjs
```

打开 http://localhost:5173/

## 环境变量

创建 `.env` 文件：

```bash
# AWS Bedrock（Claude）
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-northeast-1

# Yunstorm（可选）
VITE_YUNSTORM_API_KEY=your_yunstorm_key
```

## AI 提供商

| 提供商 | 说明 |
|--------|------|
| **Bedrock Claude**（默认） | 通过 AWS SDK，需要 AK/SK |
| **Yunstorm** | OpenAI 兼容格式，一键预设 |
| **OpenAI** | 直连 API |
| **Claude Direct** | Anthropic API 直连 |

在 Settings 页面一键切换，支持自定义 Base URL。

## 代理说明

`proxy.mjs` 是一个轻量 Node.js 代理，负责：

1. **Z-Library** — 搜索和下载需要通过网络代理（默认 `127.0.0.1:7890`）
2. **Bedrock Claude** — AWS SigV4 签名不能在浏览器端完成，通过代理转发
3. **本地文件扫描** — 扫描指定目录的 EPUB/PDF 文件（有路径安全校验）

## 设计理念

- **暖色阅读主题** — 灵感来自 Apple Books，Georgia 衬线体，护眼配色
- **丝滑动画** — Framer Motion 驱动的页面切换、弹窗、列表入场
- **最少打扰** — AI 默认静默，你需要时它才出现

## 许可

MIT
