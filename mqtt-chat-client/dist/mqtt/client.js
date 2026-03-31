"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttClientService = void 0;
const mqtt = __importStar(require("mqtt"));
const config_1 = require("../config");
class MqttClientService {
    client = null;
    messageHandlers = new Map();
    credentials = null;
    async connect(credentials) {
        return new Promise((resolve, reject) => {
            this.credentials = credentials || null;
            const options = {
                clientId: `mqtt-chat-client-${Date.now()}`,
                clean: true,
                connectTimeout: 5000,
                reconnectPeriod: 1000
            };
            if (credentials) {
                options.username = credentials.username;
                options.password = credentials.password;
            }
            this.client = mqtt.connect(config_1.mqttUrl, options);
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
                }
                catch (error) {
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
    subscribe(topic, handler) {
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
            }
            else {
                console.log(`Subscribed to ${topic}`);
            }
        });
    }
    unsubscribe(topic, handler) {
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
        }
        else {
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
    publish(topic, message, qos = 1) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('MQTT client not connected'));
                return;
            }
            const payload = JSON.stringify(message);
            this.client.publish(topic, payload, { qos }, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    disconnect() {
        if (this.client) {
            this.client.end();
            this.client = null;
            console.log('MQTT client disconnected');
        }
    }
    async reconnectWithCredentials(credentials) {
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
    isConnected() {
        return this.client?.connected || false;
    }
    notifyHandlers(topic, message) {
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
    matchTopic(pattern, topic) {
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
exports.MqttClientService = MqttClientService;
//# sourceMappingURL=client.js.map