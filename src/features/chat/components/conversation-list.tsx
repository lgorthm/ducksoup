import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useChatStore } from '@/features/chat/store/chat-store';

export function ConversationList() {
  const conversations = useChatStore((s) => s.conversations);
  const currentId = useChatStore((s) => s.currentConversationId);
  const createConversation = useChatStore((s) => s.createConversation);
  const switchConversation = useChatStore((s) => s.switchConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);

  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="mb-2 flex items-center justify-between px-2">
        <span className="text-xs font-medium text-muted-foreground">对话列表</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={createConversation}
          title="新建对话"
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {conversations.length === 0 ? (
        <div className="px-2 py-4 text-center text-xs text-muted-foreground">
          暂无对话
        </div>
      ) : (
        conversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              'group flex cursor-pointer items-center rounded-md px-2 py-1.5 text-sm transition-colors',
              conv.id === currentId
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent/50',
            )}
            onClick={() => switchConversation(conv.id)}
          >
            <span className="min-w-0 flex-1 truncate">{conv.title}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                deleteConversation(conv.id);
              }}
              title="删除对话"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
