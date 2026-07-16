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

    await expect(page.getByRole('heading', { name: 'Your Data' })).toBeVisible();
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Compare', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('renders the Sign Up page', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});