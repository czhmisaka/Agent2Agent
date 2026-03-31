/**
 * k6 Stress Test - Increasing Concurrent Users
 * Stress test with increasing concurrent users to find breaking point
 *
 * Run with: k6 run load-test/stress-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const messageLatency = new Trend('message_latency');
const connectionErrors = new Counter('connection_errors');

// Test configuration
export const options = {
  stages: [
    // Phase 1: Light load
    { duration: '30s', target: 5 },
    // Phase 2: Normal load
    { duration: '1m', target: 20 },
    // Phase 3: Moderate stress
    { duration: '1m', target: 50 },
    // Phase 4: High stress
    { duration: '1m', target: 100 },
    // Phase 5: Peak load
    { duration: '1m', target: 150 },
    // Phase 6: Recovery
    { duration: '30s', target: 20 },
    // Phase 7: Cooldown
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95% under 1 second under stress
    http_req_failed: ['rate<0.1'],       // Less than 10% errors allowed
    errors: ['rate<0.15'],              // Allow slightly higher custom error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:14070';

// Test configuration
const NUM_TEST_USERS = 150; // Create enough users for peak load
const GROUP_SIZE = 10;       // Users per group

let testData = null;

export function setup() {
  console.log('Setting up stress test data...');
  console.log(`Creating ${NUM_TEST_USERS} test users...`);

  const tokens = [];
  const groupIds = [];

  // Create test users in batches to avoid overwhelming the server
  for (let i = 0; i < NUM_TEST_USERS; i++) {
    const username = `stresstest_user_${i}_${Date.now()}`;
    const password = 'StressTest123';

    try {
      const registerRes = http.post(`${BASE_URL}/api/users/register`, {
        username,
        password,
      });

      if (registerRes.status === 200) {
        const loginRes = http.post(`${BASE_URL}/api/users/login`, {
          username,
          password,
        });

        if (loginRes.status === 200) {
          const body = JSON.parse(loginRes.body);
          tokens.push({ token: body.token, userId: body.userId, username });
        }
      }
    } catch (e) {
      console.error(`Failed to create user ${username}: ${e.message}`);
    }

    // Small delay between batches
    if (i % 20 === 0 && i > 0) {
      sleep(0.5);
    }
  }

  console.log(`Created ${tokens.length} users successfully`);

  // Create multiple groups
  const numGroups = Math.ceil(tokens.length / GROUP_SIZE);
  for (let g = 0; g < numGroups; g++) {
    const ownerIndex = g * GROUP_SIZE;
    if (ownerIndex >= tokens.length) break;

    const createGroupRes = http.post(
      `${BASE_URL}/api/groups`,
      {
        name: `Stress Test Group ${g}`,
        description: `Group ${g} for stress testing`,
      },
      {
        headers: {
          'Authorization': `Bearer ${tokens[ownerIndex].token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (createGroupRes.status === 200) {
      const body = JSON.parse(createGroupRes.body);
      const groupId = body.groupId;
      groupIds.push(groupId);

      // Add members to the group
      for (let m = 1; m < GROUP_SIZE && (ownerIndex + m) < tokens.length; m++) {
        const memberIndex = ownerIndex + m;
        http.post(
          `${BASE_URL}/api/groups/${groupId}/join`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${tokens[memberIndex].token}`,
            },
          }
        );
      }
    }

    if (g % 5 === 0) {
      sleep(0.2);
    }
  }

  console.log(`Created ${groupIds.length} groups`);

  testData = { tokens, groupIds };
  return testData;
}

export default function(data) {
  const tokens = data.tokens;
  const groupIds = data.groupIds;

  if (!tokens || tokens.length === 0 || !groupIds || groupIds.length === 0) {
    console.error('Setup failed, skipping test iteration');
    return;
  }

  // Random user selection
  const userIndex = __VU % tokens.length;
  const token = tokens[userIndex].token;
  const groupId = groupIds[__VU % groupIds.length];

  // Simulate various operations based on VU number
  const operation = __VU % 5;

  switch (operation) {
    case 0: // Send message
    case 1: // Send message
      sendMessage(token, groupId);
      break;
    case 2: // Get messages
      getMessages(token, groupId);
      break;
    case 3: // Get group members
      getGroupMembers(token, groupId);
      break;
    case 4: // Get user info
      getUserInfo(token);
      break;
  }

  // Variable think time
  sleep(Math.random() * 1.5 + 0.2);
}

function sendMessage(token, groupId) {
  const messageContent = `Stress test msg from VU ${__VU} iter ${__ITER} at ${Date.now()}`;

  const startTime = Date.now();
  const messageRes = http.post(
    `${BASE_URL}/api/groups/${groupId}/messages`,
    JSON.stringify({ content: messageContent }),
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: '5s',
    }
  );
  const latency = Date.now() - startTime;

  messageLatency.add(latency);

  const success = check(messageRes, {
    'message sent': (r) => r.status === 200,
    'has messageId': (r) => {
      try {
        return JSON.parse(r.body).messageId !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);

  // Track connection errors separately
  if (messageRes.status === 0 || messageRes.status === 503) {
    connectionErrors.add(1);
  }
}

function getMessages(token, groupId) {
  const res = http.get(
    `${BASE_URL}/api/groups/${groupId}/messages?limit=20`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      timeout: '5s',
    }
  );

  const success = check(res, {
    'messages retrieved': (r) => r.status === 200,
    'response is array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
}

function getGroupMembers(token, groupId) {
  const res = http.get(
    `${BASE_URL}/api/groups/${groupId}/members`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      timeout: '5s',
    }
  );

  const success = check(res, {
    'members retrieved': (r) => r.status === 200,
  });

  errorRate.add(!success);
}

function getUserInfo(token) {
  const res = http.get(`${BASE_URL}/api/users/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    timeout: '5s',
  });

  const success = check(res, {
    'user info retrieved': (r) => r.status === 200,
  });

  errorRate.add(!success);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  let output = '\n';
  output += '='.repeat(70) + '\n';
  output += '  STRESS TEST SUMMARY\n';
  output += '='.repeat(70) + '\n\n';

  output += `Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  output += `Failed Requests: ${metrics.http_req_failed?.values?.passes || 0}\n`;
  output += `Error Rate: ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  output += `Connection Errors: ${metrics.connection_errors?.values?.count || 0}\n\n`;

  output += 'Response Times:\n';
  output += `  - Avg: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
  output += `  - P50: ${(metrics.http_req_duration?.values?.['p(50)'] || 0).toFixed(2)}ms\n`;
  output += `  - P95: ${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
  output += `  - P99: ${(metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms\n`;
  output += `  - Max: ${(metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms\n\n`;

  output += 'Custom Metrics:\n';
  output += `  - Message Latency Avg: ${(metrics.message_latency?.values?.avg || 0).toFixed(2)}ms\n`;
  output += `  - Message Latency P95: ${(metrics.message_latency?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
  output += `  - Custom Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;

  output += 'Test Duration: ' + (data.state.testRunDuration || 'N/A') + '\n';
  output += 'VUs Max: ' + (data.state?.vusMax || 'N/A') + '\n\n';

  output += '='.repeat(70) + '\n';

  return output;
}
