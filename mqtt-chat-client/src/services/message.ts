import { HttpService } from './http';
import { MqttClientService } from '../mqtt/client';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

export class MessageService {
  private httpService: HttpService;
  private mqttClient: MqttClientService;
  private userId: string | null = null;
  private token: string | null = null;

  constructor(httpService: HttpService, mqttClient: MqttClientService) {
    this.httpService = httpService;
    this.mqttClient = mqttClient;
  }

  setCredentials(userId: string, token: string): void {
    this.userId = userId;
    this.token = token;
    this.httpService.setToken(token);
  }

  setToken(token: string): void {
    this.token = token;
    this.httpService.setToken(token);
  }

  async sendMessage(groupId: string, content: string, userId: string): Promise<boolean> {
    try {
      // 通过 MQTT 发送消息（认证已在连接时完成，不再传递 token）
      await this.mqttClient.publish(`chat/group/${groupId}/message`, {
        type: 'message',
        timestamp: new Date().toISOString(),
        payload: {
          userId: userId,
          content
        },
        meta: {
          messageId: uuidv4(),
          groupId
        }
      }, 2);

      console.log(chalk.green('✅ Message sent'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to send message:'), error);
      return false;
    }
  }

  async sendPrivateMessage(receiverId: string, content: string, senderId: string): Promise<boolean> {
    try {
      // 通过 MQTT 发送私聊消息（认证已在连接时完成，不再传递 token）
      await this.mqttClient.publish(`chat/user/${receiverId}/private`, {
        type: 'message',
        timestamp: new Date().toISOString(),
        payload: {
          senderId: senderId,
          content
        },
        meta: {
          messageId: uuidv4(),
          receiverId
        }
      }, 2);

      console.log(chalk.green('✅ Private message sent'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to send private message:'), error);
      return false;
    }
  }

  async getHistory(groupId: string, limit: number = 50): Promise<void> {
    try {
      const messages = await this.httpService.getGroupMessages(groupId, limit);
      
      if (messages.length === 0) {
        console.log(chalk.yellow('\n📜 No messages in this group yet'));
        console.log(chalk.gray('  Be the first to say something!\n'));
        return;
      }

      console.log(chalk.yellow(`\n📜 Message History (last ${messages.length}):`));
      console.log(chalk.gray('─'.repeat(60)));
      
      messages.forEach((msg: any) => {
        const time = new Date(msg.created_at).toLocaleString();
        const sender = msg.nickname || msg.username;
        console.log(`${chalk.gray(time)}`);
        console.log(`${chalk.cyan(sender)}: ${msg.content}`);
      });
      
      console.log(chalk.gray('─'.repeat(60)));
      console.log();
    } catch (error) {
      console.error(chalk.red('❌ Failed to get message history:'), error);
    }
  }

  async getPrivateHistory(userId: string, limit: number = 50): Promise<void> {
    try {
      const messages = await this.httpService.getPrivateMessages(userId, limit);

      if (messages.length === 0) {
        console.log(chalk.yellow('\n📜 No private messages yet'));
        return;
      }

      console.log(chalk.yellow(`\n📜 Private Message History (last ${messages.length}):`));
      console.log(chalk.gray('─'.repeat(60)));

      messages.forEach((msg: any) => {
        const time = new Date(msg.created_at).toLocaleString();
        const sender = msg.sender_username;
        console.log(`${chalk.gray(time)}`);
        console.log(`${chalk.cyan(sender)}: ${msg.content}`);
      });

      console.log(chalk.gray('─'.repeat(60)));
      console.log();
    } catch (error) {
      console.error(chalk.red('❌ Failed to get private messages:'), error);
    }
  }

  async getMentions(limit: number = 50): Promise<void> {
    try {
      const mentions = await this.httpService.getMentions(limit);

      if (!mentions || mentions.length === 0) {
        console.log(chalk.yellow('\n💬 You have no mentions yet.'));
        console.log(chalk.gray('  Mention someone with @username to get noticed\n'));
        return;
      }

      console.log(chalk.yellow(`\n💬 Your Mentions (${mentions.length}):`));
      console.log(chalk.gray('─'.repeat(60)));

      mentions.forEach((mention: any) => {
        const time = new Date(mention.createdAt || mention.timestamp).toLocaleString();
        const sender = mention.senderUsername || mention.sender?.username || 'Unknown';
        const groupName = mention.groupName || mention.groupId || '';
        console.log(`${chalk.gray(time)} ${chalk.yellow(`in ${groupName}`)}`);
        console.log(`  ${chalk.cyan(sender)}: "${mention.content || mention.preview || ''}"`);
      });

      console.log(chalk.gray('─'.repeat(60)));
      console.log();
    } catch (error) {
      console.error(chalk.red('❌ Failed to get mentions:'), error);
    }
  }

  async getStats(userId?: string): Promise<void> {
    try {
      const stats = await this.httpService.getStats(userId);

      if (!stats) {
        console.log(chalk.yellow('\n📊 No stats available\n'));
        return;
      }

      const { totalMessages = 0, totalWords = 0, mentions = 0, reactions = 0, groupsJoined = 0, messagesReceived = 0 } = stats;

      console.log(chalk.yellow(`
${chalk.bold('📊 Message Statistics')}
${chalk.gray('─'.repeat(40))}
  📝 Total Messages Sent:  ${chalk.cyan(totalMessages)}
  📖 Total Words:          ${chalk.cyan(totalWords)}
  💬 Times Mentioned:      ${chalk.cyan(mentions)}
  👍 Reactions Received:   ${chalk.cyan(reactions)}
  👥 Groups Joined:        ${chalk.cyan(groupsJoined)}
  📥 Messages Received:     ${chalk.cyan(messagesReceived)}
${chalk.gray('─'.repeat(40))}
`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to get stats:'), error);
    }
  }
}
