import { TelegramClient } from "telegram";
import { readdirSync, existsSync } from "fs";
import { join, extname } from "path";
import { Plugin, CommandDefinition } from "../types/index.js";
import { db } from "../utils/database.js";
import { logger } from "../utils/logger.js";

interface LoadedPlugin {
  instance: Plugin;
  path: string;
  isBuiltin: boolean;
}

class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private commands: Map<string, { plugin: string; def: CommandDefinition }> = new Map();
  private aliases: Map<string, string> = new Map();
  private client: TelegramClient | null = null;
  private pluginsDir: string;

  constructor() {
    this.pluginsDir = process.env.PLUGINS_DIR || join(process.cwd(), "plugins");
    this.loadAliases();
  }

  setClient(client: TelegramClient): void {
    this.client = client;
  }

  private loadAliases(): void {
    const aliases = db.getAllAliases();
    for (const [alias, command] of Object.entries(aliases)) {
      this.aliases.set(alias, command);
    }
  }

  async loadBuiltinPlugins(): Promise<void> {
    const builtinDir = join(process.cwd(), "src", "plugins");
    if (!existsSync(builtinDir)) return;

    const files = readdirSync(builtinDir).filter(f => 
      f.endsWith(".ts") && !f.endsWith(".d.ts")
    );

    // 从 src/core/ 到 src/plugins/ 的相对路径是 ../plugins/
    for (const file of files) {
      try {
        const pluginPath = join(builtinDir, file);
        // 使用时间戳避免缓存问题
        const importPath = "../plugins/" + file + "?t=" + Date.now();
        const module = await import(importPath);
        
        if (module.default) {
          const plugin: Plugin = module.default;
          await this.registerPlugin(plugin, pluginPath, false);
        }
      } catch (err) {
        logger.error(`加载内置插件失败 ${file}:`, err);
      }
    }

    logger.info(`已加载 ${this.plugins.size} 个内置插件`);
  }

  async loadExternalPlugins(): Promise<void> {
    if (!existsSync(this.pluginsDir)) return;

    const files = readdirSync(this.pluginsDir).filter(f => 
      f.endsWith(".ts") || f.endsWith(".js")
    );

    // 计算从 src/core/ 到 plugins/ 的相对路径
    const currentDir = process.cwd();
    const coreDir = join(currentDir, "src", "core");
    const relativeToPlugins = "../../plugins/";

    for (const file of files) {
      try {
        // 使用从 src/core/ 到 plugins/ 的相对路径
        const importPath = relativeToPlugins + file;
        const module = await import(importPath);
        
        if (module.default) {
          const plugin: Plugin = module.default;
          if (db.isPluginEnabled(plugin.name)) {
            const pluginPath = join(this.pluginsDir, file);
            await this.registerPlugin(plugin, pluginPath, true);
          }
        }
      } catch (err) {
        logger.error(`加载外部插件失败 ${file}:`, err);
      }
    }

    logger.info(`已加载外部插件`);
  }

  async registerPlugin(plugin: Plugin, path: string, isExternal: boolean): Promise<void> {
    const name = plugin.name;
    
    // 如果插件已存在，先卸载
    if (this.plugins.has(name)) {
      await this.unregisterPlugin(name);
    }

    // 初始化插件
    if (plugin.onInit && this.client) {
      await plugin.onInit(this.client);
    }

    // 注册命令 (NexBot 标准格式)
    if (plugin.commands) {
      for (const [cmd, def] of Object.entries(plugin.commands)) {
        this.commands.set(cmd, { plugin: name, def });
        
        // 注册别名
        if (def.aliases) {
          for (const alias of def.aliases) {
            this.commands.set(alias, { plugin: name, def });
          }
        }
      }
    }

    // 注册命令 (TeleBox 兼容格式 - cmdHandlers)
    if (plugin.cmdHandlers) {
      for (const [cmd, handler] of Object.entries(plugin.cmdHandlers)) {
        this.commands.set(cmd, { 
          plugin: name, 
          def: {
            description: `${cmd} command`,
            handler: async (msg, args, ctx) => {
              await handler(msg, ...args);
            },
          }
        });
      }
    }

    this.plugins.set(name, { instance: plugin, path, isBuiltin: !isExternal });
    
    if (isExternal) {
      db.savePlugin(name, plugin.version || "1.0.0");
    }

    logger.info(`插件已注册: ${name} v${plugin.version || "1.0.0"}`);
  }

  async unregisterPlugin(name: string): Promise<void> {
    const loaded = this.plugins.get(name);
    if (!loaded) return;

    // 卸载钩子
    if (loaded.instance.onUnload) {
      await loaded.instance.onUnload();
    }

    // 移除命令 (NexBot 标准格式)
    if (loaded.instance.commands) {
      for (const [cmd, def] of Object.entries(loaded.instance.commands)) {
        this.commands.delete(cmd);
        
        // 移除别名
        if (def.aliases) {
          for (const alias of def.aliases) {
            this.commands.delete(alias);
          }
        }
      }
    }

    // 移除命令 (TeleBox 兼容格式 - cmdHandlers)
    if (loaded.instance.cmdHandlers) {
      for (const cmd of Object.keys(loaded.instance.cmdHandlers)) {
        this.commands.delete(cmd);
      }
    }

    this.plugins.delete(name);
    logger.info(`插件已卸载: ${name}`);
  }

  getCommand(name: string): { plugin: string; def: CommandDefinition } | undefined {
    // 首先尝试精确匹配别名
    let aliased = this.aliases.get(name);
    
    // 大小写不敏感匹配别名
    if (!aliased) {
      const lowerName = name.toLowerCase();
      for (const [key, value] of this.aliases) {
        if (key.toLowerCase() === lowerName) {
          aliased = value;
          break;
        }
      }
    }
    
    if (aliased) {
      name = aliased;
    }
    
    // 首先尝试精确匹配命令
    const exact = this.commands.get(name);
    if (exact) return exact;
    
    // 大小写不敏感匹配命令
    const lowerName = name.toLowerCase();
    for (const [key, value] of this.commands) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return undefined;
  }

  getAllCommands(): Record<string, CommandDefinition> {
    const result: Record<string, CommandDefinition> = {};
    for (const [cmd, { def }] of this.commands) {
      if (!def.aliases?.includes(cmd)) { // 排除别名
        result[cmd] = def;
      }
    }
    return result;
  }

  getPlugin(name: string): Plugin | undefined {
    // 首先尝试精确匹配
    const exact = this.plugins.get(name);
    if (exact) return exact.instance;
    
    // 大小写不敏感匹配
    const lowerName = name.toLowerCase();
    for (const [key, value] of this.plugins) {
      if (key.toLowerCase() === lowerName) {
        return value.instance;
      }
    }
    return undefined;
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).map(p => p.instance);
  }

  isCmdHandlerCommand(cmdName: string): boolean {
    // 检查命令是否来自 cmdHandlers
    const cmdInfo = this.commands.get(cmdName);
    if (!cmdInfo) return false;
    
    const plugin = this.plugins.get(cmdInfo.plugin)?.instance;
    if (!plugin?.cmdHandlers) return false;
    
    return cmdName in plugin.cmdHandlers;
  }

  getPluginCommands(pluginName: string): { commands: string[]; cmdHandlers: string[] } {
    const plugin = this.plugins.get(pluginName)?.instance;
    if (!plugin) return { commands: [], cmdHandlers: [] };
    
    return {
      commands: plugin.commands ? Object.keys(plugin.commands) : [],
      cmdHandlers: plugin.cmdHandlers ? Object.keys(plugin.cmdHandlers) : [],
    };
  }

  async handleMessage(msg: any): Promise<void> {
    if (!this.client) return;
    if (!msg) return;

    for (const { instance } of this.plugins.values()) {
      if (instance.onMessage) {
        try {
          await instance.onMessage(msg, this.client);
        } catch (err) {
          logger.error(`插件消息处理错误 ${instance.name}:`, err);
          // 继续处理其他插件，不中断
        }
      }
    }
  }

  setAlias(alias: string, command: string): void {
    this.aliases.set(alias, command);
    db.setAlias(alias, command);
  }

  removeAlias(alias: string): void {
    this.aliases.delete(alias);
    db.removeAlias(alias);
  }

  getAliases(): Record<string, string> {
    return Object.fromEntries(this.aliases);
  }

  async reloadPlugin(name: string): Promise<boolean> {
    const loaded = this.plugins.get(name);
    if (!loaded) return false;

    await this.unregisterPlugin(name);
    
    try {
      const fileName = loaded.path.split("/").pop();
      let importPath: string;
      
      if (loaded.isBuiltin) {
        // 内置插件在 src/plugins/ 目录，从 src/core/ 导入路径是 ../plugins/
        importPath = `../plugins/${fileName}?t=${Date.now()}`;
      } else {
        // 外部插件在 plugins/ 目录，从 src/core/ 导入路径是 ../../plugins/
        importPath = `../../plugins/${fileName}?t=${Date.now()}`;
      }
      
      const module = await import(importPath);
      if (module.default) {
        await this.registerPlugin(module.default, loaded.path, !loaded.isBuiltin);
        return true;
      }
    } catch (err) {
      logger.error(`重载插件失败 ${name}:`, err);
    }
    return false;
  }

  async reloadAll(): Promise<void> {
    const names = Array.from(this.plugins.keys());
    for (const name of names) {
      await this.reloadPlugin(name);
    }
  }
}

export const pluginManager = new PluginManager();
