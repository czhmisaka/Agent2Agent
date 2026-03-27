/**
 * 终端消息渲染器
 * 美化终端输出，支持彩色显示和高亮
 */

import chalk from 'chalk';

export interface MessageData {
  type: string;
  payload: {
    messageId?: string;
    content?: string;
    sender?: {
      userId: string;
      username: string;
      nickname?: string;
    };
    reactions?: ReactionData[];
    flags?: {
      highlight?: boolean;
      pin?: boolean;
      urgent?: boolean;
    };
    preview?: string;
    senderUsername?: string;
    groupName?: string;
    matchType?: string;
    matchedValue?: string;
    mentionedContent?: string;
    [key: string]: any;
  };
  meta?: any;
}

export interface ReactionData {
  emoji: string;
  count: number;
  users: string[];
}

export interface MentionNotification {
  type: 'mention';
  payload: {
    messageId: string;
    sender: {
      userId: string;
      username: string;
      nickname?: string;
    };
    groupId: string;
    groupName: string;
    preview: string;
    mentionedContent: string;
  };
}

export interface SubscriptionNotification {
  type: 'subscription_match';
  payload: {
    matchType: string;
    matchedValue: string;
    message: {
      messageId: string;
      content: string;
      sender: {
        userId: string;
        username: string;
      };
    };
    groupId: string;
    groupName: string;
  };
}

export interface TypingStatus {
  username: string;
  isTyping: boolean;
}

export class MessageRenderer {
  private currentUsername: string = '';
  private typingUsers: Map<string, NodeJS.Timeout> = new Map();
  private maxLineWidth: number = 60;
  private reactionsCache: Map<string, ReactionData[]> = new Map();
  private highlightsCache: Set<string> = new Set();
  private pinsCache: Set<string> = new Set();

  constructor() {
    // 获取终端宽度
    this.updateTerminalWidth();
    
    // 监听终端大小变化
    if (process.stdout.on) {
      process.stdout.on('resize', () => this.updateTerminalWidth());
    }
  }

  /**
   * 设置当前用户名
   */
  setCurrentUsername(username: string): void {
    this.currentUsername = username;
  }

  /**
   * 更新终端宽度
   */
  private updateTerminalWidth(): void {
    this.maxLineWidth = (process.stdout.columns || 80) - 10;
  }

  /**
   * 渲染普通消息
   */
  renderMessage(message: MessageData): string {
    const { type, payload } = message;
    
    if (type === 'message') {
      return this.renderChatMessage(payload);
    } else if (type === 'system') {
      return this.renderSystemMessage(payload);
    } else if (type === 'mention') {
      return this.renderMentionNotification(payload as any);
    } else if (type === 'subscription_match') {
      return this.renderSubscriptionNotification(payload as any);
    } else if (type === 'message_recalled') {
      return this.renderRecalledMessage(payload);
    } else if (type === 'reactions_update') {
      return this.renderReactionsUpdate(payload);
    } else if (type === 'message_update') {
      return this.renderMessageUpdate(payload);
    }
    
    return '';
  }

  /**
   * 渲染聊天消息
   */
  private renderChatMessage(payload: any): string {
    const { messageId, content, sender, reactions, flags } = payload;
    
    if (!content || !sender) return '';
    
    // 检查是否为高亮消息
    const isHighlighted = flags?.highlight || this.highlightsCache.has(messageId);
    const isPinned = flags?.pin || this.pinsCache.has(messageId);
    
    // 获取时间
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    // 格式化用户名
    const username = sender.nickname || sender.username;
    const isOwnMessage = sender.username === this.currentUsername;
    
    // 获取反应缓存
    const cachedReactions = this.reactionsCache.get(messageId) || reactions || [];
    
    // 构建输出
    let output = '';
    
    // 高亮消息边框
    if (isHighlighted) {
      output += chalk.yellow('⭐'.repeat(Math.min(this.maxLineWidth, 60))) + '\n';
    }
    
    // 置顶消息标记
    if (isPinned) {
      output += chalk.hex('#FF4500')('📌 ') + chalk.bold('[Pinned] ');
    }
    
    // 消息行
    const prefix = isOwnMessage ? chalk.green('🟢') : chalk.blue('🔵');
    const usernameColor = isOwnMessage ? chalk.green : chalk.cyan;
    
    // 处理提及（高亮显示）
    const formattedContent = this.formatMentions(content);
    
    output += `${prefix} ${chalk.gray(time)} | ${usernameColor(username + ':')} ${formattedContent}`;
    
    // 高亮消息边框
    if (isHighlighted) {
      output += '\n' + chalk.yellow('⭐'.repeat(Math.min(this.maxLineWidth, 60)));
    }
    
    // 渲染反应
    if (cachedReactions.length > 0) {
      output += '\n' + this.renderReactions(cachedReactions);
    }
    
    return output + '\n';
  }

  /**
   * 渲染系统消息
   */
  private renderSystemMessage(payload: any): string {
    const { content } = payload;
    
    if (!content) return '';
    
    return chalk.gray(`  └─ ${content}\n`);
  }

  /**
   * 渲染提及通知
   */
  private renderMentionNotification(payload: MentionNotification['payload']): string {
    const { sender, groupName, preview } = payload;
    
    const username = sender.nickname || sender.username;
    
    return `
${chalk.cyan('┌─ 💬 提及通知 ─────────────────────────────────')}
${chalk.cyan('│')}
${chalk.cyan('│')} ${chalk.bold('你被')} ${chalk.cyan(username)} ${chalk.bold('在')} ${chalk.yellow(groupName)} ${chalk.bold('中提及')}
${chalk.cyan('│')}
${chalk.cyan('│')} "${this.formatMentions(preview || '')}"
${chalk.cyan('│')}
${chalk.cyan('│')} ${chalk.gray('[查看消息]')} ${chalk.gray('[标记已读]')}
${chalk.cyan('│')}
${chalk.cyan('└────────────────────────────────────────────────')}
`;
  }

  /**
   * 渲染订阅匹配通知
   */
  private renderSubscriptionNotification(payload: SubscriptionNotification['payload']): string {
    const { matchType, matchedValue, message, groupName } = payload;
    
    const typeIcon = matchType === 'keyword' ? '🔑' : matchType === 'topic' ? '#️⃣' : '👤';
    
    return `
${chalk.magenta('┌─ 🔔 订阅匹配 ─────────────────────────────────')}
${chalk.magenta('│')}
${chalk.magenta('│')} ${chalk.bold('匹配订阅:')} ${typeIcon} ${chalk.yellow(matchedValue)}
${chalk.magenta('│')} ${chalk.gray('来自')} ${chalk.cyan(message.sender.username)} ${chalk.gray('在')} ${chalk.yellow(groupName)}
${chalk.magenta('│')}
${chalk.magenta('│')} "${this.formatMentions(message.content)}"
${chalk.magenta('│')}
${chalk.magenta('└────────────────────────────────────────────────')
}
`;
  }

  /**
   * 渲染撤回消息
   */
  private renderRecalledMessage(payload: any): string {
    const { messageId, recalledBy } = payload;
    
    return chalk.gray(`  └─ ⚠️ 消息已被撤回\n`);
  }

  /**
   * 渲染反应更新
   */
  private renderReactionsUpdate(payload: any): string {
    const { messageId, reactions } = payload;
    
    if (reactions) {
      this.reactionsCache.set(messageId, reactions);
    }
    
    return '';
  }

  /**
   * 渲染消息更新
   */
  private renderMessageUpdate(payload: any): string {
    const { messageId, flagType, value } = payload;
    
    if (flagType === 'highlight' && value) {
      this.highlightsCache.add(messageId);
      return chalk.yellow(`  ⭐ 消息已被高亮标记\n`);
    } else if (flagType === 'highlight' && !value) {
      this.highlightsCache.delete(messageId);
    }
    
    if (flagType === 'pin' && value) {
      this.pinsCache.add(messageId);
      return chalk.hex('#FF4500')(`  📌 消息已被置顶\n`);
    } else if (flagType === 'pin' && !value) {
      this.pinsCache.delete(messageId);
    }
    
    return '';
  }

  /**
   * 渲染反应列表
   */
  private renderReactions(reactions: ReactionData[]): string {
    if (!reactions || reactions.length === 0) return '';
    
    const parts = reactions.map(r => {
      const usersText = r.users.length <= 3 
        ? r.users.join(', ') 
        : `${r.users.slice(0, 3).join(', ')} 等${r.users.length}人`;
      
      return `${r.emoji}${r.count > 1 ? r.count : ''} ${chalk.gray(usersText)}`;
    });
    
    return `         💬 ↳ ${parts.join(' ')}`;
  }

  /**
   * 渲染打字状态
   */
  renderTyping(username: string, isTyping: boolean): string {
    if (!isTyping) {
      // 清除打字提示
      const timeout = this.typingUsers.get(username);
      if (timeout) {
        clearTimeout(timeout);
        this.typingUsers.delete(username);
      }
      return '';
    }
    
    // 设置超时自动清除
    const existing = this.typingUsers.get(username);
    if (existing) {
      clearTimeout(existing);
    }
    
    const timeout = setTimeout(() => {
      this.typingUsers.delete(username);
    }, 3000);
    
    this.typingUsers.set(username, timeout);
    
    return chalk.gray(`  💬 ${username} 正在输入...\n`);
  }

  /**
   * 格式化提及（高亮显示）
   */
  private formatMentions(content: string): string {
    // 匹配 @username 格式
    const mentionRegex = /@([\w\u4e00-\u9fa5]+)/g;
    
    return content.replace(mentionRegex, (match, username) => {
      if (username === this.currentUsername) {
        // 自己被提及用特殊颜色
        return chalk.bgYellow.black(match);
      }
      // 其他提及用青色
      return chalk.cyan(match);
    });
  }

  /**
   * 渲染帮助信息
   */
  renderHelp(): string {
    return `
${chalk.bold('📖 命令帮助')}

${chalk.bold('基础命令')}
  ${chalk.cyan('/help')}              显示帮助信息
  ${chalk.cyan('/login <user> <pwd>')}  登录
  ${chalk.cyan('/register <user> <pwd>')}  注册
  ${chalk.cyan('/who')}               查看在线用户
  ${chalk.cyan('/list')}              列出所有群组
  ${chalk.cyan('/exit')}              退出

${chalk.bold('消息操作')}
  ${chalk.cyan('/highlight <msgId>')}   高亮消息 ⭐
  ${chalk.cyan('/pin <msgId>')}         置顶消息 📌
  ${chalk.cyan('/react <msgId> [emoji]')}  添加表情 👍
  ${chalk.cyan('/recall <msgId>')}      撤回消息

${chalk.bold('提及')}
  ${chalk.cyan('@username')}           提及用户
  ${chalk.cyan('/mention')}             查看提及我的消息

${chalk.bold('订阅')}
  ${chalk.cyan('/subscribe keyword <词>')}  订阅关键词 🔔
  ${chalk.cyan('/subscribe topic <话题>')}  订阅话题
  ${chalk.cyan('/subscribe user <用户>')}  订阅用户
  ${chalk.cyan('/subscriptions')}       查看我的订阅

${chalk.bold('表情')}
  ${chalk.cyan(':thumbsup:')}          使用表情
  ${chalk.cyan('/emoji add <名> <表情>')}  添加自定义表情

${chalk.bold('其他')}
  ${chalk.cyan('/stats [用户]')}         查看消息统计 📊
  ${chalk.cyan('/clear')}              清空屏幕

${chalk.bold('快捷键')}
  ${chalk.gray('↑/↓')}                 上下翻页
  ${chalk.gray('Tab')}                 自动补全
  ${chalk.gray('Ctrl+C')}              退出
`;
  }

  /**
   * 渲染统计信息
   */
  renderStats(stats: any): string {
    const { userId, username, totalMessages, totalWords, mentions, reactions } = stats;
    
    return `
${chalk.bold('📊 消息统计')}

  用户: ${chalk.cyan(username)}
  ──────────────────────
  📝 总消息数: ${chalk.yellow(totalMessages || 0)}
  📖 总字数:   ${chalk.yellow(totalWords || 0)}
  💬 提及次数: ${chalk.yellow(mentions || 0)}
  👍 反应次数: ${chalk.yellow(reactions || 0)}
`;
  }

  /**
   * 清空屏幕
   */
  clear(): void {
    // 清除终端
    process.stdout.write('\x1B[2J\x1B[0f');
    console.clear();
  }

  /**
   * 渲染分隔线
   */
  renderDivider(): string {
    return chalk.gray('─'.repeat(Math.min(this.maxLineWidth, 60))) + '\n';
  }

  /**
   * 渲染标题
   */
  renderTitle(title: string): string {
    return chalk.bold.underline(title) + '\n';
  }

  /**
   * 渲染成功消息
   */
  renderSuccess(message: string): string {
    return chalk.green('✅ ' + message) + '\n';
  }

  /**
   * 渲染错误消息
   */
  renderError(message: string): string {
    return chalk.red('❌ ' + message) + '\n';
  }

  /**
   * 渲染警告消息
   */
  renderWarning(message: string): string {
    return chalk.yellow('⚠️  ' + message) + '\n';
  }

  /**
   * 渲染信息消息
   */
  renderInfo(message: string): string {
    return chalk.blue('ℹ️  ' + message) + '\n';
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.reactionsCache.clear();
    this.highlightsCache.clear();
    this.pinsCache.clear();
    this.typingUsers.forEach(t => clearTimeout(t));
    this.typingUsers.clear();
  }
}

// 导出单例
export const renderer = new MessageRenderer();
