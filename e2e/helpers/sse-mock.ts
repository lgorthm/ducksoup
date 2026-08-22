import type { Page, Route } from '@playwright/test';

const DEEPSEEK_API_URL = /api\.deepseek\.com(?:\/v1)?\/responses/;

interface SSEMockOptions {
  thinking?: string[];
  content?: string[];
  usage?: { input_tokens: number; output_tokens: number };
  delayMs?: number;
  status?: number;
  errorMessage?: string;
}

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

function buildSSEBody(
  options: Required<Omit<SSEMockOptions, 'status' | 'errorMessage'>>,
): string {
  const { thinking, content, usage } = options;
  let seq = 1;
  const parts: string[] = [
    ...thinking.map((delta) =>
      sseEvent('response.reasoning_text.delta', { delta }, seq++),
    ),
    ...content.map((delta) =>
      sseEvent('response.output_text.delta', { delta }, seq++),
    ),
    sseEvent('response.completed', { response: { usage } }, seq++),
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
    usage = { input_tokens: 10, output_tokens: 5 },
    delayMs = 0,
  } = options;

  const body = buildSSEBody({ thinking, content, usage, delayMs });

  if (delayMs > 0) {
    await page.route(DEEPSEEK_API_URL, async (route: Route) => {
      const encoder = new TextEncoder();
      const parts = body
        .split('\n\n')
        .filter(Boolean)
        .map((part) => `${part}\n\n`);
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
        // Playwright supports ReadableStream bodies at runtime, but its
        // types still declare string | Buffer only.
        body: stream as unknown as Buffer,
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

export async function mockDeepSeekFiles(page: Page): Promise<void> {
  await page.route(/api\.deepseek\.com(?:\/v1)?\/files/, (route: Route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'file-api-e2e',
          object: 'file',
          bytes: 1024,
          created_at: Math.floor(Date.now() / 1000),
          filename: 'image.png',
          purpose: 'user_data',
        }),
      });
      return;
    }
    route.fulfill({ status: 200, body: '{}' });
  });
}
