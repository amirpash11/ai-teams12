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
    // The drawer defaults to open after localStorage is cleared; open it only if persisted state hid it.
    if (await page.locator('.app').evaluate(el => el.classList.contains('drawer-hidden'))) {
      await page.locator('#drawerToggle').click();
    }

    await expect(page.locator('#chat')).toBeVisible();
    await expect(page.locator('#adminChatInput')).toBeVisible();
    const voteCheck = await page.evaluate(() => {
      const agents=[{name:'تحلیل‌گر'},{name:'طراح'}];
      const valid=window.aiTeamsParseAgentVote('```json\n{"vote_for":"طراح","reason":"راه‌حل دقیق‌تر"}\n```',agents);
      let invalidRejected=false;
      try { window.aiTeamsParseAgentVote('{"vote_for":"عضو ناشناس","reason":"نامعتبر"}',agents); } catch (_) { invalidRejected=true; }
      return {vote:valid.vote_for,invalidRejected};
    });
    expect(voteCheck.vote).toBe('طراح');
    expect(voteCheck.invalidRejected).toBeTruthy();

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
    // The editor lives in the right options drawer; make sure that drawer is open before visibility assertions.
    if (await page.locator('.app').evaluate(el => el.classList.contains('drawer-hidden'))) {
      await page.locator('#drawerToggle').click();
    }
    await expect(page.locator('.app')).not.toHaveClass(/(^| )drawer-hidden( |$)/);
    const editorCard = page.locator('#rightHomeOptions .card').filter({ has: page.locator('#editor') });
    const editorToggle = editorCard.locator('.drawer-fold-toggle');
    if (await editorToggle.getAttribute('aria-expanded') === 'false') await editorToggle.click();
    const memberRow = page.locator('#editor .agent-row').filter({ hasText: 'عضو تستی' }).first();
    // The settings drawer intentionally folds the editor section by default; expand it before asserting member visibility.
    await page.locator('#editor').evaluate(el => { const card=el.closest('.card'); if(card?.classList.contains('folded')) card.querySelector('.drawer-fold-toggle')?.click(); });
    await expect(memberRow).toBeVisible();
    await page.locator('#addAgentBtn').click();
    await page.locator('#agentBuilderName').fill('عضو تستی');
    await page.locator('#agentBuilderRole').fill('تکراری');
    await page.locator('#agentBuilderModel').fill('koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix');
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#agentBuilderCreate').click();
    await expect(page.locator('#editor')).toContainText('عضو تستی');
    await expect(memberRow).toHaveCount(1);
    await page.locator('#agentBuilderCancel').click({ force: true });
    page.once('dialog', dialog => dialog.accept());
    await memberRow.locator('button[title="حذف"]').click();
    await expect(page.locator('#editor')).not.toContainText('عضو تستی');
    await expect(page.locator('#workflowBuilderBtn')).toBeAttached();
    // Member operations can rerender the drawer; re-open it if its persisted state closed it.
    if (await page.locator('.app').evaluate(el => el.classList.contains('drawer-hidden'))) {
      await page.locator('#drawerToggle').click({ force: true });
    }
    const toolsToggle = page.locator('.ai-tools-toggle');
    if (await toolsToggle.count() && !(await toolsToggle.locator('xpath=..').evaluate(el => el.classList.contains('open')))) await toolsToggle.click();
    await page.locator('#memoryBtn').click();
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

  test('browser can reach the free AI Horde model catalog', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('https://oai.aihorde.net/v1/models', { signal: controller.signal });
        if (!response.ok) return { ok:false, status:response.status, count:0 };
        const data = await response.json();
        return { ok:true, status:response.status, count:Array.isArray(data.data)?data.data.length:0 };
      } catch (error) {
        return { ok:false, status:0, count:0, error:String(error && error.message || error) };
      } finally { clearTimeout(timer); }
    });
    console.log('BROWSER_HORDE_CATALOG', JSON.stringify(result));
    expect(result.ok, result.error || ('HTTP '+result.status)).toBeTruthy();
    expect(result.count).toBeGreaterThan(0);
  });

  test('Knowledge import is bounded to the safe project budget', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(() => {
      const core=window.aiTeamsCore;
      const state=JSON.parse(JSON.stringify(core.getState()));
      state.knowledge=[
        {id:'k1',name:'doc-1',text:'a'.repeat(300000)},
        {id:'k2',name:'doc-2',text:'b'.repeat(300000)},
        {id:'k3',name:'doc-3',text:'c'.repeat(300000)}
      ];
      core.importState(state);
      const docs=core.getState().knowledge||[];
      return {count:docs.length,total:docs.reduce((n,x)=>n+String(x.text||'').length,0)};
    });
    expect(result.total).toBeLessThanOrEqual(600000);
    expect(result.count).toBeLessThanOrEqual(3);
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
