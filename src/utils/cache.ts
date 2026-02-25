/**
 * 缓存工具
 * 提供内存缓存和持久化缓存功能
 */

import { logger } from "./logger.js";

interface CacheEntry<T> {
  value: T;
  expiry: number | null;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

class Cache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };
  private maxSize: number;
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: { maxSize?: number; defaultTTL?: number; cleanupInterval?: number } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 默认5分钟
    
    // 启动定期清理
    const cleanupMs = options.cleanupInterval || 60 * 1000; // 每分钟清理
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupMs);
  }

  /**
   * 设置缓存
   */
  set(key: string, value: T, ttl?: number): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const expiry = ttl !== undefined ? (ttl === 0 ? null : Date.now() + ttl) : 
                   (this.defaultTTL === 0 ? null : Date.now() + this.defaultTTL);

    this.cache.set(key, {
      value,
      expiry,
      createdAt: Date.now(),
    });

    this.stats.size = this.cache.size;
  }

  /**
   * 获取缓存
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // 检查是否过期
    if (entry.expiry !== null && Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return undefined;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * 检查是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (entry.expiry !== null && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    logger.info("缓存已清空");
  }

  /**
   * 获取或设置缓存
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry !== null && now > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.size = this.cache.size;
      logger.debug(`缓存清理: 删除了 ${cleaned} 个过期条目`);
    }
  }

  /**
   * 淘汰最久未使用的条目
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug(`缓存淘汰: ${oldestKey}`);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * 销毁缓存
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// 导出默认缓存实例
export const defaultCache = new Cache();
export { Cache };
