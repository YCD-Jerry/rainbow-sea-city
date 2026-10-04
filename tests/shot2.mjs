import { chromium } from 'playwright-core';
const W = +(process.env.W || 960), Hh = +(process.env.H || 540);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: Hh }, isMobile: !!process.env.MOBILE, hasTouch: !!process.env.MOBILE, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('LOG')) logs.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
if (process.env.RM) await page.emulateMedia({ reducedMotion: 'reduce' });
if (process.env.Q) await page.addInitScript((q) => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify(q)); } catch (e) {} }, process.env.Q);
if (process.env.INITSAVE) await page.addInitScript((v) => { try { localStorage.setItem('rainbow-sea:save', v); } catch (e) {} }, process.env.INITSAVE);
await page.goto('file://' + process.cwd() + '/test.html?debug');
await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 120000 });
const steps = JSON.parse(process.argv[2]);
for (const s of steps) {
  if (s.click) await page.click(s.click);
  if (s.js) await page.evaluate(s.js);
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.shot) await page.screenshot({ path: 'shot_' + s.shot + '.png', timeout: 240000 });
}
console.log(logs.join('\n') || 'no errors');
await browser.close();
