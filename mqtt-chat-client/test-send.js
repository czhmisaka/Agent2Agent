const mqtt = require('mqtt');
const http = require('http');

async function login() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 14070,
      path: '/api/users/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ username: 'czhmisaka', password: 'Czh12345' }));
    req.end();
  });
}

async function main() {
  console.log('🔐 登录 czhmisaka...');
  const loginRes = await login();
  if (!loginRes.success) {
    console.error('❌ 登录失败:', loginRes);
    return;
  }
  console.log(`✅ 登录成功，userId: ${loginRes.userId}`);

  // 使用 JWT token 作为 MQTT 密码
  const client = mqtt.connect('mqtt://localhost:14080', {
    clientId: `test-sender-${Date.now()}`,
    username: loginRes.username,  // czhmisaka
    password: loginRes.token      // JWT token
  });

  client.on('connect', () => {
    console.log('📡 MQTT 已连接');
    
    client.subscribe('chat/group/test/message', (err) => {
      if (err) console.error('❌ 订阅失败:', err);
      else console.log('✅ 已订阅 chat/group/test/message');
      
      setTimeout(() => {
        console.log('📤 发送测试消息，包含 @agentbot...');
        client.publish('chat/group/test/action', JSON.stringify({
          type: 'message',
          timestamp: new Date().toISOString(),
          payload: {
            userId: loginRes.userId,
            token: loginRes.token,
            content: '@agentbot 测试提及功能'
          },
          meta: { groupId: 'test' }
        }), { qos: 1 });
        
        setTimeout(() => {
          console.log('👋 退出测试');
          client.end();
          process.exit(0);
        }, 3000);
      }, 1000);
    });
  });

  client.on('message', (topic, message) => {
    const msg = JSON.parse(message.toString());
    console.log(`📩 收到消息 [${topic}]:`, JSON.stringify(msg, null, 2));
  });

  client.on('error', console.error);
}

main().catch(console.error);
