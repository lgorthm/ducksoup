/**
 * SSE (Server-Sent Events) 客户端
 *
 * 提供通用的 SSE 连接管理、自动解析、错误处理、重连支持。
 * 遵循标准的 SSE 协议规范 (text/event-stream)。
 */

// ========== 事件类型 ==========

export interface SSEEvent {
  /** 事件类型，默认为 "message" */
  event: string;
  /** 事件数据（已解析为 JSON 或原始字符串） */
  data: unknown;
  /** 事件 ID */
  id: string | null;
  /** 重连间隔（ms） */
  retry: number | null;
}

export interface SSEConnectionOptions {
  /** 请求方法，默认 POST */
  method?: 'GET' | 'POST';
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体（仅 POST） */
  body?: string;
  /** 连接超时（ms），默认 30000 */
  timeout?: number;
  /** 断开后自动重连的最大次数，默认 0（不重连） */
  maxRetries?: number;
  /** 重连延迟（ms），默认 1000 */
  retryDelay?: number;
  /** 收到每个事件时回调 */
  onEvent?: (event: SSEEvent) => void;
  /** 连接关闭时回调 */
  onClose?: () => void;
  /** 错误时回调 */
  onError?: (error: Error) => void;
  /** 用于中止请求的 AbortSignal */
  signal?: AbortSignal;
}

export type SSEConnection = {
  /** 关闭连接 */
  close: () => void;
  /** 当前连接状态 */
  readonly readyState: 'connecting' | 'open' | 'closed';
};

// ========== 内部工具 ==========

interface SSEParserState {
  event: string;
  data: string[];
  id: string | null;
  retry: number | null;
}

function createParser(): SSEParserState {
  return { event: '', data: [], id: null, retry: null };
}

function parseLine(state: SSEParserState, line: string): SSEEvent | null {
  // 空行表示事件结束
  if (line === '') {
    if (state.data.length === 0) return null;
    const raw = state.data.join('\n');
    const event: SSEEvent = {
      event: state.event || 'message',
      data: tryParseJSON(raw),
      id: state.id,
      retry: state.retry,
    };
    // Reset
    state.event = '';
    state.data = [];
    state.id = null;
    state.retry = null;
    return event;
  }

  // 注释行忽略
  if (line.startsWith(':')) return null;

  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;

  const field = line.slice(0, colonIdx);
  let value = line.slice(colonIdx + 1);
  // 去掉开头的空格
  if (value.startsWith(' ')) value = value.slice(1);

  switch (field) {
    case 'event':
      state.event = value;
      break;
    case 'data':
      state.data.push(value);
      break;
    case 'id':
      state.id = value;
      break;
    case 'retry': {
      const ms = parseInt(value, 10);
      if (!isNaN(ms)) state.retry = ms;
      break;
    }
  }
  return null;
}

function tryParseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// ========== 连接工厂 ==========

export function createSSEConnection(
  url: string,
  options: SSEConnectionOptions = {},
): SSEConnection {
  const {
    method = 'POST',
    headers = {},
    body,
    timeout = 30000,
    maxRetries = 0,
    retryDelay = 1000,
    onEvent,
    onClose,
    onError,
    signal,
  } = options;

  let state: 'connecting' | 'open' | 'closed' = 'connecting';
  let retryCount = 0;
  let aborted = false;
  let readerClosed = false;
  const internalAbort = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let retryTimeoutId: ReturnType<typeof setTimeout> | undefined;

  // 清理函数
  function cleanup() {
    clearTimeout(timeoutId);
    clearTimeout(retryTimeoutId);
    if (!readerClosed) {
      internalAbort.abort();
    }
  }

  async function connect() {
    if (aborted) return;
    state = 'connecting';

    const combinedSignal = signal
      ? anyAborted(signal, internalAbort.signal)
      : internalAbort.signal;

    try {
      // 超时控制
      timeoutId = setTimeout(() => {
        internalAbort.abort();
      }, timeout);

      const fetchHeaders: Record<string, string> = {
        Accept: 'text/event-stream',
        ...headers,
      };

      const init: RequestInit = {
        method,
        headers: fetchHeaders,
        signal: combinedSignal,
      };

      if (method === 'POST' && body != null) {
        init.body = body;
      }

      const response = await fetch(url, init);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `SSE 连接失败: HTTP ${response.status} ${response.statusText}${
            errorText ? ` - ${errorText}` : ''
          }`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('SSE 连接失败: 响应体不可读');
      }

      state = 'open';
      retryCount = 0; // 连接成功，重置重试计数

      const decoder = new TextDecoder();
      const parser = createParser();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          readerClosed = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // 保留最后一个可能不完整的行
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const event = parseLine(parser, line);
          if (event) {
            onEvent?.(event);
          }
        }
      }

      // 流正常结束，处理 buffer 中剩余内容
      if (buffer) {
        const event = parseLine(parser, buffer);
        if (event) onEvent?.(event);
      }
      // 触发最后的空行结束
      const finalEvent = parseLine(parser, '');
      if (finalEvent) onEvent?.(finalEvent);

      onClose?.();
      state = 'closed';
    } catch (err) {
      clearTimeout(timeoutId);

      if (combinedSignal.aborted || aborted) {
        // 主动取消，不重试
        state = 'closed';
        onClose?.();
        return;
      }

      const error =
        err instanceof Error ? err : new Error(String(err));

      // 自动重连
      if (retryCount < maxRetries && state !== 'closed') {
        retryCount++;
        const delay = retryDelay * Math.pow(2, retryCount - 1); // 指数退避
        retryTimeoutId = setTimeout(() => {
          connect();
        }, delay);
      } else {
        state = 'closed';
        onError?.(error);
        onClose?.();
      }
    }
  }

  // 监听外部 signal
  if (signal) {
    signal.addEventListener('abort', () => {
      aborted = true;
      cleanup();
    }, { once: true });
  }

  // 启动连接
  connect();

  return {
    get readyState() {
      return state;
    },
    close() {
      aborted = true;
      cleanup();
      state = 'closed';
    },
  };
}

/**
 * 如果任一 signal 已 abort，返回已 abort 的组合 signal；
 * 否则返回一个新的 signal，在任一原始 signal abort 时 abort。
 */
function anyAborted(...signals: AbortSignal[]): AbortSignal {
  for (const s of signals) {
    if (s.aborted) return s;
  }
  const controller = new AbortController();
  for (const s of signals) {
    s.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}
