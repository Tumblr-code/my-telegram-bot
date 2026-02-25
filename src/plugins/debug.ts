import { Plugin } from "../types/index.js";
import { fmt } from "../utils/context.js";

// 应用Emoji表情
const EMOJI = {
  ID: "🆔",
  CHAT: "💬",
  TYPE: "📋",
  TITLE: "📌",
  USERNAME: "👤",
  SENDER: "📨",
  USER: "👤",
  NAME: "🏷️",
  MESSAGE: "💬",
  DATE: "📅",
  ECHO: "📢",
  WAVE: "👋",
  PING: "🏓",
  DATA: "📊",
  CODE: "💻",
  ARROW: "→",
};

const debugPlugin: Plugin = {
  name: "debug",
  version: "1.0.0",
  description: "调试工具",
  author: "NexBot",

  commands: {
    id: {
      description: "获取当前聊天信息",
      aliases: ["chatid", "chat"],
      handler: async (msg, args, ctx) => {
        const chat = msg.chat;
        // 修复：使用 senderId 或 fromId 获取发送者ID，而不是不存在的 sender 属性
        const senderId = (msg as any).senderId || (msg as any).fromId;
        
        let text = fmt.bold(`${EMOJI.ID} 聊天信息`) + "\n\n";
        text += fmt.bold(`${EMOJI.ID} 聊天 ID:`) + " " + (chat?.id?.toString() || "N/A") + "\n";
        text += fmt.bold(`${EMOJI.TYPE} 聊天类型:`) + " " + (chat?.className || "N/A") + "\n";
        
        if ((chat as any)?.title) {
          text += fmt.bold(`${EMOJI.TITLE} 标题:`) + " " + (chat as any).title + "\n";
        }
        if ((chat as any)?.username) {
          text += fmt.bold(`${EMOJI.USERNAME} 用户名:`) + " @" + (chat as any).username + "\n";
        }
        
        text += "\n" + fmt.bold(`${EMOJI.SENDER} 发送者信息`) + "\n";
        text += fmt.bold(`${EMOJI.ID} 用户 ID:`) + " " + (senderId?.toString() || "N/A") + "\n";
        
        // 尝试从其他属性获取用户信息
        const msgAny = msg as any;
        const sender = msgAny._sender || msgAny.sender;
        
        if (sender?.firstName || (sender as any)?.firstName) {
          const firstName = sender.firstName || (sender as any).firstName;
          const lastName = sender.lastName || (sender as any).lastName || "";
          text += fmt.bold(`${EMOJI.NAME} 名称:`) + " " + firstName + (lastName ? " " + lastName : "") + "\n";
        }
        if (sender?.username || (sender as any)?.username) {
          text += fmt.bold(`${EMOJI.USERNAME} 用户名:`) + " @" + (sender.username || (sender as any).username) + "\n";
        }
        
        text += "\n" + fmt.bold(`${EMOJI.MESSAGE} 消息信息`) + "\n";
        text += fmt.bold(`${EMOJI.ID} 消息 ID:`) + " " + msg.id + "\n";
        // 修复：添加空值检查
        const dateStr = msg.date ? new Date(msg.date * 1000).toLocaleString() : "N/A";
        text += fmt.bold(`${EMOJI.DATE} 日期:`) + " " + dateStr + "\n";

        await ctx.replyHTML(text);
      },
    },

    echo: {
      description: "回声测试",
      aliases: ["say"],
      examples: ["echo Hello World"],
      handler: async (msg, args, ctx) => {
        const text = args.join(" ") || `${EMOJI.WAVE} Hello from NexBot!`;
        await ctx.reply(`${EMOJI.ECHO} ${text}`);
      },
    },

    ping: {
      description: "测试响应速度",
      aliases: ["pong"],
      handler: async (msg, args, ctx) => {
        const start = Date.now();
        const reply = await ctx.reply(`${EMOJI.PING} Pong!`);
        const latency = Date.now() - start;
        await ctx.replyHTML(fmt.bold(`${EMOJI.PING} Pong!`) + "\n响应时间: " + latency + "ms");
      },
    },

    msg: {
      description: "获取消息原始数据（调试用）",

      handler: async (msg, args, ctx) => {
        // @ts-ignore - toJSON may not exist on Message type
        const data = JSON.stringify((msg as any).toJSON ? (msg as any).toJSON() : msg, null, 2);
        const truncated = data.length > 4000 ? data.slice(0, 4000) + "\n... (truncated)" : data;
        await ctx.replyHTML(fmt.pre(truncated, "json"));
      },
    },
  },
};

export default debugPlugin;
