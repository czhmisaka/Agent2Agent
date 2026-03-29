import * as crypto from 'crypto';

// JWT Secret 管理
const getJwtSecret = (): string => {
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

// CORS 允许的域名列表
const getCorsAllowedOrigins = (): string[] => {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim()).filter(origin => origin.length > 0);
  }
  return []; // 生产环境应通过环境变量配置
};

export const config = {
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
  },
  cors: {
    allowedOrigins: getCorsAllowedOrigins()
  }
};
