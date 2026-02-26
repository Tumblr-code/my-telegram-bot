/**
 * 网速测试插件
 */

import { Plugin } from "../src/types/index.js";
import axios from "axios";

const EMOJI = {
  ROCKET: "🚀", PING: "📶", DOWNLOAD: "⬇️", TIME: "⏱️",
  LOADING: "🔄", ERROR: "❌", SUCCESS: "✅",
  FIRE: "🔥", SNAIL: "🐌", TURTLE: "🐢", RABBIT: "🐰", CHEETAH: "🐆",
};

const SPEED_TEST_URLS = [
  { url: "https://speed.cloudflare.com/__down?bytes=25000000", name: "Cloudflare" },
  { url: "https://speed.hetzner.de/10MB.bin", name: "Hetzner" },
];

async function testDownloadSpeed(): Promise<{ speed: number; time: number; server: string } | null> {
  for (const server of SPEED_TEST_URLS) {
    try {
      const startTime = Date.now();
      const response = await axios.get(server.url, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      const duration = (Date.now() - startTime) / 1000;
      const speedMbps = (response.data.byteLength * 8) / (duration * 1024 * 1024);
      return { speed: Math.round(speedMbps * 100) / 100, time: duration, server: server.name };
    } catch {}
  }
  return null;
}

async function testPing(): Promise<{ avg: number } | null> {
  const results: number[] = [];
  for (const url of ["https://www.google.com", "https://www.cloudflare.com", "https://www.baidu.com"]) {
    try {
      const start = Date.now();
      await axios.head(url, { timeout: 5000 });
      results.push(Date.now() - start);
    } catch {}
  }
  return results.length > 0 ? { avg: Math.round(results.reduce((a, b) => a + b, 0) / results.length) } : null;
}

function getPingRating(ping: number): string {
  if (ping <= 50) return "极佳";
  if (ping <= 100) return "良好";
  if (ping <= 200) return "一般";
  return "较差";
}

function getSpeedRating(speed: number) {
  if (speed >= 100) return { icon: EMOJI.CHEETAH, text: "极速" };
  if (speed >= 50) return { icon: EMOJI.RABBIT, text: "很快" };
  if (speed >= 20) return { icon: EMOJI.FIRE, text: "良好" };
  if (speed >= 10) return { icon: EMOJI.TURTLE, text: "一般" };
  return { icon: EMOJI.SNAIL, text: "较慢" };
}

function getSpeedTips(speed: number): string {
  if (speed >= 100) return `✓ 可流畅观看 4K 视频\n✓ 可进行大型游戏下载\n✓ 支持多设备同时高速上网`;
  if (speed >= 50) return `✓ 可流畅观看 4K 视频\n✓ 可进行高清视频通话\n✓ 下载速度良好`;
  if (speed >= 20) return `✓ 可流畅观看 1080P 视频\n✓ 可进行视频通话\n✓ 日常使用无压力`;
  if (speed >= 10) return `✓ 可观看 720P 视频\n△ 高清视频可能需要缓冲\n△ 大型文件下载较慢`;
  return `△ 仅适合文字聊天和网页浏览\n△ 视频观看可能卡顿\n💡 建议检查网络连接`;
}

function generateBar(value: number, max: number, length: number = 10) {
  const filled = Math.min(Math.round((value / max) * length), length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

const speedtestPlugin: Plugin = {
  name: "speedtest",
  version: "1.0.0",
  description: "网速测试",
  author: "NexBot",

  commands: {
    speedtest: {
      description: "测试服务器网络速度（延迟和下载速度）",
      aliases: ["st", "speed", "测速"],
      examples: ["speedtest", "st"],

      handler: async (msg: any, args, ctx) => {
        try {
          // 第一步：显示测试延迟中
          await msg.edit({
            text: `${EMOJI.ROCKET} <b>网速测试</b>\n\n${EMOJI.LOADING} <b>正在测试网络延迟...</b>\n${EMOJI.PING} ping Google / Cloudflare / Baidu`,
            parseMode: "html",
          });

          const pingResult = await testPing();

          // 第二步：显示测试下载速度中
          await msg.edit({
            text: `${EMOJI.ROCKET} <b>网速测试</b>\n\n${EMOJI.SUCCESS} 延迟测试完成\n${EMOJI.LOADING} <b>正在测试下载速度...</b>\n${EMOJI.DOWNLOAD} 下载测试文件中`,
            parseMode: "html",
          });

          const downloadResult = await testDownloadSpeed();

          // 第三步：显示结果
          let text = `${EMOJI.ROCKET} <b>网速测试结果</b>\n\n`;
          
          if (pingResult) {
            const pingRating = getPingRating(pingResult.avg);
            text += `${EMOJI.PING} <b>网络延迟</b>\n`;
            // 以1000ms为最大值，延迟越低填充越多
            const pingBarValue = Math.max(1000 - pingResult.avg, 0);
            text += `${generateBar(pingBarValue, 1000)} ${pingResult.avg}ms\n`;
            text += `📊 ${pingRating} · 平均: ${pingResult.avg}ms\n\n`;
          } else {
            text += `${EMOJI.PING} <b>网络延迟</b>\n测试失败\n\n`;
          }

          if (downloadResult) {
            const rating = getSpeedRating(downloadResult.speed);
            text += `${EMOJI.DOWNLOAD} <b>下载速度</b>\n`;
            text += `${generateBar(downloadResult.speed, 200)}\n`;
            text += `${rating.icon} ${downloadResult.speed} Mbps · ${rating.text}\n`;
            text += `${EMOJI.TIME} 测试耗时: ${downloadResult.time.toFixed(2)}s\n`;
            text += `📡 测速节点: ${downloadResult.server}\n\n`;
            
            text += `<b>💡 使用建议:</b>\n`;
            text += getSpeedTips(downloadResult.speed);
          } else {
            text += `${EMOJI.DOWNLOAD} <b>下载速度</b>\n${EMOJI.ERROR} 测试失败`;
          }

          text += `\n\n<i>⏰ ${new Date().toLocaleString("zh-CN")}</i>`;

          await msg.edit({ text, parseMode: "html" });
        } catch (err) {
          await msg.edit({
            text: `${EMOJI.ERROR} <b>测试失败</b>\n\n${err instanceof Error ? err.message : "未知错误"}`,
            parseMode: "html",
          });
        }
      },
    },
  },
};

export default speedtestPlugin;
