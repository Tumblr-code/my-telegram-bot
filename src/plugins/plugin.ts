import { Plugin } from "../types/index.js";
import { pluginManager } from "../core/pluginManager.js";
import { db } from "../utils/database.js";
import { fmt } from "../utils/context.js";
import { logger } from "../utils/logger.js";
import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

// 插件信息接口
interface PluginInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  commands: string[];
  installed: boolean;
}

const pluginPlugin: Plugin = {
  name: "plugin",
  version: "1.0.0",
  description: "插件管理器",
  author: "NexBot",

  commands: {
    plugin: {
      description: "插件管理",
      sudo: true,
      aliases: ["pm", "plugins"],
      examples: ["plugin list", "plugin install <name>", "plugin remove <name>"],
      handler: async (msg, args, ctx) => {
        const subCmd = args[0]?.toLowerCase();
        
        switch (subCmd) {
          case "list":
          case "ls": {
            const prefix = process.env.CMD_PREFIX || ".";
            const copyCmd = (cmd: string) => `<a href="tg://copy?text=${encodeURIComponent(prefix + cmd)}">${fmt.code(cmd)}</a>`;
            
            // 扫描本地插件目录
            const pluginsDir = join(process.cwd(), "plugins");
            const availablePlugins: PluginInfo[] = [];
            
            if (existsSync(pluginsDir)) {
              const files = readdirSync(pluginsDir).filter(f => f.endsWith(".ts") || f.endsWith(".js"));
              
              for (const file of files) {
                const name = file.replace(/\.(ts|js)$/, "");
                const pluginPath = join(pluginsDir, file);
                
                try {
                  // 读取文件内容提取信息
                  const content = readFileSync(pluginPath, "utf-8");
                  const info = extractPluginInfo(content, name);
                  info.installed = db.isPluginEnabled(name);
                  availablePlugins.push(info);
                } catch (err) {
                  logger.warn(`解析插件 ${name} 信息失败`);
                }
              }
            }
            
            // 获取已安装的内置插件
            const installedPlugins = pluginManager.getAllPlugins();
            const installedExternal = availablePlugins.filter(p => p.installed);
            const notInstalled = availablePlugins.filter(p => !p.installed);
            
            // 构建消息
            let text = fmt.bold("🔌 NexBot 插件中心") + "\n";
            text += fmt.italic(`${availablePlugins.length} 可用 · ${installedExternal.length} 已装`) + "\n\n";
            
            // 1. 可安装插件（带详细介绍）
            if (notInstalled.length > 0) {
              text += fmt.bold("📥 可安装") + "\n";
              
              let availableText = "";
              for (const plugin of notInstalled.slice(0, 8)) { // 最多显示8个
                const installCmd = prefix + "plugin install " + plugin.name;
                const installBtn = `<a href="tg://copy?text=${encodeURIComponent(installCmd)}">📥 安装</a>`;
                
                availableText += `${fmt.bold(plugin.name)} ${installBtn}\n`;
                
                // 描述（取第一行）
                const shortDesc = plugin.description.split("\n")[0].slice(0, 40);
                availableText += `  ${shortDesc}${plugin.description.length > 40 ? "..." : ""}\n`;
                
                // 命令列表
                if (plugin.commands.length > 0) {
                  const cmdStr = plugin.commands.slice(0, 4).map(c => fmt.code(c)).join(" ");
                  availableText += `  ${cmdStr}${plugin.commands.length > 4 ? " ..." : ""}\n`;
                }
                
                availableText += `  👤 ${plugin.author} · v${plugin.version}\n\n`;
              }
              
              if (notInstalled.length > 8) {
                availableText += `... 还有 ${notInstalled.length - 8} 个\n`;
              }
              
              text += `<blockquote expandable>${availableText.trim()}</blockquote>\n\n`;
            }
            
            // 2. 已安装插件 - 分开显示内置和外部
            const builtinNames = new Set(['help', 'plugin', 'debug', 'sudo', 'exec', 'sysinfo']);
            const builtinInstalled = installedPlugins.filter(p => builtinNames.has(p.name));
            const externalInstalled = installedPlugins.filter(p => !builtinNames.has(p.name));
            
            if (externalInstalled.length > 0 || builtinInstalled.length > 0) {
              text += fmt.bold("✅ 已安装") + "\n";
              
              let installedText = "";
              
              // 外部插件（带详细命令）
              for (const plugin of externalInstalled) {
                const cmds = getPluginCmds(plugin);
                const cmdList = cmds.length > 0 
                  ? cmds.slice(0, 4).map(c => fmt.code(c)).join(" ") + (cmds.length > 4 ? " ..." : "")
                  : fmt.italic("无命令");
                installedText += `• ${fmt.bold(plugin.name)} — ${cmdList}\n`;
              }
              
              // 内置插件（简单显示）
              if (builtinInstalled.length > 0) {
                const builtinCmds = builtinInstalled.flatMap(p => getPluginCmds(p));
                const builtinList = builtinCmds.slice(0, 6).map(c => fmt.code(c)).join(" ") + (builtinCmds.length > 6 ? " ..." : "");
                installedText += `• ${fmt.bold("内置")} — ${builtinList}\n`;
              }
              
              text += `<blockquote expandable>${installedText.trim()}</blockquote>\n\n`;
            }
            
            text += `💡 ${copyCmd("plugin install <名称>")}`;
            
            await ctx.replyHTML(text);
            break;
          }

          case "reload":
          case "r": {
            const name = args[1];
            if (!name) {
              await ctx.reply("❓ 请指定插件名称");
              return;
            }
            
            const success = await pluginManager.reloadPlugin(name);
            if (success) {
              await ctx.reply("✅ 插件 " + name + " 已重载");
            } else {
              await ctx.reply("❌ 插件 " + name + " 重载失败");
            }
            break;
          }

          case "reloadall":
          case "ra": {
            await pluginManager.reloadAll();
            await ctx.reply("✅ 所有插件已重载");
            break;
          }

          case "install":
          case "i": {
            const name = args[1];
            if (!name) {
              await ctx.reply("❓ 请指定插件名称\n用法: plugin install <名称>");
              return;
            }
            
            // 检查插件文件是否存在
            const pluginsDir = join(process.cwd(), "plugins");
            const pluginFile = join(pluginsDir, `${name}.ts`);
            
            logger.info(`尝试安装插件: ${name}, 文件路径: ${pluginFile}`);
            
            if (!existsSync(pluginFile)) {
              logger.warn(`插件文件不存在: ${pluginFile}`);
              await ctx.reply("❌ 插件 \"" + name + "\" 不存在\n使用 " + fmt.code(".plugin list") + " 查看可用插件");
              return;
            }
            
            // 检查是否已启用
            if (db.isPluginEnabled(name)) {
              await ctx.reply("⚠️ 插件 \"" + name + "\" 已安装");
              return;
            }
            
            // 尝试加载插件（先加载再启用，避免加载失败也标记为启用）
            try {
              const importPath = `../../plugins/${name}.ts`;
              logger.info(`导入插件: ${importPath}`);
              const module = await import(importPath);
              
              if (!module.default) {
                await ctx.reply("❌ 插件 \"" + name + "\" 格式错误: 没有默认导出");
                return;
              }
              
              // 检查插件是否有 name 属性
              if (!module.default.name) {
                logger.warn(`插件 ${name} 没有 name 属性`);
              }
              
              // 启用插件（保存到数据库）
              db.enablePlugin(name);
              
              // 注册插件
              await pluginManager.registerPlugin(module.default, pluginFile, true);
              await ctx.reply("✅ 插件 \"" + name + "\" 安装成功");
            } catch (err: any) {
              logger.error(`安装插件失败 ${name}:`, err);
              const errorMsg = err?.message || String(err);
              await ctx.reply("❌ 插件 \"" + name + "\" 加载失败:\n" + errorMsg);
            }
            break;
          }

          case "remove":
          case "uninstall":
          case "rm": {
            const name = args[1];
            if (!name) {
              await ctx.reply("❓ 请指定插件名称\n用法: plugin remove <名称>");
              return;
            }
            
            // 检查插件是否已启用
            if (!db.isPluginEnabled(name)) {
              await ctx.reply("⚠️ 插件 \"" + name + "\" 未安装");
              return;
            }
            
            // 卸载插件
            await pluginManager.unregisterPlugin(name);
            db.disablePlugin(name);
            await ctx.reply("✅ 插件 \"" + name + "\" 已卸载");
            break;
          }

          case "alias": {
            const action = args[1]?.toLowerCase();
            
            if (action === "add") {
              const alias = args[2];
              const command = args[3];
              if (!alias || !command) {
                await ctx.reply("❓ 用法: plugin alias add <别名> <命令>");
                return;
              }
              pluginManager.setAlias(alias, command);
              await ctx.reply("✅ 别名已设置: " + alias + " -> " + command);
            } else if (action === "remove" || action === "rm") {
              const alias = args[2];
              if (!alias) {
                await ctx.reply("❓ 请指定别名");
                return;
              }
              pluginManager.removeAlias(alias);
              await ctx.reply("✅ 别名已删除: " + alias);
            } else {
              const aliases = pluginManager.getAliases();
              
              if (Object.keys(aliases).length === 0) {
                await ctx.reply(fmt.bold("🏷️ 命令别名") + "\n\n暂无别名");
                return;
              }
              
              let aliasListText = "";
              for (const [alias, cmd] of Object.entries(aliases)) {
                aliasListText += `${alias} -> ${cmd}\n`;
              }
              
              let text = fmt.bold("🏷️ 命令别名") + "\n\n";
              text += `<blockquote expandable>${aliasListText.trim()}</blockquote>`;
              await ctx.replyHTML(text);
            }
            break;
          }

          default: {
            const prefix = process.env.CMD_PREFIX || ".";
            const copyCmd = (cmd: string, desc: string) => `<a href="tg://copy?text=${encodeURIComponent(prefix + cmd)}">${fmt.code(prefix + cmd)}</a> - ${desc}`;
            
            let text = fmt.bold("🔌 插件管理") + "\n\n";
            text += copyCmd("plugin list", "列出所有插件") + "\n";
            text += copyCmd("plugin install <名称>", "安装插件") + "\n";
            text += copyCmd("plugin remove <名称>", "卸载插件") + "\n";
            text += copyCmd("plugin reload <name>", "重载指定插件") + "\n";
            text += copyCmd("plugin reloadall", "重载所有插件") + "\n";
            text += copyCmd("plugin alias", "查看别名列表");
            await ctx.replyHTML(text);
          }
        }
      },
    },
  },
};

// 从插件文件内容提取信息
function extractPluginInfo(content: string, defaultName: string): PluginInfo {
  const info: PluginInfo = {
    name: defaultName,
    version: "1.0.0",
    description: "暂无描述",
    author: "Unknown",
    commands: [],
    installed: false,
  };
  
  // 提取 name
  const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
  if (nameMatch) info.name = nameMatch[1];
  
  // 提取 version
  const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
  if (versionMatch) info.version = versionMatch[1];
  
  // 提取 description（支持模板字符串和普通字符串）
  const descMatch = content.match(/description\s*=\s*(?:[`"'])([^`"']+)(?:[`"'])/);
  if (descMatch) {
    info.description = descMatch[1].replace(/\\n/g, "\n").trim();
  }
  
  // 提取 author
  const authorMatch = content.match(/author\s*=\s*["']([^"']+)["']/);
  if (authorMatch) info.author = authorMatch[1];
  
  // 提取命令（从 cmdHandlers 或 commands）
  const cmdHandlerMatch = content.match(/cmdHandlers\s*=\s*\{([^}]+)\}/s);
  if (cmdHandlerMatch) {
    const cmdMatches = cmdHandlerMatch[1].matchAll(/(\w+)\s*:/g);
    for (const match of cmdMatches) {
      if (!info.commands.includes(match[1])) {
        info.commands.push(match[1]);
      }
    }
  }
  
  // 从 commands 对象提取
  const commandsMatch = content.match(/commands\s*:\s*\{([^}]+)\}/s);
  if (commandsMatch) {
    const cmdMatches = commandsMatch[1].matchAll(/(\w+)\s*:\s*\{/g);
    for (const match of cmdMatches) {
      if (!info.commands.includes(match[1])) {
        info.commands.push(match[1]);
      }
    }
  }
  
  return info;
}

// 获取插件的命令列表
function getPluginCmds(plugin: any): string[] {
  const cmds: string[] = [];
  if (plugin.commands) cmds.push(...Object.keys(plugin.commands));
  if (plugin.cmdHandlers) cmds.push(...Object.keys(plugin.cmdHandlers));
  return cmds;
}

export default pluginPlugin;
