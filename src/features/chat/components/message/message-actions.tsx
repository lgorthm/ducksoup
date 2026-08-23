import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import type { BranchInfo, MessageNode } from '@/stores/models';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Play,
  RefreshCw,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useCanHover } from '@/shared/hooks/use-media-query';
import {
  continueMessage,
  regenerateMessage,
  setEditingMessage,
  switchSibling,
} from '@/stores/actions';
import { useStore } from '@/stores';
import { useMessageActionsState } from '@/stores/selectors';

interface MessageActionsProps {
  message: MessageNode;
  branchInfo?: BranchInfo;
  isLast?: boolean;
}

export const MessageActions = memo(function MessageActions({
  message,
  branchInfo,
  isLast = false,
}: MessageActionsProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const { isLoading } = useMessageActionsState();
  const canHover = useCanHover();
  const isActive = useStore((s) => s.activeMessageId === message.id);

  const isUser = message.role === 'user';
  const showContinue = !isUser && isLast && message.status === 'aborted';
  const showBranch = !!branchInfo && branchInfo.total > 1;
  // 最后一轮与有分支的消息操作栏常显；移动端点击激活的消息同样常显
  const forceVisible = isLast || showBranch || (!canHover && isActive);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时静默失败
    }
  };

  return (
    <TooltipProvider>
      <div
        data-testid="message-actions"
        className={cn(
          'pointer-events-none mt-1 flex items-center gap-1',
          isUser ? 'justify-end' : 'justify-start',
        )}
      >
        {showBranch && (
          <div
            data-testid="message-branch-nav"
            className={cn(
              'pointer-events-auto flex items-center gap-0.5',
              isUser && 'order-last',
            )}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    data-testid="message-branch-prev"
                    aria-label={t('chat.message.branchPrev')}
                    disabled={!branchInfo?.prevSiblingId}
                    onClick={() => switchSibling(message.id, -1)}
                    className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/15 hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-foreground/15"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent side="bottom">
                {t('chat.message.branchPrev')}
              </TooltipContent>
            </Tooltip>
            <span
              data-testid="message-branch-position"
              className="min-w-7 text-center text-xs text-muted-foreground tabular-nums"
            >
              {t('chat.message.branchPosition', {
                current: branchInfo!.current,
                total: branchInfo!.total,
              })}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    data-testid="message-branch-next"
                    aria-label={t('chat.message.branchNext')}
                    disabled={!branchInfo?.nextSiblingId}
                    onClick={() => switchSibling(message.id, 1)}
                    className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/15 hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-foreground/15"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent side="bottom">
                {t('chat.message.branchNext')}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        <div
          className={cn(
            'flex items-center gap-1 transition-opacity duration-150',
            forceVisible
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100',
          )}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  data-testid="message-copy-button"
                  onClick={handleCopy}
                  aria-label={
                    copied ? t('chat.message.copied') : t('chat.message.copy')
                  }
                  className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/15 hover:text-accent-foreground dark:hover:bg-foreground/15"
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              }
            />
            <TooltipContent side="bottom">
              {copied ? t('chat.message.copied') : t('chat.message.copy')}
            </TooltipContent>
          </Tooltip>

          {isUser ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    data-testid="message-edit-button"
                    aria-label={t('chat.message.edit')}
                    disabled={isLoading}
                    onClick={() => setEditingMessage(message.id)}
                    className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/15 hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-foreground/15"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent side="bottom">
                {t('chat.message.edit')}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    data-testid="message-regenerate-button"
                    aria-label={t('chat.message.regenerate')}
                    disabled={isLoading}
                    onClick={() => regenerateMessage(message.id)}
                    className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/15 hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-foreground/15"
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent side="bottom">
                {t('chat.message.regenerate')}
              </TooltipContent>
            </Tooltip>
          )}

          {showContinue ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    data-testid="message-continue-button"
                    aria-label={t('chat.message.continue')}
                    disabled={isLoading}
                    onClick={() => continueMessage(message.id)}
                    className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/15 hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-foreground/15"
                  >
                    <Play className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent side="bottom">
                {t('chat.message.continue')}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
});
