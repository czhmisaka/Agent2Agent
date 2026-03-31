/**
 * JWT Token Tests
 * Tests JWT token generation, verification, expiration
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';

// Test secret for JWT signing
const TEST_JWT_SECRET = 'test-secret-key-at-least-32-chars';
const TEST_USER_ID = 'test-user-123';
const TEST_USERNAME = 'testuser';

describe('JWT Token Tests', () => {
  describe('Token Generation', () => {
    it('should generate a valid JWT token with correct payload', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };

      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '7d' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include userId and username in token payload', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };

      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '7d' });
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;

      expect(decoded.userId).toBe(TEST_USER_ID);
      expect(decoded.username).toBe(TEST_USERNAME);
    });

    it('should set expiration time correctly', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };

      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      // Token should expire in approximately 1 hour (3600 seconds)
      const diff = decoded.exp - decoded.iat;
      expect(diff).toBe(3600);
    });

    it('should use custom expiresIn value from config', () => {
      const customExpiresIn = '24h';
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };

      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: customExpiresIn });
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;

      const diff = decoded.exp - decoded.iat;
      expect(diff).toBe(86400); // 24 hours in seconds
    });
  });

  describe('Token Verification', () => {
    it('should verify a valid token with correct secret', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };
      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '7d' });

      const decoded = jwt.verify(token, TEST_JWT_SECRET);

      expect(decoded).toBeDefined();
      expect((decoded as any).userId).toBe(TEST_USER_ID);
    });

    it('should throw error when verifying with wrong secret', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };
      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '7d' });
      const wrongSecret = 'wrong-secret-key-that-is-also-32-chars';

      expect(() => {
        jwt.verify(token, wrongSecret);
      }).toThrow();
    });

    it('should throw JsonWebTokenError for tampered token', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };
      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '7d' });

      // Tamper with the token
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => {
        jwt.verify(tamperedToken, TEST_JWT_SECRET);
      }).toThrow();
    });

    it('should throw error for malformed token', () => {
      const malformedToken = 'not.a.valid.jwt.token';

      expect(() => {
        jwt.verify(malformedToken, TEST_JWT_SECRET);
      }).toThrow();
    });

    it('should throw error for empty token', () => {
      expect(() => {
        jwt.verify('', TEST_JWT_SECRET);
      }).toThrow();
    });
  });

  describe('Token Expiration', () => {
    it('should successfully verify token before expiration', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };
      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });

      const decoded = jwt.verify(token, TEST_JWT_SECRET);
      expect(decoded).toBeDefined();
    });

    it('should throw error for expired token', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };
      // Create token that expires in -1 second (already expired)
      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '-1s' });

      expect(() => {
        jwt.verify(token, TEST_JWT_SECRET);
      }).toThrow('jwt expired');
    });

    it('should throw TokenExpiredError with correct properties', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };
      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '-1s' });

      try {
        jwt.verify(token, TEST_JWT_SECRET);
        fail('Expected error to be thrown');
      } catch (error) {
        expect((error as any).name).toBe('TokenExpiredError');
        expect((error as any).expiredAt).toBeDefined();
      }
    });

    it('should allow clock tolerance for token verification', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };
      // Token that expired 2 seconds ago
      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '-2s' });

      // Should fail without tolerance
      expect(() => {
        jwt.verify(token, TEST_JWT_SECRET);
      }).toThrow();

      // Should succeed with 5 second tolerance
      const decoded = jwt.verify(token, TEST_JWT_SECRET, { clockTolerance: 5 });
      expect(decoded).toBeDefined();
    });
  });

  describe('Token Decoding (without verification)', () => {
    it('should decode token without verification', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };
      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '7d' });

      const decoded = jwt.decode(token);

      expect(decoded).toBeDefined();
      expect((decoded as any).userId).toBe(TEST_USER_ID);
      expect((decoded as any).username).toBe(TEST_USERNAME);
    });

    it('should decode expired token without error', () => {
      const payload = { userId: TEST_USER_ID, username: TEST_USERNAME };
      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '-1s' });

      const decoded = jwt.decode(token);

      expect(decoded).toBeDefined();
      expect((decoded as any).userId).toBe(TEST_USER_ID);
    });
  });
});

describe('JWT Integration with Express Routes', () => {
  // Mock config before importing server
  jest.mock('../src/config', () => ({
    config: {
      jwt: { secret: TEST_JWT_SECRET, expiresIn: '7d' },
      cors: { allowedOrigins: ['http://localhost:14070'] },
      mqtt: { port: 14080, websocketPort: 14083 },
      http: { port: 3000 },
      database: { path: ':memory:' }
    }
  }));

  // Mock database
  const mockPrepare = {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn()
  };

  const mockDb = {
    prepare: jest.fn().mockImplementation(() => mockPrepare),
    exec: jest.fn(),
    pragma: jest.fn(),
    close: jest.fn()
  };

  jest.mock('../src/database/sqlite', () => ({
    getDatabase: jest.fn().mockReturnValue(mockDb),
    initDatabase: jest.fn(),
    closeDatabase: jest.fn()
  }));

  // Mock aedes broker
  jest.mock('../src/mqtt/broker', () => ({
    getAedes: jest.fn().mockReturnValue({
      clients: new Map()
    })
  }));

  const { app } = require('../src/http/server');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrepare.get.mockReturnValue({ id: TEST_USER_ID, username: TEST_USERNAME });
    mockPrepare.run.mockReturnValue({ changes: 1 });
  });

  describe('GET /api/users/me - JWT in Authorization header', () => {
    it('should accept valid Bearer token', async () => {
      const token = jwt.sign(
        { userId: TEST_USER_ID, username: TEST_USERNAME },
        TEST_JWT_SECRET,
        { expiresIn: '7d' }
      );

      mockPrepare.get.mockReturnValueOnce({
        id: TEST_USER_ID,
        username: TEST_USERNAME,
        nickname: null,
        avatar: null,
        created_at: '2024-01-01T00:00:00.000Z'
      });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(TEST_USER_ID);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No token provided');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject request with wrong secret token', async () => {
      const wrongSecretToken = jwt.sign(
        { userId: TEST_USER_ID, username: TEST_USERNAME },
        'different-secret-key-also-32-chars-min',
        { expiresIn: '7d' }
      );

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${wrongSecretToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: TEST_USER_ID, username: TEST_USERNAME },
        TEST_JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('JWT in Cookies', () => {
    it('should accept valid token from cookie', async () => {
      const token = jwt.sign(
        { userId: TEST_USER_ID, username: TEST_USERNAME },
        TEST_JWT_SECRET,
        { expiresIn: '7d' }
      );

      mockPrepare.get.mockReturnValueOnce({
        id: TEST_USER_ID,
        username: TEST_USERNAME,
        nickname: null,
        avatar: null,
        created_at: '2024-01-01T00:00:00.000Z'
      });

      const response = await request(app)
        .get('/api/users/me')
        .set('Cookie', `auth_token=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe(TEST_USERNAME);
    });
  });
});
