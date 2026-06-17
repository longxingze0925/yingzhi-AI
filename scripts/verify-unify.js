const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 2048, height: 1152 }, deviceScaleFactor: 1 });
  const out = {};
  for (const [url, name] of [["/studio/image","image"],["/studio/explore","explore"]]) {
    const p = await ctx.newPage();
    await p.goto("http://localhost:3000" + url, { waitUntil: "networkidle" });
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      for (const el of document.querySelectorAll("main div")) {
        const cs = getComputedStyle(el);
        if (cs.columnWidth === "320px" && el.children.length >= 3) {
          const kids = [...el.children];
          const lefts = [...new Set(kids.map(k=>Math.round(k.getBoundingClientRect().left)))];
          return { colW: cs.columnWidth, cols: lefts.length, cardW: Math.round(kids[0].getBoundingClientRect().width) };
        }
      }
      return null;
    });
    out[name] = r;
    await p.screenshot({ path: `shots/final-${name}.png` });
    await p.close();
  }
  console.log(JSON.stringify(out, null, 0));
  await b.close();
})();
