const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 920 },
    deviceScaleFactor: 1.5,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();

  await page.goto("http://localhost:3000/studio/image", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(900);
  // 空状态 + 底部悬浮栏
  await page.screenshot({ path: "shots/n1-空状态与悬浮栏.png" });

  // 在悬浮栏输入提示词
  const ta = page.locator("textarea").first();
  await ta.click();
  await ta.fill(
    "霓虹雨夜的赛博都市，反光的街道与悬浮广告牌，电影级广角，超高细节，8K 画质"
  );
  // 数量选 4 张
  await page.getByRole("combobox").nth(2).click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: "生成 4 张" }).click();
  await page.waitForTimeout(300);

  // 生成
  await page.getByTitle("生成", { exact: true }).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "shots/n2-生成中网格.png" });

  await page.waitForSelector("text=已完成", { timeout: 15000 });
  await page.waitForTimeout(700);

  // 再生成一组，让网格里有多条历史
  await ta.click();
  await ta.fill("东方水墨意境的孤舟与远山，留白极简，淡彩晕染");
  await page.getByTitle("生成", { exact: true }).click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "shots/n3-历史网格沉淀.png" });

  await page.waitForSelector("text=已完成", { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "shots/n4-完成态网格.png" });

  // 亮色主题
  await page.emulateMedia({ colorScheme: "light" });
  // 切换主题按钮（顶栏太阳/月亮）
  await page.waitForTimeout(400);
  await page.screenshot({ path: "shots/n5-当前态.png" });

  await browser.close();
  console.log("done");
})();
