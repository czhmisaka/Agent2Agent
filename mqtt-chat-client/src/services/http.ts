import axios, { AxiosInstance } from 'axios';
import { httpUrl } from '../config';
import chalk from 'chalk';

export class HttpService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: httpUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 添加请求拦截器
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // 添加响应拦截器
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error(chalk.red('HTTP Error:'), error.message);
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  // 用户相关 API
  async register(username: string, password: string) {
    try {
      const response = await this.client.post('/api/users/register', {
        username,
        password
      });
      if (response.data.success) {
        this.token = response.data.token;
        console.log(chalk.green(`✅ Registered successfully as ${username}`));
        return response.data;
      }
    } catch (error: any) {
      console.error(chalk.red('❌ Registration failed:'), error.response?.data?.error || error.message);
    }
    return null;
  }

  async login(username: string, password: string) {
    try {
      const response = await this.client.post('/api/users/login', {
        username,
        password
      });
      if (response.data.success) {
        this.token = response.data.token;
        console.log(chalk.green(`✅ Logged in successfully as ${username}`));
        return response.data;
      }
    } catch (error: any) {
      console.error(chalk.red('❌ Login failed:'), error.response?.data?.error || error.message);
    }
    return null;
  }

  async getCurrentUser() {
    try {
      const response = await this.client.get('/api/users/me');
      return response.data;
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get user info:'), error.message);
    }
    return null;
  }

  async getUsers() {
    try {
      const response = await this.client.get('/api/users');
      const users = response.data;
      
      console.log(chalk.yellow('\n👥 Online Users:'));
      users.forEach((user: any) => {
        const status = user.is_online ? chalk.green('🟢 Online') : chalk.gray('⚫ Offline');
        console.log(`  ${status} ${chalk.cyan(user.username)} ${user.nickname ? `(${user.nickname})` : ''}`);
      });
      console.log();
      
      return users;
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get users:'), error.message);
    }
    return [];
  }

  // 群组相关 API
  async createGroup(name: string, description?: string) {
    try {
      const response = await this.client.post('/api/groups', {
        name,
        description
      });
      if (response.data.success) {
        console.log(chalk.green(`✅ Group created: ${name} (ID: ${response.data.groupId})`));
        return response.data;
      }
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to create group:'), error.response?.data?.error || error.message);
    }
    return null;
  }

  async getGroups() {
    try {
      const response = await this.client.get('/api/groups');
      return response.data;
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get groups:'), error.message);
    }
    return [];
  }

  async getGroupDetails(groupId: string) {
    try {
      const response = await this.client.get(`/api/groups/${groupId}`);
      return response.data;
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get group details:'), error.message);
    }
    return null;
  }

  async getGroupMembers(groupId: string) {
    try {
      const response = await this.client.get(`/api/groups/${groupId}/members`);
      return response.data;
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get members:'), error.message);
    }
    return [];
  }

  async joinGroup(groupId: string) {
    try {
      const response = await this.client.post(`/api/groups/${groupId}/join`);
      if (response.data.success) {
        console.log(chalk.green(`✅ Joined group successfully`));
        return response.data;
      }
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to join group:'), error.response?.data?.error || error.message);
    }
    return null;
  }

  async leaveGroup(groupId: string) {
    try {
      const response = await this.client.post(`/api/groups/${groupId}/leave`);
      if (response.data.success) {
        console.log(chalk.green(`✅ Left group successfully`));
        return response.data;
      }
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to leave group:'), error.response?.data?.error || error.message);
    }
    return null;
  }

  // 消息相关 API
  async getGroupMessages(groupId: string, limit: number = 50, offset: number = 0) {
    try {
      const response = await this.client.get(`/api/groups/${groupId}/messages`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get messages:'), error.message);
    }
    return [];
  }

  async getPrivateMessages(userId: string, limit: number = 50, offset: number = 0) {
    try {
      const response = await this.client.get(`/api/messages/private/${userId}`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get private messages:'), error.message);
    }
    return [];
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      return null;
    }
  }
}
