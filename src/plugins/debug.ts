import { Plugin } from "../types/index.js";
import { fmt } from "../utils/context.js";

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
        const sender = msg.sender;
        
        let text = fmt.bold("🆔 聊天信息") + "\n\n";
        text += fmt.bold("聊天 ID:") + ` ${chat?.id?.toString() || "N/A"}\n`;
        text += fmt.bold("聊天类型:") + ` ${chat?.className || "N/A"}\n`;
        
        if ((chat as any)?.title) {
          text += fmt.bold("标题:") + ` ${(chat as any).title}\n`;
        }
        if ((chat as any)?.username) {
          text += fmt.bold("用户名:") + ` @${(chat as any).username}\n`;
        }
        
        text += "\n" + fmt.bold("发送者信息") + "\n";
        text += fmt.bold("用户 ID:") + ` ${sender?.id?.toString() || "N/A"}\n`;
        
        if ((sender as any)?.firstName) {
          text += fmt.bold("名称:") + ` ${(sender as any).firstName}`;
          if ((sender as any)?.lastName) {
            text += ` ${(sender as any).lastName}`;
          }
          text += "\n";
        }
        if ((sender as any)?.username) {
          text += fmt.bold("用户名:") + ` @${(sender as any).username}\n`;
        }
        
        text += "\n" + fmt.bold("消息信息") + "\n";
        text += fmt.bold("消息 ID:") + ` ${msg.id}\n`;
        text += fmt.bold("日期:") + ` ${new Date(msg.date * 1000).toLocaleString()}\n`;

        await ctx.replyHTML(text);
      },
    },

    echo: {
      description: "回声测试",
      aliases: ["say"],
      examples: ["echo Hello World"],
      handler: async (msg, args, ctx) => {
        const text = args.join(" ") || "👋 Hello from NexBot!";
        await ctx.reply(text);
      },
    },

    ping: {
      description: "测试响应速度",
      aliases: ["pong"],
      handler: async (msg, args, ctx) => {
        const start = Date.now();
        const reply = await ctx.reply("🏓 Pong!");
        const latency = Date.now() - start;
        await ctx.replyHTML(`${fmt.bold("🏓 Pong!")}\n响应时间: ${latency}ms`);
      },
    },

    msg: {
      description: "获取消息原始数据（调试用）",
      sudo: true,
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
