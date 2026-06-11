import { create } from 'zustand';
import i18n from '@/shared/i18n';
import type {
  ChatMessage,
  Conversation,
  StoredMessage,
  StreamingMessage,
} from '@/shared/types/deepseek';
import {
  createChatStream,
  type ChatStreamController,
} from '@/shared/utils/chat-stream';
import * as db from '@/shared/utils/db';

const API_KEY_STORAGE_KEY = 'deepseek-api-key';

export type ModelName = 'deepseek-v4-flash' | 'deepseek-v4-pro';

export const MODEL_LABELS: Record<ModelName, string> = {
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
};

interface ChatState {
  // API Key
  apiKey: string;
  hasApiKey: boolean;

  // 模型
  selectedModel: ModelName;

  // 会话
  conversations: Conversation[];
  currentConversationId: string | null;

  // 消息
  messages: StoredMessage[];
  /** 正在流式传输中的 assistant 消息（用于实时渲染） */
  streamingMessage: StreamingMessage | null;
  isLoading: boolean;
  error: string | null;

  // 操作
  init: () => Promise<void>;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setModel: (model: ModelName) => void;

  createConversation: () => Promise<void>;
  startNewConversation: () => void;
  switchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;

  sendMessage: (content: string, deepThink?: boolean) => Promise<void>;
  cancelStream: () => void;
  retryLastMessage: () => Promise<void>;
  clearMessages: () => Promise<void>;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function buildSystemPrompt(): string {
  return 'You are a helpful assistant.';
}

export const useChatStore = create<ChatState>((set, get) => {
  /** 当前活跃的流控制器，用于手动取消 */
  let activeController: ChatStreamController | null = null;

  return {
    apiKey: '',
    hasApiKey: false,
    selectedModel: 'deepseek-v4-flash',
    conversations: [],
    currentConversationId: null,
    messages: [],
    streamingMessage: null,
    isLoading: false,
    error: null,

    async init() {
      const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
      const hasKey = storedKey.length > 0;

      try {
        const conversations = await db.getAllConversations();
        let currentId: string | null = null;

        if (conversations.length > 0) {
          currentId = conversations[conversations.length - 1].id;
        } else {
          const now = Date.now();
          const conv: Conversation = {
            id: generateId(),
            title: i18n.t('conversation.defaultName'),
            createdAt: now,
            updatedAt: now,
            messageCount: 0,
          };
          await db.addConversation(conv);
          conversations.push(conv);
          currentId = conv.id;
        }

        const messages = currentId
          ? await db.getMessagesByConversation(currentId)
          : [];

        set({
          apiKey: storedKey,
          hasApiKey: hasKey,
          conversations,
          currentConversationId: currentId,
          messages,
        });
      } catch {
        set({ apiKey: storedKey, hasApiKey: hasKey });
      }
    },

    setApiKey(key: string) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
      set({ apiKey: key, hasApiKey: true });
    },

    clearApiKey() {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      set({ apiKey: '', hasApiKey: false });
    },

    setModel(model: ModelName) {
      set({ selectedModel: model });
    },

    async createConversation() {
      const now = Date.now();
      const conv: Conversation = {
        id: generateId(),
        title: i18n.t('conversation.new'),
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
      };
      await db.addConversation(conv);
      set((state) => ({
        conversations: [...state.conversations, conv],
        currentConversationId: conv.id,
        messages: [],
        streamingMessage: null,
        error: null,
      }));
    },

    startNewConversation() {
      set({
        currentConversationId: null,
        messages: [],
        streamingMessage: null,
        error: null,
      });
    },

    async switchConversation(id: string) {
      const messages = await db.getMessagesByConversation(id);
      set({
        currentConversationId: id,
        messages,
        streamingMessage: null,
        error: null,
      });
    },

    async deleteConversation(id: string) {
      await db.deleteConversation(id);
      const conversations = get().conversations.filter((c) => c.id !== id);

      if (get().currentConversationId === id) {
        if (conversations.length > 0) {
          const newId = conversations[conversations.length - 1].id;
          const messages = await db.getMessagesByConversation(newId);
          set({ conversations, currentConversationId: newId, messages });
        } else {
          set({
            conversations,
            currentConversationId: null,
            messages: [],
            streamingMessage: null,
          });
          await get().createConversation();
        }
      } else {
        set({ conversations });
      }
    },

    cancelStream() {
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
    },

    async sendMessage(content: string, deepThink = false) {
      const { apiKey, currentConversationId, messages } = get();
      if (!apiKey) return;

      // 取消之前的流
      get().cancelStream();

      // 如果没有当前会话，自动创建一个
      let conversationId = currentConversationId;
      if (!conversationId) {
        const now = Date.now();
        const conv: Conversation = {
          id: generateId(),
          title: content.length > 20 ? content.slice(0, 20) + '...' : content,
          createdAt: now,
          updatedAt: now,
          messageCount: 0,
        };
        await db.addConversation(conv);
        conversationId = conv.id;
        set((state) => ({
          conversations: [...state.conversations, conv],
          currentConversationId: conv.id,
        }));
      }

      const userMsg: StoredMessage = {
        id: generateId(),
        conversationId,
        role: 'user',
        content,
        createdAt: Date.now(),
      };

      const streamingMsg: StreamingMessage = {
        id: generateId(),
        conversationId,
        role: 'assistant',
        content: '',
        thinkingSteps: [],
        createdAt: Date.now(),
      };

      set({
        isLoading: true,
        error: null,
        messages: [...messages, userMsg],
        streamingMessage: streamingMsg,
      });

      // 构造 API 消息列表（不含流式消息）
      const apiMessages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt() },
        ...get().messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content },
      ];

      const controller = createChatStream({
        apiKey,
        model: get().selectedModel,
        messages: apiMessages,
        deepThink,
        onEvent: (event) => {
          switch (event.type) {
            case 'thinking':
              set((state) => {
                if (!state.streamingMessage) return state;
                return {
                  streamingMessage: {
                    ...state.streamingMessage,
                    thinkingSteps: [
                      ...state.streamingMessage.thinkingSteps,
                      event.step,
                    ],
                  },
                };
              });
              break;

            case 'content':
              set((state) => {
                if (!state.streamingMessage) return state;
                return {
                  streamingMessage: {
                    ...state.streamingMessage,
                    content: state.streamingMessage.content + event.text,
                  },
                };
              });
              break;

            case 'done': {
              const finalStreaming = get().streamingMessage;
              if (!finalStreaming) break;

              // 收集完整的推理内容
              const reasoningContent =
                finalStreaming.thinkingSteps.length > 0
                  ? finalStreaming.thinkingSteps.map((s) => s.content).join('')
                  : undefined;

              const assistantMsg: StoredMessage = {
                id: finalStreaming.id,
                conversationId,
                role: 'assistant',
                content: finalStreaming.content,
                reasoningContent,
                thinkingSteps:
                  finalStreaming.thinkingSteps.length > 0
                    ? finalStreaming.thinkingSteps
                    : undefined,
                createdAt: finalStreaming.createdAt,
              };

              // 持久化
              db.addMessage(userMsg).catch(() => {});
              db.addMessage(assistantMsg).catch(() => {});

              // 更新会话标题和计数
              const conversations = get().conversations.map((c) => {
                if (c.id === conversationId) {
                  const firstUserMsg =
                    get().messages.length === 0 ? content : c.title;
                  return {
                    ...c,
                    title:
                      firstUserMsg.length > 20
                        ? firstUserMsg.slice(0, 20) + '...'
                        : firstUserMsg,
                    updatedAt: Date.now(),
                    messageCount: c.messageCount + 2,
                  };
                }
                return c;
              });
              const updatedConv = conversations.find(
                (c) => c.id === conversationId,
              );
              if (updatedConv) {
                db.updateConversation(updatedConv).catch(() => {});
              }

              set({
                messages: [...get().messages, assistantMsg],
                streamingMessage: null,
                isLoading: false,
                conversations,
              });
              activeController = null;
              break;
            }

            case 'error':
              set({
                streamingMessage: null,
                isLoading: false,
                error: event.error.message,
              });
              activeController = null;
              break;
          }
        },
      });

      activeController = controller;
    },

    async retryLastMessage() {
      const { messages } = get();
      // 找到最后一条 user 消息
      const reversed = [...messages].reverse();
      const lastUserIdx = reversed.findIndex((m) => m.role === 'user');
      if (lastUserIdx === -1) return;

      const originalIdx = messages.length - 1 - lastUserIdx;
      const lastUserContent = messages[originalIdx].content;

      // 移除 user 消息及之后的 assistant 消息
      const trimmed = messages.slice(0, originalIdx);
      set({ messages: trimmed });

      await get().sendMessage(lastUserContent);
    },

    async clearMessages() {
      const { currentConversationId } = get();
      if (!currentConversationId) return;
      await db.clearConversationMessages(currentConversationId);
      set({ messages: [], streamingMessage: null });
    },
  };
});
