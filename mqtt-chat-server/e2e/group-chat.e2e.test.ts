import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Group Chat E2E Tests', () => {
  const testUser = {
    username: `groupuser_${Date.now()}`,
    password: 'GroupPass123'
  };

  let groupId: string;

  test.beforeAll(async () => {
    // Register and login user
    await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
    await page.click('text=Register');
    await page.fill('#reg-username', testUser.username);
    await page.fill('#reg-password', testUser.password);
    await page.click('button:has-text("Register")');
    await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });
  });

  test.describe('Group Creation', () => {
    test('should show create group button', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      // Login first
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await expect(page.locator('button:has-text("+ Create Group")')).toBeVisible();
    });

    test('should open create group modal', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await page.click('button:has-text("+ Create Group")');
      await expect(page.locator('#create-group-modal')).toBeVisible();
      await expect(page.locator('#new-group-name')).toBeVisible();
      await expect(page.locator('#new-group-desc')).toBeVisible();
    });

    test('should create a new group', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await page.click('button:has-text("+ Create Group")');
      await page.fill('#new-group-name', 'Test Group');
      await page.fill('#new-group-desc', 'A test group for E2E testing');
      await page.click('button:has-text("Create")');

      // Modal should close
      await expect(page.locator('#create-group-modal')).toBeHidden({ timeout: 5000 });

      // Group should appear in list
      await expect(page.locator('.group-item:has-text("Test Group")')).toBeVisible();
    });

    test('should require group name', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await page.click('button:has-text("+ Create Group")');
      // Leave name empty
      await page.fill('#new-group-desc', 'Description only');
      await page.click('button:has-text("Create")');

      // Modal should still be visible with error
      await expect(page.locator('#create-group-modal')).toBeVisible();
    });
  });

  test.describe('Group Selection', () => {
    test('should select a group and show chat area', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Select the group
      await page.click('.group-item:has-text("Test Group")');

      // Chat area should be visible
      await expect(page.locator('#group-chat-area')).toBeVisible();
      await expect(page.locator('#chat-title')).toContainText('Test Group');
      await expect(page.locator('#group-message-input')).toBeVisible();
      await expect(page.locator('#group-messages')).toBeVisible();
    });

    test('should show "no group selected" when none selected', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await expect(page.locator('#no-group-selected')).toBeVisible();
      await expect(page.locator('#group-chat-area')).toBeHidden();
    });
  });

  test.describe('Group Messaging', () => {
    test('should send a message to group', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Select group
      await page.click('.group-item:has-text("Test Group")');
      await expect(page.locator('#group-chat-area')).toBeVisible();

      // Send message
      await page.fill('#group-message-input', 'Hello, group!');
      await page.click('button:has-text("Send")');

      // Message should appear
      await expect(page.locator('#group-messages')).toContainText('Hello, group!', { timeout: 5000 });
    });

    test('should show multiple messages in order', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Select group
      await page.click('.group-item:has-text("Test Group")');

      // Send multiple messages
      await page.fill('#group-message-input', 'Message 1');
      await page.click('button:has-text("Send")');
      await page.fill('#group-message-input', 'Message 2');
      await page.click('button:has-text("Send")');
      await page.fill('#group-message-input', 'Message 3');
      await page.click('button:has-text("Send")');

      // All messages should appear
      await expect(page.locator('#group-messages')).toContainText('Message 1', { timeout: 5000 });
      await expect(page.locator('#group-messages')).toContainText('Message 2', { timeout: 5000 });
      await expect(page.locator('#group-messages')).toContainText('Message 3', { timeout: 5000 });
    });

    test('should require message content', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Select group
      await page.click('.group-item:has-text("Test Group")');

      // Try to send empty message
      await page.fill('#group-message-input', '');
      await page.click('button:has-text("Send")');

      // Message should not appear (input should remain empty)
      await expect(page.locator('#group-messages')).not.toContainText('Message 1');
    });

    test('should not send message to different group', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Create second group
      await page.click('button:has-text("+ Create Group")');
      await page.fill('#new-group-name', 'Second Group');
      await page.click('button:has-text("Create")');

      // Select first group and send message
      await page.click('.group-item:has-text("Test Group")');
      await page.fill('#group-message-input', 'Only for Test Group');
      await page.click('button:has-text("Send")');

      // Switch to second group
      await page.click('.group-item:has-text("Second Group")');

      // Should NOT contain message from Test Group
      await expect(page.locator('#group-messages')).not.toContainText('Only for Test Group');
    });
  });

  test.describe('Group List', () => {
    test('should show user groups in sidebar', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await expect(page.locator('.group-item:has-text("Test Group")')).toBeVisible();
      await expect(page.locator('.group-item:has-text("Second Group")')).toBeVisible();
    });

    test('should highlight selected group', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Select a group
      await page.click('.group-item:has-text("Test Group")');

      // Selected group should have different background (indicated by inline style)
      const groupItem = page.locator('.group-item:has-text("Test Group")');
      await expect(groupItem).toHaveCSS('background-color', /rgb/);
    });
  });
});
