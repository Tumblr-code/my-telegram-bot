/**
 * 自动抽奖插件 v2.1 - 支持多群组
 * 核心思路：先存消息，后处理（防止消息被快速编辑丢失内容）
 */

import { Plugin } from "../src/types/index.js";
import { Api } from "telegram";
import { db } from "../src/utils/database.js";
// import { fmt } from "../src/utils/context.js";

const EMOJI = {
  LOTTERY: "🎰", WIN: "🎉", LOST: "😢", KEY: "🔑", STATS: "📊",
  CONFIG: "⚙️", GROUP: "📱", BOT: "🤖", SUCCESS: "✅", ERROR: "❌",
  ADD: "➕", REMOVE: "➖", LIST: "📋",
};

// 全局配置
let AUTO_JOIN = true;
const MAX_MESSAGE_AGE = 3600; // 保留1小时内的消息
const MAX_MESSAGE_COUNT = 500; // 最多保留500条消息

// 多群组配置列表
interface GroupConfig {
  groupId: string;
  botId: string;
}
let GROUP_CONFIGS: GroupConfig[] = [];

// ============ 数据库操作 ============

const initDB = () => {
  const database = (db as any).getDB();
  
  // 消息表
  database.run(`
    CREATE TABLE IF NOT EXISTS lottery_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      chat_id TEXT NOT NULL,
      sender_id TEXT,
      text TEXT,
      entities TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      processed INTEGER DEFAULT 0,
      UNIQUE(message_id, chat_id)
    )
  `);
  database.run(`CREATE INDEX IF NOT EXISTS idx_lm_chat ON lottery_messages(chat_id, created_at)`);
  
  // 关键词表
  database.run(`
    CREATE TABLE IF NOT EXISTS lottery_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      chat_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      prize TEXT,
      status TEXT DEFAULT 'pending',
      sent_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);
  database.run(`CREATE INDEX IF NOT EXISTS idx_lk_status ON lottery_keywords(status)`);
  
  // 多群组配置表
  database.run(`
    CREATE TABLE IF NOT EXISTS lottery_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL UNIQUE,
      bot_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);
  
  // 全局配置表
  database.run(`CREATE TABLE IF NOT EXISTS lottery_settings (key TEXT PRIMARY KEY, value TEXT)`);
};

// 加载多群组配置
const loadGroupConfigs = () => {
  try {
    const database = (db as any).getDB();
    const rows = database.query(`SELECT group_id, bot_id FROM lottery_groups`).all() as any[];
    GROUP_CONFIGS = rows.map(r => ({ groupId: r.group_id, botId: r.bot_id }));
    console.log(`[lottery] 加载了 ${GROUP_CONFIGS.length} 个群组配置`);
  } catch (e) {}
};

// 添加群组
const addGroup = (groupId: string, botId: string): boolean => {
  try {
    const database = (db as any).getDB();
    database.run(
      `INSERT OR REPLACE INTO lottery_groups (group_id, bot_id) VALUES (?, ?)`,
      [groupId, botId]
    );
    loadGroupConfigs();
    return true;
  } catch (e) { return false; }
};

// 删除群组
const removeGroup = (groupId: string): boolean => {
  try {
    const database = (db as any).getDB();
    database.run(`DELETE FROM lottery_groups WHERE group_id = ?`, [groupId]);
    loadGroupConfigs();
    return true;
  } catch (e) { return false; }
};

// 获取群组列表
const getGroupList = (): GroupConfig[] => GROUP_CONFIGS;

// 保存消息
const saveMessage = (msg: any) => {
  try {
    const database = (db as any).getDB();
    const chatId = msg.chat?.id?.toString() || msg.peerId?.channelId?.toString() || msg.peerId?.chatId?.toString();
    const senderId = msg.senderId?.toString() || msg.fromId?.toString();
    const text = msg.message || msg.text || "";
    const entities = JSON.stringify(msg.entities || []);
    
    database.run(
      `INSERT OR REPLACE INTO lottery_messages (message_id, chat_id, sender_id, text, entities, created_at, processed) 
       VALUES (?, ?, ?, ?, ?, unixepoch(), 0)`,
      [msg.id, chatId, senderId, text, entities]
    );
    cleanupOldMessages();
  } catch (e) {}
};

// 清理旧消息
const cleanupOldMessages = () => {
  try {
    const database = (db as any).getDB();
    database.run(`DELETE FROM lottery_messages WHERE created_at < unixepoch() - ?`, [MAX_MESSAGE_AGE]);
    database.run(`DELETE FROM lottery_messages WHERE id NOT IN (SELECT id FROM lottery_messages ORDER BY created_at DESC LIMIT ?)`, [MAX_MESSAGE_COUNT]);
  } catch (e) {}
};

// 获取未处理的消息（指定群组）
const getUnprocessedMessages = (groupId: string, botId: string) => {
  try {
    const database = (db as any).getDB();
    return database.query(`
      SELECT * FROM lottery_messages 
      WHERE processed = 0 AND chat_id = ? AND sender_id = ?
      ORDER BY created_at DESC LIMIT 10
    `).all(groupId, botId) as any[];
  } catch (e) { return []; }
};

// 标记消息已处理
const markMessageProcessed = (id: number) => {
  try {
    const database = (db as any).getDB();
    database.run(`UPDATE lottery_messages SET processed = 1 WHERE id = ?`, [id]);
  } catch (e) {}
};

// 保存关键词
const saveKeyword = (messageId: number, chatId: string, keyword: string, prize: string) => {
  try {
    const database = (db as any).getDB();
    database.run(
      `INSERT OR IGNORE INTO lottery_keywords (message_id, chat_id, keyword, prize) VALUES (?, ?, ?, ?)`,
      [messageId, chatId, keyword, prize]
    );
  } catch (e) {}
};

// 获取待发送的关键词
const getPendingKeywords = () => {
  try {
    const database = (db as any).getDB();
    return database.query(`SELECT * FROM lottery_keywords WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10`).all() as any[];
  } catch (e) { return []; }
};

// 标记关键词已发送
const markKeywordSent = (id: number) => {
  try {
    const database = (db as any).getDB();
    database.run(`UPDATE lottery_keywords SET status = 'sent', sent_at = unixepoch() WHERE id = ?`, [id]);
  } catch (e) {}
};

// ============ 关键词提取 ============

const extractKeyword = (text: string): string | null => {
  if (!text) return null;
  
  const match1 = text.match(/参与关键词[：:]\s*[「『]([^」』\n]+)[」』]/);
  if (match1) return match1[1].trim();
  
  const match2 = text.match(/关键词[：:]\s*[「『]([^」』\n]+)[」』]/);
  if (match2) return match2[1].trim();
  
  const match3 = text.match(/[「『]([^」』\n]{2,20})[」』]/);
  if (match3) return match3[1].trim();
  
  return null;
};

const extractPrize = (text: string): string => {
  const patterns = [/奖品[：:]\s*([^\n]+)/i, /奖励[：:]\s*([^\n]+)/i, /\*\*([^\n]+?)\*\*/];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return "未知奖品";
};

// ============ 消息处理 ============

// 检查是否配置的群组
const isMonitoredGroup = (chatId: string): GroupConfig | null => {
  return GROUP_CONFIGS.find(g => g.groupId === chatId) || null;
};

// 1. 保存消息
const messageHandler = async (msg: Api.Message) => {
  const anyMsg = msg as any;
  const chatId = anyMsg.chat?.id?.toString() || anyMsg.peerId?.channelId?.toString() || anyMsg.peerId?.chatId?.toString();
  
  if (!isMonitoredGroup(chatId)) return;
  
  saveMessage(anyMsg);
  console.log(`[lottery] 消息已保存: ${anyMsg.id} (群组: ${chatId})`);
};

// 2. 处理消息提取关键词
const processMessages = () => {
  if (!AUTO_JOIN || GROUP_CONFIGS.length === 0) return;
  
  for (const config of GROUP_CONFIGS) {
    const messages = getUnprocessedMessages(config.groupId, config.botId);
    for (const msg of messages) {
      const keyword = extractKeyword(msg.text);
      if (keyword) {
        const prize = extractPrize(msg.text);
        saveKeyword(msg.message_id, msg.chat_id, keyword, prize);
        console.log(`[lottery] 从 ${config.groupId} 提取关键词: ${keyword}`);
      }
      markMessageProcessed(msg.id);
    }
  }
};

// 3. 发送关键词
const sendKeywords = async (client: any) => {
  if (!AUTO_JOIN) return;
  
  const keywords = getPendingKeywords();
  for (const item of keywords) {
    try {
      const peer = await client.getInputEntity(item.chat_id);
      await client.sendMessage(peer, { message: item.keyword });
      markKeywordSent(item.id);
      console.log(`[lottery] 已发送关键词: ${item.keyword} 到 ${item.chat_id}`);
    } catch (e) {
      console.error(`[lottery] 发送失败:`, e);
    }
  }
};

// ============ 插件定义 ============

const lotteryPlugin: Plugin = {
  name: "lottery",
  version: "2.1.0",
  description: "🎰 自动抽奖插件 v2.1 - 支持多群组",
  author: "NexBot",

  async onInit(client: any) {
    initDB();
    loadGroupConfigs();
    
    setInterval(() => processMessages(), 3000);
    setInterval(() => sendKeywords(client), 5000);
    
    console.log(`[lottery] v2.1 已启动，监控 ${GROUP_CONFIGS.length} 个群组`);
  },

  async onMessage(msg: Api.Message, client: any) {
    await messageHandler(msg);
  },

  commands: {
    lottery: {
      description: "查看抽奖状态和监控的群组",
      examples: ["lottery"],
      handler: async (msg, args, ctx) => {
        const prefix = process.env.CMD_PREFIX || ".";
        const pending = getPendingKeywords().length;
        const groups = getGroupList();
        
        let groupText = groups.map((g, i) => `${i + 1}. ${g.groupId} → ${g.botId}`).join("\n") || "无";
        
        const text = `${EMOJI.LOTTERY} <b>自动抽奖 v2.1</b>\n\n` +
          `${EMOJI.CONFIG} 自动参与: ${AUTO_JOIN ? "开启" : "关闭"}\n` +
          `⏳ 待发送: ${pending} 个关键词\n` +
          `${EMOJI.GROUP} 监控群组 (${groups.length}):\n${groupText}\n\n` +
          `命令:\n` +
          `${prefix}lottadd 群组ID BotID\n` +
          `${prefix}lottdel 群组ID\n` +
          `${prefix}lotton / ${prefix}lottoff`;
        await ctx.editHTML(text);
      }
    },
    
    lottadd: {
      description: "添加监控群组",
      examples: ["lottadd -1001234567890 6461022460"],
      handler: async (msg, args, ctx) => {
        if (args.length < 2) {
          await ctx.editHTML(`${EMOJI.ERROR} <b>用法错误</b>\n\n.lottadd <群组ID> <BotID>\n示例: .lottadd -1001234567890 6461022460`);
          return;
        }
        if (addGroup(args[0], args[1])) {
          await ctx.editHTML(`${EMOJI.SUCCESS} <b>已添加群组</b>\n\n${EMOJI.GROUP} ${args[0]}\n${EMOJI.BOT} ${args[1]}`);
        } else {
          await ctx.editHTML(`${EMOJI.ERROR} <b>添加失败</b>`);
        }
      }
    },
    
    lottdel: {
      description: "删除监控群组",
      examples: ["lottdel -1001234567890"],
      handler: async (msg, args, ctx) => {
        if (args.length < 1) {
          await ctx.editHTML(`${EMOJI.ERROR} <b>用法错误</b>\n\n.lottdel <群组ID>`);
          return;
        }
        if (removeGroup(args[0])) {
          await ctx.editHTML(`${EMOJI.SUCCESS} <b>已删除群组</b>\n\n${EMOJI.GROUP} ${args[0]}`);
        } else {
          await ctx.editHTML(`${EMOJI.ERROR} <b>删除失败</b>`);
        }
      }
    },
    
    lotton: {
      description: "开启自动参与",
      examples: ["lotton"],
      handler: async (msg, args, ctx) => {
        AUTO_JOIN = true;
        await ctx.editHTML(`${EMOJI.SUCCESS} <b>自动参与已开启</b>`);
      }
    },
    
    lottoff: {
      description: "关闭自动参与",
      examples: ["lottoff"],
      handler: async (msg, args, ctx) => {
        AUTO_JOIN = false;
        await ctx.editHTML(`${EMOJI.ERROR} <b>自动参与已关闭</b>`);
      }
    }
  }
};

export default lotteryPlugin;
