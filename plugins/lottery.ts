/**
 * 自动抽奖插件
 * 监听指定群组的抽奖消息并自动参与
 */

import { Plugin } from "../src/types/index.js";
import { Api } from "telegram";
import { db } from "../src/utils/database.js";
import { fmt, escapeHTML } from "../src/utils/context.js";

// Emoji 定义
const EMOJI = {
  LOTTERY: "🎰",
  WIN: "🎉",
  LOST: "😢",
  WAIT: "⏳",
  PRIZE: "🎁",
  KEY: "🔑",
  TIME: "📅",
  STATS: "📊",
  CONFIG: "⚙️",
  NOTIFY: "🔔",
  GROUP: "📱",
  BOT: "🤖",
  DELAY: "⏱️",
  AUTO: "🎮",
  ARROW: "→",
  INFO: "ℹ️",
  SUCCESS: "✅",
  ERROR: "❌",
};

// 默认配置
const DEFAULT_CONFIG = {
  TARGET_GROUP_ID: "",
  LOTTERY_BOT_ID: "",
  NOTIFY_USER_ID: "",
  JOIN_DELAY_MIN: 1000,
  JOIN_DELAY_MAX: 5000,
  AUTO_JOIN: true,
  NOTIFY_ON_WIN: true,
  EXTRACT_MODE: "smart",
};

let CONFIG = { ...DEFAULT_CONFIG };

// 数据库操作（与之前相同，略...）
const initLotteryTable = () => {
  try {
    const database = (db as any).getDB();
    database.run(`
      CREATE TABLE IF NOT EXISTS lottery_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        keyword TEXT NOT NULL,
        prize TEXT,
        status TEXT DEFAULT 'joined',
        joined_at INTEGER DEFAULT (unixepoch()),
        ended_at INTEGER,
        result TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);
    database.run(`
      CREATE TABLE IF NOT EXISTS lottery_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_msg_id INTEGER,
        result_msg_id INTEGER NOT NULL,
        is_winner INTEGER DEFAULT 0,
        prize TEXT,
        processed_at INTEGER DEFAULT (unixepoch())
      )
    `);
    database.run(`CREATE INDEX IF NOT EXISTS idx_lottery_status ON lottery_records(status)`);
    database.run(`CREATE INDEX IF NOT EXISTS idx_lottery_msg_id ON lottery_records(message_id)`);
    database.run(`CREATE INDEX IF NOT EXISTS idx_lottery_results_msg ON lottery_results(result_msg_id)`);
  } catch (error) {
    console.error("[lottery] 数据库初始化失败:", error);
  }
};

const loadConfig = () => {
  try {
    const saved = db.get<typeof DEFAULT_CONFIG>("lottery_config");
    if (saved) CONFIG = { ...DEFAULT_CONFIG, ...saved };
  } catch (error) {}
};

const saveConfig = () => db.set("lottery_config", CONFIG);

// 记录操作函数
const addLotteryRecord = (record: any): number | null => {
  try {
    const database = (db as any).getDB();
    const result = database.run(
      `INSERT INTO lottery_records (message_id, keyword, prize, status, joined_at) VALUES (?, ?, ?, ?, ?)`,
      [record.messageId, record.keyword, record.prize || "", record.status, record.joinedAt]
    );
    return result.lastInsertRowid as number;
  } catch (error) { return null; }
};

const findRecordByKeyword = (keyword: string): any | null => {
  try {
    const database = (db as any).getDB();
    return database.query(
      `SELECT * FROM lottery_records WHERE keyword = ? AND status = 'joined' ORDER BY joined_at DESC LIMIT 1`
    ).get(keyword) as any | null;
  } catch (error) { return null; }
};

const updateLotteryResult = (id: number, result: string, status: string): void => {
  try {
    const database = (db as any).getDB();
    database.run(
      `UPDATE lottery_records SET status = ?, result = ?, ended_at = ? WHERE id = ?`,
      [status, result, Math.floor(Date.now() / 1000), id]
    );
  } catch (error) {}
};

const isAlreadyJoined = (messageId: number): boolean => {
  try {
    const database = (db as any).getDB();
    return !!database.query(`SELECT id FROM lottery_records WHERE message_id = ?`).get(messageId);
  } catch (error) { return false; }
};

const getAllRecords = (limit: number = 50): any[] => {
  try {
    const database = (db as any).getDB();
    return database.query(`SELECT * FROM lottery_records ORDER BY joined_at DESC LIMIT ?`).all(limit) as any[];
  } catch (error) { return []; }
};

const getStats = () => {
  try {
    const database = (db as any).getDB();
    const total = database.query(`SELECT COUNT(*) as count FROM lottery_records`).get() as { count: number };
    const joined = database.query(`SELECT COUNT(*) as count FROM lottery_records WHERE status = 'joined'`).get() as { count: number };
    const won = database.query(`SELECT COUNT(*) as count FROM lottery_records WHERE status = 'won'`).get() as { count: number };
    const lost = database.query(`SELECT COUNT(*) as count FROM lottery_records WHERE status = 'lost'`).get() as { count: number };
    return { total: total?.count || 0, joined: joined?.count || 0, won: won?.count || 0, lost: lost?.count || 0 };
  } catch (error) { return { total: 0, joined: 0, won: 0, lost: 0 }; }
};

const isResultProcessed = (resultMsgId: number): boolean => {
  try {
    const database = (db as any).getDB();
    return !!database.query(`SELECT id FROM lottery_results WHERE result_msg_id = ?`).get(resultMsgId);
  } catch (error) { return false; }
};

const addProcessedResult = (resultMsgId: number, isWinner: boolean, prize?: string, originalMsgId?: number): void => {
  try {
    const database = (db as any).getDB();
    database.run(
      `INSERT INTO lottery_results (result_msg_id, is_winner, prize, original_msg_id) VALUES (?, ?, ?, ?)`,
      [resultMsgId, isWinner ? 1 : 0, prize || "", originalMsgId || null]
    );
  } catch (error) {}
};

// 提取关键词
const extractKeyword = (msg: Api.Message): string | null => {
  const anyMsg = msg as any;
  const text = anyMsg.message || anyMsg.text || "";
  
  if (anyMsg.entities && Array.isArray(anyMsg.entities)) {
    for (const entity of anyMsg.entities) {
      if (entity.className === "MessageEntityCode" || entity.className === "MessageEntityPre") {
        const start = entity.offset || 0;
        const length = entity.length || 0;
        const keyword = text.substring(start, start + length).trim();
        if (keyword && keyword.length > 1 && keyword.length < 50) return keyword;
      }
    }
  }
  
  if (anyMsg.replyMarkup && anyMsg.replyMarkup.rows) {
    for (const row of anyMsg.replyMarkup.rows) {
      for (const button of row.buttons || []) {
        if (button.text && button.text.length < 50) return button.text.trim();
      }
    }
  }
  
  const match1 = text.match(/回复\s*[`"']?([^`"'\n]+)[`"']?\s*参与/i);
  if (match1) return match1[1].trim();
  
  const match2 = text.match(/关键词[：:]\s*[`"']?([^`"'\n]+)[`"']?/i);
  if (match2) return match2[1].trim();
  
  const match3 = text.match(/口令[：:]\s*[`"']?([^`"'\n]+)[`"']?/i);
  if (match3) return match3[1].trim();
  
  const match4 = text.match(/[`"']([^`"'\n]{2,20})[`"']/);
  if (match4) return match4[1].trim();
  
  // 新格式：参与关键词：「xxx」 或 『xxx』
  const match5 = text.match(/参与关键词[：:]\s*[「『]([^」』\n]+)[」』]/);
  if (match5) return match5[1].trim();
  
  // 新格式：关键词：「xxx」 或 『xxx』
  const match6 = text.match(/关键词[：:]\s*[「『]([^」』\n]+)[」』]/);
  if (match6) return match6[1].trim();
  
  // 通用中文引号格式：「xxx」 或 『xxx』
  const match7 = text.match(/[「『]([^」』\n]{2,20})[」』]/);
  if (match7) return match7[1].trim();
  
  return null;
};

const extractPrize = (text: string): string => {
  const patterns = [
    /奖品[：:]\s*([^\n]+)/i,
    /奖励[：:]\s*([^\n]+)/i,
    /\*\*([^\n]+?)\*\*/,
    /(\d+\s*(?:USDT|BTC|ETH|代币|红包|现金))/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return "未知奖品";
};

const checkLotteryResult = (text: string): any => {
  const resultPatterns = [/开奖.*结果/i, /中奖.*名单/i, /恭喜.*中奖/i, /抽奖.*结束/i, /获奖/i];
  for (const pattern of resultPatterns) {
    if (pattern.test(text)) {
      const isWinner = /恭喜|中奖|获得者|Winner/i.test(text) && !(/未中奖|没有中奖|谢谢参与/i.test(text));
      const winnerMatch = text.match(/(?:恭喜|中奖者|获得者)[：:\s@]*([^\n\s,，]+)/i);
      const prizeMatch = text.match(/(?:奖品|奖励|获得)[：:\s]*([^\n]+)/i);
      const keywordMatch = text.match(/(?:关键词|口令)[：:\s]*([^\n\s]+)/i);
      return { isResult: true, isWinner, winnerName: winnerMatch?.[1], prize: prizeMatch?.[1]?.trim(), keyword: keywordMatch?.[1] };
    }
  }
  return { isResult: false };
};

const sendWinNotification = async (client: any, record: any): Promise<void> => {
  if (!CONFIG.NOTIFY_ON_WIN) return;
  try {
    let target: any;
    if (CONFIG.NOTIFY_USER_ID) {
      target = BigInt(CONFIG.NOTIFY_USER_ID);
    } else {
      // 默认发送给自己（收藏夹）
      target = "me";
    }
    const text = `🎉 <b>中奖通知</b>\n\n恭喜您在抽奖中中奖！\n\n🎁 奖品: ${record.prize}\n🔑 关键词: <code>${record.keyword}</code>\n📅 参与时间: ${formatTime(record.joinedAt)}\n\n请及时领取您的奖品！`;
    await client.sendMessage(target, { message: text, parseMode: "html" });
  } catch (error) {}
};

const formatTime = (timestamp: number): string => new Date(timestamp * 1000).toLocaleString("zh-CN");

// 点击复制命令生成器
const copyCmd = (cmd: string, prefix: string = ".") => `<a href="tg://copy?text=${encodeURIComponent(prefix + cmd)}">${fmt.code(prefix + cmd)}</a>`;

// 消息处理器
const messageHandler = async (msg: Api.Message, client: any): Promise<void> => {
  try {
    const anyMsg = msg as any;
    let chatId = "";
    if (anyMsg.chat?.id) chatId = anyMsg.chat.id.toString();
    else if (anyMsg.peerId) {
      if (anyMsg.peerId.channelId) chatId = anyMsg.peerId.channelId.toString();
      else if (anyMsg.peerId.chatId) chatId = anyMsg.peerId.chatId.toString();
    }
    // 检查配置是否已设置
    if (!CONFIG.TARGET_GROUP_ID || !CONFIG.LOTTERY_BOT_ID) return;
    if (chatId !== CONFIG.TARGET_GROUP_ID) return;
    
    const text = anyMsg.message || anyMsg.text || "";
    const senderId = anyMsg.senderId?.toString() || anyMsg.fromId?.toString() || anyMsg._senderId?.toString();
    
    // 处理开奖结果
    const resultCheck = checkLotteryResult(text);
    if (resultCheck.isResult) {
      if (isResultProcessed(anyMsg.id)) return;
      let record = resultCheck.keyword ? findRecordByKeyword(resultCheck.keyword) : null;
      const isWinner = resultCheck.isWinner && record !== null;
      if (record) {
        updateLotteryResult(record.id, text.substring(0, 200), isWinner ? "won" : "lost");
        if (isWinner) await sendWinNotification(client, { ...record, status: "won" });
      }
      addProcessedResult(anyMsg.id, isWinner, resultCheck.prize, record?.messageId);
      return;
    }
    
    // 处理抽奖消息
    if (senderId !== CONFIG.LOTTERY_BOT_ID) return;
    if (!CONFIG.AUTO_JOIN) return;
    
    const keyword = extractKeyword(msg);
    if (!keyword) return;
    if (isAlreadyJoined(anyMsg.id)) return;
    
    const prize = extractPrize(text);
    const delay = Math.floor(Math.random() * (CONFIG.JOIN_DELAY_MAX - CONFIG.JOIN_DELAY_MIN) + CONFIG.JOIN_DELAY_MIN);
    
    setTimeout(async () => {
      try {
        const peer = anyMsg.peerId || anyMsg.chatId || anyMsg.chat?.id;
        if (!peer) return;
        await client.sendMessage(peer, { message: keyword });
        addLotteryRecord({ messageId: anyMsg.id, keyword, prize, status: "joined", joinedAt: Math.floor(Date.now() / 1000) });
      } catch (error) {}
    }, delay);
  } catch (error) {}
};

// 创建插件
const lotteryPlugin: Plugin = {
  name: "lottery",
  version: "1.2.0",
  description: "🎰 自动抽奖插件 - 监听群组抽奖并自动参与，支持中奖通知和详细记录",
  author: "NexBot",

  async onInit(client: any): Promise<void> {
    initLotteryTable();
    loadConfig();
    // 不再自动设置 NOTIFY_USER_ID，空值时使用 "me" 发送给自己
  },

  async onMessage(msg: Api.Message, client: any): Promise<void> {
    await messageHandler(msg, client);
  },

  commands: {
    lottery: {
      description: "查看抽奖记录和参与历史",
      aliases: ["lott", "抽奖记录"],
      examples: ["lottery", "lottery 20"],
      handler: async (msg, args, ctx) => {
        const prefix = process.env.CMD_PREFIX || ".";
        const limit = parseInt(args[0]) || 20;
        const records = getAllRecords(limit);
        const stats = getStats();
        
        if (records.length === 0) {
          await (msg as any).edit({
            text: `${EMOJI.LOTTERY} <b>暂无抽奖记录</b>\n\n使用 ${copyCmd("lottery", prefix)} 查看记录`,
            parseMode: "html",
          });
          return;
        }
        
        let text = `${EMOJI.LOTTERY} <b>抽奖记录</b>\n\n`;
        text += `${EMOJI.STATS} 统计: 总参与 ${stats.total} | 等待 ${stats.joined} | ${EMOJI.WIN} ${stats.won} | ${EMOJI.LOST} ${stats.lost}\n\n`;
        
        for (const record of records.slice(0, 10)) {
          const statusEmoji = record.status === "won" ? EMOJI.WIN : record.status === "lost" ? EMOJI.LOST : EMOJI.WAIT;
          const statusText = record.status === "won" ? "已中奖" : record.status === "lost" ? "未中奖" : "等待开奖";
          text += `${statusEmoji} <code>${record.keyword}</code>\n`;
          text += `   ${EMOJI.PRIZE} ${record.prize || "未知奖品"}\n`;
          text += `   ${EMOJI.TIME} ${formatTime(record.joinedAt)} | ${statusText}\n\n`;
        }
        
        if (records.length > 10) text += `... 还有 ${records.length - 10} 条记录`;
        await (msg as any).edit({ text, parseMode: "html" });
      },
    },

    lottstat: {
      description: "查看抽奖统计数据和中奖率",
      aliases: ["lottstats", "抽奖统计"],
      examples: ["lottstat"],
      handler: async (msg, args, ctx) => {
        const stats = getStats();
        const winRate = stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) : "0.0";
        
        const text = `${EMOJI.LOTTERY} <b>抽奖统计</b>\n\n` +
                     `${EMOJI.STATS} 总参与: ${stats.total} 次\n` +
                     `${EMOJI.WAIT} 等待开奖: ${stats.joined} 次\n` +
                     `${EMOJI.WIN} 中奖: ${stats.won} 次\n` +
                     `${EMOJI.LOST} 未中奖: ${stats.lost} 次\n` +
                     `💰 中奖率: ${winRate}%\n\n` +
                     `${EMOJI.GROUP} 监听群组: <code>${CONFIG.TARGET_GROUP_ID || "未设置"}</code>\n` +
                     `${EMOJI.BOT} 抽奖机器人: <code>${CONFIG.LOTTERY_BOT_ID || "未设置"}</code>`;
        await (msg as any).edit({ text, parseMode: "html" });
      },
    },

    lottcfg: {
      description: "查看当前抽奖插件配置",
      aliases: ["lottconfig", "抽奖配置"],
      examples: ["lottcfg"],
      handler: async (msg, args, ctx) => {
        const text = `${EMOJI.LOTTERY} <b>抽奖插件配置</b>\n\n` +
                     `${EMOJI.GROUP} 监听群组: <code>${CONFIG.TARGET_GROUP_ID || "未设置"}</code>\n` +
                     `${EMOJI.BOT} 抽奖机器人: <code>${CONFIG.LOTTERY_BOT_ID || "未设置"}</code>\n` +
                     `${EMOJI.NOTIFY} 通知用户: <code>${CONFIG.NOTIFY_USER_ID || "默认(发给自己)"}</code>\n` +
                     `${EMOJI.DELAY} 延迟范围: ${CONFIG.JOIN_DELAY_MIN}-${CONFIG.JOIN_DELAY_MAX}ms\n` +
                     `${EMOJI.AUTO} 自动参与: ${CONFIG.AUTO_JOIN ? "✅ 开启" : "❌ 关闭"}\n` +
                     `${EMOJI.NOTIFY} 中奖通知: ${CONFIG.NOTIFY_ON_WIN ? "✅ 开启" : "❌ 关闭"}`;
        await (msg as any).edit({ text, parseMode: "html" });
      },
    },

    lottset: {
      description: "设置抽奖插件参数",
      aliases: ["lottsetting", "抽奖设置"],
      examples: ["lottset auto on", "lottset delay_min 2000", "lottset notify_win on"],
      handler: async (msg, args, ctx) => {
        const prefix = process.env.CMD_PREFIX || ".";
        if (args.length < 2) {
          const help = `${EMOJI.LOTTERY} <b>设置抽奖配置</b>\n\n` +
                      `${EMOJI.INFO} 用法: ${copyCmd("lottset [配置项] [值]", prefix)}\n\n` +
                      `<b>配置项:</b>\n` +
                      `${EMOJI.GROUP} <code>group</code> ${EMOJI.ARROW} 监听群组ID\n` +
                      `${EMOJI.BOT} <code>bot</code> ${EMOJI.ARROW} 抽奖机器人ID\n` +
                      `${EMOJI.NOTIFY} <code>notify</code> ${EMOJI.ARROW} 通知用户ID (传 default 恢复默认)\n` +
                      `${EMOJI.DELAY} <code>delay_min</code> ${EMOJI.ARROW} 最小延迟(ms)\n` +
                      `${EMOJI.DELAY} <code>delay_max</code> ${EMOJI.ARROW} 最大延迟(ms)\n` +
                      `${EMOJI.AUTO} <code>auto</code> ${EMOJI.ARROW} 自动参与 (on/off)\n` +
                      `${EMOJI.NOTIFY} <code>notify_win</code> ${EMOJI.ARROW} 中奖通知 (on/off)\n\n` +
                      `<b>示例:</b>\n` +
                      `${copyCmd("lottset auto off", prefix)}\n` +
                      `${copyCmd("lottset delay_min 2000", prefix)}`;
          await (msg as any).edit({ text: help, parseMode: "html" });
          return;
        }
        
        const key = args[0].toLowerCase();
        const value = args[1];
        
        switch (key) {
          case "group": CONFIG.TARGET_GROUP_ID = value; saveConfig(); break;
          case "bot": CONFIG.LOTTERY_BOT_ID = value; saveConfig(); break;
          case "notify": 
            if (value === "default" || value === "reset") {
              CONFIG.NOTIFY_USER_ID = "";
            } else {
              CONFIG.NOTIFY_USER_ID = value;
            }
            saveConfig(); 
            break;
          case "delay_min": CONFIG.JOIN_DELAY_MIN = parseInt(value) || 1000; saveConfig(); break;
          case "delay_max": CONFIG.JOIN_DELAY_MAX = parseInt(value) || 5000; saveConfig(); break;
          case "auto": CONFIG.AUTO_JOIN = value === "on" || value === "true"; saveConfig(); break;
          case "notify_win": CONFIG.NOTIFY_ON_WIN = value === "on" || value === "true"; saveConfig(); break;
          default:
            await (msg as any).edit({ text: `${EMOJI.ERROR} 未知配置项: ${key}`, parseMode: "html" });
            return;
        }
        await (msg as any).edit({ text: `${EMOJI.SUCCESS} 配置已更新`, parseMode: "html" });
      },
    },

    lottreset: {
      description: "重置抽奖插件配置为默认值",
      aliases: ["lottrestore", "抽奖重置"],
      examples: ["lottreset"],
      handler: async (msg, args, ctx) => {
        CONFIG = { ...DEFAULT_CONFIG };
        saveConfig();
        await (msg as any).edit({ text: `${EMOJI.SUCCESS} 配置已重置为默认值`, parseMode: "html" });
      },
    },
  },
};

export default lotteryPlugin;
