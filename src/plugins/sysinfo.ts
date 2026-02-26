import { Plugin } from "../types/index.js";
import { getSystemInfo, formatUptime, formatBytes } from "../utils/system.js";
import { fmt } from "../utils/context.js";
import { db } from "../utils/database.js";
import { pluginManager } from "../core/pluginManager.js";
import { healthChecker } from "../utils/healthCheck.js";
import { defaultCache } from "../utils/cache.js";
import { defaultRateLimiter } from "../utils/rateLimiter.js";
import { VERSION } from "../utils/version.js";
import { spawn, exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

const execAsync = promisify(exec);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getGitInfo(): Promise<{ branch: string; commit: string }> {
  try {
    const { stdout: branch } = await execAsync("git branch --show-current");
    const { stdout: commit } = await execAsync("git rev-parse --short HEAD");
    return { branch: branch.trim(), commit: commit.trim() };
  } catch {
    return { branch: "unknown", commit: "unknown" };
  }
}

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
  UPDATE: "🔄",
  RESTART: "🔄",
  LOGS: "📋",
  INFO: "ℹ️",
  ERROR: "❌",
  SUCCESS: "✅",
  SHELL: "💻",
  GEAR: "⚙️",
  CHECK: "✓",
  LOADING: "⏳",
  BRANCH: "🌿",
  COMMIT: "🔖",
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

        await ctx.editHTML(text);
      },
    },

    uptime: {
      description: "显示运行时间",
      aliases: ["up"],
      handler: async (msg, args, ctx) => {
        const info = getSystemInfo();
        await ctx.editHTML(
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

        await ctx.editHTML(text);
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

        await ctx.editHTML(text);
      },
    },

    cache: {
      description: "缓存统计",

      handler: async (msg, args, ctx) => {
        const stats = defaultCache.getStats();
        
        let text = fmt.bold(`${EMOJI.CACHE} 缓存`) + "\n\n";
        text += `${EMOJI.PACKAGE} ${stats.size} 条目\n`;
        text += `${EMOJI.TARGET} ${stats.hitRate}% 命中率`;

        await ctx.editHTML(text);
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

        await ctx.editHTML(text);
      },
    },

    update: {
      description: "从GitHub更新代码",
      aliases: ["up"],
      examples: ["update"],
      handler: async (msg, args, ctx) => {
        try {
          await ctx.editHTML(`${EMOJI.UPDATE} <b>正在更新...</b>\n\n${EMOJI.LOADING} 正在检查远程分支...`);
          await sleep(800);

          const gitInfo = await getGitInfo();
          await ctx.editHTML(`${EMOJI.UPDATE} <b>正在更新...</b>\n\n${EMOJI.BRANCH} 分支: ${gitInfo.branch}\n${EMOJI.COMMIT} 版本: ${gitInfo.commit}\n${EMOJI.LOADING} 正在拉取代码...`);

          const { stdout, stderr } = await execAsync("git pull origin main");
          const output = stdout + (stderr ? "\n" + stderr : "");

          if (output.includes("Already up to date") || output.includes("已经是最新")) {
            await ctx.editHTML(`${EMOJI.SUCCESS} <b>无需更新</b>\n\n${EMOJI.CHECK} 当前已是最新\n${EMOJI.BRANCH} ${gitInfo.branch} / ${gitInfo.commit}`);
          } else if (output.includes("error") || output.includes("fatal")) {
            await ctx.editHTML(`${EMOJI.ERROR} <b>更新失败</b>\n\n<pre>${output.slice(0, 1000)}</pre>`);
          } else {
            await ctx.editHTML(`${EMOJI.SUCCESS} <b>更新成功</b>\n\n${EMOJI.CHECK} 代码已更新，请使用 .restart 重启\n\n<pre>${output.slice(0, 800)}</pre>`);
          }
        } catch (err) {
          await ctx.editHTML(`${EMOJI.ERROR} <b>更新失败</b>\n\n${err instanceof Error ? err.message : "未知错误"}`);
        }
      },
    },

    upgrade: {
      description: "升级依赖",
      aliases: ["upg"],
      examples: ["upgrade"],
      handler: async (msg, args, ctx) => {
        try {
          await ctx.editHTML(`${EMOJI.GEAR} <b>正在升级依赖...</b>\n\n${EMOJI.LOADING} 正在执行 bun install...`);
          await sleep(800);

          const { stdout, stderr } = await execAsync("bun install");
          const output = stdout + (stderr ? "\n" + stderr : "");

          await ctx.editHTML(`${EMOJI.SUCCESS} <b>依赖升级完成</b>\n\n${EMOJI.CHECK} 请使用 .restart 重启生效\n\n<pre>${output.slice(0, 1000)}</pre>`);
        } catch (err) {
          await ctx.editHTML(`${EMOJI.ERROR} <b>升级失败</b>\n\n${err instanceof Error ? err.message : "未知错误"}`);
        }
      },
    },

    restart: {
      description: "重启机器人",
      aliases: ["reboot"],
      examples: ["restart"],
      handler: async (msg, args, ctx) => {
        await ctx.editHTML(`${EMOJI.RESTART} <b>正在重启...</b>\n\n${EMOJI.LOADING} 正在准备重启\n⏱️ 预计需要 5-10 秒`);

        setTimeout(() => {
          const child = spawn("bun", ["run", "start"], {
            detached: true,
            stdio: "inherit",
          });
          child.unref();
          process.exit(0);
        }, 1500);
      },
    },

    logs: {
      description: "查看最近日志",
      aliases: ["log"],
      examples: ["logs 50"],
      handler: async (msg, args, ctx) => {
        try {
          const lines = parseInt(args.join(" ").trim()) || 30;
          const validLines = Math.min(Math.max(lines, 10), 100);

          await ctx.editHTML(`${EMOJI.LOGS} <b>正在获取日志...</b>\n\n${EMOJI.LOADING} 正在读取...`);
          await sleep(500);

          // 读取 PM2 日志
          const { stdout } = await execAsync(`pm2 logs nexbot --lines ${validLines} 2>&1 || tail -n ${validLines} /root/.pm2/logs/nexbot-out.log`);
          const logContent = stdout || "(无日志)";
          const truncated = logContent.length > 3500 ? logContent.slice(0, 3500) + "\n..." : logContent;

          await ctx.editHTML(`${EMOJI.LOGS} <b>最近 ${validLines} 行日志</b>\n\n<pre>${truncated}</pre>`);
        } catch (err) {
          await ctx.editHTML(`${EMOJI.ERROR} <b>读取失败</b>\n\n${err instanceof Error ? err.message : "未知错误"}`);
        }
      },
    },

    exec: {
      description: "执行shell命令",
      aliases: ["shell", "sh", "cmd", "sys"],
      examples: ["exec ls -la"],
      handler: async (msg, args, ctx) => {
        const cmdStr = args.join(" ");
        try {
          if (!cmdStr.trim()) {
            await ctx.editHTML(`${EMOJI.ERROR} <b>命令为空</b>\n\n用法: .exec <命令>`);
            return;
          }

          // 检查危险命令
          const dangerous = ["rm -rf /", "rm -rf /*", "mkfs", "dd if=/dev/zero", "> /dev/sda", "shutdown", "reboot", "poweroff", "halt", "chmod -R 777 /"];
          if (dangerous.some(cmd => cmdStr.toLowerCase().includes(cmd))) {
            await ctx.editHTML(`${EMOJI.WARNING} <b>危险命令已阻止</b>`);
            return;
          }

          await ctx.editHTML(`${EMOJI.SHELL} <b>正在执行命令...</b>\n\n${EMOJI.GEAR} <code>${cmdStr.slice(0, 100)}</code>\n${EMOJI.LOADING} 请稍候...`);
          await sleep(500);

          const { stdout, stderr } = await execAsync(cmdStr, { timeout: 60000 });
          const output = stdout || stderr || "(无输出)";
          const truncated = output.length > 3500 ? output.slice(0, 3500) + "\n..." : output;

          await ctx.editHTML(`${EMOJI.SHELL} <b>命令执行结果</b>\n\n<code>${cmdStr.slice(0, 100)}</code>\n\n<pre>${truncated}</pre>`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "未知错误";
          await ctx.editHTML(`${EMOJI.ERROR} <b>执行失败</b>\n\n<code>${cmdStr.slice(0, 100)}</code>\n\n<pre>${errorMsg.slice(0, 1000)}</pre>`);
        }
      },
    },
  },
};

export default sysinfoPlugin;
