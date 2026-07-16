# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: compare-yourself.spec.ts >> Compare Yourself >> renders the Sign Up page
- Location: e2e\compare-yourself.spec.ts:30:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Sign Up' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Sign Up' })

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test.describe('Compare Yourself', () => {
  4  |   test('shows Sign In and Sign Up links when not authenticated', async ({ page }) => {
  5  |     await page.goto('/');
  6  |     await expect(page.getByRole('navigation').getByRole('link', { name: 'Sign In' })).toBeVisible();
  7  |     await expect(page.getByRole('navigation').getByRole('link', { name: 'Sign Up' })).toBeVisible();
  8  |     await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  9  |   });
  10 | 
  11 |   test('redirects unauthenticated users away from /compare', async ({ page }) => {
  12 |     await page.goto('/compare');
  13 |     await expect(page).toHaveURL(/\/$/);
  14 |     await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  15 |   });
  16 | 
  17 |   test('allows signing in and reaching the compare input form', async ({ page }) => {
  18 |     await page.goto('/');
  19 |     await page.getByLabel('Username').fill('demo');
  20 |     await page.getByLabel('Password').fill('demo');
  21 |     await page.getByRole('button', { name: 'Sign In' }).click();
  22 | 
  23 |     await expect(page.getByRole('heading', { name: 'Your Data' })).toBeVisible();
  24 |     await expect(
  25 |       page.getByRole('navigation').getByRole('link', { name: 'Compare', exact: true }),
  26 |     ).toBeVisible();
  27 |     await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  28 |   });
  29 | 
  30 |   test('renders the Sign Up page', async ({ page }) => {
  31 |     await page.goto('/signup');
> 32 |     await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
     |                                                                  ^ Error: expect(locator).toBeVisible() failed
  33 |     await expect(page.locator('input[name="username"]')).toBeVisible();
  34 |     await expect(page.locator('input[name="email"]')).toBeVisible();
  35 |     await expect(page.locator('input[name="password"]')).toBeVisible();
  36 |   });
  37 | });
```