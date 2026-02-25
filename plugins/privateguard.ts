/**
 * 私聊保护插件 - 人机验证版
 * 功能：陌生人私聊你时，自动要求其完成验证，否则自动删除消息
 * 适用于：User Bot（gramJS 登录的账号）
 */
import { Plugin } from "../src/utils/pluginBase.js";
import { Api } from "telegram";
import { CallbackQuery } from "telegram/events/CallbackQuery.js";
import * as fs from "fs";
import * as path from "path";

// 数据存储
const DATA_DIR = path.join(process.cwd(), "data");
const ALLOWED_FILE = path.join(DATA_DIR, "privateguard_allowed.json");
const PENDING_FILE = path.join(DATA_DIR, "privateguard_pending.json");
const BLOCKED_FILE = path.join(DATA_DIR, "privateguard_blocked.json"); // 黑名单文件

// 验证类型
type VerifyType = "math" | "click" | "random";

// 点击验证状态
interface ClickVerifyState {
  sequence: number[];      // 正确的点击顺序
  clicked: number[];       // 用户已点击的顺序
  buttons: number[];       // 按钮显示的数字（随机打乱）
}

// 验证中会话
interface PendingVerify {
  userId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  verifyType: VerifyType;
  // 数学验证用
  answer?: number;
  question?: string;
  // 点击验证用
  clickState?: ClickVerifyState;
  timestamp: number;
  attempts: number;
  chatId: string;
}

// 内存存储
let allowedUsers: Map<string, { verifiedAt: number; username?: string }> = new Map();
let pendingUsers: Map<string, PendingVerify> = new Map();
let blockedUsers: Map<string, { blockedAt: number; username?: string; reason?: string }> = new Map(); // 黑名单

// 配置
const CONFIG = {
  MAX_ATTEMPTS: 3,
  EXPIRE_MINUTES: 3, // 超时时间改为3分钟
  WHITELIST: [] as string[], // 白名单用户ID（无需验证）
  VERIFY_TYPE: "math" as VerifyType, // 验证类型: "math" | "click" | "random"
  CLICK_BUTTON_COUNT: 4, // 点击验证的按钮数量
};

// 获取当前验证类型（处理随机情况）
const getVerifyType = (): VerifyType => {
  // 只使用数学验证
  return "math";
};

// 确保目录
const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

// 加载数据
const loadData = () => {
  ensureDir();
  try {
    if (fs.existsSync(ALLOWED_FILE)) {
      const data = JSON.parse(fs.readFileSync(ALLOWED_FILE, "utf-8"));
      allowedUsers = new Map(Object.entries(data.allowed || {}));
      console.log(`[privateguard] 已加载 ${allowedUsers.size} 个已验证用户`);
    }
    if (fs.existsSync(PENDING_FILE)) {
      const data = JSON.parse(fs.readFileSync(PENDING_FILE, "utf-8"));
      // 只加载未过期的
      const now = Date.now();
      for (const [key, value] of Object.entries(data.pending || {})) {
        const pending = value as PendingVerify;
        if (now - pending.timestamp < CONFIG.EXPIRE_MINUTES * 60 * 1000) {
          pendingUsers.set(key, pending);
        }
      }
    }
    // 加载黑名单
    if (fs.existsSync(BLOCKED_FILE)) {
      const data = JSON.parse(fs.readFileSync(BLOCKED_FILE, "utf-8"));
      blockedUsers = new Map(Object.entries(data.blocked || {}));
      console.log(`[privateguard] 已加载 ${blockedUsers.size} 个黑名单用户`);
    }
  } catch (error) {
    console.error("[privateguard] 加载数据失败:", error);
  }
};

// 保存数据
const saveData = () => {
  ensureDir();
  try {
    const allowedObj: Record<string, any> = {};
    allowedUsers.forEach((value, key) => {
      allowedObj[key] = value;
    });
    fs.writeFileSync(
      ALLOWED_FILE,
      JSON.stringify({ allowed: allowedObj }, null, 2)
    );

    const pendingObj: Record<string, any> = {};
    pendingUsers.forEach((value, key) => {
      pendingObj[key] = value;
    });
    fs.writeFileSync(
      PENDING_FILE,
      JSON.stringify({ pending: pendingObj }, null, 2)
    );
    
    // 保存黑名单
    const blockedObj: Record<string, any> = {};
    blockedUsers.forEach((value, key) => {
      blockedObj[key] = value;
    });
    fs.writeFileSync(
      BLOCKED_FILE,
      JSON.stringify({ blocked: blockedObj }, null, 2)
    );
  } catch (error) {
    console.error("[privateguard] 保存数据失败:", error);
  }
};

// 拉黑用户
const blockUser = (userId: string, username?: string, reason?: string) => {
  blockedUsers.set(userId, {
    blockedAt: Date.now(),
    username,
    reason: reason || "验证失败",
  });
  // 从白名单和待验证列表中移除
  allowedUsers.delete(userId);
  pendingUsers.delete(userId);
  saveData();
  console.log(`[privateguard] 用户 ${userId} 已被拉黑，原因: ${reason || "验证失败"}`);
};

// 解除拉黑
const unblockUser = (userId: string) => {
  if (blockedUsers.has(userId)) {
    blockedUsers.delete(userId);
    saveData();
    console.log(`[privateguard] 用户 ${userId} 已从黑名单移除`);
    return true;
  }
  return false;
};

// 检查用户是否被拉黑
const isBlocked = (userId: string): boolean => {
  return blockedUsers.has(userId);
};

// 生成数学题
const generateMath = (): { q: string; a: number } => {
  const ops = ["+", "-", "×"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, ans: number;

  switch (op) {
    case "+":
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
      ans = a + b;
      break;
    case "-":
      a = Math.floor(Math.random() * 20) + 10;
      b = Math.floor(Math.random() * a);
      ans = a - b;
      break;
    case "×":
      a = Math.floor(Math.random() * 9) + 2;
      b = Math.floor(Math.random() * 9) + 2;
      ans = a * b;
      break;
    default:
      a = 1; b = 1; ans = 2;
  }

  return { q: `${a} ${op} ${b}`, a: ans };
};

// 生成点击验证
const generateClickVerify = (): ClickVerifyState => {
  const count = CONFIG.CLICK_BUTTON_COUNT;
  const sequence = Array.from({ length: count }, (_, i) => i + 1);
  const buttons = [...sequence].sort(() => Math.random() - 0.5);
  return {
    sequence,
    clicked: [],
    buttons,
  };
};

// 构建点击验证键盘
const buildClickKeyboard = (state: ClickVerifyState) => {
  const rows = [];
  const cols = 2;
  for (let i = 0; i < state.buttons.length; i += cols) {
    const row = [];
    for (let j = i; j < Math.min(i + cols, state.buttons.length); j++) {
      const num = state.buttons[j];
      row.push({
        text: num.toString(),
        data: `pgclick:${num}`,
      });
    }
    rows.push(row);
  }
  return rows;
};

// 发送验证
const sendVerify = async (
  client: any,
  chatId: string,
  userInfo: { id: string; username?: string; firstName?: string; lastName?: string }
): Promise<number | null> => {
  const verifyType = getVerifyType();

  try {
    if (verifyType === "click") {
      // 点击验证
      const clickState = generateClickVerify();
      const pending: PendingVerify = {
        userId: userInfo.id,
        username: userInfo.username,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        verifyType: "click",
        clickState,
        timestamp: Date.now(),
        attempts: 0,
        chatId,
      };
      pendingUsers.set(userInfo.id, pending);
      saveData();

      const message = await client.sendMessage(chatId, {
        message: [
          "🛡️ 私聊安全验证",
          "",
          `请按从小到大的顺序点击数字：${clickState.sequence.join(" → ")}`,
          "",
          `剩余次数：${CONFIG.MAX_ATTEMPTS} 次`,
        ].join("\n"),
        buttons: buildClickKeyboard(clickState),
      });

      return message.id;
    } else {
      // 数学验证
      const { q, a } = generateMath();
      const pending: PendingVerify = {
        userId: userInfo.id,
        username: userInfo.username,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        verifyType: "math",
        answer: a,
        question: q,
        timestamp: Date.now(),
        attempts: 0,
        chatId,
      };
      pendingUsers.set(userInfo.id, pending);
      saveData();

      const message = await client.sendMessage(chatId, {
        message: [
          "🛡️ 私聊安全验证",
          "",
          `请计算：${q} = ?`,
          "",
          `请直接回复答案（${CONFIG.EXPIRE_MINUTES}分钟内有效）`,
          `剩余 ${CONFIG.MAX_ATTEMPTS} 次机会`,
        ].join("\n"),
      });

      return message.id;
    }
  } catch (error) {
    console.error("[privateguard] 发送验证失败:", error);
    return null;
  }
};

// 删除消息
const deleteMessage = async (client: any, chatId: string, msgId: number): Promise<void> => {
  try {
    await client.deleteMessages(chatId, [msgId], { revoke: true });
  } catch (error) {
    // 忽略删除错误
  }
};

// 处理点击验证
const handleClickVerify = async (
  client: any,
  userId: string,
  clickedNum: number
): Promise<{ finished: boolean; success?: boolean; message?: string }> => {
  const pending = pendingUsers.get(userId);
  if (!pending || !pending.clickState) {
    return { finished: true, success: false, message: "验证已过期" };
  }

  const state = pending.clickState;
  const expected = state.sequence[state.clicked.length];

  if (clickedNum !== expected) {
    // 点击错误
    pending.attempts++;

    if (pending.attempts >= CONFIG.MAX_ATTEMPTS) {
      // 失败次数过多
      pendingUsers.delete(userId);
      blockUser(userId, pending.username, "验证失败次数过多");
      return { finished: true, success: false, message: "❌ 验证失败次数过多，你已被拉黑" };
    }

    // 重置点击状态
    state.clicked = [];
    saveData();

    return {
      finished: false,
      message: `❌ 顺序错误，请重新开始（剩余 ${CONFIG.MAX_ATTEMPTS - pending.attempts} 次）`,
    };
  }

  // 点击正确
  state.clicked.push(clickedNum);

  if (state.clicked.length === state.sequence.length) {
    // 验证成功
    allowedUsers.set(userId, {
      verifiedAt: Date.now(),
      username: pending.username,
    });
    pendingUsers.delete(userId);
    saveData();

    return { finished: true, success: true, message: "✅ 验证通过！你现在可以正常私聊了" };
  }

  // 继续验证
  saveData();
  return {
    finished: false,
    message: `✓ 正确！继续点击下一个数字`,
  };
};

// 检查答案
const checkAnswer = async (
  client: any,
  msg: Api.Message,
  text: string,
  userInfo: { id: string }
): Promise<boolean> => {
  const userId = userInfo.id;
  const pending = pendingUsers.get(userId);

  if (!pending || pending.verifyType !== "math") {
    return false;
  }

  // 检查是否超时
  if (Date.now() - pending.timestamp > CONFIG.EXPIRE_MINUTES * 60 * 1000) {
    console.log(`[privateguard] 用户 ${userId} 验证超时`);
    pendingUsers.delete(userId);
    blockUser(userId, pending.username, "验证超时");
    await client.sendMessage(pending.chatId, {
      message: "⏱️ 验证超时，你已被拉黑",
    });
    return false;
  }

  // 解析答案
  const answer = parseInt(text.trim());
  if (isNaN(answer)) {
    console.log(`[privateguard] 用户 ${userId} 答案不是数字: ${text}`);
    return false;
  }

  console.log(`[privateguard] 用户 ${userId} 答案: ${answer}, 正确答案: ${pending.answer}`);

  if (answer === pending.answer) {
    // 答案正确
    console.log(`[privateguard] 用户 ${userId} 验证成功`);
    allowedUsers.set(userId, {
      verifiedAt: Date.now(),
      username: pending.username,
    });
    pendingUsers.delete(userId);
    saveData();

    // 删除验证题目消息
    const verifyMsgId = verifyMessageIds.get(userId);
    if (verifyMsgId) {
      await deleteMessage(client, pending.chatId, verifyMsgId);
      verifyMessageIds.delete(userId);
      console.log(`[privateguard] 已删除验证消息: ${verifyMsgId}`);
    }

    // 发送成功消息
    await client.sendMessage(pending.chatId, {
      message: "✅ 验证通过！你现在可以正常私聊了",
    });

    return true;
  } else {
    // 答案错误
    pending.attempts++;
    const remaining = CONFIG.MAX_ATTEMPTS - pending.attempts;
    console.log(`[privateguard] 用户 ${userId} 答案错误，剩余次数: ${remaining}`);

    if (remaining <= 0) {
      // 三次失败，拉黑用户
      console.log(`[privateguard] 次数用尽，拉黑用户 ${userId}`);
      pendingUsers.delete(userId);
      blockUser(userId, pending.username, "验证失败次数过多");
      await client.sendMessage(pending.chatId, {
        message: "❌ 验证失败次数过多，你已被拉黑",
      });
    } else {
      // 生成新题目
      console.log(`[privateguard] 生成新题目给用户 ${userId}`);
      const { q: newQ, a: newA } = generateMath();
      pending.question = newQ;
      pending.answer = newA;
      pending.timestamp = Date.now(); // 重置超时时间
      saveData();
      
      // 删除旧验证消息
      const oldVerifyMsgId = verifyMessageIds.get(userId);
      console.log(`[privateguard] 旧验证消息ID: ${oldVerifyMsgId}`);
      if (oldVerifyMsgId) {
        await deleteMessage(client, pending.chatId, oldVerifyMsgId);
      }
      
      const newVerifyMsg = await client.sendMessage(pending.chatId, {
        message: [
          "🛡️ 私聊安全验证",
          "",
          "答案错误，已换新题！",
          "",
          `请计算：${newQ} = ?`,
          "",
          `剩余 ${remaining} 次机会`,
        ].join("\n"),
      });
      
      // 保存新验证消息ID
      verifyMessageIds.set(userId, newVerifyMsg.id);
      console.log(`[privateguard] 新验证消息ID: ${newVerifyMsg.id}`);
    }
    return false;
  }
};

// 存储验证消息的ID，用于更新
const verifyMessageIds = new Map<string, number>();

// 检查是否是私聊（支持多种方式）
const isPrivateChat = (msg: Api.Message): boolean => {
  const chat = msg.chat;
  if (!chat) {
    // 尝试通过 peerId 判断
    const peerId = (msg as any).peerId;
    if (peerId && (peerId.className === "PeerUser" || peerId.userId)) {
      return true;
    }
    return false;
  }
  
  // 方式1：通过 className 判断（User 是私聊）
  if (chat.className === "User") {
    return true;
  }
  
  // 方式2：通过 peerId 类型判断
  const peerId = (msg as any).peerId;
  if (peerId && (peerId.className === "PeerUser" || peerId.userId)) {
    return true;
  }
  
  // 方式3：检查是否有 chat 的 type 属性
  const chatType = (chat as any).type;
  if (chatType === "user" || chatType === "private") {
    return true;
  }
  
  // 方式4：通过检查 chat 是否有 id 但没有 title（群组/频道有 title）
  if ((chat as any).id && !(chat as any).title) {
    return true;
  }
  
  // 方式5：通过 _chatPeer 判断
  const chatPeer = (msg as any)._chatPeer;
  if (chatPeer && chatPeer.className === "PeerUser") {
    return true;
  }
  
  return false;
};

// 获取发送者 ID（多种方式）
const getSenderId = (msg: Api.Message): string | null => {
  // 方式1：直接获取 senderId
  const senderId = (msg as any).senderId;
  if (senderId) {
    return senderId.toString();
  }
  
  // 方式2：从 _senderId 获取
  const _senderId = (msg as any)._senderId;
  if (_senderId) {
    return _senderId.toString();
  }
  
  // 方式3：从 fromId 获取
  const fromId = (msg as any).fromId;
  if (fromId) {
    if (typeof fromId === "string" || typeof fromId === "number") {
      return fromId.toString();
    }
    if (fromId.userId) {
      return fromId.userId.toString();
    }
  }
  
  return null;
};

// 获取发送者信息
const getSenderInfo = async (msg: Api.Message): Promise<{id: string, username?: string, firstName?: string, lastName?: string, isBot?: boolean} | null> => {
  // 先尝试从消息中直接获取 senderId
  const userId = getSenderId(msg);
  
  // 尝试获取 sender 对象
  try {
    const sender = await msg.getSender();
    if (sender && (sender.className === "User" || sender.className === "UserEmpty" || (sender as any).id)) {
      const id = userId || (sender as any).id?.toString();
      if (id) {
        // 检查是否是机器人
        const isBot = (sender as any).bot === true || (sender as any).isBot === true;
        return {
          id,
          username: (sender as any).username || (sender as any).usernames?.[0]?.username,
          firstName: (sender as any).firstName,
          lastName: (sender as any).lastName,
          isBot,
        };
      }
    }
  } catch (e) {
    // getSender 失败，使用 userId
  }
  
  // 如果只有 userId，返回基本信息
  if (userId) {
    return { id: userId };
  }
  
  return null;
};

// 主消息处理器
const messageHandler = async (msg: Api.Message): Promise<void> => {
  try {
    const client = (msg as any).client;
    if (!client) {
      console.log("[privateguard] 错误：无法获取 client");
      return;
    }

    // 只处理私聊
    const chat = msg.chat;
    const isPrivate = isPrivateChat(msg);
    
    if (!isPrivate) {
      return;
    }

    // 获取 chatId - 尝试多种方式
    let chatId = "";
    
    if (chat?.id) {
      // 处理 BigInt 类型
      try {
        chatId = chat.id.toString ? chat.id.toString() : String(chat.id);
      } catch(e) {
        chatId = String(chat.id);
      }
    }
    
    // 如果 chat.id 获取失败，尝试从 peerId 获取
    if (!chatId) {
      const msgPeerId = (msg as any).peerId;
      if (msgPeerId?.userId) {
        try {
          chatId = msgPeerId.userId.toString ? msgPeerId.userId.toString() : String(msgPeerId.userId);
        } catch(e) {
          chatId = String(msgPeerId.userId);
        }
      }
    }
    
    const msgId = msg.id;
    const isOutgoing = (msg as any).out === true || (msg as any).outgoing === true;
    
    // 获取自己的 ID
    const me = await client.getMe();
    const myId = me?.id?.toString ? me.id.toString() : String(me?.id);
    
    // 在私聊中，chatId 就是对方的 userId
    // 对方发来的消息：chatId 是对方ID
    // 自己发出的消息：chatId 也是对方ID
    const targetUserId = chatId;
    
    // 尝试获取 senderInfo 来检查是否是机器人
    const senderInfo = await getSenderInfo(msg);
    const isBot = senderInfo?.isBot || false;
    
    // console.log(`[privateguard] 收到私聊消息 chatId=${chatId}, targetUserId=${targetUserId}, isOutgoing=${isOutgoing}, myId=${myId}, isBot=${isBot}`);

    // 如果是自己发出的消息（主动私聊别人），自动将对方加入白名单并跳过
    if (isOutgoing) {
      // 主动发消息给对方，说明是认识的，自动信任对方
      if (targetUserId && targetUserId !== myId && !allowedUsers.has(targetUserId)) {
        allowedUsers.set(targetUserId, {
          verifiedAt: Date.now(),
          username: (chat as any).username,
        });
        saveData();
        console.log(`[privateguard] 主动私聊用户 ${targetUserId}，已自动加入白名单`);
      }
      return;
    }
    
    // 如果获取不到 targetUserId，跳过
    if (!targetUserId || targetUserId === myId) {
      console.log(`[privateguard] 跳过：targetUserId 无效或与 myId 相同`);
      return;
    }
    
    // 跳过机器人
    if (isBot) {
      console.log(`[privateguard] 跳过机器人消息: ${targetUserId}`);
      return;
    }

    // 检查白名单
    if (CONFIG.WHITELIST.includes(targetUserId)) {
      console.log(`[privateguard] 用户 ${targetUserId} 在白名单中，跳过验证`);
      return;
    }

    // 检查是否已验证
    if (allowedUsers.has(targetUserId)) {
      console.log(`[privateguard] 用户 ${targetUserId} 已验证，跳过验证`);
      return;
    }
    
    // 检查是否被拉黑
    if (isBlocked(targetUserId)) {
      console.log(`[privateguard] 用户 ${targetUserId} 已被拉黑，删除消息`);
      await deleteMessage(client, chatId, msgId);
      return;
    }

    // 获取消息文本
    const text = ((msg as any).text || (msg as any).message || "").trim();

    // 检查是否正在验证中
    const pending = pendingUsers.get(targetUserId);

    if (!pending) {
      // 首次私聊，删除消息并发送验证
      console.log(`[privateguard] 用户 ${targetUserId} 首次私聊，发送验证...`);
      await deleteMessage(client, chatId, msgId);
      const verifyMsgId = await sendVerify(client, chatId, { id: targetUserId, ...senderInfo });
      if (verifyMsgId) {
        verifyMessageIds.set(targetUserId, verifyMsgId);
      }
      console.log(`[privateguard] 用户 ${targetUserId} 已要求验证`);
      throw new Error("PRIVATE_GUARD_VERIFY_REQUIRED");
    } else {
      // 正在验证中
      console.log(`[privateguard] 用户 ${targetUserId} 正在验证中，消息类型: ${pending.verifyType}`);
      if (pending.verifyType === "click") {
        // 点击验证：删除消息，不处理文字回复
        await deleteMessage(client, chatId, msgId);
        throw new Error("PRIVATE_GUARD_CLICK_REQUIRED");
      } else {
        // 数学验证：检查答案
        const isCorrect = await checkAnswer(client, msg, text, { id: targetUserId });
        // 无论对错都删除这条消息
        await deleteMessage(client, chatId, msgId);
        
        if (!isCorrect) {
          throw new Error("PRIVATE_GUARD_WRONG_ANSWER");
        }
        // 验证成功，让下一条消息正常处理
      }
    }
  } catch (error) {
    // 重新抛出特定错误，让上层处理
    if (error instanceof Error && error.message.startsWith("PRIVATE_GUARD_")) {
      throw error;
    }
    // 其他错误记录但不影响流程
    console.error("[privateguard] messageHandler 错误:", error);
  }
};

// 处理回调查询（点击验证按钮）
const callbackHandler = async (event: any): Promise<void> => {
  const callbackQuery = event.query;
  if (!callbackQuery) return;

  const data = callbackQuery.data?.toString() || "";
  if (!data.startsWith("pgclick:")) return;

  const client = (event as any).client;
  if (!client) return;

  const userId = callbackQuery.userId?.toString() || "";
  const msgId = event.messageId;
  
  // 从查询中获取 chatId
  let chatId: string | undefined;
  try {
    const message = await event.getMessage();
    chatId = message?.chat?.id?.toString();
  } catch (e) {
    // 如果无法获取消息，使用 pending 中的 chatId
  }

  // 检查是否已验证
  if (allowedUsers.has(userId)) {
    await event.answer({
      alert: true,
      message: "✅ 你已经验证过了",
    });
    return;
  }

  const pending = pendingUsers.get(userId);
  if (!pending || pending.verifyType !== "click") {
    await event.answer({
      alert: true,
      message: "⏱️ 验证已过期，请重新发送消息",
    });
    return;
  }

  const clickedNum = parseInt(data.replace("pgclick:", ""));
  const result = await handleClickVerify(client, userId, clickedNum);

  if (result.finished) {
    // 验证结束（成功或失败）
    if (msgId && chatId) {
      try {
        await client.deleteMessages(chatId, [msgId], { revoke: true });
      } catch (e) {
        // 忽略删除错误
      }
    }
    await client.sendMessage(pending.chatId, {
      message: result.message || "",
      parseMode: "html",
    });
  } else {
    // 验证进行中，更新键盘
    if (msgId && chatId) {
      try {
        await client.editMessage(chatId, {
          message: msgId,
          text: [
            "🛡️ 私聊安全验证",
            "",
            `请按从小到大的顺序点击数字：${pending.clickState?.sequence.join(" → ")}`,
            "",
            `剩余次数：${CONFIG.MAX_ATTEMPTS - pending.attempts} 次`,
            `进度：${pending.clickState?.clicked.length || 0}/${pending.clickState?.sequence.length || CONFIG.CLICK_BUTTON_COUNT}`,
          ].join("\n"),
          buttons: pending.clickState ? buildClickKeyboard(pending.clickState) : undefined,
        });
      } catch (e) {
        // 编辑失败可能是消息太旧，发送新消息
      }
    }
    
    // 显示点击反馈
    await event.answer({
      alert: result.message?.startsWith("❌") || false,
      message: result.message,
    });
  }
};

// 管理命令：查看列表
const listCommand = async (msg: Api.Message): Promise<void> => {
  const client = (msg as any).client;
  const allowedList = Array.from(allowedUsers.entries());
  const pendingList = Array.from(pendingUsers.entries());

  // 构建用户列表（放入折叠块）
  let userListText = "";
  if (allowedList.length > 0) {
    allowedList.forEach(([id, info], index) => {
      const username = info.username ? `@${info.username}` : "";
      userListText += `${index + 1}. ${id} ${username}\n`;
    });
  } else {
    userListText += "暂无已验证用户";
  }
  
  let text = "<b>📊 私聊保护统计</b>\n\n";
  text += `✅ 已验证用户：${allowedList.length} 人\n`;
  text += `⏳ 验证中用户：${pendingList.length} 人\n\n`;
  text += `<blockquote expandable>${userListText.trim()}</blockquote>`;

  await client.sendMessage(msg.chatId!, {
    message: text,
    parseMode: "html",
  });
};

// 管理命令：添加白名单
const allowCommand = async (msg: Api.Message): Promise<void> => {
  const text = (msg as any).text || "";
  const parts = text.trim().split(/\s+/);
  const targetId = parts[1];

  if (!targetId) {
    await msg.reply({
      message: "❌ 请指定用户ID\n用法：.pgallow 用户ID",
    });
    return;
  }

  allowedUsers.set(targetId, { verifiedAt: Date.now() });
  pendingUsers.delete(targetId);
  saveData();

  await msg.reply({
    message: `✅ 用户 ${targetId} 已添加到白名单`,
  });
};

// 管理命令：移除白名单
const removeCommand = async (msg: Api.Message): Promise<void> => {
  const text = (msg as any).text || "";
  const parts = text.trim().split(/\s+/);
  const targetId = parts[1];

  if (!targetId) {
    await msg.reply({
      message: "❌ 请指定用户ID\n用法：.pgremove 用户ID",
    });
    return;
  }

  if (allowedUsers.has(targetId)) {
    allowedUsers.delete(targetId);
    saveData();
    await msg.reply({
      message: `✅ 用户 ${targetId} 已移出白名单，下次私聊需重新验证`,
    });
  } else {
    await msg.reply({
      message: `⚠️ 用户 ${targetId} 不在白名单中`,
    });
  }
};

// 管理命令：开关功能（通过设置白名单或清空数据）
const resetCommand = async (msg: Api.Message): Promise<void> => {
  const allowedCount = allowedUsers.size;
  const pendingCount = pendingUsers.size;
  
  allowedUsers.clear();
  pendingUsers.clear();
  saveData();
  
  await msg.reply({
    message: `🗑️ 数据已重置\n\n已清理 ${allowedCount} 个已验证用户\n已清理 ${pendingCount} 个验证中会话`,
  });
};

// 初始化
loadData();

// 切换验证类型命令
const setTypeCommand = async (msg: Api.Message): Promise<void> => {
  const text = (msg as any).text || "";
  const parts = text.trim().split(/\s+/);
  const type = parts[1]?.toLowerCase();

  if (!type || (type !== "math" && type !== "click" && type !== "random")) {
    await msg.reply({
      message: `📝 可用验证类型：\n• math - 数学计算\n• click - 顺序点击\n• random - 随机混合\n\n用法：.pgtype math\n当前类型：${CONFIG.VERIFY_TYPE}`,
    });
    return;
  }

  CONFIG.VERIFY_TYPE = type as VerifyType;
  const typeName = type === "math" ? "数学计算" : type === "click" ? "顺序点击" : "随机混合";
  
  await msg.reply({
    message: `✅ 验证类型已设置为：${typeName}`,
  });
};

// 查看黑名单命令
const listBlockedCommand = async (msg: Api.Message): Promise<void> => {
  const client = (msg as any).client;
  const blockedList = Array.from(blockedUsers.entries());

  // 构建黑名单列表（放入折叠块）
  let blockedListText = "";
  if (blockedList.length > 0) {
    blockedList.forEach(([id, info], index) => {
      const username = info.username ? `@${info.username}` : "";
      const reason = info.reason || "";
      blockedListText += `${index + 1}. ${id} ${username} (${reason})\n`;
    });
  } else {
    blockedListText += "暂无黑名单用户";
  }

  let text = "<b>🚫 黑名单列表</b>\n\n";
  text += `共 ${blockedList.length} 人\n\n`;
  text += `<blockquote expandable>${blockedListText.trim()}</blockquote>`;

  await client.sendMessage(msg.chatId!, {
    message: text,
    parseMode: "html",
  });
};

// 拉黑用户命令
const blockCommand = async (msg: Api.Message): Promise<void> => {
  const text = (msg as any).text || "";
  const parts = text.trim().split(/\s+/);
  const targetId = parts[1];

  if (!targetId) {
    await msg.reply({
      message: "❌ 请指定用户ID\n用法：.pgblock 用户ID",
    });
    return;
  }

  blockUser(targetId, undefined, "手动拉黑");
  await msg.reply({
    message: `🚫 用户 ${targetId} 已被拉黑`,
  });
};

// 解除拉黑命令
const unblockCommand = async (msg: Api.Message): Promise<void> => {
  const text = (msg as any).text || "";
  const parts = text.trim().split(/\s+/);
  const targetId = parts[1];

  if (!targetId) {
    await msg.reply({
      message: "❌ 请指定用户ID\n用法：.pgunblock 用户ID",
    });
    return;
  }

  if (unblockUser(targetId)) {
    await msg.reply({
      message: `✅ 用户 ${targetId} 已从黑名单移除`,
    });
  } else {
    await msg.reply({
      message: `⚠️ 用户 ${targetId} 不在黑名单中`,
    });
  }
};

class PrivateGuardPlugin extends Plugin {
  name = "privateguard";
  description = `🛡️ 私聊保护插件

功能：陌生人私聊时自动要求完成数学验证，否则消息自动删除

验证方式：
• 数学计算 - 回复计算结果

工作原理：
1. 陌生人首次私聊 → 自动删消息 + 发送数学题
2. 完成验证 → 加入白名单，后续消息正常
3. 验证失败或超时 → 继续删除消息

管理命令：
.pglist         - 查看已验证用户
.pgallow ID     - 添加白名单
.pgremove ID    - 移除白名单
.pgreset        - 重置所有数据
.pgblock ID     - 拉黑用户
.pgunblock ID   - 解除拉黑
.pgblocklist    - 查看黑名单

验证规则：
• 3次失败自动拉黑
• 3分钟超时自动拉黑
• 通过后自动删除验证消息

提示：只处理普通用户私聊，机器人和群组不受影响`;

  cmdHandlers = {
    pglist: listCommand,
    pgallow: allowCommand,
    pgremove: removeCommand,
    pgreset: resetCommand,
    pgtype: setTypeCommand,
    pgblock: blockCommand,
    pgunblock: unblockCommand,
    pgblocklist: listBlockedCommand,
  };

  // 监听所有私聊消息
  onMessage = messageHandler;
}

export default new PrivateGuardPlugin();
