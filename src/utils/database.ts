// @ts-ignore - Bun 内置模块
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { logger } from "./logger.js";

class DatabaseManager {
  private db: Database;
  private path: string;

  constructor() {
    this.path = process.env.DB_PATH || "./data/nexbot.db";
    
    const dir = dirname(this.path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.path);
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");
    
    this.initTables();
    logger.info(`数据库已初始化: ${this.path}`);
  }

  private initTables(): void {
    // 用户权限表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS permissions (
        user_id INTEGER PRIMARY KEY,
        is_sudo INTEGER DEFAULT 0,
        is_whitelist INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // 插件表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS plugins (
        name TEXT PRIMARY KEY,
        version TEXT,
        enabled INTEGER DEFAULT 1,
        config TEXT,
        installed_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // 键值存储表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // 别名表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS aliases (
        alias TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);
  }

  getDB(): Database {
    return this.db;
  }

  // 权限管理
  addSudo(userId: number): void {
    this.db.run(
      `INSERT OR REPLACE INTO permissions (user_id, is_sudo) VALUES (?, 1)`,
      [userId]
    );
  }

  removeSudo(userId: number): void {
    this.db.run(
      `UPDATE permissions SET is_sudo = 0 WHERE user_id = ?`,
      [userId]
    );
  }

  isSudo(userId: number): boolean {
    const row = this.db.query(
      `SELECT is_sudo FROM permissions WHERE user_id = ?`
    ).get(userId) as { is_sudo: number } | null;
    return row?.is_sudo === 1;
  }

  getSudoList(): number[] {
    const rows = this.db.query(
      `SELECT user_id FROM permissions WHERE is_sudo = 1`
    ).all() as { user_id: number }[];
    return rows.map(r => r.user_id);
  }

  // 插件管理
  savePlugin(name: string, version: string, config?: object): void {
    this.db.run(
      `INSERT OR REPLACE INTO plugins (name, version, config) VALUES (?, ?, ?)`,
      [name, version, config ? JSON.stringify(config) : null]
    );
  }

  removePlugin(name: string): void {
    this.db.run(`DELETE FROM plugins WHERE name = ?`, [name]);
  }

  isPluginEnabled(name: string): boolean {
    const row = this.db.query(
      `SELECT enabled FROM plugins WHERE name = ?`
    ).get(name) as { enabled: number } | null;
    // 如果插件不在数据库中，默认禁用（需要手动安装）
    if (!row) return false;
    return row.enabled === 1;
  }

  enablePlugin(name: string): void {
    this.db.run(
      `INSERT OR REPLACE INTO plugins (name, enabled, installed_at) VALUES (?, 1, unixepoch())`,
      [name]
    );
  }

  disablePlugin(name: string): void {
    this.db.run(
      `UPDATE plugins SET enabled = 0 WHERE name = ?`,
      [name]
    );
  }

  getAllPluginsFromDB(): { name: string; version: string; enabled: boolean }[] {
    const rows = this.db.query(
      `SELECT name, version, enabled FROM plugins ORDER BY name`
    ).all() as { name: string; version: string; enabled: number }[];
    return rows.map(r => ({
      name: r.name,
      version: r.version || "1.0.0",
      enabled: r.enabled === 1,
    }));
  }

  // 键值存储
  set(key: string, value: any): void {
    this.db.run(
      `INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, unixepoch())`,
      [key, JSON.stringify(value)]
    );
  }

  get<T = any>(key: string, defaultValue?: T): T | undefined {
    const row = this.db.query(
      `SELECT value FROM kv_store WHERE key = ?`
    ).get(key) as { value: string } | null;
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      logger.warn(`JSON 解析失败 for key: ${key}`);
      return defaultValue;
    }
  }

  delete(key: string): void {
    this.db.run(`DELETE FROM kv_store WHERE key = ?`, [key]);
  }

  // 别名管理
  setAlias(alias: string, command: string): void {
    this.db.run(
      `INSERT OR REPLACE INTO aliases (alias, command) VALUES (?, ?)`,
      [alias, command]
    );
  }

  removeAlias(alias: string): void {
    this.db.run(`DELETE FROM aliases WHERE alias = ?`, [alias]);
  }

  getAlias(alias: string): string | null {
    const row = this.db.query(
      `SELECT command FROM aliases WHERE alias = ?`
    ).get(alias) as { command: string } | null;
    return row?.command || null;
  }

  getAllAliases(): Record<string, string> {
    const rows = this.db.query(`SELECT alias, command FROM aliases`).all() as { alias: string; command: string }[];
    return Object.fromEntries(rows.map(r => [r.alias, r.command]));
  }

  close(): void {
    this.db.close();
  }
}

export const db = new DatabaseManager();
