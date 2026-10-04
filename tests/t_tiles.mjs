import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
page.setDefaultTimeout(150000);
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify('low')); } catch (e) {} });
await page.goto('file://' + process.cwd() + '/test.html?debug');
await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 200000 });
await page.evaluate(() => document.getElementById('go').click());
await page.waitForTimeout(1200);
for (let k = 0; k < 8; k++) { await page.evaluate(() => { const d = __dbg; d.skipCine(); for (let i = 0; i < 60; i++) d.dlgAdvance(); }); await page.waitForTimeout(1200); if (await page.evaluate(() => !__dbg.overlayName())) break; }
// menu screenshot
await page.keyboard.press('Escape'); await page.waitForTimeout(900);
console.log('quality buttons in menu:', await page.evaluate(() => [...document.querySelectorAll('#menu [data-m="quality"]')].map((b) => b.closest('.mn-side') ? 'sidebar-gear' : 'grid-tile').join(',')));
await page.screenshot({ path: 'menu_after.png' });
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
// tile puzzle overhead view
const info = await page.evaluate(() => { const t = __dbg.puzzles.list.find((p) => p.id === 'tiles'); const tiles = t.debug.tiles; let min = 1e9; for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) min = Math.min(min, Math.hypot(tiles[i].x - tiles[j].x, tiles[i].z - tiles[j].z)); __dbg.setOverlay(null); document.querySelectorAll('.hud').forEach((e) => (e.style.display = 'none')); __dbg.setCam({ p: [t.pos.x + 0.01, t.pos.y + 15, t.pos.z + 0.01], t: [t.pos.x, t.pos.y, t.pos.z], fov: 50 }); return `tile centre spacing ${min.toFixed(2)} (was 2.05)`; });
console.log(info);
await page.waitForTimeout(4000);
await page.screenshot({ path: 'tiles_after.png' });
console.log('gacha banners:', await page.evaluate(() => { __dbg.setOverlay('gacha'); return [...document.querySelectorAll('.gc-tab')].map((t) => t.textContent).join(' | '); }));
console.log('chars:', await page.evaluate(() => { const d = __dbg; d.player.setParty(['silk', 'feather', 'gale', 'ai']); return d.player.party.map((m) => m.def.name).join(','); }));
console.log('errors', JSON.stringify(errs));
await browser.close();
