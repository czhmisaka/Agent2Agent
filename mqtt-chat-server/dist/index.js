"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config_1 = require("./config");
const sqlite_1 = require("./database/sqlite");
const broker_1 = require("./mqtt/broker");
const server_1 = require("./http/server");
async function main() {
    console.log('🚀 Starting MQTT Chat Server...');
    try {
        // 初始化数据库
        console.log('📦 Initializing database...');
        (0, sqlite_1.initDatabase)();
        // 启动 MQTT Broker
        console.log('🔌 Starting MQTT Broker...');
        await (0, broker_1.startMqttBroker)();
        // 启动 HTTP API Server
        console.log('🌐 Starting HTTP API Server...');
        (0, server_1.startHttpServer)();
        console.log('✅ MQTT Chat Server started successfully!');
        console.log(`   MQTT Port: ${config_1.config.mqtt.port}`);
        console.log(`   WebSocket Port: ${config_1.config.mqtt.websocketPort}`);
        console.log(`   HTTP Port: ${config_1.config.http.port}`);
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map