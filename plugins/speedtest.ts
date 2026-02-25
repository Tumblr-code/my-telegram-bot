import { Plugin } from "../src/types/index.js";
import axios from "axios";

// 测速服务器列表
const SPEED_TEST_URLS = [
  "https://speed.cloudflare.com/__down?bytes=25000000",  // 25MB
  "https://speed.hetzner.de/10MB.bin",                    // 10MB
  "https://filesamples.com/samples/document/txt/sample1.txt", // 小文件备用
];

// 测试下载速度
async function testDownloadSpeed(): Promise<{ speed: number; time: number } | null> {
  for (const url of SPEED_TEST_URLS) {
    try {
      const startTime = Date.now();
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
        maxRedirects: 5,
      });
      const endTime = Date.now();

      const bytes = response.data.byteLength;
      const duration = (endTime - startTime) / 1000; // 秒
      const speedMbps = (bytes * 8) / (duration * 1024 * 1024); // Mbps

      return { speed: Math.round(speedMbps * 100) / 100, time: duration };
    } catch (e) {
      continue;
    }
  }
  return null;
}

// 测试延迟
async function testPing(): Promise<number | null> {
  const pingUrls = [
    "https://www.google.com",
    "https://www.cloudflare.com",
    "https://www.baidu.com",
  ];

  let totalPing = 0;
  let successCount = 0;

  for (const url of pingUrls) {
    try {
      const start = Date.now();
      await axios.head(url, { timeout: 5000 });
      const ping = Date.now() - start;
      totalPing += ping;
      successCount++;
    } catch {
      // 忽略错误
    }
  }

  return successCount > 0 ? Math.round(totalPing / successCount) : null;
}

const speedtestPlugin: Plugin = {
  name: "speedtest",
  version: "1.0.0",
  description: "网速测试",
  author: "NexBot",

  commands: {
    speedtest: {
      description: "测试网络速度",
      aliases: ["st", "speed"],
      examples: ["speedtest"],
      sudo: true,
      handler: async (msg, args, ctx) => {
        try {
          // 发送初始消息
          const status = await ctx.client.sendMessage(msg.chatId!, {
            message: "🔄 正在测试网速，请稍候...",
            replyTo: Number(msg.id),
          });

          const statusId = Number(status.id);

          // 测试延迟
          await ctx.client.editMessage(msg.chatId!, {
            message: statusId,
            text: "🔄 正在测试网速，请稍候...\n📶 正在测试延迟...",
          });

          const ping = await testPing();

          // 测试下载速度
          await ctx.client.editMessage(msg.chatId!, {
            message: statusId,
            text: "🔄 正在测试网速，请稍候...\n📶 正在测试延迟...\n⬇️ 正在测试下载速度...",
          });

          const downloadResult = await testDownloadSpeed();

          // 构建结果
          let text = "<b>🚀 网速测试结果</b>\n\n";

          if (ping !== null) {
            text += `📶 延迟: ${ping} ms\n`;
          } else {
            text += `📶 延迟: 测试失败\n`;
          }

          if (downloadResult !== null) {
            text += `⬇️ 下载: ${downloadResult.speed} Mbps\n`;
            text += `⏱️ 耗时: ${Math.round(downloadResult.time * 100) / 100}s\n`;
          } else {
            text += `⬇️ 下载: 测试失败\n`;
          }

          text += `\n<i>测试时间: ${new Date().toLocaleString()}</i>`;

          await ctx.client.editMessage(msg.chatId!, {
            message: statusId,
            text,
            parseMode: "html",
          });
        } catch (err) {
          console.error("[speedtest] 错误:", err);
          await ctx.reply(`❌ 测试失败: ${err instanceof Error ? err.message : "未知错误"}`);
        }
      },
    },
  },
};

export default speedtestPlugin;
