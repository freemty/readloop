# ReadLoop

> AI-in-the-loop reading system — EPUB/PDF reader with AI guide, Q&A, and position-anchored annotations.

## Quick start

```bash
npm start          # One command: starts both Vite dev server + proxy
```

Or separately:

```bash
npm run dev        # Vite dev server (http://localhost:5174/)
npm run proxy      # Proxy: Z-Library + Bedrock + wiki (http://localhost:3001/)
```

## Architecture

Pure frontend SPA (React 18 + TypeScript + Vite). No backend except `proxy.mjs` for:
- Z-Library search/download (via Clash proxy at 127.0.0.1:7890)
- AWS Bedrock Claude (SigV4 auth)
- Wiki file I/O (`POST /api/wiki/init`, `GET /api/wiki/read`, `POST /api/wiki/update`)
- Local file scanning

### Multi-turn conversations

AI conversations retain full chat history. `buildAskContext()` threads conversation history into the messages array (system → history → new user message). Capped at 20 turns (40 messages) to protect context window.

### Book Wiki (knowledge graph)

Each book gets an auto-generated Obsidian-compatible wiki stored in `~/readloop/wikis/{book-slug}/`. Initializes asynchronously on book open (AI extracts concepts per chapter). After each conversation, a judgment AI call decides whether to update the wiki. Wiki context is injected into `buildAskContext()` so the AI builds on the reader's accumulated understanding.

## Key files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component, all state orchestration |
| `src/epub/EpubViewer.tsx` | EPUB reader (epub.js, continuous scroll) |
| `src/pdf/PdfViewer.tsx` | PDF reader (pdfjs-dist v5) |
| `src/ai/client.ts` | LLM client (Bedrock/OpenAI/Claude streaming) |
| `src/ai/context.ts` | Builds messages array for AI calls (wiki context, conversation history, trimming) |
| `src/ai/prompts.ts` | System prompts + AI mode definitions |
| `src/hooks/useAi.ts` | React hook: askAi, getGuide, askWithImage (accepts full ChatMessage[]) |
| `src/wiki/initWiki.ts` | Book wiki initialization: chapter extraction → AI scan → markdown files |
| `src/wiki/updateWiki.ts` | Post-conversation wiki update via AI judgment call |
| `src/wiki/readWiki.ts` | Read wiki nodes from proxy for context injection |
| `src/wiki/prompts.ts` | Wiki-specific system prompts (init + update judgment) |
| `src/wiki/slugify.ts` | Deterministic slug generation for wiki file names |
| `src/wiki/types.ts` | Wiki TypeScript types (WikiMeta, InitChapterResult, UpdateJudgment) |
| `src/annotations/` | AnnotationList, AnnotationMarkers (💬 badges), SelectionMenu |
| `src/db/store.ts` | IndexedDB (books, annotations, covers, files) |
| `src/bookshelf/` | Book management, Z-Library search, local scan |
| `src/settings/SettingsModal.tsx` | API config with presets |
| `src/config.ts` | Proxy base URL + wiki base URL constants |
| `proxy.mjs` | Node proxy for Z-Library + Bedrock + wiki file I/O + local files |

## AI providers

| Provider | Config | Best for |
|----------|--------|----------|
| SiliconFlow (default) | `api.siliconflow.cn`, key in `.env` | Claude models (优先) |
| Bedrock Claude | AWS creds in `.env`, proxy at :3001 | Claude Opus/Sonnet via AWS |
| Yunstorm (Azure proxy) | `gpt.yunstorm.com`, key in `.env` | GPT models (优先) |
| OpenAI / Claude Direct | User API key | Direct access |

Model IDs (Bedrock, us-east-2): Sonnet 4.6 = `us.anthropic.claude-sonnet-4-6`, Opus 4.6 = `us.anthropic.claude-opus-4-6-v1`

## IndexedDB schema (v3)

| Store | Key | Purpose |
|-------|-----|---------|
| books | id | Book metadata |
| annotations | id (index: byBook) | Highlights, notes, conversations |
| guideCache | id (index: byBook) | AI guide card cache |
| fileData | bookId | PDF/EPUB file data |
| coverImages | bookId | EPUB cover images |

## Design system

Warm reading theme (Apple Books inspired):
- Colors: `--bg-warm` #FAF8F5, `--accent` #C06030, `--text-primary` #2C2C2C
- Fonts: Georgia serif for content, system-ui for UI
- Animations: Framer Motion
- Icons: Lucide React

## Docs

| Path | Purpose |
|------|---------|
| `docs/superpowers/specs/2026-04-07-book-wiki-design.md` | Book Wiki design spec — data model, init flow, update loop, context injection |
| `docs/superpowers/plans/2026-04-07-book-wiki-plan.md` | Book Wiki implementation plan (8 tasks, TDD) |
| `docs/superpowers/plans/2026-04-09-multi-turn-conversation.md` | Multi-turn conversation implementation plan (5 tasks, TDD) |

## Knowhow

- `docs/knowhow/infrastructure/` — AI provider 配置、服务器、网络
- `docs/knowhow/toolchain/` — CLI 工具、框架、构建系统
- `docs/knowhow/debug-solutions/` — 错误调查路径和修复方案
- `docs/knowhow/runbooks/` — 开发环境启动、部署等操作手册

## Environment

- `.env` — AWS creds, Yunstorm/SiliconFlow API keys (not committed)
- Clash proxy at `127.0.0.1:7890` required for Z-Library and Bedrock
