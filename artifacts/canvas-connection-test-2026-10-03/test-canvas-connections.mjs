// 真实环境访问探测器：不注入 token，不 mock/route API，不创建或修改项目数据。
// 未登录或 API 不通时记录阻断并退出；需完成真实登录后另行执行交互用例。
import { chromium } from '/home/longxingze/桌面/yingzhi-AI (new)/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const base = '/home/longxingze/桌面/yingzhi-AI (new)/artifacts/canvas-connection-test-2026-10-03';
const browser = await chromium.launch({ headless: true, executablePath: '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
const errors = [];
const apiResponses = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(`PAGEERROR: ${error.message}`));
page.on('response', (response) => {
  if (response.url().includes('/api/')) {
    apiResponses.push({ method: response.request().method(), status: response.status(), url: response.url() });
  }
});
await page.goto('http://localhost:3002/studio/canvas', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(1000);
const finalUrl = page.url();
const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000);
const enteredEditor = await page.getByTestId('infinite-canvas').count().catch(() => 0) > 0;
const result = {
  date: new Date().toISOString(),
  requestedUrl: 'http://localhost:3002/studio/canvas',
  finalUrl,
  enteredEditor,
  blocker: enteredEditor ? null : '未进入画布编辑器；本探测器不绕过认证，交互用例未运行。',
  apiResponses,
  errors,
};
await fs.writeFile(path.join(base, 'access_probe.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await context.close();
await browser.close();
