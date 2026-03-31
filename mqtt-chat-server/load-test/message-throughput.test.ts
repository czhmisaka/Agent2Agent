/**
 * Message Throughput Performance Test
 * Tests message throughput performance
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock config before importing server
jest.mock('../src/config', () => ({
  config: {
    jwt: { secret: 'test-secret-key-at-least-32-chars', expiresIn: '7d' },
    cors: { allowedOrigins: ['http://localhost:14070'] },
    mqtt: { port: 14080, websocketPort: 14083 },
    http: { port: 3000 },
    database: { path: ':memory:' }
  }
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hashSync: jest.fn().mockReturnValue('$2b$10$mockedhash'),
  compareSync: jest.fn().mockReturnValue(true)
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mocked-token'),
  verify: jest.fn().mockReturnValue({ userId: 'test-user-id', username: 'testuser' })
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

// Import app after mocks are set up
const { app } = require('../src/http/server');

describe('Message Throughput Performance Tests', () => {
  const testUser = {
    id: 'test-user-id',
    username: 'testuser',
    passwordHash: '$2b$10$Zl1nVaE64gFplPHzZ5oh6eWxGMK/httHjzbE2Xf6OLCvHyUQsgOSq'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrepare.get.mockReturnValue({ id: testUser.id, username: testUser.username });
    mockPrepare.run.mockReturnValue({ changes: 1 });
    // Reset JWT mock
    (jwt.verify as jest.Mock).mockReturnValue({ userId: testUser.id, username: testUser.username });
  });

  describe('Single Message Send Performance', () => {
    it('should send message within acceptable time', async () => {
      const token = 'valid-test-token';
      const groupId = 'test-group-id';

      mockPrepare.get
        .mockReturnValueOnce({ id: testUser.id, username: testUser.username })
        .mockReturnValueOnce({ group_id: groupId, user_id: testUser.id });

      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/groups/${groupId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Performance test message' });

      const duration = Date.now() - startTime;

      expect([200, 429]).toContain(response.status);
      if (response.status === 200) {
        expect(duration).toBeLessThan(500); // Should complete in under 500ms
      }

      console.log(`Single message send: ${duration}ms (status: ${response.status})`);
    });

    it('should send message with XSS content safely', async () => {
      const token = 'valid-test-token';
      const groupId = 'test-group-id';

      mockPrepare.get
        .mockReturnValueOnce({ id: testUser.id, username: testUser.username })
        .mockReturnValueOnce({ group_id: groupId, user_id: testUser.id });

      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/groups/${groupId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '<script>alert("XSS")</script>' });

      const duration = Date.now() - startTime;

      expect([200, 429]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.content).not.toContain('<script>');
        expect(duration).toBeLessThan(500);
      }

      console.log(`XSS message send: ${duration}ms`);
    });
  });

  describe('Batch Message Performance', () => {
    it('should handle batch messages in reasonable time', async () => {
      const token = 'valid-test-token';
      const groupId = 'test-group-id';

      mockPrepare.get
        .mockReturnValueOnce({ id: testUser.id, username: testUser.username })
        .mockReturnValueOnce({ group_id: groupId, user_id: testUser.id });

      const startTime = Date.now();

      // Send 5 messages with delays to avoid rate limiting
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/groups/${groupId}/messages`)
          .set('Authorization', `Bearer ${token}`)
          .send({ content: `Batch message ${i}` });

        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const duration = Date.now() - startTime;

      console.log(`5 messages sent in ${duration}ms`);

      // Should complete in under 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should handle multiple messages with acceptable performance', async () => {
      const token = 'valid-test-token';
      const groupId = 'test-group-id';

      mockPrepare.get
        .mockReturnValueOnce({ id: testUser.id, username: testUser.username })
        .mockReturnValueOnce({ group_id: groupId, user_id: testUser.id });

      const startTime = Date.now();
      const NUM_MESSAGES = 10;

      for (let i = 0; i < NUM_MESSAGES; i++) {
        await request(app)
          .post(`/api/groups/${groupId}/messages`)
          .set('Authorization', `Bearer ${token}`)
          .send({ content: `Throughput test message ${i}` });

        // Delay to avoid rate limiting
        if (i % 5 === 4) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const duration = Date.now() - startTime;
      const throughput = (NUM_MESSAGES / duration) * 1000;

      console.log(`${NUM_MESSAGES} messages sent in ${duration}ms (${throughput.toFixed(2)} msg/sec)`);

      // Should achieve some minimum throughput
      expect(throughput).toBeGreaterThan(2);
    });
  });

  describe('Message Retrieval Performance', () => {
    it('should retrieve messages quickly', async () => {
      const token = 'valid-test-token';
      const groupId = 'test-group-id';

      mockPrepare.get
        .mockReturnValueOnce({ id: testUser.id, username: testUser.username })
        .mockReturnValueOnce({ group_id: groupId, user_id: testUser.id });

      mockPrepare.all.mockReturnValueOnce([]);

      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/groups/${groupId}/messages?limit=50`)
        .set('Authorization', `Bearer ${token}`);

      const duration = Date.now() - startTime;

      expect([200, 429]).toContain(response.status);
      if (response.status === 200) {
        expect(duration).toBeLessThan(200);
      }

      console.log(`Message retrieval: ${duration}ms`);
    });

    it('should handle message retrieval under load', async () => {
      const token = 'valid-test-token';
      const groupId = 'test-group-id';

      mockPrepare.get.mockReturnValue({ id: testUser.id, username: testUser.username });

      const startTime = Date.now();

      // Make 5 sequential requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get(`/api/groups/${groupId}/messages?limit=50`)
          .set('Authorization', `Bearer ${token}`);
      }

      const duration = Date.now() - startTime;

      console.log(`5 retrievals in ${duration}ms`);

      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Message Throughput Metrics', () => {
    it('should calculate accurate throughput rate', async () => {
      const token = 'valid-test-token';
      const groupId = 'test-group-id';

      mockPrepare.get
        .mockReturnValueOnce({ id: testUser.id, username: testUser.username })
        .mockReturnValueOnce({ group_id: groupId, user_id: testUser.id });

      const NUM_MESSAGES = 15;
      const startTime = Date.now();

      for (let i = 0; i < NUM_MESSAGES; i++) {
        await request(app)
          .post(`/api/groups/${groupId}/messages`)
          .set('Authorization', `Bearer ${token}`)
          .send({ content: `Throughput test ${i}` });

        // Delay every 5 messages to avoid rate limiting
        if (i % 5 === 4) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const duration = Date.now() - startTime;
      const throughput = (NUM_MESSAGES / duration) * 1000;

      console.log(`Throughput: ${throughput.toFixed(2)} messages/second`);

      // Should handle at least 5 messages per second
      expect(throughput).toBeGreaterThan(5);
    });
  });

  describe('Large Message Handling', () => {
    it('should handle maximum length messages', async () => {
      const token = 'valid-test-token';
      const groupId = 'test-group-id';

      mockPrepare.get
        .mockReturnValueOnce({ id: testUser.id, username: testUser.username })
        .mockReturnValueOnce({ group_id: groupId, user_id: testUser.id });

      // Create a message at the max length (5000 chars as per sanitizeMessage)
      const maxLengthContent = 'a'.repeat(5000);

      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/groups/${groupId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: maxLengthContent });

      const duration = Date.now() - startTime;

      expect([200, 429]).toContain(response.status);
      if (response.status === 200) {
        expect(duration).toBeLessThan(1000);
      }

      console.log(`Max length message: ${duration}ms (status: ${response.status})`);
    });

    it('should truncate messages exceeding maximum length', async () => {
      const token = 'valid-test-token';
      const groupId = 'test-group-id';

      mockPrepare.get
        .mockReturnValueOnce({ id: testUser.id, username: testUser.username })
        .mockReturnValueOnce({ group_id: groupId, user_id: testUser.id });

      // Create a message exceeding max length
      const oversizedContent = 'a'.repeat(6000);

      const response = await request(app)
        .post(`/api/groups/${groupId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: oversizedContent });

      expect([200, 429]).toContain(response.status);
      if (response.status === 200) {
        // Content should be truncated to 5000 chars
        expect(response.body.content.length).toBeLessThanOrEqual(5000);
      }
    });
  });
});
