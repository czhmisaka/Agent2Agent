import dotenv from 'dotenv';
dotenv.config();

import { config } from './config';
import { initDatabase } from './database/sqlite';
import { startMqttBroker } from './mqtt/broker';
import { startHttpServer } from './http/server';

async function main() {
  console.log('🚀 Starting MQTT Chat Server...');
  
  try {
    // 初始化数据库
    console.log('📦 Initializing database...');
    initDatabase();
    
    // 启动 MQTT Broker
    console.log('🔌 Starting MQTT Broker...');
    await startMqttBroker();
    
    // 启动 HTTP API Server
    console.log('🌐 Starting HTTP API Server...');
    startHttpServer();
    
    console.log('✅ MQTT Chat Server started successfully!');
    console.log(`   MQTT Port: ${config.mqtt.port}`);
    console.log(`   WebSocket Port: ${config.mqtt.websocketPort}`);
    console.log(`   HTTP Port: ${config.http.port}`);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();
