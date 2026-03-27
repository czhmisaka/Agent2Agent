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
exports.config = void 0;
const crypto = __importStar(require("crypto"));
// JWT Secret 管理
const getJwtSecret = () => {
    const envSecret = process.env.JWT_SECRET;
    if (envSecret) {
        // 从环境变量读取
        if (envSecret.length < 32) {
            throw new Error('JWT_SECRET must be at least 32 characters long');
        }
        return envSecret;
    }
    // 开发环境自动生成
    if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️  WARNING: Using auto-generated JWT secret in non-production environment');
        console.warn('⚠️  Set JWT_SECRET environment variable for production');
        return crypto.randomBytes(32).toString('hex');
    }
    // 生产环境必须配置
    throw new Error('JWT_SECRET environment variable is required in production');
};
exports.config = {
    mqtt: {
        port: parseInt(process.env.MQTT_PORT || '1883'),
        websocketPort: parseInt(process.env.MQTT_WS_PORT || '8883')
    },
    http: {
        port: parseInt(process.env.HTTP_PORT || '3000')
    },
    database: {
        path: process.env.DB_PATH || './data/chat.db'
    },
    jwt: {
        secret: getJwtSecret(),
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
};
//# sourceMappingURL=index.js.map