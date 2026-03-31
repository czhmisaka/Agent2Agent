#!/usr/bin/env node
/**
 * CLI 自动化测试脚本 - 简化版
 */

const { spawn } = require('child_process');
const https = require('http');

const SERVER_HOST = 'localhost';
const SERVER_PORT = 14070;
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

// 测试用户 - 使用已存在的用户
const TEST_USERNAME = 'czhmisaka';
const TEST_PASSWORD = 'czh123';
const GROUP_ID = '36a11e6a-28c1-4a40-b4b9-823ce16d8994';

let authToken = '';
let authUserId = '';

class CLITestRunner {
  constructor() {
    this.process = null;
    this.commands = [];
    this.results = [];
    this.logs = [];
  }

  /**
   * HTTP 请求封装
   */
  async httpRequest(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: SERVER_HOST,
        port: SERVER_PORT,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data: data });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  /**
   * 登录获取 token
   */
  async loginAndGetToken() {
    console.log('📝 登录获取 token...');
    const res = await this.httpRequest('POST', '/api/users/login', {
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    });

    if (res.data.success) {
      authToken = res.data.token;
      authUserId = res.data.userId;
      console.log(`✅ 登录成功: ${TEST_USERNAME}`);
      console.log(`   Token: ${authToken.substring(0, 30)}...`);
      console.log(`   UserId: ${authUserId}`);
      return true;
    } else {
      console.log(`❌ 登录失败: ${res.data.error}`);
      return false;
    }
  }

  /**
   * 运行测试
   */
  async run() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         CLI 自动化测试 - 开始执行                      ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log();
    console.log(`📌 测试用户: ${TEST_USERNAME}`);
    console.log(`📌 群组 ID: ${GROUP_ID}`);
    console.log();

    // 1. 登录获取 token
    const loggedIn = await this.loginAndGetToken();
    if (!loggedIn) {
      console.log('❌ 无法继续测试，登录失败');
      return;
    }

    // 2. 启动 CLI 进程
    console.log();
    console.log('🚀 启动 CLI 客户端...');
    this.startProcess();

    // 等待连接建立
    await this.delay(3000);

    // 3. 执行测试命令
    await this.executeCommands();

    // 4. 退出
    await this.delay(1000);
    this.sendInput('/exit\n');
    await this.delay(1000);

    // 5. 打印结果
    this.printResults();

    // 清理
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }

  /**
   * 执行测试命令
   */
  async executeCommands() {
    const commands = [
      { cmd: '/login ' + TEST_USERNAME + ' ' + TEST_PASSWORD, desc: '登录', wait: 4000 },
      { cmd: '/join ' + GROUP_ID, desc: '加入群组', wait: 2000 },
      { cmd: 'Hello from CLI test! 🎉', desc: '发送消息', wait: 2000 },
      { cmd: '@' + TEST_USERNAME + ' testing', desc: '发送提及', wait: 2000 },
      { cmd: '/who', desc: '查看用户', wait: 2000 },
      { cmd: '/list', desc: '查看群组', wait: 2000 },
      { cmd: '/history ' + GROUP_ID, desc: '查看历史', wait: 2000 },
      { cmd: '/mention', desc: '查看提及', wait: 2000 },
      { cmd: '/stats', desc: '查看统计', wait: 2000 },
      { cmd: '/help', desc: '查看帮助', wait: 2000 },
    ];

    console.log();
    console.log('📤 开始执行命令序列...');
    console.log();

    for (const { cmd, desc, wait } of commands) {
      console.log(`📤 ${desc}: ${cmd}`);
      this.sendInput(cmd + '\n');
      await this.delay(wait);
    }
  }

  /**
   * 启动 CLI 进程
   */
  startProcess() {
    this.process = spawn('node', ['dist/index.js'], {
      cwd: '/Users/chenzhihan/Desktop/Agent2Agent/mqtt-chat-client',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    this.process.stdout.on('data', (data) => {
      const output = data.toString();
      this.logs.push({ type: 'stdout', text: output, time: Date.now() });
      // 打印实时输出
      process.stdout.write(output);
    });

    this.process.stderr.on('data', (data) => {
      process.stderr.write(data);
      this.logs.push({ type: 'stderr', text: data.toString(), time: Date.now() });
    });

    this.process.on('close', (code) => {
      this.logs.push({ type: 'exit', text: `Exited with ${code}`, time: Date.now() });
    });
  }

  /**
   * 发送输入
   */
  sendInput(text) {
    if (this.process && this.process.stdin && !this.process.stdin.destroyed) {
      this.process.stdin.write(text);
    }
  }

  /**
   * 延迟
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 打印结果
   */
  printResults() {
    console.log();
    console.log('═══════════════════════════════════════════════════════════');
    console.log('测试完成！请检查上方输出验证功能是否正常。');
    console.log('═══════════════════════════════════════════════════════════');
  }
}

// 运行测试
const test = new CLITestRunner();
test.run().catch(console.error);
