# 🔌 NexBot 插件文档

> **版本**: v1.5.0 | **更新日期**: 2026-02-26

本文档包含所有内置插件和扩展插件的详细说明。

---

## 📦 内置插件

内置插件位于 `src/plugins/` 目录，无需安装即可使用。

### 1. help - 帮助系统

**命令**: `help`, `h`, `start`

| 用法 | 描述 |
|------|------|
| `help` | 显示主帮助信息，列出所有可用命令 |
| `help <命令>` | 查看指定命令的详细帮助 |

**功能**: 提供 Bot 使用指南，显示分类命令列表，支持点击复制命令。

---

### 2. exec - 命令执行

**命令**: `exec`, `shell`, `sh`, `cmd`, `eval`, `js`

| 命令 | 描述 |
|------|------|
| `exec <命令>` | 执行 Shell 命令 |
| `eval <代码>` | 执行 JavaScript 代码 |

**示例**:
```
.exec ls -la
.eval 1 + 1
.eval console.log("Hello")
```

**安全特性**:
- 自动拦截危险命令（rm -rf /, mkfs 等）
- 支持超时设置（默认 30 秒）
- 输出长度限制（默认 4000 字符）

---

### 3. debug - 调试工具

**命令**: `id`, `chatid`, `chat`, `echo`, `say`, `ping`, `pong`, `msg`

| 命令 | 描述 |
|------|------|
| `id` | 获取当前聊天信息 |
| `echo <文本>` | 回声测试 |
| `ping` | 测试响应速度 |
| `msg` | 获取消息原始 JSON 数据 |

**示例**:
```
.id          # 显示聊天 ID、类型、用户信息
.echo Hello  # 回复 "Hello"
.ping        # 测试延迟
```

---

### 4. sysinfo - 系统信息

**命令**: `sysinfo`, `status`, `stats`, `info`, `uptime`, `up`, `db`, `database`, `health`, `hc`, `cache`, `ratelimit`, `rl`

| 命令 | 描述 |
|------|------|
| `sysinfo` | 系统信息（内存、CPU、运行时间） |
| `uptime` | 显示运行时间 |
| `health` | 健康状态检查 |
| `db` | 数据库统计 |
| `cache` | 缓存统计 |
| `ratelimit` | 限流统计 |

**示例输出**:
```
📊 NexBot v1.0.2

linux · x64 · v20.0.0
⏱️ 2天 5小时 32分钟

💾 ████████░░ 80%
1024MB / 2048MB

💻 ██░░░░░░░░ 15%
4核 · 8插件
```

---

### 5. plugin - 插件管理

**命令**: `plugin`, `pm`, `plugins`

| 用法 | 描述 |
|------|------|
| `plugin list` | 查看插件列表 |
| `plugin install <名称>` | 安装插件 |
| `plugin remove <名称>` | 卸载插件 |
| `plugin reload <名称>` | 重载插件 |
| `plugin reloadall` | 重载所有插件 |
| `plugin alias` | 查看命令别名 |
| `plugin alias add <别名> <命令>` | 添加命令别名 |
| `plugin alias remove <别名>` | 删除命令别名 |

**示例**:
```
.plugin list                    # 查看所有插件
.plugin install speedtest       # 安装网速测试插件
.plugin remove speedtest        # 卸载插件
.plugin reload ai               # 重载 AI 插件
.plugin alias add s speedtest   # 添加别名 .s 代表 speedtest
```

---

## 📦 扩展插件

扩展插件位于 `plugins/` 目录，需要先安装才能使用。

### 1. lottery - 自动抽奖 🎰

**文件**: `plugins/lottery.ts`

**版本**: v2.1.0

**功能**: 自动监控群组抽奖消息，提取关键词并自动参与抽奖。支持多群组同时监控。

**核心特性**:
- 🎯 智能关键词提取（支持「中文引号」格式）
- 💾 数据库缓存机制（防止消息被快速编辑丢失内容）
- 🔄 异步处理消息，自动发送关键词
- 📱 支持多群组同时监控
- ⚡ 可开启/关闭自动参与

**命令**:

| 命令 | 描述 |
|------|------|
| `lottery` | 查看抽奖插件状态和监控的群组列表 |
| `lottadd <群组ID> <BotID>` | 添加监控群组 |
| `lottdel <群组ID>` | 删除监控群组 |
| `lotton` | 开启自动参与抽奖 |
| `lottoff` | 关闭自动参与抽奖 |

**用法示例**:
```
.lottadd -1001234567890 6461022460
.lottdel -1001234567890
.lotton
.lottery
```

**工作原理**:
1. 监控配置的群组中的目标 Bot 消息
2. 将消息保存到数据库（防止被快速编辑）
3. 定时扫描未处理消息，提取「关键词」
4. 自动发送关键词到对应群组参与抽奖

**数据库表**:
- `lottery_messages` - 缓存的消息
- `lottery_keywords` - 提取的关键词
- `lottery_groups` - 监控的群组配置
- `lottery_settings` - 全局设置

---

### 2. ai - AI 智能助手

**文件**: `plugins/ai.ts`

**命令**: `ai`

**功能**: 支持多提供商的 AI 对话助手，兼容 OpenAI / Gemini / Claude / 火山引擎等标准接口。

**子命令**:

| 子命令 | 描述 |
|--------|------|
| `ai <问题>` | 普通对话（默认模式） |
| `ai chat <问题>` | 连续对话（带上下文记忆） |
| `ai search <关键词>` | 联网搜索 |
| `ai image <描述>` | 生成图片 |
| `ai tts <文本>` | 文字转语音 |
| `ai audio <语音>` | 语音回答（语音输入+输出） |
| `ai searchaudio <关键词>` | 搜索+语音回答 |
| `ai prompt <预设>` | 设置全局 Prompt 预设 |
| `ai config` | 查看/修改配置 |
| `ai model` | 查看/切换模型 |
| `ai clear` | 清除当前对话历史 |
| `ai clearall` | 清除所有对话历史 |
| `ai stats` | 查看使用统计 |
| `ai export` | 导出对话历史 |

**配置说明**:
- 配置文件保存在 `data/ai/config.json`
- 支持多提供商配置
- 可设置 Telegraph 自动长文发布
- 支持自定义音色（Gemini/OpenAI）

**示例**:
```
.ai 你好
.ai chat 讲个故事
.ai search 今天的新闻
.ai image 一只可爱的猫咪
.ai tts 你好世界
```

---

### 3. pansou - 网盘搜索

**文件**: `plugins/pansou.ts`

**命令**: `pan`, `pansou`

**功能**: 对接 Pansou 网盘搜索服务，搜索结果以 Telegraph 页面形式展示，排版美观。

**用法**:
```
.pan <关键词>
```

**示例**:
```
.pan 复仇者联盟
.pan Python教程
```

**支持的网盘类型**:
- ⚡ 迅雷云盘
- ☁️ 阿里云盘
- 🔵 百度网盘
- 🦅 夸克网盘
- 📦 123云盘
- 🧲 磁力链接
- 📱 移动云盘
- 📡 天翼云盘
- 📂 PikPak
- 📎 115网盘

**环境变量**:
| 变量 | 描述 | 默认值 |
|------|------|--------|
| `PANSOU_API_URL` | Pansou API 地址 | `http://127.0.0.1:8888` |
| `PANSOU_API_TIMEOUT` | 请求超时时间 | `30000` |

---

### 4. privateguard - 私聊保护

**文件**: `plugins/privateguard.ts`

**命令**: `pglist`, `pgallow`, `pgremove`, `pgreset`, `pgtype`, `pgblocklist`, `pgblock`, `pgunblock`

**功能**: 陌生人私聊你时，自动要求其完成人机验证，否则自动删除消息并拉黑。

**管理命令**:

| 命令 | 描述 |
|------|------|
| `pglist` | 查看已验证用户列表 |
| `pgallow <用户ID>` | 手动添加白名单 |
| `pgremove <用户ID>` | 移除白名单 |
| `pgreset` | 重置所有数据 |
| `pgtype <类型>` | 切换验证类型 |
| `pgblocklist` | 查看黑名单 |
| `pgblock <用户ID>` | 拉黑用户 |
| `pgunblock <用户ID>` | 解除拉黑 |

**验证类型**:
- `math` - 数学计算（如：15 + 23 = ?）
- `click` - 顺序点击数字按钮
- `random` - 随机混合

**配置**:
```typescript
const CONFIG = {
  MAX_ATTEMPTS: 3,        // 最大尝试次数
  EXPIRE_MINUTES: 3,      // 验证超时时间（分钟）
  VERIFY_TYPE: "math",    // 默认验证类型
};
```

**数据文件**:
- `data/privateguard_allowed.json` - 已验证用户
- `data/privateguard_pending.json` - 验证中用户
- `data/privateguard_blocked.json` - 黑名单

---

### 5. speedtest - 网速测试

**文件**: `plugins/speedtest.ts`

**命令**: `speedtest`, `st`, `speed`

**功能**: 测试服务器网络速度（延迟和下载速度）。

**用法**:
```
.speedtest
```

**示例输出**:
```
🚀 网速测试结果

📶 延迟: 45 ms
⬇️ 下载: 125.50 Mbps
⏱️ 耗时: 2.5s

测试时间: 2024/1/15 10:30:00
```

**测试服务器**:
- Cloudflare Speed Test
- Hetzner Speed Test

---

### 6. calc - 科学计算器

**文件**: `plugins/calc.ts`

**命令**: `calc`, `calculator`, `math`

**功能**: 安全计算数学表达式，支持 + - * / 四则运算和括号优先级。

**用法**:
```
.calc <表达式>
```

**示例**:
```
.calc 1+2+3
.calc (10+20)*3
.calc 100/4-5
.calc 3.14*2
```

**特性**:
- 安全解析，防止代码注入
- 支持负数和小数
- 支持复杂嵌套括号
- 最大表达式长度 500 字符

---

### 7. hitokoto - 随机一言

**文件**: `plugins/hitokoto.ts`

**命令**: `hitokoto`, `yiyan`, `yy`, `一言`

**功能**: 从 hitokoto.cn API 获取随机一言，支持多种类型（动画、漫画、文学、哲学等）。

**用法**:
```
.hitokoto
```

**示例输出**:
```
💬 你若盛开，清风自来。

📚 《你若安好便是晴天》（文学）
```

**支持的类型**:
- 动画、漫画、游戏
- 文学、影视、诗词
- 哲学、网易云、抖机灵

---

### 8. weather - 天气查询

**文件**: `plugins/weather.ts`

**命令**: `weather`, `wt`, `tq`, `天气`

**功能**: 查询全球城市天气信息，使用 Open-Meteo 免费 API，支持中英文城市名。

**用法**:
```
.weather <城市名>
```

**示例**:
```
.weather 北京
.weather Shanghai
.weather Tokyo
.weather London
```

**示例输出**:
```
☀️ 北京, 北京市, 中国
晴朗 · 🌡️ 25°C

详细数据：
🌡️ 体感温度: 24°C
💧 湿度: 45%
💨 风速: 12 km/h (东南)
📊 气压: 1013 hPa

今日预报：
🔺 最高: 28°C · 🔻 最低: 18°C
🌅 日出: 05:30 · 🌇 日落: 19:15
```

**特性**:
- 支持全球所有城市
- 自动识别中英文城市名
- 显示实时天气、温度、湿度、风速
- 显示日出日落时间
- 显示今日最高/最低温度

---

### 9. ip - IP 查询

**文件**: `plugins/ip.ts`

**命令**: `ip`, `ipinfo`, `iplookup`

**功能**: 查询 IP 地址或域名的详细信息，包括地理位置、ISP、组织等。

**用法**:
```
.ip <IP地址或域名>
```

**示例**:
```
.ip 8.8.8.8
.ip google.com
.ip 2001:4860:4860::8888
```

**示例输出**:
```
🌍 IP/域名查询结果

📍 查询目标: 8.8.8.8
📍 地理位置: 美国 - 加利福尼亚州 - 山景城
🏢 ISP: Google LLC
🏦 组织: Google Public DNS
🔢 AS号: AS15169
⏰ 时区: America/Los_Angeles

🔗 查看 AS15169 详情
```

**特性**:
- 支持 IPv4 和 IPv6
- 支持域名查询
- 检测代理和数据中心 IP
- 提供 AS 详情链接

---

### 10. crazy4 - 疯狂星期四

**文件**: `plugins/crazy4.ts`

**命令**: `crazy4`, `crazy`, `kfc`, `v50`

**功能**: 随机发送疯狂星期四文案，包含 40+ 条精选文案。

**用法**:
```
.crazy4
```

**特性**:
- 40+ 条精选疯狂星期四文案
- 每条都包含丰富的 Emoji 表情
- 随机选择，每次都不一样

---

### 10. system - 系统管理

**文件**: `plugins/system.ts`

**命令**: `update` (up), `upgrade` (upg), `restart` (reboot), `status` (stat), `logs` (log), `sys` (exec, shell)

**功能**: 系统管理命令，包括更新代码、升级依赖、重启Bot、查看状态/日志等。

**命令说明**:

| 命令 | 别名 | 描述 | 示例 |
|------|------|------|------|
| `update` | `up` | 从GitHub拉取最新代码 | `.update` |
| `upgrade` | `upg` | 升级项目依赖（bun install） | `.upgrade` |
| `restart` | `reboot` | 重启Bot | `.restart` |
| `status` | `stat` | 查看系统状态（Git/版本/运行时间） | `.status` |
| `logs` | `log` | 查看日志（默认30行，10-100） | `.logs 50` |
| `sys` | `exec`, `shell` | 执行系统命令（有安全检查） | `.sys ps aux` |

**status 显示内容**:
- Git 分支和提交信息
- 工作区是否有未提交更改
- NexBot 版本号
- Node.js 版本和平台信息
- Bot 运行时间和内存使用
- 进程 PID

**logs 用法**:
```
.logs        # 查看最近30行
.logs 50     # 查看最近50行
.logs 100    # 查看最近100行
```

**sys 命令安全限制**:
- 禁止执行危险命令（rm -rf /, shutdown, reboot 等）
- 建议仅用于简单查询（ps, df, free 等）

---

## 🛠️ 开发插件

### 基础插件结构

```typescript
import { Plugin } from "../src/types/index.js";

const myPlugin: Plugin = {
  name: "myplugin",           // 插件名称（唯一）
  version: "1.0.0",           // 版本号
  description: "插件描述",     // 描述
  author: "Your Name",        // 作者

  commands: {
    // 命令定义
    hello: {
      description: "打招呼",   // 命令描述
      sudo: false,             // 是否需要 sudo 权限
      aliases: ["hi"],         // 别名
      examples: ["hello", "hello world"],  // 使用示例
      handler: async (msg, args, ctx) => {
        // msg - 消息对象
        // args - 命令参数数组
        // ctx - 命令上下文
        await ctx.reply("👋 Hello!");
      },
    },
  },

  // 消息监听（可选）
  onMessage: async (msg, client) => {
    // 处理所有消息
  },

  // 初始化钩子（可选）
  onInit: async (client) => {
    // 插件加载时执行
  },

  // 卸载钩子（可选）
  onUnload: async () => {
    // 插件卸载时执行
  },
};

export default myPlugin;
```

### 使用 TeleBox 兼容模式

```typescript
import { Plugin } from "../src/utils/pluginBase.js";

class MyPlugin extends Plugin {
  name = "myplugin";
  version = "1.0.0";
  description = "我的插件";
  author = "Your Name";

  cmdHandlers = {
    hello: async (msg) => {
      await msg.reply({ message: "Hello!" });
    },
  };
}

export default new MyPlugin();
```

### 上下文 API

```typescript
// 发送消息
await ctx.reply("普通文本");
await ctx.replyHTML("<b>HTML</b> 格式");

// 删除消息
await ctx.deleteMessage();

// 判断聊天类型
if (ctx.isPrivate) { /* 私聊 */ }
if (ctx.isGroup) { /* 群组 */ }
if (ctx.isChannel) { /* 频道 */ }
if (ctx.isSudo) { /* sudo 用户 */ }
```

### 格式化工具

```typescript
import { fmt } from "../src/utils/context.js";

fmt.bold("粗体");           // <b>粗体</b>
fmt.italic("斜体");         // <i>斜体</i>
fmt.code("代码");           // <code>代码</code>
fmt.pre("代码块", "js");    // <pre><code class="language-js">代码块</code></pre>
fmt.link("文本", "url");    // <a href="url">文本</a>
fmt.mention(userId, "名");  // <a href="tg://user?id=123">名</a>
```

---

## 📝 插件安装流程

1. 将插件文件放入 `plugins/` 目录
2. 使用 `.plugin list` 查看可用插件
3. 使用 `.plugin install <名称>` 安装
4. 使用 `.plugin remove <名称>` 卸载

---

Made with ❤️ by NexBot Team
