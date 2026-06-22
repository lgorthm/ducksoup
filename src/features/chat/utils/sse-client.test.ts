import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSSEConnection } from './sse-client';

// ========== 辅助 ==========

function encodeChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function mockResponse(
  chunks: string[],
  status = 200,
  statusText = 'OK',
): Response {
  return new Response(encodeChunks(chunks), {
    status,
    statusText,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ========== SSE 协议解析 ==========

describe('SSE 协议解析', () => {
  it('解析 data 行为 JSON 对象', async () => {
    const onEvent = vi.fn();
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(['data: {"hello":"world"}\n\n']),
    );

    createSSEConnection('https://example.com', {
      method: 'POST',
      onEvent,
      onClose,
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ data: { hello: 'world' } }),
    );
  });

  it('解析非 JSON data 为原始字符串', async () => {
    const onEvent = vi.fn();
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(['data: [DONE]\n\n']));

    createSSEConnection('https://example.com', {
      method: 'POST',
      onEvent,
      onClose,
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ data: '[DONE]' }),
    );
  });

  it('解析 event 字段', async () => {
    const onEvent = vi.fn();
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(['event: custom\ndata: {}\n\n']),
    );

    createSSEConnection('https://example.com', {
      method: 'POST',
      onEvent,
      onClose,
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'custom' }),
    );
  });

  it('解析 id 字段', async () => {
    const onEvent = vi.fn();
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(['id: 123\ndata: {}\n\n']),
    );

    createSSEConnection('https://example.com', {
      method: 'POST',
      onEvent,
      onClose,
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: '123' }),
    );
  });

  it('解析 retry 字段', async () => {
    const onEvent = vi.fn();
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(['retry: 5000\ndata: {}\n\n']),
    );

    createSSEConnection('https://example.com', {
      method: 'POST',
      onEvent,
      onClose,
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ retry: 5000 }),
    );
  });

  it('忽略注释行', async () => {
    const onEvent = vi.fn();
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse([': this is a comment\ndata: {}\n\n']),
    );

    createSSEConnection('https://example.com', {
      method: 'POST',
      onEvent,
      onClose,
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it('多行 data 用换行拼接', async () => {
    const onEvent = vi.fn();
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(['data: line1\ndata: line2\n\n']),
    );

    createSSEConnection('https://example.com', {
      method: 'POST',
      onEvent,
      onClose,
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'line1\nline2' }),
    );
  });

  it('空行触发事件分发', async () => {
    const onEvent = vi.fn();
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(['data: {"a":1}\n\ndata: {"b":2}\n\n']),
    );

    createSSEConnection('https://example.com', {
      method: 'POST',
      onEvent,
      onClose,
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it('流结束时调用 onClose', async () => {
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(['data: {}\n\n']));

    createSSEConnection('https://example.com', {
      method: 'POST',
      onClose,
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

// ========== 错误处理 ==========

describe('错误处理', () => {
  it('HTTP 非 200 触发 onError', async () => {
    const onError = vi.fn();
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(['error'], 401, 'Unauthorized'),
    );

    createSSEConnection('https://example.com', {
      method: 'POST',
      onError,
      onClose,
    });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0].message).toContain('401');
  });

  it('网络错误触发 onError', async () => {
    const onError = vi.fn();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    createSSEConnection('https://example.com', {
      method: 'POST',
      onError,
    });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0].message).toBe('Network error');
  });

  it('无响应体时触发 onError', async () => {
    const onError = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

    createSSEConnection('https://example.com', {
      method: 'POST',
      onError,
    });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
  });
});

// ========== 中止 ==========

describe('中止', () => {
  it('外部 signal abort 触发 onClose（非 onError）', async () => {
    const onError = vi.fn();
    const onClose = vi.fn();
    const abortController = new AbortController();

    // 使用一个不会自行结束的流
    vi.mocked(fetch).mockImplementationOnce(
      (_url: string, init?: RequestInit) =>
        new Promise((resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    createSSEConnection('https://example.com', {
      method: 'POST',
      signal: abortController.signal,
      onError,
      onClose,
    });

    abortController.abort();

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onError).not.toHaveBeenCalled();
  });

  it('close() 方法中止连接', async () => {
    const onClose = vi.fn();

    vi.mocked(fetch).mockImplementationOnce(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    const conn = createSSEConnection('https://example.com', {
      method: 'POST',
      onClose,
    });

    conn.close();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

// ========== 超时 ==========

describe('超时', () => {
  it('超时后中止连接', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    vi.mocked(fetch).mockImplementationOnce(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    createSSEConnection('https://example.com', {
      method: 'POST',
      timeout: 5000,
      onClose,
    });

    vi.advanceTimersByTime(5000);
    await vi.advanceTimersByTimeAsync(0);

    expect(onClose).toHaveBeenCalled();
  });
});

// ========== 重连 ==========

describe('重连', () => {
  it('错误后按指数退避重连', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const onClose = vi.fn();

    // 每次都失败
    vi.mocked(fetch).mockRejectedValue(new Error('fail'));

    createSSEConnection('https://example.com', {
      method: 'POST',
      maxRetries: 2,
      retryDelay: 1000,
      onError,
      onClose,
    });

    // 第一次失败 + 第一次重连（1000ms）
    await vi.advanceTimersByTimeAsync(0);
    vi.advanceTimersByTime(1000);
    await vi.advanceTimersByTimeAsync(0);

    // 第二次重连（2000ms）
    vi.advanceTimersByTime(2000);
    await vi.advanceTimersByTimeAsync(0);

    // 重试耗尽，触发 onError
    expect(onError).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('abort 时不重连', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const onClose = vi.fn();
    const abortController = new AbortController();

    vi.mocked(fetch).mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    createSSEConnection('https://example.com', {
      method: 'POST',
      maxRetries: 3,
      retryDelay: 1000,
      signal: abortController.signal,
      onError,
      onClose,
    });

    abortController.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(onClose).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('连接成功后重置重试计数', async () => {
    vi.useFakeTimers();
    const onEvent = vi.fn();
    const onClose = vi.fn();

    // 第一次失败，第二次成功
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(mockResponse(['data: {}\n\n']));

    createSSEConnection('https://example.com', {
      method: 'POST',
      maxRetries: 3,
      retryDelay: 1000,
      onEvent,
      onClose,
    });

    await vi.advanceTimersByTimeAsync(0);
    vi.advanceTimersByTime(1000);
    await vi.advanceTimersByTimeAsync(0);

    expect(onEvent).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

// ========== 请求配置 ==========

describe('请求配置', () => {
  it('默认使用 POST 方法', async () => {
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(['data: {}\n\n']));

    createSSEConnection('https://example.com', { onClose });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('传递自定义 headers', async () => {
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(['data: {}\n\n']));

    createSSEConnection('https://example.com', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      onClose,
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token');
    expect(headers.Accept).toBe('text/event-stream');
  });

  it('传递 body', async () => {
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(['data: {}\n\n']));

    createSSEConnection('https://example.com', {
      method: 'POST',
      body: '{"key":"value"}',
      onClose,
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('{"key":"value"}');
  });
});
