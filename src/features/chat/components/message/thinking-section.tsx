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
  const [expanded, setExpanded] = useState(false);

  const reasoning = message.reasoningContent;
  if (!reasoning) return null;

  const isActive = isStreaming && message.content.length === 0;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
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
        <span className="font-medium">
          {isActive ? t('chat.area.thinking') : t('chat.message.thinkingLabel')}
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
