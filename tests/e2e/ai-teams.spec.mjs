import { test, expect } from '@playwright/test';

test.describe('AI Teams end-to-end smoke', () => {
  test('desktop core controls and demo execution', async ({ page }) => {
    page.on('console', msg => { if(msg.type() === 'error') console.log('CONSOLE_ERROR', msg.text()); });
    page.on('pageerror', error => console.log('PAGE_ERROR', error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
    const coreResponse = await page.request.get('http://127.0.0.1:4173/app-core.js?v=2');
    console.log('CORE_HTTP', coreResponse.status(), coreResponse.headers()['content-type']);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('#chat')).toBeVisible();
    await expect(page.locator('#adminChatInput')).toBeVisible();

    await page.locator('#rightTeamMembersToggle').click();
    await expect(page.locator('#agentList')).toBeAttached();
    await expect(page.locator('#addAgentBtn')).toBeAttached();
    await expect(page.locator('#addAgentBtn')).toHaveAttribute('onclick', /openAgentBuilder/);
    await page.locator('#addAgentBtn').click();
    await expect(page.locator('#agentBuilderModal')).toBeVisible();
    await page.locator('#agentBuilderName').fill('عضو تستی');
    await page.locator('#agentBuilderRole').fill('تست مدیریت اعضا');
    await page.locator('#agentBuilderModel').fill('koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix');
    await page.locator('#agentBuilderCreate').click();
    await expect(page.locator('#editor')).toContainText('عضو تستی');
    const memberRow = page.locator('#editor .agent-row').filter({ hasText: 'عضو تستی' }).first();
    await expect(memberRow).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await memberRow.locator('button[title="حذف"]').click();
    await expect(page.locator('#editor')).not.toContainText('عضو تستی');
    await page.locator('#addAgentBtn').click();
    await page.locator('#agentBuilderName').fill('عضو تستی');
    await page.locator('#agentBuilderRole').fill('تکراری');
    await page.locator('#agentBuilderModel').fill('koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix');
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#agentBuilderCreate').click();
    await expect(page.locator('#editor')).not.toContainText('تکراری');
    await page.locator('#agentBuilderCancel').click({ force: true });
    await expect(page.locator('#workflowBuilderBtn')).toBeAttached();
    await page.locator('#memoryBtn').click({ force: true });
    await expect(page.locator('#teamMemoryPanel')).toBeVisible();
    await page.locator('#knowledgeOpen').click({ force: true });
    await expect(page.locator('#knowledgePanel')).toBeVisible();
    await page.locator('#knowledgeName').fill('سند تستی');
    await page.locator('#knowledgeText').fill('این یک سند تستی برای Knowledge پروژه است.');
    await page.locator('#knowledgeAdd').click({ force: true });
    await expect(page.locator('#knowledgeList')).toContainText('سند تستی');
    await page.locator('#knowledgeClose').click({ force: true });
    await page.locator('#memoryClose').click({ force: true });

    await page.evaluate(() => window.aiTeamsV3Open());
    await expect(page.locator('#v3Panel')).toBeVisible();
    await page.locator('#v3Calc').fill('(25*4)+10/2');
    await page.locator('#v3CalcBtn').click();
    await expect(page.locator('#v3ToolOut')).toHaveText('105');
    await expect(page.locator('#v3Audit')).toContainText('Horde endpoint رسمی');
    await page.locator('#v3Close').click();

    await page.locator('#cloudStorageBtn').click({ force: true });
    await page.evaluate(() => { if(window.aiTeamsCloud && typeof window.aiTeamsCloud.open==='function') window.aiTeamsCloud.open(); });
    await expect(page.locator('#cloudStoragePanel')).toBeVisible();
    await page.locator('#cloudClose').click({ force: true });

    await page.locator('#githubCloudBtn').click({ force: true });
    await expect(page.locator('#githubCloudPanel')).toBeVisible();
    await page.locator('#ghClose').click({ force: true });

    await page.locator('#googleDriveBtn').click({ force: true });
    await expect(page.locator('#googleDrivePanel')).toBeVisible();
    await page.locator('#gdriveClose').click({ force: true });

    await page.evaluate(() => document.getElementById('onlineTeamBtn')?.click());
    await expect(page.locator('#onlineModal')).toBeVisible();
    await page.locator('#onlineClose').click({ force: true });

    await page.locator('#v3ControlBtn').click({ force: true });
    await page.locator('#v3Pause').click();
    await page.evaluate(() => { window.aiTeamsV3.active = true; });
    await page.locator('#v3Pause').click();
    await expect(page.locator('#v3RunState')).toContainText('مکث');
    await page.locator('#v3Resume').click();
    await expect(page.locator('#v3RunState')).toContainText('در حال اجرا');
    await page.locator('#v3Stop').click();
    await page.locator('#v3Close').click();

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


test('free AI Horde endpoint smoke', async ({ request }) => {
  const res = await request.get('https://oai.aihorde.net/v1/models', { timeout: 20000 });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(Array.isArray(data?.data)).toBeTruthy();
  expect(data.data.length).toBeGreaterThan(0);
  expect(typeof data.data[0]?.id).toBe('string');
});
