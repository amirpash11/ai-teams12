import { test, expect } from '@playwright/test';

test.describe('AI Teams end-to-end smoke', () => {
  test('desktop core controls and demo execution', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#chat')).toBeVisible();
    await expect(page.locator('#adminChatInput')).toBeVisible();

    await page.locator('#rightTeamMembersToggle').click();
    await expect(page.locator('#agentList')).toBeVisible();
    const before = await page.locator('#agentList .agent-card').count();
    await page.locator('#addAgentBtn').click();
    await expect(page.locator('#agentBuilderModal')).toBeVisible();
    await page.locator('#agentBuilderName').fill('Agent تستی');
    await page.locator('#agentBuilderRole').fill('تست رابط');
    await page.locator('#agentBuilderModel').fill('koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix');
    await page.locator('#agentBuilderCreate').click();
    await expect(page.locator('#agentList .agent-card')).toHaveCount(before + 1);
    await page.locator('#workflowBuilderBtn').click();
    await expect(page.locator('#workflowBuilderModal')).toBeVisible();
    await expect(page.locator('#workflowSteps')).toBeVisible();
    await page.locator('#workflowSave').click();
    await expect(page.locator('#workflowBuilderModal')).toBeHidden();

    await page.locator('#goal').fill('یک آزمایش کامل رابط و اجرای تیم انجام بده.');
    await page.locator('#demoModeBtn').click();
    await page.locator('#runBtn').click();
    await expect(page.locator('#chat')).toContainText('اجرای زنجیره‌ای تیم تمام شد', { timeout: 15000 });

    await page.locator('#parallelBtn').click();
    await expect(page.locator('#chat')).toContainText('اجرای موازی پایان یافت', { timeout: 15000 });

    await page.locator('#dialogueRounds').selectOption('1');
    await page.locator('#dialogueBtn').click();
    await expect(page.locator('#chat')).toContainText('بحث چندعاملی پایان یافت', { timeout: 15000 });
  });

  test('mobile chat-first layout and drawer behavior', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#chat')).toBeVisible();
    await expect(page.locator('#adminChatInput')).toBeVisible();

    await page.locator('#drawerToggle').click();
    await expect(page.locator('.app')).toHaveClass(/(^| )drawer-hidden( |$)/);
    await page.locator('#drawerToggle').click();
    await expect(page.locator('.app')).not.toHaveClass(/(^| )drawer-hidden( |$)/);

    const inputBox = await page.locator('#adminChatInput').boundingBox();
    const buttonBox = await page.locator('#adminChatBtn').boundingBox();
    expect(inputBox?.width).toBeGreaterThan(250);
    expect(buttonBox?.width).toBeGreaterThan(150);
  });
});
