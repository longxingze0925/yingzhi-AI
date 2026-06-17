const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 2048, height: 1152 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/studio/video", { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  // 点「示例」tab
  await p.getByText("示例", { exact: true }).first().click();
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    let cont=null;
    for (const el of document.querySelectorAll("main div")) {
      const cs = getComputedStyle(el);
      if (cs.columnWidth === "320px" && el.children.length >= 2) { cont = el; break; }
    }
    if (!cont) return { err: "no container" };
    const kids = [...cont.children];
    const cards = kids.map(k => {
      const r = k.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), top: Math.round(r.top) };
    });
    // 按 left 分列
    const cols = {};
    cards.forEach(c => { (cols[c.left] = cols[c.left]||[]).push(c.h); });
    return { count: kids.length, cols, contH: Math.round(cont.getBoundingClientRect().height) };
  });
  console.log(JSON.stringify(r, null, 0));
  await p.screenshot({ path: "shots/diag-video-example.png", fullPage: true });
  await b.close();
})();
