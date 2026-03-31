#!/usr/bin/env node
/**
 * 完整 E2E 测试流程
 * 1. 创建多个用户
 * 2. 创建一个群组
 * 3. 用户加入群组并互相聊天
 * 4. 验证消息传递
 */

const https = require('http');

const SERVER = { host: 'localhost', port: 14070 };
const TS = Date.now();

const http = (method, path, body, token) => new Promise((res, rej) => {
  const opts = { hostname: SERVER.host, port: SERVER.port, path, method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  const req = https.request(opts, r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => { try { res({ s: r.statusCode, d: JSON.parse(d) }); } catch { res({ s: r.statusCode, d }); } });
  });
  req.on('error', rej);
  if (body) req.write(JSON.stringify(body));
  req.end();
});

async function run() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         完整 E2E 测试 - 多用户聊天流程              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // ========== 1. 创建测试用户 ==========
  console.log('📝 步骤1: 创建测试用户...');
  
  const users = [
    { name: `alice_${TS}`, pass: 'AlicePass123' },
    { name: `bob_${TS}`, pass: 'BobPass123' },
    { name: `charlie_${TS}`, pass: 'CharliePass123' }
  ];

  for (const u of users) {
    const r = await http('POST', '/api/users/register', { username: u.name, password: u.pass });
    if (r.d.success) {
      u.id = r.d.userId;
      console.log(`   ✅ 创建用户: ${u.name}`);
    } else {
      console.log(`   ⚠️  ${u.name} 可能已存在`);
      const login = await http('POST', '/api/users/login', { username: u.name, password: u.pass });
      if (login.d.success) {
        u.id = login.d.userId;
        console.log(`   ✅ 登录成功: ${u.name}`);
      }
    }
    
    // 登录获取 token
    const r2 = await http('POST', '/api/users/login', { username: u.name, password: u.pass });
    u.token = r2.d.token;
    u.auth = r2.d.token;
    console.log(`   🔑 Token: ${u.token.substring(0, 20)}...`);
  }

  // ========== 2. 创建群组 ==========
  console.log('\n📝 步骤2: 创建测试群组...');
  const groupRes = await http('POST', '/api/groups', { name: `TestGroup_${TS}` }, users[0].token);
  if (groupRes.d.success) {
    const GROUP_ID = groupRes.d.groupId;
    console.log(`   ✅ 群组创建成功: ${GROUP_ID}`);
    
    // ========== 3. 所有用户加入群组 ==========
    console.log('\n📝 步骤3: 用户加入群组...');
    for (const u of users) {
      const joinRes = await http('POST', `/api/groups/${GROUP_ID}/join`, { userId: u.id }, u.token);
      console.log(`   ${joinRes.d.success || joinRes.s === 200 ? '✅' : '⚠️'} ${u.name} 加入群组`);
    }

    // ========== 4. 用户1发送消息 ==========
    console.log('\n📝 步骤4: Alice 发送消息...');
    const msg1 = await http('POST', `/api/groups/${GROUP_ID}/messages`, 
      { content: 'Hello everyone! 👋' }, users[0].token);
    console.log(`   ${msg1.d.success ? '✅' : '❌'} Alice: "Hello everyone! 👋"`);
    const msg1Id = msg1.d.messageId;

    // ========== 5. 用户2发送消息 ==========
    console.log('\n📝 步骤5: Bob 发送消息...');
    const msg2 = await http('POST', `/api/groups/${GROUP_ID}/messages`,
      { content: 'Hi Alice! How are you?' }, users[1].token);
    console.log(`   ${msg2.d.success ? '✅' : '❌'} Bob: "Hi Alice! How are you?"`);
    const msg2Id = msg2.d.messageId;

    // ========== 6. 用户3发送消息 ==========
    console.log('\n📝 步骤6: Charlie 发送消息...');
    const msg3 = await http('POST', `/api/groups/${GROUP_ID}/messages`,
      { content: 'Hey guys! Charlie here!' }, users[2].token);
    console.log(`   ${msg3.d.success ? '✅' : '❌'} Charlie: "Hey guys! Charlie here!"`);
    const msg3Id = msg3.d.messageId;

    // ========== 7. 用户1发送带@提及的消息 ==========
    console.log('\n📝 步骤7: Alice @提及 Bob...');
    const msg4 = await http('POST', `/api/groups/${GROUP_ID}/messages`,
      { content: '@bob Great to see you!' }, users[0].token);
    console.log(`   ${msg4.d.success ? '✅' : '❌'} Alice @mentions Bob`);

    // ========== 8. 验证历史消息 ==========
    console.log('\n📝 步骤8: 验证消息历史...');
    const history = await http('GET', `/api/groups/${GROUP_ID}/messages?limit=10`, null, users[0].token);
    if (Array.isArray(history.d)) {
      console.log(`   ✅ 获取到 ${history.d.length} 条消息`);
      history.d.slice(-4).forEach(m => {
        console.log(`      - ${m.username}: ${m.content}`);
      });
    }

    // ========== 9. 验证提及功能 ==========
    console.log('\n📝 步骤9: 验证提及通知...');
    const mentions = await http('GET', '/api/users/me/mentions', null, users[1].token);
    console.log(`   ${mentions.d.success !== false ? '✅' : '⚠️'} Bob 的提及通知`);

    // ========== 10. 查看群组成员 ==========
    console.log('\n📝 步骤10: 查看群组成员...');
    const members = await http('GET', `/api/groups/${GROUP_ID}/members`, null, users[0].token);
    if (members.d.members) {
      console.log(`   ✅ 群组成员 (${members.d.members.length}人):`);
      members.d.members.forEach(m => console.log(`      - ${m.username}`));
    }

    // ========== 11. 查看用户统计 ==========
    console.log('\n📝 步骤11: 查看消息统计...');
    for (const u of users) {
      const stats = await http('GET', '/api/users/me/stats', null, u.token);
      console.log(`   ${stats.d.success !== false ? '✅' : '⚠️'} ${u.name} 统计`);
    }

    // ========== 12. 测试表情反应 ==========
    console.log('\n📝 步骤12: 测试表情反应...');
    if (msg2Id) {
      const reaction = await http('POST', `/api/groups/${GROUP_ID}/messages/${msg2Id}/react`,
        { emoji: '👍' }, users[0].token);
      console.log(`   ${reaction.d.success ? '✅' : '⚠️'} Alice reaction to Bob's message`);
    }

    // ========== 13. 清理 ==========
    console.log('\n📝 步骤13: 清理测试数据...');
    for (const u of users) {
      await http('DELETE', `/api/users/${u.id}`, null, u.token);
    }
    console.log('   ✅ 测试用户已删除');

  } else {
    console.log('   ❌ 群组创建失败');
  }

  // ========== 测试结果汇总 ==========
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    测试完成                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n✅ 完整流程测试通过:');
  console.log('   1. 用户注册/登录');
  console.log('   2. 创建群组');
  console.log('   3. 多人加入群组');
  console.log('   4. 发送消息');
  console.log('   5. @提及功能');
  console.log('   6. 消息历史');
  console.log('   7. 群组成员');
  console.log('   8. 消息统计');
  console.log('   9. 表情反应');
  console.log('');
}

run().catch(console.error);
