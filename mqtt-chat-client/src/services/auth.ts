import { HttpService } from './http';
import { MqttClientService } from '../mqtt/client';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

export class AuthService {
  private httpService: HttpService;
  private userId: string | null = null;
  private username: string | null = null;
  private token: string | null = null;

  constructor(httpService: HttpService) {
    this.httpService = httpService;
  }

  async login(username: string, password: string): Promise<boolean> {
    const result = await this.httpService.login(username, password);
    
    if (result && result.success) {
      this.userId = result.userId;
      this.username = result.username;
      this.token = result.token;
      this.httpService.setToken(this.token!);
      
      // 订阅用户专属主题
      console.log(chalk.green(`✅ Login successful`));
      return true;
    }
    
    return false;
  }

  async register(username: string, password: string): Promise<boolean> {
    const result = await this.httpService.register(username, password);
    
    if (result && result.success) {
      this.userId = result.userId;
      this.username = result.username;
      this.token = result.token;
      this.httpService.setToken(this.token!);
      
      console.log(chalk.green(`✅ Registration successful`));
      return true;
    }
    
    return false;
  }

  logout(): void {
    this.userId = null;
    this.username = null;
    this.token = null;
    this.httpService.clearToken();
    console.log(chalk.blue('Logged out'));
  }

  getUserId(): string | null {
    return this.userId;
  }

  getUsername(): string | null {
    return this.username;
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }
}
