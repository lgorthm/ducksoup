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

export async function mockDeepSeekSSE(
  page: Page,
  options: SSEMockOptions = {},
): Promise<void> {
  const {
    thinking = ['正在思考...', '分析问题中...'],
    content = ['你好', '！我是', 'DeepSeek'],
    usage = { prompt_tokens: 10, completion_tokens: 5 },
    delayMs = 10,
  } = options;

  await page.route(DEEPSEEK_API_URL, async (route: Route) => {
    const chunks: string[] = [
      ...thinking.map((t) => sseData(chunk({ reasoning_content: t }))),
      ...content.map((c) => sseData(chunk({ content: c }))),
      sseData(chunk({}, usage)),
      sseData('[DONE]'),
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const data of chunks) {
          controller.enqueue(encoder.encode(data));
          if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
        controller.close();
      },
    });

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: stream,
    });
  });
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
