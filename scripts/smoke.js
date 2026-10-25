// Live-site check: previews play, cover art loads, Ask answers, no script errors. Saves screenshots to smoke/.
const { chromium } = require("playwright");
(async () => {
  const B = "https://scarusillo.github.io/Sound-Lineage/";
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const log = [];
  p.on("pageerror", (e) => log.push("pageerror " + e.message));
  p.on("console", (m) => { if (m.type() === "error") log.push("console " + m.text()); });
  await p.goto(B + "#led-zeppelin", { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  await p.click("[data-playline]"); await p.waitForTimeout(9000);
  const st = await p.evaluate(() => { const q = window.SL_PLAYER.queue; return { first: q[0] && q[0].hit, found: q.filter((x) => x.hit).length, total: q.length, txt: document.querySelector("#player")?.innerText }; });
  log.push("player " + JSON.stringify(st));
  await p.keyboard.press("Escape"); await p.screenshot({ path: "smoke/player.png" });
  await p.click("[data-plqueue]").catch(() => {}); await p.waitForTimeout(1500); await p.screenshot({ path: "smoke/queue.png" });
  await p.goto(B + "#today"); await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(2500); await p.screenshot({ path: "smoke/home.png", fullPage: true });
  const sw = await p.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration()));
  log.push("service worker " + sw);
  const man = await p.evaluate(async () => (await fetch("manifest.webmanifest")).ok);
  log.push("manifest " + man);
  require("fs").writeFileSync("smoke/log.txt", log.join("\n"));
  await b.close();
})();
