import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createChatStream,
  isPrefixContinue,
  toChatCompletionMessages,
  toResponsesParams,
} from './chat-stream';

const mockCreate = vi.fn();
const mockChatCreate = vi.fn();
const OpenAI = vi.fn(function MockOpenAI() {
  return {
    responses: { create: mockCreate },
    chat: { completions: { create: mockChatCreate } },
  };
});

vi.mock('openai', () => ({
  default: OpenAI,
}));

async function flushAsync() {
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

async function* fromEvents(
  events: Array<Record<string, unknown>>,
): AsyncGenerator<Record<string, unknown>> {
  for (const event of events) {
    yield event;
  }
}

/** 产出事件后挂起，避免流结束时立即 flush 缓冲区 */
async function* fromEventsOpen(
  events: Array<Record<string, unknown>>,
): AsyncGenerator<Record<string, unknown>> {
  for (const event of events) {
    yield event;
  }
  await new Promise(() => {});
}

beforeEach(() => {
  vi.useFakeTimers();
  OpenAI.mockClear();
  mockCreate.mockReset();
  mockChatCreate.mockReset();
  mockCreate.mockResolvedValue(fromEvents([]));
  mockChatCreate.mockResolvedValue(fromEvents([]));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('createChatStream', () => {
  it('返回带 abort 方法的 controller', () => {
    const controller = createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent: vi.fn(),
    });
    expect(controller.abort).toBeTypeOf('function');
    expect(controller).not.toHaveProperty('connection');
  });

  it('用 dangerouslyAllowBrowser 和 DeepSeek baseURL 创建客户端', async () => {
    createChatStream({
      apiKey: 'my-key',
      model: 'my-model',
      messages: [],
      onEvent: vi.fn(),
    });
    await flushAsync();

    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: 'my-key',
      baseURL: 'https://api.deepseek.com',
      dangerouslyAllowBrowser: true,
      maxRetries: 0,
    });
  });

  it('请求体包含 model、instructions、input、stream', async () => {
    createChatStream({
      apiKey: 'key',
      model: 'my-model',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'hi' },
      ],
      onEvent: vi.fn(),
    });
    await flushAsync();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'my-model',
        stream: true,
        instructions: 'You are a helpful assistant.',
        input: [{ role: 'user', content: 'hi' }],
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('多模态 user content 原样传入 input', async () => {
    createChatStream({
      apiKey: 'key',
      model: 'deepseek-v4-flash-vision-exp',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: '看图' },
            { type: 'input_image', file_id: 'file-api-1' },
          ],
        },
      ],
      onEvent: vi.fn(),
    });
    await flushAsync();

    expect(mockCreate.mock.calls[0][0].input).toEqual([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: '看图' },
          { type: 'input_image', file_id: 'file-api-1' },
        ],
      },
    ]);
  });

  it('deepThink 时 reasoning.effort 为 max', async () => {
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      deepThink: true,
      onEvent: vi.fn(),
    });
    await flushAsync();

    expect(mockCreate.mock.calls[0][0].reasoning).toEqual({
      effort: 'max',
    });
  });

  it('webSearch 时带 tools web_search', async () => {
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      webSearch: true,
      onEvent: vi.fn(),
    });
    await flushAsync();

    expect(mockCreate.mock.calls[0][0].tools).toEqual([{ type: 'web_search' }]);
  });

  it('webSearch 为 false 时不带 tools', async () => {
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      webSearch: false,
      onEvent: vi.fn(),
    });
    await flushAsync();

    expect(mockCreate.mock.calls[0][0].tools).toBeUndefined();
  });

  it('deepThink 为 false 时 reasoning.effort 为 none', async () => {
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      deepThink: false,
      onEvent: vi.fn(),
    });
    await flushAsync();

    expect(mockCreate.mock.calls[0][0].reasoning).toEqual({
      effort: 'none',
    });
  });

  it('传入 maxTokens 和 temperature', async () => {
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      maxTokens: 128,
      temperature: 0.7,
      onEvent: vi.fn(),
    });
    await flushAsync();

    expect(mockCreate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        max_output_tokens: 128,
        temperature: 0.7,
      }),
    );
  });
});

describe('事件路由', () => {
  it('reasoning_text.delta 路由到 thinking 事件', async () => {
    const onEvent = vi.fn();
    mockCreate.mockResolvedValue(
      fromEventsOpen([
        { type: 'response.reasoning_text.delta', delta: '思考中' },
      ]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      deepThink: true,
      onEvent,
    });
    await flushAsync();

    expect(onEvent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(16);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'thinking',
      text: '思考中',
    });
  });

  it('web_search_call 事件路由到 web_search', async () => {
    const onEvent = vi.fn();
    mockCreate.mockResolvedValue(
      fromEvents([
        {
          type: 'response.output_item.added',
          item: {
            type: 'web_search_call',
            id: 'ws_1',
            status: 'in_progress',
            action: { type: 'search', query: 'news' },
          },
        },
        {
          type: 'response.web_search_call.searching',
          item_id: 'ws_1',
        },
        {
          type: 'response.output_item.done',
          item: {
            type: 'web_search_call',
            id: 'ws_1',
            status: 'completed',
            action: { type: 'search', query: 'news' },
          },
        },
        { type: 'response.completed', response: {} },
      ]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      webSearch: true,
      onEvent,
    });
    await flushAsync();

    expect(onEvent).toHaveBeenCalledWith({
      type: 'web_search',
      call: {
        id: 'ws_1',
        status: 'in_progress',
        action: { type: 'search', query: 'news' },
      },
    });
    expect(onEvent).toHaveBeenCalledWith({
      type: 'web_search',
      call: { id: 'ws_1', status: 'searching' },
    });
    expect(onEvent).toHaveBeenCalledWith({
      type: 'web_search',
      call: {
        id: 'ws_1',
        status: 'completed',
        action: { type: 'search', query: 'news' },
      },
    });
  });

  it('url_citation 注解路由到 citation 事件', async () => {
    const onEvent = vi.fn();
    mockCreate.mockResolvedValue(
      fromEvents([
        {
          type: 'response.output_text.annotation.added',
          annotation: {
            type: 'url_citation',
            url: 'https://example.com',
            title: 'Example',
            start_index: 0,
            end_index: 4,
          },
        },
        { type: 'response.completed', response: {} },
      ]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });
    await flushAsync();

    expect(onEvent).toHaveBeenCalledWith({
      type: 'citation',
      citation: {
        type: 'url_citation',
        url: 'https://example.com',
        title: 'Example',
        start_index: 0,
        end_index: 4,
      },
    });
  });

  it('output_text.delta 路由到 content 事件', async () => {
    const onEvent = vi.fn();
    mockCreate.mockResolvedValue(
      fromEventsOpen([{ type: 'response.output_text.delta', delta: '你好' }]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });
    await flushAsync();

    expect(onEvent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(32);
    expect(onEvent).toHaveBeenCalledWith({ type: 'content', text: '你好' });
  });

  it('response.completed 先 flush 再发出带 usage 的 done', async () => {
    const onEvent = vi.fn();
    const usage = { input_tokens: 10, output_tokens: 5 };
    mockCreate.mockResolvedValue(
      fromEvents([
        { type: 'response.output_text.delta', delta: '待刷新' },
        { type: 'response.completed', response: { usage } },
      ]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });
    await flushAsync();

    expect(onEvent).toHaveBeenCalledWith({ type: 'content', text: '待刷新' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'done', usage });
  });

  it('response.incomplete 视为 done', async () => {
    const onEvent = vi.fn();
    mockCreate.mockResolvedValue(
      fromEvents([{ type: 'response.incomplete', response: {} }]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });
    await flushAsync();

    expect(onEvent).toHaveBeenCalledWith({ type: 'done' });
  });

  it('response.failed 发出 error', async () => {
    const onEvent = vi.fn();
    mockCreate.mockResolvedValue(
      fromEvents([
        {
          type: 'response.failed',
          response: { error: { message: '模型失败' } },
        },
      ]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });
    await flushAsync();

    expect(onEvent).toHaveBeenCalledWith({
      type: 'error',
      error: expect.objectContaining({ message: '模型失败' }),
    });
  });

  it('SDK 抛出带 status 的错误时写入 HTTP 状态码', async () => {
    const onEvent = vi.fn();
    const err = Object.assign(new Error('Invalid API key'), { status: 401 });
    mockCreate.mockRejectedValue(err);

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });
    await flushAsync();

    expect(onEvent).toHaveBeenCalledWith({
      type: 'error',
      error: expect.objectContaining({ message: 'HTTP 401 Invalid API key' }),
    });
  });

  it('流结束后尚未 completed 时发出 done', async () => {
    const onEvent = vi.fn();
    mockCreate.mockResolvedValue(fromEvents([]));

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });
    await flushAsync();

    expect(onEvent).toHaveBeenCalledWith({ type: 'done' });
  });

  it('completed 之后不再因流结束重复发出 done', async () => {
    const onEvent = vi.fn();
    mockCreate.mockResolvedValue(
      fromEvents([{ type: 'response.completed', response: {} }]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });
    await flushAsync();

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({ type: 'done' });
  });
});

describe('缓冲合并', () => {
  it('thinking 多个 delta 在 16ms 窗口内合并', async () => {
    const onEvent = vi.fn();
    mockCreate.mockResolvedValue(
      fromEventsOpen([
        { type: 'response.reasoning_text.delta', delta: '第一' },
        { type: 'response.reasoning_text.delta', delta: '第二' },
      ]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      deepThink: true,
      onEvent,
    });
    await flushAsync();
    vi.advanceTimersByTime(16);

    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith({
      type: 'thinking',
      text: '第一第二',
    });
  });

  it('content 多个 delta 在 32ms 窗口内合并', async () => {
    const onEvent = vi.fn();
    mockCreate.mockResolvedValue(
      fromEventsOpen([
        { type: 'response.output_text.delta', delta: 'A' },
        { type: 'response.output_text.delta', delta: 'B' },
        { type: 'response.output_text.delta', delta: 'C' },
      ]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });
    await flushAsync();
    vi.advanceTimersByTime(32);

    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith({ type: 'content', text: 'ABC' });
  });

  it('thinking 跨窗口多次 flush 分别输出文本', async () => {
    const onEvent = vi.fn();
    async function* staggered() {
      yield { type: 'response.reasoning_text.delta', delta: 'a' };
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      });
      yield { type: 'response.reasoning_text.delta', delta: 'b' };
    }
    mockCreate.mockResolvedValue(staggered());

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      deepThink: true,
      onEvent,
    });
    await flushAsync();
    await vi.advanceTimersByTimeAsync(16);
    expect(onEvent).toHaveBeenNthCalledWith(1, {
      type: 'thinking',
      text: 'a',
    });

    await vi.advanceTimersByTimeAsync(20);
    await flushAsync();
    await vi.advanceTimersByTimeAsync(16);
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      type: 'thinking',
      text: 'b',
    });
  });
});

describe('abort', () => {
  it('flush 缓冲区并 abort 传给 SDK 的 signal', async () => {
    const onEvent = vi.fn();
    mockCreate.mockResolvedValue(
      fromEventsOpen([
        { type: 'response.output_text.delta', delta: '待flush' },
      ]),
    );

    const controller = createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });
    await flushAsync();
    controller.abort();

    expect(onEvent).toHaveBeenCalledWith({
      type: 'content',
      text: '待flush',
    });
    expect(mockCreate.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('外部 signal abort 时 combined signal 也 abort', async () => {
    const externalAbort = new AbortController();
    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent: vi.fn(),
      signal: externalAbort.signal,
    });
    await flushAsync();

    externalAbort.abort();
    expect(mockCreate.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('abort 后 SDK 抛错不再发出 error', async () => {
    const onEvent = vi.fn();
    let rejectStream: (err: Error) => void = () => {};
    mockCreate.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectStream = reject;
        }),
    );

    const controller = createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: [],
      onEvent,
    });
    await flushAsync();
    controller.abort();
    onEvent.mockClear();

    const err = new Error('Request was aborted.');
    err.name = 'APIUserAbortError';
    rejectStream(err);
    await flushAsync();

    expect(onEvent).not.toHaveBeenCalled();
  });
});

const prefixMessages = [
  { role: 'system' as const, content: 'You are a helpful assistant.' },
  { role: 'user' as const, content: 'hi' },
  { role: 'assistant' as const, content: '半句', prefix: true },
];

describe('toResponsesParams', () => {
  it('user/assistant 仍为 role+content', () => {
    expect(
      toResponsesParams([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ]),
    ).toEqual({
      instructions: 'sys',
      input: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ],
    });
  });

  it('includeReasoning 时回传 reasoning item', () => {
    const { input } = toResponsesParams(
      [
        { role: 'user', content: 'hi' },
        {
          role: 'assistant',
          content: '答',
          reasoning_content: '想了想',
        },
      ],
      { includeReasoning: true },
    );
    expect(input).toEqual([
      { role: 'user', content: 'hi' },
      {
        type: 'reasoning',
        content: [{ type: 'reasoning_text', text: '想了想' }],
      },
      { role: 'assistant', content: '答' },
    ]);
  });

  it('有 web_search_calls 时原样回传，即使未 includeReasoning 也带 reasoning', () => {
    const { input } = toResponsesParams([
      { role: 'user', content: '今天新闻' },
      {
        role: 'assistant',
        content: '如下',
        reasoning_content: '需要搜索',
        web_search_calls: [
          {
            id: 'ws_1',
            status: 'completed',
            action: { type: 'search', query: 'news' },
          },
        ],
      },
    ]);
    expect(input).toEqual([
      { role: 'user', content: '今天新闻' },
      {
        type: 'reasoning',
        content: [{ type: 'reasoning_text', text: '需要搜索' }],
      },
      {
        type: 'web_search_call',
        id: 'ws_1',
        status: 'completed',
        action: { type: 'search', query: 'news' },
      },
      { role: 'assistant', content: '如下' },
    ]);
  });
});

describe('prefix continue', () => {
  it('isPrefixContinue 只看最后一条 user/assistant', () => {
    expect(isPrefixContinue(prefixMessages)).toBe(true);
    expect(
      isPrefixContinue([
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'ok' },
      ]),
    ).toBe(false);
  });

  it('toChatCompletionMessages 转换图片与 prefix 字段', () => {
    expect(
      toChatCompletionMessages([
        { role: 'system', content: 'sys' },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: '看图' },
            { type: 'input_image', image_url: 'data:image/png;base64,xx' },
            { type: 'input_image', file_id: 'file-1' },
          ],
        },
        {
          role: 'assistant',
          content: '半句',
          prefix: true,
          reasoning_content: '思路',
        },
      ]),
    ).toEqual([
      { role: 'system', content: 'sys' },
      {
        role: 'user',
        content: [
          { type: 'text', text: '看图' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,xx' },
          },
          { type: 'image_url', image_url: { url: 'file-1' } },
        ],
      },
      {
        role: 'assistant',
        content: '半句',
        prefix: true,
        reasoning_content: '思路',
      },
    ]);
  });

  it('走 /beta Chat Completions 而不是 Responses', async () => {
    createChatStream({
      apiKey: 'key',
      model: 'deepseek-v4-pro',
      messages: prefixMessages,
      webSearch: true,
      onEvent: vi.fn(),
    });
    await flushAsync();

    expect(OpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://api.deepseek.com/beta',
      }),
    );
    expect(mockChatCreate).toHaveBeenCalledOnce();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockChatCreate.mock.calls[0][0].tools).toBeUndefined();
    expect(mockChatCreate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        model: 'deepseek-v4-pro',
        stream: true,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: '半句', prefix: true },
        ],
      }),
    );
  });

  it('reasoning_content / content delta 映射到 thinking 与 content', async () => {
    const onEvent = vi.fn();
    mockChatCreate.mockResolvedValue(
      fromEventsOpen([
        { choices: [{ delta: { reasoning_content: '续想' } }] },
        { choices: [{ delta: { content: '下文' } }] },
      ]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: prefixMessages,
      onEvent,
    });
    await flushAsync();
    vi.advanceTimersByTime(16);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'thinking',
      text: '续想',
    });
    vi.advanceTimersByTime(16);
    expect(onEvent).toHaveBeenCalledWith({ type: 'content', text: '下文' });
  });

  it('prefix 流结束发出 done', async () => {
    const onEvent = vi.fn();
    mockChatCreate.mockResolvedValue(
      fromEvents([{ choices: [{ delta: { content: '完' } }] }]),
    );

    createChatStream({
      apiKey: 'key',
      model: 'model',
      messages: prefixMessages,
      onEvent,
    });
    await flushAsync();

    expect(onEvent).toHaveBeenCalledWith({ type: 'content', text: '完' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'done' });
  });
});
