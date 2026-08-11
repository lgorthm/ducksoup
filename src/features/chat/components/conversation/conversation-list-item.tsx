import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { switchConversation } from '@/stores/actions';
import type { Conversation } from '@/features/chat/types/deepseek';

interface ConversationListItemProps {
  conversation: Conversation;
  /** 是否为当前激活会话 */
  isActive: boolean;
  /** 移动端（主输入不可 hover）菜单按钮常显；非激活项展示禁用态占位 */
  isMobile: boolean;
  /** 请求删除（由列表层弹出确认框） */
  onRequestDelete: (id: string) => void;
}

export function ConversationListItem({
  conversation,
  isActive,
  isMobile,
  onRequestDelete,
}: ConversationListItemProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="conversation-item"
      data-conv-id={conversation.id}
      className={cn(
        'group/item flex cursor-pointer items-center rounded-lg px-2 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-amber-400/15 text-sidebar-accent-foreground dark:bg-sidebar-accent'
          : 'hover:bg-sidebar-accent/50',
      )}
      onClick={() => switchConversation(conversation.id)}
    >
      <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
      {isMobile && !isActive ? (
        <button
          type="button"
          disabled
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg opacity-30"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  'inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-sidebar-accent-foreground/15',
                  isMobile || isActive
                    ? 'opacity-100'
                    : 'opacity-0 group-hover/item:opacity-100',
                )}
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-36"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              variant="destructive"
              data-testid="conversation-delete-menu"
              onClick={() => onRequestDelete(conversation.id)}
            >
              <Trash2 />
              {t('conversation.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
