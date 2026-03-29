import { GroupService } from './group';
import { HttpService } from './http';
import { MqttClientService } from '../mqtt/client';

// Mock dependencies
jest.mock('./http');
jest.mock('../mqtt/client');

describe('GroupService', () => {
  let groupService: GroupService;
  let mockHttpService: jest.Mocked<HttpService>;
  let mockMqttClient: jest.Mocked<MqttClientService>;

  beforeEach(() => {
    mockHttpService = new HttpService() as jest.Mocked<HttpService>;
    mockMqttClient = new MqttClientService() as jest.Mocked<MqttClientService>;
    groupService = new GroupService(mockHttpService, mockMqttClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setCredentials', () => {
    it('should set userId, token and update httpService', () => {
      groupService.setCredentials('user-123', 'token-xyz');

      expect(mockHttpService.setToken).toHaveBeenCalledWith('token-xyz');
    });
  });

  describe('setToken', () => {
    it('should set token and update httpService', () => {
      groupService.setToken('new-token');

      expect(mockHttpService.setToken).toHaveBeenCalledWith('new-token');
    });
  });

  describe('createGroup', () => {
    it('should return groupId on successful creation', async () => {
      const mockResponse = { success: true, groupId: 'group-123' };
      mockHttpService.createGroup.mockResolvedValue(mockResponse);

      const result = await groupService.createGroup('TestGroup', 'token', 'user-123');

      expect(result).toBe('group-123');
      expect(mockHttpService.createGroup).toHaveBeenCalledWith('TestGroup');
    });

    it('should return null on failed creation', async () => {
      mockHttpService.createGroup.mockResolvedValue(null);

      const result = await groupService.createGroup('TestGroup', 'token', 'user-123');

      expect(result).toBeNull();
    });

    it('should return null when success is false', async () => {
      const mockResponse = { success: false, error: 'Group already exists' };
      mockHttpService.createGroup.mockResolvedValue(mockResponse);

      const result = await groupService.createGroup('TestGroup', 'token', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('joinGroup', () => {
    it('should return true on successful join and publish MQTT message', async () => {
      const mockResponse = { success: true };
      mockHttpService.joinGroup.mockResolvedValue(mockResponse);
      mockMqttClient.publish.mockResolvedValue();

      const result = await groupService.joinGroup('group-123', 'token', 'user-123');

      expect(result).toBe(true);
      expect(mockHttpService.joinGroup).toHaveBeenCalledWith('group-123');
      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        'chat/group/group-123/join',
        expect.objectContaining({
          type: 'request',
          payload: expect.objectContaining({
            userId: 'user-123',
            token: 'token'
          })
        })
      );
    });

    it('should return false on failed join', async () => {
      mockHttpService.joinGroup.mockResolvedValue(null);

      const result = await groupService.joinGroup('group-123', 'token', 'user-123');

      expect(result).toBe(false);
    });

    it('should return false when success is false', async () => {
      const mockResponse = { success: false, error: 'Already a member' };
      mockHttpService.joinGroup.mockResolvedValue(mockResponse);

      const result = await groupService.joinGroup('group-123', 'token', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('leaveGroup', () => {
    it('should return true on successful leave and publish MQTT message', async () => {
      const mockResponse = { success: true };
      mockHttpService.leaveGroup.mockResolvedValue(mockResponse);
      mockMqttClient.publish.mockResolvedValue();

      const result = await groupService.leaveGroup('group-123', 'token', 'user-123');

      expect(result).toBe(true);
      expect(mockHttpService.leaveGroup).toHaveBeenCalledWith('group-123');
      expect(mockMqttClient.publish).toHaveBeenCalledWith(
        'chat/group/group-123/leave',
        expect.objectContaining({
          type: 'request',
          payload: expect.objectContaining({
            userId: 'user-123',
            token: 'token'
          })
        })
      );
    });

    it('should return false on failed leave', async () => {
      mockHttpService.leaveGroup.mockResolvedValue(null);

      const result = await groupService.leaveGroup('group-123', 'token', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('isGroupJoined', () => {
    it('should return false for groups not joined', () => {
      expect(groupService.isGroupJoined('group-123')).toBe(false);
    });

    it('should return true for groups that were joined', async () => {
      const mockResponse = { success: true };
      mockHttpService.joinGroup.mockResolvedValue(mockResponse);
      mockMqttClient.publish.mockResolvedValue();

      await groupService.joinGroup('group-123', 'token', 'user-123');

      expect(groupService.isGroupJoined('group-123')).toBe(true);
    });

    it('should return false for groups that were left', async () => {
      const mockResponse = { success: true };
      mockHttpService.joinGroup.mockResolvedValue(mockResponse);
      mockHttpService.leaveGroup.mockResolvedValue(mockResponse);
      mockMqttClient.publish.mockResolvedValue();

      await groupService.joinGroup('group-123', 'token', 'user-123');
      expect(groupService.isGroupJoined('group-123')).toBe(true);

      await groupService.leaveGroup('group-123', 'token', 'user-123');
      expect(groupService.isGroupJoined('group-123')).toBe(false);
    });
  });

  describe('getJoinedGroups', () => {
    it('should return empty array initially', () => {
      expect(groupService.getJoinedGroups()).toEqual([]);
    });

    it('should return array of joined group IDs', async () => {
      const mockResponse = { success: true };
      mockHttpService.joinGroup.mockResolvedValue(mockResponse);
      mockMqttClient.publish.mockResolvedValue();

      await groupService.joinGroup('group-1', 'token', 'user-123');
      await groupService.joinGroup('group-2', 'token', 'user-123');

      expect(groupService.getJoinedGroups()).toEqual(['group-1', 'group-2']);
    });
  });

  describe('listGroups', () => {
    it('should call httpService.getGroups', async () => {
      mockHttpService.getGroups.mockResolvedValue([]);

      await groupService.listGroups();

      expect(mockHttpService.getGroups).toHaveBeenCalled();
    });
  });

  describe('listMembers', () => {
    it('should call httpService.getGroupMembers with groupId', async () => {
      mockHttpService.getGroupMembers.mockResolvedValue([]);

      await groupService.listMembers('group-123');

      expect(mockHttpService.getGroupMembers).toHaveBeenCalledWith('group-123');
    });
  });
});
