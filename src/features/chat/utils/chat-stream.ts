/**
 * 聊天流式响应服务
 *
 * 通过 OpenAI SDK 调用 DeepSeek Responses API。
 * 支持深度思考模式的推理过程输出（单个累积文本块）。
 */

import type {
  ChatMessage,
  InputImagePart,
  InputTextPart,
  ResponsesUsage,
} from '@/features/chat/types/deepseek';

// ========== 流式事件类型 ==========

/** 聊天流式事件 */
export type ChatStreamEvent =
  | { type: 'thinking'; text: string }
  | { type: 'content'; text: string }
  | { type: 'done'; usage?: ResponsesUsage }
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
};

const DEEPSEEK_BASE = 'https://api.deepseek.com';
const DEEPSEEK_BETA_BASE = 'https://api.deepseek.com/beta';
const THINKING_BUFFER_MS = 16; // ~60fps 用于思考过程渲染
const CONTENT_BUFFER_MS = 32; // ~30fps 用于内容渲染

export type ResponsesInputContent =
  | string
  | Array<InputTextPart | InputImagePart>;

export type ResponsesInputItem = {
  role: 'user' | 'assistant';
  content: ResponsesInputContent;
};

export function toResponsesParams(messages: ChatMessage[]): {
  instructions?: string;
  input: ResponsesInputItem[];
} {
  const instructions = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');
  const input = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: (m.content ?? '') as ResponsesInputContent,
    }));
  return {
    ...(instructions ? { instructions } : {}),
    input,
  };
}

export function isPrefixContinue(messages: ChatMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user' || m.role === 'assistant') {
      return m.role === 'assistant' && m.prefix === true;
    }
  }
  return false;
}

export type ChatCompletionContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatCompletionMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatCompletionContentPart[] | null;
  prefix?: boolean;
  reasoning_content?: string | null;
};

function toChatImagePart(part: InputImagePart): ChatCompletionContentPart {
  if ('image_url' in part) {
    return { type: 'image_url', image_url: { url: part.image_url } };
  }
  return { type: 'image_url', image_url: { url: part.file_id } };
}

export function toChatCompletionMessages(
  messages: ChatMessage[],
): ChatCompletionMessage[] {
  const result: ChatCompletionMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      result.push({ role: 'system', content: m.content });
      continue;
    }
    if (m.role === 'assistant') {
      result.push({
        role: 'assistant',
        content: m.content ?? '',
        ...(m.prefix ? { prefix: true } : {}),
        ...(m.reasoning_content != null
          ? { reasoning_content: m.reasoning_content }
          : {}),
      });
      continue;
    }
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') {
      result.push({ role: 'user', content: m.content });
      continue;
    }
    result.push({
      role: 'user',
      content: m.content.map((part) =>
        part.type === 'input_text'
          ? { type: 'text' as const, text: part.text }
          : toChatImagePart(part),
      ),
    });
  }
  return result;
}

function toUsage(usage: unknown): ResponsesUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const u = usage as ResponsesUsage;
  if (
    typeof u.input_tokens !== 'number' ||
    typeof u.output_tokens !== 'number'
  ) {
    return undefined;
  }
  return u;
}

function toChatError(err: unknown): Error {
  if (err instanceof Error) {
    const status = 'status' in err ? err.status : undefined;
    if (typeof status === 'number') {
      return new Error(`HTTP ${status} ${err.message}`);
    }
    return err;
  }
  return new Error(String(err));
}

/**
 * 创建聊天流式连接
 *
 * 当 deepThink 为 true 时，会从 stream 中提取 reasoning 文本并以
 * thinking 事件输出（累积文本块，由上层拼接）。思考过程作为连续文本块展示，
 * 反映模型完整推理过程。
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
  let settled = false;

  function settle(event: ChatStreamEvent) {
    if (settled) return;
    settled = true;
    onEvent(event);
  }

  const combinedSignal = signal
    ? AbortSignal.any([signal, abortController.signal])
    : abortController.signal;

  let thinkingBuffer = '';
  let thinkingTimer: ReturnType<typeof setTimeout> | null = null;
  let contentBuffer = '';
  let contentTimer: ReturnType<typeof setTimeout> | null = null;

  function flushThinking() {
    thinkingTimer = null;
    if (thinkingBuffer.length === 0) return;
    const text = thinkingBuffer;
    thinkingBuffer = '';
    onEvent({ type: 'thinking', text });
  }

  function flushContent() {
    contentTimer = null;
    if (contentBuffer.length === 0) return;
    const text = contentBuffer;
    contentBuffer = '';
    onEvent({ type: 'content', text });
  }

  function settleDone(usage?: ResponsesUsage) {
    flushThinking();
    flushContent();
    settle(usage ? { type: 'done', usage } : { type: 'done' });
  }

  function queueThinking(text: string) {
    if (!text) return;
    thinkingBuffer += text;
    if (!thinkingTimer) {
      thinkingTimer = setTimeout(flushThinking, THINKING_BUFFER_MS);
    }
  }

  function queueContent(text: string) {
    if (!text) return;
    contentBuffer += text;
    if (!contentTimer) {
      contentTimer = setTimeout(flushContent, CONTENT_BUFFER_MS);
    }
  }

  void (async () => {
    try {
      const { default: OpenAI } = await import('openai');
      if (settled || combinedSignal.aborted) return;

      const prefix = isPrefixContinue(messages);
      const client = new OpenAI({
        apiKey,
        baseURL: prefix ? DEEPSEEK_BETA_BASE : DEEPSEEK_BASE,
        dangerouslyAllowBrowser: true,
        maxRetries: 0,
      });

      if (prefix) {
        const enableThinking =
          deepThink ||
          messages.some((m) => m.role === 'assistant' && !!m.reasoning_content);
        const stream = (await client.chat.completions.create(
          {
            model,
            messages: toChatCompletionMessages(messages),
            stream: true,
            ...(maxTokens != null ? { max_tokens: maxTokens } : {}),
            ...(temperature != null ? { temperature } : {}),
            reasoning_effort: enableThinking ? 'high' : 'none',
            thinking: {
              type: enableThinking ? 'enabled' : 'disabled',
            },
          } as never,
          { signal: combinedSignal },
        )) as unknown as AsyncIterable<{
          choices: Array<{
            delta?: {
              content?: string | null;
              reasoning_content?: string | null;
            };
          }>;
        }>;

        for await (const chunk of stream) {
          if (settled || combinedSignal.aborted) return;
          const delta = chunk.choices[0]?.delta;
          if (delta?.reasoning_content) {
            queueThinking(delta.reasoning_content);
          }
          if (delta?.content) {
            queueContent(delta.content);
          }
        }

        settleDone();
        return;
      }

      const { instructions, input } = toResponsesParams(messages);
      const stream = await client.responses.create(
        {
          model,
          instructions,
          input: input as never,
          stream: true,
          reasoning: { effort: deepThink ? 'max' : 'none' },
          ...(maxTokens != null ? { max_output_tokens: maxTokens } : {}),
          ...(temperature != null ? { temperature } : {}),
        },
        { signal: combinedSignal },
      );

      for await (const event of stream) {
        if (settled || combinedSignal.aborted) return;

        switch (event.type) {
          case 'response.reasoning_text.delta':
            if (event.delta) queueThinking(event.delta);
            break;
          case 'response.output_text.delta':
            if (event.delta) queueContent(event.delta);
            break;
          case 'response.completed':
          case 'response.incomplete':
            settleDone(toUsage(event.response?.usage));
            return;
          case 'response.failed': {
            flushThinking();
            flushContent();
            const message = event.response.error?.message ?? 'Response failed';
            settle({ type: 'error', error: new Error(message) });
            return;
          }
          case 'error': {
            flushThinking();
            flushContent();
            settle({ type: 'error', error: new Error(event.message) });
            return;
          }
        }
      }

      settleDone();
    } catch (err) {
      if (settled || combinedSignal.aborted) return;
      flushThinking();
      flushContent();
      settle({ type: 'error', error: toChatError(err) });
    }
  })();

  return {
    abort() {
      flushThinking();
      flushContent();
      settled = true;
      abortController.abort();
    },
  };
}
