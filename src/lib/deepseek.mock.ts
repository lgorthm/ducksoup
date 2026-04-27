import type {
  DeepSeekMessage,
  DeepSeekResponse,
  DeepSeekResponseChoice,
  DeepSeekStreamChunk,
  DeepSeekUsage,
} from '@/types/deepseek'
import { DeepSeekError } from '@/types/deepseek'

interface MockScenario {
  text: string
  initialDelayMs: number
  tokenDelayMs: number
}

const SCENARIOS: Record<string, MockScenario & { keywords: string[] }> = {
  greeting: {
    keywords: ['hi', 'hello', 'hey', 'greet'],
    initialDelayMs: 300,
    tokenDelayMs: 25,
    text: "Hello! I'm Ducksoup, a mock assistant powered by DeepSeek. I'm running in development mode with mock data. How can I help you today? Feel free to ask me about code, features, or just say hi!",
  },
  code: {
    keywords: ['code', 'function', 'react', 'component', 'typescript', 'write'],
    initialDelayMs: 500,
    tokenDelayMs: 20,
    text: `Here's a React TypeScript component that demonstrates debouncing a search input:

\`\`\`tsx
import { useState, useEffect, useRef } from 'react'

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

function SearchInput() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery) {
      console.log('Searching for:', debouncedQuery)
      // API call here
    }
  }, [debouncedQuery])

  return (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Type to search..."
      className="rounded-lg border px-4 py-2"
    />
  )
}
\`\`\`

This pattern prevents excessive API calls by waiting until the user stops typing. The debounce hook is reusable across any value type.`,
  },
  help: {
    keywords: ['help', 'what can you do', 'capabilities', '能做'],
    initialDelayMs: 400,
    tokenDelayMs: 20,
    text: `I can help you with a variety of tasks:

**Coding** — Write, review, and debug code in TypeScript, React, Python, and more.
**Writing** — Draft emails, documentation, articles, and creative content.
**Analysis** — Break down complex problems, explain concepts, and suggest solutions.
**Data** — Help with data structures, algorithms, and system design.

In this mock mode, I'll respond with predefined scenarios. Switch to the real API by setting \`VITE_MOCK_API=false\` in your \`.env\` file and providing a valid DeepSeek API key.

Is there something specific you'd like to try?`,
  },
  long: {
    keywords: ['long', 'story', 'detailed', '长篇'],
    initialDelayMs: 600,
    tokenDelayMs: 15,
    text: `Here's a detailed explanation of how React reconciliation works.

React uses a process called reconciliation to efficiently update the DOM in response to state changes. At its core, reconciliation is the algorithm that diffs one tree of React elements with another to determine which parts need to be updated.

When a component's state or props change, React creates a new React element tree representing the updated UI. It then compares this new tree with the previous tree using a diffing algorithm with O(n) complexity, relying on two key assumptions:

1. **Elements of different types produce different trees** — If a \`<div>\` becomes a \`<span>\`, React tears down the old tree entirely and builds a new one from scratch. This includes all DOM nodes and component instances within that subtree.

2. **The \`key\` prop identifies stable elements** — When rendering lists, keys allow React to match children across renders. If a child has a matching key, React reuses the component instance and only updates the props, rather than unmounting and remounting.

During reconciliation, React processes the element tree recursively. For each pair of old and new elements at the same position, it checks if the element type matches. If so, it updates the existing component with new props. If not, it unmounts the old instance and mounts a new one.

This algorithm keeps updates fast while maintaining a predictable model for developers. Understanding reconciliation helps avoid common performance pitfalls, such as rendering new components on every parent update (by using \`React.memo\` or \`useMemo\`) and ensuring list keys are stable and unique.

For most applications, React's default behavior performs well. Profiling is recommended before optimizing — premature optimization can add complexity without meaningful gains.`,
  },
  error: {
    keywords: ['error', 'fail', '500'],
    initialDelayMs: 200,
    tokenDelayMs: 0,
    text: '',
  },
}

const DEFAULT_SCENARIO = {
  initialDelayMs: 300,
  tokenDelayMs: 25,
  text: `I'm running in mock mode for development. You can test different scenarios by sending messages containing keywords: try "hello", "code", "help", "long", or "error". Set \`VITE_MOCK_API=false\` in your \`.env\` and restart to use the real DeepSeek API with your API key.`,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function selectScenario(lastUserMessage: string): MockScenario {
  const lower = lastUserMessage.toLowerCase()

  for (const scenario of Object.values(SCENARIOS)) {
    if (scenario.keywords.some((kw) => lower.includes(kw))) {
      if (scenario === SCENARIOS.error) {
        throw new DeepSeekError(
          'Simulated mock API error for testing. Remove the keyword "error" from your message to get a normal response.',
          500,
        )
      }
      return scenario
    }
  }

  return DEFAULT_SCENARIO
}

function getLastUserMessage(messages: DeepSeekMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content
  }
  return ''
}

interface MockOptions {
  model?: string
  signal?: AbortSignal
}

function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text]
}

function createStreamChunk(
  id: string,
  created: number,
  model: string,
  delta: { role?: 'assistant'; content?: string },
  finishReason: string | null,
  usage?: DeepSeekUsage | null,
): DeepSeekStreamChunk {
  return {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta,
        finish_reason: finishReason as DeepSeekStreamChunk['choices'][0]['finish_reason'],
      },
    ],
    usage: usage ?? null,
  }
}

export async function* mockChatCompletionStream(
  messages: DeepSeekMessage[],
  options?: MockOptions,
): AsyncGenerator<DeepSeekStreamChunk> {
  const { signal } = options ?? {}
  const scenario = selectScenario(getLastUserMessage(messages))

  const id = `mock-${crypto.randomUUID().slice(0, 8)}`
  const created = Math.floor(Date.now() / 1000)
  const model = options?.model ?? 'mock-model'

  // Check abort before starting
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }

  // Simulate network latency
  await sleep(scenario.initialDelayMs)

  if (signal?.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }

  // Yield role chunk
  yield createStreamChunk(id, created, model, { role: 'assistant' }, null)

  // Stream tokens
  const tokens = tokenize(scenario.text)
  for (const token of tokens) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }

    await sleep(scenario.tokenDelayMs)

    if (signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }

    yield createStreamChunk(id, created, model, { content: token }, null)
  }

  // Yield final chunk with usage
  const tokenCount = tokens.length
  yield createStreamChunk(id, created, model, {}, 'stop', {
    prompt_tokens: 42,
    completion_tokens: tokenCount,
    total_tokens: 42 + tokenCount,
  })
}

export async function mockChatCompletion(
  messages: DeepSeekMessage[],
  options?: MockOptions,
): Promise<DeepSeekResponse> {
  const { signal } = options ?? {}
  const scenario = selectScenario(getLastUserMessage(messages))

  if (signal?.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }

  await sleep(200)

  if (signal?.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }

  const tokenCount = scenario.text.split(/\s+/).length

  const choice: DeepSeekResponseChoice = {
    index: 0,
    message: {
      role: 'assistant',
      content: scenario.text,
    },
    finish_reason: 'stop',
  }

  return {
    id: `mock-${crypto.randomUUID().slice(0, 8)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: options?.model ?? 'mock-model',
    choices: [choice],
    usage: {
      prompt_tokens: 42,
      completion_tokens: tokenCount,
      total_tokens: 42 + tokenCount,
    },
  }
}
