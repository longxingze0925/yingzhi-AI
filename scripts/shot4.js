const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: "切换主题" }).first().click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: "shots/blue-4-首页真亮色.png" });
  await b.close();
  console.log("done");
})();
