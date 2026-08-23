import type { MessageId } from './message.model';

export type ModelName = 'deepseek-v4-flash-vision-exp' | 'deepseek-v4-pro';

export const MODEL_LABELS: Record<ModelName, string> = {
  'deepseek-v4-flash-vision-exp': 'DeepSeek V4 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
};

/** 新会话的默认模型；旧记录缺失 model 字段时也按此归一化 */
export const DEFAULT_MODEL: ModelName = 'deepseek-v4-flash-vision-exp';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  rootId: MessageId;
  activeLeafId: MessageId | null;
  /** 会话创建时确定，之后不可变；切换模型需新建会话 */
  model: ModelName;
  /** 置顶时间戳；缺省表示未置顶 */
  pinnedAt?: number;
}

export interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  initialized: boolean;
}

export const initialConversationState: ConversationState = {
  conversations: [],
  currentConversationId: null,
  initialized: false,
};
