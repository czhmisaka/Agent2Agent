import { MessageService } from './message';
import { HttpService } from './http';
import { MqttClientService } from '../mqtt/client';

// Mock dependencies
jest.mock('./http');
jest.mock('../mqtt/client');

describe('MessageService', () => {
  let messageService: MessageService;
  let mockHttpService: jest.Mocked<HttpService>;
  let mockMqttClient: jest.Mocked<MqttClientService>;

  beforeEach(() => {
    mockHttpService = new HttpService() as jest.Mocked<HttpService>;
    mockMqttClient = new MqttClientService() as jest.Mocked<MqttClientService>;
    messageService = new MessageService(mockHttpService, mockMqttClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setCredentials', () => {
    it('should set userId, token and update httpService', () => {
      messageService.setCredentials('user-123', 'token-xyz');

      expect(mockHttpService.setToken).toHaveBeenCalledWith('token-xyz');
    });
  });

  describe('setToken', () => {
    it('should set token and update httpService', () => {
      messageService.setToken('new-token');

      expect(mockHttpService.setToken).toHaveBeenCalledWith('new-token');
    });
  });

  describe('sendMessage', () => {
    it('should return true on successful send', async () => {
      mockMqttClient.publish.mockResolvedValue();

      const result = await messageService.sendMessage('group-123', 'Hello world', 'user-123');

      expect(result).toBe(true);
      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        'chat/group/group-123/message',
        expect.objectContaining({
          type: 'message',
          payload: expect.objectContaining({
            userId: 'user-123',
            content: 'Hello world'
          }),
          meta: expect.objectContaining({
            groupId: 'group-123'
          })
        }),
        2
      );
    });

    it('should return false on publish error', async () => {
      mockMqttClient.publish.mockRejectedValue(new Error('Network error'));

      const result = await messageService.sendMessage('group-123', 'Hello world', 'user-123');

      expect(result).toBe(false);
    });

    it('should include messageId in meta', async () => {
      mockMqttClient.publish.mockResolvedValue();

      await messageService.sendMessage('group-123', 'Hello', 'user-123');

      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        'chat/group/group-123/message',
        expect.objectContaining({
          meta: expect.objectContaining({
            messageId: expect.any(String)
          })
        }),
        2
      );
    });
  });

  describe('sendPrivateMessage', () => {
    it('should return true on successful send', async () => {
      mockMqttClient.publish.mockResolvedValue();

      const result = await messageService.sendPrivateMessage('receiver-456', 'Secret message', 'sender-123');

      expect(result).toBe(true);
      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        'chat/user/receiver-456/private',
        expect.objectContaining({
          type: 'message',
          payload: expect.objectContaining({
            senderId: 'sender-123',
            content: 'Secret message'
          }),
          meta: expect.objectContaining({
            receiverId: 'receiver-456'
          })
        }),
        2
      );
    });

    it('should return false on publish error', async () => {
      mockMqttClient.publish.mockRejectedValue(new Error('Connection lost'));

      const result = await messageService.sendPrivateMessage('receiver-456', 'Secret', 'sender-123');

      expect(result).toBe(false);
    });

    it('should include messageId in meta', async () => {
      mockMqttClient.publish.mockResolvedValue();

      await messageService.sendPrivateMessage('receiver-456', 'Hello', 'sender-123');

      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        'chat/user/receiver-456/private',
        expect.objectContaining({
          meta: expect.objectContaining({
            messageId: expect.any(String)
          })
        }),
        2
      );
    });
  });

  describe('getHistory', () => {
    it('should call httpService.getGroupMessages', async () => {
      const mockMessages = [
        { id: '1', content: 'Hello', username: 'user1' },
        { id: '2', content: 'Hi', username: 'user2' }
      ];
      mockHttpService.getGroupMessages.mockResolvedValue(mockMessages);

      await messageService.getHistory('group-123');

      expect(mockHttpService.getGroupMessages).toHaveBeenCalledWith('group-123', 50);
    });

    it('should respect custom limit parameter', async () => {
      mockHttpService.getGroupMessages.mockResolvedValue([]);

      await messageService.getHistory('group-123', 100);

      expect(mockHttpService.getGroupMessages).toHaveBeenCalledWith('group-123', 100);
    });
  });

  describe('getPrivateHistory', () => {
    it('should call httpService.getPrivateMessages', async () => {
      const mockMessages = [
        { id: '1', content: 'Private message', sender_username: 'user1' }
      ];
      mockHttpService.getPrivateMessages.mockResolvedValue(mockMessages);

      await messageService.getPrivateHistory('user-456');

      expect(mockHttpService.getPrivateMessages).toHaveBeenCalledWith('user-456', 50);
    });

    it('should respect custom limit parameter', async () => {
      mockHttpService.getPrivateMessages.mockResolvedValue([]);

      await messageService.getPrivateHistory('user-456', 20);

      expect(mockHttpService.getPrivateMessages).toHaveBeenCalledWith('user-456', 20);
    });
  });
});
