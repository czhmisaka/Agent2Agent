// Save original environment
const originalEnv = process.env;

describe('Config', () => {
  // Suppress console output during tests
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.resetModules();
    // Clear all console output during tests
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  describe('default configuration', () => {
    it('should use default MQTT port', () => {
      delete process.env.MQTT_PORT;
      const { config } = require('./index');
      expect(config.mqtt.port).toBe(14080);
    });

    it('should use default MQTT websocket port', () => {
      delete process.env.MQTT_WS_PORT;
      const { config } = require('./index');
      expect(config.mqtt.websocketPort).toBe(14083);
    });

    it('should use default HTTP port', () => {
      delete process.env.HTTP_PORT;
      const { config } = require('./index');
      expect(config.http.port).toBe(14070);
    });

    it('should use default database path', () => {
      delete process.env.DB_PATH;
      const { config } = require('./index');
      expect(config.database.path).toBe('./data/chat.db');
    });

    it('should use default JWT expiresIn', () => {
      delete process.env.JWT_EXPIRES_IN;
      const { config } = require('./index');
      expect(config.jwt.expiresIn).toBe('7d');
    });
  });

  describe('environment variable overrides', () => {
    it('should override MQTT port from environment', () => {
      process.env.MQTT_PORT = '1884';
      const { config } = require('./index');
      expect(config.mqtt.port).toBe(1884);
    });

    it('should override MQTT websocket port from environment', () => {
      process.env.MQTT_WS_PORT = '8884';
      const { config } = require('./index');
      expect(config.mqtt.websocketPort).toBe(8884);
    });

    it('should override HTTP port from environment', () => {
      process.env.HTTP_PORT = '8080';
      const { config } = require('./index');
      expect(config.http.port).toBe(8080);
    });

    it('should override database path from environment', () => {
      process.env.DB_PATH = '/custom/path/database.db';
      const { config } = require('./index');
      expect(config.database.path).toBe('/custom/path/database.db');
    });

    it('should override JWT expiresIn from environment', () => {
      process.env.JWT_EXPIRES_IN = '30d';
      const { config } = require('./index');
      expect(config.jwt.expiresIn).toBe('30d');
    });
  });

  describe('CORS configuration', () => {
    it('should parse CORS_ORIGIN when provided', () => {
      process.env.CORS_ORIGIN = 'https://example.com,https://app.example.com';
      const { config } = require('./index');
      expect(config.cors.allowedOrigins).toEqual(['https://example.com', 'https://app.example.com']);
    });

    it('should parse CORS_ALLOWED_ORIGINS when provided', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://domain1.com,https://domain2.com';
      const { config } = require('./index');
      expect(config.cors.allowedOrigins).toEqual(['https://domain1.com', 'https://domain2.com']);
    });

    it('should prioritize CORS_ALLOWED_ORIGINS over CORS_ORIGIN', () => {
      process.env.CORS_ORIGIN = 'https://old-origin.com';
      process.env.CORS_ALLOWED_ORIGINS = 'https://new-origin.com';
      const { config } = require('./index');
      expect(config.cors.allowedOrigins).toEqual(['https://new-origin.com']);
    });

    it('should return empty array for CORS when CORS_ORIGIN is * in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = '*';
      process.env.JWT_SECRET = 'a-valid-secret-that-is-at-least-32-characters-long-for-production';
      const { config } = require('./index');
      expect(config.cors.allowedOrigins).toEqual([]);
    });

    it('should filter empty origins', () => {
      process.env.CORS_ORIGIN = 'https://valid.com,,https://another.com';
      const { config } = require('./index');
      expect(config.cors.allowedOrigins).toEqual(['https://valid.com', 'https://another.com']);
    });
  });

  describe('JWT secret configuration', () => {
    it('should use JWT_SECRET when provided with valid length', () => {
      process.env.JWT_SECRET = 'a-valid-secret-that-is-at-least-32-characters-long';
      process.env.NODE_ENV = 'production';
      const { config } = require('./index');
      expect(config.jwt.secret).toBe('a-valid-secret-that-is-at-least-32-characters-long');
    });

    it('should throw error when JWT_SECRET is too short in production', () => {
      process.env.JWT_SECRET = 'short';
      process.env.NODE_ENV = 'production';
      expect(() => require('./index')).toThrow('JWT_SECRET is using an insecure default value in production');
    });

    it('should throw error when JWT_SECRET is a placeholder in production', () => {
      process.env.JWT_SECRET = 'your-super-secret-jwt-token-here';
      process.env.NODE_ENV = 'production';
      expect(() => require('./index')).toThrow('JWT_SECRET is using an insecure default value in production');
    });

    it('should generate random secret in development without JWT_SECRET', () => {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'development';
      const { config } = require('./index');
      expect(config.jwt.secret).toBeDefined();
      expect(config.jwt.secret.length).toBe(64); // 32 bytes hex = 64 characters
    });

    it('should throw error in production when JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'production';
      expect(() => require('./index')).toThrow('JWT_SECRET environment variable is required in production');
    });
  });

  describe('generateSecretKey', () => {
    it('should generate a key of specified length', () => {
      const { generateSecretKey } = require('./index');
      const key = generateSecretKey(16);
      expect(key).toBeDefined();
      expect(key.length).toBe(32); // 16 bytes hex = 32 characters
    });

    it('should generate a key of default length (32 bytes)', () => {
      const { generateSecretKey } = require('./index');
      const key = generateSecretKey();
      expect(key).toBeDefined();
      expect(key.length).toBe(64); // 32 bytes hex = 64 characters
    });

    it('should generate unique keys', () => {
      const { generateSecretKey } = require('./index');
      const key1 = generateSecretKey();
      const key2 = generateSecretKey();
      expect(key1).not.toBe(key2);
    });
  });
});
