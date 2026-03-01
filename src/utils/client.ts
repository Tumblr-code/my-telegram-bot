import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { logger } from "./logger.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const SESSION_FILE = join(process.cwd(), "data", "session.txt");

class ClientManager {
  private client: TelegramClient | null = null;
  private session: StringSession;

  constructor() {
    // 优先从文件读取 session，其次从环境变量
    let sessionString = process.env.TELEGRAM_SESSION || "";
    
    // 如果环境变量为空，尝试从文件读取
    if (!sessionString && existsSync(SESSION_FILE)) {
      try {
        sessionString = readFileSync(SESSION_FILE, "utf-8").trim();
        logger.info("已从文件加载 session");
      } catch (err) {
        logger.warn("读取 session 文件失败:", err);
      }
    }
    
    this.session = new StringSession(sessionString);
  }

  async createClient(): Promise<TelegramClient> {
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
    const apiHash = process.env.TELEGRAM_API_HASH || "";

    if (!apiId || apiId === 0) {
      throw new Error("TELEGRAM_API_ID 必须在 .env 中配置 (从 https://my.telegram.org/apps 获取)");
    }
    
    if (!apiHash) {
      throw new Error("TELEGRAM_API_HASH 必须在 .env 中配置 (从 https://my.telegram.org/apps 获取)");
    }

    try {
      this.client = new TelegramClient(this.session, apiId, apiHash, {
        connectionRetries: 5,
        useWSS: true,
        systemVersion: "NexBot/1.0",
      });

      await this.client.connect();
      
      if (!(await this.client.checkAuthorization())) {
        logger.info("需要登录，请按照提示操作...");
        await this.client.start({
          phoneNumber: async () => await this.askQuestion("请输入手机号 (带国家代码，如 +86): "),
          password: async () => await this.askQuestion("请输入二步验证密码 (如果没有直接回车): "),
          phoneCode: async () => await this.askQuestion("请输入验证码: "),
          onError: (err) => logger.error("登录错误:", err),
        });
        
        const sessionString = this.client.session.save() as unknown as string;
        
        // 自动保存 session 到文件
        try {
          const dataDir = join(process.cwd(), "data");
          if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
          }
          writeFileSync(SESSION_FILE, sessionString);
          logger.info("✅ Session 已自动保存到 data/session.txt");
        } catch (err) {
          logger.error("保存 session 失败:", err);
        }
        
        logger.info("登录成功！");
      } else {
        logger.info("已登录到 Telegram");
      }

      return this.client;
    } catch (err) {
      logger.error("创建 Telegram 客户端失败:", err);
      throw err;
    }
  }

  private askQuestion(question: string): Promise<string> {
    return new Promise((resolve, reject) => {
      process.stdout.write(question);
      
      const onData = (data: Buffer) => {
        cleanup();
        resolve(data.toString().trim());
      };
      
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      
      const cleanup = () => {
        process.stdin.removeListener("data", onData);
        process.stdin.removeListener("error", onError);
      };
      
      process.stdin.once("data", onData);
      process.stdin.once("error", onError);
    });
  }

  getClient(): TelegramClient {
    if (!this.client) {
      throw new Error("Telegram 客户端尚未初始化");
    }
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      logger.info("已断开 Telegram 连接");
    }
  }
}

export const clientManager = new ClientManager();
