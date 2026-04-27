# Multi-Turn Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI conversations retain full chat history so follow-up questions have context from prior messages in the same conversation.

**Architecture:** Thread `Message[]` conversation history through useAi → callAi → client.chat. The system prompt stays first, then all prior user/assistant messages, then the new user message. Conversation history is already saved in `Annotation.conversation` and rendered in `activeConversation` state — we just need to pass it to the API call instead of discarding it.

**Tech Stack:** React hooks, existing `ChatMessage` type, vitest for tests.

---

### File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/ai/context.ts` | Modify | Add `conversationHistory` param to `buildAskContext`, append history messages to output |
| `src/hooks/useAi.ts` | Modify | `callAi` accepts full `ChatMessage[]` instead of just system+user pair; `askAi` passes history through |
| `src/App.tsx` | Modify | `handleSendMessage` and `handleAskCurrentPage` pass `activeConversation` as history |
| `tests/context.test.ts` | Modify | Add tests for conversation history in context builder |
| `tests/useAi-multiturn.test.ts` | Create | Test that callAi sends full message array |

---

### Task 1: Add conversation history to context builder

**Files:**
- Modify: `tests/context.test.ts`
- Modify: `src/ai/context.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/context.test.ts`:

```typescript
it('includes conversation history in messages', () => {
  const result = buildAskContext({
    bookTitle: 'The Wealth of Nations',
    bookAuthor: 'Adam Smith',
    currentChapter: 'Chapter 1',
    paragraphs: ['Para before.', 'Selected text.', 'Para after.'],
    currentParagraphIndex: 1,
    selectedText: 'Selected text.',
    userQuery: 'Follow-up question?',
    nearbyAnnotations: [],
    conversationHistory: [
      { role: 'user', content: 'What does this mean?', timestamp: 1000 },
      { role: 'assistant', content: 'It means X.', timestamp: 2000 },
    ],
  })
  expect(result.messages).toBeDefined()
  expect(result.messages.length).toBe(4) // system + 2 history + new user
  expect(result.messages[0].role).toBe('system')
  expect(result.messages[1]).toEqual({ role: 'user', content: 'What does this mean?' })
  expect(result.messages[2]).toEqual({ role: 'assistant', content: 'It means X.' })
  expect(result.messages[3].role).toBe('user')
  expect(result.messages[3].content).toContain('Follow-up question?')
})

it('works without conversation history (single turn)', () => {
  const result = buildAskContext({
    bookTitle: 'The Wealth of Nations',
    bookAuthor: 'Adam Smith',
    currentChapter: 'Chapter 1',
    paragraphs: ['Text.'],
    currentParagraphIndex: 0,
    selectedText: 'Text.',
    userQuery: 'What?',
    nearbyAnnotations: [],
  })
  expect(result.messages.length).toBe(2) // system + user
  expect(result.messages[0].role).toBe('system')
  expect(result.messages[1].role).toBe('user')
  // Legacy fields still work
  expect(result.systemPrompt).toContain('The Wealth of Nations')
  expect(result.userPrompt).toContain('What?')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/context.test.ts -v`
Expected: FAIL — `conversationHistory` not a valid property, `messages` undefined.

- [ ] **Step 3: Implement context builder changes**

In `src/ai/context.ts`, add `conversationHistory` to the input interface and `messages` to the output:

```typescript
import type { Message } from '../types'

interface AskContextInput {
  bookTitle: string
  bookAuthor: string
  currentChapter: string
  paragraphs: string[]
  currentParagraphIndex: number
  selectedText: string
  userQuery: string
  nearbyAnnotations: Annotation[]
  mode?: AiMode
  wikiContext?: string
  conversationHistory?: Message[]
}

interface ContextResult {
  systemPrompt: string
  userPrompt: string
  messages: { role: string; content: string }[]
}
```

Change `buildAskContext` return type from `PromptPair` to `ContextResult`. Build `messages` array at the end of the function:

```typescript
export function buildAskContext(input: AskContextInput): ContextResult {
  // ... existing systemPrompt and userPrompt logic unchanged ...

  const history = (input.conversationHistory ?? []).map(m => ({
    role: m.role,
    content: m.content,
  }))

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userPrompt },
  ]

  return { systemPrompt, userPrompt, messages }
}
```

Keep `systemPrompt` and `userPrompt` in the return for backward compatibility with `getGuide` and any other callers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/context.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/context.test.ts src/ai/context.ts
git commit -m "feat(ai): add conversationHistory to buildAskContext"
```

---

### Task 2: Thread messages through useAi hook

**Files:**
- Modify: `src/hooks/useAi.ts`

- [ ] **Step 1: Add conversationHistory to AskParams**

In `src/hooks/useAi.ts`, add to the `AskParams` interface:

```typescript
interface AskParams {
  bookTitle: string
  bookAuthor: string
  currentChapter: string
  paragraphs: string[]
  currentParagraphIndex: number
  selectedText: string
  userQuery: string
  nearbyAnnotations: Annotation[]
  mode?: AiMode
  wikiContext?: string
  conversationHistory?: Message[]
}
```

Add the import:

```typescript
import type { Message } from '../types'
```

- [ ] **Step 2: Change callAi to accept ChatMessage array**

Replace the current `callAi` signature and body:

```typescript
const callAi = useCallback(async (
  messages: ChatMessage[],
): Promise<string> => {
  const settings = loadSettings()
  if (settings.provider !== 'bedrock' && !settings.apiKey) {
    throw new Error('Please configure your API key in Settings')
  }

  const client = createAiClient({
    provider: settings.provider,
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl,
  })

  abortRef.current = false
  setIsLoading(true)
  setStreamingText('')
  setError(null)

  try {
    const result = await client.chat(
      messages,
      (chunk) => {
        if (!abortRef.current) {
          setStreamingText(prev => prev + chunk)
        }
      },
    )
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI request failed'
    setError(msg)
    throw err
  } finally {
    setIsLoading(false)
  }
}, [])
```

- [ ] **Step 3: Update askAi to use messages array**

```typescript
const askAi = useCallback(async (params: AskParams): Promise<string> => {
  const context = buildAskContext(params)
  return callAi(context.messages as ChatMessage[])
}, [callAi])
```

- [ ] **Step 4: Update getGuide to use callAi with messages**

```typescript
const getGuide = useCallback(async (params: GuideParams): Promise<string> => {
  const { systemPrompt, userPrompt } = buildGuideContext(params)
  return callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])
}, [callAi])
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAi.ts
git commit -m "feat(ai): thread full message array through useAi.callAi"
```

---

### Task 3: Pass conversation history from App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update handleSendMessage to pass activeConversation**

In `handleSendMessage`, add `conversationHistory` to the `ai.askAi` call. The `activeConversation` state already contains all prior messages at this point (the new user message was just appended via `setActiveConversation`).

However, `setActiveConversation` is async — the state may not have updated yet when we call `ai.askAi`. So we need to build the history explicitly:

```typescript
const handleSendMessage = useCallback(async (query: string) => {
  if (!currentBook) return

  const userMsg: Message = { role: 'user', content: query, timestamp: Date.now() }
  const updatedConversation = activeConversation ? [...activeConversation, userMsg] : [userMsg]
  setActiveConversation(updatedConversation)

  let wikiContext: string | undefined
  if (currentBook.wikiReady && currentBook.wikiSlug) {
    try {
      const chapterSlug = currentChapter ? nodeSlug(currentChapter) : ''
      const concepts = await readChapterConcepts(currentBook.wikiSlug, chapterSlug)
      wikiContext = buildWikiContextBlock(concepts)
    } catch {
      // Wiki read failed — continue without wiki context
    }
  }

  try {
    const result = await ai.askAi({
      bookTitle: currentBook.title,
      bookAuthor: currentBook.author,
      currentChapter: '',
      paragraphs: [selectedText],
      currentParagraphIndex: 0,
      selectedText,
      userQuery: query,
      nearbyAnnotations: annotations,
      mode: aiMode,
      wikiContext,
      conversationHistory: activeConversation ?? [],
    })

    const assistantMsg: Message = { role: 'assistant', content: result, timestamp: Date.now() }
    setActiveConversation(prev => {
      const updated = prev ? [...prev, assistantMsg] : [assistantMsg]
      if (activeAnnotationId) {
        const ann = annotations.find(a => a.id === activeAnnotationId)
        if (ann) {
          updateAnnotation({
            ...ann,
            conversation: updated,
            updatedAt: Date.now(),
          })
        }
      }

      if (currentBook.wikiReady && currentBook.wikiSlug) {
        const chSlug = currentChapter ? nodeSlug(currentChapter) : ''
        updateWiki(currentBook, updated, currentChapter, chSlug).catch(err =>
          console.error('Wiki update failed:', err)
        )
      }

      return updated
    })
  } catch {
    // error is handled by useAi hook
  }
}, [currentBook, selectedText, annotations, activeAnnotationId, activeConversation, ai, updateAnnotation, aiMode, currentChapter])
```

Key change: `conversationHistory: activeConversation ?? []` passes all prior messages. The `userQuery` is the new message — `buildAskContext` appends it at the end.

Note: `activeConversation` is added to the dependency array.

- [ ] **Step 2: Verify handleAskCurrentPage stays single-turn**

`handleAskCurrentPage` starts a fresh conversation — no history to pass. Verify it does NOT pass `conversationHistory` (default `undefined` will produce single-turn behavior). No changes needed.

- [ ] **Step 3: Run type check and build**

Run: `npx tsc --noEmit && npx vite build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ai): pass conversation history to AI in follow-up messages"
```

---

### Task 4: Context window guard

**Files:**
- Modify: `src/ai/context.ts`
- Modify: `tests/context.test.ts`

Long conversations will eventually blow up the context window. Add a simple guard that trims old messages when the conversation gets too long.

- [ ] **Step 1: Write the failing test**

Add to `tests/context.test.ts`:

```typescript
it('trims old history when conversation exceeds max turns', () => {
  const longHistory: { role: 'user' | 'assistant'; content: string; timestamp: number }[] = []
  for (let i = 0; i < 40; i++) {
    longHistory.push({ role: 'user', content: `Question ${i}`, timestamp: i * 1000 })
    longHistory.push({ role: 'assistant', content: `Answer ${i}`, timestamp: i * 1000 + 500 })
  }

  const result = buildAskContext({
    bookTitle: 'Test',
    bookAuthor: 'Author',
    currentChapter: '',
    paragraphs: ['Text.'],
    currentParagraphIndex: 0,
    selectedText: 'Text.',
    userQuery: 'New question?',
    nearbyAnnotations: [],
    conversationHistory: longHistory,
  })

  // system + trimmed history + new user = should be capped
  // 20 turns = 40 messages max history + system + user = 42
  expect(result.messages.length).toBeLessThanOrEqual(42)
  // Most recent messages are preserved (not oldest)
  const lastHistoryMsg = result.messages[result.messages.length - 2]
  expect(lastHistoryMsg.content).toBe('Answer 39')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/context.test.ts -v`
Expected: FAIL — messages.length is 82 (no trimming).

- [ ] **Step 3: Add trimming logic**

In `src/ai/context.ts`, inside `buildAskContext`, after building `history`:

```typescript
const MAX_HISTORY_TURNS = 20 // 20 user-assistant pairs = 40 messages
const maxHistoryMessages = MAX_HISTORY_TURNS * 2
const trimmedHistory = history.length > maxHistoryMessages
  ? history.slice(history.length - maxHistoryMessages)
  : history

const messages = [
  { role: 'system', content: systemPrompt },
  ...trimmedHistory,
  { role: 'user', content: userPrompt },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/context.test.ts -v`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/ai/context.ts tests/context.test.ts
git commit -m "feat(ai): cap conversation history at 20 turns to protect context window"
```

---

### Task 5: Verify end-to-end and final build

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run -v`
Expected: All tests PASS

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Production build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Manual verification checklist**

If dev server is running, verify:
1. Open a book, select text, Ask AI → first response works
2. Send a follow-up question → AI references previous answer (proves history is threaded)
3. Close conversation, open a new one → fresh context (no bleed from previous)
4. Click an existing conversation annotation → history loads, follow-up works

- [ ] **Step 5: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix(ai): address multi-turn integration issues"
```
