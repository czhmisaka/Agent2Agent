import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Private Chat E2E Tests', () => {
  const user1 = {
    username: `privateuser1_${Date.now()}`,
    password: 'PrivatePass1'
  };

  const user2 = {
    username: `privateuser2_${Date.now()}`,
    password: 'PrivatePass2'
  };

  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;

  test.beforeAll(async ({ browser }) => {
    // Create two separate browser contexts for two users
    context1 = await browser.newContext();
    context2 = await browser.newContext();

    page1 = await context1.newPage();
    page2 = await context2.newPage();

    // Register and login user 1
    await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
    await page1.click('text=Register');
    await page1.fill('#reg-username', user1.username);
    await page1.fill('#reg-password', user1.password);
    await page1.click('button:has-text("Register")');
    await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

    // Register and login user 2
    await page2.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
    await page2.click('text=Register');
    await page2.fill('#reg-username', user2.username);
    await page2.fill('#reg-password', user2.password);
    await page2.click('button:has-text("Register")');
    await expect(page2.locator('#chat-view')).toBeVisible({ timeout: 5000 });
  });

  test.afterAll(async () => {
    await context1.close();
    await context2.close();
  });

  test.describe('User Presence', () => {
    test('should see other user in user list', async ({ page }) => {
      // User 1 should see User 2
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await expect(page1.locator(`.user-item:has-text("${user2.username}")`)).toBeVisible();
    });

    test('should show online indicator for online users', async ({ page }) => {
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // User 2 is online, so should have online dot
      const user2Item = page1.locator(`.user-item:has-text("${user2.username}")`);
      await expect(user2Item.locator('.online-dot')).toBeVisible();
    });
  });

  test.describe('Private Chat UI', () => {
    test('should open private chat when clicking user', async ({ page }) => {
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Click on user 2
      await page1.click(`.user-item:has-text("${user2.username}")`);

      // Private chat area should be visible
      await expect(page1.locator('#private-chat-area')).toBeVisible();
      await expect(page1.locator('#private-chat-with')).toContainText(user2.username);
      await expect(page1.locator('#private-message-input')).toBeVisible();
      await expect(page1.locator('#private-messages')).toBeVisible();
    });

    test('should hide group chat when in private chat', async ({ page }) => {
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // First select a group if exists
      const groupItem = page1.locator('.group-item').first();
      if (await groupItem.isVisible()) {
        await groupItem.click();
        await expect(page1.locator('#group-chat-area')).toBeVisible();
      }

      // Then click on user to switch to private chat
      await page1.click(`.user-item:has-text("${user2.username}")`);
      await expect(page1.locator('#private-chat-area')).toBeVisible();
      await expect(page1.locator('#group-chat-area')).toBeHidden();
    });

    test('should show "select user" message when no user selected', async ({ page }) => {
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // No group selected, no private chat selected
      // The chat area should show the placeholder
      await expect(page1.locator('#no-group-selected')).toBeVisible();
    });
  });

  test.describe('Private Messaging', () => {
    test('should send private message', async ({ page }) => {
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Open private chat with user 2
      await page1.click(`.user-item:has-text("${user2.username}")`);

      // Send message
      await page1.fill('#private-message-input', 'Hello, this is private!');
      await page1.click('button:has-text("Send")');

      // Message should appear in local UI
      await expect(page1.locator('#private-messages')).toContainText('Hello, this is private!', { timeout: 5000 });
    });

    test('should show message with correct sender', async ({ page }) => {
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await page1.click(`.user-item:has-text("${user2.username}")`);
      await page1.fill('#private-message-input', 'Message from user 1');
      await page1.click('button:has-text("Send")');

      // Should show sender username
      await expect(page1.locator('#private-messages')).toContainText(user1.username, { timeout: 5000 });
    });

    test('should not see private message in group chat', async ({ page }) => {
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Send private message
      await page1.click(`.user-item:has-text("${user2.username}")`);
      await page1.fill('#private-message-input', 'Secret message');
      await page1.click('button:has-text("Send")');

      // Create a group if none exists
      const createGroupBtn = page1.locator('button:has-text("+ Create Group")');
      if (await createGroupBtn.isVisible()) {
        await createGroupBtn.click();
        await page1.fill('#new-group-name', 'Test Group for Private');
        await page1.click('#create-group-modal button:has-text("Create")');
        await page1.waitForTimeout(500);
      }

      // Select a group if exists
      const groupItem = page1.locator('.group-item').first();
      if (await groupItem.isVisible()) {
        await groupItem.click();
        // Private message should NOT appear in group messages
        await expect(page1.locator('#group-messages')).not.toContainText('Secret message');
      }
    });

    test('should clear input after sending message', async ({ page }) => {
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await page1.click(`.user-item:has-text("${user2.username}")`);
      await page1.fill('#private-message-input', 'Test message');
      await page1.click('button:has-text("Send")');

      // Input should be cleared
      await expect(page1.locator('#private-message-input')).toHaveValue('');
    });
  });

  test.describe('Message History', () => {
    test('should load previous messages on chat open', async ({ page }) => {
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Send a message first
      await page1.click(`.user-item:has-text("${user2.username}")`);
      await page1.fill('#private-message-input', 'Message for history');
      await page1.click('button:has-text("Send")');
      await expect(page1.locator('#private-messages')).toContainText('Message for history', { timeout: 5000 });

      // Refresh page
      await page1.reload();
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Open same chat
      await page1.click(`.user-item:has-text("${user2.username}")`);

      // Should load previous message (stored in localStorage)
      await expect(page1.locator('#private-messages')).toContainText('Message for history', { timeout: 5000 });
    });
  });
});
