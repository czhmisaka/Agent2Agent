import { test, expect, BrowserContext } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Presence E2E Tests', () => {
  const user1 = {
    username: `presence1_${Date.now()}`,
    password: 'PresencePass1'
  };

  const user2 = {
    username: `presence2_${Date.now()}`,
    password: 'PresencePass2'
  };

  let context1: BrowserContext;
  let context2: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context1 = await browser.newContext();
    context2 = await browser.newContext();
  });

  test.afterAll(async () => {
    await context1.close();
    await context2.close();
  });

  test.describe('Online Status', () => {
    test('should show user as online after login', async ({ page }) => {
      const page1 = await context1.newPage();

      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.fill('#login-username', user1.username);
      await page1.fill('#reg-password', user1.password);

      // Register first
      await page1.click('text=Register');
      await page1.fill('#reg-username', user1.username);
      await page1.fill('#reg-password', user1.password);
      await page1.click('button:has-text("Register")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Create another browser context to check online status
      const page2 = await context2.newPage();
      await page2.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page2.fill('#login-username', user2.username);

      // Register user 2
      await page2.click('text=Register');
      await page2.fill('#reg-username', user2.username);
      await page2.fill('#reg-password', user2.password);
      await page2.click('button:has-text("Register")');
      await expect(page2.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // User 2 should see User 1 as online
      await expect(page2.locator(`.user-item:has-text("${user1.username}")`)).toBeVisible();
      await expect(page2.locator(`.user-item:has-text("${user1.username}") .online-dot`)).toBeVisible();
    });

    test('should show user as offline after logout', async ({ page }) => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Both users logged in
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.click('text=Register');
      await page1.fill('#reg-username', user1.username);
      await page1.fill('#reg-password', user1.password);
      await page1.click('button:has-text("Register")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await page2.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page2.click('text=Register');
      await page2.fill('#reg-username', user2.username);
      await page2.fill('#reg-password', user2.password);
      await page2.click('button:has-text("Register")');
      await expect(page2.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // User 2 sees User 1 online
      await expect(page2.locator(`.user-item:has-text("${user1.username}") .online-dot`)).toBeVisible();

      // User 1 logs out
      await page1.click('button:has-text("Logout")');
      await expect(page1.locator('#auth-section')).toBeVisible({ timeout: 5000 });

      // Refresh page 2 to see updated status
      await page2.reload();
      await page2.fill('#login-username', user2.username);
      await page2.fill('#login-password', user2.password);
      await page2.click('button:has-text("Login")');
      await expect(page2.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // User 1 should now be offline
      const user1Item = page2.locator(`.user-item:has-text("${user1.username}")`);
      await expect(user1Item.locator('.offline-dot')).toBeVisible();
    });

    test('should show online dot only for online users', async ({ page }) => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Only user 1 is logged in
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.click('text=Register');
      await page1.fill('#reg-username', user1.username);
      await page1.fill('#reg-password', user1.password);
      await page1.click('button:has-text("Register")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // User 2 logs in
      await page2.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page2.click('text=Register');
      await page2.fill('#reg-username', user2.username);
      await page2.fill('#reg-password', user2.password);
      await page2.click('button:has-text("Register")');
      await expect(page2.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // User 2 should see user 1 as online
      await expect(page2.locator(`.user-item:has-text("${user1.username}") .online-dot`)).toBeVisible();

      // User 2's own entry should not appear in their user list
      const ownEntry = page2.locator(`.user-item:has-text("${user2.username}")`);
      await expect(ownEntry).toHaveCount(0);
    });
  });

  test.describe('Presence in User List', () => {
    test('should show all online users', async ({ page }) => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Both users logged in
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.click('text=Register');
      await page1.fill('#reg-username', user1.username);
      await page1.fill('#reg-password', user1.password);
      await page1.click('button:has-text("Register")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await page2.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page2.click('text=Register');
      await page2.fill('#reg-username', user2.username);
      await page2.fill('#reg-password', user2.password);
      await page2.click('button:has-text("Register")');
      await expect(page2.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Page 1 should see user 2
      await expect(page1.locator(`.user-item:has-text("${user2.username}")`)).toBeVisible();

      // Page 2 should see user 1
      await expect(page2.locator(`.user-item:has-text("${user1.username}")`)).toBeVisible();
    });

    test('should update user list on refresh', async ({ page }) => {
      const page1 = await context1.newPage();

      // Register user 1
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.click('text=Register');
      await page1.fill('#reg-username', user1.username);
      await page1.fill('#reg-password', user1.password);
      await page1.click('button:has-text("Register")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // At this point, user list should be empty (no other users)
      // Refresh and check
      await page1.reload();
      await page1.fill('#login-username', user1.username);
      await page1.fill('#login-password', user1.password);
      await page1.click('button:has-text("Login")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // User list should still be accessible
      await expect(page1.locator('#user-list')).toBeVisible();
    });
  });

  test.describe('Multiple Users Presence', () => {
    test('should handle multiple concurrent users', async ({ browser }) => {
      const contexts = [];
      const pages = [];

      // Create 3 more users
      const users = [
        { username: `multiuser1_${Date.now()}`, password: 'MultiPass1' },
        { username: `multiuser2_${Date.now()}`, password: 'MultiPass2' },
        { username: `multiuser3_${Date.now()}`, password: 'MultiPass3' },
      ];

      // Register and login all users
      for (const user of users) {
        const ctx = await browser.newPage();
        contexts.push(ctx);
        pages.push(ctx);

        await ctx.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
        await ctx.click('text=Register');
        await ctx.fill('#reg-username', user.username);
        await ctx.fill('#reg-password', user.password);
        await ctx.click('button:has-text("Register")');
        await expect(ctx.locator('#chat-view')).toBeVisible({ timeout: 5000 });
      }

      // First user should see all other users online
      const firstPage = pages[0];
      for (let i = 1; i < users.length; i++) {
        await expect(firstPage.locator(`.user-item:has-text("${users[i].username}")`)).toBeVisible();
      }

      // Cleanup
      for (const ctx of contexts) {
        await ctx.close();
      }
    });
  });

  test.describe('Presence Refresh', () => {
    test('should refresh presence periodically', async ({ page }) => {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Both users logged in
      await page1.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page1.click('text=Register');
      await page1.fill('#reg-username', user1.username);
      await page1.fill('#reg-password', user1.password);
      await page1.click('button:has-text("Register")');
      await expect(page1.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      await page2.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page2.click('text=Register');
      await page2.fill('#reg-username', user2.username);
      await page2.fill('#reg-password', user2.password);
      await page2.click('button:has-text("Register")');
      await expect(page2.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // User 1 should see user 2 online
      await expect(page1.locator(`.user-item:has-text("${user2.username}") .online-dot`)).toBeVisible();

      // Wait for auto-refresh (5 seconds based on frontend code)
      await page1.waitForTimeout(6000);

      // Should still see user 2 online
      await expect(page1.locator(`.user-item:has-text("${user2.username}") .online-dot`)).toBeVisible();
    });
  });
});
