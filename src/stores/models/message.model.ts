export type MessageId = string;

export type MessageStatus = 'pending' | 'done' | 'error';

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface MessageNode {
  id: MessageId;
  conversationId: string;
  role: MessageRole;
  parentId: MessageId | null;
  childrenIds: MessageId[];
  siblingIndex: number;
  activeChildId: MessageId | null;
  content: string;
  reasoningContent?: string;
  status?: MessageStatus;
  createdAt: number;
  deleted?: boolean;
}

/** 单条消息在兄弟分支中的位置，用于 `<N/M>` 导航 */
export interface BranchInfo {
  current: number;
  total: number;
  prevSiblingId: MessageId | null;
  nextSiblingId: MessageId | null;
}

export interface MessageState {
  messageNodes: Map<MessageId, MessageNode>;
  rootId: MessageId | null;
  activeLeafId: MessageId | null;
  activePath: MessageId[];
  streamingMessageId: MessageId | null;
  editingMessageId: string | null;
  activeMessageId: string | null;
  isLoading: boolean;
  error: string | null;
}

export function createInitialMessageState(): MessageState {
  return {
    messageNodes: new Map(),
    rootId: null,
    activeLeafId: null,
    activePath: [],
    streamingMessageId: null,
    editingMessageId: null,
    activeMessageId: null,
    isLoading: false,
    error: null,
  };
}

export const initialMessageState: MessageState = createInitialMessageState();
