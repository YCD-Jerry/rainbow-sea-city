import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 873, height: 393 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const page = await ctx.newPage(); page.setDefaultTimeout(150000);
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify('low')); } catch (e) {} });
await page.goto('file://' + process.cwd() + '/test.html?debug');
await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 200000 });
await page.evaluate(() => document.getElementById('go').click());
await page.waitForTimeout(1200);
for (let k = 0; k < 8; k++) { await page.evaluate(() => { const d = __dbg; d.skipCine(); for (let i = 0; i < 60; i++) d.dlgAdvance(); }); await page.waitForTimeout(1200); if (await page.evaluate(() => !__dbg.overlayName())) break; }
await page.evaluate(() => { const d = __dbg; d.setOverlay(null); document.body.classList.remove('talking', 'cine'); d.setOverlay('gacha'); document.getElementById('gc-free').click(); document.getElementById('gc-10').click(); });
const AUD = () => { const W = innerWidth, H = innerHeight, bad = []; for (const id of ['gacha-play', 'gp-reveal', 'gp-summary']) { const r0 = document.getElementById(id); if (!r0 || r0.hidden) continue; for (const el of r0.querySelectorAll('*')) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue; const r = el.getBoundingClientRect(); if (r.width < 6 || r.height < 6) continue; const off = r.right > W + 2 || r.bottom > H + 2 || r.left < -2 || r.top < -2; if (off && el.tagName !== 'IMG' && (el.tagName === 'BUTTON' || el.children.length === 0)) bad.push(`${id}>${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 8)}" [${r.left | 0},${r.top | 0}..${r.right | 0},${r.bottom | 0}]`); } } return { vis: ['gacha-play', 'gp-reveal', 'gp-summary'].filter((id) => document.getElementById(id) && !document.getElementById(id).hidden), bad: bad.slice(0, 5) }; };
let shots = 0, seenSummary = false;
for (let i = 0; i < 40 && !seenSummary; i++) {
  await page.waitForTimeout(1200);
  const a = await page.evaluate(`(${AUD.toString()})()`);
  if (a.vis.includes('gp-reveal') && shots < 2) { await page.screenshot({ path: `rv_${shots++}.png`, timeout: 120000 }); }
  if (a.vis.includes('gp-summary')) { seenSummary = true; await page.screenshot({ path: 'rv_summary.png', timeout: 120000 }); }
  if (a.vis.length) console.log(i, JSON.stringify(a));
  await page.evaluate(() => { const r = document.getElementById('gp-reveal'); if (r && !r.hidden) r.click(); });
}
console.log('summary reached:', seenSummary, 'errors', JSON.stringify(errs));
await browser.close();
