import { Api, TelegramClient } from "telegram";

// 消息类型
export type Message = Api.Message;

// 命令处理器类型
export type CommandHandler = (
  msg: Message,
  args: string[],
  ctx: CommandContext
) => Promise<void>;

// 命令上下文
export interface CommandContext {
  client: TelegramClient;
  reply: (text: string, options?: ReplyOptions) => Promise<Message>;
  replyHTML: (html: string, options?: ReplyOptions) => Promise<Message>;
  edit: (text: string, options?: ReplyOptions) => Promise<Message>;
  editHTML: (html: string, options?: ReplyOptions) => Promise<Message>;
  deleteMessage: () => Promise<void>;
  isSudo: boolean;
  isPrivate: boolean;
  isGroup: boolean;
  isChannel: boolean;
}

// 回复选项
export interface ReplyOptions {
  parseMode?: "html" | "markdown" | "markdownv2";
  replyToMessageId?: number | null;
  disableWebPagePreview?: boolean;
  silent?: boolean;
  replyMarkup?: any;
}

// 命令处理器类型 (TeleBox 兼容)
export type CmdHandler = (msg: Message, ...args: any[]) => Promise<void>;

// 插件定义
export interface Plugin {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version?: string;
  /** 插件描述 */
  description: string;
  /** 插件作者 */
  author?: string;
  /** 命令处理器映射表 (NexBot 标准) */
  commands?: Record<string, CommandDefinition>;
  /** 命令处理器映射表 (TeleBox 兼容) */
  cmdHandlers?: Record<string, CmdHandler>;
  /** 消息监听器 */
  onMessage?: (msg: Message, client: TelegramClient) => Promise<void>;
  /** 事件监听器 */
  onEvent?: Record<string, EventHandler>;
  /** 初始化钩子 */
  onInit?: (client: TelegramClient) => Promise<void>;
  /** 卸载钩子 */
  onUnload?: () => Promise<void>;
}

// 命令定义
export interface CommandDefinition {
  /** 命令描述 */
  description: string;
  /** 命令处理器 */
  handler: CommandHandler;
  /** 是否需要 sudo 权限 */
  sudo?: boolean;
  /** 命令别名 */
  aliases?: string[];
  /** 使用示例 */
  examples?: string[];
}

// 事件处理器
export type EventHandler = (event: any, client: TelegramClient) => Promise<void>;

// 插件元数据
export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  dependencies?: string[];
}

// 数据库记录
export interface DBRecord {
  id?: number;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: any;
}

// 用户权限
export interface UserPermission {
  userId: number;
  isSudo: boolean;
  isWhitelist: boolean;
  createdAt: number;
}

// 系统信息
export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  cpu: {
    model: string;
    cores: number;
    usage: number;
  };
}
