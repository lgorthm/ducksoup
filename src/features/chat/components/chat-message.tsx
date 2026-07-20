import { lazy, memo, Suspense, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/shared/lib/utils';
import type { BranchInfo, StoredMessage } from '@/features/chat/types/deepseek';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ArrowUp,
  Loader2,
  Pencil,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useCanHover } from '@/shared/hooks/use-media-query';
import { useChatStore } from '@/features/chat/store/chat-store';

const MarkdownRenderer = lazy(() =>
  import('@/shared/components/markdown-renderer').then((m) => ({
    default: m.MarkdownRenderer,
  })),
);

interface ChatMessageProps {
  message: StoredMessage;
  /** 是否为流式传输中（内容还未完成） */
  isStreaming?: boolean;
  /** 当前是否处于编辑态（仅 user 消息） */
  isEditing?: boolean;
  /** 分支导航信息；total>1 时渲染 `<N/M>` */
  branchInfo?: BranchInfo;
  /** 是否为最后一条用户消息或最后一条 AI 回复，决定操作栏是否常显 */
  isLast?: boolean;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming = false,
  isEditing = false,
  branchInfo,
  isLast = false,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasThinking = !!message.reasoningContent;
  const canHover = useCanHover();
  const toggleActiveMessage = useChatStore((s) => s.toggleActiveMessage);

  // 移动端主输入不支持 hover：点击气泡切换操作栏激活态（全局同时仅一条激活）
  const handleBubbleClick =
    canHover || isStreaming || isEditing
      ? undefined
      : () => toggleActiveMessage(message.id);

  return (
    <div
      className={cn(
        'flex w-full flex-col',
        isUser ? 'items-end' : 'items-start',
      )}
    >
      <div
        onClick={handleBubbleClick}
        className={cn(
          'rounded-none px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? cn(
                isEditing ? 'w-[95%] p-0' : 'max-w-[80%]',
                'bg-primary text-primary-foreground',
              )
            : 'max-w-full bg-transparent text-foreground',
        )}
      >
        {isUser ? (
          isEditing ? (
            <EditForm message={message} />
          ) : (
            <p className="wrap-break-word whitespace-pre-wrap">
              {message.content}
            </p>
          )
        ) : (
          <>
            <ThinkingSection message={message} isStreaming={isStreaming} />

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
      {!isStreaming && !isEditing && (
        <MessageActions
          message={message}
          branchInfo={branchInfo}
          isLast={isLast}
        />
      )}
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

// ========== 内联编辑表单 ==========

interface EditFormProps {
  message: StoredMessage;
}

const EditForm = memo(function EditForm({ message }: EditFormProps) {
  const { t } = useTranslation();
  const { setEditingMessage, editMessage, isLoading } = useChatStore(
    useShallow((s) => ({
      setEditingMessage: s.setEditingMessage,
      editMessage: s.editMessage,
      isLoading: s.isLoading,
    })),
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动聚焦并将光标置于末尾
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    const len = ta.value.length;
    ta.setSelectionRange(len, len);
    autoResize(ta);
  }, []);

  const cancel = () => setEditingMessage(null);

  const send = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const value = ta.value.trim();
    if (!value || isLoading) return;
    editMessage(message.id, value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!isLoading) send();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <div
      className={cn(
        'flex w-full flex-col border border-border bg-background text-foreground transition-colors',
        'focus-within:border-primary focus-within:ring-1 focus-within:ring-primary',
      )}
    >
      <textarea
        ref={textareaRef}
        data-testid="message-edit-textarea"
        defaultValue={message.content}
        placeholder={t('chat.message.editPlaceholder')}
        disabled={isLoading}
        onKeyDown={onKeyDown}
        onInput={(e) => autoResize(e.currentTarget)}
        rows={1}
        className="min-h-8 w-full resize-none bg-transparent px-3 py-1 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
      <div className="flex items-center justify-end gap-2 px-1 py-1">
        <Button
          data-testid="message-edit-cancel"
          variant="ghost"
          size="sm"
          onClick={cancel}
          disabled={isLoading}
        >
          <X className="size-3.5" />
          {t('common.cancel')}
        </Button>
        <Button
          data-testid="message-edit-send"
          size="sm"
          onClick={send}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowUp className="size-3.5" />
          )}
          {t('chat.input.send')}
        </Button>
      </div>
    </div>
  );
});

function autoResize(el: HTMLTextAreaElement | HTMLInputElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

// ========== 消息操作栏组件 ==========

interface MessageActionsProps {
  message: StoredMessage;
  branchInfo?: BranchInfo;
  isLast?: boolean;
}

const MessageActions = memo(function MessageActions({
  message,
  branchInfo,
  isLast = false,
}: MessageActionsProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const { setEditingMessage, regenerateMessage, switchSibling, isLoading } =
    useChatStore(
      useShallow((s) => ({
        setEditingMessage: s.setEditingMessage,
        regenerateMessage: s.regenerateMessage,
        switchSibling: s.switchSibling,
        isLoading: s.isLoading,
      })),
    );
  const canHover = useCanHover();
  const isActive = useChatStore((s) => s.activeMessageId === message.id);

  const isUser = message.role === 'user';
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
                    className="inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
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
                    className="inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
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
                  className="inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
                    className="inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
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
                    className="inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
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
        </div>
      </div>
    </TooltipProvider>
  );
});
