import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock config before importing server
jest.mock('../config', () => ({
  config: {
    jwt: { secret: 'test-secret-key-at-least-32-chars', expiresIn: '7d' },
    cors: { allowedOrigins: ['http://localhost:14070'] },
    mqtt: { port: 1883, websocketPort: 8883 },
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

jest.mock('../database/sqlite', () => ({
  getDatabase: jest.fn().mockReturnValue(mockDb),
  initDatabase: jest.fn(),
  closeDatabase: jest.fn()
}));

// Mock aedes broker
jest.mock('../mqtt/broker', () => ({
  getAedes: jest.fn().mockReturnValue({
    clients: new Map()
  })
}));

// Mock jwt.verify to simulate authenticated users
const mockJwtVerify = jest.fn();
jest.mock('jsonwebtoken', () => {
  const actual = jest.requireActual('jsonwebtoken') as typeof import('jsonwebtoken');
  return {
    ...actual,
    verify: (...args: any[]) => mockJwtVerify(...args)
  };
});

// Import app after mocks are set up
const { app } = require('./server');

describe('Auth Routes', () => {
  const testUser = {
    id: 'test-user-id-123',
    username: 'testuser',
    passwordHash: '$2b$10$Zl1nVaE64gFplPHzZ5oh6eWxGMK/httHjzbE2Xf6OLCvHyUQsgOSq'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mockJwtVerify to a fresh mock with default return value
    mockJwtVerify.mockReset();
    mockJwtVerify.mockReturnValue({ userId: testUser.id, username: testUser.username });
  });

  describe('POST /api/users/register', () => {
    it('should register a new user successfully', async () => {
      mockPrepare.get.mockReturnValueOnce(null); // No existing user
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'newuser', password: 'Test1234' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.username).toBe('newuser');
      expect(response.body.userId).toBeDefined();
    });

    it('should reject duplicate username', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'existing-user' }); // User exists

      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'existinguser', password: 'Test1234' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username already exists');
    });

    it('should reject invalid username (too short)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'ab', password: 'Test1234' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid username');
      expect(response.body.details).toContain('Username must be at least 3 characters long');
    });

    it('should reject invalid username (special characters)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'user@name', password: 'Test1234' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid username');
      expect(response.body.details).toContain('Username can only contain letters, numbers, and underscores');
    });

    it('should reject weak password (too short)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'validuser', password: 'short1A' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid password');
      expect(response.body.details).toContain('Password must be at least 8 characters long');
    });

    it('should reject weak password (no lowercase)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'validuser', password: 'UPPERCASE123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid password');
      expect(response.body.details).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject weak password (no uppercase)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'validuser', password: 'lowercase123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid password');
      expect(response.body.details).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject weak password (no number)', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({ username: 'validuser', password: 'NoNumbersA' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid password');
      expect(response.body.details).toContain('Password must contain at least one number');
    });
  });

  describe('POST /api/users/login', () => {
    it('should login user successfully', async () => {
      mockPrepare.get
        .mockReturnValueOnce({
          id: testUser.id,
          username: testUser.username,
          password_hash: testUser.passwordHash
        }); // User found
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .post('/api/users/login')
        .send({ username: 'testuser', password: 'correctpassword' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.username).toBe(testUser.username);
    });

    it('should reject invalid username', async () => {
      mockPrepare.get.mockReturnValueOnce(null); // User not found

      const response = await request(app)
        .post('/api/users/login')
        .send({ username: 'nonexistent', password: 'somepassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Username or password incorrect');
    });

    it('should reject invalid password', async () => {
      mockPrepare.get.mockReturnValueOnce({
        id: testUser.id,
        username: testUser.username,
        password_hash: '$2b$10$hashedpassword'
      });

      const response = await request(app)
        .post('/api/users/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Username or password incorrect');
    });

    it('should reject missing username', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ password: 'somepassword' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username and password are required');
    });

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ username: 'testuser' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username and password are required');
    });
  });

  describe('GET /api/users/me', () => {
    it('should return user info for authenticated user', async () => {
      const token = jwt.sign(
        { userId: testUser.id, username: testUser.username },
        'test-secret-key-at-least-32-chars',
        { expiresIn: '7d' }
      );

      mockJwtVerify.mockReturnValueOnce({ userId: testUser.id, username: testUser.username });
      mockPrepare.get.mockReturnValueOnce({
        id: testUser.id,
        username: testUser.username,
        nickname: 'Test Nickname',
        avatar: null,
        created_at: '2024-01-01T00:00:00.000Z'
      });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testUser.id);
      expect(response.body.username).toBe(testUser.username);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No token provided');
    });

    it('should reject request with invalid token', async () => {
      mockJwtVerify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should return 404 if user not found', async () => {
      const token = jwt.sign(
        { userId: 'nonexistent-id', username: 'ghost' },
        'test-secret-key-at-least-32-chars',
        { expiresIn: '7d' }
      );

      mockJwtVerify.mockReturnValueOnce({ userId: 'nonexistent-id', username: 'ghost' });
      mockPrepare.get.mockReturnValueOnce(null);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should accept token from cookie', async () => {
      const token = jwt.sign(
        { userId: testUser.id, username: testUser.username },
        'test-secret-key-at-least-32-chars',
        { expiresIn: '7d' }
      );

      mockJwtVerify.mockReturnValueOnce({ userId: testUser.id, username: testUser.username });
      mockPrepare.get.mockReturnValueOnce({
        id: testUser.id,
        username: testUser.username,
        nickname: null,
        avatar: null,
        created_at: '2024-01-01T00:00:00.000Z'
      });

      const response = await request(app)
        .get('/api/users/me')
        .set('Cookie', `auth_token=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe(testUser.username);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      mockPrepare.get.mockReturnValueOnce({}); // Database check

      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.services).toBeDefined();
    });
  });
});
