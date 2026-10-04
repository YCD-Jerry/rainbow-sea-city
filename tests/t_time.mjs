import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(120000);
await page.addInitScript(() => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify('low')); } catch (e) {} });
await page.goto('file://' + process.cwd() + '/test.html?debug');
await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 200000 });
await page.evaluate(() => document.getElementById('go').click());
await page.waitForTimeout(1200);
for (let k = 0; k < 8; k++) { await page.evaluate(() => { const d = __dbg; d.skipCine(); for (let i = 0; i < 60; i++) d.dlgAdvance(); }); await page.waitForTimeout(1200); if (await page.evaluate(() => !__dbg.overlayName())) break; }
const measure = (label) => page.evaluate((label) => {
  const r = (el) => { const b = el.getBoundingClientRect(); return `x=${b.x.toFixed(1)} w=${b.width.toFixed(1)}`; };
  const box = document.querySelector('.tp-box');
  return `${label}: dial ${r(document.querySelector('.tp-dial'))} | arc ${r(document.getElementById('tp-arc'))} d="${document.getElementById('tp-arc').getAttribute('d')}" | box scrollbar=${box.scrollHeight > box.clientHeight} offW-clientW=${box.offsetWidth - box.clientWidth} | plus="${document.getElementById('tp-plus').textContent}" | overlay=${__dbg.overlayName()}`;
}, label);
async function run(path) {
  await page.evaluate(() => { __dbg.setOverlay(null); });
  await page.waitForTimeout(300);
  if (path === 'menu') { await page.keyboard.press('Escape'); await page.waitForTimeout(700); await page.evaluate(() => document.querySelector('#menu [data-m="time"]').click()); }
  else { await page.keyboard.press('KeyT'); }
  console.log(path, 'overlay after open:', await page.evaluate(() => __dbg.overlayName()), 'timep hidden:', await page.evaluate(() => document.getElementById('timep').hidden));
  await page.waitForTimeout(400);
  console.log(await measure(path + ' opened'));
  for (let i = 0; i < 26; i++) await page.evaluate(() => document.querySelector('#tp-fine [data-m="60"]').click());
  console.log(await measure(path + ' +26h'));
  for (let i = 0; i < 24; i++) await page.evaluate(() => document.querySelector('#tp-fine [data-m="60"]').click());
  console.log(await measure(path + ' +50h(max)'));
  await page.screenshot({ path: `time_${path}.png` });
}
await run('key');
await run('menu');
await browser.close();
