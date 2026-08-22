import type { Conversation, MessageNode } from '@/stores/models';

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
    rootId: `root-conv-${i}`,
    activeLeafId: null,
    model: 'deepseek-v4-flash-vision-exp',
  }));
}

export function generateConversation(
  overrides: Partial<Conversation> = {},
): Conversation {
  const now = Date.now();
  const id = overrides.id ?? generateId('conv');
  return {
    title: '测试会话',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    activeLeafId: null,
    model: 'deepseek-v4-flash-vision-exp',
    ...overrides,
    id,
    rootId: overrides.rootId ?? `root-${id}`,
  };
}

export function generateMessages(
  conversationId: string,
  count: number,
  options: { contentLength?: number; withThinking?: boolean } = {},
): MessageNode[] {
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

  const rootId = `root-${conversationId}`;
  const root: MessageNode = {
    id: rootId,
    conversationId,
    role: 'system',
    parentId: null,
    childrenIds: [],
    siblingIndex: 0,
    activeChildId: null,
    content: '',
    status: 'done',
    createdAt: now - count * 10 - 1,
  };

  const msgs: MessageNode[] = [];
  for (let i = 0; i < count; i++) {
    const isUser = i % 2 === 0;
    const baseContent = contents[i % contents.length];
    const content =
      contentLength > baseContent.length
        ? baseContent
            .repeat(Math.ceil(contentLength / baseContent.length))
            .slice(0, contentLength)
        : baseContent;

    const msg: MessageNode = {
      id: generateId('msg'),
      conversationId,
      role: isUser ? 'user' : 'assistant',
      parentId: null,
      childrenIds: [],
      siblingIndex: 0,
      activeChildId: null,
      content,
      status: 'done',
      createdAt: now - (count - i) * 10,
    };

    if (!isUser && withThinking) {
      msg.reasoningContent = '让我分析一下这个问题...';
    }

    msgs.push(msg);
  }

  if (msgs.length > 0) {
    msgs[0].parentId = rootId;
    msgs[0].siblingIndex = 0;
    root.activeChildId = msgs[0].id;
  }
  for (let i = 0; i < msgs.length; i++) {
    if (i > 0) {
      msgs[i].parentId = msgs[i - 1].id;
      msgs[i].siblingIndex = 0;
    }
    msgs[i].activeChildId = i < msgs.length - 1 ? msgs[i + 1].id : null;
  }

  return [root, ...msgs];
}

export function generateMessage(
  overrides: Partial<MessageNode> = {},
): MessageNode {
  return {
    id: generateId('msg'),
    conversationId: 'conv-test',
    role: 'user',
    parentId: null,
    childrenIds: [],
    siblingIndex: 0,
    activeChildId: null,
    content: '测试消息',
    status: 'done',
    createdAt: Date.now(),
    ...overrides,
  };
}
