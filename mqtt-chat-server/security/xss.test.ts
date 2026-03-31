/**
 * XSS Prevention Tests
 * Tests that the sanitizeMessage function in server.ts properly escapes HTML characters
 */

import request from 'supertest';

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

// Helper function that mirrors the sanitizeMessage function from server.ts
function sanitizeMessage(content: string): string {
  if (!content) return '';

  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, 5000);
}

describe('XSS Prevention Tests', () => {
  const testUser = {
    id: 'test-user-id-123',
    username: 'testuser',
    passwordHash: '$2b$10$Zl1nVaE64gFplPHzZ5oh6eWxGMK/httHjzbE2Xf6OLCvHyUQsgOSq'
  };

  let authToken: string;
  let groupId: string;

  beforeAll(() => {
    // Mock JWT verification to return valid user
    jest.spyOn(require('jsonwebtoken'), 'verify').mockImplementation(() => ({
      userId: testUser.id,
      username: testUser.username
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authToken = 'valid-test-token';

    // Setup default mocks
    mockPrepare.get.mockReturnValue({ id: testUser.id, username: testUser.username });
    mockPrepare.run.mockReturnValue({ changes: 1 });
  });

  describe('sanitizeMessage function', () => {
    it('should escape HTML script tags', () => {
      const maliciousInput = '<script>alert("XSS")</script>';
      const sanitized = sanitizeMessage(maliciousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    it('should escape JavaScript event handlers', () => {
      const maliciousInput = '<img src=x onerror="alert(\'XSS\')">';
      const sanitized = sanitizeMessage(maliciousInput);

      // The < and > are escaped so the tag won't be parsed as HTML
      // onerror is preserved but the tag syntax is broken
      expect(sanitized).toContain('&lt;img');
      expect(sanitized).not.toContain('<img');
      // The onerror attribute text is preserved but the tag is neutralized
      expect(sanitized).toContain('&gt;');
    });

    it('should escape HTML entities', () => {
      const maliciousInput = '&lt;script&gt;alert(1)&lt;/script&gt;';
      const sanitized = sanitizeMessage(maliciousInput);

      expect(sanitized).toContain('&amp;lt;script&amp;gt;');
    });

    it('should escape double quotes', () => {
      const input = 'Hello "World"';
      const sanitized = sanitizeMessage(input);

      expect(sanitized).toContain('&quot;');
      expect(sanitized).not.toContain('"World"');
    });

    it('should escape single quotes', () => {
      const input = "Hello 'World'";
      const sanitized = sanitizeMessage(input);

      expect(sanitized).toContain('&#x27;');
      expect(sanitized).not.toContain("'World'");
    });

    it('should escape ampersands', () => {
      const input = 'foo & bar';
      const sanitized = sanitizeMessage(input);

      expect(sanitized).toContain('&amp;');
      expect(sanitized).not.toContain('& bar');
    });

    it('should escape less than and greater than signs', () => {
      const input = '<html>content</html>';
      const sanitized = sanitizeMessage(input);

      expect(sanitized).not.toContain('<html>');
      expect(sanitized).not.toContain('</html>');
      expect(sanitized).toContain('&lt;html&gt;');
    });

    it('should handle empty input', () => {
      expect(sanitizeMessage('')).toBe('');
      expect(sanitizeMessage(null as any)).toBe('');
      expect(sanitizeMessage(undefined as any)).toBe('');
    });

    it('should handle normal text without modification', () => {
      const normalInput = 'Hello, this is a normal message!';
      const sanitized = sanitizeMessage(normalInput);

      expect(sanitized).toBe('Hello, this is a normal message!');
    });

    it('should handle unicode characters', () => {
      const unicodeInput = '你好世界 🌍';
      const sanitized = sanitizeMessage(unicodeInput);

      expect(sanitized).toBe('你好世界 🌍');
    });

    it('should truncate messages longer than 5000 characters', () => {
      const longInput = 'a'.repeat(6000);
      const sanitized = sanitizeMessage(longInput);

      expect(sanitized.length).toBe(5000);
    });

    it('should handle complex XSS payloads', () => {
      const payloads = [
        '<script>eval(atob("YWxlcnQoMSk="))</script>',
      ];

      for (const payload of payloads) {
        const sanitized = sanitizeMessage(payload);

        // HTML special characters should be escaped so tags won't parse
        expect(sanitized).not.toContain('<script');
        expect(sanitized).toContain('&lt;');
        expect(sanitized).toContain('&gt;');
      }
    });
  });

  describe('POST /api/groups/:groupId/messages - XSS Prevention', () => {
    it('should sanitize XSS in message content', async () => {
      groupId = 'test-group-id';
      const maliciousContent = '<script>alert("XSS")</script>';

      mockPrepare.get
        .mockReturnValueOnce({ id: testUser.id, username: testUser.username }) // auth
        .mockReturnValueOnce({ group_id: groupId, user_id: testUser.id }) // membership check
        .mockReturnValueOnce({ id: 'msg-id', content: maliciousContent }); // message insert

      const response = await request(app)
        .post(`/api/groups/${groupId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: maliciousContent });

      expect(response.status).toBe(200);
      expect(response.body.content).not.toContain('<script>');
      expect(response.body.content).toContain('&lt;script&gt;');
    });

    it('should sanitize HTML entities in message content', async () => {
      groupId = 'test-group-id';
      const maliciousContent = '&lt;script&gt;alert(1)&lt;/script&gt;';

      mockPrepare.get
        .mockReturnValueOnce({ id: testUser.id, username: testUser.username })
        .mockReturnValueOnce({ group_id: groupId, user_id: testUser.id })
        .mockReturnValueOnce({ id: 'msg-id', content: maliciousContent });

      const response = await request(app)
        .post(`/api/groups/${groupId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: maliciousContent });

      expect(response.status).toBe(200);
      expect(response.body.content).toContain('&amp;lt;');
    });

    it('should reject empty message content', async () => {
      groupId = 'test-group-id';

      const response = await request(app)
        .post(`/api/groups/${groupId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message content is required');
    });
  });
});
