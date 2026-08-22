import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import duckSvg from '@/assets/duck.svg';
import { ChatComposer } from '@/features/chat/components/chat-composer';
import { DEFAULT_MODEL, MODEL_LABELS, type ModelName } from '@/stores/models';
import { RadioGroupButton } from '@/shared/components/ui/radio-group-button';

const MODEL_OPTIONS = (
  Object.entries(MODEL_LABELS) as [ModelName, string][]
).map(([id, label]) => ({
  label,
  value: id,
}));

/**
 * 新会话欢迎页。草稿模型仅存于本地 state：
 * 首条消息发出后随会话持久化并固定，切换模型需新建会话。
 * 有待发图片时隐藏模型切换，避免切到不支持图像的 Pro。
 */
export function ChatWelcome() {
  const { t } = useTranslation();
  const [selectedModel, setSelectedModel] = useState<ModelName>(DEFAULT_MODEL);
  const [pendingCount, setPendingCount] = useState(0);

  const currentLabel = MODEL_LABELS[selectedModel];
  const showModelPicker = pendingCount === 0;

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

        {showModelPicker ? (
          <RadioGroupButton
            options={MODEL_OPTIONS}
            value={selectedModel}
            onValueChange={setSelectedModel}
          />
        ) : null}

        <div className="w-full">
          <ChatComposer
            draftModel={selectedModel}
            onPendingImagesChange={setPendingCount}
          />
        </div>
      </div>
    </div>
  );
}
