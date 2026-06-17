const { chromium } = require("playwright");
// 测量某页第一行卡片数量与卡片宽度
async function measure(ctx, url) {
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000" + url, { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  const data = await p.evaluate(() => {
    const main = document.querySelector("main") || document.body;
    // 找瀑布流容器：含多个直接子卡片、且 columns 或 grid
    // 收集页面中所有“卡片”候选：有 GradientThumb 的最近块
    const cards = Array.from(document.querySelectorAll("main *")).filter(el => {
      const cs = getComputedStyle(el);
      return false; // placeholder
    });
    // 改为：取主区里所有元素，找出 top 最小那批（第一行）的、宽度相近的卡片
    const all = Array.from(document.querySelectorAll("main img, main [style*='background-image'], main [style*='gradient']"));
    return { mainW: main.getBoundingClientRect().width, n: all.length };
  });
  await p.close();
  return data;
}
(async () => {
  const b = await chromium.launch();
  const widths = [1707, 1920, 2048, 2560];
  for (const w of widths) {
    const ctx = await b.newContext({ viewport: { width: w, height: 1000 } });
    for (const url of ["/studio/explore", "/studio/image"]) {
      const p = await ctx.newPage();
      await p.goto("http://localhost:3000" + url, { waitUntil: "networkidle" });
      await p.waitForTimeout(600);
      const r = await p.evaluate(() => {
        // 找列容器：computed columnWidth/ columnCount 非 auto/normal 的元素
        const els = Array.from(document.querySelectorAll("main div"));
        let colInfo = null, container = null;
        for (const el of els) {
          const cs = getComputedStyle(el);
          if ((cs.columnWidth && cs.columnWidth !== "auto") || (cs.columnCount && cs.columnCount !== "auto")) {
            if (el.children.length >= 3) { colInfo = { columnWidth: cs.columnWidth, columnCount: cs.columnCount, gap: cs.columnGap, w: el.getBoundingClientRect().width, kids: el.children.length }; container = el; break; }
          }
        }
        // 若是 grid
        let gridInfo = null;
        for (const el of els) {
          const cs = getComputedStyle(el);
          if (cs.display === "grid" && cs.gridTemplateColumns.split(" ").length >= 2 && el.children.length >= 2) {
            gridInfo = { cols: cs.gridTemplateColumns.split(" ").length, template: cs.gridTemplateColumns.slice(0,60), w: el.getBoundingClientRect().width };
            break;
          }
        }
        // 实测第一行卡片数：取直接子元素，按 offsetTop 分组
        let firstRow = null, cardW = null;
        if (container) {
          const kids = Array.from(container.children);
          // columns 布局下子元素分布在各列，用 getBoundingClientRect().left 唯一值数列
          const lefts = [...new Set(kids.map(k => Math.round(k.getBoundingClientRect().left)))].sort((a,b)=>a-b);
          firstRow = lefts.length;
          cardW = Math.round(kids[0].getBoundingClientRect().width);
        }
        return { colInfo, gridInfo, firstRow, cardW };
      });
      console.log(`w=${w}  ${url.padEnd(16)} =>`, JSON.stringify(r));
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
})();
