const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/studio/explore", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  // 点开第一张卡片打开详情弹窗
  const card = p.locator('[role="button"], button, a').filter({ hasText: /霓虹|赛博|水墨|人像/ }).first();
  // 更稳妥：直接点第一个 media-card 容器
  const firstCard = p.locator('main .grid > *').first();
  await firstCard.click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: "shots/hd-详情.png" });
  await b.close();
  console.log("done");
})();
