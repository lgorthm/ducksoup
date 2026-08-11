import { useTranslation } from 'react-i18next';
import duckSvg from '@/assets/duck.svg';
import { ChatComposer } from '@/features/chat/components/chat-composer';
import { setModel } from '@/stores/actions';
import { MODEL_LABELS, type ModelName } from '@/stores/models';
import { useStore } from '@/stores';
import { RadioGroupButton } from '@/shared/components/ui/radio-group-button';

const MODEL_OPTIONS = (
  Object.entries(MODEL_LABELS) as [ModelName, string][]
).map(([id, label]) => ({
  label,
  value: id,
}));

export function ChatWelcome() {
  const { t } = useTranslation();
  const selectedModel = useStore((s) => s.selectedModel);

  const currentLabel = MODEL_LABELS[selectedModel];

  return (
    <div
      data-testid="chat-welcome"
      className="flex h-full flex-col items-center justify-center px-4"
    >
      <div className="flex w-full max-w-194 flex-col items-center gap-8">
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
          <ChatComposer />
        </div>
      </div>
    </div>
  );
}
