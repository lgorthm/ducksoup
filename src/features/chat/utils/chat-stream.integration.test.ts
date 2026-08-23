import { describe, it, expect, vi } from 'vitest';
import { createChatStream, type ChatStreamEvent } from './chat-stream';
import { server } from '@/mocks/server';
import {
  mockDeepSeekError,
  mockDeepSeekStream,
} from '@/mocks/handlers/deepseek';

function collectEvents() {
  const events: ChatStreamEvent[] = [];
  return {
    events,
    onEvent: (event: ChatStreamEvent) => {
      events.push(event);
    },
  };
}

describe('createChatStream × MSW Responses SSE', () => {
  it('解析 reasoning / output delta 并以 done 结束', async () => {
    const { events, onEvent } = collectEvents();
    createChatStream({
      apiKey: 'test-key',
      model: 'deepseek-v4-flash-vision-exp',
      messages: [{ role: 'user', content: 'hi' }],
      onEvent,
    });

    await vi.waitFor(() => {
      expect(events.some((e) => e.type === 'done')).toBe(true);
    });

    const thinking = events
      .filter((e) => e.type === 'thinking')
      .map((e) => e.text)
      .join('');
    const content = events
      .filter((e) => e.type === 'content')
      .map((e) => e.text)
      .join('');

    expect(thinking).toBe('正在思考...分析问题中...');
    expect(content).toBe('你好！我是DeepSeek');
  });

  it('解析 web_search_call 与 url_citation', async () => {
    server.use(
      mockDeepSeekStream({
        thinking: [],
        content: ['答案'],
        webSearch: [
          {
            id: 'ws_1',
            action: {
              type: 'search',
              query: 'news',
              sources: [{ type: 'url', url: 'https://example.com' }],
            },
          },
        ],
        citations: [{ url: 'https://example.com', title: 'Example' }],
      }),
    );
    const { events, onEvent } = collectEvents();
    createChatStream({
      apiKey: 'test-key',
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'hi' }],
      webSearch: true,
      onEvent,
    });

    await vi.waitFor(() => {
      expect(events.some((e) => e.type === 'done')).toBe(true);
    });

    expect(events).toEqual(
      expect.arrayContaining([
        {
          type: 'web_search',
          call: expect.objectContaining({
            id: 'ws_1',
            action: expect.objectContaining({ type: 'search', query: 'news' }),
          }),
        },
        {
          type: 'citation',
          citation: expect.objectContaining({
            url: 'https://example.com',
            title: 'Example',
          }),
        },
        { type: 'content', text: '答案' },
      ]),
    );
  });

  it('HTTP 401 错误信息包含状态码', async () => {
    server.use(mockDeepSeekError(401, 'Invalid API key'));
    const { events, onEvent } = collectEvents();

    createChatStream({
      apiKey: 'bad-key',
      model: 'deepseek-v4-flash-vision-exp',
      messages: [{ role: 'user', content: 'hi' }],
      onEvent,
    });

    await vi.waitFor(() => {
      expect(events.some((e) => e.type === 'error')).toBe(true);
    });

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent?.type).toBe('error');
    if (errorEvent?.type === 'error') {
      expect(errorEvent.error.message).toContain('401');
    }
  });
});
