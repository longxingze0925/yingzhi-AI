const { chromium } = require("playwright");
// 注入：把 PageContainer 的 max-w 撑大 + 生成页列宽改 320，测列数
async function test(ctx, w, maxw) {
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/studio/image", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: `
    .mx-auto.max-w-\[1680px\]{ max-width:${maxw}px !important; }
  `});
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const els = Array.from(document.querySelectorAll("main div"));
    for (const el of els) {
      const cs = getComputedStyle(el);
      if (cs.columnWidth === "320px" && el.children.length >= 3) {
        const kids = Array.from(el.children);
        const lefts = [...new Set(kids.map(k=>Math.round(k.getBoundingClientRect().left)))];
        return { contentW: Math.round(el.getBoundingClientRect().width), cols: lefts.length, cardW: Math.round(kids[0].getBoundingClientRect().width) };
      }
    }
    return null;
  });
  await p.close();
  return r;
}
(async () => {
  const b = await chromium.launch();
  for (const w of [1920, 2048, 2560]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 1000 } });
    for (const maxw of [1680, 1760, 1840]) {
      const r = await test(ctx, w, maxw);
      console.log(`viewport=${w}  max-w=${maxw}  =>`, JSON.stringify(r));
    }
    await ctx.close();
  }
  await b.close();
})();
