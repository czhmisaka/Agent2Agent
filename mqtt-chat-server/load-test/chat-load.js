/**
 * k6 Load Test - Normal Chat Load
 * Simulates normal chat load with message sending
 *
 * Run with: k6 run load-test/chat-load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const messageLatency = new Trend('message_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 20 },   // Ramp up to 20 users
    { duration: '1m', target: 20 },    // Stay at 20 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.05'],   // Less than 5% error rate
    errors: ['rate<0.1'],              // Less than 10% error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:14070';

// Test data
const testUsers = [
  { username: 'loadtest_user1', password: 'LoadTest123' },
  { username: 'loadtest_user2', password: 'LoadTest123' },
  { username: 'loadtest_user3', password: 'LoadTest123' },
];

let authTokens = [];
let groupId = null;

export function setup() {
  console.log('Setting up test data...');

  // Register test users
  for (const user of testUsers) {
    const registerRes = http.post(`${BASE_URL}/api/users/register`, {
      username: user.username,
      password: user.password,
    });

    if (registerRes.status === 200) {
      console.log(`Registered user: ${user.username}`);
    }
  }

  // Login users and get tokens
  for (const user of testUsers) {
    const loginRes = http.post(`${BASE_URL}/api/users/login`, {
      username: user.username,
      password: user.password,
    });

    if (loginRes.status === 200) {
      const body = JSON.parse(loginRes.body);
      authTokens.push(body.token);
    }
  }

  // Create a test group
  if (authTokens.length > 0) {
    const createGroupRes = http.post(
      `${BASE_URL}/api/groups`,
      { name: 'Load Test Group', description: 'Group for load testing' },
      {
        headers: {
          'Authorization': `Bearer ${authTokens[0]}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (createGroupRes.status === 200) {
      const body = JSON.parse(createGroupRes.body);
      groupId = body.groupId;
      console.log(`Created group: ${groupId}`);
    }
  }

  return { tokens: authTokens, groupId };
}

export default function(data) {
  const tokens = data.tokens;
  const testGroupId = data.groupId;

  if (!tokens || tokens.length === 0 || !testGroupId) {
    console.error('Setup failed, skipping test iteration');
    return;
  }

  // Each VU picks a random user
  const userIndex = Math.floor(Math.random() * tokens.length);
  const token = tokens[userIndex];

  // Send a message to the group
  const messageContent = `Load test message from VU ${__VU} at ${new Date().toISOString()}`;

  const startTime = Date.now();
  const messageRes = http.post(
    `${BASE_URL}/api/groups/${testGroupId}/messages`,
    JSON.stringify({ content: messageContent }),
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const latency = Date.now() - startTime;

  messageLatency.add(latency);

  const success = check(messageRes, {
    'message sent successfully': (r) => r.status === 200,
    'response has messageId': (r) => {
      try {
        return JSON.parse(r.body).messageId !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);

  // Fetch messages (read operation)
  const getMessagesRes = http.get(
    `${BASE_URL}/api/groups/${testGroupId}/messages?limit=10`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  check(getMessagesRes, {
    'messages retrieved': (r) => r.status === 200,
  });

  // Simulate realistic user behavior - wait between actions
  sleep(Math.random() * 2 + 0.5); // 0.5 to 2.5 seconds
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  let output = '\n';
  output += '='.repeat(60) + '\n';
  output += '  LOAD TEST SUMMARY\n';
  output += '='.repeat(60) + '\n\n';

  output += `Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  output += `Failed Requests: ${metrics.http_req_failed?.values?.passes || 0}\n`;
  output += `Error Rate: ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;

  output += 'Response Times:\n';
  output += `  - Avg: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
  output += `  - P95: ${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
  output += `  - P99: ${(metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms\n`;
  output += `  - Max: ${(metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms\n\n`;

  output += 'Custom Metrics:\n';
  output += `  - Message Latency Avg: ${(metrics.message_latency?.values?.avg || 0).toFixed(2)}ms\n`;
  output += `  - Message Latency P95: ${(metrics.message_latency?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
  output += `  - Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;

  output += '='.repeat(60) + '\n';

  return output;
}
