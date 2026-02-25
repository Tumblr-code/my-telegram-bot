import { Plugin } from "../types/index.js";
import { getSystemInfo, formatUptime, formatBytes } from "../utils/system.js";
import { fmt } from "../utils/context.js";
import { db } from "../utils/database.js";
import { pluginManager } from "../core/pluginManager.js";
import { healthChecker } from "../utils/healthCheck.js";
import { defaultCache } from "../utils/cache.js";
import { defaultRateLimiter } from "../utils/rateLimiter.js";
import { VERSION } from "../utils/version.js";

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
        const pluginCount = pluginManager.getAllPlugins().length;

        // 简约风格系统信息
        let text = fmt.bold(`📊 ${botName}`) + ` ${fmt.italic("v" + botVersion)}\n\n`;
        
        text += `${info.platform} · ${info.arch} · ${info.nodeVersion}\n`;
        text += `⏱️ ${formatUptime(info.uptime)}\n\n`;
        
        // 内存进度条风格
        const memPercent = info.memory.percent;
        const memBar = "█".repeat(Math.floor(memPercent / 10)) + "░".repeat(10 - Math.floor(memPercent / 10));
        text += `💾 ${memBar} ${memPercent}%\n`;
        text += `${info.memory.used}MB / ${info.memory.total}MB\n\n`;
        
        // CPU 信息
        const cpuBar = "█".repeat(Math.floor(info.cpu.usage / 10)) + "░".repeat(10 - Math.floor(info.cpu.usage / 10));
        text += `💻 ${cpuBar} ${info.cpu.usage}%\n`;
        text += `${info.cpu.cores}核 · ${pluginCount}插件`;

        await ctx.replyHTML(text);
      },
    },

    uptime: {
      description: "显示运行时间",
      aliases: ["up"],
      handler: async (msg, args, ctx) => {
        const info = getSystemInfo();
        await ctx.replyHTML(
          fmt.bold("⏱️ 运行时间") + "\n\n" +
          `系统: ${formatUptime(info.uptime)}\n` +
          `进程: ${formatUptime(process.uptime())}`
        );
      },
    },

    db: {
      description: "数据库信息",
      sudo: true,
      aliases: ["database"],
      handler: async (msg, args, ctx) => {
        const aliases = Object.keys(db.getAllAliases()).length;

        let text = fmt.bold("💾 数据库") + "\n\n";
        text += `🏷️ ${aliases} 别名`;

        await ctx.replyHTML(text);
      },
    },

    health: {
      description: "健康状态检查",
      aliases: ["hc"],
      handler: async (msg, args, ctx) => {
        const status = healthChecker.getStatus();
        const m = status.metrics;
        
        const statusIcon = status.status === "healthy" ? "🟢" : status.status === "degraded" ? "🟡" : "🔴";
        
        let text = fmt.bold(`${statusIcon} 健康状态`) + "\n\n";
        text += `⏱️ ${formatUptime(m.uptime)}\n`;
        text += `💾 ${m.memory.percent}% · 📩 ${m.messages.total} · ⚡ ${m.commands.total}\n`;
        
        if (status.checks.length > 0) {
          const failedChecks = status.checks.filter(c => c.status !== "pass");
          if (failedChecks.length > 0) {
            text += "\n" + failedChecks.map(c => `⚠️ ${c.name}`).join("\n");
          }
        }

        await ctx.replyHTML(text);
      },
    },

    cache: {
      description: "缓存统计",
      sudo: true,
      handler: async (msg, args, ctx) => {
        const stats = defaultCache.getStats();
        
        let text = fmt.bold("💾 缓存") + "\n\n";
        text += `📦 ${stats.size} 条目\n`;
        text += `🎯 ${stats.hitRate}% 命中率`;

        await ctx.replyHTML(text);
      },
    },

    ratelimit: {
      description: "限流统计",
      sudo: true,
      aliases: ["rl"],
      handler: async (msg, args, ctx) => {
        const stats = defaultRateLimiter.getStats();
        
        let text = fmt.bold("🚦 限流") + "\n\n";
        text += `👥 ${stats.tracked} 用户\n`;
        text += `🚫 ${stats.blocked} 封禁`;

        await ctx.replyHTML(text);
      },
    },
  },
};

export default sysinfoPlugin;
