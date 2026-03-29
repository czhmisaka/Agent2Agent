import { handleMessage } from './message';
import { Client } from 'aedes';

// Mock dependencies
jest.mock('../../database/sqlite', () => ({
  getDatabase: jest.fn()
}));

jest.mock('../broker', () => ({
  getAedes: jest.fn()
}));

jest.mock('../../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret',
      expiresIn: '24h'
    }
  }
}));

import { getDatabase } from '../../database/sqlite';
import { getAedes } from '../broker';

describe('MQTT Message Handler', () => {
  let mockClient: jest.Mocked<Client>;
  let mockDb: any;
  let mockAedes: any;

  const createMockDb = () => ({
    prepare: jest.fn().mockReturnValue({
      get: jest.fn(),
      run: jest.fn().mockReturnValue({ changes: 1 }),
      all: jest.fn().mockReturnValue([])
    })
  });

  beforeEach(() => {
    mockClient = {
      id: 'client-123'
    } as jest.Mocked<Client>;

    mockDb = createMockDb();

    mockAedes = {
      publish: jest.fn()
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    (getAedes as jest.Mock).mockReturnValue(mockAedes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleMessage', () => {
    it('should route auth messages to handleAuthMessage', () => {
      const payload = JSON.stringify({
        type: 'request',
        timestamp: new Date().toISOString(),
        payload: { username: 'testuser', password: 'password' }
      });

      // Mock user not found for login
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null)
      });

      handleMessage(mockClient, 'chat/auth/login', Buffer.from(payload));

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should route group messages to handleGroupMessage', () => {
      const jwt = require('jsonwebtoken');
      const validToken = jwt.sign({ userId: 'user-123', username: 'testuser' }, 'test-secret');

      const payload = JSON.stringify({
        type: 'message',
        timestamp: new Date().toISOString(),
        payload: { userId: 'user-123', token: validToken, content: 'Hello' }
      });

      // Mock db responses for successful message handling
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'group-123' }), // membership check
        run: jest.fn(),
        all: jest.fn().mockReturnValue([{ username: 'testuser', nickname: null }])
      });

      handleMessage(mockClient, 'chat/group/group-123/message', Buffer.from(payload));

      // Should verify token and check membership
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should route private messages to handlePrivateMessage', () => {
      const jwt = require('jsonwebtoken');
      const validToken = jwt.sign({ userId: 'user-123', username: 'sender' }, 'test-secret');

      const payload = JSON.stringify({
        type: 'message',
        timestamp: new Date().toISOString(),
        payload: { senderId: 'user-123', token: validToken, content: 'Private' }
      });

      // Mock db responses
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn().mockReturnValue({ username: 'sender', nickname: null })
      });

      handleMessage(mockClient, 'chat/user/user-456/private', Buffer.from(payload));

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should handle presence messages', () => {
      const payload = JSON.stringify({
        type: 'presence',
        timestamp: new Date().toISOString(),
        payload: { status: 'online' }
      });

      mockDb.prepare.mockReturnValue({
        run: jest.fn()
      });

      handleMessage(mockClient, 'chat/presence/user-123', Buffer.from(payload));

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should handle peer messages with action subtype', () => {
      const payload = JSON.stringify({
        type: 'action',
        action: 'typing',
        timestamp: new Date().toISOString(),
        payload: { sourceUsername: 'testuser' }
      });

      handleMessage(mockClient, 'chat/peer/action', Buffer.from(payload));

      // Should be handled without error
    });

    it('should catch errors and log them', () => {
      const invalidPayload = Buffer.from('invalid-json');

      // Spy on console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      handleMessage(mockClient, 'chat/auth/login', invalidPayload);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Error handling message:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});

describe('handleAuthMessage', () => {
  let mockClient: jest.Mocked<Client>;
  let mockDb: any;
  let mockAedes: any;

  beforeEach(() => {
    mockClient = {
      id: 'client-123'
    } as jest.Mocked<Client>;

    mockDb = {
      prepare: jest.fn()
    };

    mockAedes = {
      publish: jest.fn()
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    (getAedes as jest.Mock).mockReturnValue(mockAedes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should return error when username already exists', () => {
      const payload = {
        type: 'request',
        timestamp: new Date().toISOString(),
        payload: { username: 'existinguser', password: 'password123' },
        meta: {}
      };

      // Mock existing user
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'existing-id' })
      });

      handleMessage(mockClient, 'chat/auth/register', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'chat/auth/register/response'
        }),
        expect.any(Function)
      );

      // Verify the payload contains success: false
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = JSON.parse(Buffer.from(call[0].payload).toString());
      expect(responsePayload.payload.success).toBe(false);
    });

    it('should register new user successfully', () => {
      const payload = {
        type: 'request',
        timestamp: new Date().toISOString(),
        payload: { username: 'newuser', password: 'password123' },
        meta: {}
      };

      // Mock no existing user
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
        run: jest.fn()
      });

      handleMessage(mockClient, 'chat/auth/register', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = JSON.parse(Buffer.from(call[0].payload).toString());
      expect(responsePayload.payload.success).toBe(true);
    });
  });

  describe('login', () => {
    it('should return error when user not found', () => {
      const payload = {
        type: 'request',
        timestamp: new Date().toISOString(),
        payload: { username: 'nonexistent', password: 'password123' },
        meta: {}
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null)
      });

      handleMessage(mockClient, 'chat/auth/login', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = JSON.parse(Buffer.from(call[0].payload).toString());
      expect(responsePayload.payload.success).toBe(false);
    });

    it('should return error on wrong password', () => {
      const payload = {
        type: 'request',
        timestamp: new Date().toISOString(),
        payload: { username: 'testuser', password: 'wrongpassword' },
        meta: {}
      };

      const bcrypt = require('bcrypt');
      const existingUser = {
        id: 'user-123',
        username: 'testuser',
        password_hash: bcrypt.hashSync('correctpassword', 10)
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(existingUser)
      });

      handleMessage(mockClient, 'chat/auth/login', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = JSON.parse(Buffer.from(call[0].payload).toString());
      expect(responsePayload.payload.success).toBe(false);
    });

    it('should login successfully with correct credentials', () => {
      const payload = {
        type: 'request',
        timestamp: new Date().toISOString(),
        payload: { username: 'testuser', password: 'correctpassword' },
        meta: {}
      };

      const bcrypt = require('bcrypt');
      const existingUser = {
        id: 'user-123',
        username: 'testuser',
        password_hash: bcrypt.hashSync('correctpassword', 10),
        nickname: 'TestUser'
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(existingUser),
        run: jest.fn()
      });

      handleMessage(mockClient, 'chat/auth/login', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = JSON.parse(Buffer.from(call[0].payload).toString());
      expect(responsePayload.payload.success).toBe(true);
    });
  });
});

describe('handleGroupMessage', () => {
  let mockClient: jest.Mocked<Client>;
  let mockDb: any;
  let mockAedes: any;

  beforeEach(() => {
    mockClient = {
      id: 'client-123'
    } as jest.Mocked<Client>;

    mockDb = {
      prepare: jest.fn()
    };

    mockAedes = {
      publish: jest.fn()
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    (getAedes as jest.Mock).mockReturnValue(mockAedes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('message action', () => {
    it('should handle group message when user is a member', () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ userId: 'user-123', username: 'testuser' }, 'test-secret');

      const payload = {
        type: 'message',
        timestamp: new Date().toISOString(),
        payload: { userId: 'user-123', token, content: 'Hello group' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'group-123' }),
        run: jest.fn(),
        all: jest.fn().mockReturnValue([{ username: 'testuser', nickname: null }])
      });

      handleMessage(mockClient, 'chat/group/group-123/message', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
    });
  });

  describe('join action', () => {
    it('should allow user to join a group', () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ userId: 'user-123', username: 'testuser' }, 'test-secret');

      const payload = {
        type: 'request',
        timestamp: new Date().toISOString(),
        payload: { userId: 'user-123', token }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'group-123', is_active: 1 }),
        run: jest.fn()
      });

      handleMessage(mockClient, 'chat/group/group-123/join', Buffer.from(JSON.stringify(payload)));

      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('leave action', () => {
    it('should allow user to leave a group', () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ userId: 'user-123', username: 'testuser' }, 'test-secret');

      const payload = {
        type: 'request',
        timestamp: new Date().toISOString(),
        payload: { userId: 'user-123', token }
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn()
      });

      handleMessage(mockClient, 'chat/group/group-123/leave', Buffer.from(JSON.stringify(payload)));

      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });
});

describe('handlePrivateMessage', () => {
  let mockClient: jest.Mocked<Client>;
  let mockDb: any;
  let mockAedes: any;

  beforeEach(() => {
    mockClient = {
      id: 'client-123'
    } as jest.Mocked<Client>;

    mockDb = {
      prepare: jest.fn()
    };

    mockAedes = {
      publish: jest.fn()
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    (getAedes as jest.Mock).mockReturnValue(mockAedes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send private message successfully', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: 'sender-123', username: 'sender' }, 'test-secret');

    const payload = {
      type: 'message',
      timestamp: new Date().toISOString(),
      payload: { senderId: 'sender-123', token, content: 'Secret message' }
    };

    mockDb.prepare.mockReturnValue({
      run: jest.fn(),
      get: jest.fn().mockReturnValue({ username: 'sender', nickname: null })
    });

    handleMessage(mockClient, 'chat/user/receiver-456/private', Buffer.from(JSON.stringify(payload)));

    expect(mockAedes.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'chat/user/receiver-456/message'
      }),
      expect.any(Function)
    );
  });
});
