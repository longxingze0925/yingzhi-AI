const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  for (const theme of ["light", "dark"]) {
    const ctx = await b.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
      colorScheme: theme === "dark" ? "dark" : "light",
    });
    await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch (e) {} }, theme);
    const p = await ctx.newPage();
    await p.goto("http://localhost:3000/studio/explore", { waitUntil: "networkidle" });
    await p.waitForTimeout(1000);
    const tag = theme === "dark" ? "暗" : "亮";
    await p.screenshot({ path: `shots/c-灵感广场${tag}.png` });
    await ctx.close();
  }
  await b.close();
  console.log("done");
})();
