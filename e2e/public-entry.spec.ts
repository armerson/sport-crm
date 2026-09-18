import { expect, test } from '@playwright/test'

test('registration landing offers parent and adult player routes', async ({ page }) => {
  await page.goto('/register')

  await expect(page.getByRole('heading', { name: 'Your place in the club starts here.' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Register as a parent/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Register as a player/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Already a member\? Sign in/ })).toBeVisible()

  await page.getByRole('link', { name: /Register as a player/ }).click()
  await expect(page).toHaveURL(/\/login\?mode=register&kind=player$/)
  await expect(page.getByRole('heading', { name: 'Player registration' })).toBeVisible()
})

test('sign-in page contains the essential account controls', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.locator('form').getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Forgot your password?' })).toBeVisible()
})

test('private workspace redirects signed-out visitors to sign in', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login\?next=%2F$/)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})

test('registration page fits within a phone viewport', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Mobile layout check')

  await page.goto('/register')
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )

  expect(hasHorizontalOverflow).toBe(false)
  await expect(page.getByRole('link', { name: /Register as a parent/ })).toBeInViewport()
})
