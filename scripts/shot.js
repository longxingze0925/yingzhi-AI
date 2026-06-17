const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1460, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();

  await page.goto("http://localhost:3000/studio/image", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(800);

  // 填入提示词
  const ta = page.locator("textarea").first();
  await ta.click();
  await ta.fill(
    "霓虹雨夜的赛博都市，反光的街道与悬浮广告牌，电影级广角，超高细节，8K 画质"
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: "shots/01-填写提示词.png" });

  // 点击「生成图片」
  await page.getByRole("button", { name: /生成图片/ }).click();

  // 排队 / 进度初期
  await page.waitForTimeout(700);
  await page.screenshot({ path: "shots/02-排队与进度.png" });

  // 生成中（骨架屏 + 进度过半）
  await page.waitForTimeout(1300);
  await page.screenshot({ path: "shots/03-生成中骨架屏.png" });

  // 等待完成（出现「已完成」徽标）
  await page.waitForSelector("text=已完成", { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "shots/04-生成完成.png" });

  // 再生成一组多图，展示 2x2 结果
  await ta.click();
  await ta.fill("东方水墨意境的孤舟与远山，留白极简，淡彩晕染");
  // 把数量滑块拉到 4（用键盘）
  const slider = page.locator('[role="slider"]').first();
  await slider.click();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: /生成图片/ }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/05-多图生成中.png" });
  await page.waitForSelector("text=已完成", { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "shots/06-多图完成与历史.png", fullPage: true });

  await browser.close();
  console.log("done");
})();
