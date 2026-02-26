import { Plugin } from "../types/index.js";
import { pluginManager } from "../core/pluginManager.js";
import { fmt, escapeHTML } from "../utils/context.js";
import { VERSION } from "../utils/version.js";
import { cleanPluginDescription } from "../utils/helpers.js";

// 应用Emoji表情
const EMOJI = {
  BOT: "🤖",
  VERSION: "🏷️",
  SPEED: "⚡",
  PLUGIN: "🔌",
  SHIELD: "🛡️",
  UNKNOWN: "❓",
  BOOK: "📖",
  INFO: "ℹ️",
  COMMAND: "⌨️",
  ALIAS: "🏷️",
  EXAMPLE: "📋",
  BASIC: "🎯",
  SYSTEM: "⚙️",
  EXTEND: "🧩",
  MANAGE: "🎛️",
  ARROW: "→",
  DOT: "•",
  COPY: "📋",
};

// 生成点击复制命令
const copyCmd = (cmd: string, prefix: string = ".") => 
  `<a href="tg://copy?text=${encodeURIComponent(prefix + cmd)}">${fmt.code(prefix + cmd)}</a>`;

// 生成点击复制文本（不带前缀）
const copyText = (text: string) => 
  `<a href="tg://copy?text=${encodeURIComponent(text)}">${fmt.code(text)}</a>`;

const helpPlugin: Plugin = {
  name: "help",
  version: "1.1.0",
  description: "帮助系统和命令列表，支持点击查看详细用法",
  author: "NexBot",

  commands: {
    help: {
      description: "显示帮助信息，支持 .help <命令> 查看详情",
      aliases: ["h", "start", "帮助"],
      examples: ["help", "help ping", "help lottery", "help ip"],
      handler: async (msg, args, ctx) => {
        const prefix = process.env.CMD_PREFIX || ".";
        
        if (args.length > 0) {
          // 显示特定命令帮助
          const cmdName = args[0].toLowerCase();
          const cmdInfo = pluginManager.getCommand(cmdName);
          
          if (!cmdInfo) {
            await ctx.replyHTML(`${EMOJI.UNKNOWN} <b>未知命令</b>: <code>${cmdName}</code>\n\n使用 ${copyCmd("help", prefix)} 查看所有命令`);
            return;
          }

          const def = cmdInfo.def;
          const plugin = pluginManager.getPlugin(cmdInfo.plugin);
          const isFromCmdHandlers = pluginManager.isCmdHandlerCommand(cmdName);
          
          // 构建详细信息
          let detailText = "";
          
          // 描述
          detailText += `${EMOJI.INFO} <b>描述:</b> ${escapeHTML(def.description)}\n`;
          detailText += `${EMOJI.PLUGIN} <b>来源插件:</b> ${cmdInfo.plugin}\n`;
          
          // 别名
          if (def.aliases && def.aliases.length > 0) {
            detailText += `\n${EMOJI.ALIAS} <b>别名:</b> `;
            detailText += def.aliases.map((a: string) => copyCmd(a, prefix)).join(" ");
            detailText += "\n";
          }
          
          // 使用示例（带点击复制）
          if (def.examples && def.examples.length > 0) {
            detailText += `\n${EMOJI.EXAMPLE} <b>使用示例:</b>\n`;
            for (const ex of def.examples) {
              detailText += `  ${EMOJI.ARROW} ${copyCmd(ex, prefix)}\n`;
            }
          }
          
          // 如果命令来自 cmdHandlers，显示该插件的所有命令
          if (isFromCmdHandlers && plugin) {
            detailText += `\n${EMOJI.COMMAND} <b>该插件所有命令:</b>\n`;
            const pluginCmds = pluginManager.getPluginCommands(cmdInfo.plugin);
            
            if (pluginCmds.cmdHandlers.length > 0) {
              detailText += `  ${EMOJI.DOT} `;
              detailText += pluginCmds.cmdHandlers.map((c: string) => copyCmd(c, prefix)).join(" ");
              detailText += "\n";
            }
            if (pluginCmds.commands.length > 0) {
              detailText += `  ${EMOJI.DOT} `;
              detailText += pluginCmds.commands.map((c: string) => copyCmd(c, prefix)).join(" ");
              detailText += "\n";
            }
          }
          
          // 插件描述
          if (plugin?.description) {
            detailText += `\n${EMOJI.INFO} <b>插件说明:</b>\n`;
            detailText += escapeHTML(plugin.description) + "\n";
          }
          
          // 构建最终消息
          let text = fmt.bold(`${EMOJI.BOOK} 命令帮助: ${cmdName}`) + "\n\n";
          text += `<blockquote expandable>${detailText.trim()}</blockquote>`;
          
          // 添加提示
          text += `\n${EMOJI.COPY} 点击命令即可复制`;

          await ctx.replyHTML(text);
        } else {
          // 显示主帮助
          const botName = process.env.BOT_NAME || "NexBot";
          
          let text = fmt.bold(`${EMOJI.BOT} ${botName}`) + ` ${EMOJI.VERSION} ${fmt.italic("v" + VERSION)}\n\n`;
          
          // 简约介绍
          text += `${EMOJI.SPEED} 极速 · ${EMOJI.PLUGIN} 插件化 · ${EMOJI.SHIELD} 安全\n`;
          text += `前缀 ${fmt.code(prefix)} · 点击查看详情 ${copyCmd("help <命令>", prefix)}\n\n`;
          
          // 获取已安装插件（排除内置插件）
          const builtinNames = new Set(['help', 'plugin', 'debug', 'exec', 'sysinfo']);
          const installedPlugins = pluginManager.getAllPlugins().filter(p => !builtinNames.has(p.name));
          
          // 分类命令列表
          let commandsText = "";
          
          // 基础命令
          commandsText += fmt.bold(`${EMOJI.BASIC} 基础命令`) + "\n";
          commandsText += `${copyCmd("ping", prefix)} ${EMOJI.ARROW} 测试延迟\n`;
          commandsText += `${copyCmd("id", prefix)} ${EMOJI.ARROW} 查看聊天信息\n`;
          commandsText += `${copyCmd("echo", prefix)} ${EMOJI.ARROW} 回声测试\n\n`;
          
          // 系统命令
          commandsText += fmt.bold(`${EMOJI.SYSTEM} 系统命令`) + "\n";
          commandsText += `${copyCmd("sysinfo", prefix)} ${EMOJI.ARROW} 系统状态\n`;
          commandsText += `${copyCmd("health", prefix)} ${EMOJI.ARROW} 健康检查\n`;
          commandsText += `${copyCmd("db", prefix)} ${EMOJI.ARROW} 数据库信息\n`;
          commandsText += `${copyCmd("update", prefix)} ${EMOJI.ARROW} 更新代码\n`;
          commandsText += `${copyCmd("status", prefix)} ${EMOJI.ARROW} 查看状态\n\n`;
          
          // 扩展插件命令
          commandsText += fmt.bold(`${EMOJI.EXTEND} 扩展插件`) + "\n";
          if (installedPlugins.length > 0) {
            for (const plugin of installedPlugins.slice(0, 8)) {
              const cmds: string[] = [];
              if (plugin.commands) cmds.push(...Object.keys(plugin.commands));
              if (plugin.cmdHandlers) cmds.push(...Object.keys(plugin.cmdHandlers));
              const mainCmd = cmds[0] || plugin.name;
              const shortDesc = escapeHTML(cleanPluginDescription(plugin.description, 3));
              commandsText += `${copyCmd(mainCmd, prefix)} ${EMOJI.ARROW} ${shortDesc}\n`;
            }
            if (installedPlugins.length > 8) {
              commandsText += `... 还有 ${installedPlugins.length - 8} 个插件\n`;
            }
          }
          commandsText += `${copyCmd("plugin list", prefix)} ${EMOJI.ARROW} 管理插件`;
          
          text += `<blockquote expandable>${commandsText}</blockquote>`;
          
          // 添加提示
          text += `\n\n${EMOJI.COPY} <i>点击命令可复制，使用 ${copyCmd("help <命令名>", prefix)} 查看详细用法</i>`;
          
          await ctx.replyHTML(text);
        }
      },
    },
  },
};

export default helpPlugin;
