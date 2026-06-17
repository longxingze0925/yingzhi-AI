const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 2048, height: 1152 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/studio/assets", { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    let cont=null;
    for (const el of document.querySelectorAll("main div")) {
      const cs = getComputedStyle(el);
      if (cs.columnWidth === "320px" && el.children.length >= 2) { cont = el; break; }
    }
    const kids = [...cont.children];
    // 给每张卡按 DOM 顺序编号，记录它落在第几列(按left)、高度
    const lefts = [...new Set(kids.map(k=>Math.round(k.getBoundingClientRect().left)))].sort((a,b)=>a-b);
    const colIndex = (L) => lefts.indexOf(L) + 1;
    const rows = kids.map((k,i) => {
      const r = k.getBoundingClientRect();
      return { domNo: i+1, col: colIndex(Math.round(r.left)), h: Math.round(r.height) };
    });
    // 按列汇总
    const byCol = {};
    rows.forEach(x => { (byCol[x.col]=byCol[x.col]||[]).push(`#${x.domNo}(${x.h}px)`); });
    return { total: kids.length, cols: lefts.length, byCol };
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
