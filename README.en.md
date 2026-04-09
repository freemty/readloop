# ReadLoop

**AI-in-the-loop reading system**

Can't get through the classics? AI summaries feel like cheating? ReadLoop sits between the two — an AI reading companion that guides you paragraph by paragraph, answers questions on the spot, and pins every conversation to the exact text position.

## Why

Reading *The Wealth of Nations*, you hit 16th-century Anglo-Spanish trade disputes and your eyes glaze over. Ask an AI for a summary? Then you didn't really read it.

What you need is **someone explaining as you read** — ask when stuck, keep going when you get it. Every conversation stays anchored to the source text, waiting for you next time you flip back.

That's what ReadLoop does.

## What it does

**Reading**: EPUB with continuous scroll + PDF with selectable text layer. Z-Library search/download built in. Also scans local Downloads/Documents/Desktop for books.

**AI conversations**: Select any text and ask AI directly, or type in the side panel (automatically includes current page as context). Supports multi-turn follow-ups — the AI remembers what you asked before, no need to repeat context. Turn on Guide Mode and AI generates per-paragraph cards — what this paragraph says, historical background, relevance to today. Can't select text in a scanned PDF? Screenshot a region and send it to AI via Vision.

**Annotations**: Four highlight colors, notes, and conversation logs — all anchored to exact positions in the text. Places where you've chatted show an orange dotted underline with a 💬 badge — click to reopen the conversation.

**Knowledge graph**: Each book gets an auto-generated Obsidian-compatible wiki — AI extracts core concepts chapter by chapter on first open, then updates the wiki when conversations surface something worth keeping. Next time you ask a question, the AI draws on your accumulated understanding. Wiki files live in `wikis/` and can be browsed directly in Obsidian.

**Everything stays local**: IndexedDB stores books, annotations, covers. One-click JSON export. No cloud dependency.

## Stack

React 18 + TypeScript + Vite. EPUB via epub.js, PDF via pdfjs-dist v5. Tailwind CSS + Framer Motion. Storage is IndexedDB (idb wrapper). AI supports Bedrock Claude / OpenAI / Yunstorm, routed through a Node.js proxy.

## Get started

```bash
git clone https://github.com/freemty/readloop.git
cd readloop && npm install

cp .env.example .env
# Fill in AWS credentials and API keys

npx vite --host          # Frontend
node proxy.mjs           # Proxy (Z-Library + Bedrock)
```

Open http://localhost:5173/

## Environment variables

```bash
# AWS Bedrock (Claude)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-northeast-1

# Yunstorm (optional)
VITE_YUNSTORM_API_KEY=your_yunstorm_key
```

## AI providers

Bedrock Claude is the default, using AWS AK/SK. Also supports Yunstorm (OpenAI-compatible), OpenAI direct, and Anthropic API direct. Switch in Settings with custom Base URL support.

## Proxy

`proxy.mjs` does three things: Z-Library search/download (via proxy at `127.0.0.1:7890`), Bedrock SigV4 signing (can't do this in the browser), and local file scanning (with path validation).

## License

MIT
