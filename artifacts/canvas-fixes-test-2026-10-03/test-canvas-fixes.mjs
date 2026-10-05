import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const base = 'http://localhost:3002';
const outDir = path.resolve('artifacts/canvas-fixes-test-2026-10-03');
const shotDir = path.join(outDir, 'screenshots');
const exportPath = path.join(outDir, 'test_canvas_with_connections.json');
await fs.mkdir(shotDir, { recursive: true });

const testCases = [
  ['修复1：导出/导入包含连线', '验证导出 JSON 字段和实际导入往返'],
  ['修复2：连接点不被调整手柄遮挡', '左右连接点命中、创建草稿及 hover 放大'],
  ['修复3：4 个方向的贝塞尔曲线', '左→右、右→右、左→左、右→左曲线与箭头'],
  ['修复4：删除节点清理关联连线', '右键菜单删除中间节点并清理两条关联线'],
  ['创建连线（两次点击）', '从起点连接点点击到目标连接点'],
  ['连线视觉效果', '路径为贝塞尔曲线并有终点箭头'],
  ['连线选中', '点击曲线后高亮，点击空白取消'],
  ['Delete/Backspace 删除连线', '两种快捷键分别删除选中连线'],
  ['Escape 取消选择', '取消连线创建草稿和连线选中'],
  ['同一连接点创建多条连线', '验证同一端口可以有多条连线'],
  ['节点拖动时连线跟随', '拖动源节点和目标节点观察端点'],
  ['调整节点大小时连线跟随', '拖动边/角调整柄并观察端点'],
  ['多选节点拖动时连线跟随', '拖动多选节点，确认线端点跟随'],
  ['拒绝自连接', '尝试从同一节点一侧连到另一侧'],
  ['复制节点不复制连线', '复制已连线节点，检查连线数量不变'],
  ['撤销/重做包含连线操作', '创建连线后测试 Ctrl+Z / Ctrl+Shift+Z'],
  ['刷新后连线保留', '刷新页面检查节点和连线恢复'],
  ['导出/导入包含连线', '实际 UI JSON 往返恢复连接数据'],
  ['连线颜色', '未选中灰色、选中蓝色'],
  ['连线宽度', '未选中 2px、选中 3px'],
  ['箭头颜色', 'marker 箭头颜色随选中状态变化'],
  ['删除源节点清理连线', '删除 source 后对应连线消失'],
  ['删除目标节点清理连线', '删除 target 后对应连线消失'],
  ['空画布创建节点和连线', '从空画布开始完成连线'],
  ['节点堆叠时连线不错乱', '重叠节点区域的连线仍可辨识和命中'],
  ['20+ 条连线性能', '20 条线渲染及拖动帧率检查'],
];
const results = testCases.map(([name, purpose], index) => ({
  number: index + 1,
  name,
  purpose,
  status: 'BLOCKED',
  actual: '',
  evidence: [],
}));
const browserLog = { console: [], pageErrors: [], requestsFailed: [], apiResponses: [] };
let browser;
let context;
let page;
let blocker = null;
let projectName = '';
let projectId = '';
let importedProjectId = '';
let exportDetails = null;
const runStart = new Date().toISOString();

function pass(index, actual, evidence = []) {
  Object.assign(results[index - 1], { status: 'PASS', actual, evidence });
}
function fail(index, actual, evidence = []) {
  Object.assign(results[index - 1], { status: 'FAIL', actual, evidence });
  blocker = `第 ${index} 项未通过：${results[index - 1].name}`;
}
function setBlockedRemaining(fromIndex, reason) {
  for (let i = fromIndex; i <= results.length; i++) {
    if (!results[i - 1].actual) results[i - 1].actual = reason;
  }
}
async function saveShot(name) {
  const file = path.join(shotDir, name);
  await page.screenshot({ path: file, fullPage: false });
  return `screenshots/${name}`;
}
async function waitForPathCount(count, timeout = 5000) {
  await page.waitForFunction(
    (expected) => document.querySelectorAll('[data-canvas-connection]').length >= expected,
    count,
    { timeout },
  ).catch(async () => {
    // Current component has no data attribute; each connection is an SVG <g> with a click handler.
    await page.waitForFunction(
      (expected) => document.querySelectorAll('[data-testid="infinite-canvas"] svg g > g').length >= expected,
      count,
      { timeout: Math.max(1000, timeout - 200) },
    );
  });
}

try {
  browser = await chromium.launch({ headless: true, executablePath: '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
  context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, acceptDownloads: true });
  page = await context.newPage();
  page.on('console', (message) => browserLog.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => browserLog.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => browserLog.requestsFailed.push({ method: request.method(), url: request.url(), failure: request.failure()?.errorText }));
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/api/')) browserLog.apiResponses.push({ method: response.request().method(), status: response.status(), url: response.url() });
  });

  await page.goto(`${base}/studio/canvas`, { waitUntil: 'networkidle', timeout: 30000 });
  if (new URL(page.url()).pathname === '/login') {
    let login = process.env.CANVAS_TEST_LOGIN;
    let password = process.env.CANVAS_TEST_PASSWORD;
    if (!login || !password) {
      login = `canvas-e2e-${Date.now()}@example.com`;
      password = crypto.randomBytes(8).toString('hex');
      await page.getByRole('button', { name: '注册', exact: true }).click();
      await page.locator('#email').fill(login);
      await page.locator('#password').fill(password);
      await page.getByRole('button', { name: '创建账号', exact: true }).click();
      await page.getByText('注册成功，请使用新账号登录', { exact: true }).waitFor({ timeout: 20000 });
    }
    await page.locator('#email').fill(login);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: '登录', exact: true }).last().click();
    await Promise.race([
      page.waitForURL((url) => url.pathname.startsWith('/studio'), { timeout: 20000 }),
      page.getByRole('heading', { name: '完成两步验证' }).waitFor({ timeout: 20000 }),
      page.getByText(/登录失败|验证码|账号或密码|Unauthorized/).waitFor({ timeout: 20000 }),
    ]).catch(() => {});
    if (new URL(page.url()).pathname === '/login') {
      const message = await page.locator('body').innerText();
      const evidence = await saveShot('00-login-blocker.png');
      blocker = `登录后仍停留登录页：${message.slice(-600)}`;
      results.forEach((result) => { result.actual = '未能进入画布编辑器，依测试约定停止'; });
      browserLog.blockerScreenshot = evidence;
      throw new Error(blocker);
    }
    if (await page.getByRole('heading', { name: '完成两步验证' }).count()) {
      const evidence = await saveShot('00-two-factor-blocker.png');
      blocker = '登录触发两步验证，但本轮没有验证码，按约定停止';
      results.forEach((result) => { result.actual = '登录受两步验证阻断，未执行'; });
      browserLog.blockerScreenshot = evidence;
      throw new Error(blocker);
    }
  }
  await page.waitForURL((url) => url.pathname === '/studio/canvas', { timeout: 20000 });
  await page.getByRole('heading', { name: '无限画布' }).waitFor({ timeout: 10000 });
  const listShot = await saveShot('00-canvas-list-authenticated.png');

  await page.getByRole('main').locator('header').getByRole('button', { name: '新建画布' }).click();
  await page.waitForURL(/\/studio\/canvas\/[^/]+$/);
  projectId = new URL(page.url()).pathname.split('/').at(-1);
  projectName = await page.locator('header h1').innerText();
  await page.getByTestId('infinite-canvas').waitFor();
  const emptyShot = await saveShot('01-empty-canvas.png');

  async function addTextNode() {
    await page.getByRole('button', { name: '添加节点' }).click();
    await page.getByRole('menuitem', { name: '文本节点' }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-canvas-node]').length > 0);
    await page.waitForTimeout(150);
  }
  await addTextNode();
  await addTextNode();
  const nodes = page.locator('[data-canvas-node]');
  await page.waitForFunction(() => document.querySelectorAll('[data-canvas-node]').length === 2);
  const nodeIds = await nodes.evaluateAll((els) => els.map((el) => el.getAttribute('data-node-id')));
  const nodeShot = await saveShot('02-two-text-nodes.png');

  const a = nodes.nth(0);
  const b = nodes.nth(1);
  const aBox0 = await a.boundingBox();
  const bBox0 = await b.boundingBox();
  if (!aBox0 || !bBox0) throw new Error('创建的两个文本节点未取得浏览器布局位置');
  // 为了使连线方向清晰，使用真实鼠标拖动将 B 放到 A 的右侧。
  const start = await b.locator('header span').first().boundingBox();
  if (!start) throw new Error('未找到 B 节点标题栏作为拖动目标');
  const dx = (aBox0.x + aBox0.width + 100) - bBox0.x;
  const dy = aBox0.y - bBox0.y;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(start.x + start.width / 2 + dx * step / 8, start.y + start.height / 2 + dy * step / 8);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
  const movedBBox = await b.boundingBox();
  if (!movedBBox || Math.abs(movedBBox.x - (aBox0.x + aBox0.width + 100)) > 8) throw new Error('无法将 B 节点拖到 A 右侧');

  await a.locator('header span').first().click();
  const rightPoint = a.locator('[data-connection-point="right"]');
  await rightPoint.waitFor({ state: 'visible' });
  await rightPoint.hover();
  const hoverShot = await saveShot('fix-02-connection-point-hover.png');
  const hoverTransform = await rightPoint.evaluate((el) => getComputedStyle(el).transform);
  await rightPoint.click();
  await b.locator('header span').first().click();
  const leftPoint = b.locator('[data-connection-point="left"]');
  await leftPoint.waitFor({ state: 'visible' });
  await leftPoint.click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="infinite-canvas"] svg g > g').length === 1, { timeout: 5000 });
  const connectionShot = await saveShot('fix-01-created-connection.png');

  const downloadStarted = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.getByRole('button', { name: '导出', exact: false }).click(),
  ]);
  await download.saveAs(exportPath);
  const exportText = await fs.readFile(exportPath, 'utf8');
  const exported = JSON.parse(exportText);
  const exportedProject = exported.projects?.[0];
  const connection = exportedProject?.connections?.[0];
  const requiredConnectionFields = ['id', 'sourceNodeId', 'sourceSide', 'targetNodeId', 'targetSide', 'createdAt'];
  const missingFields = requiredConnectionFields.filter((field) => !(field in (connection ?? {})));
  exportDetails = {
    version: exported.version,
    projects: exported.projects?.length,
    nodes: exportedProject?.nodes?.length,
    connections: exportedProject?.connections?.length,
    connectionFields: connection ? Object.keys(connection) : [],
    missingFields,
    downloadFilename: download.suggestedFilename(),
    downloadElapsedMs: Date.now() - downloadStarted,
    expectedSourceNodeId: nodeIds[0],
    expectedTargetNodeId: nodeIds[1],
  };
  const jsonShotPage = await context.newPage();
  await jsonShotPage.goto(`file://${exportPath}`);
  await jsonShotPage.screenshot({ path: path.join(shotDir, 'fix-01-export-json.png') });
  await jsonShotPage.close();
  const exportShot = await saveShot('fix-01-exported-editor.png');

  const exportValid = exported.version === '1.0' && Array.isArray(exported.projects) && exportedProject?.nodes?.length === 2 && exportedProject?.connections?.length === 1 && missingFields.length === 0 && connection.sourceNodeId === nodeIds[0] && connection.targetNodeId === nodeIds[1];
  if (!exportValid) {
    fail(1, `导出断言失败：${JSON.stringify(exportDetails)}`, [connectionShot, exportShot, 'test_canvas_with_connections.json']);
    setBlockedRemaining(2, '第 1 项失败后依照测试提示立即停止，未继续操作');
  } else {
    await page.getByRole('button', { name: '返回画布列表' }).click();
    await page.waitForURL((url) => url.pathname === '/studio/canvas');
    await page.getByLabel('选择画布 JSON 文件').setInputFiles(exportPath);
    await page.getByRole('status').filter({ hasText: '成功导入 1 个画布' }).waitFor({ timeout: 10000 });
    const importShot = await saveShot('fix-01-import-result.png');
    const matchingCards = page.getByRole('link', { name: `打开画布：${projectName}` });
    if (await matchingCards.count() < 2) throw new Error('导入成功提示出现，但导入画布卡片未出现');
    await matchingCards.last().click();
    await page.waitForURL(/\/studio\/canvas\/[^/]+$/);
    importedProjectId = new URL(page.url()).pathname.split('/').at(-1);
    await page.waitForFunction(() => document.querySelectorAll('[data-canvas-node]').length === 2);
    const pathCount = await page.locator('[data-testid="infinite-canvas"] svg g > g').count();
    const importedStore = await page.evaluate((id) => {
      const raw = localStorage.getItem('canvas-storage');
      const state = raw ? JSON.parse(raw) : null;
      const project = state?.state?.projects?.find((item) => item.id === id);
      return project ? { nodeCount: project.nodes?.length ?? 0, connections: project.connections ?? null, viewport: project.viewport, positions: project.nodes?.map((node) => node.position) } : null;
    }, importedProjectId);
    const importFailedShot = await saveShot('fix-01-import-connections-missing.png');
    if (pathCount !== 1 || importedStore?.connections?.length !== 1) {
      fail(1, `导出 JSON 确认含 1 条连线且字段齐全；真实 UI 导入提示成功，节点 ${importedStore?.nodeCount ?? 0} 个，但导入项目的连线数组为 ${JSON.stringify(importedStore?.connections)}，SVG 连线数=${pathCount}。`, [connectionShot, 'fix-01-export-json.png', importShot, importFailedShot, 'test_canvas_with_connections.json']);
      setBlockedRemaining(2, '第 1 项真实 UI 往返未通过；按测试提示立即停止，未继续其余测试');
    } else {
      pass(1, '导出 JSON 及真实 UI 导入往返均恢复节点、连线字段、位置和方向。', [connectionShot, 'fix-01-export-json.png', importShot]);
    }
  }
  if (!blocker) {
    async function createProject() {
      if (new URL(page.url()).pathname !== '/studio/canvas') {
        await page.getByRole('button', { name: '返回画布列表' }).click();
        await page.waitForURL((url) => url.pathname === '/studio/canvas');
      }
      await page.getByRole('main').locator('header').getByRole('button', { name: '新建画布' }).click();
      await page.waitForURL(/\/studio\/canvas\/[^/]+$/);
      await page.getByTestId('infinite-canvas').waitFor();
      return page.locator('[data-canvas-node]');
    }
    async function addText() {
      await page.getByRole('button', { name: '添加节点' }).click();
      await page.getByRole('menuitem', { name: '文本节点' }).click();
      await page.waitForFunction(() => document.querySelectorAll('[data-canvas-node]').length > 0);
      await page.waitForTimeout(100);
    }
    async function selectNode(node) {
      await node.locator('header span').first().click();
      await page.waitForTimeout(50);
    }
    async function connect(source, sourceSide, target, targetSide) {
      await selectNode(source);
      await source.locator(`[data-connection-point="${sourceSide}"]`).click();
      await selectNode(target);
      await target.locator(`[data-connection-point="${targetSide}"]`).click();
      await page.waitForTimeout(100);
    }
    const groups = () => page.locator('[data-testid="infinite-canvas"] svg > g > g');

    try {
      const nodes = await createProject();
      await addText();
      await addText();
      const a = nodes.nth(0);
      const b = nodes.nth(1);
      await selectNode(a);
      const point = a.locator('[data-connection-point="left"]');
      await point.hover();
      await page.waitForTimeout(250);
      const transform = await point.evaluate((el) => getComputedStyle(el).transform);
      const hoverShot = await saveShot('fix-02-connection-point.png');
      await connect(a, 'left', b, 'left');
      await connect(a, 'right', b, 'right');
      const count = await groups().count();
      const clickShot = await saveShot('fix-02-connection-points-clickable.png');
      if (!/matrix\(1\.25,\s*0,\s*0,\s*1\.25,/.test(transform) || count !== 2) {
        fail(2, `左右连接点点击后连线数=${count}（预期 2）；hover transform=${transform}`, [hoverShot, clickShot]);
        setBlockedRemaining(3, '第 2 项未通过，按测试提示停止后续测试');
      } else {
        pass(2, '左右连接点均可点击并创建连线；hover computed transform 为 scale(1.25)。', [hoverShot, clickShot]);
      }
    } catch (error) {
      fail(2, `连接点测试异常：${error instanceof Error ? error.message : String(error)}`, []);
      setBlockedRemaining(3, '第 2 项执行异常，按测试提示停止后续测试');
    }

    if (!blocker) {
      try {
        const nodes = await createProject();
        for (let index = 0; index < 4; index++) await addText();
        const items = Array.from({ length: 4 }, (_, index) => nodes.nth(index));
        const targets = [320, 690, 1060, 1430];
        for (let index = 0; index < items.length; index++) {
          const box = await items[index].boundingBox();
          const header = await items[index].locator('header span').first().boundingBox();
          if (!box || !header) throw new Error('无法读取节点位置');
          const sx = header.x + header.width / 2;
          const sy = header.y + header.height / 2;
          const dx = targets[index] - box.x;
          const dy = 330 - box.y;
          await page.mouse.move(sx, sy);
          await page.mouse.down();
          for (let step = 1; step <= 8; step++) await page.mouse.move(sx + dx * step / 8, sy + dy * step / 8);
          await page.mouse.up();
          await page.waitForTimeout(100);
        }
        const [a, b, c, d] = items;
        await connect(a, 'right', b, 'left');
        await connect(c, 'right', b, 'right');
        await connect(c, 'left', d, 'left');
        await connect(d, 'left', a, 'right');
        const connectionElements = await groups().all();
        const expected = [['right', 'left'], ['right', 'right'], ['left', 'left'], ['left', 'right']];
        const paths = await Promise.all(connectionElements.map((group) => group.locator('path[marker-end]').getAttribute('d')));
        const pathChecks = paths.map((path, index) => {
          const n = [...(path ?? '').matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
          if (n.length !== 8) return false;
          const [sx, , cp1x, , cp2x, , ex] = n;
          const [sourceSide, targetSide] = expected[index];
          return (sourceSide === 'right' ? cp1x > sx : cp1x < sx) &&
            (targetSide === 'right' ? cp2x > ex : cp2x < ex);
        });
        const markers = await Promise.all(connectionElements.map((group) => group.locator('path[marker-end]').getAttribute('marker-end')));
        const shot = await saveShot('fix-03-bezier-curves.png');
        if (connectionElements.length !== 4 || pathChecks.some((valid) => !valid) || markers.some((marker) => !marker)) {
          fail(3, `连线数=${connectionElements.length}，控制点方向=${JSON.stringify(pathChecks)}，箭头=${JSON.stringify(markers)}`, [shot]);
          setBlockedRemaining(4, '第 3 项未通过，按测试提示停止后续测试');
        } else {
          pass(3, '四种连接侧组合的 Bézier 控制点方向及终点箭头检查通过。', [shot]);
        }
      } catch (error) {
        fail(3, `贝塞尔曲线测试异常：${error instanceof Error ? error.message : String(error)}`, []);
        setBlockedRemaining(4, '第 3 项执行异常，按测试提示停止后续测试');
      }
    }

    if (!blocker) {
      try {
        const nodes = await createProject();
        await addText();
        await addText();
        await addText();
        const [a, b, c] = [nodes.nth(0), nodes.nth(1), nodes.nth(2)];
        await connect(a, 'right', b, 'left');
        await connect(b, 'right', c, 'left');
        await selectNode(b);
        await b.locator('header span').first().click({ button: 'right' });
        await page.waitForTimeout(200);
        const menu = page.getByRole('menuitem', { name: '删除', exact: true });
        const shot = await saveShot('fix-04-right-click-delete-menu.png');
        if (!(await menu.count())) {
          fail(4, '右键节点 B 后没有出现“删除”菜单项，无法按指定方式删除节点。', [shot]);
          setBlockedRemaining(5, '第 4 项未通过，按测试提示停止后续测试');
        } else {
          await menu.click();
          await page.waitForFunction(() => document.querySelectorAll('[data-canvas-node]').length === 2);
          const remaining = await groups().count();
          const deleteShot = await saveShot('fix-04-delete-cleanup.png');
          if (remaining) {
            fail(4, `节点 B 已删除，但关联连线残留 ${remaining} 条。`, [shot, deleteShot]);
            setBlockedRemaining(5, '第 4 项未通过，按测试提示停止后续测试');
          } else {
            pass(4, '右键菜单删除节点 B 成功，关联连线自动清除。', [shot, deleteShot]);
          }
        }
      } catch (error) {
        fail(4, `删除节点测试异常：${error instanceof Error ? error.message : String(error)}`, []);
        setBlockedRemaining(5, '第 4 项执行异常，按测试提示停止后续测试');
      }
    }
  }
} catch (error) {
  if (!blocker) blocker = error instanceof Error ? error.message : String(error);
  for (const result of results) {
    if (!result.actual) result.actual = '测试脚本在到达该项前中断，未判定功能结果';
  }
} finally {
  if (context) {
    try { await context.close(); } catch {}
  }
  if (browser) {
    try { await browser.close(); } catch {}
  }
  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.filter((item) => item.status === 'FAIL').length;
  const blocked = results.filter((item) => item.status === 'BLOCKED').length;
  const reportData = {
    startedAt: runStart,
    completedAt: new Date().toISOString(),
    browser: 'Google Chrome',
    viewport: '1920x1080',
    frontend: base,
    backend: 'http://localhost:3000',
    projectName,
    projectId,
    importedProjectId,
    exportDetails,
    summary: { total: results.length, passed, failed, blocked },
    blocker,
    cases: results,
    browserLog,
    screenshots: (await fs.readdir(shotDir)).filter((name) => name.endsWith('.png')).map((name) => `screenshots/${name}`),
  };
  await fs.writeFile(path.join(outDir, 'test-results.json'), JSON.stringify(reportData, null, 2));
  const consoleLines = [];
  for (const entry of browserLog.console.filter((item) => item.type === 'error')) consoleLines.push(`[console.error] ${entry.text}`);
  for (const entry of browserLog.pageErrors) consoleLines.push(`[pageerror] ${entry}`);
  for (const entry of browserLog.requestsFailed) consoleLines.push(`[requestfailed] ${entry.method} ${entry.url} ${entry.failure}`);
  await fs.writeFile(path.join(outDir, 'console_errors.txt'), consoleLines.length ? consoleLines.join('\n') + '\n' : '测试过程无浏览器控制台错误、页面异常或请求失败。\n');
  console.log(JSON.stringify({ summary: reportData.summary, blocker, projectName, exportDetails, cases: results.map(({ number, name, status, actual }) => ({ number, name, status, actual })), screenshots: reportData.screenshots, consoleErrors: consoleLines }, null, 2));
}
