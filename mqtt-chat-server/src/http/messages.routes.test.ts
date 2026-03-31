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

describe('Messages Routes', () => {
  const testUser = {
    id: 'test-user-id-123',
    username: 'testuser'
  };

  const testGroup = {
    id: 'test-group-id-456',
    name: 'Test Group'
  };

  const authToken = jwt.sign(
    { userId: testUser.id, username: testUser.username },
    'test-secret-key-at-least-32-chars',
    { expiresIn: '7d' }
  );

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mockJwtVerify to a fresh mock with default return value
    mockJwtVerify.mockReset();
    mockJwtVerify.mockReturnValue({ userId: testUser.id, username: testUser.username });
  });

  describe('GET /api/groups/:groupId/messages', () => {
    it('should return message history', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id' }); // User is member
      // Server does .reverse() on the messages array, so we need to mock in reverse order
      mockPrepare.all.mockReturnValueOnce([
        {
          id: 'msg2',
          group_id: testGroup.id,
          sender_id: 'other-user',
          content: 'Hi there',
          username: 'otheruser',
          nickname: 'Other User',
          created_at: '2024-01-01T00:01:00.000Z'
        },
        {
          id: 'msg1',
          group_id: testGroup.id,
          sender_id: testUser.id,
          content: 'Hello world',
          username: testUser.username,
          nickname: 'Test User',
          created_at: '2024-01-01T00:00:00.000Z'
        }
      ]);
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].content).toBe('Hello world');
    });

    it('should support pagination with limit and offset', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id' });
      mockPrepare.all.mockReturnValueOnce([]);
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/messages?limit=10&offset=20`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(mockPrepare.all).toHaveBeenCalledWith(
        testGroup.id,
        10,
        20
      );
    });

    it('should use default pagination values', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id' });
      mockPrepare.all.mockReturnValueOnce([]);
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(mockPrepare.all).toHaveBeenCalledWith(
        testGroup.id,
        50, // default limit
        0   // default offset
      );
    });

    it('should reject if user is not a member', async () => {
      mockPrepare.get.mockReturnValueOnce(null); // Not a member

      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Not a member of this group');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/messages`);

      expect(response.status).toBe(401);
    });

    it('should return messages in reverse chronological order', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id' });
      // Server does .reverse() on the messages, so mock in reverse order
      mockPrepare.all.mockReturnValueOnce([
        { id: 'msg2', content: 'Second', created_at: '2024-01-01T00:01:00.000Z' },
        { id: 'msg1', content: 'First', created_at: '2024-01-01T00:00:00.000Z' }
      ]);
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Messages should be reversed (oldest first after reverse())
      expect(response.body[0].content).toBe('First');
    });

    it('should update last_read_at timestamp', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id' });
      mockPrepare.all.mockReturnValueOnce([]);
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(mockPrepare.run).toHaveBeenCalledWith(
        expect.any(String),
        testGroup.id,
        testUser.id
      );
    });
  });

  describe('POST /api/groups/:groupId/messages', () => {
    it('should send a message successfully', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id' }); // User is member
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Hello, world!' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.content).toBe('Hello, world!');
      expect(response.body.messageId).toBeDefined();
    });

    it('should sanitize message content', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id' });
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: '<script>alert("xss")</script>' });

      expect(response.status).toBe(200);
      // Content should be sanitized
      expect(response.body.content).not.toContain('<script>');
      expect(response.body.content).toContain('&lt;script&gt;');
    });

    it('should truncate long messages', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id' });
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const longContent = 'A'.repeat(6000);
      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: longContent });

      expect(response.status).toBe(200);
      // Content should be truncated to 5000 chars
      expect(response.body.content.length).toBeLessThanOrEqual(5000);
    });

    it('should reject if user is not a member', async () => {
      mockPrepare.get.mockReturnValueOnce(null); // Not a member

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Hello!' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Not a member of this group');
    });

    it('should reject empty message content', async () => {
      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message content is required');
    });

    it('should reject missing message content', async () => {
      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message content is required');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/messages`)
        .send({ content: 'Hello!' });

      expect(response.status).toBe(401);
    });

    it('should handle special characters in messages', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id' });
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Message with "quotes" and \'apostrophes\' and & ampersand' });

      expect(response.status).toBe(200);
      expect(response.body.content).toContain('&quot;');
      expect(response.body.content).toContain('&#x27;');
      expect(response.body.content).toContain('&amp;');
    });

    it('should handle unicode characters in messages', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id' });
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Hello! 你好! Привет! 🎉' });

      expect(response.status).toBe(200);
    });
  });
});
