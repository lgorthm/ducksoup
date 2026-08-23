import { memo, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import type { BranchInfo, MessageNode } from '@/stores/models';
import { branchInfoEqual } from '@/stores/utils/tree';
import { useCanHover } from '@/shared/hooks/use-media-query';
import { toggleActiveMessage } from '@/stores/actions';
import { LazyMarkdownRenderer } from '@/shared/components/lazy-markdown-renderer';
import { ThinkingSection } from './thinking-section';
import { EditForm } from './message-edit-form';
import { MessageImages } from './message-images';
import { MessageActions } from './message-actions';

interface ChatMessageProps {
  message: MessageNode;
  /** 是否为流式传输中（内容还未完成） */
  isStreaming?: boolean;
  /** 当前是否处于编辑态（仅 user 消息） */
  isEditing?: boolean;
  /** 分支导航信息；total>1 时渲染 `<N/M>` */
  branchInfo?: BranchInfo;
  /** 是否为最后一条用户消息或最后一条 AI 回复，决定操作栏是否常显 */
  isLast?: boolean;
}

function sameBranchInfo(
  a: BranchInfo | undefined,
  b: BranchInfo | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return branchInfoEqual(a, b);
}

export const ChatMessage = memo(
  function ChatMessage({
    message,
    isStreaming = false,
    isEditing = false,
    branchInfo,
    isLast = false,
  }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const hasThinking = !!message.reasoningContent;
    const hasAttachments = (message.attachments?.length ?? 0) > 0;
    const canHover = useCanHover();

    // 单行气泡使用 rounded-full，多行回退到 rounded-lg（按实际渲染高度判断，含换行折行）
    // 用 useLayoutEffect 在绘制前完成首次测量，避免多行消息先渲染一帧 rounded-full 再纠正的闪动
    const contentRef = useRef<HTMLParagraphElement>(null);
    const [isSingleLine, setIsSingleLine] = useState(true);
    // biome-ignore lint/correctness/useExhaustiveDependencies: isEditing 切换时 <p> 会卸载重挂，需要重新观测
    useLayoutEffect(() => {
      const el = contentRef.current;
      if (!el) return;
      const check = () => {
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
        const single = el.scrollHeight <= lineHeight + 1;
        setIsSingleLine((prev) => (prev === single ? prev : single));
      };
      check();
      const ro = new ResizeObserver(check);
      ro.observe(el);
      return () => ro.disconnect();
      // isEditing 切换时 <p> 会卸载重挂，需要重新观测新节点
    }, [isEditing]);

    // 移动端主输入不支持 hover：点击气泡切换操作栏激活态（全局同时仅一条激活）
    const handleBubbleClick =
      canHover || isStreaming || isEditing
        ? undefined
        : () => toggleActiveMessage(message.id);

    const showUserBubble = isUser && (isEditing || !!message.content);

    return (
      <div
        className={cn(
          'flex w-full flex-col',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {isUser && hasAttachments && !isEditing ? (
          <div className="mb-2 max-w-[80%]" onClick={handleBubbleClick}>
            <MessageImages
              attachments={message.attachments ?? []}
              className="justify-end"
            />
          </div>
        ) : null}
        {showUserBubble || !isUser ? (
          <div
            onClick={handleBubbleClick}
            className={cn(
              'rounded-full px-4 py-2.5 text-sm leading-relaxed',
              isUser
                ? isEditing
                  ? 'w-[95%] p-0'
                  : cn(
                      'max-w-[80%] bg-primary text-primary-foreground',
                      !isSingleLine && 'rounded-lg',
                    )
                : 'max-w-full bg-transparent text-foreground',
            )}
          >
            {isUser ? (
              isEditing ? (
                <EditForm message={message} />
              ) : (
                <p
                  ref={contentRef}
                  className="wrap-break-word whitespace-pre-wrap"
                >
                  {message.content}
                </p>
              )
            ) : (
              <>
                <ThinkingSection message={message} isStreaming={isStreaming} />

                {message.content ? (
                  <LazyMarkdownRenderer isStreaming={isStreaming}>
                    {message.content}
                  </LazyMarkdownRenderer>
                ) : isStreaming && !hasThinking ? (
                  <span className="animate-pulse text-muted-foreground">▊</span>
                ) : null}
              </>
            )}
          </div>
        ) : null}
        {!isStreaming && !isEditing && (
          <MessageActions
            message={message}
            branchInfo={branchInfo}
            isLast={isLast}
          />
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.isStreaming === next.isStreaming &&
    prev.isEditing === next.isEditing &&
    prev.isLast === next.isLast &&
    sameBranchInfo(prev.branchInfo, next.branchInfo),
);
