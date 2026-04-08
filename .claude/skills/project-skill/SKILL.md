# SKILL.md -- ReadLoop

**v0 -- auto-generated bootstrap, review recommended.**

---

## Project Overview & Current State

**Name:** ReadLoop
**Repo:** `/Users/sum_young/readloop`
**Description:** AI-in-the-loop reading system -- EPUB/PDF reader with AI guide, Q&A, and position-anchored annotations.

**Motivation:** Reading difficult texts (classical literature, political commentary, dense non-fiction) is hard because context accumulates across chapters but human memory doesn't. Existing options are two extremes: struggle alone or read AI summaries (which means you didn't really read). ReadLoop fills the gap -- an AI companion that reads alongside you, answering questions anchored to the exact text position, generating paragraph-by-paragraph guides, and maintaining a per-book knowledge wiki that evolves with your conversations.

**Current Stage:** Active development, personal tool. 74 commits on `main`. Core reading + AI features are fully functional. The most recent major feature is the **Book Wiki** system (per-book Obsidian-compatible knowledge graph that initializes on book open and evolves through conversation). No public release yet. Version `0.0.0` in package.json.

**Key Capabilities:**
- EPUB reader (epub.js, continuous scroll) and PDF reader (pdfjs-dist v5)
- Z-Library search/download integration
- Local book scanner (Downloads/Documents/Desktop)
- Text selection -> Ask AI / Highlight / Note
- AI guide mode (auto-generated paragraph-by-paragraph reading companion cards)
- PDF screenshot-to-AI (Vision API for scanned documents)
- Three verbosity modes: concise / normal / verbose
- Per-book wiki: Obsidian-compatible markdown files, auto-initialized from EPUB text, updated through conversations
- Markdown rendering in AI responses
- PWA support
- Full JSON data export

---

## Architecture

### High-Level

Pure frontend SPA (React 19 + TypeScript + Vite). No backend server except a lightweight Node.js proxy (`proxy.mjs`) that handles:
1. Z-Library search/download (via Clash proxy at `127.0.0.1:7890`)
2. AWS Bedrock Claude API (SigV4 auth can't run in browser)
3. Local file scanning (filesystem access)
4. Wiki file I/O (read/write Obsidian-compatible markdown files to disk)

### Directory Structure

```
readloop/
├── src/
│   ├── App.tsx                  # Root component, ALL state orchestration
│   ├── main.tsx                 # Entry point
│   ├── types.ts                 # Core types: Book, Annotation, Message, PositionAnchor, GuideCache
│   ├── config.ts                # Constants: PROXY_BASE, WIKI_BASE
│   ├── ai/
│   │   ├── client.ts            # Multi-provider LLM client (Bedrock/OpenAI/Claude, SSE streaming)
│   │   ├── context.ts           # buildAskContext() and buildGuideContext() -- prompt assembly
│   │   ├── prompts.ts           # System prompts, AI mode definitions
│   │   ├── AiPanel.tsx          # Right panel: guide cards + conversation + input
│   │   ├── Conversation.tsx     # Conversation message rendering
│   │   └── GuideCard.tsx        # AI guide card component
│   ├── bookshelf/
│   │   ├── Bookshelf.tsx        # Book grid with import/delete
│   │   ├── BookCard.tsx         # Individual book card with cover
│   │   ├── ZlibSearch.tsx       # Z-Library search modal
│   │   └── LocalBooks.tsx       # Local filesystem book scanner
│   ├── epub/
│   │   └── EpubViewer.tsx       # EPUB reader (epub.js, continuous scroll)
│   ├── pdf/
│   │   ├── PdfViewer.tsx        # PDF reader (pdfjs-dist v5)
│   │   ├── paragraph.ts         # Paragraph detection from PDF text items
│   │   ├── anchor.ts            # Position anchor creation
│   │   └── ScreenshotTool.tsx   # Region capture for Vision API
│   ├── annotations/
│   │   ├── AnnotationList.tsx   # Sidebar annotation list
│   │   ├── AnnotationMarkers.tsx # Visual markers in reader
│   │   └── SelectionMenu.tsx    # Floating menu on text selection
│   ├── hooks/
│   │   ├── useAnnotations.ts    # CRUD for annotations (IndexedDB-backed)
│   │   ├── useAi.ts             # AI call orchestration (streaming state management)
│   │   └── useGuideCache.ts     # Guide card cache management
│   ├── layout/
│   │   ├── Sidebar.tsx          # Left sidebar (annotations, navigation)
│   │   └── Toolbar.tsx          # Top toolbar (guide toggle, AI mode, settings)
│   ├── settings/
│   │   └── SettingsModal.tsx    # API provider config with presets
│   ├── db/
│   │   └── store.ts             # IndexedDB singleton (idb library, schema v3)
│   ├── ui/
│   │   └── styles.ts            # Shared CSS-in-JS style constants
│   └── wiki/
│       ├── types.ts             # Wiki-specific types
│       ├── slugify.ts           # Deterministic slug generation for file names
│       ├── prompts.ts           # Wiki init/update system prompts, wiki context builder
│       ├── initWiki.ts          # Full-book scan -> AI extract per chapter -> write markdown
│       ├── updateWiki.ts        # Post-conversation -> lightweight AI judgment -> wiki update
│       ├── readWiki.ts          # Read wiki nodes from proxy for context injection
│       └── __tests__/           # 5 test files covering all wiki modules
├── tests/                       # Core unit tests (anchor, paragraph, context, store, client)
├── scripts/
│   └── init-wiki.mjs            # CLI script for manual wiki initialization
├── docs/
│   └── superpowers/
│       ├── specs/               # Book wiki design spec
│       └── plans/               # Book wiki implementation plan
├── proxy.mjs                    # Node.js proxy
├── wikis/                       # Generated wiki data (gitignored)
├── vite.config.ts               # Vite + PWA + vitest config
└── package.json                 # React 19, TypeScript 5.9, Vite 8, vitest 4
```

### Data Flow

```
User reads book -> selects text -> asks AI
  |
  v
App.tsx orchestrates all state
  |-> useAi hook: buildAskContext() + createAiClient()
  |     |-> context.ts: assembles system prompt + user prompt (with wiki context if available)
  |     |-> client.ts: sends to provider (Bedrock proxy / OpenAI / Claude direct)
  |     |-> SSE streaming: chunks rendered in real-time
  |
  |-> Response complete:
  |     |-> Annotation saved to IndexedDB (conversation type)
  |     |-> Wiki update triggered (background, non-blocking):
  |           |-> readWiki: fetch existing concept nodes
  |           |-> AI judgment call: "is this worth saving?"
  |           |-> If yes: write updates to wikis/{book-slug}/ via proxy
  |
  |-> Next question: wiki context injected into prompt
        |-> readChapterConcepts() -> buildWikiContextBlock()
        |-> AI sees what reader has already discussed
```

### Storage

| Layer | Technology | Purpose |
|-------|-----------|---------|
| IndexedDB (v3) | `idb` library | Books, annotations, guide cache, file data, cover images |
| Filesystem | via proxy.mjs | Wiki markdown files at `~/readloop/wikis/{book-slug}/` |
| localStorage | native | AI mode preference, settings |

### AI Provider Architecture

The `client.ts` provides a unified `AiClient` interface with a single `chat()` method. Three implementations:
- **chatBedrock**: AWS Bedrock via proxy.mjs (SigV4 auth server-side), SSE streaming
- **chatOpenAI**: OpenAI-compatible format (also used for Yunstorm)
- **chatClaude**: Anthropic API direct (with `anthropic-dangerous-direct-browser-access` header)

All use a shared `readSSEStream()` helper for parsing Server-Sent Events.

---

## System Cognition

### What Works

1. **Core reading experience** -- EPUB continuous scroll and PDF rendering are stable. Text selection works across both formats with a unified `handleTextSelect` callback.
2. **AI conversation anchoring** -- Every AI conversation is saved as an annotation at the exact text position. Users can click annotations to jump back to context.
3. **Multi-provider AI** -- Seamless switching between Bedrock/OpenAI/Claude/Yunstorm. Streaming works for all providers.
4. **Wiki system** -- Auto-initializes on book open (EPUB only), generates Obsidian-compatible markdown, feeds context back into conversations. The `worth_saving` judgment prevents wiki bloat from casual chat.
5. **Local book scanning** -- Finds EPUB/PDF in common directories with path traversal protection.

### What Doesn't / Known Limitations

1. **App.tsx god component** -- `App.tsx` holds ALL state and ALL handlers. This is the single biggest architectural debt. State should be split into contexts or a state management library.
2. **Wiki only works for EPUB** -- PDF chapter extraction is not implemented (`extractChaptersFromBook` returns `[]` for PDF).
3. **No conversation history** -- `useAi` hook sends each message as a fresh system+user pair. Multi-turn context is only preserved through wiki injection, not native conversation history.
4. **No abort for AI requests** -- `abortRef` exists but doesn't actually cancel the fetch. Only prevents UI updates.
5. **Proxy required for all AI** -- Even Bedrock (which needs SigV4), which means the proxy must be running. No graceful fallback if proxy is down.
6. **No error recovery** -- Wiki init failures are silently caught. If it fails mid-chapter, partial wiki state persists.

### Validated Hypotheses

- **Position anchoring via text fingerprint works** -- The `PositionAnchor` system (`textPrefix`, `selectedText`, `textSuffix`, `pageHint`) reliably re-locates annotations even after EPUB reflows.
- **AI guide mode is useful but expensive** -- One API call per paragraph scroll. Guide cache prevents re-fetching.
- **Wiki `worth_saving` filter is essential** -- Without it, every "what does this mean?" would create wiki entries. The lightweight judgment call keeps the wiki focused.

### Active Assumptions

- Users have Clash proxy running at `127.0.0.1:7890` for Z-Library and Bedrock
- AWS credentials are valid and have Bedrock access in `ap-northeast-1`
- EPUB files have navigable TOC for chapter extraction
- Single user, single browser -- no multi-device sync

---

## Technical Archive

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Pure SPA, no backend | Minimize infrastructure; all data in browser IndexedDB |
| IndexedDB via `idb` | Typed wrapper over raw IndexedDB; singleton pattern for connection reuse |
| epub.js for EPUB | Only maintained EPUB renderer for web; continuous scroll mode |
| pdfjs-dist v5 | Official Mozilla library; TextLayer for selection |
| Node.js proxy instead of serverless | Bedrock SigV4 can't run in browser; Z-Library needs server-side proxy |
| Framer Motion for animations | Smooth page transitions and component enter/exit |
| SSE streaming for all providers | Consistent streaming UX; shared `readSSEStream()` reduces code |
| Wiki as markdown files on disk | Obsidian compatibility; user can browse outside ReadLoop; no extra DB |
| Wiki init per-chapter (serial) | Cumulative concept list prevents duplicates across chapters |
| `worth_saving` judgment | Prevents wiki bloat; most casual chats produce no wiki updates |
| React 19 + Vite 8 | Latest stable versions; fast HMR |
| Tailwind CSS v4 | Utility-first styling; CSS variables for theme tokens |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|-------------|
| Backend API server | Overkill for single-user tool; adds deployment complexity |
| SQLite/WASM for storage | IndexedDB is simpler for browser-only; no WASM loading needed |
| PDF.js viewer component (react-pdf) | Too opinionated; raw pdfjs-dist gives more control over TextLayer |
| Cross-book wiki merging | Deferred to future; per-book scope is simpler to maintain |
| selfos integration | Explicitly out of scope for wiki v1; separate system |
| Wiki visualization in ReadLoop UI | User can use Obsidian; building a graph UI is a separate project |

### Parameter Choices

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Chapter text cap | 8000 chars | Fits within context window for wiki init |
| Wiki concept count | 3-8 per chapter | Prompt instructs this range; avoids over-extraction |
| Confidence levels | low / medium / high | Simple 3-tier; bumped through conversation depth |
| Max tokens (Bedrock) | 4096 | Sufficient for guide cards and conversation replies |
| IndexedDB version | 3 | v1: books+annotations+guide, v2: fileData, v3: coverImages |
| Local scan depth | 4 directories | Prevents runaway scanning of deep directory trees |
| Selection text cap | 500 chars | For `selectedText` in `handleAskCurrentPage`; keeps prompt compact |

---

## Engineering Lessons

> APPEND-ONLY section. Each entry includes date and context.

### 2026-04-05: EPUB text selection requires iframe mouseup hook

EPUB renders inside an iframe (epub.js). The `selected` event from epub.js is unreliable. The fix was to directly attach a `mouseup` listener to the iframe's document and use `window.getSelection()` inside the iframe context.

### 2026-04-05: EPUB selection rects need coordinate offset

Selection `DOMRect` values from inside an EPUB iframe are relative to the iframe's viewport, not the main page. Must offset by the iframe's bounding rect to position the floating selection menu correctly.

### 2026-04-05: `range.surroundContents()` breaks on partial selections

When a text selection spans across DOM nodes, `surroundContents()` throws. The fix is to use `extractContents()` + create a wrapper span + insert.

### 2026-04-06: Temporal Dead Zone in state ordering

`currentParagraphs` state was declared after `handleAskCurrentPage` which referenced it, causing a TDZ crash. State declarations must come before callbacks that reference them.

### 2026-04-06: Object URL memory leak with covers

`URL.createObjectURL()` for EPUB covers was never revoked. Added explicit `URL.revokeObjectURL()` on cover reload and component unmount.

### 2026-04-07: EPUB highlights must re-apply when annotations change

EPUB re-renders don't automatically re-apply highlight marks. Added an effect that watches `annotations` and re-applies all highlights.

### 2026-04-07: Local file path traversal security

The `/api/local-file` proxy endpoint needed validation that requested paths are within allowed directories AND have allowed extensions. Without this, arbitrary file read was possible.

### 2026-04-07: Wiki slug traversal prevention

The wiki proxy endpoints validate slugs with `isValidSlug()` -- rejects path separators (`/`, `\`) and double dots (`..`), then verifies the resolved path stays within `WIKI_ROOT`.

### 2026-04-08: Wiki `chapter_summary` vs `summary` field mismatch

The AI init prompt asked for `chapter_summary` in the JSON output but `InitChapterResult` had a `summary` field. The AI would sometimes return one, sometimes the other. Fixed by aligning the prompt JSON schema with the TypeScript interface.

### 2026-04-08: Externally initialized wiki detection

If wiki was initialized via CLI script (`init-wiki.mjs`), the app wouldn't detect it because `book.wikiReady` was false in IndexedDB. Added a check on book open: if wiki directory exists and has files, mark book as wiki-ready.

### 2026-04-08: EPUB/PDF annotation click handlers need refs for stale closure

Click handlers registered in EPUB iframe `content.register()` hook capture initial props. Must use `useRef` for `annotations` and `onAnnotationClick` to always access latest values. Same pattern needed for PDF overlay click handlers.

### 2026-04-08: PDF text layer uses CSS transforms, not offset positioning

pdfjs text layer spans are positioned via CSS `transform` + absolute `left`/`top`. Using `span.offsetWidth` doesn't account for `scaleX` transforms. Must use `getBoundingClientRect()` relative to the text layer container for accurate overlay positioning.

---

## Quick Reference

### Commands

```bash
# Dev server
tmux new-session -d -s readloop -c ~/readloop "npx vite --host"

# Proxy (Z-Library + Bedrock + Wiki I/O)
tmux new-session -d -s zlib-proxy -c ~/readloop "set -a; source .env; set +a; node proxy.mjs"

# Run all tests
cd ~/readloop && npx vitest run

# Run wiki tests only
cd ~/readloop && npx vitest run src/wiki/

# Type check
cd ~/readloop && npx tsc --noEmit

# Build
cd ~/readloop && npx tsc -b && npx vite build

# Manual wiki init (CLI)
cd ~/readloop && set -a; source .env; set +a; node scripts/init-wiki.mjs

# Lint
cd ~/readloop && npx eslint .
```

### URLs

| Service | URL |
|---------|-----|
| Dev server | http://localhost:5174/ |
| Proxy | http://localhost:3001 |
| Bedrock chat | POST http://localhost:3001/api/bedrock/chat |
| Wiki init | POST http://localhost:3001/api/wiki/init |
| Wiki read | GET http://localhost:3001/api/wiki/read?slug=X&path=Y |
| Wiki update | POST http://localhost:3001/api/wiki/update |
| Z-Library search | GET http://localhost:3001/api/search?q=X&ext=pdf |
| Local books | GET http://localhost:3001/api/local-books |
| Local file | GET http://localhost:3001/api/local-file?path=X |

### Key Paths

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Root component, all state |
| `proxy.mjs` | Node proxy server |
| `src/ai/client.ts` | LLM client |
| `src/ai/context.ts` | Prompt assembly |
| `src/db/store.ts` | IndexedDB store |
| `src/wiki/` | Wiki system modules |
| `wikis/` | Generated wiki data (gitignored) |
| `.env` | AWS creds + API keys (gitignored) |
| `docs/superpowers/specs/` | Design specs |
| `docs/superpowers/plans/` | Implementation plans |

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `AWS_ACCESS_KEY_ID` | For Bedrock | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | For Bedrock | AWS IAM secret key |
| `AWS_REGION` | For Bedrock | Default: `ap-northeast-1` |
| `VITE_YUNSTORM_API_KEY` | Optional | Yunstorm (Horay) API key |
| `YUNSTORM_API_KEY` | Optional | Server-side Yunstorm key |
