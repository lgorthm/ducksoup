import { http, HttpResponse } from 'msw';

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions';

/**
 * 构造 SSE 格式的 data 行
 */
function sseData(data: string): string {
  return `data: ${data}\n\n`;
}

/**
 * 构造模拟的 DeepSeek 流式响应 chunk
 */
function chunk(
  delta: Record<string, string>,
  usage?: Record<string, number>,
): string {
  return JSON.stringify({
    id: 'mock-chatcmpl',
    object: 'chat.completion.chunk',
    choices: usage ? [] : [{ index: 0, delta, finish_reason: null }],
    ...(usage ? { usage } : {}),
  });
}

/**
 * 默认流式响应：思考过程 + 正文内容 + 完成
 */
function createStreamingResponse(
  options: {
    thinking?: string[];
    content?: string[];
    usage?: { prompt_tokens: number; completion_tokens: number };
  } = {},
): ReadableStream<Uint8Array> {
  const {
    thinking = ['正在思考...', '分析问题中...'],
    content = ['你好', '！我是', 'DeepSeek'],
    usage = { prompt_tokens: 10, completion_tokens: 5 },
  } = options;

  const encoder = new TextEncoder();

  const chunks: string[] = [
    ...thinking.map((t) => sseData(chunk({ reasoning_content: t }))),
    ...content.map((c) => sseData(chunk({ content: c }))),
    sseData(chunk({}, usage)),
    sseData('[DONE]'),
  ];

  return new ReadableStream({
    start(controller) {
      chunks.forEach((data, i) => {
        controller.enqueue(encoder.encode(data));
        void i;
      });
      controller.close();
    },
  });
}

export const deepseekHandlers = [
  /**
   * 默认流式响应
   */
  http.post(DEEPSEEK_API, () => {
    const stream = createStreamingResponse();
    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }),
];

/**
 * 创建自定义流式响应（供测试用例按需定制）
 */
export function mockDeepSeekStream(
  options: Parameters<typeof createStreamingResponse>[0],
) {
  return http.post(DEEPSEEK_API, () => {
    const stream = createStreamingResponse(options);
    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  });
}

/**
 * 创建错误响应
 */
export function mockDeepSeekError(status: number, message: string) {
  return http.post(DEEPSEEK_API, () =>
    HttpResponse.json(
      { error: { message, type: 'invalid_request_error' } },
      { status },
    ),
  );
}

/**
 * 创建网络错误响应
 */
export function mockDeepSeekNetworkError() {
  return http.post(DEEPSEEK_API, () => HttpResponse.error());
}
