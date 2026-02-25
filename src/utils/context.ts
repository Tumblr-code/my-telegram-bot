import { TelegramClient, Api } from "telegram";
import { CommandContext, ReplyOptions, Message } from "../types/index.js";

export function createContext(
  client: TelegramClient,
  msg: Message,
  isSudo: boolean
): CommandContext {
  const chatId = msg.chatId;
  const messageId = msg.id;

  return {
    client,
    isSudo,
    isPrivate: msg.chat?.className === "User",
    isGroup: msg.chat?.className === "Chat" || (msg.chat?.className === "Channel" && (msg.chat as any).megagroup),
    isChannel: msg.chat?.className === "Channel" && !(msg.chat as any).megagroup,

    async reply(text: string, options: ReplyOptions = {}): Promise<Api.Message> {
      return await client.sendMessage(chatId!, {
        message: text,
        replyTo: options.replyToMessageId ? Number(options.replyToMessageId) : Number(messageId),
        parseMode: options.parseMode,
        silent: options.silent,
        linkPreview: options.disableWebPagePreview === false,
      });
    },

    async replyHTML(html: string, options: ReplyOptions = {}): Promise<Api.Message> {
      return await this.reply(html, { ...options, parseMode: "html" });
    },

    async deleteMessage(): Promise<void> {
      try {
        await client.deleteMessages(chatId!, [messageId], { revoke: true });
      } catch (err) {
        // 忽略删除错误
      }
    },
  };
}

// HTML 转义工具
export function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 格式化工具
export const fmt = {
  bold: (text: string) => `<b>${escapeHTML(text)}</b>`,
  italic: (text: string) => `<i>${escapeHTML(text)}</i>`,
  code: (text: string) => `<code>${escapeHTML(text)}</code>`,
  pre: (text: string, lang?: string) => 
    lang ? `<pre><code class="language-${lang}">${escapeHTML(text)}</code></pre>` : `<pre>${escapeHTML(text)}</pre>`,
  link: (text: string, url: string) => `<a href="${url}">${escapeHTML(text)}</a>`,
  mention: (userId: number, name: string) => `<a href="tg://user?id=${userId}">${escapeHTML(name)}</a>`,
  // 引用块（折叠显示长文本）
  blockquote: (text: string) => `<blockquote>${escapeHTML(text)}</blockquote>`,
  // 可折叠引用块
  spoiler: (text: string) => `<span class="tg-spoiler">${escapeHTML(text)}</span>`,
};
