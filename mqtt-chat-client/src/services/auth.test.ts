import { AuthService } from './auth';
import { HttpService } from './http';

// Mock the HttpService
jest.mock('./http');

describe('AuthService', () => {
  let authService: AuthService;
  let mockHttpService: jest.Mocked<HttpService>;

  beforeEach(() => {
    mockHttpService = new HttpService() as jest.Mocked<HttpService>;
    authService = new AuthService(mockHttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return true and set credentials on successful login', async () => {
      const mockResponse = {
        success: true,
        userId: 'user-123',
        username: 'testuser',
        token: 'jwt-token-xyz'
      };
      mockHttpService.login.mockResolvedValue(mockResponse);

      const result = await authService.login('testuser', 'password123');

      expect(result).toBe(true);
      expect(authService.getUserId()).toBe('user-123');
      expect(authService.getUsername()).toBe('testuser');
      expect(authService.getToken()).toBe('jwt-token-xyz');
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should return false on failed login', async () => {
      mockHttpService.login.mockResolvedValue(null);

      const result = await authService.login('testuser', 'wrongpassword');

      expect(result).toBe(false);
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return false when login returns success: false', async () => {
      const mockResponse = { success: false, error: 'Invalid credentials' };
      mockHttpService.login.mockResolvedValue(mockResponse);

      const result = await authService.login('testuser', 'wrongpassword');

      expect(result).toBe(false);
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should call httpService.login with correct parameters', async () => {
      mockHttpService.login.mockResolvedValue({
        success: true,
        userId: 'user-123',
        username: 'testuser',
        token: 'jwt-token-xyz'
      });

      await authService.login('testuser', 'password123');

      expect(mockHttpService.login).toHaveBeenCalledWith('testuser', 'password123');
    });
  });

  describe('register', () => {
    it('should return true and set credentials on successful registration', async () => {
      const mockResponse = {
        success: true,
        userId: 'user-456',
        username: 'newuser',
        token: 'jwt-token-new'
      };
      mockHttpService.register.mockResolvedValue(mockResponse);

      const result = await authService.register('newuser', 'password123');

      expect(result).toBe(true);
      expect(authService.getUserId()).toBe('user-456');
      expect(authService.getUsername()).toBe('newuser');
      expect(authService.getToken()).toBe('jwt-token-new');
    });

    it('should return false on failed registration', async () => {
      mockHttpService.register.mockResolvedValue(null);

      const result = await authService.register('existinguser', 'password123');

      expect(result).toBe(false);
    });

    it('should return false when register returns success: false', async () => {
      const mockResponse = { success: false, error: 'Username taken' };
      mockHttpService.register.mockResolvedValue(mockResponse);

      const result = await authService.register('existinguser', 'password123');

      expect(result).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear all credentials', async () => {
      // First login
      mockHttpService.login.mockResolvedValue({
        success: true,
        userId: 'user-123',
        username: 'testuser',
        token: 'jwt-token-xyz'
      });
      await authService.login('testuser', 'password123');

      expect(authService.isAuthenticated()).toBe(true);

      // Then logout
      authService.logout();

      expect(authService.getUserId()).toBeNull();
      expect(authService.getUsername()).toBeNull();
      expect(authService.getToken()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
      expect(mockHttpService.clearToken).toHaveBeenCalled();
    });
  });

  describe('getUserId', () => {
    it('should return userId after successful login', async () => {
      mockHttpService.login.mockResolvedValue({
        success: true,
        userId: 'user-789',
        username: 'testuser',
        token: 'token'
      });
      await authService.login('testuser', 'password');

      expect(authService.getUserId()).toBe('user-789');
    });

    it('should return null before authentication', () => {
      expect(authService.getUserId()).toBeNull();
    });
  });

  describe('getUsername', () => {
    it('should return username after successful login', async () => {
      mockHttpService.login.mockResolvedValue({
        success: true,
        userId: 'user-123',
        username: 'johndoe',
        token: 'token'
      });
      await authService.login('johndoe', 'password');

      expect(authService.getUsername()).toBe('johndoe');
    });

    it('should return null before authentication', () => {
      expect(authService.getUsername()).toBeNull();
    });
  });

  describe('getToken', () => {
    it('should return token after successful login', async () => {
      mockHttpService.login.mockResolvedValue({
        success: true,
        userId: 'user-123',
        username: 'testuser',
        token: 'secret-token'
      });
      await authService.login('testuser', 'password');

      expect(authService.getToken()).toBe('secret-token');
    });

    it('should return null before authentication', () => {
      expect(authService.getToken()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token exists', async () => {
      expect(authService.isAuthenticated()).toBe(false);

      // Simulate authenticated state by directly setting via login
      mockHttpService.login.mockResolvedValue({
        success: true,
        userId: 'user-123',
        username: 'testuser',
        token: 'token'
      });
      await authService.login('testuser', 'password');

      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should return false when token is null', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });
  });
});
