# NexBot 架构设计

## 设计原则

1. **极简主义**: 核心代码 < 1000 行
2. **单一职责**: 每个模块只做一件事
3. **插件优先**: 功能通过插件扩展
4. **类型安全**: 完整的 TypeScript 支持
5. **性能优先**: 使用 Bun 运行时

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         User Layer                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐    │
│  │  help   │  │  sudo   │  │  exec   │  │   sysinfo   │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────────┘    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐    │
│  │  debug  │  │ plugin  │  │ example │  │   custom    │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────────┘    │
│                         Plugins                             │
├─────────────────────────────────────────────────────────────┤
│                      Plugin Manager                         │
│         (插件注册、卸载、命令映射、热重载)                    │
├─────────────────────────────────────────────────────────────┤
│                     Command Handler                         │
│         (消息监听、命令解析、权限检查、执行)                  │
├─────────────────────────────────────────────────────────────┤
│                        Core Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐     │
│  │   Client    │  │  Database   │  │     Logger      │     │
│  │  (GramJS)   │  │(Bun SQLite) │  │   (文件+控制台)  │     │
│  └─────────────┘  └─────────────┘  └─────────────────┘     │
├─────────────────────────────────────────────────────────────┤
│                      Telegram API                           │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. 入口 (index.ts)

```typescript
// 职责: 启动流程协调
1. 加载环境变量
2. 初始化 Telegram 客户端
3. 加载插件
4. 启动命令处理器
5. 处理退出信号
```

### 2. 插件管理器 (pluginManager.ts)

```typescript
// 职责: 插件生命周期管理
- registerPlugin()    // 注册插件
- unregisterPlugin()  // 卸载插件
- getCommand()        // 获取命令
- reloadPlugin()      // 热重载
- handleMessage()     // 消息分发
```

### 3. 命令处理器 (commandHandler.ts)

```typescript
// 职责: 命令执行流程
1. 监听消息事件
2. 解析命令和参数
3. 检查权限
4. 执行命令
5. 错误处理
```

### 4. 数据库 (database.ts)

```typescript
// 职责: 数据持久化
- 权限表 (permissions)
- 插件表 (plugins)
- 键值存储 (kv_store)
- 别名表 (aliases)
```

### 5. 客户端 (client.ts)

```typescript
// 职责: Telegram 连接管理
- createClient()   // 创建连接
- 自动登录流程
- Session 管理
```

## 数据流

```
用户发送命令
    ↓
Telegram API
    ↓
GramJS Client
    ↓
Command Handler (解析命令)
    ↓
Plugin Manager (查找插件)
    ↓
权限检查 (Database)
    ↓
命令执行 (Plugin)
    ↓
发送响应 (Client)
    ↓
用户收到回复
```

## 插件系统

### 插件接口

```typescript
interface Plugin {
  name: string;           // 插件标识
  version?: string;       // 版本号
  description: string;    // 描述
  author?: string;        // 作者
  
  commands?: {            // 命令定义
    [cmd: string]: CommandDefinition;
  };
  
  onMessage?: Handler;    // 消息监听
  onEvent?: EventHandlers;// 事件监听
  onInit?: InitHandler;   // 初始化钩子
  onUnload?: UnloadHandler;// 卸载钩子
}
```

### 命令定义

```typescript
interface CommandDefinition {
  description: string;           // 命令描述
  handler: CommandHandler;       // 处理函数
  sudo?: boolean;               // 需要 sudo
  aliases?: string[];           // 别名
  examples?: string[];          // 示例
}
```

### 命令上下文

```typescript
interface CommandContext {
  client: TelegramClient;       // Telegram 客户端
  reply: (text: string) => Promise<void>;     // 回复消息
  replyHTML: (html: string) => Promise<void>; // HTML 回复
  deleteMessage: () => Promise<void>;         // 删除消息
  isSudo: boolean;              // 是否 sudo
  isPrivate: boolean;           // 是否私聊
  isGroup: boolean;             // 是否群组
  isChannel: boolean;           // 是否频道
}
```

## 目录结构

```
nexbot/
├── src/
│   ├── core/           # 核心框架
│   │   ├── pluginManager.ts      # 插件管理
│   │   └── commandHandler.ts     # 命令处理
│   ├── plugins/        # 内置插件
│   │   ├── help.ts               # 帮助系统
│   │   ├── plugin.ts             # 插件管理
│   │   ├── debug.ts              # 调试工具
│   │   ├── exec.ts               # Shell 执行
│   │   └── sysinfo.ts            # 系统信息
│   ├── utils/          # 工具函数
│   │   ├── logger.ts             # 日志
│   │   ├── database.ts           # 数据库
│   │   ├── client.ts             # Telegram 客户端
│   │   ├── context.ts            # 命令上下文
│   │   ├── system.ts             # 系统信息
│   │   └── helpers.ts            # 通用工具
│   ├── types/          # 类型定义
│   │   └── index.ts              # 所有类型
│   ├── cli/            # 命令行工具
│   │   └── pm.ts                 # 插件管理 CLI
│   └── index.ts        # 入口文件
├── plugins/            # 外部插件目录
├── data/               # 数据库目录
├── logs/               # 日志目录
└── docs/               # 文档目录
```

## 依赖关系

```
index.ts
  ├── client.ts
  ├── pluginManager.ts
  │   └── database.ts
  │   └── logger.ts
  ├── commandHandler.ts
  │   ├── pluginManager.ts
  │   ├── context.ts
  │   └── database.ts
  └── logger.ts

plugins/*.ts
  ├── types/index.ts
  ├── utils/context.ts
  ├── utils/database.ts
  └── utils/logger.ts
```

## 性能优化

1. **WAL 模式**: SQLite 使用 WAL 模式提高并发
2. **插件缓存**: 命令映射表缓存，O(1) 查找
3. **懒加载**: 插件按需初始化
4. **异步处理**: 所有 I/O 操作异步

## 安全设计

1. **权限分级**: sudo / 普通用户
2. **命令白名单**: 危险命令拦截
3. **超时保护**: shell 执行超时
4. **输入验证**: 参数类型检查

## 扩展点

1. **新命令**: 在插件中添加 commands
2. **消息监听**: 实现 onMessage
3. **事件处理**: 实现 onEvent
4. **定时任务**: 使用 setInterval/setTimeout
5. **新数据库表**: 在 database.ts 添加

## 代码统计

```
核心代码: ~1000 行
├── core: 312 行
├── utils: 658 行
├── types: 114 行
└── index: 54 行

内置插件: ~600 行
├── help: 78 行
├── plugin: 95 行
├── debug: 82 行
├── sudo: 89 行
├── exec: 118 行
└── sysinfo: 73 行

总计: ~1600 行（含注释和空行）
```

---

**保持简单，保持快速。**
