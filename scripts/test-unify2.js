const { chromium } = require("playwright");
async function test(ctx, w, maxw) {
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/studio/image", { waitUntil: "networkidle" });
  await p.waitForTimeout(300);
  const r = await p.evaluate((maxw) => {
    // 找 PageContainer 元素（含 mx-auto + max-w-[1680px]）
    const pc = document.querySelector('main .mx-auto');
    if (pc) pc.style.maxWidth = maxw + "px";
    // 量生成页 320 列容器
    const els = Array.from(document.querySelectorAll("main div"));
    for (const el of els) {
      const cs = getComputedStyle(el);
      if (cs.columnWidth === "320px" && el.children.length >= 3) {
        const kids = Array.from(el.children);
        const lefts = [...new Set(kids.map(k=>Math.round(k.getBoundingClientRect().left)))];
        return { pcW: pc ? Math.round(pc.getBoundingClientRect().width) : null, contentW: Math.round(el.getBoundingClientRect().width), cols: lefts.length, cardW: Math.round(kids[0].getBoundingClientRect().width) };
      }
    }
    return null;
  }, maxw);
  await p.close();
  return r;
}
(async () => {
  const b = await chromium.launch();
  for (const w of [1920, 2048, 2560]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 1000 } });
    for (const maxw of [1680, 1760, 1920]) {
      console.log(`viewport=${w}  max-w=${maxw}  =>`, JSON.stringify(await test(ctx, w, maxw)));
    }
    await ctx.close();
  }
  await b.close();
})();
