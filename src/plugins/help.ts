import { Plugin } from "../types/index.js";
import { pluginManager } from "../core/pluginManager.js";
import { fmt, escapeHTML } from "../utils/context.js";
import { VERSION } from "../utils/version.js";
import { cleanPluginDescription } from "../utils/helpers.js";

// Emoji 定义
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
  LIST: "📃",
};

// 生成点击复制命令
const copyCmd = (cmd: string, prefix: string = ".") => 
  `<a href="tg://copy?text=${encodeURIComponent(prefix + cmd)}">${fmt.code(prefix + cmd)}</a>`;

// 命令中文说明映射
const COMMAND_DESCRIPTIONS: Record<string, string> = {
  // 内置命令
  "help": "显示帮助信息，支持查看命令和插件详情",
  "ping": "测试 Bot 响应速度",
  "id": "查看当前聊天信息和用户ID",
  "echo": "回声测试，原样返回输入内容",
  "sysinfo": "查看系统运行状态和资源使用",
  "health": "查看 Bot 健康状态和指标",
  "db": "查看数据库统计信息",
  "update": "从 GitHub 拉取最新代码",
  "upgrade": "升级项目依赖",
  "restart": "重启 Bot",
  "status": "查看系统状态、Git版本和运行时间",
  "logs": "查看最近日志（默认30行）",
  "sys": "执行 Shell 命令（带安全检查）",
  "exec": "执行 Shell 命令",
  "eval": "执行 JavaScript 代码",
  "cache": "查看缓存统计",
  "ratelimit": "查看限流统计",
  "plugin": "插件管理（安装/卸载/重载）",
  
  // 扩展插件命令
  "lottery": "查看自动抽奖参与记录",
  "lottstat": "查看抽奖统计和中奖率",
  "lottcfg": "查看抽奖插件当前配置",
  "lottset": "设置抽奖插件参数",
  "lottreset": "重置抽奖配置为默认值",
  "ai": "AI 对话助手，支持聊天/搜索/生图",
  "pan": "网盘搜索，结果以 Telegraph 展示",
  "calc": "科学计算器，支持复杂表达式",
  "ip": "查询 IP 或域名的地理位置",
  "weather": "查询城市天气，生成海报图片",
  "hitokoto": "获取随机一言（动画/文学/哲学）",
  "speedtest": "测试服务器网络速度",
  "crazy4": "发送疯狂星期四 V50 文案",
  "pglist": "查看私聊保护白名单列表",
  "pgallow": "添加用户到私聊白名单",
  "pgremove": "从私聊白名单移除用户",
  "pgreset": "重置私聊保护数据",
  "pgtype": "切换私聊验证类型",
  "pgblocklist": "查看黑名单列表",
  "pgblock": "拉黑用户",
  "pgunblock": "解除拉黑用户",
};

// 获取命令中文说明
const getCommandDesc = (cmdName: string, originalDesc: string): string => {
  return COMMAND_DESCRIPTIONS[cmdName] || originalDesc;
};

const helpPlugin: Plugin = {
  name: "help",
  version: "1.2.0",
  description: "帮助系统和命令列表，支持 .help <命令> 或 .help <插件> 查看详情",
  author: "NexBot",

  commands: {
    help: {
      description: "显示帮助信息，支持 .help <命令> 或 .help <插件> 查看详情",
      aliases: ["h", "start", "帮助"],
      examples: ["help", "help ping", "help lottery", "help ip", "help system"],
      handler: async (msg, args, ctx) => {
        const prefix = process.env.CMD_PREFIX || ".";
        
        if (args.length > 0) {
          const query = args[0].toLowerCase();
          
          // 首先尝试查找命令
          const cmdInfo = pluginManager.getCommand(query);
          
          if (cmdInfo) {
            // 显示单个命令帮助
            await showCommandHelp(ctx, query, cmdInfo, prefix);
            return;
          }
          
          // 如果不是命令，尝试查找插件
          const plugin = pluginManager.getPlugin(query);
          
          if (plugin) {
            // 显示插件所有命令
            await showPluginHelp(ctx, query, plugin, prefix);
            return;
          }
          
          // 都没找到
          await ctx.replyHTML(
            `${EMOJI.UNKNOWN} <b>未找到</b>: <code>${query}</code>\n\n` +
            `该命令或插件不存在。\n\n` +
            `使用 ${copyCmd("help", prefix)} 查看所有命令\n` +
            `使用 ${copyCmd("plugin list", prefix)} 查看所有插件`
          );
          return;
        }
        
        // 显示主帮助
        await showMainHelp(ctx, prefix);
      },
    },
  },
};

// 显示单个命令帮助
async function showCommandHelp(ctx: any, cmdName: string, cmdInfo: any, prefix: string) {
  const def = cmdInfo.def;
  const plugin = pluginManager.getPlugin(cmdInfo.plugin);
  
  let detailText = "";
  
  // 描述（使用中文说明）
  const chineseDesc = getCommandDesc(cmdName, def.description);
  detailText += `${EMOJI.INFO} <b>功能说明:</b> ${escapeHTML(chineseDesc)}\n`;
  detailText += `${EMOJI.PLUGIN} <b>所属插件:</b> ${cmdInfo.plugin}\n`;
  
  // 别名
  if (def.aliases && def.aliases.length > 0) {
    detailText += `\n${EMOJI.ALIAS} <b>快捷别名:</b>\n`;
    detailText += def.aliases.map((a: string) => `  ${EMOJI.DOT} ${copyCmd(a, prefix)}`).join("\n");
    detailText += "\n";
  }
  
  // 使用示例
  if (def.examples && def.examples.length > 0) {
    detailText += `\n${EMOJI.EXAMPLE} <b>使用示例:</b>\n`;
    for (const ex of def.examples) {
      detailText += `  ${EMOJI.ARROW} ${copyCmd(ex, prefix)}\n`;
    }
  }
  
  // 插件描述
  if (plugin?.description) {
    detailText += `\n${EMOJI.INFO} <b>插件介绍:</b>\n`;
    detailText += escapeHTML(plugin.description) + "\n";
  }
  
  // 构建最终消息
  let text = fmt.bold(`${EMOJI.BOOK} 命令帮助: ${cmdName}`) + "\n\n";
  text += `<blockquote expandable>${detailText.trim()}</blockquote>`;
  text += `\n\n${EMOJI.COPY} <i>点击命令可复制到输入框</i>`;

  await ctx.replyHTML(text);
}

// 显示插件所有命令
async function showPluginHelp(ctx: any, pluginName: string, plugin: any, prefix: string) {
  let detailText = "";
  
  // 插件信息
  detailText += `${EMOJI.INFO} <b>插件名称:</b> ${pluginName}\n`;
  detailText += `${EMOJI.VERSION} <b>版本:</b> ${plugin.version || "1.0.0"}\n`;
  detailText += `${EMOJI.INFO} <b>介绍:</b> ${escapeHTML(plugin.description || "暂无描述")}\n`;
  detailText += `${EMOJI.SHIELD} <b>作者:</b> ${plugin.author || "Unknown"}\n\n`;
  
  // 获取插件的所有命令
  const commands: string[] = [];
  const cmdHandlers: string[] = [];
  
  if (plugin.commands) {
    commands.push(...Object.keys(plugin.commands));
  }
  if (plugin.cmdHandlers) {
    cmdHandlers.push(...Object.keys(plugin.cmdHandlers));
  }
  
  const allCmds = [...commands, ...cmdHandlers];
  
  if (allCmds.length === 0) {
    detailText += `${EMOJI.UNKNOWN} 该插件没有可手动调用的命令\n`;
    detailText += `（可能是自动运行插件）`;
  } else {
    detailText += fmt.bold(`${EMOJI.LIST} 可用命令列表:`) + "\n\n";
    
    for (const cmd of allCmds) {
      // 获取命令定义
      const cmdDef = plugin.commands?.[cmd] || null;
      const chineseDesc = getCommandDesc(cmd, cmdDef?.description || "执行该命令");
      
      detailText += `${copyCmd(cmd, prefix)}\n`;
      detailText += `  ${EMOJI.ARROW} ${escapeHTML(chineseDesc)}\n`;
      
      // 显示别名
      if (cmdDef?.aliases && cmdDef.aliases.length > 0) {
        detailText += `  ${EMOJI.ALIAS} 别名: ${cmdDef.aliases.join(", ")}\n`;
      }
      
      detailText += "\n";
    }
  }
  
  // 构建最终消息
  let text = fmt.bold(`${EMOJI.PLUGIN} 插件详情: ${pluginName}`) + "\n\n";
  text += `<blockquote expandable>${detailText.trim()}</blockquote>`;
  text += `\n\n${EMOJI.COPY} <i>点击命令可复制，使用 ${copyCmd(`help <命令名>`, prefix)} 查看单个命令详情</i>`;

  await ctx.replyHTML(text);
}

// 显示主帮助
async function showMainHelp(ctx: any, prefix: string) {
  const botName = process.env.BOT_NAME || "NexBot";
  
  let text = fmt.bold(`${EMOJI.BOT} ${botName}`) + ` ${EMOJI.VERSION} ${fmt.italic("v" + VERSION)}\n\n`;
  
  // 简约介绍
  text += `${EMOJI.SPEED} 极速 · ${EMOJI.PLUGIN} 插件化 · ${EMOJI.SHIELD} 安全\n`;
  text += `前缀 ${fmt.code(prefix)} · 查看详情 ${copyCmd("help <命令/插件>", prefix)}\n\n`;
  
  // 获取已安装插件
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
  commandsText += `${copyCmd("update", prefix)} ${EMOJI.ARROW} 更新代码\n`;
  commandsText += `${copyCmd("restart", prefix)} ${EMOJI.ARROW} 重启 Bot\n`;
  commandsText += `${copyCmd("status", prefix)} ${EMOJI.ARROW} 查看状态\n\n`;
  
  // 扩展插件
  commandsText += fmt.bold(`${EMOJI.EXTEND} 扩展插件`) + "\n";
  if (installedPlugins.length > 0) {
    for (const plugin of installedPlugins.slice(0, 10)) {
      const cmds: string[] = [];
      if (plugin.commands) cmds.push(...Object.keys(plugin.commands));
      if (plugin.cmdHandlers) cmds.push(...Object.keys(plugin.cmdHandlers));
      const mainCmd = cmds[0] || plugin.name;
      const shortDesc = escapeHTML(cleanPluginDescription(plugin.description, 2));
      commandsText += `${copyCmd(mainCmd, prefix)} ${EMOJI.ARROW} ${shortDesc}\n`;
    }
    if (installedPlugins.length > 10) {
      commandsText += `... 还有 ${installedPlugins.length - 10} 个\n`;
    }
  }
  commandsText += `${copyCmd("plugin list", prefix)} ${EMOJI.ARROW} 管理插件`;
  
  text += `<blockquote expandable>${commandsText}</blockquote>`;
  text += `\n\n${EMOJI.COPY} <i>点击命令可复制，使用 ${copyCmd("help <命令名>", prefix)} 或 ${copyCmd("help <插件名>", prefix)} 查看详情</i>`;
  
  await ctx.replyHTML(text);
}

export default helpPlugin;
