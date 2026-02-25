/**
 * 系统管理插件
 */

import { Plugin } from "../src/types/index.js";
import { spawn, exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

const execAsync = promisify(exec);

const EMOJI = {
  UPDATE: "🔄", RESTART: "🔄", LOGS: "📋", INFO: "ℹ️",
  ERROR: "❌", SUCCESS: "✅", WARNING: "⚠️", SHELL: "💻",
  GEAR: "⚙️", CHECK: "✓", LOADING: "⏳",
  BRANCH: "🌿", COMMIT: "🔖",
};

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

const systemPlugin: Plugin = {
  name: "system",
  version: "1.0.0",
  description: "系统管理命令",
  author: "NexBot",

  commands: {
    update: {
      description: "从GitHub更新代码",
      aliases: ["up"],
      examples: ["update"],

      handler: async (msg, args, ctx) => {
        try {
          await (msg as any).edit({
            text: `${EMOJI.UPDATE} <b>正在更新...</b>\n\n${EMOJI.LOADING} 正在检查远程分支...`,
            parseMode: "html",
          });
          
          await sleep(800);

          const gitInfo = await getGitInfo();
          
          await (msg as any).edit({
            text: `${EMOJI.UPDATE} <b>正在更新...</b>\n\n${EMOJI.BRANCH} 分支: ${gitInfo.branch}\n${EMOJI.COMMIT} 版本: ${gitInfo.commit}\n${EMOJI.LOADING} 正在拉取代码...`,
            parseMode: "html",
          });

          const { stdout, stderr } = await execAsync("git pull origin main");
          const output = stdout + (stderr ? "\n" + stderr : "");

          if (output.includes("Already up to date") || output.includes("已经是最新")) {
            await (msg as any).edit({
              text: `${EMOJI.SUCCESS} <b>无需更新</b>\n\n${EMOJI.CHECK} 当前已是最新\n${EMOJI.BRANCH} ${gitInfo.branch} / ${gitInfo.commit}`,
              parseMode: "html",
            });
          } else if (output.includes("error") || output.includes("fatal")) {
            await (msg as any).edit({
              text: `${EMOJI.ERROR} <b>更新失败</b>\n\n<pre>${output.slice(0, 1000)}</pre>`,
              parseMode: "html",
            });
          } else {
            await (msg as any).edit({
              text: `${EMOJI.SUCCESS} <b>更新成功</b>\n\n${EMOJI.CHECK} 代码已更新，请使用 .restart 重启\n\n<pre>${output.slice(0, 800)}</pre>`,
              parseMode: "html",
            });
          }
        } catch (err) {
          await (msg as any).edit({
            text: `${EMOJI.ERROR} <b>更新失败</b>\n\n${err instanceof Error ? err.message : "未知错误"}`,
            parseMode: "html",
          });
        }
      },
    },

    upgrade: {
      description: "升级依赖",
      aliases: ["upg"],
      examples: ["upgrade"],

      handler: async (msg, args, ctx) => {
        try {
          await (msg as any).edit({
            text: `${EMOJI.GEAR} <b>正在升级依赖...</b>\n\n${EMOJI.LOADING} 正在执行 bun install...`,
            parseMode: "html",
          });
          
          await sleep(800);

          const { stdout, stderr } = await execAsync("bun install");
          const output = stdout + (stderr ? "\n" + stderr : "");

          await (msg as any).edit({
            text: `${EMOJI.SUCCESS} <b>依赖升级完成</b>\n\n${EMOJI.CHECK} 请使用 .restart 重启生效\n\n<pre>${output.slice(0, 1000)}</pre>`,
            parseMode: "html",
          });
        } catch (err) {
          await (msg as any).edit({
            text: `${EMOJI.ERROR} <b>升级失败</b>\n\n${err instanceof Error ? err.message : "未知错误"}`,
            parseMode: "html",
          });
        }
      },
    },

    restart: {
      description: "重启机器人",
      aliases: ["reboot"],
      examples: ["restart"],

      handler: async (msg, args, ctx) => {
        await (msg as any).edit({
          text: `${EMOJI.RESTART} <b>正在重启...</b>\n\n${EMOJI.LOADING} 正在准备重启\n⏱️ 预计需要 5-10 秒`,
          parseMode: "html",
        });

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

    status: {
      description: "查看系统状态",
      aliases: ["stat"],
      examples: ["status"],

      handler: async (msg, args, ctx) => {
        try {
          await (msg as any).edit({
            text: `${EMOJI.INFO} <b>正在获取系统状态...</b>\n\n${EMOJI.LOADING} 正在收集信息...`,
            parseMode: "html",
          });
          
          await sleep(800);

          const gitInfo = await getGitInfo();
          const uptime = process.uptime();
          const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

          let text = `${EMOJI.INFO} <b>系统状态</b>\n\n`;
          text += `<b>运行信息</b>\n`;
          text += `├ ⏱️ 运行时间: ${uptimeStr}\n`;
          text += `├ 📦 Node.js: ${process.version}\n`;
          text += `└ 💾 内存: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n\n`;
          text += `<b>版本信息</b>\n`;
          text += `├ ${EMOJI.BRANCH} 分支: ${gitInfo.branch}\n`;
          text += `└ ${EMOJI.COMMIT} Commit: ${gitInfo.commit}`;

          await (msg as any).edit({
            text: text,
            parseMode: "html",
          });
        } catch (err) {
          await (msg as any).edit({
            text: `${EMOJI.ERROR} <b>获取失败</b>\n\n${err instanceof Error ? err.message : "未知错误"}`,
            parseMode: "html",
          });
        }
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

          await (msg as any).edit({
            text: `${EMOJI.LOGS} <b>正在获取日志...</b>\n\n${EMOJI.LOADING} 正在读取...`,
            parseMode: "html",
          });
          
          await sleep(500);

          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const logPath = path.join(__dirname, "..", "logs", "bot.log");

          let logContent: string;
          try {
            logContent = await readFile(logPath, "utf-8");
          } catch {
            await (msg as any).edit({
              text: `${EMOJI.ERROR} <b>日志文件不存在</b>`,
              parseMode: "html",
            });
            return;
          }

          const recentLines = logContent.split("\n").slice(-validLines).join("\n");

          await (msg as any).edit({
            text: `${EMOJI.LOGS} <b>最近 ${validLines} 行日志</b>\n\n<pre>${recentLines.slice(0, 3500)}</pre>`,
            parseMode: "html",
          });
        } catch (err) {
          await (msg as any).edit({
            text: `${EMOJI.ERROR} <b>读取失败</b>\n\n${err instanceof Error ? err.message : "未知错误"}`,
            parseMode: "html",
          });
        }
      },
    },

    sys: {
      description: "执行shell命令",
      aliases: ["exec", "shell"],
      examples: ["sys ls -la"],

      handler: async (msg, args, ctx) => {
        const cmdStr = args.join(" ");
        try {
          if (!cmdStr.trim()) {
            return (msg as any).edit({
              text: `${EMOJI.ERROR} <b>命令为空</b>\n\n用法: .sys <命令>`,
              parseMode: "html",
            });
          }

          // 检查危险命令
          const dangerous = ["rm -rf /", "rm -rf /*", "mkfs", "dd if=/dev/zero", "> /dev/sda", "shutdown", "reboot", "poweroff", "halt", "chmod -R 777 /"];
          if (dangerous.some(cmd => cmdStr.toLowerCase().includes(cmd))) {
            return (msg as any).edit({
              text: `${EMOJI.WARNING} <b>危险命令已阻止</b>`,
              parseMode: "html",
            });
          }

          await (msg as any).edit({
            text: `${EMOJI.SHELL} <b>正在执行命令...</b>\n\n${EMOJI.GEAR} <code>${cmdStr.slice(0, 100)}</code>\n${EMOJI.LOADING} 请稍候...`,
            parseMode: "html",
          });
          
          await sleep(500);

          const { stdout, stderr } = await execAsync(cmdStr, { timeout: 60000 });
          const output = stdout || stderr || "(无输出)";
          const truncated = output.length > 3500 ? output.slice(0, 3500) + "\n..." : output;

          await (msg as any).edit({
            text: `${EMOJI.SHELL} <b>命令执行结果</b>\n\n<code>${cmdStr.slice(0, 100)}</code>\n\n<pre>${truncated}</pre>`,
            parseMode: "html",
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "未知错误";
          await (msg as any).edit({
            text: `${EMOJI.ERROR} <b>执行失败</b>\n\n<code>${cmdStr.slice(0, 100)}</code>\n\n<pre>${errorMsg.slice(0, 1000)}</pre>`,
            parseMode: "html",
          });
        }
      },
    },
  },
};

export default systemPlugin;
