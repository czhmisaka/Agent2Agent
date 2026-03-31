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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMqttBroker = startMqttBroker;
exports.getAedes = getAedes;
exports.getClientInfo = getClientInfo;
const aedes_1 = __importDefault(require("aedes"));
const net_1 = require("net");
const ws_1 = require("ws");
const config_1 = require("../config");
const message_1 = require("./handlers/message");
const sqlite_1 = require("../database/sqlite");
const bcrypt = __importStar(require("bcrypt"));
const jwt = __importStar(require("jsonwebtoken"));
const aedes = new aedes_1.default();
// 客户端存储（内存中）
const connectedClients = new Map();
async function startMqttBroker() {
    return new Promise((resolve, reject) => {
        // TCP server
        const tcpServer = (0, net_1.createServer)(aedes.handle);
        tcpServer.listen(config_1.config.mqtt.port, () => {
            console.log(`🔌 MQTT TCP server running on port ${config_1.config.mqtt.port}`);
            resolve();
        });
        tcpServer.on('error', (err) => {
            console.error('❌ MQTT TCP server error:', err);
            reject(err);
        });
        // WebSocket server
        const wsPort = config_1.config.mqtt.websocketPort;
        // 创建 WebSocket 服务器并处理 MQTT over WebSocket
        const wsServer = new ws_1.Server({
            port: wsPort
        });
        wsServer.on('connection', (ws) => {
            aedes.handle(ws);
        });
        wsServer.on('listening', () => {
            console.log(`🌐 MQTT WebSocket server running on port ${wsPort}`);
        });
        // 认证事件 - 验证用户名密码或JWT Token
        aedes.authenticate = (client, username, password, callback) => {
            console.log(`🔑 Client ${client.id} authenticating as ${username}`);
            if (!username || !password) {
                callback(new Error('Username and password required'), false);
                return;
            }
            try {
                const passwordStr = password.toString();
                const db = (0, sqlite_1.getDatabase)();
                // 尝试将密码作为JWT token验证
                try {
                    const decoded = jwt.verify(passwordStr, config_1.config.jwt.secret);
                    // JWT token 验证成功
                    connectedClients.set(client.id, {
                        clientId: client.id,
                        userId: decoded.userId,
                        username: decoded.username,
                        connectedAt: new Date()
                    });
                    console.log(`✅ Client ${client.id} authenticated via JWT as ${decoded.username} (userId: ${decoded.userId})`);
                    callback(null, true);
                    return;
                }
                catch (jwtError) {
                    // JWT 验证失败，尝试用户名密码验证
                    console.log(`JWT verification failed, trying username/password...`);
                }
                // 用户名密码验证
                const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
                if (!user) {
                    callback(new Error('User not found'), false);
                    return;
                }
                const validPassword = bcrypt.compareSync(passwordStr, user.password_hash);
                if (!validPassword) {
                    callback(new Error('Invalid credentials'), false);
                    return;
                }
                // 存储客户端信息
                connectedClients.set(client.id, {
                    clientId: client.id,
                    userId: user.id,
                    username: user.username,
                    connectedAt: new Date()
                });
                console.log(`✅ Client ${client.id} authenticated as ${username} (userId: ${user.id})`);
                callback(null, true);
            }
            catch (error) {
                console.error('❌ Authentication error:', error);
                callback(new Error('Authentication error'), false);
            }
        };
        // authorizePublish - 修复参数签名以兼容 aedes
        aedes.authorizePublish = (client, packet, callback) => {
            if (typeof callback !== 'function') {
                console.warn('authorizePublish: callback is not a function, skipping');
                return;
            }
            callback(null, packet);
        };
        // authorizeSubscribe - 修复参数签名以兼容 aedes  
        aedes.authorizeSubscribe = (client, sub, callback) => {
            if (typeof callback !== 'function') {
                console.warn('authorizeSubscribe: callback is not a function, skipping');
                return;
            }
            callback(null, sub);
        };
        // 客户端连接事件
        aedes.on('client', (client) => {
            console.log(`✅ Client connected: ${client.id}`);
        });
        // 客户端断开事件
        aedes.on('clientDisconnect', (client) => {
            console.log(`👋 Client disconnected: ${client.id}`);
            const clientInfo = connectedClients.get(client.id);
            if (clientInfo?.userId) {
                const db = (0, sqlite_1.getDatabase)();
                db.prepare('UPDATE users SET is_online = 0 WHERE id = ?').run(clientInfo.userId);
                console.log(`🔴 User ${clientInfo.username} (userId: ${clientInfo.userId}) is now offline`);
            }
            connectedClients.delete(client.id);
        });
        // 消息事件
        aedes.on('publish', (packet, client) => {
            if (client) {
                console.log(`📨 Message from ${client.id} on topic ${packet.topic}`);
                // 确保 payload 是 Buffer
                const payload = Buffer.isBuffer(packet.payload) ? packet.payload : Buffer.from(packet.payload);
                (0, message_1.handleMessage)(client, packet.topic, payload);
            }
        });
    });
}
function getAedes() {
    return aedes;
}
function getClientInfo(clientId) {
    return connectedClients.get(clientId);
}
//# sourceMappingURL=broker.js.map