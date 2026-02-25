#!/bin/bash
# 同步本地修复到 GitHub（自动递增版本号）

cd /root/my-telegram-bot

# 检查是否有更改
if git diff --quiet && git diff --cached --quiet; then
    echo "✅ 没有需要同步的更改"
    exit 0
fi

echo "📦 发现本地更改，开始同步到 GitHub..."

# 自动递增 patch 版本号
node bump-version.js patch

# 添加所有更改（包括版本号更新）
git add .

# 提交更改
read -p "请输入提交信息: " msg
git commit -m "$msg"

# 推送到 GitHub
git push origin main

echo "✅ 同步完成！版本已自动递增。"
