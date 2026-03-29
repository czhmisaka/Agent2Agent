import * as mqtt from 'mqtt';
import { mqttUrl } from '../config';

type MessageHandler = (topic: string, message: any) => void;

export interface MqttCredentials {
  username: string;
  password: string;
}

export class MqttClientService {
  private client: mqtt.MqttClient | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private credentials: MqttCredentials | null = null;

  async connect(credentials?: MqttCredentials): Promise<void> {
    return new Promise((resolve, reject) => {
      this.credentials = credentials || null;
      const options: mqtt.IClientOptions = {
        clientId: `mqtt-chat-client-${Date.now()}`,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 1000
      };

      if (credentials) {
        options.username = credentials.username;
        options.password = credentials.password;
      }

      this.client = mqtt.connect(mqttUrl, options);

      this.client.on('connect', () => {
        console.log('MQTT client connected');
        resolve();
      });

      this.client.on('error', (err) => {
        console.error('MQTT client error:', err);
        reject(err);
      });

      this.client.on('message', (topic, payload) => {
        try {
          const message = JSON.parse(payload.toString());
          this.notifyHandlers(topic, message);
        } catch (error) {
          console.error('Error parsing MQTT message:', error);
        }
      });

      this.client.on('offline', () => {
        console.log('MQTT client offline');
      });

      this.client.on('reconnect', () => {
        console.log('MQTT client reconnecting...');
      });
    });
  }

  subscribe(topic: string, handler: MessageHandler): void {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }

    // 添加处理器
    const handlers = this.messageHandlers.get(topic) || [];
    handlers.push(handler);
    this.messageHandlers.set(topic, handlers);

    // 订阅主题
    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error(`Error subscribing to ${topic}:`, err);
      } else {
        console.log(`Subscribed to ${topic}`);
      }
    });
  }

  unsubscribe(topic: string, handler?: MessageHandler): void {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }

    if (handler) {
      // 移除特定处理器
      const handlers = this.messageHandlers.get(topic) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        this.messageHandlers.set(topic, handlers);
      }
    } else {
      // 移除所有处理器
      this.messageHandlers.delete(topic);
    }

    // 取消订阅
    this.client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`Error unsubscribing from ${topic}:`, err);
      }
    });
  }

  publish(topic: string, message: any, qos: 0 | 1 | 2 = 1): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      const payload = JSON.stringify(message);
      
      this.client.publish(topic, payload, { qos }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      console.log('MQTT client disconnected');
    }
  }

  async reconnectWithCredentials(credentials: MqttCredentials): Promise<void> {
    // 保存当前订阅的主题和处理器
    const savedHandlers = new Map(this.messageHandlers);

    // 断开现有连接
    this.disconnect();

    // 重新连接 with credentials
    await this.connect(credentials);

    // 重新订阅之前的主题
    for (const [topic, handlers] of savedHandlers) {
      for (const handler of handlers) {
        this.subscribe(topic, handler);
      }
    }
  }

  isConnected(): boolean {
    return this.client?.connected || false;
  }

  private notifyHandlers(topic: string, message: any): void {
    // 精确匹配
    const exactHandlers = this.messageHandlers.get(topic);
    if (exactHandlers) {
      exactHandlers.forEach(handler => handler(topic, message));
    }

    // 通配符匹配
    for (const [pattern, handlers] of this.messageHandlers.entries()) {
      if (this.matchTopic(pattern, topic)) {
        handlers.forEach(handler => handler(topic, message));
      }
    }
  }

  private matchTopic(pattern: string, topic: string): boolean {
    if (pattern === topic) {
      return true;
    }

    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') {
        return true;
      }
      if (patternParts[i] === '+') {
        if (i < topicParts.length) {
          continue;
        }
        return false;
      }
      if (patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    return patternParts.length === topicParts.length;
  }
}
