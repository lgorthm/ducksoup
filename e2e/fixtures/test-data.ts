import type {
  Conversation,
  StoredMessage,
} from '@/features/chat/types/deepseek';

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function generateConversations(count: number): Conversation[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `conv-${i}`,
    title: `对话 ${i + 1}`,
    createdAt: now - (count - i) * 1000,
    updatedAt: now - (count - i) * 1000,
    messageCount: 0,
    activeLeafId: null,
  }));
}

export function generateConversation(
  overrides: Partial<Conversation> = {},
): Conversation {
  const now = Date.now();
  return {
    id: generateId('conv'),
    title: '测试会话',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    activeLeafId: null,
    ...overrides,
  };
}

export function generateMessages(
  conversationId: string,
  count: number,
  options: { contentLength?: number; withThinking?: boolean } = {},
): StoredMessage[] {
  const { contentLength = 20, withThinking = false } = options;
  const now = Date.now();
  const contents = [
    '你好，请帮我分析一下这个问题。',
    '当然可以，让我来详细解释。',
    '请问有什么具体的例子吗？',
    '这是一个很好的问题，我的理解是。',
    '根据文档所述，我们可以采用以下方案。',
    '需要注意的是边界条件的处理。',
    '让我来展示一段代码示例。',
    '这个设计的优点是可扩展性强。',
    '不过也有一些潜在的缺点需要权衡。',
    '总结一下，核心思路就是这些。',
  ];

  const msgs: StoredMessage[] = [];
  for (let i = 0; i < count; i++) {
    const isUser = i % 2 === 0;
    const baseContent = contents[i % contents.length];
    const content =
      contentLength > baseContent.length
        ? baseContent
            .repeat(Math.ceil(contentLength / baseContent.length))
            .slice(0, contentLength)
        : baseContent;

    const msg: StoredMessage = {
      id: generateId('msg'),
      conversationId,
      role: isUser ? 'user' : 'assistant',
      content,
      createdAt: now - (count - i) * 10,
      parentId: null,
      selectedChildId: null,
    };

    if (!isUser && withThinking) {
      msg.reasoningContent = '让我分析一下这个问题...';
    }

    msgs.push(msg);
  }

  // 链式化树结构：parentId 指向前一条，selectedChildId 指向下一条
  for (let i = 0; i < msgs.length; i++) {
    msgs[i].parentId = i > 0 ? msgs[i - 1].id : null;
    msgs[i].selectedChildId = i < msgs.length - 1 ? msgs[i + 1].id : null;
  }

  return msgs;
}

export function generateMessage(
  overrides: Partial<StoredMessage> = {},
): StoredMessage {
  return {
    id: generateId('msg'),
    conversationId: 'conv-test',
    role: 'user',
    content: '测试消息',
    createdAt: Date.now(),
    parentId: null,
    selectedChildId: null,
    ...overrides,
  };
}
