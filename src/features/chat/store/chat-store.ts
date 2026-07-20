import { create } from 'zustand';
import i18n from '@/shared/i18n';
import type {
  BranchInfo,
  ChatMessage,
  Conversation,
  StoredMessage,
  StreamingMessage,
} from '@/features/chat/types/deepseek';
import {
  createChatStream,
  type ChatStreamController,
  type ChatStreamEvent,
} from '@/features/chat/utils/chat-stream';
import * as db from '@/features/chat/utils/db';

const API_KEY_STORAGE_KEY = 'deepseek-api-key';

export type ModelName = 'deepseek-v4-flash' | 'deepseek-v4-pro';

export const MODEL_LABELS: Record<ModelName, string> = {
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
};

// ========== 树结构辅助函数 ==========

function deriveActivePath(
  allMessages: StoredMessage[],
  activeLeafId: string | null | undefined,
): StoredMessage[] {
  if (allMessages.length === 0) return [];
  let leafId = activeLeafId ?? null;
  if (!leafId) {
    const sorted = [...allMessages].sort((a, b) => a.createdAt - b.createdAt);
    leafId = sorted[sorted.length - 1].id;
  }
  const byId = new Map(allMessages.map((m) => [m.id, m]));
  const path: StoredMessage[] = [];
  const seen = new Set<string>();
  let cur = byId.get(leafId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.push(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path.reverse();
}

function deriveBranchInfo(
  allMessages: StoredMessage[],
  message: StoredMessage,
): BranchInfo {
  const siblings = allMessages
    .filter(
      (m) =>
        m.conversationId === message.conversationId &&
        (m.parentId ?? null) === (message.parentId ?? null),
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  const idx = siblings.findIndex((m) => m.id === message.id);
  return {
    current: idx + 1,
    total: siblings.length,
    prevSiblingId: idx > 0 ? siblings[idx - 1].id : null,
    nextSiblingId:
      idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].id : null,
  };
}

interface ChatState {
  apiKey: string;
  hasApiKey: boolean;
  selectedModel: ModelName;
  deepThink: boolean;
  conversations: Conversation[];
  currentConversationId: string | null;
  allMessages: StoredMessage[];
  messages: StoredMessage[];
  streamingMessage: StreamingMessage | null;
  editingMessageId: string | null;
  isLoading: boolean;
  error: string | null;

  init: () => Promise<void>;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setModel: (model: ModelName) => void;
  toggleDeepThink: () => void;

  createConversation: () => Promise<void>;
  startNewConversation: () => void;
  switchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;

  sendMessage: (content: string, deepThink?: boolean) => Promise<void>;
  cancelStream: () => void;
  clearMessages: () => Promise<void>;

  setEditingMessage: (id: string | null) => void;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  regenerateMessage: (messageId: string) => Promise<void>;
  switchSibling: (messageId: string, direction: -1 | 1) => void;
  getBranchInfo: (messageId: string) => BranchInfo;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function buildSystemPrompt(): string {
  return 'You are a helpful assistant.';
}

function buildApiMessages(path: StoredMessage[]): ChatMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt() },
    ...path.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];
}

export const useChatStore = create<ChatState>((set, get) => {
  let activeController: ChatStreamController | null = null;

  function runStream(opts: {
    conversationId: string;
    apiMessages: ChatMessage[];
    streamingMsgId: string;
    streamingParentId: string | null;
    parentUpdate: { parentId: string; newChildId: string } | null;
    userMsgToPersist?: StoredMessage | null;
    messageCountDelta: number;
  }) {
    const {
      conversationId,
      apiMessages,
      streamingParentId,
      parentUpdate,
      userMsgToPersist,
      messageCountDelta,
    } = opts;

    if (userMsgToPersist) {
      db.addMessage(userMsgToPersist).catch(() => {});
    }

    const controller = createChatStream({
      apiKey: get().apiKey,
      model: get().selectedModel,
      messages: apiMessages,
      deepThink: get().deepThink,
      onEvent: (event: ChatStreamEvent) => {
        switch (event.type) {
          case 'thinking':
            set((state) =>
              state.streamingMessage
                ? {
                    streamingMessage: {
                      ...state.streamingMessage,
                      reasoningContent:
                        state.streamingMessage.reasoningContent + event.text,
                    },
                  }
                : state,
            );
            break;

          case 'content':
            set((state) =>
              state.streamingMessage
                ? {
                    streamingMessage: {
                      ...state.streamingMessage,
                      content: state.streamingMessage.content + event.text,
                    },
                  }
                : state,
            );
            break;

          case 'done': {
            const finalStreaming = get().streamingMessage;
            if (!finalStreaming) break;

            const entry = get().allMessages.find(
              (m) => m.id === finalStreaming.id,
            );
            const assistantMsg: StoredMessage = {
              id: finalStreaming.id,
              conversationId,
              role: 'assistant',
              content: finalStreaming.content,
              reasoningContent: finalStreaming.reasoningContent || undefined,
              createdAt: finalStreaming.createdAt,
              parentId: entry?.parentId ?? null,
              selectedChildId: entry?.selectedChildId ?? null,
            };
            db.addMessage(assistantMsg).catch(() => {});

            let nextAll = get().allMessages.map((m) =>
              m.id === assistantMsg.id ? assistantMsg : m,
            );
            if (parentUpdate) {
              nextAll = nextAll.map((m) =>
                m.id === parentUpdate.parentId
                  ? { ...m, selectedChildId: parentUpdate.newChildId }
                  : m,
              );
              const parent = get().allMessages.find(
                (m) => m.id === parentUpdate.parentId,
              );
              if (parent) {
                db.updateMessage({
                  ...parent,
                  selectedChildId: parentUpdate.newChildId,
                }).catch(() => {});
              }
            }

            const conversations = get().conversations.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    activeLeafId: assistantMsg.id,
                    updatedAt: Date.now(),
                    messageCount: c.messageCount + messageCountDelta,
                  }
                : c,
            );
            const updatedConv = conversations.find(
              (c) => c.id === conversationId,
            );
            if (updatedConv) {
              db.updateConversation(updatedConv).catch(() => {});
            }

            set({
              allMessages: nextAll,
              messages: deriveActivePath(nextAll, assistantMsg.id),
              streamingMessage: null,
              isLoading: false,
              conversations,
            });
            activeController = null;
            break;
          }

          case 'error':
            set((state) => {
              const conv = state.conversations.find(
                (c) => c.id === conversationId,
              );
              return {
                streamingMessage: null,
                isLoading: false,
                error: event.error.message,
                messages: deriveActivePath(
                  state.allMessages,
                  conv?.activeLeafId,
                ),
              };
            });
            activeController = null;
            break;
        }
      },
    });

    void streamingParentId;
    activeController = controller;
  }

  return {
    apiKey: '',
    hasApiKey: false,
    selectedModel: 'deepseek-v4-flash',
    deepThink: false,
    conversations: [],
    currentConversationId: null,
    allMessages: [],
    messages: [],
    streamingMessage: null,
    editingMessageId: null,
    isLoading: false,
    error: null,

    async init() {
      const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
      const hasKey = storedKey.length > 0;

      try {
        const conversations = await db.getAllConversations();
        const currentId =
          conversations.length > 0
            ? conversations[conversations.length - 1].id
            : null;

        let allMessages: StoredMessage[] = [];
        if (currentId) {
          allMessages = await db.getMessagesByConversation(currentId);
        }
        const conv = conversations.find((c) => c.id === currentId);
        const messages = deriveActivePath(allMessages, conv?.activeLeafId);

        set({
          apiKey: storedKey,
          hasApiKey: hasKey,
          conversations,
          currentConversationId: currentId,
          allMessages,
          messages,
          streamingMessage: null,
          editingMessageId: null,
          error: null,
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

    toggleDeepThink() {
      set((state) => ({ deepThink: !state.deepThink }));
    },

    async createConversation() {
      const now = Date.now();
      const conv: Conversation = {
        id: generateId(),
        title: i18n.t('conversation.new'),
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        activeLeafId: null,
      };
      await db.addConversation(conv);
      set((state) => ({
        conversations: [...state.conversations, conv],
        currentConversationId: conv.id,
        allMessages: [],
        messages: [],
        streamingMessage: null,
        editingMessageId: null,
        error: null,
      }));
    },

    startNewConversation() {
      set({
        currentConversationId: null,
        allMessages: [],
        messages: [],
        streamingMessage: null,
        editingMessageId: null,
        error: null,
      });
    },

    async switchConversation(id: string) {
      const allMessages = await db.getMessagesByConversation(id);
      const conv = get().conversations.find((c) => c.id === id);
      const messages = deriveActivePath(allMessages, conv?.activeLeafId);
      set({
        currentConversationId: id,
        allMessages,
        messages,
        streamingMessage: null,
        editingMessageId: null,
        error: null,
      });
    },

    async deleteConversation(id: string) {
      await db.deleteConversation(id);
      const conversations = get().conversations.filter((c) => c.id !== id);

      set({ conversations });

      if (get().currentConversationId === id) {
        get().startNewConversation();
      }
    },

    cancelStream() {
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
    },

    async sendMessage(content: string, deepThink = false) {
      const { apiKey, currentConversationId, allMessages, conversations } =
        get();
      if (!apiKey) return;
      void deepThink;

      get().cancelStream();

      let conv =
        conversations.find((c) => c.id === currentConversationId) ?? null;
      const prevLeafId = conv?.activeLeafId ?? null;
      if (!conv) {
        const now = Date.now();
        conv = {
          id: generateId(),
          title: content.length > 20 ? content.slice(0, 20) + '...' : content,
          createdAt: now,
          updatedAt: now,
          messageCount: 0,
          activeLeafId: null,
        };
        await db.addConversation(conv);
      }
      const conversationId = conv.id;

      const userMsg: StoredMessage = {
        id: generateId(),
        conversationId,
        role: 'user',
        content,
        createdAt: Date.now(),
        parentId: prevLeafId,
        selectedChildId: null,
      };
      const assistantId = generateId();
      userMsg.selectedChildId = assistantId;
      const assistantPlaceholder: StoredMessage = {
        id: assistantId,
        conversationId,
        role: 'assistant',
        content: '',
        createdAt: Date.now() + 1,
        parentId: userMsg.id,
        selectedChildId: null,
      };
      const streamingMsg: StreamingMessage = {
        id: assistantId,
        conversationId,
        role: 'assistant',
        content: '',
        reasoningContent: '',
        createdAt: assistantPlaceholder.createdAt,
      };

      const newAll = [...allMessages, userMsg, assistantPlaceholder];
      const baseConversations =
        conv.id === currentConversationId
          ? conversations
          : [...conversations, conv];
      set({
        isLoading: true,
        error: null,
        allMessages: newAll,
        messages: deriveActivePath(newAll, userMsg.id),
        streamingMessage: streamingMsg,
        conversations: baseConversations,
        currentConversationId: conversationId,
      });

      const apiMessages = buildApiMessages(
        deriveActivePath(newAll, userMsg.id),
      );

      runStream({
        conversationId,
        apiMessages,
        streamingMsgId: assistantId,
        streamingParentId: userMsg.id,
        parentUpdate: prevLeafId
          ? { parentId: prevLeafId, newChildId: userMsg.id }
          : null,
        userMsgToPersist: userMsg,
        messageCountDelta: 2,
      });
    },

    async clearMessages() {
      const { currentConversationId, conversations } = get();
      if (!currentConversationId) return;
      await db.clearConversationMessages(currentConversationId);
      const updatedConversations = conversations.map((c) =>
        c.id === currentConversationId ? { ...c, activeLeafId: null } : c,
      );
      const updatedConv = updatedConversations.find(
        (c) => c.id === currentConversationId,
      );
      if (updatedConv) {
        db.updateConversation(updatedConv).catch(() => {});
      }
      set({
        allMessages: [],
        messages: [],
        streamingMessage: null,
        editingMessageId: null,
        conversations: updatedConversations,
      });
    },

    setEditingMessage(id) {
      set({ editingMessageId: id });
    },

    async editMessage(messageId, newContent) {
      if (get().isLoading) return;
      const { allMessages } = get();
      const original = allMessages.find((m) => m.id === messageId);
      if (!original || original.role !== 'user' || !get().apiKey) return;

      get().cancelStream();

      const conversationId = original.conversationId;
      const parentId = original.parentId ?? null;

      const newUserMsg: StoredMessage = {
        id: generateId(),
        conversationId,
        role: 'user',
        content: newContent,
        createdAt: Date.now(),
        parentId,
        selectedChildId: null,
      };
      const assistantId = generateId();
      newUserMsg.selectedChildId = assistantId;
      const assistantPlaceholder: StoredMessage = {
        id: assistantId,
        conversationId,
        role: 'assistant',
        content: '',
        createdAt: Date.now() + 1,
        parentId: newUserMsg.id,
        selectedChildId: null,
      };
      const streamingMsg: StreamingMessage = {
        id: assistantId,
        conversationId,
        role: 'assistant',
        content: '',
        reasoningContent: '',
        createdAt: assistantPlaceholder.createdAt,
      };

      const newAll = [...allMessages, newUserMsg, assistantPlaceholder];
      set({
        isLoading: true,
        error: null,
        editingMessageId: null,
        allMessages: newAll,
        messages: deriveActivePath(newAll, newUserMsg.id),
        streamingMessage: streamingMsg,
      });

      const apiMessages = buildApiMessages(
        deriveActivePath(newAll, newUserMsg.id),
      );

      runStream({
        conversationId,
        apiMessages,
        streamingMsgId: assistantId,
        streamingParentId: newUserMsg.id,
        parentUpdate: parentId ? { parentId, newChildId: newUserMsg.id } : null,
        userMsgToPersist: newUserMsg,
        messageCountDelta: 2,
      });
    },

    async regenerateMessage(messageId) {
      if (get().isLoading) return;
      const { allMessages } = get();
      const original = allMessages.find((m) => m.id === messageId);
      if (!original || original.role !== 'assistant' || !get().apiKey) return;

      get().cancelStream();

      const conversationId = original.conversationId;
      const parentId = original.parentId ?? null;
      if (!parentId) return;

      const assistantId = generateId();
      const assistantPlaceholder: StoredMessage = {
        id: assistantId,
        conversationId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        parentId,
        selectedChildId: null,
      };
      const streamingMsg: StreamingMessage = {
        id: assistantId,
        conversationId,
        role: 'assistant',
        content: '',
        reasoningContent: '',
        createdAt: assistantPlaceholder.createdAt,
      };

      const newAll = [...allMessages, assistantPlaceholder];
      set({
        isLoading: true,
        error: null,
        allMessages: newAll,
        messages: deriveActivePath(newAll, parentId),
        streamingMessage: streamingMsg,
      });

      const apiMessages = buildApiMessages(deriveActivePath(newAll, parentId));

      runStream({
        conversationId,
        apiMessages,
        streamingMsgId: assistantId,
        streamingParentId: parentId,
        parentUpdate: { parentId, newChildId: assistantId },
        userMsgToPersist: null,
        messageCountDelta: 1,
      });
    },

    switchSibling(messageId, direction) {
      if (get().isLoading) return;
      const { allMessages, conversations } = get();
      const msg = allMessages.find((m) => m.id === messageId);
      if (!msg) return;

      const info = deriveBranchInfo(allMessages, msg);
      const targetSiblingId =
        direction === -1 ? info.prevSiblingId : info.nextSiblingId;
      if (!targetSiblingId) return;

      const byId = new Map(allMessages.map((m) => [m.id, m]));
      const seen = new Set<string>();
      let leaf = byId.get(targetSiblingId);
      while (leaf?.selectedChildId && !seen.has(leaf.id)) {
        seen.add(leaf.id);
        const next = byId.get(leaf.selectedChildId);
        if (!next) break;
        leaf = next;
      }
      const newLeafId = leaf ? leaf.id : targetSiblingId;

      let nextAll = allMessages;
      if (msg.parentId) {
        nextAll = allMessages.map((m) =>
          m.id === msg.parentId
            ? { ...m, selectedChildId: targetSiblingId }
            : m,
        );
        const parent = byId.get(msg.parentId);
        if (parent) {
          db.updateMessage({
            ...parent,
            selectedChildId: targetSiblingId,
          }).catch(() => {});
        }
      }

      const updatedConversations = conversations.map((c) =>
        c.id === msg.conversationId ? { ...c, activeLeafId: newLeafId } : c,
      );
      const updatedConv = updatedConversations.find(
        (c) => c.id === msg.conversationId,
      );
      if (updatedConv) {
        db.updateConversation(updatedConv).catch(() => {});
      }

      set({
        allMessages: nextAll,
        messages: deriveActivePath(nextAll, newLeafId),
        streamingMessage: null,
        editingMessageId: null,
        conversations: updatedConversations,
      });
    },

    getBranchInfo(messageId) {
      const { allMessages } = get();
      const msg = allMessages.find((m) => m.id === messageId);
      if (!msg) {
        return {
          current: 1,
          total: 1,
          prevSiblingId: null,
          nextSiblingId: null,
        };
      }
      return deriveBranchInfo(allMessages, msg);
    },
  };
});
