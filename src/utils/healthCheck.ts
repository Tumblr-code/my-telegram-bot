/**
 * 健康检查工具
 * 用于监控 Bot 运行状态和性能
 */

import { logger } from "./logger.js";

interface HealthMetrics {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  cpu: {
    usage: number;
  };
  messages: {
    total: number;
    errors: number;
  };
  commands: {
    total: number;
    errors: number;
  };
}

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  metrics: HealthMetrics;
  checks: {
    name: string;
    status: "pass" | "fail" | "warn";
    message?: string;
  }[];
}

class HealthChecker {
  private startTime: number = Date.now();
  private messageCount: number = 0;
  private messageErrors: number = 0;
  private commandCount: number = 0;
  private commandErrors: number = 0;
  private lastCheck: number = 0;
  private checkInterval: NodeJS.Timeout | null = null;

  startMonitoring(intervalMs: number = 60000): void {
    // 每分钟执行一次健康检查
    this.checkInterval = setInterval(() => {
      this.performCheck();
    }, intervalMs);
    
    logger.info("健康检查已启动");
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  recordMessage(success: boolean = true): void {
    this.messageCount++;
    if (!success) this.messageErrors++;
  }

  recordCommand(success: boolean = true): void {
    this.commandCount++;
    if (!success) this.commandErrors++;
  }

  private getMemoryUsage(): { used: number; total: number; percent: number } {
    const usage = process.memoryUsage();
    
    // 使用 rss (Resident Set Size) 作为实际内存使用量
    const used = usage.rss;
    
    // 获取系统总内存（如果可用）
    let total: number;
    try {
      // @ts-ignore - Bun 特有的 API
      if (typeof Bun !== "undefined" && Bun.gc) {
        // Bun 运行时，使用 heapSizeLimit 作为参考
        total = (usage as any).heapSizeLimit || usage.heapTotal * 2;
      } else {
        total = usage.heapTotal;
      }
    } catch {
      total = usage.heapTotal;
    }
    
    // 确保 total 有合理的值
    if (!total || total < used) {
      total = Math.max(used * 2, 512 * 1024 * 1024); // 至少 512MB
    }
    
    // 计算百分比
    const percent = Math.round((used / total) * 100);
    
    return {
      used: Math.round(used / 1024 / 1024), // MB
      total: Math.round(total / 1024 / 1024), // MB
      percent: Math.min(percent, 100), // 限制最大 100%
    };
  }

  private async performCheck(): Promise<void> {
    const status = this.getStatus();
    
    if (status.status === "unhealthy") {
      logger.error("健康检查失败:", JSON.stringify(status.checks.filter(c => c.status === "fail")));
    } else if (status.status === "degraded") {
      logger.warn("健康检查警告:", JSON.stringify(status.checks.filter(c => c.status === "warn")));
    }

    this.lastCheck = Date.now();
  }

  getStatus(): HealthStatus {
    const memory = this.getMemoryUsage();
    const uptime = Date.now() - this.startTime;
    
    const checks: HealthStatus["checks"] = [];

    // 内存检查（使用正常阈值）
    if (memory.percent > 85) {
      checks.push({ name: "memory", status: "fail", message: `内存使用率过高: ${memory.percent}%` });
    } else if (memory.percent > 70) {
      checks.push({ name: "memory", status: "warn", message: `内存使用率较高: ${memory.percent}%` });
    } else {
      checks.push({ name: "memory", status: "pass" });
    }

    // 错误率检查
    const messageErrorRate = this.messageCount > 0 ? (this.messageErrors / this.messageCount) * 100 : 0;
    const commandErrorRate = this.commandCount > 0 ? (this.commandErrors / this.commandCount) * 100 : 0;

    if (messageErrorRate > 20) {
      checks.push({ name: "message_errors", status: "fail", message: `消息错误率过高: ${messageErrorRate.toFixed(1)}%` });
    } else if (messageErrorRate > 10) {
      checks.push({ name: "message_errors", status: "warn", message: `消息错误率较高: ${messageErrorRate.toFixed(1)}%` });
    } else {
      checks.push({ name: "message_errors", status: "pass" });
    }

    if (commandErrorRate > 20) {
      checks.push({ name: "command_errors", status: "fail", message: `命令错误率过高: ${commandErrorRate.toFixed(1)}%` });
    } else if (commandErrorRate > 10) {
      checks.push({ name: "command_errors", status: "warn", message: `命令错误率较高: ${commandErrorRate.toFixed(1)}%` });
    } else {
      checks.push({ name: "command_errors", status: "pass" });
    }

    // 确定整体状态
    const failCount = checks.filter(c => c.status === "fail").length;
    const warnCount = checks.filter(c => c.status === "warn").length;

    let status: HealthStatus["status"] = "healthy";
    if (failCount > 0) {
      status = "unhealthy";
    } else if (warnCount > 0) {
      status = "degraded";
    }

    return {
      status,
      metrics: {
        uptime,
        memory,
        cpu: { usage: 0 }, // TODO: 实现 CPU 使用率检测
        messages: {
          total: this.messageCount,
          errors: this.messageErrors,
        },
        commands: {
          total: this.commandCount,
          errors: this.commandErrors,
        },
      },
      checks,
    };
  }

  getStats(): string {
    const status = this.getStatus();
    const m = status.metrics;
    
    return `
📊 运行状态: ${status.status === "healthy" ? "✅ 健康" : status.status === "degraded" ? "⚠️ 降级" : "❌ 异常"}
⏱️ 运行时间: ${Math.floor(m.uptime / 1000 / 60)} 分钟
💾 内存使用: ${m.memory.used}MB / ${m.memory.total}MB (${m.memory.percent}%)
📩 消息处理: ${m.messages.total} 条 (${m.messages.errors} 错误)
⚡ 命令执行: ${m.commands.total} 条 (${m.commands.errors} 错误)
    `.trim();
  }
}

export const healthChecker = new HealthChecker();
