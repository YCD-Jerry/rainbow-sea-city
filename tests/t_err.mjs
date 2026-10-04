import { chromium } from 'playwright-core';
const q = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
page.setDefaultTimeout(120000);
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 240)); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.addInitScript((q) => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify(q)); } catch (e) {} }, q);
await page.goto('file://' + process.cwd() + '/test.html?debug');
await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 200000 });
await page.evaluate(() => document.getElementById('go').click());
await page.waitForTimeout(5000);
for (const t of [360, 720, 1080, 1320]) { await page.evaluate((t) => { __dbg.dayNight.time = t; __dbg.dayNight.apply(); }, t); await page.waitForTimeout(2500); }
console.log(q, 'logs:', JSON.stringify(logs.slice(0, 6)));
await browser.close();
