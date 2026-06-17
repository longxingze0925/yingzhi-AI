const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });

  // 亮色首页
  const p1 = await ctx.newPage();
  await p1.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p1.waitForTimeout(1200);
  await p1.screenshot({ path: "shots/a1-首页亮色.png" });

  // 亮色工作台 + 生成（看侧栏按钮/chips/卡片）
  const p2 = await ctx.newPage();
  await p2.goto("http://localhost:3000/studio/image", { waitUntil: "networkidle" });
  await p2.waitForTimeout(800);
  const ta = p2.locator("textarea").first();
  await ta.click();
  await ta.fill("简洁的产品摄影，柔光，浅景深");
  await p2.getByRole("combobox").nth(2).click();
  await p2.waitForTimeout(250);
  await p2.getByRole("option", { name: "生成 4 张" }).click();
  await p2.getByTitle("生成", { exact: true }).click();
  await p2.waitForSelector("text=已完成", { timeout: 15000 });
  await p2.waitForTimeout(700);
  await p2.screenshot({ path: "shots/a2-工作台亮色.png" });

  // 设置页（看升级套餐）
  const p4 = await ctx.newPage();
  await p4.goto("http://localhost:3000/studio/settings", { waitUntil: "networkidle" });
  await p4.waitForTimeout(700);
  await p4.getByRole("tab", { name: /套餐与算力/ }).click();
  await p4.waitForTimeout(500);
  await p4.screenshot({ path: "shots/a3-套餐页亮色.png" });

  // 暗色工作台
  const p3 = await ctx.newPage();
  await p3.goto("http://localhost:3000/studio/image", { waitUntil: "networkidle" });
  await p3.waitForTimeout(600);
  await p3.getByRole("button", { name: "切换主题" }).first().click();
  await p3.waitForTimeout(700);
  await p3.screenshot({ path: "shots/a4-工作台暗色.png" });

  await b.close();
  console.log("done");
})();
