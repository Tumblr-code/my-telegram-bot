/**
 * 网速测试插件 - 参考 TeleBox 风格美化
 * 功能：测试网络延迟和下载速度
 */

import { Plugin } from "../src/types/index.js";
import axios from "axios";

// 应用Emoji
const EMOJI = {
  ROCKET: "🚀",
  PING: "📶",
  DOWNLOAD: "⬇️",
  TIME: "⏱️",
  LOADING: "🔄",
  ERROR: "❌",
  SUCCESS: "✅",
  CHART: "📊",
  FIRE: "🔥",
  SNAIL: "🐌",
  TURTLE: "🐢",
  RABBIT: "🐰",
  CHEETAH: "🐆",
  SPEED: "⚡",
};

// 测速服务器列表
const SPEED_TEST_URLS = [
  { url: "https://speed.cloudflare.com/__down?bytes=25000000", size: 25, name: "Cloudflare" },  // 25MB
  { url: "https://speed.hetzner.de/10MB.bin", size: 10, name: "Hetzner" },                    // 10MB
  { url: "https://filesamples.com/samples/document/txt/sample1.txt", size: 0.001, name: "Backup" }, // 小文件备用
];

// 测试下载速度
async function testDownloadSpeed(): Promise<{ speed: number; time: number; server: string } | null> {
  for (const server of SPEED_TEST_URLS) {
    try {
      const startTime = Date.now();
      const response = await axios.get(server.url, {
        responseType: "arraybuffer",
        timeout: 30000,
        maxRedirects: 5,
      });
      const endTime = Date.now();

      const bytes = response.data.byteLength;
      const duration = (endTime - startTime) / 1000; // 秒
      const speedMbps = (bytes * 8) / (duration * 1024 * 1024); // Mbps

      return { 
        speed: Math.round(speedMbps * 100) / 100, 
        time: duration,
        server: server.name
      };
    } catch (e) {
      continue;
    }
  }
  return null;
}

// 测试延迟
async function testPing(): Promise<{ avg: number; results: number[] } | null> {
  const pingUrls = [
    "https://www.google.com",
    "https://www.cloudflare.com",
    "https://www.baidu.com",
  ];

  const results: number[] = [];

  for (const url of pingUrls) {
    try {
      const start = Date.now();
      await axios.head(url, { timeout: 5000 });
      const ping = Date.now() - start;
      results.push(ping);
    } catch {
      // 忽略错误
    }
  }

  if (results.length === 0) return null;
  
  const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
  return { avg, results };
}

// 获取速度评级和图标
function getSpeedRating(speed: number): { icon: string; text: string; color: string } {
  if (speed >= 100) return { icon: EMOJI.CHEETAH, text: "极速", color: "🟢" };
  if (speed >= 50) return { icon: EMOJI.RABBIT, text: "很快", color: "🟢" };
  if (speed >= 20) return { icon: EMOJI.FIRE, text: "良好", color: "🟡" };
  if (speed >= 10) return { icon: EMOJI.TURTLE, text: "一般", color: "🟠" };
  return { icon: EMOJI.SNAIL, text: "较慢", color: "🔴" };
}

// 获取延迟评级
function getPingRating(ping: number): { text: string; color: string } {
  if (ping <= 50) return { text: "极佳", color: "🟢" };
  if (ping <= 100) return { text: "良好", color: "🟡" };
  if (ping <= 200) return { text: "一般", color: "🟠" };
  return { text: "较差", color: "🔴" };
}

// 生成进度条
function generateBar(value: number, max: number, length: number = 10): string {
  const filled = Math.min(Math.round((value / max) * length), length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
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

      handler: async (msg, args, ctx) => {
        try {
          // 测试延迟
          const pingResult = await testPing();

          // 测试下载速度
          const downloadResult = await testDownloadSpeed();

          // 构建美观的结果
          let text = `${EMOJI.ROCKET} <b>网速测试结果</b>\n\n`;
          
          // 延迟部分
          if (pingResult !== null) {
            const pingRating = getPingRating(pingResult.avg);
            const pingBar = generateBar(Math.max(300 - pingResult.avg, 0), 300, 8);
            text += `${EMOJI.PING} <b>网络延迟</b>\n`;
            text += `${pingBar} ${pingResult.avg}ms\n`;
            text += `${pingRating.color} ${pingRating.text} · 平均: ${pingResult.avg}ms\n\n`;
          } else {
            text += `${EMOJI.PING} <b>网络延迟</b>\n`;
            text += `${EMOJI.ERROR} 测试失败\n\n`;
          }

          // 下载速度部分
          if (downloadResult !== null) {
            const speedRating = getSpeedRating(downloadResult.speed);
            const speedBar = generateBar(downloadResult.speed, 200, 10);
            
            text += `${EMOJI.DOWNLOAD} <b>下载速度</b>\n`;
            text += `${speedBar}\n`;
            text += `${speedRating.icon} ${downloadResult.speed} Mbps · ${speedRating.text}\n`;
            text += `${EMOJI.TIME} 测试耗时: ${(Math.round(downloadResult.time * 100) / 100)}s\n`;
            text += `📡 测速节点: ${downloadResult.server}\n\n`;
            
            // 使用建议
            text += `<b>💡 使用建议:</b>\n`;
            if (downloadResult.speed >= 100) {
              text += `✓ 可流畅观看 4K 视频\n✓ 可进行大型游戏下载\n✓ 支持多设备同时高速上网`;
            } else if (downloadResult.speed >= 50) {
              text += `✓ 可流畅观看 4K 视频\n✓ 可进行高清视频通话\n✓ 下载速度良好`;
            } else if (downloadResult.speed >= 20) {
              text += `✓ 可流畅观看 1080P 视频\n✓ 可进行视频通话\n✓ 日常使用无压力`;
            } else if (downloadResult.speed >= 10) {
              text += `✓ 可观看 720P 视频\n△ 高清视频可能需要缓冲\n△ 大型文件下载较慢`;
            } else {
              text += `△ 仅适合文字聊天和网页浏览\n△ 视频观看可能卡顿\n💡 建议检查网络连接`;
            }
          } else {
            text += `${EMOJI.DOWNLOAD} <b>下载速度</b>\n`;
            text += `${EMOJI.ERROR} 测试失败\n`;
            text += `请检查网络连接后重试`;
          }

          text += `\n\n<i>⏰ 测试时间: ${new Date().toLocaleString("zh-CN")}</i>`;

          await ctx.editHTML(text);
        } catch (err) {
          console.error("[speedtest] 错误:", err);
          await ctx.editHTML(`${EMOJI.ERROR} <b>测试失败</b>\n\n${err instanceof Error ? err.message : "未知错误"}`);
        }
      },
    },
  },
};

export default speedtestPlugin;
