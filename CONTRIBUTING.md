# 贡献指南

感谢你对 NexBot 的兴趣！我们欢迎各种形式的贡献。

## 如何贡献

### 报告问题

1. 检查问题是否已存在
2. 创建新 issue，包含:
   - 问题描述
   - 复现步骤
   - 预期行为
   - 实际行为
   - 环境信息 (OS, Bun 版本等)

### 提交代码

1. Fork 仓库
2. 创建分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript
- 遵循现有代码风格
- 添加必要的注释
- 保持简洁（核心代码不超过 1000 行）

### 插件开发

如果你想贡献插件:

1. 在 `plugins/` 目录创建插件
2. 遵循插件模板格式
3. 添加文档和示例
4. 提交 PR

## 开发环境

```bash
# 克隆仓库
git clone https://github.com/Tumblr-code/NexBot.git
cd NexBot

# 安装依赖
bun install

# 开发模式
bun run dev

# 运行测试
bun test
```

## 插件开发指南

### 基础插件结构

```typescript
import { Plugin } from "../src/types/index.js";

const myPlugin: Plugin = {
  name: "myplugin",
  version: "1.0.0",
  description: "插件描述",
  author: "Your Name",

  commands: {
    mycommand: {
      description: "命令描述",
      aliases: ["alias1", "alias2"],
      examples: ["mycommand arg1"],
      sudo: false, // 是否需要 sudo 权限
      handler: async (msg, args, ctx) => {
        // 命令逻辑
        await ctx.reply("Hello!");
      },
    },
  },

  async onInit(client) {
    // 初始化逻辑
  },

  async onUnload() {
    // 清理逻辑
  },
};

export default myPlugin;
```

### 命令上下文

```typescript
ctx.reply(text, options)      // 发送消息
ctx.replyHTML(html)           // 发送 HTML 消息
ctx.deleteMessage()           // 删除消息
ctx.isSudo                    // 是否为 sudo 用户
ctx.isPrivate                 // 是否为私聊
ctx.isGroup                   // 是否为群组
ctx.isChannel                 // 是否为频道
ctx.client                    // TelegramClient 实例
```

### 格式化工具

```typescript
import { fmt } from "../utils/context.js";

fmt.bold(text)      // <b>text</b>
fmt.italic(text)    // <i>text</i>
fmt.code(text)      // <code>text</code>
fmt.pre(text, lang) // <pre><code class="language-lang">text</code></pre>
fmt.link(text, url) // <a href="url">text</a>
```

### 数据库操作

```typescript
import { db } from "../utils/database.js";

db.set(key, value)           // 存储
db.get(key, defaultValue)    // 读取
db.delete(key)               // 删除
db.isSudo(userId)            // 检查权限
db.addSudo(userId)           // 添加权限
```

## 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `style:` 格式
- `refactor:` 重构
- `perf:` 性能
- `test:` 测试
- `chore:` 构建/工具

示例:
```
feat(plugin): add weather plugin
fix(core): handle plugin load error
docs(readme): update install guide
```

## 行为准则

- 尊重他人
- 接受建设性批评
- 关注问题本身
- 展现同理心

## 许可证

贡献即表示你同意将你的代码以 MIT 许可证发布。

## 联系方式

- GitHub Issues: [github.com/Tumblr-code/NexBot/issues](https://github.com/Tumblr-code/NexBot/issues)

感谢你的贡献！🎉
