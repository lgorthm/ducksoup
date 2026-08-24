import { memo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { MessageNode, UrlCitation } from '@/stores/models';
import {
  resolveActivity,
  toActivityView,
  type ActivityViewItem,
} from '@/features/chat/utils/web-search';
import {
  BrowsePagesRow,
  FindInPageRow,
  SearchPagesRow,
} from './thinking-search-row';

interface ThinkingSectionProps {
  message: MessageNode;
  isStreaming: boolean;
}

function activityViewRows(
  view: ActivityViewItem[],
  citations: UrlCitation[] | undefined,
): ReactNode[] {
  const rows: ReactNode[] = [];
  let thinkingSeq = 0;
  for (const item of view) {
    if (item.type === 'thinking') {
      rows.push(
        <div
          key={`t-${thinkingSeq++}`}
          className="border-l-2 border-primary/30 pl-3 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground"
        >
          {item.text}
        </div>,
      );
      continue;
    }
    const callKey = item.calls.map((c) => c.id).join('-');
    if (item.type === 'search') {
      rows.push(
        <SearchPagesRow
          key={`s-${callKey}`}
          calls={item.calls}
          citations={citations}
        />,
      );
      continue;
    }
    if (item.type === 'open_page') {
      rows.push(
        <BrowsePagesRow
          key={`p-${callKey}`}
          calls={item.calls}
          citations={citations}
        />,
      );
      continue;
    }
    rows.push(<FindInPageRow key={`f-${callKey}`} calls={item.calls} />);
  }
  return rows;
}

export const ThinkingSection = memo(function ThinkingSection({
  message,
  isStreaming,
}: ThinkingSectionProps) {
  const { t } = useTranslation();
  const activity = resolveActivity(message);
  const view = toActivityView(activity, message.webSearchCalls);
  const hasBody = view.length > 0;
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);

  const isActive = isStreaming && message.content.length === 0;
  const isStoppedThinking =
    message.status === 'aborted' && message.content.length === 0 && hasBody;
  const defaultExpanded = isActive || isStoppedThinking;
  const expanded = userExpanded ?? defaultExpanded;

  if (!hasBody) return null;

  const title = isActive
    ? t('chat.area.thinking')
    : isStoppedThinking
      ? t('chat.message.thinkingStopped')
      : t('chat.message.thinkingLabel');

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setUserExpanded((prev) => !(prev ?? defaultExpanded))}
        className={cn(
          'flex w-full items-center gap-2 text-left text-xs transition-colors',
          isActive
            ? 'text-foreground/80'
            : 'text-muted-foreground hover:text-foreground/70',
        )}
      >
        <ChevronRight
          className={cn(
            'size-3.5 transition-transform duration-200',
            expanded && 'rotate-90',
          )}
        />
        <span data-testid="thinking-label" className="font-medium">
          {title}
        </span>
        {isActive ? (
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-foreground/60" />
        ) : null}
      </button>

      {expanded ? (
        <div className="mt-2 space-y-2">
          {activityViewRows(view, message.citations)}
          {isActive ? (
            <span className="inline-block animate-pulse text-xs text-muted-foreground">
              ▊
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
