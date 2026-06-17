const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/studio/image", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.screenshot({ path: "shots/measure-image-1920.png" });
  await b.close();
  console.log("done");
})();
