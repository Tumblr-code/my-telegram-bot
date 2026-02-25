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
          // 显示主帮助 - 包含项目简介
          const botName = process.env.BOT_NAME || "NexBot";
          const botVersion = process.env.BOT_VERSION || "1.0.0";
          
          let text = fmt.bold("🤖 " + botName + " v" + botVersion) + "\n\n";
          
          // 项目简介
          text += "<i>一款功能强大的 Telegram Bot 框架，支持插件扩展、系统监控、网盘搜索等功能。</i>\n\n";
          
          // 命令前缀说明
          text += "前缀: " + fmt.code(prefix) + "\n";
          text += "使用 " + fmt.code(prefix + "help <命令>") + " 查看详细帮助\n\n";
          
          // 常用命令列表（放入折叠块，可点击复制）
          const copyCmd = (cmd: string, desc: string) => `<a href="tg://copy?text=${encodeURIComponent(prefix + cmd)}">${fmt.code(prefix + cmd)}</a> - ${desc}`;
          
          let commandsText = "";
          commandsText += copyCmd("help", "显示帮助") + "\n";
          commandsText += copyCmd("ping", "测试延迟") + "\n";
          commandsText += copyCmd("id", "获取聊天信息") + "\n";
          commandsText += copyCmd("echo", "回声测试") + "\n\n";
          
          commandsText += "📊 系统信息:\n";
          commandsText += copyCmd("sysinfo", "系统状态") + "\n";
          commandsText += copyCmd("uptime", "运行时间") + "\n";
          commandsText += copyCmd("health", "健康检查") + "\n";
          commandsText += copyCmd("db", "数据库统计") + "\n";
          commandsText += copyCmd("cache", "缓存统计") + "\n";
          commandsText += copyCmd("ratelimit", "限流统计") + "\n\n";
          
          commandsText += "🔍 其他功能:\n";
          commandsText += copyCmd("speedtest", "网速测试") + "\n";
          commandsText += copyCmd("pan", "网盘搜索") + "\n";
          commandsText += copyCmd("plugin list", "插件列表");
          
          text += fmt.bold("📌 常用命令") + "\n";
          text += `<blockquote expandable>${commandsText}</blockquote>`;
          
          await ctx.replyHTML(text);
        }
      },
    },
  },
};

export default helpPlugin;
