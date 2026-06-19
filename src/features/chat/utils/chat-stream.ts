/**
 * 聊天流式响应服务
 *
 * 基于 SSE 客户端，封装 DeepSeek Chat Completion 流式调用。
 * 支持深度思考模式的结构化思考过程输出。
 */

import type { ChatMessage, StreamChunk } from '@/features/chat/types/deepseek';
import {
  createSSEConnection,
  type SSEConnection,
} from '@/features/chat/utils/sse-client';

// ========== 流式事件类型 ==========

/** 思考步骤 */
export interface ThinkingStep {
  /** 步骤序号 */
  index: number;
  /** 思考内容片段 */
  content: string;
  /** 时间戳 */
  timestamp: number;
}

/** 聊天流式事件 */
export type ChatStreamEvent =
  | { type: 'thinking'; step: ThinkingStep }
  | { type: 'content'; text: string }
  | { type: 'done'; usage?: StreamChunk['usage'] }
  | { type: 'error'; error: Error };

export interface ChatStreamOptions {
  /** API Key */
  apiKey: string;
  /** 模型名 */
  model: string;
  /** 消息列表 */
  messages: ChatMessage[];
  /** 是否启用深度思考模式 */
  deepThink?: boolean;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 温度 */
  temperature?: number;
  /** 事件回调 */
  onEvent: (event: ChatStreamEvent) => void;
  /** 用于中止 */
  signal?: AbortSignal;
}

export type ChatStreamController = {
  /** 中止流 */
  abort: () => void;
  /** 连接对象 */
  readonly connection: SSEConnection;
};

const DEEPSEEK_BASE = 'https://api.deepseek.com';
const THINKING_BUFFER_MS = 16; // ~60fps 用于思考过程渲染
const CONTENT_BUFFER_MS = 32; // ~30fps 用于内容渲染

/**
 * 创建聊天流式连接
 *
 * 当 deepThink 为 true 时，会从 stream 中提取 reasoning_content 并以结构化的
 * ThinkingStep 事件输出。思考过程按时间顺序排列，反映模型逐步推理的过程。
 */
export function createChatStream(
  options: ChatStreamOptions,
): ChatStreamController {
  const {
    apiKey,
    model,
    messages,
    deepThink = false,
    maxTokens,
    temperature,
    onEvent,
    signal,
  } = options;

  const abortController = new AbortController();

  // 组合外部 signal
  const combinedSignal = signal
    ? combineSignals(signal, abortController.signal)
    : abortController.signal;

  const body = JSON.stringify({
    messages,
    model,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: maxTokens ?? null,
    temperature: temperature ?? null,
    thinking: deepThink
      ? { type: 'enabled', reasoning_effort: 'max' }
      : undefined,
  });

  // 思考过程缓冲区：定期合并后输出
  let thinkingBuffer = '';
  let thinkingStepIndex = 0;
  let thinkingTimer: ReturnType<typeof setTimeout> | null = null;

  // 内容缓冲区：定期合并后输出
  let contentBuffer = '';
  let contentTimer: ReturnType<typeof setTimeout> | null = null;

  function flushThinking() {
    thinkingTimer = null;
    if (thinkingBuffer.length === 0) return;
    const step: ThinkingStep = {
      index: thinkingStepIndex++,
      content: thinkingBuffer,
      timestamp: Date.now(),
    };
    thinkingBuffer = '';
    onEvent({ type: 'thinking', step });
  }

  function flushContent() {
    contentTimer = null;
    if (contentBuffer.length === 0) return;
    const text = contentBuffer;
    contentBuffer = '';
    onEvent({ type: 'content', text });
  }

  const connection = createSSEConnection(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
    signal: combinedSignal,
    onEvent: (sseEvent) => {
      const data = sseEvent.data;

      // DeepSeek 流的结束标记
      if (data === '[DONE]') {
        flushThinking();
        flushContent();
        onEvent({ type: 'done' });
        return;
      }

      if (typeof data !== 'object' || data === null) return;

      const chunk = data as StreamChunk;

      // usage 信息
      if (chunk.usage) {
        flushThinking();
        flushContent();
        onEvent({ type: 'done', usage: chunk.usage });
        return;
      }

      const delta = chunk.choices?.[0]?.delta;
      if (!delta) return;

      // 深度思考模式：推理内容
      if (deepThink && delta.reasoning_content) {
        thinkingBuffer += delta.reasoning_content;
        // 定期刷新思考内容，保证流畅的逐步输出
        if (!thinkingTimer) {
          thinkingTimer = setTimeout(flushThinking, THINKING_BUFFER_MS);
        }
      }

      // 普通内容
      if (delta.content) {
        contentBuffer += delta.content;
        if (!contentTimer) {
          contentTimer = setTimeout(flushContent, CONTENT_BUFFER_MS);
        }
      }
    },
    onClose: () => {
      flushThinking();
      flushContent();
    },
    onError: (error) => {
      flushThinking();
      flushContent();
      onEvent({ type: 'error', error });
    },
  });

  return {
    abort() {
      flushThinking();
      flushContent();
      abortController.abort();
    },
    connection,
  };
}

function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted || b.aborted) return AbortSignal.abort();
  const controller = new AbortController();
  a.addEventListener('abort', () => controller.abort(), { once: true });
  b.addEventListener('abort', () => controller.abort(), { once: true });
  return controller.signal;
}
