# 🚀 快速开始

5 分钟上手 NexBot！

## 1. 安装 Bun (30 秒)

```bash
curl -fsSL https://bun.sh/install | bash
```

验证:
```bash
bun --version  # 应显示 1.2.0 或更高
```

## 2. 下载 NexBot (30 秒)

```bash
git clone https://github.com/Tumblr-code/NexBot.git
cd NexBot
bun install
```

## 3. 配置 API (2 分钟)

1. 访问 [my.telegram.org/apps](https://my.telegram.org/apps)
2. 创建应用获取 API ID 和 API Hash
3. 复制配置文件:

```bash
cp .env.example .env
```

4. 编辑 `.env`:

```env
TELEGRAM_API_ID=你的_api_id
TELEGRAM_API_HASH=你的_api_hash
```

## 4. 启动 (1 分钟)

```bash
bun start
```

按提示登录:
1. 输入手机号: `+86138xxxxxxxx`
2. 输入验证码
3. 保存输出的 session 到 `.env`

## 5. 测试 (30 秒)

在 Telegram 中:

```
.help     # 查看帮助
.ping     # 测试响应
.id       # 获取聊天信息
```

## 🎉 完成！

你现在拥有了一个功能完整的 Telegram Bot！

## 下一步

### 获取你的用户 ID

在 Telegram 中:

```
.id
```

获取的用户 ID 可用于配置环境变量 `SUDO_USERS`。

### 创建第一个插件

```bash
bun pm create myplugin
```

编辑 `plugins/myplugin.ts`:

```typescript
import { Plugin } from "../src/types/index.js";

const myPlugin: Plugin = {
  name: "myplugin",
  version: "1.0.0",
  description: "我的第一个插件",
  author: "Your Name",

  commands: {
    hello: {
      description: "打招呼",
      handler: async (msg, args, ctx) => {
        await ctx.reply("👋 Hello, World!");
      },
    },
  },
};

export default myPlugin;
```

重载插件:
```
.plugin reload myplugin
```

测试:
```
.hello
```

### 更多命令

```
# 系统信息
.sysinfo

# Shell 执行 (仅限 OWNER)
.exec ls -la

# 插件管理
.plugin list
.plugin reloadall

# 数据库信息
.db
```

## 常见问题

### Q: 收不到验证码？

A: 检查手机号格式，需要 `+` 和国家码，如 `+86138xxxxxxxx`

### Q: 命令无响应？

A: 检查命令前缀，开发模式用 `!`，生产模式用 `.`

### Q: 插件加载失败？

A: 检查插件语法，查看日志 `logs/nexbot-*.log`

## 获取帮助

- 📖 完整文档: [README.md](./README.md)
- 🛠️ 安装指南: [INSTALL.md](./INSTALL.md)
- 🏗️ 架构设计: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

**Happy Coding! 🎉**
