// ========== 消息类型 ==========

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface SystemMessage {
  role: 'system';
  content: string;
  name?: string;
}

export interface UserMessage {
  role: 'user';
  content: string;
  name?: string;
}

export interface AssistantMessage {
  role: 'assistant';
  content: string | null;
  name?: string;
  prefix?: boolean;
  reasoning_content?: string | null;
  tool_calls?: ToolCall[];
}

export interface ToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

export type ChatMessage = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

// ========== Tool 类型 ==========

export interface ToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  strict?: boolean;
}

export interface Tool {
  type: 'function';
  function: ToolFunction;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type ToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | { type: 'function'; function: { name: string } };

// ========== 请求类型 ==========

export interface ThinkingConfig {
  type: 'enabled' | 'disabled';
  reasoning_effort?: 'high' | 'max';
}

export interface ResponseFormat {
  type: 'text' | 'json_object';
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model: string;
  thinking?: ThinkingConfig | null;
  max_tokens?: number | null;
  response_format?: ResponseFormat | null;
  stop?: string | string[] | null;
  stream?: boolean | null;
  stream_options?: { include_usage?: boolean } | null;
  temperature?: number | null;
  top_p?: number | null;
  tools?: Tool[] | null;
  tool_choice?: ToolChoice | null;
  logprobs?: boolean | null;
  top_logprobs?: number | null;
  user_id?: string | null;
}

// ========== 响应类型 ==========

export interface ChatCompletionChoice {
  finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'insufficient_system_resource';
  index: number;
  message: {
    content: string | null;
    reasoning_content?: string | null;
    tool_calls?: ToolCall[];
    role: 'assistant';
  };
}

export interface ChatCompletionUsage {
  completion_tokens: number;
  prompt_tokens: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  choices: ChatCompletionChoice[];
  created: number;
  model: string;
  system_fingerprint: string;
  object: 'chat.completion';
  usage?: ChatCompletionUsage;
}

// ========== 流式响应类型 ==========

export interface StreamDelta {
  content?: string;
  reasoning_content?: string;
  role?: string;
}

export interface StreamChoice {
  index: number;
  delta: StreamDelta;
  finish_reason: string | null;
}

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: StreamChoice[];
  usage?: ChatCompletionUsage | null;
}

// ========== 会话类型 ==========

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

// ========== 流式消息状态 ==========

/** 思考步骤记录 */
export interface ThinkingStep {
  index: number;
  content: string;
  timestamp: number;
}

/** 流式传输中的消息状态 */
export interface StreamingMessage {
  id: string;
  conversationId: string;
  role: 'assistant';
  /** 已接收的内容片段（累积） */
  content: string;
  /** 已接收的思考步骤（累积） */
  thinkingSteps: ThinkingStep[];
  createdAt: number;
}

// ========== 应用层消息类型（扩展，用于存储） ==========

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  /** 深度思考模式的推理过程内容 */
  reasoningContent?: string;
  /** 推理过程的步骤记录 */
  thinkingSteps?: ThinkingStep[];
  createdAt: number;
}

// ========== 数据库 Schema ==========

export interface DuckSoupDBSchema {
  conversations: {
    key: string;
    value: Conversation;
    indexes: { 'by-updatedAt': number };
  };
  messages: {
    key: string;
    value: StoredMessage;
    indexes: { 'by-conversationId': string; 'by-createdAt': number };
  };
}
