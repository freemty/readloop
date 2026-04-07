# ReadLoop

> AI-in-the-loop reading system — EPUB/PDF reader with AI guide, Q&A, and position-anchored annotations.

## Quick start

```bash
# Dev server
tmux new-session -d -s readloop -c ~/readloop "npx vite --host"

# Proxy (Z-Library + Bedrock)
tmux new-session -d -s zlib-proxy -c ~/readloop "set -a; source .env; set +a; node proxy.mjs"
```

Open http://localhost:5174/

## Architecture

Pure frontend SPA (React 18 + TypeScript + Vite). No backend except `proxy.mjs` for:
- Z-Library search/download (via Clash proxy at 127.0.0.1:7890)
- AWS Bedrock Claude (SigV4 auth)
- Local file scanning

## Key files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component, all state orchestration |
| `src/epub/EpubViewer.tsx` | EPUB reader (epub.js, continuous scroll) |
| `src/pdf/PdfViewer.tsx` | PDF reader (pdfjs-dist v5) |
| `src/ai/client.ts` | LLM client (Bedrock/OpenAI/Claude streaming) |
| `src/ai/prompts.ts` | System prompts + AI mode definitions |
| `src/db/store.ts` | IndexedDB (books, annotations, covers, files) |
| `src/bookshelf/` | Book management, Z-Library search, local scan |
| `src/settings/SettingsModal.tsx` | API config with presets |
| `proxy.mjs` | Node proxy for Z-Library + Bedrock + local files |

## AI providers

| Provider | Config |
|----------|--------|
| Bedrock Claude (default) | AWS creds in `.env`, proxy at :3001 |
| Yunstorm (Horay) | `gpt.yunstorm.com`, key in `.env` |
| OpenAI / Claude Direct | User API key |

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

## Environment

- `.env` — AWS creds, Yunstorm API key (not committed)
- Clash proxy at `127.0.0.1:7890` required for Z-Library and Bedrock
