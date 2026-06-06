import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { ChatMessage } from '@/features/chat/components/chat-message';
import { ChatInput } from '@/features/chat/components/chat-input';
import { ChatWelcome } from '@/features/chat/components/chat-welcome';
import { useChatStore } from '@/features/chat/store/chat-store';

export function ChatArea() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const error = useChatStore((s) => s.error);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return <ChatWelcome />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* 消息区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex w-full max-w-[776px] flex-col gap-4">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              思考中...
            </div>
          )}
          {error && (
            <div className="rounded-none bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* 输入区域 */}
      <div className="mx-auto w-full max-w-[776px] px-4">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
