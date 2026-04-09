# ReadLoop

**AI-in-the-loop 严肃阅读系统**

读经典读不进去？AI 总结又太浅？ReadLoop 是一个 AI-in-the-loop 的阅读伙伴——逐段导读、随时提问、对话钉在原文上。

## 为什么做这个

读《国富论》这种书，16世纪英国西班牙的事你根本读不进去。让 AI 给你摘要？等于什么都没读。

你需要的是**一边读一边有人讲**，不懂就问，问完继续读。所有对话留在原文的精确位置，下次翻到这里还能接上。

ReadLoop 就干这个。

## 能干什么

**读书**：EPUB 连续滚动 + PDF 文字层选中。Z-Library 搜书下载一条龙，也能扫本地 Downloads 里的书。

**AI 对话**：选中文字直接问 AI，或者在右侧面板随时输入（自动带当前页上下文）。支持多轮追问——AI 记得你之前问了什么，不用每次重复背景。导读模式开了以后 AI 逐段生成卡片——这段讲什么、历史背景、跟今天有什么关系。PDF 影印本选不了字？截图框一块发给 AI，Vision 能看。

**批注**：四色高亮、笔记、对话记录全部锚定在原文位置。聊过的地方自动标出橙色虚线 + 💬 标签，点一下就能重新打开之前的对话。

**知识图谱**：每本书自动生成 Obsidian 兼容的 wiki——打开书的时候 AI 逐章提取核心概念，后续对话中有价值的内容自动更新进去。下次问问题时 AI 会参考你之前积累的理解。wiki 文件存在本地 `wikis/` 目录，可以直接用 Obsidian 打开浏览。

**数据全在本地**：IndexedDB 存书、存批注、存封面。一键 JSON 导出，不依赖任何云服务。

## 技术栈

React 18 + TypeScript + Vite。EPUB 用 epub.js，PDF 用 pdfjs-dist v5。Tailwind CSS + Framer Motion。存储是 IndexedDB（idb 封装）。AI 支持 Bedrock Claude / OpenAI / Yunstorm，通过一个 Node.js proxy 转发。

## 跑起来

```bash
git clone https://github.com/freemty/readloop.git
cd readloop && npm install

cp .env.example .env
# 填 AWS 凭证和 API key

npx vite --host          # 前端
node proxy.mjs           # 代理（Z-Library + Bedrock）
```

打开 http://localhost:5173/

## 环境变量

```bash
# AWS Bedrock（Claude）
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-northeast-1

# Yunstorm（可选）
VITE_YUNSTORM_API_KEY=your_yunstorm_key
```

## AI 提供商

Bedrock Claude 是默认的，走 AWS AK/SK。也支持 Yunstorm（OpenAI 兼容格式）、OpenAI 直连、Anthropic API 直连。Settings 页面切换，支持自定义 Base URL。

## 代理

`proxy.mjs` 做三件事：Z-Library 搜索下载（走 `127.0.0.1:7890` 代理）、Bedrock SigV4 签名转发（浏览器搞不了这个）、本地文件扫描（有路径校验）。

## 许可

MIT
