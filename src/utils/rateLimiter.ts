/**
 * 限流器
 * 防止命令被滥用
 */

import { logger } from "./logger.js";

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDuration?: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private blocked: Map<string, number> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxRequests: config.maxRequests || 10,
      windowMs: config.windowMs || 60000, // 默认1分钟
      blockDuration: config.blockDuration || 300000, // 默认封禁5分钟
    };

    // 每分钟清理一次过期数据
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * 检查是否允许请求
   */
  isAllowed(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();

    // 检查是否被封禁
    const blockedUntil = this.blocked.get(key);
    if (blockedUntil && now < blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockedUntil,
      };
    }

    // 清理已解封的记录
    if (blockedUntil) {
      this.blocked.delete(key);
    }

    // 获取或创建请求记录
    let entry = this.requests.get(key);
    if (!entry || now - entry.firstRequest > this.config.windowMs) {
      entry = {
        count: 0,
        firstRequest: now,
        lastRequest: now,
      };
      this.requests.set(key, entry);
    }

    // 检查是否超过限制
    if (entry.count >= this.config.maxRequests) {
      // 封禁
      const blockUntil = now + (this.config.blockDuration || 300000);
      this.blocked.set(key, blockUntil);
      this.requests.delete(key);
      
      logger.warn(`限流: ${key} 被封禁 ${this.config.blockDuration || 300000}ms`);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockUntil,
      };
    }

    // 更新请求记录
    entry.count++;
    entry.lastRequest = now;

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.firstRequest + this.config.windowMs,
    };
  }

  /**
   * 记录请求
   */
  record(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    return this.isAllowed(key);
  }

  /**
   * 手动封禁
   */
  block(key: string, durationMs?: number): void {
    const until = Date.now() + (durationMs || this.config.blockDuration || 300000);
    this.blocked.set(key, until);
    this.requests.delete(key);
    logger.info(`手动封禁: ${key} 直到 ${new Date(until).toISOString()}`);
  }

  /**
   * 解除封禁
   */
  unblock(key: string): void {
    this.blocked.delete(key);
    this.requests.delete(key);
    logger.info(`解除封禁: ${key}`);
  }

  /**
   * 是否被封禁
   */
  isBlocked(key: string): boolean {
    const blockedUntil = this.blocked.get(key);
    if (!blockedUntil) return false;
    
    if (Date.now() >= blockedUntil) {
      this.blocked.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 获取剩余请求数
   */
  getRemaining(key: string): number {
    const entry = this.requests.get(key);
    if (!entry) return this.config.maxRequests;
    
    if (Date.now() - entry.firstRequest > this.config.windowMs) {
      return this.config.maxRequests;
    }
    
    return Math.max(0, this.config.maxRequests - entry.count);
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    // 清理过期请求记录
    for (const [key, entry] of this.requests.entries()) {
      if (now - entry.firstRequest > this.config.windowMs) {
        this.requests.delete(key);
        cleaned++;
      }
    }

    // 清理已解封的记录
    for (const [key, until] of this.blocked.entries()) {
      if (now >= until) {
        this.blocked.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`限流器清理: ${cleaned} 条记录`);
    }
  }

  /**
   * 清空所有记录
   */
  clear(): void {
    this.requests.clear();
    this.blocked.clear();
    logger.info("限流器已清空");
  }

  /**
   * 获取统计信息
   */
  getStats(): { tracked: number; blocked: number } {
    return {
      tracked: this.requests.size,
      blocked: this.blocked.size,
    };
  }

  /**
   * 销毁限流器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// 导出默认限流器实例 (每分钟10次请求)
export const defaultRateLimiter = new RateLimiter();
export { RateLimiter };
