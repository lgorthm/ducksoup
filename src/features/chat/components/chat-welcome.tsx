import { useTranslation } from 'react-i18next';
import duckSvg from '@/assets/duck.svg';
import { ChatInput } from '@/features/chat/components/chat-input';
import { useChatStore, type ModelName } from '@/features/chat/store/chat-store';
import { RadioGroupButton } from '@/shared/components/ui';

const MODELS: { id: ModelName; label: string }[] = [
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
];

export function ChatWelcome() {
  const { t } = useTranslation();
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setModel = useChatStore((s) => s.setModel);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isLoading = useChatStore((s) => s.isLoading);

  const currentLabel =
    MODELS.find((m) => m.id === selectedModel)?.label ?? selectedModel;

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-[776px] flex-col items-center gap-8">
        <div className="flex items-center gap-2">
          <img src={duckSvg} alt="Duck" className="h-10 w-auto" />
          <span className="text-xl font-semibold">
            {t('chat.welcome.startChat', { model: currentLabel })}
          </span>
        </div>

        {/* 模型选择按钮 */}
        <RadioGroupButton
          options={MODELS.map((m) => ({ label: m.label, value: m.id }))}
          value={selectedModel}
          onValueChange={setModel}
        />

        {/* 第三行：输入组件 */}
        <div className="w-full">
          <ChatInput onSend={(content) => sendMessage(content)} disabled={isLoading} />
        </div>
      </div>
    </div>
  );
}
