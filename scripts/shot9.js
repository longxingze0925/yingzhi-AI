const { chromium } = require("playwright");

const urls = ["/studio/image", "/studio/video", "/studio/assets"];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });

  for (const u of urls) {
    const p = await ctx.newPage();
    const errors = [];
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    p.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

    await p.goto("http://localhost:3000" + u, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);

    const hydration = errors.filter((e) => /hydrat|did not match|server.*client/i.test(e));
    console.log(`\n### ${u}`);
    console.log(`  console.error 数: ${errors.length}, hydration 相关: ${hydration.length}`);
    if (hydration.length) hydration.forEach((e) => console.log("  ⚠ " + e.slice(0, 160)));
    if (errors.length && !hydration.length)
      errors.slice(0, 3).forEach((e) => console.log("  · " + e.slice(0, 140)));

    const tag = u.split("/").pop();
    await p.screenshot({ path: `shots/demo-${tag}.png` });
    await p.close();
  }

  await b.close();
  console.log("\ndone");
})();
