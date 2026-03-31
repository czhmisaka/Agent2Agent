#!/usr/bin/env node
const { spawn } = require('child_process');

const TEST_USER = 'newuser1774945628';
const TEST_PASS = 'TestPass123';
const GROUP_ID = 'c41bcc00-0e3d-46d7-bdf5-8ca42d730ffe';

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║         CLI 自动化测试 - 真实交互                     ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log();

const process = spawn('node', ['dist/index.js'], {
  cwd: '/Users/chenzhihan/Desktop/Agent2Agent/mqtt-chat-client',
  stdio: ['pipe', 'pipe', 'pipe']
});

process.stdout.on('data', d => process.stdout.write(d));
process.stderr.on('data', d => process.stderr.write(d));

const send = (text) => process.stdin.write(text + '\n');

async function run() {
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('\n📤 执行登录...');
  send('/login ' + TEST_USER + ' ' + TEST_PASS);
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('\n📤 加入群组...');
  send('/join ' + GROUP_ID);
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('\n📤 发送消息...');
  send('Hello from CLI test! 🎉');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('\n📤 查看用户...');
  send('/who');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('\n📤 查看帮助...');
  send('/help');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('\n📤 退出...');
  send('/exit');
  await new Promise(r => setTimeout(r, 1000));
  
  if (!process.killed) process.kill();
  console.log('\n✅ 测试完成！');
}

run();
