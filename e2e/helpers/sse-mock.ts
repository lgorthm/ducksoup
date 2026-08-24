import type { Page, Route } from '@playwright/test';

const DEEPSEEK_API_URL = /api\.deepseek\.com(?:\/v1)?\/responses/;
const DEEPSEEK_CHAT_COMPLETIONS_URL =
  /api\.deepseek\.com(?:\/beta)?(?:\/v1)?\/chat\/completions/;

interface SSEMockWebSearchCall {
  id?: string;
  action?: {
    type: 'search' | 'open_page' | 'find_in_page';
    query?: string;
    url?: string;
    pattern?: string;
    sources?: Array<{ type: 'url'; url: string }>;
  };
}

interface SSEMockOptions {
  thinking?: string[];
  content?: string[];
  usage?: { input_tokens: number; output_tokens: number };
  delayMs?: number;
  /** 相邻 SSE 事件之间的间隔。用于测试流式增高过程中的滚动，不改变 delayMs 挂起语义。 */
  chunkDelayMs?: number;
  status?: number;
  errorMessage?: string;
  webSearch?: SSEMockWebSearchCall[];
  citations?: Array<{
    url: string;
    title?: string;
    start_index?: number;
    end_index?: number;
  }>;
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

type SseBodyOptions = Required<
  Omit<
    SSEMockOptions,
    'status' | 'errorMessage' | 'webSearch' | 'citations' | 'chunkDelayMs'
  >
>;

function buildSSEBody(
  options: SseBodyOptions & Pick<SSEMockOptions, 'webSearch' | 'citations'>,
): string {
  const { thinking, content, usage, webSearch = [], citations = [] } = options;
  let seq = 1;
  const parts: string[] = [];
  for (const [index, call] of webSearch.entries()) {
    const id = call.id ?? `ws_${index + 1}`;
    const action = call.action ?? { type: 'search' as const, query: 'query' };
    parts.push(
      sseEvent(
        'response.output_item.added',
        {
          item: {
            type: 'web_search_call',
            id,
            status: 'in_progress',
            action,
          },
        },
        seq++,
      ),
      sseEvent('response.web_search_call.searching', { item_id: id }, seq++),
      sseEvent(
        'response.output_item.done',
        {
          item: {
            type: 'web_search_call',
            id,
            status: 'completed',
            action,
          },
        },
        seq++,
      ),
      sseEvent('response.web_search_call.completed', { item_id: id }, seq++),
    );
  }
  parts.push(
    ...thinking.map((delta) =>
      sseEvent('response.reasoning_text.delta', { delta }, seq++),
    ),
    ...content.map((delta) =>
      sseEvent('response.output_text.delta', { delta }, seq++),
    ),
  );
  for (const [index, citation] of citations.entries()) {
    parts.push(
      sseEvent(
        'response.output_text.annotation.added',
        {
          annotation: {
            type: 'url_citation',
            url: citation.url,
            title: citation.title ?? citation.url,
            start_index: citation.start_index ?? index,
            end_index: citation.end_index ?? index + 1,
          },
        },
        seq++,
      ),
    );
  }
  parts.push(sseEvent('response.completed', { response: { usage } }, seq++));
  return parts.join('');
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

function buildChatCompletionsSSEBody(options: SseBodyOptions): string {
  const { thinking, content } = options;
  const chunks: string[] = [];
  for (const delta of thinking) {
    chunks.push(
      `data: ${JSON.stringify({
        id: 'chatcmpl-e2e',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { reasoning_content: delta } }],
      })}\n\n`,
    );
  }
  for (const delta of content) {
    chunks.push(
      `data: ${JSON.stringify({
        id: 'chatcmpl-e2e',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { content: delta } }],
      })}\n\n`,
    );
  }
  chunks.push('data: [DONE]\n\n');
  return chunks.join('');
}

/** delay 模式：在页面里拦截 fetch，立刻吐出非终止 chunk 后挂起连接。 */
async function hangSseInPage(
  page: Page,
  urlPattern: string,
  body: string,
): Promise<void> {
  const parts = body
    .split('\n\n')
    .filter(Boolean)
    .map((part) => `${part}\n\n`);
  const liveBody = parts.slice(0, -1).join('');
  await page.evaluate(
    ({ urlPattern, liveBody }) => {
      const orig = window.fetch.bind(window);
      const re = new RegExp(urlPattern);
      window.fetch = async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (!re.test(url)) return orig(input, init);
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(liveBody));
            const onAbort = () => {
              try {
                controller.close();
              } catch {
                // already closed
              }
            };
            if (init?.signal?.aborted) {
              onAbort();
              return;
            }
            init?.signal?.addEventListener('abort', onAbort, { once: true });
            setTimeout(onAbort, 20000);
          },
        });
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        });
      };
    },
    { urlPattern, liveBody },
  );
}

/** 按事件间隔推送 SSE，用于流式过程中的交互（上滑、停止等）。 */
async function streamSseInPage(
  page: Page,
  urlPattern: string,
  body: string,
  chunkDelayMs: number,
): Promise<void> {
  const parts = body
    .split('\n\n')
    .filter(Boolean)
    .map((part) => `${part}\n\n`);
  await page.evaluate(
    ({ urlPattern, parts, chunkDelayMs }) => {
      const orig = window.fetch.bind(window);
      const re = new RegExp(urlPattern);
      window.fetch = async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (!re.test(url)) return orig(input, init);
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const onAbort = () => {
              try {
                controller.close();
              } catch {
                // already closed
              }
            };
            if (init?.signal?.aborted) {
              onAbort();
              return;
            }
            init?.signal?.addEventListener('abort', onAbort, { once: true });
            for (const part of parts) {
              if (init?.signal?.aborted) break;
              controller.enqueue(encoder.encode(part));
              await new Promise<void>((resolve) => {
                setTimeout(resolve, chunkDelayMs);
              });
            }
            onAbort();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        });
      };
    },
    { urlPattern, parts, chunkDelayMs },
  );
}

async function fulfillSse(
  page: Page,
  url: RegExp,
  body: string,
  delayMs: number,
  chunkDelayMs = 0,
): Promise<void> {
  if (chunkDelayMs > 0) {
    await streamSseInPage(page, url.source, body, chunkDelayMs);
    return;
  }
  if (delayMs > 0) {
    await hangSseInPage(page, url.source, body);
    return;
  }
  await page.route(url, (route: Route) => {
    route.fulfill({
      status: 200,
      headers: SSE_HEADERS,
      body,
    });
  });
}

export async function mockDeepSeekSSE(
  page: Page,
  options: SSEMockOptions = {},
): Promise<void> {
  const {
    thinking = ['正在思考...', '分析问题中...'],
    content = ['你好', '！我是', 'DeepSeek'],
    usage = { input_tokens: 10, output_tokens: 5 },
    delayMs = 0,
    chunkDelayMs = 0,
    webSearch = [],
    citations = [],
  } = options;

  const body = buildSSEBody({
    thinking,
    content,
    usage,
    delayMs,
    webSearch,
    citations,
  });
  await fulfillSse(page, DEEPSEEK_API_URL, body, delayMs, chunkDelayMs);
}

export async function mockDeepSeekPrefixSSE(
  page: Page,
  options: SSEMockOptions = {},
): Promise<void> {
  const {
    thinking = [],
    content = ['续写内容'],
    usage = { input_tokens: 10, output_tokens: 5 },
    delayMs = 0,
  } = options;
  const body = buildChatCompletionsSSEBody({
    thinking,
    content,
    usage,
    delayMs,
  });
  await fulfillSse(page, DEEPSEEK_CHAT_COMPLETIONS_URL, body, delayMs);
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
  await page.unroute(DEEPSEEK_CHAT_COMPLETIONS_URL);
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
