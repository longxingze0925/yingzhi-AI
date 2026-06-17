const { chromium } = require("playwright");

const pages = [
  { path: "/login", name: "登录" },
  { path: "/studio/explore", name: "灵感广场" },
  { path: "/studio/assets", name: "我的作品" },
  { path: "/studio/library", name: "素材库" },
];

(async () => {
  const b = await chromium.launch();

  for (const theme of ["light", "dark"]) {
    const ctx = await b.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
      colorScheme: theme === "dark" ? "dark" : "light",
    });
    // 注入 next-themes 的存储键，确保主题确定
    await ctx.addInitScript((t) => {
      try { localStorage.setItem("theme", t); } catch (e) {}
    }, theme);

    let i = 1;
    for (const pg of pages) {
      const p = await ctx.newPage();
      await p.goto("http://localhost:3000" + pg.path, { waitUntil: "networkidle" });
      await p.waitForTimeout(1000);
      const tag = theme === "dark" ? "暗" : "亮";
      await p.screenshot({ path: `shots/b${i}-${pg.name}${tag}.png`, fullPage: true });
      await p.close();
      i++;
    }
    await ctx.close();
  }

  await b.close();
  console.log("done");
})();
