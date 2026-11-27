import { expect, test } from '@playwright/test'

test('club finder is reachable and searchable without signing in', async ({ page }) => {
  await page.goto('/clubs')
  await expect(page.getByRole('heading', { name: 'Find your club' })).toBeVisible()
  await expect(page.getByLabel('Club name, code or town')).toBeVisible()
})

test('unknown club links are refused instead of redirected', async ({ page }) => {
  await page.goto('/clubs/unknown-fc/join/ABC123')
  await expect(page.getByRole('heading', { name: "We couldn't find that club" })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Find your club' })).toHaveAttribute('href', '/clubs')
})

test('standalone club sign-in is unchanged', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Find another club|Change club/ })).toHaveCount(0)
})
