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
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 flex flex-col items-center gap-3 duration-500">
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 -m-10 rounded-full bg-[radial-gradient(circle,oklch(0.85_0.12_90_/_0.38),transparent_70%)] dark:bg-[radial-gradient(circle,oklch(0.78_0.14_88_/_0.28),transparent_70%)]"
            />
            <img src={duckSvg} alt="Duck" className="relative h-12 w-auto" />
          </div>
          <h1 className="text-center text-3xl font-semibold tracking-tight text-balance">
            {t('chat.welcome.startChat', { model: currentLabel })}
          </h1>
          <p className="max-w-md text-center text-sm text-pretty text-muted-foreground">
            {t('chat.welcome.subtitle')}
          </p>
        </div>

        {showModelPicker ? (
          <div className="animate-in fade-in-0 slide-in-from-bottom-2 delay-100 duration-500 fill-mode-both">
            <RadioGroupButton
              options={MODEL_OPTIONS}
              value={selectedModel}
              onValueChange={setSelectedModel}
            />
          </div>
        ) : null}

        <div className="animate-in fade-in-0 slide-in-from-bottom-2 w-full delay-200 duration-500 fill-mode-both">
          <ChatComposer
            draftModel={selectedModel}
            onPendingImagesChange={setPendingCount}
          />
        </div>
      </div>
    </div>
  );
}
