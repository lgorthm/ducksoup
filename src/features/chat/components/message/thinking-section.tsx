import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { MessageNode } from '@/stores/models';

interface ThinkingSectionProps {
  message: MessageNode;
  isStreaming: boolean;
}

export const ThinkingSection = memo(function ThinkingSection({
  message,
  isStreaming,
}: ThinkingSectionProps) {
  const { t } = useTranslation();
  const isActive = isStreaming && message.content.length === 0;
  const isStoppedThinking =
    message.status === 'aborted' &&
    message.content.length === 0 &&
    !!message.reasoningContent;
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const defaultExpanded = isActive || isStoppedThinking;
  const expanded = userExpanded ?? defaultExpanded;

  const reasoning = message.reasoningContent;
  if (!reasoning) return null;

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
        <div className="mt-2 border-l-2 border-border/60 pl-3">
          <div className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {reasoning}
          </div>
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
