/**
 * 一言插件
 */

import { Plugin } from "../src/types/index.js";
import axios from "axios";

const EMOJI = {
  QUOTE: "💬", SOURCE: "📖", AUTHOR: "✍️",
  LOADING: "🔄", ERROR: "❌",
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const HITOKOTO_TYPES: Record<string, string> = {
  "a": "动画", "b": "漫画", "c": "游戏", "d": "文学",
  "e": "原创", "f": "网络", "g": "其他", "h": "影视",
  "i": "诗词", "j": "网易云", "k": "哲学", "l": "抖机灵",
};

const hitokotoPlugin: Plugin = {
  name: "hitokoto",
  version: "1.0.0",
  description: "获取随机一言",
  author: "NexBot",

  commands: {
    hitokoto: {
      description: "获取随机一言，支持动画、文学、哲学等分类",
      aliases: ["yiyan", "yy", "一言"],
      examples: ["hitokoto", "hitokoto 动画", "hitokoto 哲学"],

      handler: async (msg, args, ctx) => {
        try {
          // 显示获取中
          await (msg as any).edit({
            text: `${EMOJI.LOADING} <b>正在获取一言...</b>\n\n正在连接服务器...`,
            parseMode: "html",
          });
          
          const startTime = Date.now();

          // 解析参数
          let typeParam = "";
          const typeArg = args.join(" ").trim().toLowerCase();
          const typeMap: Record<string, string> = {
            "动画": "a", "漫画": "b", "游戏": "c", "文学": "d",
            "原创": "e", "网络": "f", "其他": "g", "影视": "h",
            "诗词": "i", "网易云": "j", "哲学": "k", "抖机灵": "l",
          };
          
          if (typeArg && typeMap[typeArg]) {
            typeParam = `?c=${typeMap[typeArg]}`;
          } else if (typeArg && HITOKOTO_TYPES[typeArg]) {
            typeParam = `?c=${typeArg}`;
          }

          const response = await axios.get(`https://v1.hitokoto.cn/${typeParam}`, { timeout: 10000 });
          const result = response.data;
          
          // 确保 loading 至少显示1秒
          const elapsed = Date.now() - startTime;
          if (elapsed < 1000) await sleep(1000 - elapsed);

          const typeName = HITOKOTO_TYPES[result.type] || "其他";
          
          let text = `${EMOJI.QUOTE} <b>一言</b> <i>${typeName}</i>\n\n`;
          text += `<blockquote>${result.hitokoto}</blockquote>\n\n`;
          text += `${EMOJI.SOURCE} 《${result.from || "未知"}》\n`;
          text += `${EMOJI.AUTHOR} ${result.from_who || "佚名"}`;

          await (msg as any).edit({
            text: text,
            parseMode: "html",
          });
        } catch (err) {
          console.error("[hitokoto] 错误:", err);
          await (msg as any).edit({
            text: `${EMOJI.ERROR} <b>获取失败</b>\n\n${err instanceof Error ? err.message : "未知错误"}`,
            parseMode: "html",
          });
        }
      },
    },
  },
};

export default hitokotoPlugin;
