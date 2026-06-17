const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 2048, height: 1152 }, deviceScaleFactor: 1 });
  for (const [url, name] of [["/studio/explore","explore"],["/studio/assets","assets"],["/studio/image","image-history"]]) {
    const p = await ctx.newPage();
    await p.goto("http://localhost:3000" + url, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    await p.screenshot({ path: `shots/ratio-${name}.png`, fullPage: true });
    await p.close();
  }
  await b.close(); console.log("done");
})();
