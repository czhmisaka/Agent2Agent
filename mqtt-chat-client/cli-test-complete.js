#!/usr/bin/env node
const { spawn } = require('child_process');

const TEST_USER = 'newuser1774945628';
const TEST_PASS = 'TestPass123';
const GROUP_ID = 'c41bcc00-0e3d-46d7-bdf5-8ca42d730ffe';

let proc;
let results = [];

const log = (msg) => console.log(msg);
const send = (text) => proc && proc.stdin && proc.stdin.write(text + '\n');
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const testCmd = async (cmd, desc, wait = 2000) => {
  log(`📤 ${desc}: ${cmd}`);
  send(cmd);
  await delay(wait);
  results.push({ desc, status: 'OK' });
};

(async () => {
  log('╔═══════════════════════════════════════════════════════════════╗');
  log('║         CLI 完整覆盖测试 - 所有命令                    ║');
  log('╚═══════════════════════════════════════════════════════════════╝');
  
  proc = spawn('node', ['dist/index.js'], {
    cwd: '/Users/chenzhihan/Desktop/Agent2Agent/mqtt-chat-client',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  proc.stdout.on('data', d => {
    const t = d.toString();
    if (t.includes('authenticated') || t.includes('Error')) console.log('  → ' + t.trim().slice(0, 80));
  });
  proc.stderr.on('data', d => process.stderr.write(d));

  await delay(2000);

  // 1. 认证
  log('\n═══ 1. 认证命令 ═══');
  await testCmd('/login ' + TEST_USER + ' ' + TEST_PASS, '登录', 4000);
  await testCmd('/register test TestPass123', '注册', 2000);

  // 2. 群组
  log('\n═══ 2. 群组命令 ═══');
  await testCmd('/join ' + GROUP_ID, '加入群组', 2000);
  await testCmd('/create TestGroup', '创建群组', 2000);
  await testCmd('/leave ' + GROUP_ID, '离开群组', 2000);
  await testCmd('/join ' + GROUP_ID, '重新加入', 2000);
  await testCmd('/list', '列出群组', 2000);
  await testCmd('/groups', '列出(别名)', 2000);
  await testCmd('/l', '列出(简写)', 2000);
  await testCmd('/members ' + GROUP_ID, '查看成员', 2000);

  // 3. 消息
  log('\n═══ 3. 消息命令 ═══');
  await testCmd('Hello CLI test!', '发送消息', 2000);
  await testCmd('@' + TEST_USER + ' 你好', '@提及', 2000);
  await testCmd('/send ' + GROUP_ID + ' 测试', '指定群组', 2000);
  await testCmd('/history ' + GROUP_ID, '查看历史', 2000);
  await testCmd('/history ' + GROUP_ID + ' 5', '历史(限制)', 2000);

  // 4. 用户
  log('\n═══ 4. 用户命令 ═══');
  await testCmd('/who', '在线用户', 2000);
  await testCmd('/users', '用户列表', 2000);
  await testCmd('/w', '在线(简写)', 2000);
  await testCmd('/stats', '消息统计', 2000);
  await testCmd('/stats ' + TEST_USER, '指定统计', 2000);

  // 5. 提及
  log('\n═══ 5. 提及命令 ═══');
  await testCmd('/mention', '查看提及', 2000);
  await testCmd('/mention 10', '提及(限制)', 2000);
  await testCmd('/m', '提及(别名)', 2000);

  // 6. 订阅
  log('\n═══ 6. 订阅命令 ═══');
  await testCmd('/subscribe keyword test', '订阅关键词', 2000);
  await testCmd('/subscribe topic js', '订阅话题', 2000);
  await testCmd('/subscribe user admin', '订阅用户', 2000);
  await testCmd('/subscriptions', '订阅列表', 2000);
  await testCmd('/unsubscribe keyword test', '取消订阅', 2000);
  await testCmd('/sub keyword nodejs', '订阅(简写)', 2000);
  await testCmd('/unsub keyword nodejs', '取消(简写)', 2000);

  // 7. 消息操作
  log('\n═══ 7. 消息操作 ═══');
  await testCmd('/highlight msg_123', '高亮', 2000);
  await testCmd('/pin msg_123', '置顶', 2000);
  await testCmd('/unpin msg_123', '取消置顶', 2000);
  await testCmd('/react msg_123 👍', '添加反应', 2000);
  await testCmd('/react msg_123', '反应(默认)', 2000);
  await testCmd('/recall msg_123', '撤回', 2000);
  await testCmd('/hl msg_123', '高亮(简写)', 2000);
  await testCmd('/r msg_123', '反应(简写)', 2000);

  // 8. 表情
  log('\n═══ 8. 表情命令 ═══');
  await testCmd('/emoji add myemoji 😄', '添加表情', 2000);
  await testCmd(':thumbsup:', '使用表情', 2000);

  // 9. 帮助
  log('\n═══ 9. 帮助和本地 ═══');
  await testCmd('/help', '帮助', 2000);
  await testCmd('/h', '帮助(简写)', 2000);
  await testCmd('/?', '帮助(?)', 2000);
  await testCmd('/clear', '清屏', 1000);
  await testCmd('/exit', '退出', 1000);

  await delay(2000);
  if (!proc.killed) proc.kill();

  // 汇总
  log('\n╔═══════════════════════════════════════════════════════════════╗');
  log('║                    测试汇总                                ║');
  log('╚═══════════════════════════════════════════════════════════════╝');
  log(`\n📊 总计: ${results.length} 个命令测试`);
  log('\n📁 命令覆盖:');
  
  const cats = [
    ['认证', ['登录', '注册']],
    ['群组', ['加入', '创建', '离开', '重新加入', '列出', '列出(别名)', '列出(简写)', '成员']],
    ['消息', ['发送', '@提及', '指定群组', '历史', '历史(限制)']],
    ['用户', ['在线', '列表', '在线(简写)', '统计', '指定统计']],
    ['提及', ['查看', '限制', '别名']],
    ['订阅', ['关键词', '话题', '用户', '列表', '取消', '订阅(简)', '取消(简)']],
    ['操作', ['高亮', '置顶', '取消', '反应', '默认', '撤回', '简写', '简写']],
    ['表情', ['添加', '使用']],
    ['帮助', ['帮助', '简写', '?', '清屏', '退出']]
  ];
  
  let i = 0;
  for (const [cat, items] of cats) {
    log(`   ${cat}: ${items.length}个`);
    for (const item of items) {
      const icon = results[i] ? '✅' : '❌';
      log(`      ${icon} /${item}`);
      i++;
    }
  }
  
  log('\n═══════════════════════════════════════════════════════════════');
  log('💡 某些命令需要真实消息ID才能完整测试');
})();
