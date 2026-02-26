/**
 * IP 查询插件
 */

import { Plugin } from "../src/types/index.js";
import axios from "axios";

const EMOJI = {
  WORLD: "🌍", LOCATION: "📍", ISP: "🏢", ORG: "🏦",
  AS: "🔢", TIME: "⏰", PROXY: "🥷", HOSTING: "☁️",
  SEARCH: "🔍", ERROR: "❌", LINK: "🔗", LOADING: "🔄",
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function htmlEscape(text: string): string {
  if (typeof text !== "string") return "";
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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
  if (!query?.trim()) {
    return { status: "fail", message: "请提供有效的IP地址或域名" };
  }

  const apiUrl = `http://ip-api.com/json/${encodeURIComponent(query.trim())}?lang=zh-CN&fields=status,message,country,regionName,city,isp,org,as,query,timezone,proxy,hosting`;

  try {
    const response = await axios.get<IpInfoResponse>(apiUrl, {
      timeout: 15000,
      headers: { "User-Agent": "NexBot-IP-Plugin/1.0" },
    });

    if (response.status === 200) {
      const data = response.data;
      if (data.status === "fail") {
        return { status: "fail", message: data.message || "查询失败" };
      }
      return data;
    }

    return { status: "fail", message: `HTTP ${response.status}` };
  } catch (error: any) {
    let errorMessage = "网络请求失败";
    const errorStr = String(error.message || error);
    if (errorStr.includes("timeout")) errorMessage = "请求超时";
    else if (errorStr.includes("ENOTFOUND")) errorMessage = "DNS解析失败";
    else if (errorStr.includes("ECONNREFUSED")) errorMessage = "连接被拒绝";
    return { status: "fail", message: errorMessage };
  }
}

const ipPlugin: Plugin = {
  name: "ip",
  version: "1.0.0",
  description: "查询 IP 地址或域名信息",
  author: "NexBot",

  commands: {
    ip: {
      description: "查询 IP 地址或域名的地理位置、ISP 信息",
      aliases: ["ipinfo", "iplookup", "ip查询"],
      examples: ["ip 8.8.8.8", "ip google.com", "ip 2001:4860::8888"],
      handler: async (msg, args, ctx) => {
        try {
          let query = args.join(" ");

          if (!query) {
            await (msg as any).edit({
              text: `${EMOJI.SEARCH} <b>IP查询</b>\n\n用法: <code>.ip &lt;IP/域名&gt;</code>\n例如: <code>.ip 8.8.8.8</code>`,
              parseMode: "html",
            });
            return;
          }

          // 显示查询中
          await (msg as any).edit({
            text: `${EMOJI.LOADING} <b>正在查询 IP 信息...</b>\n\n${EMOJI.SEARCH} 正在解析: <code>${htmlEscape(query)}</code>\n<i>请稍候...</i>`,
            parseMode: "html",
          });
          
          const startTime = Date.now();
          const data = await getIpInfo(query);
          
          // 确保 loading 至少显示1秒
          const elapsed = Date.now() - startTime;
          if (elapsed < 1000) await sleep(1000 - elapsed);

          if (data.status === "fail") {
            await (msg as any).edit({
              text: `${EMOJI.ERROR} <b>查询失败</b>\n\n目标: <code>${htmlEscape(query)}</code>\n原因: ${htmlEscape(data.message || "未知错误")}`,
              parseMode: "html",
            });
            return;
          }

          let resultText = `${EMOJI.WORLD} <b>IP/域名查询结果</b>\n\n`;
          
          if (data.proxy) resultText += `${EMOJI.PROXY} 可能为代理 IP\n`;
          if (data.hosting) resultText += `${EMOJI.HOSTING} 可能为数据中心 IP\n`;
          if (data.proxy || data.hosting) resultText += "\n";

          resultText += `<b>${EMOJI.SEARCH} 查询目标:</b> <code>${htmlEscape(data.query || "N/A")}</code>\n`;
          resultText += `<b>${EMOJI.LOCATION} 地理位置:</b> ${htmlEscape(data.country || "N/A")} - ${htmlEscape(data.regionName || "N/A")} - ${htmlEscape(data.city || "N/A")}\n`;
          resultText += `<b>${EMOJI.ISP} ISP:</b> ${htmlEscape(data.isp || "N/A")}\n`;
          resultText += `<b>${EMOJI.ORG} 组织:</b> ${htmlEscape(data.org || "N/A")}\n`;
          resultText += `<b>${EMOJI.AS} AS号:</b> <code>${htmlEscape(data.as || "N/A")}</code>`;

          if (data.timezone) {
            resultText += `\n<b>${EMOJI.TIME} 时区:</b> ${htmlEscape(data.timezone)}`;
          }

          const asMatch = data.as?.match(/^AS(\d+)/);
          if (asMatch) {
            resultText += `\n\n${EMOJI.LINK} <a href="https://bgp.he.net/AS${asMatch[1]}">查看 AS${asMatch[1]} 详情</a>`;
          }

          await (msg as any).edit({
            text: resultText,
            parseMode: "html",
          });
        } catch (error: any) {
          await (msg as any).edit({
            text: `${EMOJI.ERROR} <b>查询失败</b>\n\n${error.message || "未知错误"}`,
            parseMode: "html",
          });
        }
      },
    },
  },
};

export default ipPlugin;
