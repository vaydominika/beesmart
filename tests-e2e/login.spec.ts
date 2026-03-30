import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  // Note: Adjust this to match your actual app title
  await expect(page).toHaveTitle(/BeeSmart/i);
});

test('login page has login title', async ({ page }) => {
  await page.goto('/login');
  
  // Expect the page to have a login header
  // Note: Adjust this to match your actual login page
  await expect(page.getByText(/Sign In/i)).toBeVisible();
});
