const { chromium } = require("playwright");
const pages = [
  ["/studio/image", "image"],
  ["/studio/explore", "explore"],
  ["/studio/assets", "assets"],
  ["/studio/library", "library"],
];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  for (const [url, name] of pages) {
    const p = await ctx.newPage();
    await p.goto("http://localhost:3000" + url, { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `shots/layout-${name}.png` });
    await p.close();
  }
  await b.close();
  console.log("done");
})();
