/**
 * IP 查询插件 - 改编自 TeleBox ip
 * 功能：查询 IP 地址或域名的详细信息
 */

import { Plugin } from "../src/types/index.js";
import axios from "axios";

// 应用Emoji
const EMOJI = {
  IP: "📍",
  WORLD: "🌍",
  LOCATION: "📍",
  ISP: "🏢",
  ORG: "🏦",
  AS: "🔢",
  TIME: "⏰",
  PROXY: "🥷",
  HOSTING: "☁️",
  SEARCH: "🔍",
  ERROR: "❌",
  HELP: "❓",
  LINK: "🔗",
};

// HTML转义
function htmlEscape(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// IP信息接口
interface IpInfoResponse {
  status: string;
  message?: string;
  country?: string;
  regionName?: string;
  city?: string;
  isp?: string;
  org?: string;
  as?: string;
  query?: string;
  timezone?: string;
  proxy?: boolean;
  hosting?: boolean;
}

async function getIpInfo(query: string): Promise<IpInfoResponse> {
  if (!query || query.trim() === "") {
    return {
      status: "fail",
      message: "请提供有效的IP地址或域名",
    };
  }

  const cleanQuery = query.trim();
  const apiUrl = `http://ip-api.com/json/${encodeURIComponent(
    cleanQuery
  )}?lang=zh-CN&fields=status,message,country,regionName,city,isp,org,as,query,timezone,proxy,hosting`;

  try {
    const response = await axios.get<IpInfoResponse>(apiUrl, {
      timeout: 15000,
      headers: {
        "User-Agent": "NexBot-IP-Plugin/1.0",
      },
    });

    if (response.status === 200) {
      const data = response.data;
      if (data.status === "fail") {
        return {
          status: "fail",
          message: data.message || "查询失败，请检查IP地址或域名是否正确",
        };
      }
      return data;
    }

    return {
      status: "fail",
      message: `API请求失败，HTTP状态码: ${response.status}`,
    };
  } catch (error: any) {
    console.error("IP API request failed:", error);

    let errorMessage = "网络请求失败";
    const errorStr = String(error.message || error);

    if (errorStr.includes("timeout") || errorStr.includes("TIMEOUT")) {
      errorMessage = "请求超时，请稍后重试";
    } else if (errorStr.includes("ENOTFOUND") || errorStr.includes("getaddrinfo")) {
      errorMessage = "DNS解析失败，请检查网络连接";
    } else if (errorStr.includes("ECONNREFUSED")) {
      errorMessage = "连接被拒绝，请稍后重试";
    }

    return {
      status: "fail",
      message: errorMessage,
    };
  }
}

const ipPlugin: Plugin = {
  name: "ip",
  version: "1.0.0",
  description: "查询 IP 地址或域名信息",
  author: "TeleBox adapted for NexBot",

  commands: {
    ip: {
      description: "查询 IP/域名信息",
      aliases: ["ipinfo", "iplookup"],
      examples: ["ip 8.8.8.8", "ip google.com", "ip"],
      handler: async (msg, args, ctx) => {
        try {
          let query = args.join(" ");

          // 如果没有参数，显示帮助
          if (!query) {
            await ctx.editHTML(
              `${EMOJI.IP} <b>IP查询插件</b>\n\n` +
              `<b>使用方法：</b>\n` +
              `• <code>.ip &lt;IP地址&gt;</code>\n` +
              `• <code>.ip &lt;域名&gt;</code>\n\n` +
              `<b>示例：</b>\n` +
              `• <code>.ip 8.8.8.8</code>\n` +
              `• <code>.ip google.com</code>\n` +
              `• <code>.ip 2001:4860:4860::8888</code>`
            );
            return;
          }

          const data = await getIpInfo(query);

          if (data.status === "fail") {
            await ctx.deleteMessage();
            await ctx.replyHTML(
              `${EMOJI.ERROR} <b>查询失败</b>\n\n` +
              `<b>查询目标:</b> <code>${htmlEscape(query)}</code>\n` +
              `<b>失败原因:</b> ${htmlEscape(data.message || "未知错误")}\n\n` +
              `<b>💡 建议:</b>\n` +
              `• 检查IP地址或域名格式\n` +
              `• 稍后重试查询`
            );
            return;
          }

          // 构建结果
          const country = data.country || "N/A";
          const region = data.regionName || "N/A";
          const city = data.city || "N/A";
          const isp = data.isp || "N/A";
          const org = data.org || "N/A";
          const asInfo = data.as || "N/A";
          const ipAddress = data.query || "N/A";

          let resultText = `${EMOJI.WORLD} <b>IP/域名查询结果</b>\n\n`;
          
          if (data.proxy) {
            resultText += `${EMOJI.PROXY} 此 IP 可能为代理 IP\n`;
          }
          if (data.hosting) {
            resultText += `${EMOJI.HOSTING} 此 IP 可能为数据中心 IP\n`;
          }
          if (data.proxy || data.hosting) {
            resultText += "\n";
          }

          resultText += `<b>${EMOJI.SEARCH} 查询目标:</b> <code>${htmlEscape(ipAddress)}</code>\n`;
          resultText += `<b>${EMOJI.LOCATION} 地理位置:</b> ${htmlEscape(country)} - ${htmlEscape(region)} - ${htmlEscape(city)}\n`;
          resultText += `<b>${EMOJI.ISP} ISP:</b> ${htmlEscape(isp)}\n`;
          resultText += `<b>${EMOJI.ORG} 组织:</b> ${htmlEscape(org)}\n`;
          resultText += `<b>${EMOJI.AS} AS号:</b> <code>${htmlEscape(asInfo)}</code>`;

          if (data.timezone) {
            resultText += `\n<b>${EMOJI.TIME} 时区:</b> ${htmlEscape(data.timezone)}`;
          }

          // 添加 BGP 查询链接
          const asMatch = asInfo.match(/^AS(\d+)/);
          if (asMatch) {
            const asNum = asMatch[1];
            resultText += `\n\n${EMOJI.LINK} <a href="https://bgp.he.net/AS${asNum}">查看 AS${asNum} 详情</a>`;
          }

          await ctx.deleteMessage();
          await ctx.editHTML(resultText);

        } catch (error: any) {
          console.error("IP lookup error:", error);
          await ctx.editHTML(`${EMOJI.ERROR} <b>IP查询失败</b>\n\n${error.message || "未知错误"}`);
        }
      },
    },
  },
};

export default ipPlugin;
