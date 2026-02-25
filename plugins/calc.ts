/**
 * 计算器插件 - 改编自 TeleBox calc
 * 功能：安全计算数学表达式，支持 + - * / 和括号
 */

import { Plugin } from "../src/types/index.js";
import { fmt } from "../src/utils/context.js";

// 应用Emoji
const EMOJI = {
  CALC: "🧮",
  SUCCESS: "✅",
  ERROR: "❌",
  HELP: "❓",
  RESULT: "📝",
  EXPRESSION: "📐",
  ARROW: "→",
};

const MAX_EXPR_LENGTH = 500;

const helpText = `${EMOJI.CALC} <b>计算器</b>

<b>功能：</b>
• 安全计算数学表达式
• 支持 + - * / 四则运算
• 支持括号优先级

<b>用法：</b>
<code>.calc &lt;表达式&gt;</code>

<b>示例：</b>
<code>.calc 1+2+3</code>
<code>.calc (10+20)*3</code>
<code>.calc 100/4-5</code>
<code>.calc 3.14*2</code>`;

// 安全数学解析器
class SafeMathParser {
  private static operators: Record<string, { precedence: number }> = {
    "+": { precedence: 1 },
    "-": { precedence: 1 },
    "*": { precedence: 2 },
    "/": { precedence: 2 },
  };

  private static tokenize(expr: string): string[] {
    const cleaned = expr.replace(/\s+/g, "");
    if (!cleaned) {
      throw new Error("表达式为空");
    }
    if (!/^[0-9+\-*/().]+$/.test(cleaned)) {
      throw new Error("表达式包含不支持的字符");
    }

    const tokens: string[] = [];
    let current = "";

    const pushCurrent = () => {
      if (!current) return;
      if (!this.isNumber(current)) {
        throw new Error(`无效的数字: ${current}`);
      }
      tokens.push(current);
      current = "";
    };

    const isUnaryPosition = (index: number) =>
      index === 0 ||
      cleaned[index - 1] === "(" ||
      cleaned[index - 1] in this.operators;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];

      if (/[0-9.]/.test(char)) {
        current += char;
        continue;
      }

      pushCurrent();

      if ((char === "-" || char === "+") && isUnaryPosition(i)) {
        if (char === "-") {
          if (i + 1 < cleaned.length && cleaned[i + 1] === "(") {
            tokens.push("-1");
            tokens.push("*");
            continue;
          }
          current = "-";
        }
        continue;
      }

      if (!(char in this.operators) && char !== "(" && char !== ")") {
        throw new Error(`未知操作符: ${char}`);
      }

      tokens.push(char);
    }

    pushCurrent();
    return tokens;
  }

  private static infixToPostfix(tokens: string[]): string[] {
    const output: string[] = [];
    const operators: string[] = [];

    for (const token of tokens) {
      if (this.isNumber(token)) {
        output.push(token);
        continue;
      }

      if (token === "(") {
        operators.push(token);
        continue;
      }

      if (token === ")") {
        while (operators.length && operators[operators.length - 1] !== "(") {
          output.push(operators.pop()!);
        }
        if (!operators.length) {
          throw new Error("括号不匹配");
        }
        operators.pop();
        continue;
      }

      while (
        operators.length &&
        operators[operators.length - 1] !== "(" &&
        operators[operators.length - 1] in this.operators &&
        this.operators[operators[operators.length - 1]].precedence >=
          this.operators[token].precedence
      ) {
        output.push(operators.pop()!);
      }
      operators.push(token);
    }

    while (operators.length) {
      const op = operators.pop()!;
      if (op === "(" || op === ")") {
        throw new Error("括号不匹配");
      }
      output.push(op);
    }

    return output;
  }

  private static evaluatePostfix(postfix: string[]): number {
    const stack: number[] = [];

    for (const token of postfix) {
      if (this.isNumber(token)) {
        stack.push(parseFloat(token));
        continue;
      }

      if (!(token in this.operators)) {
        throw new Error(`未知操作符: ${token}`);
      }

      if (stack.length < 2) {
        throw new Error("表达式格式错误");
      }

      const b = stack.pop()!;
      const a = stack.pop()!;

      let result: number;
      switch (token) {
        case "+":
          result = a + b;
          break;
        case "-":
          result = a - b;
          break;
        case "*":
          result = a * b;
          break;
        case "/":
          if (b === 0) {
            throw new Error("除零错误");
          }
          result = a / b;
          break;
        default:
          throw new Error(`未知操作符: ${token}`);
      }

      stack.push(result);
    }

    if (stack.length !== 1) {
      throw new Error("表达式格式错误");
    }

    return stack[0];
  }

  private static isNumber(token: string): boolean {
    return /^-?\d+(\.\d+)?$/.test(token);
  }

  static calculate(expression: string): number {
    const tokens = this.tokenize(expression);
    const postfix = this.infixToPostfix(tokens);
    return this.evaluatePostfix(postfix);
  }
}

// HTML转义
function htmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 格式化结果
function formatResult(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  const rounded = Math.round(value * 1e12) / 1e12;
  return rounded.toString().replace(/\.?0+$/, "");
}

const calcPlugin: Plugin = {
  name: "calc",
  version: "1.0.0",
  description: "科学计算器",
  author: "TeleBox adapted for NexBot",

  commands: {
    calc: {
      description: "计算数学表达式",
      aliases: ["calculator", "math"],
      examples: ["calc 1+2", "calc (10+20)*3", "calc 100/4"],
      handler: async (msg, args, ctx) => {
        try {
          if (args.length === 0) {
            await ctx.replyHTML(helpText);
            return;
          }

          const expression = args.join(" ");

          if (expression.length > MAX_EXPR_LENGTH) {
            await ctx.replyHTML(
              `${EMOJI.ERROR} <b>表达式过长</b>\n\n` +
              `最大长度: ${MAX_EXPR_LENGTH} 字符\n` +
              `当前长度: ${expression.length}`
            );
            return;
          }

          let result: number;
          try {
            result = SafeMathParser.calculate(expression);
          } catch (error: any) {
            await ctx.replyHTML(
              `${EMOJI.ERROR} <b>计算失败</b>\n\n` +
              `表达式: <code>${htmlEscape(expression)}</code>\n` +
              `错误: ${htmlEscape(error?.message ?? "未知错误")}`
            );
            return;
          }

          if (!Number.isFinite(result)) {
            await ctx.replyHTML(
              `${EMOJI.ERROR} <b>计算结果无效</b>\n\n` +
              `表达式: <code>${htmlEscape(expression)}</code>`
            );
            return;
          }

          const formatted = formatResult(result);

          await ctx.replyHTML(
            `${EMOJI.CALC} <b>计算结果</b>\n\n` +
            `<code>${htmlEscape(expression)}</code>\n` +
            `${EMOJI.ARROW} <b>${formatted}</b>`
          );
        } catch (error: any) {
          await ctx.replyHTML(
            `${EMOJI.ERROR} <b>插件错误</b>\n\n${htmlEscape(error?.message ?? "未知错误")}`
          );
        }
      },
    },
  },
};

export default calcPlugin;
