"use strict";
/**
 * 终端消息渲染器
 * 美化终端输出，支持彩色显示和高亮
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderer = exports.MessageRenderer = void 0;
const chalk_1 = __importDefault(require("chalk"));
class MessageRenderer {
    currentUsername = '';
    typingUsers = new Map();
    maxLineWidth = 60;
    reactionsCache = new Map();
    highlightsCache = new Set();
    pinsCache = new Set();
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
    setCurrentUsername(username) {
        this.currentUsername = username;
    }
    /**
     * 更新终端宽度
     */
    updateTerminalWidth() {
        this.maxLineWidth = (process.stdout.columns || 80) - 10;
    }
    /**
     * 渲染普通消息
     */
    renderMessage(message) {
        const { type, payload } = message;
        if (type === 'message') {
            return this.renderChatMessage(payload);
        }
        else if (type === 'system') {
            return this.renderSystemMessage(payload);
        }
        else if (type === 'mention') {
            return this.renderMentionNotification(payload);
        }
        else if (type === 'subscription_match') {
            return this.renderSubscriptionNotification(payload);
        }
        else if (type === 'message_recalled') {
            return this.renderRecalledMessage(payload);
        }
        else if (type === 'reactions_update') {
            return this.renderReactionsUpdate(payload);
        }
        else if (type === 'message_update') {
            return this.renderMessageUpdate(payload);
        }
        return '';
    }
    /**
     * 渲染聊天消息
     */
    renderChatMessage(payload) {
        const { messageId, content, sender, reactions, flags } = payload;
        if (!content || !sender)
            return '';
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
            output += chalk_1.default.yellow('⭐'.repeat(Math.min(this.maxLineWidth, 60))) + '\n';
        }
        // 置顶消息标记
        if (isPinned) {
            output += chalk_1.default.hex('#FF4500')('📌 ') + chalk_1.default.bold('[Pinned] ');
        }
        // 消息行
        const prefix = isOwnMessage ? chalk_1.default.green('🟢') : chalk_1.default.blue('🔵');
        const usernameColor = isOwnMessage ? chalk_1.default.green : chalk_1.default.cyan;
        // 处理提及（高亮显示）
        const formattedContent = this.formatMentions(content);
        output += `${prefix} ${chalk_1.default.gray(time)} | ${usernameColor(username + ':')} ${formattedContent}`;
        // 高亮消息边框
        if (isHighlighted) {
            output += '\n' + chalk_1.default.yellow('⭐'.repeat(Math.min(this.maxLineWidth, 60)));
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
    renderSystemMessage(payload) {
        const { content } = payload;
        if (!content)
            return '';
        return chalk_1.default.gray(`  └─ ${content}\n`);
    }
    /**
     * 渲染提及通知
     */
    renderMentionNotification(payload) {
        const { sender, groupName, preview } = payload;
        const username = sender.nickname || sender.username;
        return `
${chalk_1.default.cyan('┌─ 💬 提及通知 ─────────────────────────────────')}
${chalk_1.default.cyan('│')}
${chalk_1.default.cyan('│')} ${chalk_1.default.bold('你被')} ${chalk_1.default.cyan(username)} ${chalk_1.default.bold('在')} ${chalk_1.default.yellow(groupName)} ${chalk_1.default.bold('中提及')}
${chalk_1.default.cyan('│')}
${chalk_1.default.cyan('│')} "${this.formatMentions(preview || '')}"
${chalk_1.default.cyan('│')}
${chalk_1.default.cyan('│')} ${chalk_1.default.gray('[查看消息]')} ${chalk_1.default.gray('[标记已读]')}
${chalk_1.default.cyan('│')}
${chalk_1.default.cyan('└────────────────────────────────────────────────')}
`;
    }
    /**
     * 渲染订阅匹配通知
     */
    renderSubscriptionNotification(payload) {
        const { matchType, matchedValue, message, groupName } = payload;
        const typeIcon = matchType === 'keyword' ? '🔑' : matchType === 'topic' ? '#️⃣' : '👤';
        return `
${chalk_1.default.magenta('┌─ 🔔 订阅匹配 ─────────────────────────────────')}
${chalk_1.default.magenta('│')}
${chalk_1.default.magenta('│')} ${chalk_1.default.bold('匹配订阅:')} ${typeIcon} ${chalk_1.default.yellow(matchedValue)}
${chalk_1.default.magenta('│')} ${chalk_1.default.gray('来自')} ${chalk_1.default.cyan(message.sender.username)} ${chalk_1.default.gray('在')} ${chalk_1.default.yellow(groupName)}
${chalk_1.default.magenta('│')}
${chalk_1.default.magenta('│')} "${this.formatMentions(message.content)}"
${chalk_1.default.magenta('│')}
${chalk_1.default.magenta('└────────────────────────────────────────────────')}
`;
    }
    /**
     * 渲染撤回消息
     */
    renderRecalledMessage(payload) {
        const { messageId, recalledBy } = payload;
        return chalk_1.default.gray(`  └─ ⚠️ 消息已被撤回\n`);
    }
    /**
     * 渲染反应更新
     */
    renderReactionsUpdate(payload) {
        const { messageId, reactions } = payload;
        if (reactions) {
            this.reactionsCache.set(messageId, reactions);
        }
        return '';
    }
    /**
     * 渲染消息更新
     */
    renderMessageUpdate(payload) {
        const { messageId, flagType, value } = payload;
        if (flagType === 'highlight' && value) {
            this.highlightsCache.add(messageId);
            return chalk_1.default.yellow(`  ⭐ 消息已被高亮标记\n`);
        }
        else if (flagType === 'highlight' && !value) {
            this.highlightsCache.delete(messageId);
        }
        if (flagType === 'pin' && value) {
            this.pinsCache.add(messageId);
            return chalk_1.default.hex('#FF4500')(`  📌 消息已被置顶\n`);
        }
        else if (flagType === 'pin' && !value) {
            this.pinsCache.delete(messageId);
        }
        return '';
    }
    /**
     * 渲染反应列表
     */
    renderReactions(reactions) {
        if (!reactions || reactions.length === 0)
            return '';
        const parts = reactions.map(r => {
            const usersText = r.users.length <= 3
                ? r.users.join(', ')
                : `${r.users.slice(0, 3).join(', ')} 等${r.users.length}人`;
            return `${r.emoji}${r.count > 1 ? r.count : ''} ${chalk_1.default.gray(usersText)}`;
        });
        return `         💬 ↳ ${parts.join(' ')}`;
    }
    /**
     * 渲染打字状态
     */
    renderTyping(username, isTyping) {
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
        return chalk_1.default.gray(`  💬 ${username} 正在输入...\n`);
    }
    /**
     * 格式化提及（高亮显示）
     */
    formatMentions(content) {
        // 匹配 @username 格式
        const mentionRegex = /@([\w\u4e00-\u9fa5]+)/g;
        return content.replace(mentionRegex, (match, username) => {
            if (username === this.currentUsername) {
                // 自己被提及用特殊颜色
                return chalk_1.default.bgYellow.black(match);
            }
            // 其他提及用青色
            return chalk_1.default.cyan(match);
        });
    }
    /**
     * 渲染帮助信息
     */
    renderHelp() {
        return `
${chalk_1.default.bold('📖 命令帮助')}

${chalk_1.default.bold('基础命令')}
  ${chalk_1.default.cyan('/help')}              显示帮助信息
  ${chalk_1.default.cyan('/login <user> <pwd>')}  登录
  ${chalk_1.default.cyan('/register <user> <pwd>')}  注册
  ${chalk_1.default.cyan('/who')}               查看在线用户
  ${chalk_1.default.cyan('/list')}              列出所有群组
  ${chalk_1.default.cyan('/exit')}              退出

${chalk_1.default.bold('消息操作')}
  ${chalk_1.default.cyan('/highlight <msgId>')}   高亮消息 ⭐
  ${chalk_1.default.cyan('/pin <msgId>')}         置顶消息 📌
  ${chalk_1.default.cyan('/react <msgId> [emoji]')}  添加表情 👍
  ${chalk_1.default.cyan('/recall <msgId>')}      撤回消息

${chalk_1.default.bold('提及')}
  ${chalk_1.default.cyan('@username')}           提及用户
  ${chalk_1.default.cyan('/mention')}             查看提及我的消息

${chalk_1.default.bold('订阅')}
  ${chalk_1.default.cyan('/subscribe keyword <词>')}  订阅关键词 🔔
  ${chalk_1.default.cyan('/subscribe topic <话题>')}  订阅话题
  ${chalk_1.default.cyan('/subscribe user <用户>')}  订阅用户
  ${chalk_1.default.cyan('/subscriptions')}       查看我的订阅

${chalk_1.default.bold('表情')}
  ${chalk_1.default.cyan(':thumbsup:')}          使用表情
  ${chalk_1.default.cyan('/emoji add <名> <表情>')}  添加自定义表情

${chalk_1.default.bold('其他')}
  ${chalk_1.default.cyan('/stats [用户]')}         查看消息统计 📊
  ${chalk_1.default.cyan('/clear')}              清空屏幕

${chalk_1.default.bold('快捷键')}
  ${chalk_1.default.gray('↑/↓')}                 上下翻页
  ${chalk_1.default.gray('Tab')}                 自动补全
  ${chalk_1.default.gray('Ctrl+C')}              退出
`;
    }
    /**
     * 渲染统计信息
     */
    renderStats(stats) {
        const { userId, username, totalMessages, totalWords, mentions, reactions } = stats;
        return `
${chalk_1.default.bold('📊 消息统计')}

  用户: ${chalk_1.default.cyan(username)}
  ──────────────────────
  📝 总消息数: ${chalk_1.default.yellow(totalMessages || 0)}
  📖 总字数:   ${chalk_1.default.yellow(totalWords || 0)}
  💬 提及次数: ${chalk_1.default.yellow(mentions || 0)}
  👍 反应次数: ${chalk_1.default.yellow(reactions || 0)}
`;
    }
    /**
     * 清空屏幕
     */
    clear() {
        // 清除终端
        process.stdout.write('\x1B[2J\x1B[0f');
        console.clear();
    }
    /**
     * 渲染分隔线
     */
    renderDivider() {
        return chalk_1.default.gray('─'.repeat(Math.min(this.maxLineWidth, 60))) + '\n';
    }
    /**
     * 渲染标题
     */
    renderTitle(title) {
        return chalk_1.default.bold.underline(title) + '\n';
    }
    /**
     * 渲染成功消息
     */
    renderSuccess(message) {
        return chalk_1.default.green('✅ ' + message) + '\n';
    }
    /**
     * 渲染错误消息
     */
    renderError(message) {
        return chalk_1.default.red('❌ ' + message) + '\n';
    }
    /**
     * 渲染警告消息
     */
    renderWarning(message) {
        return chalk_1.default.yellow('⚠️  ' + message) + '\n';
    }
    /**
     * 渲染信息消息
     */
    renderInfo(message) {
        return chalk_1.default.blue('ℹ️  ' + message) + '\n';
    }
    /**
     * 清除缓存
     */
    clearCache() {
        this.reactionsCache.clear();
        this.highlightsCache.clear();
        this.pinsCache.clear();
        this.typingUsers.forEach(t => clearTimeout(t));
        this.typingUsers.clear();
    }
}
exports.MessageRenderer = MessageRenderer;
// 导出单例
exports.renderer = new MessageRenderer();
//# sourceMappingURL=renderer.js.map