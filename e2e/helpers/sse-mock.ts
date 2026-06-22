import type { Page, Route } from '@playwright/test';

const DEEPSEEK_API_URL = '**/api.deepseek.com/chat/completions';

interface SSEMockOptions {
  thinking?: string[];
  content?: string[];
  usage?: { prompt_tokens: number; completion_tokens: number };
  delayMs?: number;
  status?: number;
  errorMessage?: string;
}

function sseData(data: string): string {
  return `data: ${data}\n\n`;
}

function chunk(
  delta: Record<string, string>,
  usage?: Record<string, number>,
): string {
  return JSON.stringify({
    id: 'mock-chatcmpl',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'test-model',
    choices: usage ? [] : [{ index: 0, delta, finish_reason: null }],
    ...(usage ? { usage } : {}),
  });
}

function buildSSEBody(
  options: Required<Omit<SSEMockOptions, 'status' | 'errorMessage'>>,
): string {
  const { thinking, content, usage } = options;
  const parts: string[] = [
    ...thinking.map((t) => sseData(chunk({ reasoning_content: t }))),
    ...content.map((c) => sseData(chunk({ content: c }))),
    sseData(chunk({}, usage)),
    sseData('[DONE]'),
  ];
  return parts.join('');
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

export async function mockDeepSeekSSE(
  page: Page,
  options: SSEMockOptions = {},
): Promise<void> {
  const {
    thinking = ['正在思考...', '分析问题中...'],
    content = ['你好', '！我是', 'DeepSeek'],
    usage = { prompt_tokens: 10, completion_tokens: 5 },
    delayMs = 0,
  } = options;

  const body = buildSSEBody({ thinking, content, usage, delayMs });

  if (delayMs > 0) {
    await page.route(DEEPSEEK_API_URL, async (route: Route) => {
      const encoder = new TextEncoder();
      const parts = body.match(/data:.*\n\n/gs) ?? [body];
      const stream = new ReadableStream({
        start(controller) {
          let i = 0;
          const sendNext = () => {
            if (i >= parts.length) {
              controller.close();
              return;
            }
            controller.enqueue(encoder.encode(parts[i]));
            i++;
            setTimeout(sendNext, delayMs);
          };
          sendNext();
        },
      });
      await route.fulfill({
        status: 200,
        headers: SSE_HEADERS,
        body: stream,
      });
    });
  } else {
    await page.route(DEEPSEEK_API_URL, (route: Route) => {
      route.fulfill({
        status: 200,
        headers: SSE_HEADERS,
        body,
      });
    });
  }
}

export async function mockDeepSeekError(
  page: Page,
  status: number,
  message: string,
): Promise<void> {
  await page.route(DEEPSEEK_API_URL, (route: Route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { message, type: 'invalid_request_error' },
      }),
    });
  });
}

export async function mockDeepSeekNetworkError(page: Page): Promise<void> {
  await page.route(DEEPSEEK_API_URL, (route: Route) => {
    route.abort();
  });
}

export async function unmockDeepSeek(page: Page): Promise<void> {
  await page.unroute(DEEPSEEK_API_URL);
}
