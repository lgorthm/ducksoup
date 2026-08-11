export type ModelName = 'deepseek-v4-flash' | 'deepseek-v4-pro';

export const MODEL_LABELS: Record<ModelName, string> = {
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
};

export interface SettingsState {
  apiKey: string;
  hasApiKey: boolean;
  selectedModel: ModelName;
  deepThink: boolean;
}

export const initialSettingsState: SettingsState = {
  apiKey: '',
  hasApiKey: false,
  selectedModel: 'deepseek-v4-flash',
  deepThink: false,
};
