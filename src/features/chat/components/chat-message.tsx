import { cn } from '@/shared/lib/utils';
import type { StoredMessage } from '@/shared/types/deepseek';
import { MarkdownRenderer } from '@/shared/components/markdown-renderer';

interface ChatMessageProps {
  message: StoredMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-center')}
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
          <MarkdownRenderer>{message.content}</MarkdownRenderer>
        )}
      </div>
    </div>
  );
}
