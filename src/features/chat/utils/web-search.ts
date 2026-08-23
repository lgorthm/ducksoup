import type {
  UrlCitation,
  WebSearchAction,
  WebSearchCall,
  WebSearchCallStatus,
} from '@/features/chat/types/deepseek';
import type { MessageActivityItem } from '@/stores/models';

const STATUSES = new Set<WebSearchCallStatus>([
  'in_progress',
  'searching',
  'completed',
  'failed',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toWebSearchAction(value: unknown): WebSearchAction | undefined {
  if (!isRecord(value) || typeof value.type !== 'string') return undefined;
  if (value.type === 'search') {
    const sources = Array.isArray(value.sources)
      ? value.sources.flatMap((source) => {
          if (!isRecord(source) || typeof source.url !== 'string') return [];
          return [{ type: 'url' as const, url: source.url }];
        })
      : undefined;
    const queries = Array.isArray(value.queries)
      ? value.queries.filter((q): q is string => typeof q === 'string')
      : undefined;
    return {
      type: 'search',
      ...(typeof value.query === 'string' ? { query: value.query } : {}),
      ...(queries && queries.length > 0 ? { queries } : {}),
      ...(sources && sources.length > 0 ? { sources } : {}),
    };
  }
  if (value.type === 'open_page') {
    return {
      type: 'open_page',
      url: typeof value.url === 'string' ? value.url : null,
    };
  }
  if (value.type === 'find_in_page' && typeof value.url === 'string') {
    return {
      type: 'find_in_page',
      url: value.url,
      pattern: typeof value.pattern === 'string' ? value.pattern : '',
    };
  }
  return undefined;
}

export function toWebSearchCall(item: unknown): WebSearchCall | null {
  if (!isRecord(item) || item.type !== 'web_search_call') return null;
  if (typeof item.id !== 'string' || !item.id) return null;
  const status = STATUSES.has(item.status as WebSearchCallStatus)
    ? (item.status as WebSearchCallStatus)
    : 'in_progress';
  const action = toWebSearchAction(item.action);
  return {
    id: item.id,
    status,
    ...(action ? { action } : {}),
  };
}

export function toUrlCitation(annotation: unknown): UrlCitation | null {
  if (!isRecord(annotation) || annotation.type !== 'url_citation') return null;
  if (typeof annotation.url !== 'string' || !annotation.url) return null;
  return {
    type: 'url_citation',
    url: annotation.url,
    ...(typeof annotation.title === 'string'
      ? { title: annotation.title }
      : {}),
    ...(typeof annotation.start_index === 'number'
      ? { start_index: annotation.start_index }
      : {}),
    ...(typeof annotation.end_index === 'number'
      ? { end_index: annotation.end_index }
      : {}),
  };
}

export function mergeWebSearchCall(
  prev: WebSearchCall | undefined,
  next: WebSearchCall,
): WebSearchCall {
  if (!prev) return next;
  return {
    id: next.id,
    status: next.status || prev.status,
    action: next.action ?? prev.action,
  };
}

export function upsertWebSearchCalls(
  calls: WebSearchCall[] | undefined,
  next: WebSearchCall,
): WebSearchCall[] {
  const list = calls ? [...calls] : [];
  const idx = list.findIndex((c) => c.id === next.id);
  if (idx >= 0) {
    list[idx] = mergeWebSearchCall(list[idx], next);
  } else {
    list.push(next);
  }
  return list;
}

export function appendCitation(
  citations: UrlCitation[] | undefined,
  next: UrlCitation,
): UrlCitation[] {
  const list = citations ? [...citations] : [];
  const exists = list.some(
    (c) =>
      c.url === next.url &&
      c.start_index === next.start_index &&
      c.end_index === next.end_index,
  );
  if (!exists) list.push(next);
  return list;
}

export interface WebSearchSource {
  url: string;
  title?: string;
}

export function collectWebSearchSources(
  calls: WebSearchCall[],
  citations?: UrlCitation[],
): WebSearchSource[] {
  const seen = new Map<string, WebSearchSource>();
  const add = (url: string, title?: string) => {
    if (!url) return;
    const existing = seen.get(url);
    if (!existing) {
      seen.set(url, title ? { url, title } : { url });
      return;
    }
    if (!existing.title && title) existing.title = title;
  };
  for (const call of calls) {
    const action = call.action;
    if (!action) continue;
    if (action.type === 'search') {
      for (const source of action.sources ?? []) add(source.url);
    } else if (action.type === 'open_page' && action.url) {
      add(action.url);
    } else if (action.type === 'find_in_page') {
      add(action.url);
    }
  }
  for (const citation of citations ?? []) {
    add(citation.url, citation.title);
  }
  return [...seen.values()];
}

export function appendThinkingActivity(
  activity: MessageActivityItem[] | undefined,
  text: string,
): MessageActivityItem[] {
  if (!text) return activity ? [...activity] : [];
  const list = activity ? [...activity] : [];
  const last = list[list.length - 1];
  if (last?.type === 'thinking') {
    list[list.length - 1] = { type: 'thinking', text: last.text + text };
  } else {
    list.push({ type: 'thinking', text });
  }
  return list;
}

export function appendWebSearchActivity(
  activity: MessageActivityItem[] | undefined,
  callId: string,
): MessageActivityItem[] {
  const list = activity ? [...activity] : [];
  const last = list[list.length - 1];
  if (last?.type === 'web_search' && last.callId === callId) {
    return list;
  }
  list.push({ type: 'web_search', callId });
  return list;
}

export function resolveActivity(message: {
  activity?: MessageActivityItem[];
  reasoningContent?: string;
  webSearchCalls?: WebSearchCall[];
}): MessageActivityItem[] {
  if (message.activity && message.activity.length > 0) {
    return message.activity;
  }
  const items: MessageActivityItem[] = [];
  if (message.reasoningContent) {
    items.push({ type: 'thinking', text: message.reasoningContent });
  }
  for (const call of message.webSearchCalls ?? []) {
    items.push({ type: 'web_search', callId: call.id });
  }
  return items;
}

export type ActivityViewItem =
  | { type: 'thinking'; text: string }
  | { type: 'search'; calls: WebSearchCall[] }
  | { type: 'open_page'; calls: WebSearchCall[] }
  | { type: 'find_in_page'; calls: WebSearchCall[] };

function actionKind(
  call: WebSearchCall | undefined,
): 'search' | 'open_page' | 'find_in_page' {
  const t = call?.action?.type;
  if (t === 'open_page' || t === 'find_in_page' || t === 'search') return t;
  return 'search';
}

export function toActivityView(
  activity: MessageActivityItem[],
  calls: WebSearchCall[] | undefined,
): ActivityViewItem[] {
  const byId = new Map((calls ?? []).map((c) => [c.id, c]));
  const view: ActivityViewItem[] = [];
  for (const item of activity) {
    if (item.type === 'thinking') {
      if (item.text) view.push({ type: 'thinking', text: item.text });
      continue;
    }
    const call = byId.get(item.callId) ?? {
      id: item.callId,
      status: 'in_progress' as const,
    };
    const kind = actionKind(call);
    const last = view[view.length - 1];
    if (last && last.type !== 'thinking' && last.type === kind) {
      last.calls.push(call);
    } else {
      view.push({ type: kind, calls: [call] });
    }
  }
  return view;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function faviconUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  } catch {
    return null;
  }
}

export function webSearchQueryText(action: WebSearchAction): string {
  if (action.type === 'search') {
    if (action.query) return action.query;
    if (action.queries && action.queries.length > 0) {
      return action.queries.join(' · ');
    }
    return '';
  }
  if (action.type === 'open_page') return action.url ?? '';
  return action.pattern ? `${action.pattern} · ${action.url}` : action.url;
}
