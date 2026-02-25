import { Plugin } from "../types/index.js";
import { pluginManager } from "../core/pluginManager.js";
import { fmt } from "../utils/context.js";

const helpPlugin: Plugin = {
  name: "help",
  version: "1.0.0",
  description: "帮助系统和命令列表",
  author: "NexBot",

  commands: {
    help: {
      description: "显示帮助信息",
      aliases: ["h", "start"],
      examples: ["help", "help ping", "help plugin"],
      handler: async (msg, args, ctx) => {
        const prefix = process.env.CMD_PREFIX || ".";
        
        if (args.length > 0) {
          // 显示特定命令帮助
          const cmdName = args[0].toLowerCase();
          const cmdInfo = pluginManager.getCommand(cmdName);
          
          if (!cmdInfo) {
            await ctx.reply("❓ 未知命令: " + cmdName);
            return;
          }

          const def = cmdInfo.def;
          const plugin = pluginManager.getPlugin(cmdInfo.plugin);
          const isFromCmdHandlers = pluginManager.isCmdHandlerCommand(cmdName);
          
          // 构建详细信息（放入折叠块）
          let detailText = "";
          
          detailText += "描述: " + def.description + "\n";
          detailText += "来源插件: " + cmdInfo.plugin + "\n";
          
          // 如果命令来自 cmdHandlers，显示更详细的信息
          if (isFromCmdHandlers && plugin) {
            detailText += "\n📋 该插件支持以下命令:\n";
            const pluginCmds = pluginManager.getPluginCommands(cmdInfo.plugin);
            
            if (pluginCmds.cmdHandlers.length > 0) {
              detailText += "管理命令: " + pluginCmds.cmdHandlers.join(", ") + "\n";
            }
            if (pluginCmds.commands.length > 0) {
              detailText += "普通命令: " + pluginCmds.commands.join(", ") + "\n";
            }
            
            // 显示插件描述
            if (plugin.description) {
              detailText += "\n插件说明:\n";
              detailText += plugin.description + "\n";
            }
          }
          
          if (def.aliases && def.aliases.length > 0) {
            detailText += "\n别名: " + def.aliases.join(", ") + "\n";
          }
          
          if (def.examples && def.examples.length > 0) {
            detailText += "\n示例:\n";
            for (const ex of def.examples) {
              detailText += "  " + prefix + ex + "\n";
            }
          }
          
          // 构建最终消息
          let text = fmt.bold("📖 命令帮助: " + cmdName) + "\n\n";
          text += `<blockquote expandable>${detailText.trim()}</blockquote>`;

          await ctx.replyHTML(text);
        } else {
          // 显示主帮助 - 简约风格
          const botName = process.env.BOT_NAME || "NexBot";
          const botVersion = process.env.BOT_VERSION || "1.0.1";
          const copyCmd = (cmd: string, desc: string) => `<a href="tg://copy?text=${encodeURIComponent(prefix + cmd)}">${fmt.code(prefix + cmd)}</a> — ${desc}`;
          
          let text = fmt.bold(`🤖 ${botName}`) + ` ${fmt.italic("v" + botVersion)}\n\n`;
          
          // 简约介绍
          text += "⚡ 极速 · 🔌 插件化 · 🛡️ 安全\n";
          text += `前缀 ${fmt.code(prefix)} · 帮助 ${copyCmd("help <命令>", "详情")}\n\n`;
          
          // 分类命令列表
          let commandsText = "";
          commandsText += fmt.bold("基础") + "\n";
          commandsText += `${copyCmd("ping", "延迟")} ${copyCmd("id", "信息")} ${copyCmd("echo", "回声")}\n\n`;
          commandsText += fmt.bold("系统") + "\n";
          commandsText += `${copyCmd("sysinfo", "状态")} ${copyCmd("health", "健康")} ${copyCmd("db", "数据")}\n\n`;
          commandsText += fmt.bold("扩展") + "\n";
          commandsText += `${copyCmd("ai", "AI对话")} ${copyCmd("pan", "网盘")} ${copyCmd("plugin list", "插件")}`;
          
          text += `<blockquote expandable>${commandsText}</blockquote>`;
          
          await ctx.replyHTML(text);
        }
      },
    },
  },
};

export default helpPlugin;
