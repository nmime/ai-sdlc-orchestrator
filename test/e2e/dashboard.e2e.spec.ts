import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E', () => {
  test.describe('Navigation', () => {
    test('loads the dashboard with title', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('h1')).toHaveText('AI SDLC Orchestrator');
    });

    test('shows three navigation tabs', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Workflows' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Costs' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Gates' })).toBeVisible();
    });

    test('defaults to workflows tab', async ({ page }) => {
      await page.goto('/');
      const workflowsBtn = page.getByRole('button', { name: 'Workflows' });
      await expect(workflowsBtn).toHaveClass(/bg-indigo-100/);
    });

    test('can switch between tabs', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Costs' }).click();
      await expect(page.getByRole('button', { name: 'Costs' })).toHaveClass(/bg-indigo-100/);
      await expect(page.getByRole('button', { name: 'Workflows' })).not.toHaveClass(/bg-indigo-100/);

      await page.getByRole('button', { name: 'Gates' }).click();
      await expect(page.getByRole('button', { name: 'Gates' })).toHaveClass(/bg-indigo-100/);
    });
  });

  test.describe('Workflows Tab', () => {
    test('shows workflow list with seeded data', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('h2')).toContainText('Workflows');
      await expect(page.getByText('Implement user authentication')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Fix login page CSS')).toBeVisible();
      await expect(page.getByText('Add payment integration')).toBeVisible();
    });

    test('displays workflow count', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('h2')).toContainText('Workflows (3)', { timeout: 15000 });
    });

    test('shows status badges', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('implementing')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('completed')).toBeVisible();
      await expect(page.getByText('queued')).toBeVisible();
    });

    test('shows repo URLs', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('https://github.com/example/repo').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('https://github.com/example/payments')).toBeVisible();
    });

    test('shows cost amounts', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('$45.00')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('$12.50')).toBeVisible();
      await expect(page.getByText('$0.00')).toBeVisible();
    });
  });

  test.describe('Costs Tab', () => {
    test('shows cost summary cards', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Costs' }).click();
      await expect(page.getByText('Budget Limit').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Total Used').first()).toBeVisible();
      await expect(page.getByText('AI Cost').first()).toBeVisible();
      await expect(page.getByText('Remaining').first()).toBeVisible();
    });

    test('shows correct budget values', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Costs' }).click();
      await expect(page.getByText('$1000.00')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('$150.50')).toBeVisible();
      await expect(page.getByText('$100.25')).toBeVisible();
    });

    test('shows charts section', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Costs' }).click();
      await expect(page.getByText('Cost Breakdown')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Budget Overview')).toBeVisible();
    });
  });

  test.describe('Gates Tab', () => {
    test('shows gate approvals heading', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Gates' }).click();
      await expect(page.getByText('Gate Approvals')).toBeVisible({ timeout: 15000 });
    });

    test('shows implementing workflows for gate review', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Gates' }).click();
      await expect(page.getByText('Implement user authentication')).toBeVisible({ timeout: 15000 });
    });

    test('shows approve and reject buttons', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Gates' }).click();
      await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
    });

    test('has comment input field', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Gates' }).click();
      await expect(page.getByPlaceholder('Comment (optional)')).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('API Integration', () => {
    test('workflows API returns data through proxy', async ({ request }) => {
      const response = await request.get('/api/workflows', {
        headers: { Authorization: 'Bearer dev-token' },
      });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.items).toHaveLength(3);
      expect(data.total).toBe(3);
    });

    test('costs API returns data through proxy', async ({ request }) => {
      const response = await request.get('/api/costs/summary/00000000-0000-4000-a000-000000000001', {
        headers: { Authorization: 'Bearer dev-token' },
      });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.tenantId).toBe('00000000-0000-4000-a000-000000000001');
      expect(Number(data.monthlyCostLimitUsd)).toBe(1000);
    });

    test('health endpoint is accessible', async ({ request }) => {
      const response = await request.get('/api/health/live');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.status).toBe('ok');
    });

    test('unauthenticated request returns 403', async ({ request }) => {
      const response = await request.get('/api/workflows');
      expect(response.status()).toBe(403);
    });
  });
});
