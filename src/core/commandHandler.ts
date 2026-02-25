import { TelegramClient, Api } from "telegram";
import { NewMessage } from "telegram/events";
import { pluginManager } from "./pluginManager.js";
import { createContext } from "../utils/context.js";
import { db } from "../utils/database.js";
import { logger } from "../utils/logger.js";
import { healthChecker } from "../utils/healthCheck.js";
import { defaultRateLimiter } from "../utils/rateLimiter.js";

export class CommandHandler {
  private client: TelegramClient;
  private prefix: string;
  private devPrefix: string;

  constructor(client: TelegramClient) {
    this.client = client;
    this.prefix = process.env.CMD_PREFIX || ".";
    this.devPrefix = "!";
  }

  start(): void {
    this.client.addEventHandler(this.handleMessage.bind(this), new NewMessage({}));
    logger.info("命令处理器已启动");
  }

  private async handleMessage(event: { message: { message: string; chatId: BigInteger; senderId: BigInteger | undefined; id: number; date: number; replyToMsgId?: number }; }): Promise<void> {
    try {
      const msg = event.message;
      if (!msg) return;
      
      const text = msg.message;
      if (!text || typeof text !== "string") return;

      const isDev = process.env.NODE_ENV === "development";
      const prefix = isDev ? this.devPrefix : this.prefix;

      // 检查是否是命令
      if (!text.startsWith(prefix)) {
        // 传递给插件的消息监听器
        try {
          await pluginManager.handleMessage(msg);
          healthChecker.recordMessage(true);
        } catch (err) {
          logger.error("插件消息处理错误:", err);
          healthChecker.recordMessage(false);
        }
        return;
      }

      // 解析命令
      const content = text.slice(prefix.length).trim();
      if (!content) return;
      
      const parts = content.split(/\s+/);
      const cmdName = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (!cmdName) return;

      // 查找命令
      const cmdInfo = pluginManager.getCommand(cmdName);
      if (!cmdInfo) {
        // 未知命令，忽略或可以发送帮助
        return;
      }

      // 检查权限 - 只允许特定用户使用所有命令
      const OWNER_ID = 7873158072; // 你的用户ID
      const senderId = msg.senderId?.toString() || "";
      const senderIdNum = parseInt(senderId);
      if (isNaN(senderIdNum)) {
        logger.warn(`无法解析发送者 ID: ${senderId}`);
        return;
      }
      
      // 只有你能使用命令
      if (senderIdNum !== OWNER_ID) {
        // 其他人发来的命令，静默忽略
        return;
      }
      
      const isSudo = true; // 你就是sudo

      // 限流检查
      const rateLimitKey = `${senderIdNum}:${cmdName}`;
      const rateCheck = defaultRateLimiter.record(rateLimitKey);
      
      if (!rateCheck.allowed) {
        try {
          const resetSec = Math.ceil((rateCheck.resetTime - Date.now()) / 1000);
          await this.client.sendMessage(msg.chatId as any, {
            message: `⏱️ 请求过于频繁，请 ${resetSec} 秒后再试`,
            replyTo: Number(msg.id),
          });
        } catch (err) {
          logger.error("发送限流消息失败:", err);
        }
        healthChecker.recordCommand(false);
        return;
      }

      // 执行命令
      try {
        const ctx = createContext(this.client, msg as any, isSudo);
        await cmdInfo.def.handler(msg as any, args, ctx);
        
        logger.debug(`命令执行: ${cmdName} [${senderId}]`);
        healthChecker.recordCommand(true);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "未知错误";
        const errorStack = err instanceof Error ? err.stack : "";
        logger.error(`命令执行错误 ${cmdName}: ${errorMsg}`);
        if (errorStack) logger.error(`堆栈: ${errorStack}`);
        healthChecker.recordCommand(false);
        
        try {
          const chatId = (msg as any).chatId || (msg as any).peerId?.userId;
          if (chatId) {
            await this.client.sendMessage(chatId, {
              message: `❌ 命令执行出错: ${errorMsg}`,
            });
          }
        } catch (sendErr) {
          logger.error("发送错误消息失败:", sendErr);
        }
      }
    } catch (err) {
      logger.error("消息处理错误:", err);
    }
  }
}
