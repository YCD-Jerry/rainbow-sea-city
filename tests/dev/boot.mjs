import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const logs = []; page.on('console', (m) => logs.push(m.type() + ': ' + m.text().slice(0, 300))); page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + (e.stack || '').slice(0, 600)));
await page.addInitScript(() => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify('low')); } catch (e) {} });
await page.goto('file://' + process.cwd() + '/test.html?debug');
try { await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 150000 }); console.log('booted'); } catch (e) { console.log('boot timeout'); }
console.log(await page.evaluate(() => document.querySelector('#load-msg, .load-msg, #start p')?.textContent || ''));
console.log(logs.slice(-25).join('\n'));
await browser.close();
