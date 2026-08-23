import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { MessageNode } from '@/stores/models';
import {
  resolveActivity,
  toActivityView,
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
        {isActive && (
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-foreground/60" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {view.map((item) => {
            if (item.type === 'thinking') {
              return (
                <div
                  key={`t-${item.text.length}-${item.text.slice(0, 24)}`}
                  className="border-l-2 border-border/60 pl-3 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground"
                >
                  {item.text}
                </div>
              );
            }
            const callKey = item.calls.map((c) => c.id).join('-');
            if (item.type === 'search') {
              return (
                <SearchPagesRow
                  key={`s-${callKey}`}
                  calls={item.calls}
                  citations={message.citations}
                />
              );
            }
            if (item.type === 'open_page') {
              return (
                <BrowsePagesRow
                  key={`p-${callKey}`}
                  calls={item.calls}
                  citations={message.citations}
                />
              );
            }
            return <FindInPageRow key={`f-${callKey}`} calls={item.calls} />;
          })}
          {isActive && (
            <span className="inline-block animate-pulse text-xs text-muted-foreground">
              ▊
            </span>
          )}
        </div>
      )}
    </div>
  );
});
