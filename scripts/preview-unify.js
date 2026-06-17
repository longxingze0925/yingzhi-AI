const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 2048, height: 1152 }, deviceScaleFactor: 1 });
  for (const [url, name] of [["/studio/image","image"],["/studio/explore","explore"]]) {
    const p = await ctx.newPage();
    await p.goto("http://localhost:3000" + url, { waitUntil: "networkidle" });
    await p.evaluate(() => {
      const pc = document.querySelector('main .mx-auto');
      if (pc) pc.style.maxWidth = "1760px";
      // 把所有 columns-[280px] 容器临时改 320，模拟 explore 统一
      document.querySelectorAll('main div').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.columnWidth === "280px") el.style.columnWidth = "320px";
      });
    });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `shots/unify-${name}.png` });
    await p.close();
  }
  await b.close(); console.log("done");
})();
