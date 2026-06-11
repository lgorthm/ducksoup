import { useTranslation } from 'react-i18next';
import duckSvg from '@/assets/duck.svg';
import { ChatInput } from '@/features/chat/components/chat-input';
import {
  useChatStore,
  MODEL_LABELS,
  type ModelName,
} from '@/features/chat/store/chat-store';
import { RadioGroupButton } from '@/shared/components/ui';

const MODEL_OPTIONS = (
  Object.entries(MODEL_LABELS) as [ModelName, string][]
).map(([id, label]) => ({
  label,
  value: id,
}));

export function ChatWelcome() {
  const { t } = useTranslation();
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setModel = useChatStore((s) => s.setModel);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isLoading = useChatStore((s) => s.isLoading);

  const currentLabel = MODEL_LABELS[selectedModel];

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
          options={MODEL_OPTIONS}
          value={selectedModel}
          onValueChange={setModel}
        />

        {/* 第三行：输入组件 */}
        <div className="w-full">
          <ChatInput
            onSend={(content) => sendMessage(content)}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
