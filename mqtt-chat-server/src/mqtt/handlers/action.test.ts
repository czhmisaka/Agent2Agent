import { handleMessageAction } from './action';
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

describe('handleMessageAction', () => {
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

  const createValidToken = () => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ userId: 'user-123', username: 'testuser' }, 'test-secret');
  };

  const extractPayloadFromCall = (call: any) => {
    const payloadBuffer = call[0].payload;
    return JSON.parse(Buffer.from(payloadBuffer).toString());
  };

  describe('token validation', () => {
    it('should return error when token is missing', () => {
      const payload = {
        type: 'action',
        action: 'highlight',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123' },
        meta: { groupId: 'group-123' }
      };

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.success).toBe(false);
    });

    it('should return error when token is invalid', () => {
      const payload = {
        type: 'action',
        action: 'highlight',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token: 'invalid-token' },
        meta: { groupId: 'group-123' }
      };

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.success).toBe(false);
    });
  });

  describe('highlight action', () => {
    it('should highlight a message successfully', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'highlight',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token },
        meta: { groupId: 'group-123', correlationId: 'corr-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn()
          .mockReturnValueOnce({ id: 'msg-123', group_id: 'group-123' })
          .mockReturnValueOnce(null),
        run: jest.fn()
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
    });

    it('should return error when message not found', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'highlight',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'nonexistent', token },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null)
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.success).toBe(false);
    });

    it('should return error when message already highlighted', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'highlight',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn()
          .mockReturnValueOnce({ id: 'msg-123', group_id: 'group-123' })
          .mockReturnValueOnce({ id: 'flag-123' })
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.error).toBe('Message already highlighted');
    });
  });

  describe('pin action', () => {
    it('should pin a message successfully', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'pin',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn()
          .mockReturnValueOnce({ id: 'msg-123', group_id: 'group-123' })
          .mockReturnValueOnce(null),
        run: jest.fn()
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
    });

    it('should return error when message already pinned', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'pin',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn()
          .mockReturnValueOnce({ id: 'msg-123', group_id: 'group-123' })
          .mockReturnValueOnce({ id: 'flag-123' })
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.error).toBe('Message already pinned');
    });
  });

  describe('unpin action', () => {
    it('should unpin a message successfully', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'unpin',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn().mockReturnValue({ changes: 1 })
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      // broadcastMessageUpdate is called first, then sendActionResponse
      const call = mockAedes.publish.mock.calls[1];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.success).toBe(true);
    });

    it('should return error when message is not pinned', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'unpin',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn().mockReturnValue({ changes: 0 })
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.error).toBe('Message is not pinned');
    });
  });

  describe('reaction action', () => {
    it('should add a reaction to a message', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'reaction',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token, emoji: '👍' },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn()
          .mockReturnValueOnce({ id: 'msg-123' })
          .mockReturnValueOnce(null)
          .mockReturnValueOnce({ count: 1 }),
        run: jest.fn(),
        all: jest.fn().mockReturnValue([])
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
    });

    it('should remove reaction when already exists (toggle)', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'reaction',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token, emoji: '👍' },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn()
          .mockReturnValueOnce({ id: 'msg-123' })
          .mockReturnValueOnce({ id: 'reaction-123' })
          .mockReturnValueOnce({ count: 0 }),
        run: jest.fn(),
        all: jest.fn().mockReturnValue([])
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
    });
  });

  describe('recall action', () => {
    it('should recall a message successfully', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'recall',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'msg-123', sender_id: 'user-123', is_recalled: 0 }),
        run: jest.fn()
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      // broadcastRecall is called first, then sendActionResponse
      const call = mockAedes.publish.mock.calls[1];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.success).toBe(true);
    });

    it('should return error when message not found or not owner', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'recall',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null)
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.success).toBe(false);
    });

    it('should return error when message already recalled', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'recall',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'msg-123', sender_id: 'user-123', is_recalled: 1 })
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.error).toBe('Message already recalled');
    });
  });

  describe('subscribe action', () => {
    it('should create a subscription successfully', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'subscribe',
        timestamp: new Date().toISOString(),
        payload: { token, target: 'keyword', value: 'help' },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
        run: jest.fn()
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.success).toBe(true);
    });

    it('should return error for invalid subscription type', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'subscribe',
        timestamp: new Date().toISOString(),
        payload: { token, target: 'invalid', value: 'something' },
        meta: { groupId: 'group-123' }
      };

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.error).toBe('Invalid subscription type. Must be keyword, topic, or user');
    });

    it('should return error when subscription already exists', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'subscribe',
        timestamp: new Date().toISOString(),
        payload: { token, target: 'keyword', value: 'help' },
        meta: { groupId: 'group-123' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'existing-sub' })
      });

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.error).toBe('Subscription already exists');
    });
  });

  describe('unsubscribe action', () => {
    it('should delete a subscription successfully', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'unsubscribe',
        timestamp: new Date().toISOString(),
        payload: { token, target: 'keyword', value: 'help' }
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn().mockReturnValue({ changes: 1 })
      });

      handleMessageAction(mockClient, 'chat/user/user-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.success).toBe(true);
    });

    it('should return error when subscription not found', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'unsubscribe',
        timestamp: new Date().toISOString(),
        payload: { token, target: 'keyword', value: 'nonexistent' }
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn().mockReturnValue({ changes: 0 })
      });

      handleMessageAction(mockClient, 'chat/user/user-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.error).toBe('Subscription not found');
    });
  });

  describe('emoji_add action', () => {
    it('should create a custom emoji successfully', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'emoji_add',
        timestamp: new Date().toISOString(),
        payload: { token, target: 'thumbsup', value: '👍' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
        run: jest.fn()
      });

      handleMessageAction(mockClient, 'chat/user/user-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.success).toBe(true);
    });

    it('should return error when emoji name already exists', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'emoji_add',
        timestamp: new Date().toISOString(),
        payload: { token, target: 'thumbsup', value: '👍' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'existing-emoji' })
      });

      handleMessageAction(mockClient, 'chat/user/user-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.error).toBe('Emoji name already exists');
    });
  });

  describe('cmd_add action', () => {
    it('should create a custom command successfully', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'cmd_add',
        timestamp: new Date().toISOString(),
        payload: { token, target: 'greet', value: 'Hello, {{user}}!' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
        run: jest.fn()
      });

      handleMessageAction(mockClient, 'chat/user/user-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.success).toBe(true);
    });

    it('should return error when command name already exists', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'cmd_add',
        timestamp: new Date().toISOString(),
        payload: { token, target: 'greet', value: 'Hello!' }
      };

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 'existing-cmd' })
      });

      handleMessageAction(mockClient, 'chat/user/user-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.error).toBe('Command name already exists');
    });
  });

  describe('unknown action', () => {
    it('should return error for unknown action type', () => {
      const token = createValidToken();
      const payload = {
        type: 'action',
        action: 'unknown_action',
        timestamp: new Date().toISOString(),
        payload: { messageId: 'msg-123', token },
        meta: { groupId: 'group-123' }
      };

      handleMessageAction(mockClient, 'chat/group/group-123/action', Buffer.from(JSON.stringify(payload)));

      expect(mockAedes.publish).toHaveBeenCalled();
      const call = mockAedes.publish.mock.calls[0];
      const responsePayload = extractPayloadFromCall(call);
      expect(responsePayload.payload.error).toBe('Unknown action type');
    });
  });
});
