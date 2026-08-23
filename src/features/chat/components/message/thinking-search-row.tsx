import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, FileText, Search } from 'lucide-react';
import type { UrlCitation, WebSearchCall } from '@/stores/models';
import {
  collectWebSearchSources,
  faviconUrl,
  hostnameOf,
  webSearchQueryText,
} from '@/features/chat/utils/web-search';

const PAGE_PREVIEW = 4;

function Favicon({ url, title }: { url: string; title?: string }) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(url);
  const host = hostnameOf(url);
  const letter = (title || host).slice(0, 1).toUpperCase();
  return (
    <a
      data-testid="web-search-source"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={title || host}
      className="inline-flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-background"
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="size-full"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[8px] leading-none text-muted-foreground">
          {letter}
        </span>
      )}
    </a>
  );
}

export function SearchPagesRow({
  calls,
  citations,
}: {
  calls: WebSearchCall[];
  citations?: UrlCitation[];
}) {
  const { t } = useTranslation();
  const sources = collectWebSearchSources(calls, citations);
  const query = calls
    .map((c) => (c.action ? webSearchQueryText(c.action) : ''))
    .find(Boolean);
  const count = sources.length || calls.length;

  return (
    <div
      data-testid="thinking-search-row"
      className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
    >
      <Search className="size-3.5 shrink-0" />
      <span>{t('chat.message.searchedPages', { count })}</span>
      {sources.length > 0 ? (
        <span className="inline-flex items-center gap-0.5">
          {sources.map((s) => (
            <Favicon key={s.url} url={s.url} title={s.title} />
          ))}
        </span>
      ) : query ? (
        <span className="text-muted-foreground/80">{query}</span>
      ) : null}
    </div>
  );
}

export function BrowsePagesRow({
  calls,
  citations,
}: {
  calls: WebSearchCall[];
  citations?: UrlCitation[];
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const sources = collectWebSearchSources(calls, citations);
  const visible = showAll ? sources : sources.slice(0, PAGE_PREVIEW);
  const hidden = sources.length - visible.length;

  return (
    <div
      data-testid="thinking-browse-row"
      className="space-y-1 text-xs text-muted-foreground"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <FileText className="size-3.5 shrink-0" />
        <span>{t('chat.message.browsedPages', { count: sources.length })}</span>
        {visible.map((s) => (
          <a
            key={s.url}
            data-testid="web-search-source"
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-48 items-center gap-0.5 truncate underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            {s.title || hostnameOf(s.url)}
            <ArrowUpRight className="size-3 shrink-0" />
          </a>
        ))}
        {hidden > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded-full border px-1.5 py-0.5 text-[10px] hover:bg-muted"
          >
            {t('chat.message.viewAll')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function FindInPageRow({ calls }: { calls: WebSearchCall[] }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      {calls.map((call) => {
        const detail = call.action ? webSearchQueryText(call.action) : '';
        return (
          <div
            key={call.id}
            data-testid="thinking-find-row"
            className="flex items-center gap-1.5"
          >
            <Search className="size-3.5 shrink-0" />
            <span>{t('chat.message.webSearchFindInPage')}</span>
            {detail ? <span>{detail}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
