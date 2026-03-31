const mqtt = require('mqtt');
const http = require('http');

const CONFIG = {
  mqtt: { url: 'mqtt://localhost:1883' },
  http: { port: 3000 }
};

function login(username, password) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: CONFIG.http.port,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ username, password }));
    req.end();
  });
}

async function main() {
  console.log('🔐 登录 czhmisaka...');
  const loginRes = await login('czhmisaka', 'czh123');
  if (!loginRes.success) {
    console.error('❌ 登录失败:', loginRes.message);
    return;
  }
  console.log(`✅ 登录成功，userId: ${loginRes.userId}`);

  const client = mqtt.connect(CONFIG.mqtt.url, {
    clientId: `test-mention-${Date.now()}`
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
        }, 5000);
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
