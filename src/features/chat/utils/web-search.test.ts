import { describe, expect, it } from 'vitest';
import {
  appendCitation,
  appendThinkingActivity,
  appendWebSearchActivity,
  collectWebSearchSources,
  mergeWebSearchCall,
  resolveActivity,
  toActivityView,
  toUrlCitation,
  toWebSearchCall,
  upsertWebSearchCalls,
  webSearchQueryText,
} from './web-search';

describe('toWebSearchCall', () => {
  it('解析 search action', () => {
    expect(
      toWebSearchCall({
        type: 'web_search_call',
        id: 'ws_1',
        status: 'completed',
        action: {
          type: 'search',
          query: 'deepseek api',
          sources: [{ type: 'url', url: 'https://api-docs.deepseek.com' }],
        },
      }),
    ).toEqual({
      id: 'ws_1',
      status: 'completed',
      action: {
        type: 'search',
        query: 'deepseek api',
        sources: [{ type: 'url', url: 'https://api-docs.deepseek.com' }],
      },
    });
  });

  it('非法 item 返回 null', () => {
    expect(toWebSearchCall(null)).toBeNull();
    expect(toWebSearchCall({ type: 'message', id: 'm1' })).toBeNull();
    expect(toWebSearchCall({ type: 'web_search_call' })).toBeNull();
  });
});

describe('toUrlCitation', () => {
  it('解析 url_citation', () => {
    expect(
      toUrlCitation({
        type: 'url_citation',
        url: 'https://example.com',
        title: 'Example',
        start_index: 0,
        end_index: 4,
      }),
    ).toEqual({
      type: 'url_citation',
      url: 'https://example.com',
      title: 'Example',
      start_index: 0,
      end_index: 4,
    });
  });

  it('非 citation 返回 null', () => {
    expect(toUrlCitation({ type: 'file_citation', url: 'x' })).toBeNull();
  });
});

describe('upsertWebSearchCalls', () => {
  it('按 id 合并并保留已有 action', () => {
    const first = upsertWebSearchCalls(undefined, {
      id: 'ws_1',
      status: 'in_progress',
      action: { type: 'search', query: 'q' },
    });
    const next = upsertWebSearchCalls(first, {
      id: 'ws_1',
      status: 'completed',
    });
    expect(next).toEqual([
      {
        id: 'ws_1',
        status: 'completed',
        action: { type: 'search', query: 'q' },
      },
    ]);
  });

  it('新 id 追加', () => {
    const merged = mergeWebSearchCall(undefined, {
      id: 'ws_2',
      status: 'searching',
    });
    expect(
      upsertWebSearchCalls([{ id: 'ws_1', status: 'completed' }], merged),
    ).toHaveLength(2);
  });
});

describe('appendCitation', () => {
  it('按 url 与下标去重', () => {
    const a = appendCitation(undefined, {
      type: 'url_citation',
      url: 'https://a.com',
      start_index: 1,
      end_index: 2,
    });
    const b = appendCitation(a, {
      type: 'url_citation',
      url: 'https://a.com',
      start_index: 1,
      end_index: 2,
    });
    expect(b).toHaveLength(1);
  });
});

describe('collectWebSearchSources', () => {
  it('合并 search sources、open_page 与 citations，citations 补 title', () => {
    const sources = collectWebSearchSources(
      [
        {
          id: 'ws_1',
          status: 'completed',
          action: {
            type: 'search',
            query: 'q',
            sources: [{ type: 'url', url: 'https://a.com' }],
          },
        },
        {
          id: 'ws_2',
          status: 'completed',
          action: { type: 'open_page', url: 'https://b.com' },
        },
      ],
      [{ type: 'url_citation', url: 'https://a.com', title: 'A' }],
    );
    expect(sources).toEqual([
      { url: 'https://a.com', title: 'A' },
      { url: 'https://b.com' },
    ]);
  });
});

describe('activity 时间线', () => {
  it('thinking 追加到末项，search 插入新项', () => {
    const a = appendThinkingActivity(undefined, '先');
    const b = appendThinkingActivity(a, '想');
    const c = appendWebSearchActivity(b, 'ws_1');
    const d = appendWebSearchActivity(c, 'ws_1');
    const e = appendThinkingActivity(d, '再');
    expect(e).toEqual([
      { type: 'thinking', text: '先想' },
      { type: 'web_search', callId: 'ws_1' },
      { type: 'thinking', text: '再' },
    ]);
  });

  it('无 activity 时回退 reasoning + calls', () => {
    expect(
      resolveActivity({
        reasoningContent: '思路',
        webSearchCalls: [
          { id: 'ws_1', status: 'completed', action: { type: 'search' } },
        ],
      }),
    ).toEqual([
      { type: 'thinking', text: '思路' },
      { type: 'web_search', callId: 'ws_1' },
    ]);
  });

  it('连续 search call 合成一行', () => {
    const view = toActivityView(
      [
        { type: 'thinking', text: 'a' },
        { type: 'web_search', callId: 'ws_1' },
        { type: 'web_search', callId: 'ws_2' },
        { type: 'thinking', text: 'b' },
      ],
      [
        {
          id: 'ws_1',
          status: 'completed',
          action: { type: 'search', query: 'q1' },
        },
        {
          id: 'ws_2',
          status: 'completed',
          action: { type: 'search', query: 'q2' },
        },
      ],
    );
    expect(view).toEqual([
      { type: 'thinking', text: 'a' },
      {
        type: 'search',
        calls: [
          {
            id: 'ws_1',
            status: 'completed',
            action: { type: 'search', query: 'q1' },
          },
          {
            id: 'ws_2',
            status: 'completed',
            action: { type: 'search', query: 'q2' },
          },
        ],
      },
      { type: 'thinking', text: 'b' },
    ]);
  });
});

describe('webSearchQueryText', () => {
  it('search 优先 query 否则拼接 queries', () => {
    expect(webSearchQueryText({ type: 'search', query: 'q' })).toBe('q');
    expect(webSearchQueryText({ type: 'search', queries: ['a', 'b'] })).toBe(
      'a · b',
    );
  });
});
