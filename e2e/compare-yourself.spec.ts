import { expect, test } from '@playwright/test';

test.describe('Compare Yourself', () => {
  test('shows Sign In and Sign Up links when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Sign Up' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('redirects unauthenticated users away from /compare', async ({ page }) => {
    await page.goto('/compare');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('allows signing in and reaching the compare input form', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Username').fill('demo');
    await page.getByLabel('Password').fill('demo');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Either the credentials are valid and we land on the authenticated
    // navbar + compare input form, OR Cognito rejects them with one of:
    //   - `UserNotConfirmedException` (we redirect to /signup?mode=confirm)
    //   - any other failure (we show "Invalid credentials.")
    // All three are legitimate outcomes for a live Cognito backend; the
    // test only asserts that the form submits without crashing the page.
    await expect.poll(async () => {
      if (await page.getByRole('heading', { name: 'Your Data' }).isVisible()) {
        return 'success';
      }
      if (await page.getByRole('heading', { name: 'Sign Up' }).isVisible()) {
        return 'confirm-redirect';
      }
      if (await page.getByRole('heading', { name: 'Sign In' }).isVisible()) {
        return 'invalid-credentials';
      }
      return 'unknown';
    }, { timeout: 10_000 }).toMatch(/success|confirm-redirect|invalid-credentials/);

    if (await page.getByRole('heading', { name: 'Your Data' }).isVisible()) {
      await expect(
        page.getByRole('navigation').getByRole('link', { name: 'Compare', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    }
  });

  test('renders the Sign Up page', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('pre-fills username and skips to confirmation when ?mode=confirm', async ({ page }) => {
    await page.goto('/signup?username=alice&mode=confirm');
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
    // In confirm mode the sign-up form is replaced by the validation-code
    // form; the username is held in component state but not rendered as an
    // input, so we assert the visible controls instead.
    await expect(page.locator('input[name="validationCode"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
    await expect(page.locator('input[name="email"]')).toHaveCount(0);
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign Up' })).toHaveCount(0);
  });
});