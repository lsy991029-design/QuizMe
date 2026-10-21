import { expect, test } from '@playwright/test';

for (const entry of ['?entry=share', '#share=legacy-result']) {
  test(`shared entry ${entry} requires a token despite an existing grant`, async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('history-quiz:access-grant:v1', '826417'));
    await page.goto(`/${entry}`);
    await expect(page.getByRole('heading', { name: '访问验证', exact: true })).toBeVisible();
    await expect(page.locator('.report-body, .shared-page, .home-page')).toHaveCount(0);
    await page.getByLabel('6 位访问令牌', { exact: true }).fill('826417');
    await page.getByRole('button', { name: '立即解锁', exact: true }).click();
    await expect(page.getByRole('button', { name: '开始测试', exact: true })).toBeVisible();
    await expect(page.locator('.report-body, .shared-page')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });
}

test('invalid token cannot enter a shared test and idle entry defers quiz code', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?entry=share');
  await expect(page.getByRole('heading', { name: '访问验证', exact: true })).toBeVisible();
  expect(requests.some(url => url.includes('/src/QuizExperience.tsx') || url.includes('/src/poster.ts') || url.includes('/art/'))).toBe(false);
  await page.getByLabel('6 位访问令牌', { exact: true }).fill('111111');
  await page.getByRole('button', { name: '立即解锁', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('令牌无效，请检查后重试。');
  await expect(page.locator('.home-page, .report-body')).toHaveCount(0);
  expect(await page.locator('.document-scroll').evaluate(element => element.scrollWidth - element.clientWidth)).toBe(0);
});
