import { http, HttpResponse } from 'msw';

const DEEPSEEK_API = /^https:\/\/api\.deepseek\.com(?:\/v1)?\/responses$/;
const DEEPSEEK_FILES_API = /^https:\/\/api\.deepseek\.com(?:\/v1)?\/files$/;
const DEEPSEEK_BALANCE_API = 'https://api.deepseek.com/user/balance';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

function sseEvent(
  type: string,
  payload: Record<string, unknown>,
  sequence: number,
): string {
  return `event: ${type}\ndata: ${JSON.stringify({
    type,
    sequence_number: sequence,
    ...payload,
  })}\n\n`;
}

/**
 * 默认流式响应：思考过程 + 正文内容 + 完成
 */
function createStreamingResponse(
  options: {
    thinking?: string[];
    content?: string[];
    usage?: { input_tokens: number; output_tokens: number };
  } = {},
): ReadableStream<Uint8Array> {
  const {
    thinking = ['正在思考...', '分析问题中...'],
    content = ['你好', '！我是', 'DeepSeek'],
    usage = { input_tokens: 10, output_tokens: 5 },
  } = options;

  const encoder = new TextEncoder();
  let seq = 1;
  const chunks: string[] = [
    ...thinking.map((delta) =>
      sseEvent('response.reasoning_text.delta', { delta }, seq++),
    ),
    ...content.map((delta) =>
      sseEvent('response.output_text.delta', { delta }, seq++),
    ),
    sseEvent('response.completed', { response: { usage } }, seq++),
  ];

  return new ReadableStream({
    start(controller) {
      for (const data of chunks) {
        controller.enqueue(encoder.encode(data));
      }
      controller.close();
    },
  });
}

function streamingHttpResponse(
  options?: Parameters<typeof createStreamingResponse>[0],
) {
  return new HttpResponse(createStreamingResponse(options), {
    headers: SSE_HEADERS,
  });
}

export const deepseekHandlers = [
  http.post(DEEPSEEK_API, () => streamingHttpResponse()),
  http.post(DEEPSEEK_FILES_API, async () =>
    HttpResponse.json({
      id: 'file-api-test',
      object: 'file',
      bytes: 1024,
      created_at: Math.floor(Date.now() / 1000),
      filename: 'image.png',
      purpose: 'user_data',
    }),
  ),
];

/**
 * 创建自定义流式响应（供测试用例按需定制）
 */
export function mockDeepSeekStream(
  options: Parameters<typeof createStreamingResponse>[0],
) {
  return http.post(DEEPSEEK_API, () => streamingHttpResponse(options));
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

/**
 * 默认余额查询响应
 */
const defaultBalanceResponse = {
  is_available: true,
  balance_infos: [
    {
      currency: 'CNY',
      total_balance: '110.00',
      granted_balance: '10.00',
      topped_up_balance: '100.00',
    },
  ],
};

export const balanceHandlers = [
  http.get(DEEPSEEK_BALANCE_API, () =>
    HttpResponse.json(defaultBalanceResponse),
  ),
];

/**
 * 创建自定义余额查询响应（供测试用例按需定制）
 */
export function mockBalanceResponse(response: typeof defaultBalanceResponse) {
  return http.get(DEEPSEEK_BALANCE_API, () => HttpResponse.json(response));
}

/**
 * 创建余额查询错误响应
 */
export function mockBalanceError(status: number, message: string) {
  return http.get(DEEPSEEK_BALANCE_API, () =>
    HttpResponse.json(
      { error: { message, type: 'invalid_request_error' } },
      { status },
    ),
  );
}

/**
 * 创建余额查询网络错误响应
 */
export function mockBalanceNetworkError() {
  return http.get(DEEPSEEK_BALANCE_API, () => HttpResponse.error());
}
