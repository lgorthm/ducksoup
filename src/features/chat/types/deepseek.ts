// ========== 消息类型 ==========

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface SystemMessage {
  role: 'system';
  content: string;
  name?: string;
}

export type InputTextPart = { type: 'input_text'; text: string };

export type InputImagePart =
  | {
      type: 'input_image';
      image_url: string;
      detail?: 'auto' | 'low' | 'high' | 'original';
    }
  | { type: 'input_image'; file_id: string };

export type UserContent = string | Array<InputTextPart | InputImagePart>;

export interface UserMessage {
  role: 'user';
  content: UserContent;
  name?: string;
}

export interface AssistantMessage {
  role: 'assistant';
  content: string | null;
  name?: string;
  prefix?: boolean;
  reasoning_content?: string | null;
  tool_calls?: ToolCall[];
}

export interface ToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

export type ChatMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage;

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ========== Responses API 用量 ==========

export interface ResponsesUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
}

// ========== 余额查询类型 ==========

/** 单条余额信息 */
export interface BalanceInfo {
  /** 货币，人民币或美元 */
  currency: 'CNY' | 'USD';
  /** 总的可用余额，包括赠金和充值余额 */
  total_balance: string;
  /** 未过期的赠金余额 */
  granted_balance: string;
  /** 充值余额 */
  topped_up_balance: string;
}

/** 余额查询响应 */
export interface BalanceResponse {
  /** 当前账户是否有余额可供 API 调用 */
  is_available: boolean;
  /** 余额信息列表 */
  balance_infos: BalanceInfo[];
}
