import { create } from 'zustand';
import type { ChatMessage } from '@/shared/types/deepseek';
import type { Conversation, StoredMessage } from '@/shared/types/deepseek';
import { sendMessage as sendChatMessage } from '@/shared/utils/chat-api';
import * as db from '@/shared/utils/db';

const API_KEY_STORAGE_KEY = 'deepseek-api-key';

interface ChatState {
  // API Key
  apiKey: string;
  hasApiKey: boolean;

  // 会话
  conversations: Conversation[];
  currentConversationId: string | null;

  // 消息
  messages: StoredMessage[];
  isLoading: boolean;
  error: string | null;

  // 操作
  init: () => Promise<void>;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;

  createConversation: () => Promise<void>;
  switchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  clearMessages: () => Promise<void>;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function buildSystemPrompt(): string {
  return 'You are a helpful assistant.';
}

export const useChatStore = create<ChatState>((set, get) => ({
  apiKey: '',
  hasApiKey: false,
  conversations: [],
  currentConversationId: null,
  messages: [],
  isLoading: false,
  error: null,

  async init() {
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
    const hasKey = storedKey.length > 0;

    try {
      const conversations = await db.getAllConversations();
      let currentId: string | null = null;

      if (conversations.length > 0) {
        // 选最近更新的会话
        currentId = conversations[conversations.length - 1].id;
      } else {
        // 自动创建默认会话
        const now = Date.now();
        const conv: Conversation = {
          id: generateId(),
          title: '新对话',
          createdAt: now,
          updatedAt: now,
          messageCount: 0,
        };
        await db.addConversation(conv);
        conversations.push(conv);
        currentId = conv.id;
      }

      const messages = currentId ? await db.getMessagesByConversation(currentId) : [];

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

  async createConversation() {
    const now = Date.now();
    const conv: Conversation = {
      id: generateId(),
      title: '新对话',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };
    await db.addConversation(conv);
    set((state) => ({
      conversations: [...state.conversations, conv],
      currentConversationId: conv.id,
      messages: [],
      error: null,
    }));
  },

  async switchConversation(id: string) {
    const messages = await db.getMessagesByConversation(id);
    set({ currentConversationId: id, messages, error: null });
  },

  async deleteConversation(id: string) {
    await db.deleteConversation(id);
    const conversations = get().conversations.filter((c) => c.id !== id);

    if (get().currentConversationId === id) {
      // 切换到第一个会话，或创建新的
      if (conversations.length > 0) {
        const newId = conversations[conversations.length - 1].id;
        const messages = await db.getMessagesByConversation(newId);
        set({ conversations, currentConversationId: newId, messages });
      } else {
        // 没有会话了，创建新的
        set({ conversations, currentConversationId: null, messages: [] });
        await get().createConversation();
      }
    } else {
      set({ conversations });
    }
  },

  async sendMessage(content: string) {
    const { apiKey, currentConversationId, messages } = get();
    if (!apiKey || !currentConversationId) return;

    const userMsg: StoredMessage = {
      id: generateId(),
      conversationId: currentConversationId,
      role: 'user',
      content,
      createdAt: Date.now(),
    };

    set({ isLoading: true, error: null, messages: [...messages, userMsg] });

    try {
      // 构造 API 消息列表
      const apiMessages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt() },
        ...get().messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content },
      ];

      const response = await sendChatMessage(apiMessages);
      const assistantContent = response.choices[0]?.message?.content ?? '';

      const assistantMsg: StoredMessage = {
        id: generateId(),
        conversationId: currentConversationId,
        role: 'assistant',
        content: assistantContent,
        createdAt: Date.now(),
      };

      // 保存到 DB
      await db.addMessage(userMsg);
      await db.addMessage(assistantMsg);

      // 更新会话
      const conversations = get().conversations.map((c) => {
        if (c.id === currentConversationId) {
          const firstUserMsg = get().messages.length === 1 ? content : c.title;
          return {
            ...c,
            title: firstUserMsg.length > 20 ? firstUserMsg.slice(0, 20) + '...' : firstUserMsg,
            updatedAt: Date.now(),
            messageCount: c.messageCount + 2,
          };
        }
        return c;
      });
      const updatedConv = conversations.find((c) => c.id === currentConversationId);
      if (updatedConv) {
        await db.updateConversation(updatedConv);
      }

      set({ messages: [...get().messages, assistantMsg], isLoading: false, conversations });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '请求失败，请检查 API Key 是否正确';
      set({ isLoading: false, error: errorMsg });
    }
  },

  async retryLastMessage() {
    const { messages } = get();
    // 找到最后一条 user 消息
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;

    const originalIdx = messages.length - 1 - lastUserIdx;
    const lastUserContent = messages[originalIdx].content;

    // 移除 user 消息及之后的 assistant 消息
    const trimmed = messages.slice(0, originalIdx);
    set({ messages: trimmed });

    // 重新发送
    await get().sendMessage(lastUserContent);
  },

  async clearMessages() {
    const { currentConversationId } = get();
    if (!currentConversationId) return;
    await db.clearConversationMessages(currentConversationId);
    set({ messages: [] });
  },
}));
