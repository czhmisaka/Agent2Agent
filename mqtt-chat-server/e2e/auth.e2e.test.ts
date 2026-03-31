import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const testUsers: { username: string; password: string }[] = [
  { username: `testuser_${Date.now()}`, password: 'TestPass123' },
  { username: `testuser2_${Date.now()}`, password: 'TestPass456' },
];

test.describe('Authentication E2E Tests', () => {
  test.beforeAll(async () => {
    // Wait for server to be ready
    await page.goto(BASE_URL);
  });

  test.describe('Registration', () => {
    test('should show registration form', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.click('text=Register');
      await expect(page.locator('#register-form')).toBeVisible();
      await expect(page.locator('#reg-username')).toBeVisible();
      await expect(page.locator('#reg-password')).toBeVisible();
    });

    test('should register a new user successfully', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.click('text=Register');

      const user = testUsers[0];
      await page.fill('#reg-username', user.username);
      await page.fill('#reg-password', user.password);
      await page.click('button:has-text("Register")');

      // Should redirect to chat view
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#current-user')).toContainText(user.username);
    });

    test('should reject registration with existing username', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.click('text=Register');

      // Try to register with the same username
      await page.fill('#reg-username', testUsers[0].username);
      await page.fill('#reg-password', 'TestPass789');
      await page.click('button:has-text("Register")');

      // Should show error
      await expect(page.locator('#register-error')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#register-error')).not.toBeEmpty();
    });

    test('should reject weak passwords', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.click('text=Register');

      // Try short password
      await page.fill('#reg-username', `newuser_${Date.now()}`);
      await page.fill('#reg-password', 'weak');
      await page.click('button:has-text("Register")');

      await expect(page.locator('#register-error')).toBeVisible({ timeout: 5000 });
    });

    test('should reject invalid username characters', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.click('text=Register');

      await page.fill('#reg-username', 'user@bad!');
      await page.fill('#reg-password', 'TestPass123');
      await page.click('button:has-text("Register")');

      await expect(page.locator('#register-error')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Login', () => {
    test('should show login form', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await expect(page.locator('#login-form')).toBeVisible();
      await expect(page.locator('#login-username')).toBeVisible();
      await expect(page.locator('#login-password')).toBeVisible();
    });

    test('should login with valid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);

      const user = testUsers[0];
      await page.fill('#login-username', user.username);
      await page.fill('#login-password', user.password);
      await page.click('button:has-text("Login")');

      // Should redirect to chat view
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#current-user')).toContainText(user.username);

      // Logout for next test
      await page.click('button:has-text("Logout")');
    });

    test('should reject invalid password', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);

      await page.fill('#login-username', testUsers[0].username);
      await page.fill('#login-password', 'WrongPassword123');
      await page.click('button:has-text("Login")');

      await expect(page.locator('#login-error')).toBeVisible({ timeout: 5000 });
    });

    test('should reject non-existent user', async ({ page }) => {
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);

      await page.fill('#login-username', `nonexistent_${Date.now()}`);
      await page.fill('#login-password', 'TestPass123');
      await page.click('button:has-text("Login")');

      await expect(page.locator('#login-error')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ page }) => {
      // First login
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUsers[0].username);
      await page.fill('#login-password', testUsers[0].password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Then logout
      await page.click('button:has-text("Logout")');
      await expect(page.locator('#auth-section')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Token Persistence', () => {
    test('should remember login state', async ({ page, context }) => {
      // Login first
      await page.goto(`${BASE_URL}/e2e/test-frontend/index.html`);
      await page.fill('#login-username', testUsers[0].username);
      await page.fill('#login-password', testUsers[0].password);
      await page.click('button:has-text("Login")');
      await expect(page.locator('#chat-view')).toBeVisible({ timeout: 5000 });

      // Save storage state
      const storageState = await context.storageState();

      // Create new page with same storage
      const newPage = await context.newPage();
      await newPage.goto(`${BASE_URL}/e2e/test-frontend/index.html`);

      // Should be logged in automatically
      await expect(newPage.locator('#chat-view')).toBeVisible({ timeout: 5000 });
      await expect(newPage.locator('#current-user')).toContainText(testUsers[0].username);
    });
  });
});
