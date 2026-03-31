// Mock winston before any imports
const mockLoggerInstance = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  http: jest.fn(),
  debug: jest.fn(),
  level: 'debug',
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
  }
};

jest.mock('winston', () => {
  return {
    __esModule: true,
    default: {
      createLogger: jest.fn(() => mockLoggerInstance),
      format: {
        combine: jest.fn(),
        timestamp: jest.fn(() => ({ format: 'YYYY-MM-DD HH:mm:ss' })),
        errors: jest.fn(),
        printf: jest.fn(),
        colorize: jest.fn()
      },
      transports: {
        Console: jest.fn(),
        File: jest.fn()
      }
    },
    createLogger: jest.fn(() => mockLoggerInstance),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(() => ({ format: 'YYYY-MM-DD HH:mm:ss' })),
      errors: jest.fn(),
      printf: jest.fn(),
      colorize: jest.fn()
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  };
});

// Import after mocking
import winston from 'winston';
import logger, { httpLogger } from './logger';

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLogger', () => {
    it('should create a logger', () => {
      // Logger should be created (mocked)
      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('http');
      expect(logger).toHaveProperty('debug');
    });
  });

  describe('httpLogger middleware', () => {
    it('should be a function', () => {
      expect(typeof httpLogger).toBe('function');
    });

    it('should call next', () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/test',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      };
      const mockRes = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'finish') {
            // Simulate finish event
            setTimeout(callback, 10);
          }
          return mockRes;
        })
      };
      const mockNext = jest.fn();

      httpLogger(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should log HTTP request on finish', (done) => {
      const mockReq = {
        method: 'POST',
        originalUrl: '/api/messages',
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('TestAgent')
      };
      const mockRes = {
        statusCode: 201,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'finish') {
            callback();
          }
          return mockRes;
        })
      };
      const mockNext = jest.fn();

      httpLogger(mockReq as any, mockRes as any, mockNext);

      // Wait for finish event to be processed
      setTimeout(() => {
        expect(mockLoggerInstance.http).toHaveBeenCalled();
        const logCall = mockLoggerInstance.http.mock.calls[0];
        expect(logCall[0]).toBe('POST /api/messages');
        expect(logCall[1]).toMatchObject({
          method: 'POST',
          url: '/api/messages',
          status: 201,
          ip: '192.168.1.1',
          userAgent: 'TestAgent'
        });
        done();
      }, 50);
    });
  });

  describe('log methods', () => {
    it('should call logger.error', () => {
      logger.error('Error message');
      expect(logger.error).toHaveBeenCalledWith('Error message');
    });

    it('should call logger.warn', () => {
      logger.warn('Warning message');
      expect(logger.warn).toHaveBeenCalledWith('Warning message');
    });

    it('should call logger.info', () => {
      logger.info('Info message');
      expect(logger.info).toHaveBeenCalledWith('Info message');
    });

    it('should call logger.http', () => {
      logger.http('HTTP message');
      expect(logger.http).toHaveBeenCalledWith('HTTP message');
    });

    it('should call logger.debug', () => {
      logger.debug('Debug message');
      expect(logger.debug).toHaveBeenCalledWith('Debug message');
    });

    it('should support metadata in log calls', () => {
      logger.info('User logged in', { userId: '123', username: 'testuser' });
      expect(logger.info).toHaveBeenCalledWith('User logged in', { userId: '123', username: 'testuser' });
    });
  });
});
