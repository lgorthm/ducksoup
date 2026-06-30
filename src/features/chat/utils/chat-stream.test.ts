import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createChatStream } from './chat-stream';
import { createSSEConnection } from './sse-client';
import type { SSEConnectionOptions, SSEConnection } from './sse-client';

vi.mock('@/features/chat/utils/sse-client');

// ========== 辅助 ==========

let capturedOptions: SSEConnectionOptions;
const mockConnection: SSEConnection = {
  close: vi.fn(),
  readyState: 'open' as const,
};

function emitSSEData(data: unknown): void {
  capturedOptions.onEvent?.({
    event: 'message',
    data,
    id: null,
    retry: null,
  });
}

function makeChunk(
  delta: Record<string, string>,
  usage?: Record<string, number>,
) {
  return {
    id: 'chatcmpl-mock',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'test-model',
    choices: usage ? [] : [{ index: 0, delta, finish_reason: null }],
    ...(usage ? { usage } : {}),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(createSSEConnection).mockImplementation((_url, options) => {
    capturedOptions = options ?? {};
    return mockConnection;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ========== 基础功能 ==========

describe('createChatStream', () => {
  it('返回带 abort 方法的 controller', () => {
    const controller = createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent: vi.fn(),
    });
    expect(controller.abort).toBeTypeOf('function');
    expect(controller.connection).toBe(mockConnection);
  });

  it('传递正确的 URL 和 headers 给 SSE client', () => {
    createChatStream({
      apiKey: 'my-key',
      model: 'my-model',
      messages: [],
      onEvent: vi.fn(),
    });
    expect(createSSEConnection).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer my-key',
        }),
      }),
    );
  });

  it('请求体包含 model、messages、stream 参数', () => {
    createChatStream({
      apiKey: 'key',
      model: 'my-model',
      messages: [{ role: 'user', content: 'hi' }],
      onEvent: vi.fn(),
    });
    const body = JSON.parse(capturedOptions.body!);
    expect(body.model).toBe('my-model');
    expect(body.stream).toBe(true);
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('deepThink 时请求体包含 thinking 配置', () => {
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      deepThink: true,
      onEvent: vi.fn(),
    });
    const body = JSON.parse(capturedOptions.body!);
    expect(body.thinking).toEqual({
      type: 'enabled',
      reasoning_effort: 'max',
    });
  });

  it('deepThink 为 false 时请求体不含 thinking', () => {
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      deepThink: false,
      onEvent: vi.fn(),
    });
    const body = JSON.parse(capturedOptions.body!);
    expect(body.thinking).toBeUndefined();
  });
});

// ========== 事件路由 ==========

describe('事件路由', () => {
  it('reasoning_content 路由到 thinking 事件（需 deepThink）', () => {
    const onEvent = vi.fn();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      deepThink: true,
      onEvent,
    });

    emitSSEData(makeChunk({ reasoning_content: '思考中' }));

    expect(onEvent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(16);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'thinking',
      text: '思考中',
    });
  });

  it('content 路由到 content 事件', () => {
    const onEvent = vi.fn();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });

    emitSSEData(makeChunk({ content: '你好' }));

    expect(onEvent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(32);
    expect(onEvent).toHaveBeenCalledWith({ type: 'content', text: '你好' });
  });

  it('[DONE] 触发 done 事件并先 flush', () => {
    const onEvent = vi.fn();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });

    emitSSEData(makeChunk({ content: '待刷新' }));
    emitSSEData('[DONE]');

    // flushContent 在 [DONE] 时同步执行
    expect(onEvent).toHaveBeenCalledWith({ type: 'content', text: '待刷新' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'done' });
  });

  it('usage chunk 触发 done 事件（带 usage）', () => {
    const onEvent = vi.fn();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });

    emitSSEData(makeChunk({}, { prompt_tokens: 10, completion_tokens: 5 }));

    expect(onEvent).toHaveBeenCalledWith({
      type: 'done',
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
  });

  it('onError 触发 error 事件', () => {
    const onEvent = vi.fn();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });

    const error = new Error('连接断开');
    capturedOptions.onError?.(error);

    expect(onEvent).toHaveBeenCalledWith({ type: 'error', error });
  });

  it('onClose 时 flush 缓冲区', () => {
    const onEvent = vi.fn();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });

    emitSSEData(makeChunk({ content: '未刷新内容' }));
    // 不推进定时器，直接关闭连接
    capturedOptions.onClose?.();

    expect(onEvent).toHaveBeenCalledWith({
      type: 'content',
      text: '未刷新内容',
    });
  });

  it('无 delta 的 chunk 被忽略', () => {
    const onEvent = vi.fn();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });

    emitSSEData({
      id: 'x',
      object: 'chat.completion.chunk',
      created: 0,
      model: 'm',
      choices: [{ index: 0, delta: {}, finish_reason: null }],
    });
    vi.advanceTimersByTime(32);

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('非对象 data 被忽略', () => {
    const onEvent = vi.fn();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });

    emitSSEData('just a string');
    vi.advanceTimersByTime(32);

    expect(onEvent).not.toHaveBeenCalled();
  });
});

// ========== 缓冲合并 ==========

describe('缓冲合并', () => {
  it('thinking 多个 chunk 在 16ms 窗口内合并', () => {
    const onEvent = vi.fn();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      deepThink: true,
      onEvent,
    });

    emitSSEData(makeChunk({ reasoning_content: '第一' }));
    emitSSEData(makeChunk({ reasoning_content: '第二' }));
    vi.advanceTimersByTime(16);

    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith({
      type: 'thinking',
      text: '第一第二',
    });
  });

  it('content 多个 chunk 在 32ms 窗口内合并', () => {
    const onEvent = vi.fn();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });

    emitSSEData(makeChunk({ content: 'A' }));
    emitSSEData(makeChunk({ content: 'B' }));
    emitSSEData(makeChunk({ content: 'C' }));
    vi.advanceTimersByTime(32);

    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith({ type: 'content', text: 'ABC' });
  });

  it('thinking 跨窗口多次 flush 分别输出文本', () => {
    const onEvent = vi.fn();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      deepThink: true,
      onEvent,
    });

    emitSSEData(makeChunk({ reasoning_content: 'a' }));
    vi.advanceTimersByTime(16);
    emitSSEData(makeChunk({ reasoning_content: 'b' }));
    vi.advanceTimersByTime(16);

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenNthCalledWith(1, {
      type: 'thinking',
      text: 'a',
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      type: 'thinking',
      text: 'b',
    });
  });
});

// ========== 中止 ==========

describe('abort', () => {
  it('flush 缓冲区并 abort 内部 controller', () => {
    const onEvent = vi.fn();
    const controller = createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });

    emitSSEData(makeChunk({ content: '待flush' }));
    controller.abort();

    expect(onEvent).toHaveBeenCalledWith({
      type: 'content',
      text: '待flush',
    });
    expect(capturedOptions.signal?.aborted).toBe(true);
  });

  it('外部 signal abort 时 combined signal 也 abort', () => {
    const externalAbort = new AbortController();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent: vi.fn(),
      signal: externalAbort.signal,
    });

    externalAbort.abort();
    expect(capturedOptions.signal?.aborted).toBe(true);
  });

  it('flush 后缓冲区清空，不再重复 flush', () => {
    const onEvent = vi.fn();
    const controller = createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });

    emitSSEData(makeChunk({ content: 'x' }));
    controller.abort();

    onEvent.mockClear();
    capturedOptions.onClose?.();
    expect(onEvent).not.toHaveBeenCalled();
  });
});
