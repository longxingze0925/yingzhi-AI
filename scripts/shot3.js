const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();

  // 暗色首页
  const dark = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    colorScheme: "dark",
  });
  const p1 = await dark.newPage();
  await p1.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p1.waitForTimeout(1200);
  await p1.screenshot({ path: "shots/blue-1-首页暗色.png" });

  // 暗色工作台（生成一组看蓝色卡片）
  const p2 = await dark.newPage();
  await p2.goto("http://localhost:3000/studio/image", { waitUntil: "networkidle" });
  await p2.waitForTimeout(800);
  const ta = p2.locator("textarea").first();
  await ta.click();
  await ta.fill("深海蓝调的未来都市夜景，玻璃幕墙与光轨，电影级广角");
  await p2.getByRole("combobox").nth(2).click();
  await p2.waitForTimeout(250);
  await p2.getByRole("option", { name: "生成 4 张" }).click();
  await p2.getByTitle("生成", { exact: true }).click();
  await p2.waitForSelector("text=已完成", { timeout: 15000 });
  await p2.waitForTimeout(700);
  await p2.screenshot({ path: "shots/blue-2-工作台暗色.png" });

  // 亮色首页
  const light = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    colorScheme: "light",
  });
  const p3 = await light.newPage();
  await p3.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p3.waitForTimeout(1200);
  await p3.screenshot({ path: "shots/blue-3-首页亮色.png" });

  await browser.close();
  console.log("done");
})();
