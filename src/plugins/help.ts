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
          
          let text = fmt.bold("📖 命令帮助: " + cmdName) + "\n\n";
          text += fmt.bold("描述:") + " " + def.description + "\n";
          text += fmt.bold("来源插件:") + " " + cmdInfo.plugin + "\n";
          
          // 如果命令来自 cmdHandlers，显示更详细的信息
          if (isFromCmdHandlers && plugin) {
            text += "\n" + fmt.bold("📋 该插件支持以下命令:") + "\n";
            const pluginCmds = pluginManager.getPluginCommands(cmdInfo.plugin);
            
            if (pluginCmds.cmdHandlers.length > 0) {
              text += "管理命令: " + pluginCmds.cmdHandlers.map(c => fmt.code(c)).join(", ") + "\n";
            }
            if (pluginCmds.commands.length > 0) {
              text += "普通命令: " + pluginCmds.commands.map(c => fmt.code(c)).join(", ") + "\n";
            }
            
            // 显示插件描述的前400字符
            if (plugin.description) {
              text += "\n" + fmt.bold("插件说明:") + "\n";
              const desc = plugin.description.length > 400 
                ? plugin.description.substring(0, 400) + "..." 
                : plugin.description;
              text += desc + "\n";
            }
          }
          
          if (def.aliases && def.aliases.length > 0) {
            text += fmt.bold("别名:") + " " + def.aliases.join(", ") + "\n";
          }
          
          if (def.sudo) {
            text += "⚠️ " + fmt.bold("需要 sudo 权限") + "\n";
          }
          
          if (def.examples) {
            text += "\n" + fmt.bold("示例:") + "\n";
            for (const ex of def.examples) {
              text += "  " + prefix + ex + "\n";
            }
          }

          await ctx.replyHTML(text);
        } else {
          // 显示主帮助
          let text = fmt.bold("🤖 NexBot 帮助") + "\n\n";
          text += fmt.bold('前缀: "' + prefix + '"') + "\n";
          text += "使用 " + fmt.code(prefix + "help <命令>") + " 查看详细信息\n";
          text += "使用 " + fmt.code(prefix + "plugin list") + " 查看所有插件\n\n";

          // 核心命令列表（简化版）
          text += fmt.bold("📌 常用命令") + "\n";
          text += "  " + fmt.code("help") + " - 显示帮助\n";
          text += "  " + fmt.code("ping") + " - 测试延迟\n";
          text += "  " + fmt.code("id") + " - 获取用户信息\n";
          text += "  " + fmt.code("sysinfo") + " - 系统信息\n";
          text += "  " + fmt.code("speedtest") + " - 网速测试\n";
          text += "  " + fmt.code("plugin list") + " - 查看插件命令\n\n";

          // sudo 命令（如果用户是 sudo）
          if (ctx.isSudo) {
            text += fmt.bold("👑 管理命令") + "\n";
            text += "  " + fmt.code("sudo") + " - 权限管理\n";
            text += "  " + fmt.code("plugin") + " - 插件管理\n";
            text += "  " + fmt.code("exec") + " - 执行命令\n\n";
          }

          text += fmt.italic("更多命令请使用 ") + fmt.code(prefix + "plugin list");
          await ctx.replyHTML(text);
        }
      },
    },
  },
};

export default helpPlugin;
