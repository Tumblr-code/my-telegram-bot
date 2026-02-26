/**
 * 自动抽奖插件
 * 监听指定群组的抽奖消息并自动参与
 */

import { Plugin } from "../src/utils/pluginBase.js";
import { Api } from "telegram";
import { db } from "../src/utils/database.js";

// 默认配置
const DEFAULT_CONFIG = {
  // 监听的群组 ID
  TARGET_GROUP_ID: "2129702425",
  // 发布抽奖的机器人 ID
  LOTTERY_BOT_ID: "6461022460",
  // 通知用户 ID (自动获取登录用户)
  NOTIFY_USER_ID: "",
  // 参与延迟（毫秒，随机范围）
  JOIN_DELAY_MIN: 1000,
  JOIN_DELAY_MAX: 5000,
  // 是否自动参与
  AUTO_JOIN: true,
  // 是否开启中奖通知
  NOTIFY_ON_WIN: true,
  // 关键词提取模式: smart | button | text
  EXTRACT_MODE: "smart",
};

// 当前配置（会从数据库加载）
let CONFIG = { ...DEFAULT_CONFIG };

// 加载配置
const loadConfig = (): void => {
  try {
    const saved = db.get<typeof DEFAULT_CONFIG>("lottery_config");
    if (saved) {
      CONFIG = { ...DEFAULT_CONFIG, ...saved };
    }
  } catch (error) {
    console.error("[lottery] 加载配置失败:", error);
  }
};

// 保存配置
const saveConfig = (): void => {
  try {
    db.set("lottery_config", CONFIG);
  } catch (error) {
    console.error("[lottery] 保存配置失败:", error);
  }
};

// 抽奖记录接口
interface LotteryRecord {
  id?: number;
  messageId: number;
  keyword: string;
  prize: string;
  status: "joined" | "ended" | "won" | "lost";
  joinedAt: number;
  endedAt?: number;
  result?: string;
  createdAt?: number;
}

// 初始化数据库表
const initLotteryTable = () => {
  try {
    const database = (db as any).getDB();
    
    // 抽奖记录表
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
    
    // 已处理的开奖消息记录（避免重复处理）
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
    
    // 创建索引
    database.run(`CREATE INDEX IF NOT EXISTS idx_lottery_status ON lottery_records(status)`);
    database.run(`CREATE INDEX IF NOT EXISTS idx_lottery_msg_id ON lottery_records(message_id)`);
    database.run(`CREATE INDEX IF NOT EXISTS idx_lottery_keyword ON lottery_records(keyword)`);
    database.run(`CREATE INDEX IF NOT EXISTS idx_lottery_results_msg ON lottery_results(result_msg_id)`);
    
    console.log("[lottery] 数据库表初始化完成");
  } catch (error) {
    console.error("[lottery] 数据库初始化失败:", error);
  }
};

// 添加抽奖记录
const addLotteryRecord = (record: Omit<LotteryRecord, "id" | "createdAt">): number | null => {
  try {
    const database = (db as any).getDB();
    const result = database.run(
      `INSERT INTO lottery_records (message_id, keyword, prize, status, joined_at) VALUES (?, ?, ?, ?, ?)`,
      [record.messageId, record.keyword, record.prize || "", record.status, record.joinedAt]
    );
    return result.lastInsertRowid as number;
  } catch (error) {
    console.error("[lottery] 添加记录失败:", error);
    return null;
  }
};

// 通过关键词查找抽奖记录
const findRecordByKeyword = (keyword: string): LotteryRecord | null => {
  try {
    const database = (db as any).getDB();
    const row = database.query(
      `SELECT * FROM lottery_records WHERE keyword = ? AND status = 'joined' ORDER BY joined_at DESC LIMIT 1`
    ).get(keyword) as LotteryRecord | null;
    return row;
  } catch (error) {
    console.error("[lottery] 查找记录失败:", error);
    return null;
  }
};

// 更新开奖结果
const updateLotteryResult = (id: number, result: string, status: "won" | "lost"): void => {
  try {
    const database = (db as any).getDB();
    database.run(
      `UPDATE lottery_records SET status = ?, result = ?, ended_at = ? WHERE id = ?`,
      [status, result, Math.floor(Date.now() / 1000), id]
    );
  } catch (error) {
    console.error("[lottery] 更新结果失败:", error);
  }
};

// 记录已处理的开奖结果
const addProcessedResult = (resultMsgId: number, isWinner: boolean, prize?: string, originalMsgId?: number): void => {
  try {
    const database = (db as any).getDB();
    database.run(
      `INSERT INTO lottery_results (result_msg_id, is_winner, prize, original_msg_id) VALUES (?, ?, ?, ?)`,
      [resultMsgId, isWinner ? 1 : 0, prize || "", originalMsgId || null]
    );
  } catch (error) {
    console.error("[lottery] 记录开奖结果失败:", error);
  }
};

// 检查开奖结果是否已处理
const isResultProcessed = (resultMsgId: number): boolean => {
  try {
    const database = (db as any).getDB();
    const row = database.query(
      `SELECT id FROM lottery_results WHERE result_msg_id = ?`
    ).get(resultMsgId) as { id: number } | null;
    return !!row;
  } catch (error) {
    console.error("[lottery] 检查开奖结果失败:", error);
    return false;
  }
};

// 检查是否已参与
const isAlreadyJoined = (messageId: number): boolean => {
  try {
    const database = (db as any).getDB();
    const row = database.query(
      `SELECT id FROM lottery_records WHERE message_id = ?`
    ).get(messageId) as { id: number } | null;
    return !!row;
  } catch (error) {
    console.error("[lottery] 查询记录失败:", error);
    return false;
  }
};

// 获取所有记录
const getAllRecords = (limit: number = 50): LotteryRecord[] => {
  try {
    const database = (db as any).getDB();
    const rows = database.query(
      `SELECT * FROM lottery_records ORDER BY joined_at DESC LIMIT ?`
    ).all(limit) as LotteryRecord[];
    return rows;
  } catch (error) {
    console.error("[lottery] 获取记录失败:", error);
    return [];
  }
};

// 获取统计信息
const getStats = () => {
  try {
    const database = (db as any).getDB();
    const total = database.query(`SELECT COUNT(*) as count FROM lottery_records`).get() as { count: number };
    const joined = database.query(`SELECT COUNT(*) as count FROM lottery_records WHERE status = 'joined'`).get() as { count: number };
    const won = database.query(`SELECT COUNT(*) as count FROM lottery_records WHERE status = 'won'`).get() as { count: number };
    const lost = database.query(`SELECT COUNT(*) as count FROM lottery_records WHERE status = 'lost'`).get() as { count: number };
    
    return {
      total: total?.count || 0,
      joined: joined?.count || 0,
      won: won?.count || 0,
      lost: lost?.count || 0,
    };
  } catch (error) {
    console.error("[lottery] 获取统计失败:", error);
    return { total: 0, joined: 0, won: 0, lost: 0 };
  }
};

// 提取关键词（从消息中找可点击复制的文本）
const extractKeyword = (msg: Api.Message): string | null => {
  const anyMsg = msg as any;
  const text = anyMsg.message || anyMsg.text || "";
  
  // 模式1: 从消息实体中提取代码块
  if (anyMsg.entities && Array.isArray(anyMsg.entities)) {
    for (const entity of anyMsg.entities) {
      if (entity.className === "MessageEntityCode" || 
          entity.className === "MessageEntityPre") {
        const start = entity.offset || 0;
        const length = entity.length || 0;
        const keyword = text.substring(start, start + length).trim();
        if (keyword && keyword.length > 1 && keyword.length < 50) {
          console.log(`[lottery] 从代码块提取关键词: ${keyword}`);
          return keyword;
        }
      }
    }
  }
  
  // 模式2: 从回复键盘中提取
  if (anyMsg.replyMarkup && anyMsg.replyMarkup.rows) {
    for (const row of anyMsg.replyMarkup.rows) {
      for (const button of row.buttons || []) {
        if (button.text && button.text.length < 50) {
          console.log(`[lottery] 从按钮提取关键词: ${button.text}`);
          return button.text.trim();
        }
      }
    }
  }
  
  // 模式3: 正则匹配常见的抽奖关键词格式
  // 匹配 "回复 XXX 参与" 格式
  const match1 = text.match(/回复\s*[`"']?([^`"'\n]+)[`"']?\s*参与/i);
  if (match1) {
    console.log(`[lottery] 从'回复参与'格式提取: ${match1[1].trim()}`);
    return match1[1].trim();
  }
  
  // 匹配 "关键词：XXX" 格式
  const match2 = text.match(/关键词[：:]\s*[`"']?([^`"'\n]+)[`"']?/i);
  if (match2) {
    console.log(`[lottery] 从'关键词'格式提取: ${match2[1].trim()}`);
    return match2[1].trim();
  }
  
  // 匹配 "口令：XXX" 格式
  const match3 = text.match(/口令[：:]\s*[`"']?([^`"'\n]+)[`"']?/i);
  if (match3) {
    console.log(`[lottery] 从'口令'格式提取: ${match3[1].trim()}`);
    return match3[1].trim();
  }
  
  // 匹配被引号包围的短文本（2-20字符）
  const match4 = text.match(/[`"']([^`"'\n]{2,20})[`"']/);
  if (match4) {
    console.log(`[lottery] 从引号提取: ${match4[1].trim()}`);
    return match4[1].trim();
  }
  
  return null;
};

// 提取奖品信息
const extractPrize = (text: string): string => {
  const patterns = [
    /奖品[：:]\s*([^\n]+)/i,
    /奖励[：:]\s*([^\n]+)/i,
    /\*\*([^\n]+?)\*\*/,  // Markdown 粗体
    /奖励\s*([^\n]{2,30}?)(?:\n|$)/i,
    /(\d+\s*(?:USDT|BTC|ETH|代币|红包|现金))/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  
  return "未知奖品";
};

// 检查是否是开奖结果消息
const checkLotteryResult = (text: string): { 
  isResult: boolean; 
  isWinner?: boolean; 
  winnerName?: string;
  prize?: string;
  keyword?: string;
} => {
  // 开奖结果关键词
  const resultPatterns = [
    /开奖.*结果/i,
    /中奖.*名单/i,
    /恭喜.*中奖/i,
    /抽奖.*结束/i,
    /获奖/i,
  ];
  
  for (const pattern of resultPatterns) {
    if (pattern.test(text)) {
      // 判断是否中奖
      const isWinner = /恭喜|中奖|获得者|Winner/i.test(text) && !(/未中奖|没有中奖|谢谢参与/i.test(text));
      
      // 尝试提取中奖者
      const winnerMatch = text.match(/(?:恭喜|中奖者|获得者)[：:\s@]*([^\n\s,，]+)/i);
      const winnerName = winnerMatch ? winnerMatch[1] : undefined;
      
      // 尝试提取奖品
      const prizeMatch = text.match(/(?:奖品|奖励|获得)[：:\s]*([^\n]+)/i);
      const prize = prizeMatch ? prizeMatch[1].trim() : undefined;
      
      // 尝试提取关键词
      const keywordMatch = text.match(/(?:关键词|口令)[：:\s]*([^\n\s]+)/i);
      const keyword = keywordMatch ? keywordMatch[1] : undefined;
      
      return {
        isResult: true,
        isWinner,
        winnerName,
        prize,
        keyword,
      };
    }
  }
  
  return { isResult: false };
};

// 发送中奖通知
const sendWinNotification = async (client: any, record: LotteryRecord): Promise<void> => {
  if (!CONFIG.NOTIFY_USER_ID || !CONFIG.NOTIFY_ON_WIN) return;
  
  try {
    const notifyId = BigInt(CONFIG.NOTIFY_USER_ID);
    
    const text = `🎉 <b>中奖通知</b>\n\n` +
                 `恭喜您在抽奖中中奖！\n\n` +
                 `🎁 奖品: ${record.prize}\n` +
                 `🔑 关键词: <code>${record.keyword}</code>\n` +
                 `📅 参与时间: ${formatTime(record.joinedAt)}\n\n` +
                 `请及时领取您的奖品！`;
    
    await client.sendMessage(notifyId, {
      message: text,
      parseMode: "html",
    });
    
    console.log(`[lottery] 已发送中奖通知给用户 ${CONFIG.NOTIFY_USER_ID}`);
  } catch (error) {
    console.error("[lottery] 发送通知失败:", error);
  }
};

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("zh-CN");
};

// 格式化配置显示
const formatConfig = (): string => {
  return `🎰 <b>抽奖插件配置</b>\n\n` +
         `📱 监听群组: <code>${CONFIG.TARGET_GROUP_ID}</code>\n` +
         `🤖 抽奖机器人: <code>${CONFIG.LOTTERY_BOT_ID}</code>\n` +
         `🔔 通知用户: <code>${CONFIG.NOTIFY_USER_ID || "未设置"}</code>\n` +
         `⏱️ 延迟范围: ${CONFIG.JOIN_DELAY_MIN}-${CONFIG.JOIN_DELAY_MAX}ms\n` +
         `🎮 自动参与: ${CONFIG.AUTO_JOIN ? "✅ 开启" : "❌ 关闭"}\n` +
         `📢 中奖通知: ${CONFIG.NOTIFY_ON_WIN ? "✅ 开启" : "❌ 关闭"}\n` +
         `🔍 提取模式: ${CONFIG.EXTRACT_MODE}`;
};

// 消息处理器
const messageHandler = async (msg: Api.Message): Promise<void> => {
  try {
    const client = (msg as any).client;
    if (!client) return;
    
    const anyMsg = msg as any;
    
    // 获取群组 ID
    let chatId = "";
    if (anyMsg.chat?.id) {
      chatId = anyMsg.chat.id.toString();
    } else if (anyMsg.peerId) {
      const peerId = anyMsg.peerId;
      if (peerId.channelId) {
        chatId = peerId.channelId.toString();
      } else if (peerId.chatId) {
        chatId = peerId.chatId.toString();
      }
    }
    
    // 只处理目标群组
    if (chatId !== CONFIG.TARGET_GROUP_ID) {
      return;
    }
    
    const text = anyMsg.message || anyMsg.text || "";
    const senderId = anyMsg.senderId?.toString() || 
                     anyMsg.fromId?.toString() || 
                     anyMsg._senderId?.toString();
    
    // ========== 处理开奖结果消息 ==========
    const resultCheck = checkLotteryResult(text);
    
    if (resultCheck.isResult) {
      console.log("[lottery] 检测到开奖结果消息");
      
      // 检查是否已处理过
      if (isResultProcessed(anyMsg.id)) {
        console.log("[lottery] 该开奖结果已处理过");
        return;
      }
      
      // 尝试通过关键词查找对应的抽奖记录
      let record: LotteryRecord | null = null;
      if (resultCheck.keyword) {
        record = findRecordByKeyword(resultCheck.keyword);
      }
      
      // 判断是否中奖（需要匹配到记录且结果包含中奖信息）
      const isWinner = resultCheck.isWinner && record !== null;
      
      if (record) {
        // 更新记录状态
        const status = isWinner ? "won" : "lost";
        updateLotteryResult(record.id!, text.substring(0, 200), status);
        
        console.log(`[lottery] 更新抽奖记录 #${record.id} 状态为: ${status}`);
        
        // 如果中奖，发送通知
        if (isWinner) {
          await sendWinNotification(client, { ...record, status: "won" });
        }
      }
      
      // 记录已处理
      addProcessedResult(anyMsg.id, isWinner, resultCheck.prize, record?.messageId);
      return;
    }
    
    // ========== 处理抽奖消息 ==========
    // 只处理抽奖机器人的消息
    if (senderId !== CONFIG.LOTTERY_BOT_ID) {
      return;
    }
    
    console.log(`[lottery] 收到抽奖机器人消息: ${text.substring(0, 50)}...`);
    
    // 检查自动参与是否开启
    if (!CONFIG.AUTO_JOIN) {
      console.log("[lottery] 自动参与已关闭，跳过");
      return;
    }
    
    // 提取关键词
    const keyword = extractKeyword(msg);
    if (!keyword) {
      console.log("[lottery] 未找到关键词");
      return;
    }
    
    console.log(`[lottery] 提取到关键词: ${keyword}`);
    
    // 检查是否已参与
    if (isAlreadyJoined(anyMsg.id)) {
      console.log(`[lottery] 已参与过该抽奖 (msgId: ${anyMsg.id})`);
      return;
    }
    
    // 提取奖品信息
    const prize = extractPrize(text);
    
    // 随机延迟后参与
    const delay = Math.floor(Math.random() * (CONFIG.JOIN_DELAY_MAX - CONFIG.JOIN_DELAY_MIN) + CONFIG.JOIN_DELAY_MIN);
    console.log(`[lottery] ${delay}ms 后自动参与...`);
    
    setTimeout(async () => {
      try {
        const peer = anyMsg.peerId || anyMsg.chatId || anyMsg.chat?.id;
        if (!peer) return;
        
        // 发送关键词参与
        await client.sendMessage(peer, {
          message: keyword,
          replyTo: anyMsg.id,
        });
        
        console.log(`[lottery] 已参与抽奖: ${keyword}`);
        
        // 记录到数据库
        const recordId = addLotteryRecord({
          messageId: anyMsg.id,
          keyword,
          prize,
          status: "joined",
          joinedAt: Math.floor(Date.now() / 1000),
        });
        
        if (recordId) {
          console.log(`[lottery] 记录已保存 #${recordId}`);
        }
        
      } catch (error) {
        console.error("[lottery] 参与失败:", error);
      }
    }, delay);
    
  } catch (error) {
    console.error("[lottery] 消息处理错误:", error);
  }
};

// 创建插件
class LotteryPlugin extends Plugin {
  name = "lottery";
  version = "1.1.0";
  description = "🎰 自动抽奖插件 - 监听群组抽奖并自动参与，支持中奖通知";
  author = "NexBot";

  async onInit(client: any): Promise<void> {
    initLotteryTable();
    loadConfig();
    
    // 如果没有设置通知用户，尝试获取当前登录用户
    if (!CONFIG.NOTIFY_USER_ID && client) {
      try {
        const me = await client.getMe();
        if (me?.id) {
          CONFIG.NOTIFY_USER_ID = me.id.toString();
          saveConfig();
          console.log(`[lottery] 已设置通知用户: ${CONFIG.NOTIFY_USER_ID}`);
        }
      } catch (error) {
        console.error("[lottery] 获取当前用户失败:", error);
      }
    }
    
    console.log("[lottery] 插件已初始化");
    console.log(`[lottery] 监听群组: ${CONFIG.TARGET_GROUP_ID}`);
    console.log(`[lottery] 抽奖机器人: ${CONFIG.LOTTERY_BOT_ID}`);
    console.log(`[lottery] 通知用户: ${CONFIG.NOTIFY_USER_ID || "未设置"}`);
    console.log(`[lottery] 自动参与: ${CONFIG.AUTO_JOIN ? "开启" : "关闭"}`);
    console.log(`[lottery] 中奖通知: ${CONFIG.NOTIFY_ON_WIN ? "开启" : "关闭"}`);
  }

  async onMessage(msg: Api.Message): Promise<void> {
    await messageHandler(msg);
  }

  cmdHandlers = {
    // 查询抽奖记录
    lottery: async (msg: Api.Message) => {
      const records = getAllRecords(20);
      const stats = getStats();
      
      if (records.length === 0) {
        await msg.reply({ message: "🎰 暂无抽奖记录" });
        return;
      }
      
      let text = "🎰 <b>抽奖记录</b>\n\n";
      text += `📊 统计: 总参与 ${stats.total} | 等待 ${stats.joined} | 中奖 ${stats.won} | 未中 ${stats.lost}\n\n`;
      
      for (const record of records.slice(0, 10)) {
        const statusEmoji = record.status === "won" ? "🎉" : 
                           record.status === "lost" ? "😢" : "⏳";
        const statusText = record.status === "won" ? "已中奖" : 
                          record.status === "lost" ? "未中奖" : "等待开奖";
        
        text += `${statusEmoji} <code>${record.keyword}</code>\n`;
        text += `   🎁 ${record.prize || "未知奖品"}\n`;
        text += `   📅 ${formatTime(record.joinedAt)} | ${statusText}\n\n`;
      }
      
      if (records.length > 10) {
        text += `... 还有 ${records.length - 10} 条记录`;
      }
      
      await msg.reply({ message: text, parseMode: "html" });
    },
    
    // 查询统计
    lottstat: async (msg: Api.Message) => {
      const stats = getStats();
      
      const text = `🎰 <b>抽奖统计</b>\n\n` +
                   `📊 总参与: ${stats.total} 次\n` +
                   `⏳ 等待开奖: ${stats.joined} 次\n` +
                   `🎉 中奖: ${stats.won} 次\n` +
                   `😢 未中奖: ${stats.lost} 次\n` +
                   `💰 中奖率: ${stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) : 0}%\n\n` +
                   `📱 监听群组: ${CONFIG.TARGET_GROUP_ID}\n` +
                   `🤖 抽奖机器人: ${CONFIG.LOTTERY_BOT_ID}`;
      
      await msg.reply({ message: text, parseMode: "html" });
    },
    
    // 查看配置
    lottcfg: async (msg: Api.Message) => {
      await msg.reply({ message: formatConfig(), parseMode: "html" });
    },
    
    // 设置配置
    lottset: async (msg: Api.Message, args: string[]) => {
      if (args.length < 2) {
        const help = `🎰 <b>设置抽奖配置</b>\n\n` +
                    `用法: <code>.lottset [配置项] [值]</code>\n\n` +
                    `配置项:\n` +
                    `• <code>group</code> - 监听群组ID\n` +
                    `• <code>bot</code> - 抽奖机器人ID\n` +
                    `• <code>notify</code> - 通知用户ID\n` +
                    `• <code>delay_min</code> - 最小延迟(ms)\n` +
                    `• <code>delay_max</code> - 最大延迟(ms)\n` +
                    `• <code>auto</code> - 自动参与 (on/off)\n` +
                    `• <code>notify_win</code> - 中奖通知 (on/off)\n\n` +
                    `示例:\n` +
                    `<code>.lottset auto off</code>\n` +
                    `<code>.lottset delay_min 2000</code>`;
        await msg.reply({ message: help, parseMode: "html" });
        return;
      }
      
      const key = args[0].toLowerCase();
      const value = args[1];
      
      switch (key) {
        case "group":
          CONFIG.TARGET_GROUP_ID = value;
          saveConfig();
          await msg.reply({ message: `✅ 监听群组已设置为: <code>${value}</code>`, parseMode: "html" });
          break;
        case "bot":
          CONFIG.LOTTERY_BOT_ID = value;
          saveConfig();
          await msg.reply({ message: `✅ 抽奖机器人已设置为: <code>${value}</code>`, parseMode: "html" });
          break;
        case "notify":
          CONFIG.NOTIFY_USER_ID = value;
          saveConfig();
          await msg.reply({ message: `✅ 通知用户已设置为: <code>${value}</code>`, parseMode: "html" });
          break;
        case "delay_min":
          CONFIG.JOIN_DELAY_MIN = parseInt(value) || 1000;
          saveConfig();
          await msg.reply({ message: `✅ 最小延迟已设置为: <code>${CONFIG.JOIN_DELAY_MIN}ms</code>`, parseMode: "html" });
          break;
        case "delay_max":
          CONFIG.JOIN_DELAY_MAX = parseInt(value) || 5000;
          saveConfig();
          await msg.reply({ message: `✅ 最大延迟已设置为: <code>${CONFIG.JOIN_DELAY_MAX}ms</code>`, parseMode: "html" });
          break;
        case "auto":
          CONFIG.AUTO_JOIN = value === "on" || value === "true" || value === "1";
          saveConfig();
          await msg.reply({ message: `✅ 自动参与已${CONFIG.AUTO_JOIN ? "开启" : "关闭"}`, parseMode: "html" });
          break;
        case "notify_win":
          CONFIG.NOTIFY_ON_WIN = value === "on" || value === "true" || value === "1";
          saveConfig();
          await msg.reply({ message: `✅ 中奖通知已${CONFIG.NOTIFY_ON_WIN ? "开启" : "关闭"}`, parseMode: "html" });
          break;
        default:
          await msg.reply({ message: `❌ 未知配置项: ${key}`, parseMode: "html" });
      }
    },
    
    // 重置配置
    lottreset: async (msg: Api.Message) => {
      CONFIG = { ...DEFAULT_CONFIG };
      saveConfig();
      await msg.reply({ message: "✅ 配置已重置为默认值", parseMode: "html" });
    },
  };
}

export default new LotteryPlugin();
