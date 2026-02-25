# 📥 安装指南

## 系统要求

- **操作系统**: Linux, macOS, Windows (WSL2)
- **Bun**: >= 1.2.0
- **内存**: >= 256MB
- **磁盘**: >= 100MB

## 安装步骤

### 1. 安装 Bun

**Linux/macOS:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

验证安装:
```bash
bun --version
```

### 2. 获取 NexBot

**方式一: 克隆仓库**
```bash
git clone https://github.com/Tumblr-code/NexBot.git
cd NexBot
```

**方式二: 下载压缩包**
```bash
wget https://github.com/Tumblr-code/NexBot/archive/main.zip
unzip main.zip
cd NexBot-main
```

### 3. 安装依赖

```bash
bun install
```

### 4. 配置 Telegram API

1. 访问 [my.telegram.org/apps](https://my.telegram.org/apps)
2. 登录你的 Telegram 账号
3. 点击 "API development tools"
4. 创建新应用，填写:
   - App title: NexBot
   - Short name: nexbot
   - URL: (可选)
   - Platform: Desktop
   - Description: NexBot Telegram Bot Framework
5. 记录 `api_id` 和 `api_hash`

### 5. 配置环境变量

```bash
cp .env.example .env
nano .env  # 或使用你喜欢的编辑器
```

编辑 `.env` 文件:

```env
# 必填
TELEGRAM_API_ID=你的_api_id
TELEGRAM_API_HASH=你的_api_hash

# 可选
BOT_NAME=NexBot
SUDO_USERS=你的用户ID
CMD_PREFIX=.
LOG_LEVEL=info
```

获取你的 Telegram 用户 ID:
- 私聊 [@userinfobot](https://t.me/userinfobot)
- 或启动 NexBot 后使用 `.id` 命令

### 6. 首次启动

```bash
bun start
```

按照提示完成登录:
1. 输入手机号 (格式: +86138xxxxxxxx)
2. 输入收到的验证码
3. 如有两步验证，输入密码

登录成功后，会显示 session 字符串，建议保存到 `.env` 文件:

```env
TELEGRAM_SESSION=你的_session_字符串
```

### 7. 后台运行 (可选)

使用 PM2:
```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start bun --name nexbot -- run src/index.ts

# 查看状态
pm2 status

# 查看日志
pm2 logs nexbot

# 重启
pm2 restart nexbot

# 停止
pm2 stop nexbot
```

使用 Systemd:
```bash
# 创建服务文件
sudo nano /etc/systemd/system/nexbot.service
```

内容:
```ini
[Unit]
Description=NexBot Telegram Bot
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/nexbot
ExecStart=/usr/local/bin/bun run src/index.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务:
```bash
sudo systemctl daemon-reload
sudo systemctl enable nexbot
sudo systemctl start nexbot
sudo systemctl status nexbot
```

## 更新

```bash
# 进入项目目录
cd nexbot

# 拉取更新
git pull

# 更新依赖
bun install

# 重启服务
pm2 restart nexbot
```

## 卸载

```bash
# 停止服务
pm2 stop nexbot
pm2 delete nexbot

# 删除目录
cd ..
rm -rf nexbot

# 删除数据 (可选)
rm -rf ~/.local/share/nexbot
```

## 故障排除

### 登录失败

**问题**: 提示 `API_ID_INVALID`  
**解决**: 检查 `.env` 中的 API ID 和 API Hash 是否正确

**问题**: 收不到验证码  
**解决**: 
- 检查手机号格式（需要 + 和国家码）
- 检查 Telegram 官方客户端是否收到验证码
- 尝试使用其他方式登录

### 启动失败

**问题**: `Error: Cannot find module`  
**解决**: 运行 `bun install` 重新安装依赖

**问题**: `EACCES: permission denied`  
**解决**: 检查目录权限，或使用 `sudo`

### 运行时错误

**问题**: 命令无响应  
**解决**: 
- 检查日志 `logs/nexbot-*.log`
- 确认命令前缀正确
- 检查是否有 sudo 权限

**问题**: 插件加载失败  
**解决**: 
- 检查插件语法
- 查看错误日志
- 尝试重载插件: `.plugin reload <name>`

## 获取帮助

- GitHub Issues: [github.com/Tumblr-code/NexBot/issues](https://github.com/Tumblr-code/NexBot/issues)
