/**
 * 一言插件 - 改编自 TeleBox hitokoto
 * 功能：从 hitokoto.cn 获取随机一言
 */

import { Plugin } from "../src/types/index.js";
import axios from "axios";

// 应用Emoji
const EMOJI = {
  QUOTE: "💬",
  BOOK: "📚",
  LOADING: "🔄",
  ERROR: "❌",
  HELP: "❓",
};

// 一言类型映射
const hitokotoTypeMap: Record<string, string> = {
  "a": "动画",
  "b": "漫画",
  "c": "游戏",
  "d": "文学",
  "e": "原创",
  "f": "网络",
  "g": "其他",
  "h": "影视",
  "i": "诗词",
  "j": "网易云",
  "k": "哲学",
  "l": "抖机灵"
};

// 一言响应接口
interface HitokotoResponse {
  hitokoto: string;
  from?: string;
  from_who?: string;
  type: string;
}

const helpText = `${EMOJI.QUOTE} <b>一言插件</b>

<b>功能：</b>
• 从 hitokoto.cn 获取随机一言
• 支持多种类型（动画、漫画、文学等）
• 包含详细的来源信息

<b>用法：</b>
<code>.hitokoto</code> - 获取随机一言

<b>支持的类型：</b>
• 动画、漫画、游戏
• 文学、影视、诗词
• 哲学、网易云、抖机灵`;

// HTML转义
function htmlEscape(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const hitokotoPlugin: Plugin = {
  name: "hitokoto",
  version: "1.0.0",
  description: "获取随机一言",
  author: "TeleBox adapted for NexBot",

  commands: {
    hitokoto: {
      description: "获取随机一言",
      aliases: ["yiyan", "quote"],
      examples: ["hitokoto"],
      handler: async (msg, args, ctx) => {
        // 显示帮助
        if (args.length > 0 && (args[0] === "help" || args[0] === "h")) {
          await ctx.replyHTML(helpText);
          return;
        }

        let hitokotoData: HitokotoResponse | null = null;
        let retryCount = 0;
        const maxRetries = 3;

        // 重试机制
        while (retryCount < maxRetries && !hitokotoData) {
          try {
            const response = await axios.get(
              "https://v1.hitokoto.cn/?charset=utf-8",
              { timeout: 10000 }
            );
            hitokotoData = response.data;
            break;
          } catch (error) {
            retryCount++;
            if (retryCount >= maxRetries) {
              await ctx.reply(`${EMOJI.ERROR} 获取一言失败，请稍后重试`);
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (!hitokotoData) {
          await ctx.reply(`${EMOJI.ERROR} 无法获取一言数据`);
          return;
        }

        // 构建来源信息
        let sourceInfo = "";
        if (hitokotoData.from) {
          sourceInfo += `《${htmlEscape(hitokotoData.from)}》`;
        }
        if (hitokotoData.type && hitokotoTypeMap[hitokotoData.type]) {
          sourceInfo += `（${hitokotoTypeMap[hitokotoData.type]}）`;
        }
        if (hitokotoData.from_who) {
          sourceInfo += ` - ${htmlEscape(hitokotoData.from_who)}`;
        }

        // 构建最终消息
        const finalText = sourceInfo
          ? `${EMOJI.QUOTE} ${htmlEscape(hitokotoData.hitokoto)}\n\n${EMOJI.BOOK} ${sourceInfo}`
          : `${EMOJI.QUOTE} ${htmlEscape(hitokotoData.hitokoto)}`;

        await ctx.replyHTML(finalText);
      },
    },
  },
};

export default hitokotoPlugin;
