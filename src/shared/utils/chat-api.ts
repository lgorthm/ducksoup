import { apiClient } from '@/shared/lib/api';
import type { ChatCompletionRequest, ChatCompletionResponse, ChatMessage } from '@/shared/types/deepseek';

const DEFAULT_MODEL = 'deepseek-v4-flash';

interface SendMessageOptions {
  model?: string;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export async function sendMessage(
  messages: ChatMessage[],
  options: SendMessageOptions = {},
): Promise<ChatCompletionResponse> {
  const body: ChatCompletionRequest = {
    messages,
    model: options.model ?? DEFAULT_MODEL,
    stream: false,
    max_tokens: options.maxTokens ?? null,
    temperature: options.temperature ?? null,
  };

  const response = await apiClient.post<ChatCompletionResponse>('/chat/completions', body);
  return response.data;
}

export async function sendMessageStream(
  messages: ChatMessage[],
  options: SendMessageOptions = {},
  onChunk: (content: string) => void,
  onDone: () => void,
  onError: (error: Error) => void,
): Promise<void> {
  const apiKey = localStorage.getItem('deepseek-api-key');

  const body: ChatCompletionRequest = {
    messages,
    model: options.model ?? DEFAULT_MODEL,
    stream: true,
    max_tokens: options.maxTokens ?? null,
    temperature: options.temperature ?? null,
  };

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            onChunk(content);
          }
        } catch {
          // 忽略解析失败的行
        }
      }
    }
    onDone();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
