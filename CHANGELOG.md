# 更新日志

所有项目的显著变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.1] - 2026-02-25

### Fixed

- **context.ts**: 修复 `replyHTML` 方法 `this` 指向错误，改为直接使用 `client.sendMessage`
- **cli/pm.ts**: 修复 ESM 模块中使用 `require()` 的问题，改用 ES 模块导入
- **rateLimiter.ts**: 修复限流计数逻辑边界问题，增加计数后再次检查是否超限
- **pluginManager.ts**: 为内置插件导入添加时间戳避免缓存问题
- **pluginBase.ts**: 修复 ESM 模块中使用 `require()` 的问题
- **help.ts, sudo.ts, plugin.ts**: 修复 HTML `blockquote` 标签格式（移除不正确的 `expandable` 属性）
- **client.ts**: 为 `askQuestion` 方法添加错误处理和清理逻辑
- **plugins/ai.ts, privateguard.ts**: 同样修复 `blockquote` 标签格式

### Security

- 增强错误处理，防止 stdin 事件监听器泄漏
- 改进限流器，防止边界条件下的滥用

## [1.0.0] - 2024-02-23

### 🎉 初始发布

NexBot 第一个正式版本发布！

### ✨ 核心功能

- **极速启动** - 基于 Bun 运行时，启动速度提升 10 倍
- **极简架构** - 核心代码仅 1000 行
- **插件系统** - 热重载、自动加载、别名支持
- **权限管理** - sudo 分级权限控制
- **内置数据库** - Bun SQLite，零配置
- **完整类型** - TypeScript 100% 覆盖

### 🔌 内置插件

- `help` - 帮助系统和命令列表
- `plugin` - 插件管理器
- `debug` - 调试工具（id, echo, ping, msg）
- `sudo` - 权限管理
- `exec` - 安全的 Shell 执行
- `sysinfo` - 系统信息监控

### 🔧 扩展插件

- `weather` - 天气查询
- `ip` - IP 地址查询
- `qr` - 二维码生成
- `hitokoto` - 一言
- `moyu` - 摸鱼日报
- `calc` - 科学计算器
- `httpcat` - HTTP 状态猫
- `sticker2pic` - 表情转图片
- `whois` - 域名 WHOIS 查询
- `speedtest` - 网速测试
- `tts` - 文字转语音

### 🛠️ 开发工具

- `bun pm create` - 创建插件模板
- `bun pm list` - 列出已安装插件
- `bun pm remove` - 移除插件

### 📚 文档

- 完整的 README
- 详细的安装指南
- 架构设计文档
- 贡献指南
- API 文档

### 🔒 安全特性

- 危险命令自动拦截
- sudo 权限分级
- Shell 执行可禁用
- 命令超时保护

### ⚡ 性能优化

- SQLite WAL 模式
- 命令映射缓存
- 懒加载插件
- 异步 I/O

---

## 版本说明

### 版本号格式

`主版本号.次版本号.修订号`

- **主版本号**: 不兼容的 API 修改
- **次版本号**: 向下兼容的功能新增
- **修订号**: 向下兼容的问题修正

### 标签说明

- `Added` - 新功能
- `Changed` - 变更
- `Deprecated` - 废弃
- `Removed` - 移除
- `Fixed` - 修复
- `Security` - 安全

---

Made with ❤️ by NexBot Team
