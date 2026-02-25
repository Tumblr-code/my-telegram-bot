import { Plugin } from "../types/index.js";
import { pluginManager } from "../core/pluginManager.js";
import { db } from "../utils/database.js";
import { fmt } from "../utils/context.js";
import { logger } from "../utils/logger.js";
import { readdirSync, existsSync } from "fs";
import { join } from "path";
import axios from "axios";

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
            
            // 获取所有已加载的插件
            const allPlugins = pluginManager.getAllPlugins();
            
            // 构建插件列表内容（放入折叠块，命令可点击复制）
            const copyCmd = (cmd: string) => `<a href="tg://copy?text=${encodeURIComponent(prefix + cmd)}">${fmt.code(cmd)}</a>`;
            
            let pluginListText = "";
            
            for (const plugin of allPlugins) {
              const cmds: string[] = [];
              
              // 收集 commands 中的命令
              if (plugin.commands) {
                cmds.push(...Object.keys(plugin.commands));
              }
              
              // 收集 cmdHandlers 中的命令
              if (plugin.cmdHandlers) {
                cmds.push(...Object.keys(plugin.cmdHandlers));
              }
              
              // 显示插件信息
              if (cmds.length > 0) {
                pluginListText += `${plugin.name} (${cmds.length}个命令)\n`;
                pluginListText += `  ${cmds.map(copyCmd).join(" ")}\n\n`;
              } else {
                pluginListText += `${plugin.name}\n`;
                pluginListText += `  (无命令)\n\n`;
              }
            }
            
            // 构建最终消息
            let text = fmt.bold("📦 已加载插件和命令") + "\n\n";
            text += `<blockquote expandable>${pluginListText.trim()}</blockquote>\n\n`;
            text += "使用 " + fmt.code(prefix + "help <命令>") + " 查看详细帮助";
            
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

export default pluginPlugin;
