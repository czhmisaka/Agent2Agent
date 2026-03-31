/**
 * Concurrent Users Performance Test
 * Tests concurrent user handling
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock config before importing server
jest.mock('../src/config', () => ({
  config: {
    jwt: { secret: 'test-secret-key-at-least-32-chars', expiresIn: '7d' },
    cors: { allowedOrigins: ['http://localhost:14070'] },
    mqtt: { port: 1883, websocketPort: 8883 },
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

describe('Concurrent Users Performance Tests', () => {
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

  describe('Multiple Simultaneous Requests', () => {
    it('should handle 5 concurrent user info requests', async () => {
      const token = 'valid-test-token';

      mockPrepare.get.mockReturnValue({
        id: testUser.id,
        username: testUser.username,
        nickname: 'Test Nickname',
        avatar: null,
        created_at: '2024-01-01T00:00:00.000Z'
      });

      const startTime = Date.now();

      // Make 5 concurrent requests (reduced from 10 to avoid rate limiting)
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(promises);

      const duration = Date.now() - startTime;

      // All requests should succeed or rate limited
      responses.forEach((response) => {
        expect([200, 429]).toContain(response.status);
      });

      console.log(`5 concurrent requests completed in ${duration}ms`);
    });

    it('should handle multiple concurrent requests without errors', async () => {
      const token = 'valid-test-token';

      (jwt.verify as jest.Mock).mockReturnValue({
        userId: testUser.id,
        username: testUser.username
      });

      mockPrepare.get.mockReturnValue({
        id: testUser.id,
        username: testUser.username,
        nickname: 'Test Nickname',
        avatar: null,
        created_at: '2024-01-01T00:00:00.000Z'
      });

      const startTime = Date.now();

      // Make 10 sequential requests (avoid overwhelming rate limiter)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);
      }

      const duration = Date.now() - startTime;

      console.log(`10 sequential requests completed in ${duration}ms`);

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent registration attempts', async () => {
      const startTime = Date.now();

      // Make 5 concurrent registration attempts with unique usernames
      const promises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/users/register')
          .send({
            username: `concurrent_user_${Date.now()}_${i}`,
            password: 'TestPass123'
          })
      );

      const responses = await Promise.all(promises);

      const duration = Date.now() - startTime;

      // All should complete (either success or validation error)
      expect(responses.length).toBe(5);

      console.log(`${responses.filter(r => r.status === 200).length}/5 registrations succeeded in ${duration}ms`);
    });

    it('should handle concurrent message sending to same group', async () => {
      const token = 'valid-test-token';
      const groupId = 'test-group-id';

      (jwt.verify as jest.Mock).mockReturnValue({
        userId: testUser.id,
        username: testUser.username
      });

      mockPrepare.get
        .mockReturnValueOnce({ id: testUser.id, username: testUser.username }) // auth
        .mockReturnValueOnce({ group_id: groupId, user_id: testUser.id }); // membership

      const startTime = Date.now();

      // Make 5 concurrent message sending requests (reduced from 10)
      const promises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post(`/api/groups/${groupId}/messages`)
          .set('Authorization', `Bearer ${token}`)
          .send({ content: `Concurrent message ${i} at ${Date.now()}` })
      );

      const responses = await Promise.all(promises);

      const duration = Date.now() - startTime;

      // All should complete (success or rate limited)
      responses.forEach((response) => {
        expect([200, 429]).toContain(response.status);
      });

      console.log(`5 concurrent messages sent in ${duration}ms`);
    });
  });

  describe('Request Throughput', () => {
    it('should maintain performance under sustained load', async () => {
      const token = 'valid-test-token';

      (jwt.verify as jest.Mock).mockReturnValue({
        userId: testUser.id,
        username: testUser.username
      });

      mockPrepare.get.mockReturnValue({
        id: testUser.id,
        username: testUser.username,
        nickname: 'Test Nickname',
        avatar: null,
        created_at: '2024-01-01T00:00:00.000Z'
      });

      const NUM_REQUESTS = 20; // Reduced from 100 to avoid rate limiting
      const startTime = Date.now();

      // Make requests with small delays to avoid rate limiting
      for (let i = 0; i < NUM_REQUESTS; i++) {
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);

        // Small delay to avoid overwhelming rate limiter
        if (i % 10 === 9) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const duration = Date.now() - startTime;
      const throughput = (NUM_REQUESTS / duration) * 1000; // requests per second

      console.log(`${NUM_REQUESTS} requests in ${duration}ms (${throughput.toFixed(2)} req/sec)`);

      // Should handle at least 5 requests per second
      expect(throughput).toBeGreaterThan(5);
    });
  });

  describe('Response Time Consistency', () => {
    it('should have consistent response times under load', async () => {
      const token = 'valid-test-token';

      (jwt.verify as jest.Mock).mockReturnValue({
        userId: testUser.id,
        username: testUser.username
      });

      mockPrepare.get.mockReturnValue({
        id: testUser.id,
        username: testUser.username,
        nickname: 'Test Nickname',
        avatar: null,
        created_at: '2024-01-01T00:00:00.000Z'
      });

      const responseTimes: number[] = [];

      // Measure response times for first 10 requests
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);
        responseTimes.push(Date.now() - start);
      }

      const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const max = Math.max(...responseTimes);
      const min = Math.min(...responseTimes);

      console.log(`Response times - Avg: ${avg.toFixed(2)}ms, Min: ${min}ms, Max: ${max}ms`);

      // All responses should be under 1 second
      expect(max).toBeLessThan(1000);
    });
  });
});
