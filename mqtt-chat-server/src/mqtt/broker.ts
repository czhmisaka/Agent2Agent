import Aedes, { Client, PublishPacket } from 'aedes';
import { createServer, Server as NetServer } from 'net';
import WebSocket, { Server as WebSocketServer } from 'ws';
import { config } from '../config';
import { handleMessage } from './handlers/message';
import { getDatabase } from '../database/sqlite';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ClientInfo, JwtPayload } from '../types';

const aedes = new Aedes();

// 客户端存储（内存中）
const connectedClients = new Map<string, ClientInfo>();

export async function startMqttBroker(): Promise<void> {
  return new Promise((resolve, reject) => {
    // TCP server
    const tcpServer: NetServer = createServer(aedes.handle);
    tcpServer.listen(config.mqtt.port, () => {
      console.log(`🔌 MQTT TCP server running on port ${config.mqtt.port}`);
      resolve();
    });

    tcpServer.on('error', (err) => {
      console.error('❌ MQTT TCP server error:', err);
      reject(err);
    });

    // WebSocket server
    const wsPort = config.mqtt.websocketPort;
    
    // 创建 WebSocket 服务器并处理 MQTT over WebSocket
    const wsServer = new (WebSocketServer as any)({
      port: wsPort
    });

    wsServer.on('connection', (ws: any) => {
      aedes.handle(ws);
    });

    wsServer.on('listening', () => {
      console.log(`🌐 MQTT WebSocket server running on port ${wsPort}`);
    });

    // 认证事件 - 验证用户名密码或JWT Token
    (aedes as any).authenticate = (client: any, username: any, password: any, callback: any) => {
      console.log(`🔑 Client ${client.id} authenticating as ${username}`);
      
      if (!username || !password) {
        callback(new Error('Username and password required'), false);
        return;
      }

      try {
        const passwordStr = password.toString();
        const db = getDatabase();
        
        // 尝试将密码作为JWT token验证
        try {
          const decoded = jwt.verify(passwordStr, config.jwt.secret) as JwtPayload;
          
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
        } catch (jwtError) {
          // JWT 验证失败，尝试用户名密码验证
          console.log(`JWT verification failed, trying username/password...`);
        }
        
        // 用户名密码验证
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as { id: string; username: string; password_hash: string } | undefined;
        
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
      } catch (error) {
        console.error('❌ Authentication error:', error);
        callback(new Error('Authentication error'), false);
      }
    };

    // authorizePublish - 修复参数签名以兼容 aedes
    (aedes as any).authorizePublish = (client: any, packet: any, callback: any) => {
      if (typeof callback !== 'function') {
        console.warn('authorizePublish: callback is not a function, skipping');
        return;
      }
      callback(null, packet);
    };

    // authorizeSubscribe - 修复参数签名以兼容 aedes  
    (aedes as any).authorizeSubscribe = (client: any, sub: any, callback: any) => {
      if (typeof callback !== 'function') {
        console.warn('authorizeSubscribe: callback is not a function, skipping');
        return;
      }
      callback(null, sub);
    };

    // 客户端连接事件
    aedes.on('client', (client: Client) => {
      console.log(`✅ Client connected: ${client.id}`);
    });

    // 客户端断开事件
    aedes.on('clientDisconnect', (client: Client) => {
      console.log(`👋 Client disconnected: ${client.id}`);
      const clientInfo = connectedClients.get(client.id);
      if (clientInfo?.userId) {
        const db = getDatabase();
        db.prepare('UPDATE users SET is_online = 0 WHERE id = ?').run(clientInfo.userId);
        console.log(`🔴 User ${clientInfo.username} (userId: ${clientInfo.userId}) is now offline`);
      }
      connectedClients.delete(client.id);
    });

    // 消息事件
    aedes.on('publish', (packet: PublishPacket, client: Client | null) => {
      if (client) {
        console.log(`📨 Message from ${client.id} on topic ${packet.topic}`);
        // 确保 payload 是 Buffer
        const payload = Buffer.isBuffer(packet.payload) ? packet.payload : Buffer.from(packet.payload);
        handleMessage(client, packet.topic, payload);
      }
    });
  });
}

export function getAedes(): Aedes {
  return aedes;
}

export function getClientInfo(clientId: string) {
  return connectedClients.get(clientId);
}
