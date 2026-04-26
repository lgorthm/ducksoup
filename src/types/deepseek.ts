export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
}

export interface DeepSeekRequestBody {
  model: string
  messages: DeepSeekMessage[]
  temperature?: number | null
  top_p?: number | null
  max_tokens?: number | null
  stream?: boolean | null
  stream_options?: { include_usage?: boolean } | null
  stop?: string | string[] | null
  frequency_penalty?: number | null
  presence_penalty?: number | null
  response_format?: { type: 'text' | 'json_object' } | null
  thinking?: { type: 'enabled' | 'disabled'; reasoning_effort?: 'high' | 'max' } | null
}

export interface DeepSeekUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
  completion_tokens_details?: {
    reasoning_tokens?: number
  } | null
}

export interface DeepSeekResponseChoice {
  index: number
  finish_reason:
    | 'stop'
    | 'length'
    | 'content_filter'
    | 'tool_calls'
    | 'insufficient_system_resource'
    | null
  message: {
    role: 'assistant'
    content: string | null
    reasoning_content?: string | null
    tool_calls?: unknown[] | null
  }
  logprobs?: unknown
}

export interface DeepSeekResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: DeepSeekResponseChoice[]
  usage?: DeepSeekUsage
  system_fingerprint?: string
}

export interface DeepSeekStreamChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: 'assistant' | null
      content?: string | null
      reasoning_content?: string | null
    }
    finish_reason:
      | 'stop'
      | 'length'
      | 'content_filter'
      | 'tool_calls'
      | 'insufficient_system_resource'
      | null
    logprobs?: unknown
  }>
  usage?: DeepSeekUsage | null
  system_fingerprint?: string
}

export class DeepSeekError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DeepSeekError'
    this.status = status
  }
}
