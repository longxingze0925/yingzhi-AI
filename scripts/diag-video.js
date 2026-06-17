const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 2048, height: 1152 }, deviceScaleFactor: 1 });
  for (const [url, name] of [["/studio/video","video"],["/studio/image","image"]]) {
    const p = await ctx.newPage();
    await p.goto("http://localhost:3000" + url, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      // 找瀑布流容器
      let cont=null;
      for (const el of document.querySelectorAll("main div")) {
        const cs = getComputedStyle(el);
        if (cs.columnWidth === "320px" && el.children.length >= 2) { cont = el; break; }
      }
      if (!cont) return { err: "no container" };
      const kids = [...cont.children];
      // 每张卡：找内部比例容器尺寸（含 ratio 信息）
      const cards = kids.map(k => {
        const r = k.getBoundingClientRect();
        // 卡内媒体区高度（找最大的子块）
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      return { count: kids.length, cards, contH: Math.round(cont.getBoundingClientRect().height) };
    });
    console.log(`\n=== ${name} ===`, JSON.stringify(r));
    await p.screenshot({ path: `shots/diag-${name}.png`, fullPage: true });
    await p.close();
  }
  await b.close();
})();
