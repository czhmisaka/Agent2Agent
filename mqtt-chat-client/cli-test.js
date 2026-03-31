#!/usr/bin/env node
/**
 * CLI 自动化测试脚本
 * 使用子进程模拟真实用户输入来测试 CLI 客户端
 */

const { spawn } = require('child_process');
const readline = require('readline');

const SERVER_URL = 'http://localhost:14070';
const TEST_USERNAME = 'clitest_' + Date.now();
const TEST_PASSWORD = 'TestPass123';
let GROUP_ID = '';

class CLITestRunner {
  constructor() {
    this.process = null;
    this.commandIndex = 0;
    this.commands = [];
    this.results = [];
    this.logs = [];
  }

  /**
   * 添加测试命令
   */
  addCommand(command, expectedPatterns = [], timeout = 5000) {
    this.commands.push({ command, expectedPatterns, timeout, executed: false });
    return this;
  }

  /**
   * 运行测试
   */
  async run() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         CLI 自动化测试 - 开始执行                      ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log();

    // 先注册用户获取 groupId
    await this.registerAndGetGroupId();

    // 启动 CLI 进程
    this.startProcess();

    // 等待连接建立
    await this.delay(2000);

    // 执行测试命令序列
    for (const cmd of this.commands) {
      if (!cmd.executed) {
        await this.executeCommand(cmd);
      }
    }

    // 发送退出命令
    await this.delay(1000);
    this.sendInput('/exit\n');

    // 等待进程退出
    await this.delay(1000);

    // 输出结果
    this.printResults();

    // 清理
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }

  /**
   * 注册测试用户并获取群组ID
   */
  async registerAndGetGroupId() {
    console.log('📝 注册测试用户...');

    const registerRes = await fetch(`${SERVER_URL}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD })
    });

    const registerData = await registerRes.json();
    if (registerData.success) {
      console.log(`✅ 用户 ${TEST_USERNAME} 注册成功`);
    } else {
      console.log(`⚠️  注册失败（可能已存在）: ${registerData.error}`);
    }

    // 获取群组列表
    const loginRes = await fetch(`${SERVER_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD })
    });

    const loginData = await loginRes.json();
    if (loginData.success) {
      const token = loginData.token;
      const userId = loginData.userId;

      // 创建测试群组
      const createRes = await fetch(`${SERVER_URL}/api/groups`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: 'CLI-Test-Group-' + Date.now() })
      });

      const createData = await createRes.json();
      if (createData.success) {
        GROUP_ID = createData.groupId;
        console.log(`✅ 创建群组: ${GROUP_ID}`);
      } else {
        // 如果创建失败，使用现有群组
        const listRes = await fetch(`${SERVER_URL}/api/groups`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const listData = await listRes.json();
        if (listData.groups && listData.groups.length > 0) {
          GROUP_ID = listData.groups[0].id;
          console.log(`✅ 使用现有群组: ${GROUP_ID}`);
        }
      }

      // 加入群组
      if (GROUP_ID) {
        await fetch(`${SERVER_URL}/api/groups/${GROUP_ID}/join`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ userId })
        });
        console.log(`✅ 加入群组: ${GROUP_ID}`);
      }
    }

    console.log();
    return GROUP_ID;
  }

  /**
   * 启动 CLI 进程
   */
  startProcess() {
    console.log('🚀 启动 CLI 客户端...');
    console.log();

    this.process = spawn('node', ['dist/index.js'], {
      cwd: '/Users/chenzhihan/Desktop/Agent2Agent/mqtt-chat-client',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    // 收集输出
    this.process.stdout.on('data', (data) => {
      const output = data.toString();
      this.logs.push({ type: 'stdout', text: output, time: Date.now() });
      this.checkExpectedPatterns(output);
    });

    this.process.stderr.on('data', (data) => {
      const output = data.toString();
      this.logs.push({ type: 'stderr', text: output, time: Date.now() });
    });

    this.process.on('close', (code) => {
      this.logs.push({ type: 'exit', text: `Process exited with code ${code}`, time: Date.now() });
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
   * 执行单个命令
   */
  async executeCommand(cmd) {
    console.log(`📤 执行命令: ${cmd.command}`);

    this.sendInput(cmd.command + '\n');

    // 等待命令执行
    await this.delay(cmd.timeout);

    cmd.executed = true;

    // 检查是否有匹配的日志
    const relevantLogs = this.logs
      .filter(log => log.time > Date.now() - cmd.timeout - 1000)
      .map(log => log.text)
      .join('');

    // 验证预期模式
    let passed = true;
    for (const pattern of cmd.expectedPatterns) {
      if (!relevantLogs.includes(pattern)) {
        passed = false;
        this.results.push({
          command: cmd.command,
          status: 'FAIL',
          reason: `预期包含: "${pattern}"`,
          output: relevantLogs.substring(0, 500)
        });
        console.log(`   ❌ 失败: 未找到 "${pattern}"`);
        break;
      }
    }

    if (passed && cmd.expectedPatterns.length > 0) {
      this.results.push({
        command: cmd.command,
        status: 'PASS',
        output: relevantLogs.substring(0, 500)
      });
      console.log(`   ✅ 通过`);
    }

    return relevantLogs;
  }

  /**
   * 检查预期模式
   */
  checkExpectedPatterns(output) {
    // 可以在这里检查实时输出
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
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                    测试结果汇总                         ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log();

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    console.log(`📊 总计: ${this.results.length} | ✅ 通过: ${passed} | ❌ 失败: ${failed}`);
    console.log();

    for (const result of this.results) {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${result.command}`);
      if (result.reason) {
        console.log(`   原因: ${result.reason}`);
      }
    }

    console.log();
    console.log('═══════════════════════════════════════════════════════════');

    if (failed === 0) {
      console.log('🎉 所有测试通过！');
    } else {
      console.log(`⚠️  ${failed} 个测试失败`);
      process.exit(1);
    }
  }
}

// 创建测试实例
const test = new CLITestRunner();

// 添加测试命令序列
test
  // 1. 登录
  .addCommand('/login ' + TEST_USERNAME + ' ' + TEST_PASSWORD, ['Logged in', 'Connected'], 3000)
  
  // 2. 加入群组
  .addCommand('/join ' + GROUP_ID, ['Joined', 'group'], 2000)
  
  // 3. 发送普通消息
  .addCommand('Hello from CLI test! 🎉', ['sent'], 2000)
  
  // 4. 发送带 @ 提及的消息
  .addCommand('@' + TEST_USERNAME + ' testing mentions', ['sent'], 2000)
  
  // 5. 查看历史
  .addCommand('/history ' + GROUP_ID + ' 10', [], 2000)
  
  // 6. 查看用户列表
  .addCommand('/who', [], 2000)
  
  // 7. 查看群组列表
  .addCommand('/list', [], 2000)
  
  // 8. 查看帮助
  .addCommand('/help', ['可用指令', 'Commands'], 2000)
  
  // 9. 查看统计
  .addCommand('/stats', [], 2000)
  
  // 10. 查看提及
  .addCommand('/mention', ['mentions'], 2000);

// 运行测试
test.run().catch(console.error);
