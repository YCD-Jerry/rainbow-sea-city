import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function open(w, h, label) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(150000);
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify('low')); } catch (e) {} });
  await page.goto('file://' + process.cwd() + '/test.html?debug');
  await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 200000 });
  await page.waitForTimeout(800);
  const st = () => page.evaluate(() => ({ rotateHidden: document.getElementById('rotate').hidden, started: document.body.classList.contains('playing') }));
  console.log(label, w + 'x' + h, JSON.stringify(await st()));
  return { page, ctx, errs, st };
}
// portrait phone
const p = await open(390, 844, 'portrait');
await p.page.screenshot({ path: 'mobile_portrait.png', timeout: 120000 });
await p.page.evaluate(() => document.getElementById('rt-auto').click()); await p.page.waitForTimeout(600);
console.log('after auto-landscape tap (should fail gracefully):', JSON.stringify(await p.st()), '|', await p.page.textContent('#rt-msg'));
await p.page.evaluate(() => document.getElementById('rt-stay').click()); await p.page.waitForTimeout(300);
console.log('after "stay portrait":', JSON.stringify(await p.st()));
await p.page.evaluate(() => document.getElementById('go').click()); await p.page.waitForTimeout(1500);
console.log('started in portrait:', JSON.stringify(await p.st()));
// rotate the phone -> landscape resize clears nothing wrongly; portrait again re-shows? (dismissed stays dismissed)
await p.page.setViewportSize({ width: 844, height: 390 }); await p.page.waitForTimeout(500);
console.log('rotated to landscape:', JSON.stringify(await p.st()));
console.log('errors', JSON.stringify(p.errs));
await p.ctx.close();
// landscape phone from the start
const l = await open(844, 390, 'landscape');
await l.page.evaluate(() => document.getElementById('go').click()); await l.page.waitForTimeout(1500);
console.log('started in landscape:', JSON.stringify(await l.st()));
// portrait -> landscape without dismiss
const q = await open(390, 844, 'portrait#2');
await q.page.setViewportSize({ width: 844, height: 390 }); await q.page.waitForTimeout(500);
console.log('portrait#2 rotated to landscape (prompt should vanish):', JSON.stringify(await q.st()));
// computed tap highlight
console.log('tap highlight on #dialog:', await q.page.evaluate(() => getComputedStyle(document.getElementById('dialog')).webkitTapHighlightColor));
console.log('errors', JSON.stringify([...l.errs, ...q.errs]));
await browser.close();
