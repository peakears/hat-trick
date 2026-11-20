// Renders assets/images/src/*.svg to 1024px PNGs in assets/images/, keeping transparency.
// Needs Playwright with Chromium (not a project dependency): npx playwright install chromium
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const src = path.join(root, "assets/images/src");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  for (const file of fs.readdirSync(src).filter((f) => f.endsWith(".svg"))) {
    const svg = fs.readFileSync(path.join(src, file), "utf8");
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    const out = path.join(root, "assets/images", file.replace(/\.svg$/, ".png"));
    await page.locator("svg").screenshot({ path: out, omitBackground: true });
    console.log(`wrote ${path.relative(root, out)}`);
  }
  await browser.close();
})();
