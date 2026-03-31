import * as crypto from 'crypto';

// 生成随机密钥
export const generateSecretKey = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

// 检查 JWT_SECRET 是否为不安全的默认值
const validateJwtSecret = (secret: string): void => {
  const isPlaceholder = secret.includes('your-super-secret') || secret.includes('<YOUR_JWT_SECRET_HERE>');
  const isTooShort = secret.length < 32;

  if (isPlaceholder || isTooShort) {
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║                    🚨 安全警告 🚨                              ║');
    console.error('║══════════════════════════════════════════════════════════════║');
    console.error('║  JWT_SECRET 使用了不安全的默认值！                            ║');
    console.error('║  这会让您的应用容易受到攻击。                                  ║');
    console.error('║                                                               ║');

    if (isPlaceholder) {
      console.error('║  检测到占位符值：                                              ║');
      console.error(`║    当前值: "${secret.substring(0, 20)}..."                   ║`);
      console.error('║    请使用 generateSecretKey() 生成随机密钥                    ║');
    }

    if (isTooShort) {
      console.error('║  JWT_SECRET 长度不足 32 字符                                  ║');
    }

    console.error('║                                                               ║');
    console.error('║  修复方法：                                                   ║');
    console.error('║  1. 生成随机密钥: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"  ║');
    console.error('║  2. 或在 .env 文件中设置新的 JWT_SECRET                       ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');

    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is using an insecure default value in production');
    }
  }
};

// JWT Secret 管理
const getJwtSecret = (): string => {
  const envSecret = process.env.JWT_SECRET;

  if (envSecret) {
    // 从环境变量读取
    validateJwtSecret(envSecret);
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
// 生产环境警告：如果 CORS_ORIGIN=* 会允许任何网站发起跨域请求，这是严重的安全风险
const getCorsAllowedOrigins = (): string[] => {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN;

  // 生产环境检查：禁止使用通配符 *
  if (process.env.NODE_ENV === 'production' && envOrigins === '*') {
    console.error('🚨 CRITICAL SECURITY WARNING: CORS_ORIGIN=* is set in production!');
    console.error('🚨 This allows ANY website to make cross-origin requests to your API.');
    console.error('🚨 Please configure specific domains in CORS_ALLOWED_ORIGINS or CORS_ORIGIN.');
    console.error('🚨 Example: CORS_ORIGIN=https://your-frontend-domain.com');
  }

  if (envOrigins && envOrigins !== '*') {
    return envOrigins.split(',').map(origin => origin.trim()).filter(origin => origin.length > 0);
  }
  return []; // 生产环境无配置时拒绝所有跨域请求
};

export const config = {
  mqtt: {
    port: parseInt(process.env.MQTT_PORT || '14080'),
    websocketPort: parseInt(process.env.MQTT_WS_PORT || '14083')
  },
  http: {
    port: parseInt(process.env.HTTP_PORT || '14070')
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
