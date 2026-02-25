/**
 * 系统管理插件
 * 功能：更新代码、升级依赖、重启Bot、查看状态/日志
 */

import { Plugin } from "../src/types/index.js";
import { fmt } from "../src/utils/context.js";
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

// 应用Emoji
const EMOJI = {
  SYSTEM: "⚙️",
  UPDATE: "📥",
  UPGRADE: "⬆️",
  RESTART: "🔄",
  STATUS: "📊",
  LOGS: "📋",
  SUCCESS: "✅",
  ERROR: "❌",
  WARNING: "⚠️",
  INFO: "ℹ️",
  GIT: "🌿",
  PACKAGE: "📦",
  TIME: "⏱️",
  SERVER: "🖥️",
  LOADING: "🔄",
  CHECK: "✓",
  CROSS: "✗",
  ARROW: "→",
};

// 执行命令并返回输出
async function runCommand(command: string, cwd: string = process.cwd()): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd, timeout: 60000 });
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error: any) {
    return { 
      success: false, 
      stdout: error.stdout?.trim() || "", 
      stderr: error.stderr?.trim() || "",
      error: error.message 
    };
  }
}

// 截断文本
function truncate(text: string, maxLength: number = 4000): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "\n... (内容已截断)";
}

// 获取系统状态
async function getSystemStatus(): Promise<string> {
  const lines: string[] = [];
  
  // Git 状态
  const gitStatus = await runCommand("git status --short");
  const gitBranch = await runCommand("git branch --show-current");
  const gitCommit = await runCommand("git log -1 --format='%h %s'");
  
  lines.push(`${EMOJI.GIT} <b>Git 状态</b>`);
  lines.push(`分支: ${gitBranch.success ? gitBranch.stdout : "未知"}`);
  lines.push(`提交: ${gitCommit.success ? gitCommit.stdout : "未知"}`);
  if (gitStatus.stdout) {
    lines.push(`${EMOJI.WARNING} 有未提交的更改`);
  } else {
    lines.push(`${EMOJI.SUCCESS} 工作区干净`);
  }
  lines.push("");
  
  // 版本信息
  try {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
    lines.push(`${EMOJI.PACKAGE} <b>版本信息</b>`);
    lines.push(`NexBot: v${packageJson.version || "未知"}`);
    lines.push(`Node: ${process.version}`);
    lines.push(`平台: ${process.platform} ${process.arch}`);
    lines.push("");
  } catch {
    // 忽略错误
  }
  
  // 运行状态
  const uptime = formatUptime(process.uptime());
  const memoryUsage = process.memoryUsage();
  const memoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
  
  lines.push(`${EMOJI.SERVER} <b>运行状态</b>`);
  lines.push(`运行时间: ${uptime}`);
  lines.push(`内存使用: ${memoryMB} MB`);
  lines.push(`进程 PID: ${process.pid}`);
  
  return lines.join("\n");
}

// 格式化运行时间
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  if (secs > 0) parts.push(`${secs}秒`);
  
  return parts.join("") || "0秒";
}

const systemPlugin: Plugin = {
  name: "system",
  version: "1.0.0",
  description: "系统管理（更新/升级/重启/状态/日志）",
  author: "NexBot",

  commands: {
    // 更新代码
    update: {
      description: "从GitHub拉取最新代码",
      aliases: ["pull", "gitpull"],
      examples: ["update"],
      handler: async (msg, args, ctx) => {
        // 先检查Git状态
        const checkResult = await runCommand("git status");
        if (!checkResult.success) {
          await ctx.editHTML(`${EMOJI.ERROR} <b>Git检查失败</b>\n\n${checkResult.error || checkResult.stderr}`);
          return;
        }
        
        // 获取当前分支
        const branchResult = await runCommand("git branch --show-current");
        const branch = branchResult.success ? branchResult.stdout : "main";
        
        // 获取远程更新
        const fetchResult = await runCommand("git fetch origin");
        if (!fetchResult.success) {
          await ctx.editHTML(`${EMOJI.ERROR} <b>获取远程更新失败</b>\n\n${fetchResult.error || fetchResult.stderr}`);
          return;
        }
        
        // 检查是否有更新
        const logResult = await runCommand(`git log HEAD..origin/${branch} --oneline`);
        if (!logResult.stdout) {
          await ctx.editHTML(`${EMOJI.INFO} <b>当前已经是最新版本</b>\n\n无需更新`);
          return;
        }
        
        // 显示即将更新的内容并执行更新
        const commits = logResult.stdout.split("\n").slice(0, 10);
        let updateText = `${EMOJI.UPDATE} <b>发现新版本</b>\n\n`;
        updateText += `<b>更新内容 (${commits.length} 个提交):</b>\n`;
        commits.forEach((commit, i) => {
          updateText += `${i + 1}. ${commit}\n`;
        });
        if (logResult.stdout.split("\n").length > 10) {
          updateText += `... 还有 ${logResult.stdout.split("\n").length - 10} 个提交\n`;
        }
        
        // 执行更新
        const pullResult = await runCommand(`git pull origin ${branch}`);
        if (!pullResult.success) {
          await ctx.editHTML(`${EMOJI.ERROR} <b>更新失败</b>\n\n${pullResult.error || pullResult.stderr}`);
          return;
        }
        
        await ctx.editHTML(
          `${EMOJI.SUCCESS} <b>更新成功!</b>\n\n` +
          `${EMOJI.RESTART} 请使用 <code>.restart</code> 命令重启Bot以应用更新`
        );
      },
    },

    // 升级依赖
    upgrade: {
      description: "升级项目依赖",
      aliases: ["upgradedeps", "buninstall"],
      examples: ["upgrade"],
      handler: async (msg, args, ctx) => {
        const result = await runCommand("bun install");
        
        if (!result.success) {
          await ctx.editHTML(`${EMOJI.ERROR} <b>升级失败</b>\n\n${result.error || result.stderr}`);
          return;
        }
        
        const output = result.stdout || "依赖已是最新";
        await ctx.editHTML(
          `${EMOJI.SUCCESS} <b>依赖升级完成!</b>\n\n` +
          `<pre>${truncate(output, 2000)}</pre>\n\n` +
          `${EMOJI.RESTART} 如果有重大更新，建议重启Bot`
        );
      },
    },

    // 重启Bot
    restart: {
      description: "重启Bot",
      aliases: ["reboot", "reloadbot"],
      examples: ["restart"],
      handler: async (msg, args, ctx) => {
        await ctx.replyHTML(
          `${EMOJI.RESTART} <b>正在重启Bot...</b>\n\n` +
          `⏱️ 预计需要 5-10 秒`
        );
        
        // 延迟重启，确保消息发送完成
        setTimeout(() => {
          // 使用 exec 启动新进程后退出当前进程
          const { spawn } = require("child_process");
          
          // 创建一个脚本来重启
          const restartScript = `
            sleep 2
            cd ${process.cwd()}
            pkill -f "bun run src/index.ts" 2>/dev/null || true
            sleep 1
            nohup bun start > logs/bot.log 2>&1 &
          `;
          
          spawn("bash", ["-c", restartScript], {
            detached: true,
            stdio: "ignore",
          }).unref();
          
          // 退出当前进程
          process.exit(0);
        }, 1000);
      },
    },

    // 系统状态
    status: {
      description: "查看系统状态",
      aliases: ["sysstatus", "botstatus"],
      examples: ["status"],
      handler: async (msg, args, ctx) => {
        const status = await getSystemStatus();
        await ctx.editHTML(`${EMOJI.STATUS} <b>系统状态</b>\n\n${status}`);
      },
    },

    // 查看日志
    logs: {
      description: "查看Bot日志",
      aliases: ["log", "logfile"],
      examples: ["logs", "logs 50"],
      handler: async (msg, args, ctx) => {
        const lines = parseInt(args[0]) || 30;
        const maxLines = Math.min(Math.max(lines, 10), 100); // 限制 10-100 行
        
        const logPath = join(process.cwd(), "logs", "bot.log");
        
        if (!existsSync(logPath)) {
          await ctx.editHTML(`${EMOJI.ERROR} <b>日志文件不存在</b>`);
          return;
        }
        
        const result = await runCommand(`tail -n ${maxLines} "${logPath}"`);
        
        if (!result.success) {
          await ctx.editHTML(`${EMOJI.ERROR} <b>读取日志失败</b>\n\n${result.error}`);
          return;
        }
        
        const logContent = result.stdout || "(日志为空)";
        await ctx.editHTML(
          `${EMOJI.LOGS} <b>最近 ${maxLines} 行日志</b>\n\n` +
          `<pre>${truncate(logContent, 3500)}</pre>`
        );
      },
    },

    // 执行系统命令（谨慎使用）
    sys: {
      description: "执行系统命令（谨慎使用）",
      aliases: ["syscmd", "shell"],
      examples: ["sys ps aux", "sys df -h"],
      handler: async (msg, args, ctx) => {
        if (args.length === 0) {
          await ctx.editHTML(`${EMOJI.INFO} <b>用法</b>: <code>.sys &lt;命令&gt;</code>\n\n示例: <code>.sys ps aux</code>`);
          return;
        }
        
        const command = args.join(" ");
        
        // 危险命令检查
        const dangerousCommands = [
          "rm -rf /",
          "rm -rf /*",
          "> /dev/sda",
          "mkfs",
          "dd if=/dev/zero",
          ":(){ :|:& };:",
          "shutdown",
          "reboot",
          "halt",
          "poweroff",
        ];
        
        for (const dangerous of dangerousCommands) {
          if (command.includes(dangerous)) {
            await ctx.editHTML(`${EMOJI.ERROR} <b>检测到危险命令</b>\n\n已阻止执行: <code>${command}</code>`);
            return;
          }
        }
        
        const result = await runCommand(command);
        
        let output = result.stdout;
        if (result.stderr) {
          output += "\n\nstderr:\n" + result.stderr;
        }
        
        if (!output) {
          output = "(无输出)";
        }
        
        const status = result.success ? EMOJI.SUCCESS : EMOJI.ERROR;
        const statusText = result.success ? "成功" : "失败";
        await ctx.editHTML(
          `${status} <b>执行${statusText}</b>  ${fmt.code(command)}\n\n` +
          `<pre>${truncate(output, 3500)}</pre>`
        );
      },
    },
  },
};

export default systemPlugin;
