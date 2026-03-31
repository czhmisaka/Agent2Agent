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

describe('Groups Routes', () => {
  const testUser = {
    id: 'test-user-id-123',
    username: 'testuser'
  };

  const testGroup = {
    id: 'test-group-id-456',
    name: 'Test Group',
    description: 'A test group',
    owner_id: testUser.id
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

  describe('POST /api/groups', () => {
    it('should create a new group', async () => {
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Group', description: 'A new group' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.name).toBe('New Group');
      expect(response.body.groupId).toBeDefined();
    });

    it('should create group without description', async () => {
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Simple Group' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/groups')
        .send({ name: 'New Group' });

      expect(response.status).toBe(401);
    });

    it('should reject missing group name', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Group name is required');
    });

    it('should accept short group name (server does not validate length)', async () => {
      mockPrepare.run.mockReturnValue({ changes: 1 });
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'A' });

      // Server only checks if name is falsy, not length
      expect(response.status).toBe(200);
    });

    it('should accept long group name (server does not validate length)', async () => {
      mockPrepare.run.mockReturnValue({ changes: 1 });
      const longName = 'A'.repeat(51);
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: longName });

      // Server only checks if name is falsy, not length
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/groups', () => {
    it('should return user groups', async () => {
      mockPrepare.all.mockReturnValueOnce([
        { id: 'group1', name: 'Group 1', role: 'owner', joined_at: '2024-01-01' },
        { id: 'group2', name: 'Group 2', role: 'member', joined_at: '2024-01-02' }
      ]);

      const response = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/groups');

      expect(response.status).toBe(401);
    });

    it('should return empty array when user has no groups', async () => {
      mockPrepare.all.mockReturnValueOnce([]);

      const response = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/groups/:groupId', () => {
    it('should return group details', async () => {
      mockPrepare.get.mockReturnValueOnce({
        id: testGroup.id,
        name: testGroup.name,
        description: testGroup.description,
        owner_id: testGroup.owner_id,
        role: 'owner'
      });

      const response = await request(app)
        .get(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testGroup.id);
      expect(response.body.name).toBe(testGroup.name);
    });

    it('should return 404 if user is not a member', async () => {
      mockPrepare.get.mockReturnValueOnce(null);

      const response = await request(app)
        .get('/api/groups/non-member-group')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Group not found or you are not a member');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/groups/:groupId/members', () => {
    it('should return group members', async () => {
      mockPrepare.all.mockReturnValueOnce([
        { id: 'user1', username: 'user1', nickname: 'User 1', is_online: 1, role: 'owner', joined_at: '2024-01-01' },
        { id: 'user2', username: 'user2', nickname: 'User 2', is_online: 0, role: 'member', joined_at: '2024-01-02' }
      ]);

      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/members`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].role).toBe('owner');
    });

    it('should handle database error', async () => {
      mockPrepare.all.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/members`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get members');
    });
  });

  describe('POST /api/groups/:groupId/join', () => {
    it('should allow user to join a group', async () => {
      mockPrepare.get
        .mockReturnValueOnce({ id: testGroup.id }) // Group exists
        .mockReturnValueOnce(null); // Not already a member
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/join`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Joined group successfully');
    });

    it('should reject if group not found', async () => {
      mockPrepare.get.mockReturnValueOnce(null);

      const response = await request(app)
        .post('/api/groups/nonexistent-group/join')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Group not found');
    });

    it('should reject if already a member', async () => {
      mockPrepare.get
        .mockReturnValueOnce({ id: testGroup.id }) // Group exists
        .mockReturnValueOnce({ id: 'membership-id' }); // Already a member

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/join`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Already a member');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/join`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/groups/:groupId/leave', () => {
    it('should allow user to leave a group', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id', role: 'member' });
      mockPrepare.run.mockReturnValue({ changes: 1 });

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/leave`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Left group successfully');
    });

    it('should reject if not a member', async () => {
      mockPrepare.get.mockReturnValueOnce(null);

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/leave`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Not a member of this group');
    });

    it('should reject if user is owner', async () => {
      mockPrepare.get.mockReturnValueOnce({ id: 'membership-id', role: 'owner' });

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/leave`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Owner cannot leave the group');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/leave`);

      expect(response.status).toBe(401);
    });
  });
});
