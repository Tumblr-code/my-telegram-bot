#!/usr/bin/env bun
/**
 * NexBot Plugin Manager CLI
 * 用于管理插件的命令行工具
 */
import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const PLUGINS_DIR = process.env.PLUGINS_DIR || "./plugins";
const REGISTRY_URL = process.env.PLUGIN_REGISTRY_URL || "https://raw.githubusercontent.com/nexbot/plugins/main/registry.json";

interface PluginTemplate {
  name: string;
  description: string;
  version: string;
  author: string;
}

function showHelp(): void {
  console.log(`
🔌 NexBot Plugin Manager

用法: bun pm <命令> [选项]

命令:
  create <name>     创建新插件模板
  install <name>    从插件商店安装
  search [query]    搜索可用插件
  list              列出已安装插件
  remove <name>     移除插件

示例:
  bun pm create myplugin    创建名为 myplugin 的插件
  bun pm install weather    安装 weather 插件
  bun pm search util        搜索工具类插件
`);
}

function createPlugin(name: string): void {
  if (!name) {
    console.error("❌ 请提供插件名称");
    process.exit(1);
  }

  if (!existsSync(PLUGINS_DIR)) {
    mkdirSync(PLUGINS_DIR, { recursive: true });
  }

  const pluginPath = join(PLUGINS_DIR, `${name}.ts`);
  
  if (existsSync(pluginPath)) {
    console.error(`❌ 插件 ${name} 已存在`);
    process.exit(1);
  }

  const template = `import { Plugin } from "../src/types/index.js";

const ${name}Plugin: Plugin = {
  name: "${name}",
  version: "1.0.0",
  description: "${name} 插件描述",
  author: "Your Name",

  commands: {
    ${name}: {
      description: "${name} 命令",
      aliases: [],
      examples: ["${name}"],
      handler: async (msg, args, ctx) => {
        await ctx.reply("👋 Hello from ${name} plugin!");
      },
    },
  },

  async onInit(client) {
    console.log("${name} 插件已初始化");
  },

  async onUnload() {
    console.log("${name} 插件已卸载");
  },
};

export default ${name}Plugin;
`;

  writeFileSync(pluginPath, template);
  console.log(`✅ 插件模板已创建: ${pluginPath}`);
  console.log("📝 编辑该文件来自定义你的插件");
}

async function installPlugin(name: string): Promise<void> {
  if (!name) {
    console.error("❌ 请提供插件名称");
    process.exit(1);
  }

  console.log(`🔍 正在查找插件: ${name}...`);

  try {
    const response = await fetch(REGISTRY_URL);
    if (!response.ok) {
      throw new Error("无法获取插件列表");
    }

    const registry = await response.json() as { plugins?: Record<string, any> };
    const plugin = registry.plugins?.[name];

    if (!plugin) {
      console.error(`❌ 插件 ${name} 不存在`);
      console.log("💡 使用 'bun pm search' 查找可用插件");
      process.exit(1);
    }

    if (!existsSync(PLUGINS_DIR)) {
      mkdirSync(PLUGINS_DIR, { recursive: true });
    }

    const pluginPath = join(PLUGINS_DIR, `${name}.ts`);
    
    console.log(`📥 正在下载 ${name} v${plugin.version}...`);
    
    const codeResponse = await fetch(plugin.url);
    if (!codeResponse.ok) {
      throw new Error("下载失败");
    }

    const code = await codeResponse.text();
    writeFileSync(pluginPath, code);

    console.log(`✅ 插件 ${name} 已安装`);
    console.log(`📖 描述: ${plugin.description}`);
    console.log(`👤 作者: ${plugin.author}`);
    
  } catch (err) {
    console.error("❌ 安装失败:", err instanceof Error ? err.message : "未知错误");
    process.exit(1);
  }
}

async function searchPlugins(query?: string): Promise<void> {
  try {
    const response = await fetch(REGISTRY_URL);
    if (!response.ok) {
      throw new Error("无法获取插件列表");
    }

    const registry = await response.json() as { plugins?: Record<string, any> };
    const plugins = Object.entries(registry.plugins || {});

    if (plugins.length === 0) {
      console.log("📭 插件商店为空");
      return;
    }

    console.log("🔌 可用插件:\n");

    for (const [name, info] of plugins as [string, any][]) {
      if (!query || name.includes(query) || info.description?.includes(query)) {
        console.log(`${name} v${info.version}`);
        console.log(`  ${info.description}`);
        console.log(`  作者: ${info.author}\n`);
      }
    }

  } catch (err) {
    console.error("❌ 搜索失败:", err instanceof Error ? err.message : "未知错误");
    process.exit(1);
  }
}

function listPlugins(): void {
  if (!existsSync(PLUGINS_DIR)) {
    console.log("📭 没有已安装的插件");
    return;
  }

  const files = require("fs").readdirSync(PLUGINS_DIR)
    .filter((f: string) => f.endsWith(".ts") || f.endsWith(".js"));

  if (files.length === 0) {
    console.log("📭 没有已安装的插件");
    return;
  }

  console.log("📦 已安装插件:\n");
  for (const file of files) {
    console.log(`  - ${file.replace(/\.ts$|\.js$/, "")}`);
  }
}

function removePlugin(name: string): void {
  if (!name) {
    console.error("❌ 请提供插件名称");
    process.exit(1);
  }

  const pluginPath = join(PLUGINS_DIR, `${name}.ts`);
  const jsPath = join(PLUGINS_DIR, `${name}.js`);

  if (existsSync(pluginPath)) {
    require("fs").unlinkSync(pluginPath);
    console.log(`✅ 插件 ${name} 已移除`);
  } else if (existsSync(jsPath)) {
    require("fs").unlinkSync(jsPath);
    console.log(`✅ 插件 ${name} 已移除`);
  } else {
    console.error(`❌ 插件 ${name} 不存在`);
    process.exit(1);
  }
}

// 主程序
const args = process.argv.slice(2);
const command = args[0];
const arg = args[1];

switch (command) {
  case "create":
    createPlugin(arg);
    break;
  case "install":
  case "i":
    installPlugin(arg);
    break;
  case "search":
  case "s":
    searchPlugins(arg);
    break;
  case "list":
  case "ls":
    listPlugins();
    break;
  case "remove":
  case "rm":
    removePlugin(arg);
    break;
  case "help":
  case "--help":
  case "-h":
  default:
    showHelp();
    break;
}
