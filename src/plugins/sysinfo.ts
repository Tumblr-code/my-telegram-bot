import { Plugin } from "../types/index.js";
import { getSystemInfo, formatUptime, formatBytes } from "../utils/system.js";
import { fmt } from "../utils/context.js";
import { db } from "../utils/database.js";
import { pluginManager } from "../core/pluginManager.js";
import { healthChecker } from "../utils/healthCheck.js";
import { defaultCache } from "../utils/cache.js";
import { defaultRateLimiter } from "../utils/rateLimiter.js";
import { VERSION } from "../utils/version.js";

// 应用Emoji表情
const EMOJI = {
  CHART: "📊",
  VERSION: "🏷️",
  TIME: "⏱️",
  MEMORY: "💾",
  CPU: "💻",
  DATABASE: "🗄️",
  CACHE: "🧠",
  RATELIMIT: "🚦",
  HEALTH: "❤️",
  UPTIME: "⏳",
  GREEN: "🟢",
  YELLOW: "🟡",
  RED: "🔴",
  WARNING: "⚠️",
  TAG: "🏷️",
  PACKAGE: "📦",
  TARGET: "🎯",
  USER: "👤",
  BAN: "🚫",
};

const sysinfoPlugin: Plugin = {
  name: "sysinfo",
  version: "1.0.0",
  description: "系统信息监控",
  author: "NexBot",

  commands: {
    sysinfo: {
      description: "显示系统信息",
      aliases: ["status", "stats", "info"],
      handler: async (msg, args, ctx) => {
        const info = getSystemInfo();
        const botName = process.env.BOT_NAME || "NexBot";
        const botVersion = VERSION;

        // 精美系统信息
        let text = fmt.bold(`${EMOJI.CHART} ${botName}`) + ` ${EMOJI.VERSION} ${fmt.italic("v" + botVersion)}\n\n`;
        
        text += `${info.platform} · ${info.arch} · ${info.nodeVersion}\n`;
        text += `${EMOJI.TIME} ${formatUptime(info.uptime)}\n\n`;
        
        // 内存进度条风格
        const memPercent = info.memory.percent;
        const memBar = "█".repeat(Math.floor(memPercent / 10)) + "░".repeat(10 - Math.floor(memPercent / 10));
        text += `${EMOJI.MEMORY} ${memBar} ${memPercent}%\n`;
        text += `${info.memory.used}MB / ${info.memory.total}MB\n\n`;
        
        // CPU 信息 - 显示核心数和型号
        const cpuBar = "█".repeat(Math.floor(info.cpu.usage / 10)) + "░".repeat(10 - Math.floor(info.cpu.usage / 10));
        // 简化 CPU 型号显示
        const cpuModel = info.cpu.model
          .replace(/\(R\)/g, "")
          .replace(/\(TM\)/g, "")
          .replace(/Intel\s*/i, "")
          .replace(/AMD\s*/i, "")
          .replace(/CPU\s*/gi, "")
          .replace(/\s+Processor/gi, "")
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 25);
        text += `${EMOJI.CPU} ${cpuBar} ${info.cpu.usage}%\n`;
        text += `${info.cpu.cores}核 · ${cpuModel}`;

        await ctx.replyHTML(text);
      },
    },

    uptime: {
      description: "显示运行时间",
      aliases: ["up"],
      handler: async (msg, args, ctx) => {
        const info = getSystemInfo();
        await ctx.replyHTML(
          fmt.bold(`${EMOJI.UPTIME} 运行时间`) + "\n\n" +
          `${EMOJI.TIME} 系统: ${formatUptime(info.uptime)}\n` +
          `${EMOJI.TIME} 进程: ${formatUptime(process.uptime())}`
        );
      },
    },

    db: {
      description: "数据库信息",

      aliases: ["database"],
      handler: async (msg, args, ctx) => {
        const aliases = Object.keys(db.getAllAliases()).length;

        let text = fmt.bold(`${EMOJI.DATABASE} 数据库`) + "\n\n";
        text += `${EMOJI.TAG} ${aliases} 别名`;

        await ctx.replyHTML(text);
      },
    },

    health: {
      description: "健康状态检查",
      aliases: ["hc"],
      handler: async (msg, args, ctx) => {
        const status = healthChecker.getStatus();
        const m = status.metrics;
        
        const statusIcon = status.status === "healthy" ? EMOJI.GREEN : status.status === "degraded" ? EMOJI.YELLOW : EMOJI.RED;
        
        let text = fmt.bold(`${statusIcon} 健康状态`) + "\n\n";
        text += `${EMOJI.TIME} ${formatUptime(m.uptime)}\n`;
        text += `${EMOJI.MEMORY} ${m.memory.percent}% · 📩 ${m.messages.total} · ⚡ ${m.commands.total}\n`;
        
        if (status.checks.length > 0) {
          const failedChecks = status.checks.filter(c => c.status !== "pass");
          if (failedChecks.length > 0) {
            text += "\n" + failedChecks.map(c => `${EMOJI.WARNING} ${c.name}`).join("\n");
          }
        }

        await ctx.replyHTML(text);
      },
    },

    cache: {
      description: "缓存统计",

      handler: async (msg, args, ctx) => {
        const stats = defaultCache.getStats();
        
        let text = fmt.bold(`${EMOJI.CACHE} 缓存`) + "\n\n";
        text += `${EMOJI.PACKAGE} ${stats.size} 条目\n`;
        text += `${EMOJI.TARGET} ${stats.hitRate}% 命中率`;

        await ctx.replyHTML(text);
      },
    },

    ratelimit: {
      description: "限流统计",

      aliases: ["rl"],
      handler: async (msg, args, ctx) => {
        const stats = defaultRateLimiter.getStats();
        
        let text = fmt.bold(`${EMOJI.RATELIMIT} 限流`) + "\n\n";
        text += `${EMOJI.USER} ${stats.tracked} 用户\n`;
        text += `${EMOJI.BAN} ${stats.blocked} 封禁`;

        await ctx.replyHTML(text);
      },
    },
  },
};

export default sysinfoPlugin;
