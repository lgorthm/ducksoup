import { lazy, memo, Suspense, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import type { StoredMessage } from '@/features/chat/types/deepseek';
import { ChevronDown } from 'lucide-react';

const MarkdownRenderer = lazy(() =>
  import('@/shared/components/markdown-renderer').then((m) => ({
    default: m.MarkdownRenderer,
  })),
);

interface ChatMessageProps {
  message: StoredMessage;
  /** 是否为流式传输中（内容还未完成） */
  isStreaming?: boolean;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming = false,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasThinking =
    !!message.reasoningContent ||
    (message.thinkingSteps && message.thinkingSteps.length > 0);

  return (
    <div
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'rounded-none px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'max-w-[80%] bg-primary text-primary-foreground'
            : 'max-w-full bg-transparent text-foreground',
        )}
      >
        {isUser ? (
          <p className="wrap-break-word whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <>
            {/* 思考过程 */}
            <ThinkingSection message={message} isStreaming={isStreaming} />

            {/* 输出内容 */}
            {message.content ? (
              <Suspense
                fallback={
                  <span className="animate-pulse text-muted-foreground">▊</span>
                }
              >
                <MarkdownRenderer isStreaming={isStreaming}>
                  {message.content}
                </MarkdownRenderer>
              </Suspense>
            ) : isStreaming || hasThinking ? (
              <span className="animate-pulse text-muted-foreground">▊</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
});

// ========== 思考过程组件 ==========

interface ThinkingSectionProps {
  message: StoredMessage;
  isStreaming: boolean;
}

const ThinkingSection = memo(function ThinkingSection({
  message,
  isStreaming,
}: ThinkingSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const steps = message.thinkingSteps;
  const hasSteps = steps && steps.length > 0;

  if (!hasSteps) return null;

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
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
        <span className="font-medium">
          {isActive ? '正在思考...' : `思考过程 (${steps.length} 步)`}
        </span>
        {isActive && (
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-foreground/60" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 border-l-2 border-border/60 pl-3">
          {steps.map((step) => (
            <div key={step.index} className="group">
              <div className="mb-0.5 text-[10px] text-muted-foreground/60">
                步骤 {step.index + 1}
              </div>
              <div className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {step.content}
              </div>
            </div>
          ))}
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
