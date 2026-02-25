/**
 * 插件基类 - 为 TeleBox 兼容插件提供支持
 */
import { TelegramClient, Api } from "telegram";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

// 插件接口定义
export interface PluginConfig {
  name: string;
  version?: string;
  description?: string;
  author?: string;
}

// 命令处理器类型
export type CmdHandler = (msg: Api.Message, ...args: any[]) => Promise<void>;

// 插件基类
export abstract class Plugin {
  abstract name: string;
  abstract description: string;
  version?: string = "1.0.0";
  author?: string = "Unknown";
  
  // 命令处理器映射
  cmdHandlers: Record<string, CmdHandler> = {};
  
  // 消息处理器 (NexBot 标准)
  onMessage?(msg: Api.Message, client: TelegramClient): Promise<void>;
  
  // 初始化钩子
  async onInit?(client: TelegramClient): Promise<void>;
  
  // 卸载钩子
  async onUnload?(): Promise<void>;
  
  // 清理方法
  async cleanup?(): Promise<void>;
}

// 创建目录辅助函数
export function createDirectoryInAssets(dirName: string): string {
  const assetsDir = join(process.cwd(), "data", "assets");
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }
  
  const targetDir = join(assetsDir, dirName);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  
  return targetDir;
}
