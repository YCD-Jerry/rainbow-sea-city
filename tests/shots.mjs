// usage: node shots.mjs '<json [{name,p,t,fov}]>'  -> shot_<name>.png  (hud hidden, game camera overridden)
import { chromium } from 'playwright-core';
const W = +(process.env.W || 960), Hh = +(process.env.H || 540);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: Hh }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('LOG')) logs.push(m.text().slice(0, 400)); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.addInitScript((q) => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify(q)); } catch (e) {} }, process.env.Q || 'mid');
await page.goto('file://' + process.cwd() + '/test.html?debug');
await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('go').click());
await page.waitForTimeout(1500);
await page.evaluate(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(#stage){visibility:hidden !important}'; document.head.appendChild(st); });
if (process.env.JS) await page.evaluate(process.env.JS);
const views = JSON.parse(process.argv[2]);
for (const v of views) {
  await page.evaluate((v) => {
    if (v.pz) { const o = window.__dbg.puzzles.list.find((p) => p.id === v.pz).pos; v.p = [o.x + v.p[0], o.y + v.p[1], o.z + v.p[2]]; v.t = [o.x + v.t[0], o.y + v.t[1], o.z + v.t[2]]; }
    if (v.rel === 'dent') { const o = window.__dbg.dent.pos; v.p = [o.x + v.p[0], o.y + v.p[1], o.z + v.p[2]]; v.t = [o.x + v.t[0], o.y + v.t[1], o.z + v.t[2]]; }
    if (v.lot !== undefined) {
      const L = window.__dbg.cityPlan.lots[v.lot], d = v.dist || 26, a = L.rot + (v.ang || 0.5);
      v.p = [L.x + Math.sin(a) * d, L.y + (v.h || 7), L.z + Math.cos(a) * d]; v.t = [L.x, L.y + (v.th || 4), L.z];
    }
    window.__dbg.setCam({ p: v.p, t: v.t, fov: v.fov || 55 });
  }, v);
  await page.waitForTimeout(+(process.env.WAIT || 2500));
  await page.screenshot({ path: 'shot_' + v.name + '.png', timeout: 240000 });
}
console.log(logs.join('\n') || 'no errors');
await browser.close();
