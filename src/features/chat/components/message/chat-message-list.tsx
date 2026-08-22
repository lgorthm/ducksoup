import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import type { ReactNode, RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChatMessage } from './chat-message';
import type { BranchInfo } from '@/stores/models';
import {
  useChatListController,
  type ChatListController,
} from '@/features/chat/hooks/use-chat-list-controller';
import { useMessageListState } from '@/stores/selectors';
import { deriveBranchInfo } from '@/stores/utils/tree';

interface ChatMessageListProps {
  children?: ReactNode;
  /** 外部传入的 ref，组件挂载后会填充控制器实例 */
  controllerRef?: RefObject<ChatListController | null>;
}

export function ChatMessageList({
  children,
  controllerRef,
}: ChatMessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { messages, messageNodes, editingMessageId, streamingMessageId } =
    useMessageListState();

  const branchInfoMap = useMemo(() => {
    const map: Record<string, BranchInfo> = {};
    for (const m of messages) {
      map[m.id] = deriveBranchInfo(messageNodes, m.id);
    }
    return map;
  }, [messages, messageNodes]);

  const totalCount = messages.length;
  // 当前激活路径上"最后一条用户消息"与"最后一条 AI 回复"的下标；
  // 这两条消息与有分支的消息操作栏常显；其余消息在 hover/focus 时显示，
  // 移动端（主输入不可 hover）通过点击消息气泡逐条激活显示。
  const lastActionIndices = useMemo(() => {
    let lastUser = -1;
    let lastAssistant = -1;
    for (let i = 0; i < messages.length; i++) {
      const role = messages[i].role;
      if (role === 'user') lastUser = i;
      else if (role === 'assistant') lastAssistant = i;
    }
    return { lastUser, lastAssistant };
  }, [messages]);

  // TanStack Virtual 返回不稳定函数引用，已通过 'use no memo' 显式跳过记忆化
  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: useCallback(() => scrollContainerRef.current, []),
    estimateSize: useCallback(() => 80, []),
    overscan: 0,
    // 端锚定：专为聊天/日志场景设计。prepend 历史时保持视口稳定；
    // 末尾项增长（流式 token 累积）时由 virtualizer 内部尺寸补偿
    // 自动保持贴底，无需手写 scroll 监听 + isAtBottom ref。
    anchorTo: 'end',
    // 视口已贴底时，追加新 item 自动跟随到底部；用户上滚时不打断。
    followOnAppend: 'auto',
    // 贴底判定阈值：距末尾 50px 内视为"贴底"，对齐原 bottomThreshold。
    scrollEndThreshold: 50,
    // 位置与容器高度由 virtualizer 在 onChange 中直接写 DOM（同帧生效），
    // 不再等 React 重渲染——消除 resize 时"文字已重排但条目位置慢一帧"
    // 导致的重叠/跳动。开启后条目不得再在 JSX 中设置 transform，
    // 容器不得再设置 height（均由 virtualizer 接管）。
    // 注意：不要开 useAnimationFrameWithResizeObserver——RO 回调本身在
    // 绘制前执行，延迟到 rAF 反而会让修正晚一帧。
    directDomUpdates: true,
  });

  useLayoutEffect(() => {
    virtualizer.scrollToEnd();
  }, [virtualizer]);

  // 窗口 resize 期间保持贴底。virtualizer 的滚动补偿依赖异步 scroll 事件
  // 更新的 scrollOffset，连续 resize 时补偿滞后，且距底超过 scrollEndThreshold
  // 后 wasAtEnd 锁死为 false，内容会持续下滑直到 resize 结束才回弹（"字乱跳"）。
  // 这里以 DOM 真实 scrollHeight 为准：scroll 事件持续跟踪贴底状态，
  // 容器或内容尺寸变化时若处于贴底则当帧钉底。
  const isAtBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const THRESHOLD = 50; // 对齐 virtualizer 的 scrollEndThreshold
    const updateIsAtBottom = () => {
      isAtBottomRef.current =
        el.scrollHeight - el.clientHeight - el.scrollTop <= THRESHOLD;
    };
    const pinToBottom = () => {
      if (isAtBottomRef.current) {
        el.scrollTop = el.scrollHeight - el.clientHeight;
      }
    };
    const ro = new ResizeObserver(() => {
      // 尺寸变化 → 文本当帧重排：立即钉底；下一帧（virtualizer 重测、
      // totalSize 更新后）再钉一次
      pinToBottom();
      requestAnimationFrame(pinToBottom);
    });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener('scroll', updateIsAtBottom, { passive: true });
    updateIsAtBottom();
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', updateIsAtBottom);
    };
  }, []);

  // 填充外部控制器（供滚动导航栏使用）
  useChatListController({
    scrollContainerRef,
    virtualizer,
    controllerRef,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollContainerRef}
      data-testid="message-list"
      // overflow-anchor:none：禁用浏览器原生 scroll anchoring，
      // 避免与 virtualizer 的 JS 滚动补偿重复修正导致 resize 时跳动
      className="chat-scrollbar flex-1 overflow-y-auto [overflow-anchor:none]"
    >
      <div
        ref={virtualizer.containerRef}
        className="relative mx-auto w-full max-w-[744px]"
      >
        {virtualItems.map((virtualItem) => {
          const msg = messages[virtualItem.index];
          const isStreaming =
            msg.status === 'pending' || msg.id === streamingMessageId;

          return (
            <div
              key={msg.id}
              data-testid="message-item"
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="group absolute top-0 left-0 w-full pr-4 pb-4 pl-4"
            >
              <ChatMessage
                message={msg}
                isStreaming={isStreaming}
                branchInfo={branchInfoMap[msg.id]}
                isEditing={editingMessageId === msg.id}
                isLast={
                  virtualItem.index === lastActionIndices.lastUser ||
                  virtualItem.index === lastActionIndices.lastAssistant
                }
              />
            </div>
          );
        })}
      </div>
      {children && (
        <div className="mx-auto w-full max-w-[744px] px-4">{children}</div>
      )}
    </div>
  );
}
