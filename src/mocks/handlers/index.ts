import { deepseekHandlers, balanceHandlers } from './deepseek';

export const handlers = [...deepseekHandlers, ...balanceHandlers];
