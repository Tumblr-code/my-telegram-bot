/**
 * 通用工具函数
 */

/**
 * 延迟指定毫秒
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 清理插件描述，用于帮助显示
 * 保留中英文数字、标点符号和空格，只移除 emoji 和特殊格式字符
 */
export function cleanPluginDescription(description: string | undefined, maxLength: number = 0): string {
  if (!description) return '插件';
  
  // 取第一行
  let desc = description.split('\n')[0];
  
  // 移除 emoji（Unicode emoji 范围）
  desc = desc.replace(/[\u{1F600}-\u{1F64F}]/gu, '')  // 表情符号
             .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')  // 符号和象形文字
             .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')  // 交通和地图符号
             .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')  // 国旗
             .replace(/[\u{2600}-\u{26FF}]/gu, '')     // 杂项符号
             .replace(/[\u{2700}-\u{27BF}]/gu, '')     // 装饰符号
             .trim();
  
  // 限制长度（仅在 maxLength > 0 时生效）
  if (maxLength > 0 && desc.length > maxLength) {
    desc = desc.slice(0, maxLength) + '...';
  }
  
  return desc || '插件';
}

/**
 * 截断字符串
 */
export function truncate(str: string, maxLength: number, suffix = "..."): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 解析 mentions
 */
export function parseMentions(text: string): string[] {
  const mentions: string[] = [];
  const regex = /@(\w+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}

/**
 * 解析 hashtags
 */
export function parseHashtags(text: string): string[] {
  const hashtags: string[] = [];
  const regex = /#(\w+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    hashtags.push(match[1]);
  }
  return hashtags;
}

/**
 * 随机字符串
 */
export function randomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 格式化数字
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + "B";
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toString();
}

/**
 * 深拷贝
 */
export function deepClone<T>(obj: T): T | null {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return null;
  }
}

/**
 * 防抖
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 节流
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        await sleep(delay * attempt);
      }
    }
  }
  
  throw lastError!;
}

/**
 * 超时包装
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = "Operation timed out"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}
