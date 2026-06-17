const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: "dark" });

  // 暗色首页
  const p1 = await ctx.newPage();
  await p1.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p1.waitForTimeout(1200);
  await p1.screenshot({ path: "shots/g1-首页暗色.png" });

  // 暗色工作台 + 生成
  const p2 = await ctx.newPage();
  await p2.goto("http://localhost:3000/studio/image", { waitUntil: "networkidle" });
  await p2.waitForTimeout(800);
  const ta = p2.locator("textarea").first();
  await ta.click();
  await ta.fill("黄昏逆光的人像剪影，胶片颗粒，低饱和电影感");
  await p2.getByRole("combobox").nth(2).click();
  await p2.waitForTimeout(250);
  await p2.getByRole("option", { name: "生成 4 张" }).click();
  await p2.getByTitle("生成", { exact: true }).click();
  await p2.waitForSelector("text=已完成", { timeout: 15000 });
  await p2.waitForTimeout(700);
  await p2.screenshot({ path: "shots/g2-工作台暗色.png" });

  // 亮色首页（点切换）
  const p3 = await ctx.newPage();
  await p3.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p3.waitForTimeout(700);
  await p3.getByRole("button", { name: "切换主题" }).first().click();
  await p3.waitForTimeout(700);
  await p3.screenshot({ path: "shots/g3-首页亮色.png" });

  await b.close();
  console.log("done");
})();
