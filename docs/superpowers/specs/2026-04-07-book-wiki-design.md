# Book Wiki: Per-Book Knowledge Graph for ReadLoop

**Date**: 2026-04-07
**Status**: Approved
**Scope**: ReadLoop only (no selfos integration in v1)

## Problem

Reading difficult texts (e.g. political commentary, classical literature) is hard because context accumulates across chapters but human memory doesn't. Current ReadLoop AI conversations are stateless — the AI in chapter 10 doesn't know what you discussed in chapter 1.

## Solution

Each book gets its own wiki — a set of Obsidian-compatible markdown files that the AI maintains automatically. The wiki initializes when a book is imported (AI scans the full text) and evolves as the user chats during reading. The user never sees the wiki inside ReadLoop; they can browse it in Obsidian if they want.

The wiki serves two purposes:
1. **AI memory** — conversations improve over time because the AI knows what the user already understands
2. **Knowledge artifact** — after finishing the book, the user has a structured knowledge graph of their reading journey

## Data Model

### Node Types

| Type | Directory | Description |
|------|-----------|-------------|
| `book` | `index.md` | Book metadata + thematic overview |
| `chapter` | `chapters/` | Chapter summary + key concept pointers |
| `concept` | `concepts/` | Core ideas, arguments, themes |
| `entity` | `entities/` | People, organizations, places |
| `conversation` | `conversations/` | Distilled conversation insights (not full transcripts) |

### Frontmatter Schema

All nodes share:
```yaml
---
title: "Node Title"
type: book | chapter | concept | entity | conversation
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

**Concept-specific fields**:
```yaml
chapter: "前奏 大国幻象"          # Chapter where first introduced
confidence: low | medium | high    # Evolves with conversation depth
related: ["concepts/x", "entities/y"]
sources: ["conversations/ch01-001.md"]
```

**Entity-specific fields**:
```yaml
entity_type: person | organization | place
chapter: "前奏 大国幻象"
related: ["concepts/x"]
```

**Conversation-specific fields**:
```yaml
chapter: "前奏 大国幻象"
anchor: { paragraph: 3, textPrefix: "活到2022年初..." }
concepts_updated: ["concepts/大国幻象与经济现实的落差"]
```

### File Structure

```
~/readloop/wikis/{book-slug}/
├── index.md
├── chapters/
│   ├── 01-前奏-大国幻象.md
│   └── ...
├── concepts/
│   ├── 大国幻象与经济现实的落差.md
│   └── ...
├── entities/
│   ├── 习近平.md
│   └── ...
└── conversations/
    ├── ch01-001.md
    └── ...
```

Cross-references use `[[page-name]]` syntax (Obsidian-compatible).

## Initialization Flow

Triggered asynchronously after book import. Does not block reading.

1. Extract full text from EPUB/PDF
2. Split by chapters using TOC structure
3. For each chapter, call AI to extract:
   - Chapter summary
   - Concepts (title, summary, related)
   - Entities (name, type, role)
4. AI sees cumulative concept list from prior chapters (dedup via prompt injection)
5. Write markdown files via proxy endpoint
6. Mark `book.wikiReady = true` in IndexedDB

**Chunking**: One AI call per chapter. For a 30-chapter book ≈ 30 API calls.

**Initial confidence**: All nodes start at `confidence: low` (AI-only, no user discussion yet).

**AI output format** (per chapter):
```json
{
  "chapter_summary": "...",
  "concepts": [
    { "title": "...", "slug": "...", "summary": "...", "related": ["..."] }
  ],
  "entities": [
    { "name": "...", "slug": "...", "type": "person|org|place", "role": "..." }
  ]
}
```

## Conversation → Wiki Update Loop

After each AI reply completes, a background process evaluates and updates the wiki.

### Trigger

`handleSendMessage()` completion → async `updateWiki()` call (non-blocking).

### Process

1. Assemble context: current conversation + relevant wiki nodes
2. Lightweight AI call (Haiku-tier) returns update instructions:
   ```json
   {
     "worth_saving": true,
     "updates": [
       { "action": "update_concept", "target": "concepts/x.md", "delta": "..." },
       { "action": "create_concept", "title": "...", "summary": "...", "related": [...] },
       { "action": "create_entity", "name": "...", "type": "...", "role": "..." },
       { "action": "bump_confidence", "target": "concepts/x.md", "to": "medium" },
       { "action": "add_relation", "from": "concepts/a.md", "to": "concepts/b.md" }
     ],
     "conversation_summary": "..."
   }
   ```
3. Proxy executes file operations (create / append / modify frontmatter)
4. Save conversation distillation to `conversations/chXX-NNN.md`

### Skip Criteria

Most casual chat rounds produce `worth_saving: false`. Only conversations that generate new insights, deepen understanding, or reveal connections trigger updates.

## Wiki → Conversation Context Enhancement

Wiki feeds back into conversation quality.

### Modified `buildAskContext()`

When `book.wikiReady === true`:

1. Identify current chapter from reading position
2. Read chapter node → get list of associated concepts
3. Read top 2-3 most relevant concept nodes (by chapter proximity + textual relevance)
4. Read any prior conversation distillations for this chapter
5. Inject into system prompt:
   ```
   The reader has previously discussed the following concepts in this book:
   - "大国幻象" (confidence: medium): [summary + key insights from prior conversations]
   - "疫情叙事" (confidence: low): [initial AI understanding, no user discussion yet]

   Build on their existing understanding. Don't repeat what they already know.
   ```

**Token budget**: ~500 tokens for wiki context injection. Negligible relative to total context.

## Technical Changes

### New Files

```
src/wiki/
├── initWiki.ts        # Full-book scan → structured JSON → proxy writes
├── updateWiki.ts      # Post-conversation evaluation → proxy writes
└── readWiki.ts        # Read wiki nodes for context injection
```

### Modified Files

| File | Change |
|------|--------|
| `proxy.mjs` | Add 3 endpoints: `POST /api/wiki/init`, `GET /api/wiki/read`, `POST /api/wiki/update` |
| `src/types.ts` | Add `wikiSlug?: string` and `wikiReady?: boolean` to `Book` interface |
| `src/db/store.ts` | No schema version bump needed (just new optional fields on Book) |
| `src/App.tsx` | After book open: trigger `initWiki()` if not ready. After message: trigger `updateWiki()` |
| `src/ai/context.ts` | `buildAskContext()` reads wiki nodes when available |
| `src/ai/prompts.ts` | Add wiki context template to system prompt |

### Relationship: Wiki Conversations vs Annotation Conversations

These are two separate things:

- **`Annotation.conversation[]`** (IndexedDB): The full verbatim chat messages, anchored to a text selection. This is the existing ReadLoop feature. Unchanged.
- **`wikis/{book}/conversations/chXX-NNN.md`** (markdown): A distilled summary of the key insight from that conversation. Created by the update loop. Used for wiki context injection.

The update loop reads from `Annotation.conversation[]` and writes a distilled version to the wiki. The full conversation stays in IndexedDB; only the insight enters the wiki.

### Unchanged

- EPUB/PDF rendering
- Annotation system (highlights, notes remain independent)
- Settings, theme, Z-Library integration
- GuideCard (continues to work as-is; could optionally use wiki in future)

## Token Economics

| Operation | Model | Frequency | Est. Cost |
|-----------|-------|-----------|-----------|
| Init (per chapter) | Sonnet | Once per book | ~30 calls × ~$0.02 = ~$0.60/book |
| Update judgment | Haiku | Per conversation turn | ~500 in + ~200 out ≈ $0.0003/turn |
| Context injection | N/A (read only) | Per conversation turn | 0 (just file reads) |

## Future (Out of Scope for v1)

- Cross-book wiki merging
- selfos integration (export book wiki → selfos sources/concepts)
- Wiki visualization in ReadLoop UI
- Semantic search across book wikis
- Guide mode driven by wiki nodes instead of ad-hoc generation
