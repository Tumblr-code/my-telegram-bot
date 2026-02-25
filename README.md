# 🤖 NexBot

[![CI](https://github.com/Tumblr-code/NexBot/actions/workflows/ci.yml/badge.svg)](https://github.com/Tumblr-code/NexBot/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

下一代 Telegram Bot 框架 - 更快、更简单、更稳定

## ✨ 特性

- ⚡ **极速启动** - 基于 Bun 运行时，启动速度提升 10 倍
- 🎯 **极简架构** - 核心代码 < 1000 行，易于理解和扩展
- 🔌 **插件系统** - 热重载、自动加载、别名支持
- 🛡️ **安全可靠** - 仅限本人使用，危险命令拦截、限流保护
- 💾 **内置数据库** - Bun SQLite，零配置、高性能
- 📊 **健康监控** - 实时监控运行状态和性能指标
- 💨 **智能缓存** - LRU 缓存策略，自动过期清理
- 📝 **TypeScript** - 完整的类型支持
- 🚀 **现代语法** - ESM、Top-level await

## 📦 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 运行时 | Bun | >= 1.2.0 |
| 语言 | TypeScript | 5.7+ |
| Telegram | GramJS | 2.26+ |
| 数据库 | Bun SQLite | 内置 |

## 🚀 快速开始

### 1. 安装 Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. 克隆项目

```bash
git clone https://github.com/Tumblr-code/NexBot.git
cd NexBot
```

### 3. 安装依赖

```bash
bun install
```

### 4. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 Telegram API 信息
```

从 [my.telegram.org/apps](https://my.telegram.org/apps) 获取 API ID 和 API Hash。

### 5. 启动

```bash
# 生产模式
bun start

# 开发模式（热重载）
bun run dev
```

首次启动需要登录 Telegram，按照提示输入手机号和验证码。

## 📖 使用指南

### 命令前缀

- **生产模式**: `.` (可配置)
- **开发模式**: `!`

### 内置命令

| 命令 | 描述 | 别名 |
|------|------|------|
| `help` | 显示帮助信息 | `h`, `start` |
| `help <命令>` | 查看指定命令详情 | - |
| `ping` | 测试响应速度 | `pong` |
| `echo` | 回声测试 | `say` |
| `id` | 获取当前聊天信息 | `chatid`, `chat` |
| `sysinfo` | 系统信息（内存、CPU、运行时间） | `status`, `stats`, `info` |
| `uptime` | 显示运行时间 | `up` |
| `health` | 健康状态检查 | `hc` |
| `exec` | 执行 Shell 命令 | `shell`, `sh`, `cmd` |
| `eval` | 执行 JavaScript 代码 | `js` |
| `db` | 数据库信息 | `database` |
| `cache` | 缓存统计 | - |
| `ratelimit` | 限流统计 | `rl` |
| `msg` | 获取消息原始数据（调试） | - |
| `plugin` | 插件管理 | `pm`, `plugins` |

### 插件管理命令

| 命令 | 描述 |
|------|------|
| `plugin list` | 查看插件列表（可安装/已安装） |
| `plugin install <名称>` | 安装插件 |
| `plugin remove <名称>` | 卸载插件 |
| `plugin reload <名称>` | 重载插件 |
| `plugin reloadall` | 重载所有插件 |
| `plugin alias` | 查看命令别名 |
| `plugin alias add <别名> <命令>` | 添加命令别名 |
| `plugin alias remove <别名>` | 删除命令别名 |

### 扩展插件

插件文件存放在 `plugins/` 目录，安装后即可使用：

| 插件 | 命令 | 描述 |
|------|------|------|
| **[ai](https://github.com/Tumblr-code/NexBot/blob/main/plugins/ai.ts)** | `ai` | AI 对话助手（支持 OpenAI/Gemini/Claude） |
| **[pansou](https://github.com/Tumblr-code/NexBot/blob/main/plugins/pansou.ts)** | `pan` | 网盘搜索（Telegraph 排版） |
| **[privateguard](https://github.com/Tumblr-code/NexBot/blob/main/plugins/privateguard.ts)** | `pglist` | 私聊保护（人机验证） |
| **[speedtest](https://github.com/Tumblr-code/NexBot/blob/main/plugins/speedtest.ts)** | `speedtest` | 网速测试 |
| **[calc](https://github.com/Tumblr-code/NexBot/blob/main/plugins/calc.ts)** | `calc` | 科学计算器（支持复杂表达式） |
| **[hitokoto](https://github.com/Tumblr-code/NexBot/blob/main/plugins/hitokoto.ts)** | `hitokoto` | 随机一言（来自 hitokoto.cn） |
| **[weather](https://github.com/Tumblr-code/NexBot/blob/main/plugins/weather.ts)** | `weather` | 天气查询（支持全球城市） |
| **[ip](https://github.com/Tumblr-code/NexBot/blob/main/plugins/ip.ts)** | `ip` | IP/域名查询（地理位置+ISP） |
| **[crazy4](https://github.com/Tumblr-code/NexBot/blob/main/plugins/crazy4.ts)** | `crazy4` | 疯狂星期四文案 |
| **[system](https://github.com/Tumblr-code/NexBot/blob/main/plugins/system.ts)** | `update/upgrade/restart/status/logs/sys` | 系统管理（更新/重启/日志） |

#### AI 插件子命令

| 子命令 | 描述 |
|--------|------|
| `ai <问题>` | 普通对话 |
| `ai chat <问题>` | 连续对话（带上下文） |
| `ai search <关键词>` | 联网搜索 |
| `ai image <描述>` | 生成图片 |
| `ai tts <文本>` | 文字转语音 |
| `ai audio <语音>` | 语音回答 |
| `ai prompt <预设>` | 设置全局预设 |
| `ai config` | 查看配置 |
| `ai model` | 切换模型 |

#### PrivateGuard 插件命令

| 命令 | 描述 |
|------|------|
| `pglist` | 查看已验证用户列表 |
| `pgallow <用户ID>` | 添加白名单 |
| `pgremove <用户ID>` | 移除白名单 |
| `pgreset` | 重置所有数据 |
| `pgtype <math/click/random>` | 切换验证类型 |
| `pgblocklist` | 查看黑名单 |
| `pgblock <用户ID>` | 拉黑用户 |
| `pgunblock <用户ID>` | 解除拉黑 |

### 开发插件

创建一个简单的插件：

```typescript
import { Plugin } from "../src/types/index.js";

const myPlugin: Plugin = {
  name: "myplugin",
  version: "1.0.0",
  description: "我的插件",
  author: "Your Name",

  commands: {
    hello: {
      description: "打招呼",
      handler: async (msg, args, ctx) => {
        await ctx.reply("👋 Hello!");
      },
    },
  },
};

export default myPlugin;
```

保存到 `plugins/myplugin.ts`，然后使用 `.plugin install myplugin` 安装。

### 插件 API

#### 命令上下文 (ctx)

```typescript
ctx.reply(text, options)      // 发送消息
ctx.replyHTML(html)           // 发送 HTML 格式消息
ctx.deleteMessage()           // 删除消息
ctx.isSudo                    // 是否为 sudo 用户
ctx.isPrivate                 // 是否为私聊
ctx.isGroup                   // 是否为群组
ctx.isChannel                 // 是否为频道
```

#### 格式化工具 (fmt)

```typescript
import { fmt } from "../utils/context.js";

fmt.bold(text)      // 粗体
fmt.italic(text)    // 斜体
fmt.code(text)      // 行内代码
fmt.pre(text, lang) // 代码块
fmt.link(text, url) // 链接
fmt.mention(userId, name) // 提及用户
```

#### 数据库

```typescript
import { db } from "../utils/database.js";

db.set(key, value)           // 存储数据
db.get(key, defaultValue)    // 获取数据
db.delete(key)               // 删除数据
db.isSudo(userId)            // 检查 sudo 权限
db.addSudo(userId)           // 添加 sudo 权限
```

## ⚙️ 配置

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `TELEGRAM_API_ID` | Telegram API ID | 必填 |
| `TELEGRAM_API_HASH` | Telegram API Hash | 必填 |
| `OWNER_ID` | 机器人所有者 ID（可选，自动识别登录用户） | 自动检测 |
| `CMD_PREFIX` | 命令前缀 | `.` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `ENABLE_SHELL_EXEC` | 启用 shell 执行 | `true` |
| `SHELL_TIMEOUT` | shell 超时时间 | `30000` |

## 📁 项目结构

```
nexbot/
├── src/
│   ├── core/                   # 核心模块
│   │   ├── pluginManager.ts    # 插件管理器
│   │   └── commandHandler.ts   # 命令处理器
│   ├── plugins/                # 内置插件
│   │   ├── help.ts             # 帮助系统
│   │   ├── exec.ts             # 命令执行
│   │   ├── debug.ts            # 调试工具
│   │   ├── sysinfo.ts          # 系统信息
│   │   └── plugin.ts           # 插件管理
│   ├── utils/                  # 工具函数
│   ├── types/                  # 类型定义
│   └── index.ts                # 入口文件
├── plugins/                    # 扩展插件目录（自主安装）
├── data/                       # 数据库目录
└── logs/                       # 日志目录
```

## 🔒 安全

- 仅限登录用户使用管理命令（自动识别）
- 危险命令自动拦截（rm -rf / 等）
- Shell 执行可禁用
- 命令超时保护

## 📄 许可证

MIT License

---

Made with ❤️ by NexBot Team
