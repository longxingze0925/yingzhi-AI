const { chromium } = require("playwright");
async function snap(p, label, file) {
  const r = await p.evaluate(() => {
    let cont=null;
    for (const el of document.querySelectorAll("main div")) {
      const cs = getComputedStyle(el);
      if (cs.columnWidth === "320px" && el.children.length >= 2) { cont = el; break; }
    }
    if (!cont) return { err: "no container" };
    const kids = [...cont.children];
    const cols = {};
    kids.forEach(k => { const r=k.getBoundingClientRect(); const L=Math.round(r.left); (cols[L]=cols[L]||[]).push(Math.round(r.height)); });
    return { count: kids.length, colCount: Object.keys(cols).length, cols, contH: Math.round(cont.getBoundingClientRect().height) };
  });
  console.log(`\n=== ${label} ===`, JSON.stringify(r));
  await p.screenshot({ path: file, fullPage: true });
}
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 2048, height: 1152 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/studio/video", { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  await snap(p, "video-历史(默认)", "shots/v-history.png");
  await p.getByText("示例", { exact: true }).first().click();
  await p.waitForTimeout(700);
  await snap(p, "video-示例", "shots/v-example.png");
  await b.close();
})();
