import type {
  DeepSeekMessage,
  DeepSeekRequestBody,
  DeepSeekResponse,
  DeepSeekStreamChunk,
} from '@/types/deepseek'
import { DeepSeekError } from '@/types/deepseek'

const BASE_URL = 'https://api.deepseek.com/chat/completions'
const DEFAULT_MODEL = 'deepseek-v4-flash'

function getErrorMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Invalid API key. Please check your settings.'
    case 402:
      return 'Insufficient balance. Please top up your DeepSeek account.'
    case 429:
      return 'Rate limited. Please wait a moment and try again.'
    case 500:
    case 503:
      return 'DeepSeek server error. Please try again later.'
    default:
      return `Request failed with status ${status}.`
  }
}

async function handleResponseError(response: Response): Promise<never> {
  let message = getErrorMessage(response.status)
  try {
    const body = await response.text()
    if (body) {
      const parsed = JSON.parse(body)
      if (parsed.error?.message) {
        message = parsed.error.message
      }
    }
  } catch {
    // ignore parse errors, use default message
  }
  throw new DeepSeekError(message, response.status)
}

async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep incomplete last line in buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6)
          if (data === '[DONE]') return
          yield data
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function chatCompletion(
  apiKey: string,
  messages: DeepSeekMessage[],
  options?: Omit<DeepSeekRequestBody, 'model' | 'messages'> & {
    model?: string
    signal?: AbortSignal
  },
): Promise<DeepSeekResponse> {
  const body: DeepSeekRequestBody = {
    model: options?.model ?? DEFAULT_MODEL,
    messages,
    temperature: options?.temperature ?? undefined,
    top_p: options?.top_p ?? undefined,
    max_tokens: options?.max_tokens ?? undefined,
    stop: options?.stop ?? undefined,
    frequency_penalty: options?.frequency_penalty ?? undefined,
    presence_penalty: options?.presence_penalty ?? undefined,
    response_format: options?.response_format ?? undefined,
    thinking: options?.thinking ?? undefined,
  }

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  })

  if (!response.ok) {
    await handleResponseError(response)
  }

  return (await response.json()) as DeepSeekResponse
}

export async function* chatCompletionStream(
  apiKey: string,
  messages: DeepSeekMessage[],
  options?: Omit<DeepSeekRequestBody, 'model' | 'messages' | 'stream'> & {
    model?: string
    signal?: AbortSignal
  },
): AsyncGenerator<DeepSeekStreamChunk> {
  const body: DeepSeekRequestBody = {
    model: options?.model ?? DEFAULT_MODEL,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    temperature: options?.temperature ?? undefined,
    top_p: options?.top_p ?? undefined,
    max_tokens: options?.max_tokens ?? undefined,
    stop: options?.stop ?? undefined,
    frequency_penalty: options?.frequency_penalty ?? undefined,
    presence_penalty: options?.presence_penalty ?? undefined,
    response_format: options?.response_format ?? undefined,
    thinking: options?.thinking ?? undefined,
  }

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  })

  if (!response.ok) {
    await handleResponseError(response)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new DeepSeekError('Response body is not readable', 0)
  }

  for await (const data of parseSSEStream(reader)) {
    try {
      const chunk = JSON.parse(data) as DeepSeekStreamChunk
      yield chunk
    } catch {
      // skip malformed chunks
    }
  }
}
