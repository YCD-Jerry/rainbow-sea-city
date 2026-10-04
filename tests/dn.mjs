import { chromium } from 'playwright-core';
const W = 960, Hh = 540;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: Hh }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('LOG')) logs.push(m.text().slice(0, 400)); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.addInitScript(() => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify('mid')); } catch (e) {} });
await page.goto('file://' + process.cwd() + '/test.html?debug');
await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('go').click());
await page.waitForTimeout(1500);
await page.evaluate(() => { const d = window.__dbg; d.skipCine && d.skipCine(); for (let i = 0; i < 40; i++) d.dlgAdvance && d.dlgAdvance(); });
const views = JSON.parse(process.argv[2]);
for (const v of views) {
  const info = await page.evaluate((v) => {
    const d = window.__dbg, P = d.player.pos || d.player.group.position;
    d.dayNight.time = v.time; d.dayNight.apply();
    if (v.cam) { const p = [P.x + v.cam[0], P.y + v.cam[1], P.z + v.cam[2]], t = [P.x + v.tg[0], P.y + v.tg[1], P.z + v.tg[2]]; d.setCam({ p, t, fov: v.fov || 60 }); }
    else d.setCam(null);
    if (v.hud === false) { if (!document.getElementById('hidehud')) { const st = document.createElement('style'); st.id = 'hidehud'; st.textContent = 'body > *:not(#stage){visibility:hidden !important}'; document.head.appendChild(st); } }
    else { const st = document.getElementById('hidehud'); if (st) st.remove(); }
    if (v.js) eval(v.js);
    return [P.x.toFixed(0), P.y.toFixed(0), P.z.toFixed(0), d.dayNight.p.night.toFixed(2), d.dayNight.lightDir.toArray().map((x) => x.toFixed(2)).join(','), d.overlayName()].join(' ');
  }, v);
  console.log(v.name, info);
  await page.waitForTimeout(+(process.env.WAIT || 3000));
  await page.screenshot({ path: 'shot_' + v.name + '.png', timeout: 240000 });
}
console.log(logs.join('\n') || 'no errors');
await browser.close();
