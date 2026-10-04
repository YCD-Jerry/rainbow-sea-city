import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('LOG')) logs.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
page.on('dialog', (d) => d.accept());
await page.addInitScript(() => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify('low')); } catch (e) {} });
await page.goto('file://' + process.cwd() + '/test.html?debug');
await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('go').click());
await page.waitForTimeout(1500);
const R = (s) => console.log(s);
R(await page.evaluate(() => { const d = __dbg; d.skipCine(); for (let i = 0; i < 40; i++) d.dlgAdvance(); return 'story step ' + d.story.step + ' overlay ' + d.overlayName(); }));
// 1. glider: no input -> no horizontal drift, slow sink
R(await page.evaluate(() => {
  const d = __dbg, p = d.player, cam = d.cam; const s = p.pos.clone();
  p.teleport(s.x + 30, s.y + 60, s.z + 10); p.mode = 'glide'; p.vel.set(6, -2, 0);
  const inp = { x: 0, y: 0, sprint: false, jump: false, attack: false, attackHeld: false, skill: false, burst: false, dash: false };
  for (let i = 0; i < 10; i++) p.update(0.05, inp, cam.yaw);   // coast to a stop
  const a = p.pos.clone(); for (let i = 0; i < 40; i++) p.update(0.05, inp, cam.yaw);
  const b = p.pos.clone(); const idle = `idle 2s: horiz ${Math.hypot(b.x - a.x, b.z - a.z).toFixed(2)} m, vy ${p.vel.y.toFixed(2)}, mode ${p.mode}`;
  inp.y = 1; for (let i = 0; i < 40; i++) p.update(0.05, inp, cam.yaw);
  const c = p.pos.clone(); return 'GLIDE ' + idle + ` | W 2s: horiz ${Math.hypot(c.x - b.x, c.z - b.z).toFixed(2)} m, mode ${p.mode}`;
}));
// 2. P quit challenge + restart prompt
R(await page.evaluate(() => {
  const d = __dbg; const pz = d.puzzles.list.find((x) => x.id === 'motes'); const sp = pz.pos; d.player.teleport(sp.x + 1, sp.y + 0.5, sp.z + 1);
  pz.debug.start(); const c1 = d.puzzles.challenge();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', bubbles: true }));
  const shown = !document.getElementById('restartp').hidden, c2 = d.puzzles.challenge();
  return `QUIT challenge before ${c1 && c1.name} after ${c2 && c2.name} prompt ${shown} text "${document.getElementById('rp-t').textContent}"`;
}));
await page.screenshot({ path: 'shot_v13_restart.png' });
R(await page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', key: 't', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', key: 't', bubbles: true })); return 'T pressed, prompt hidden ' + document.getElementById('restartp').hidden + ' overlay ' + __dbg.overlayName(); }));
await page.waitForTimeout(1500);
R(await page.evaluate(() => { const c = __dbg.puzzles.challenge(); return 'RESTARTED challenge ' + (c && c.name); }));
R(await page.evaluate(() => { __dbg.quitChallenge(); return 'quit again prompt ' + !document.getElementById('restartp').hidden; }));
await page.waitForTimeout(4200);
R(await page.evaluate(() => 'after 4.2s prompt hidden ' + document.getElementById('restartp').hidden + ' challenge ' + __dbg.puzzles.challenge()));
// 3. H -> gacha, Esc -> menu
const key = async (code, k) => { await page.keyboard.press(k); await page.waitForTimeout(400); };
await page.evaluate(() => __dbg.setOverlay(null));
await key('KeyH', 'h'); R('H -> ' + await page.evaluate(() => __dbg.overlayName()));
await page.evaluate(() => document.getElementById('gc-free').click());
R(await page.evaluate(() => 'free pulls ' + __dbg.save.freePulls + ' bottle chip ' + document.getElementById('gc-bottle').textContent));
await page.screenshot({ path: 'shot_v13_gacha.png' });
await key('Escape', 'Escape'); R('Esc -> ' + await page.evaluate(() => __dbg.overlayName()));
await key('Escape', 'Escape'); R('Esc -> ' + await page.evaluate(() => __dbg.overlayName()));
await page.screenshot({ path: 'shot_v13_menu.png' });
await key('Escape', 'Escape');
// 4. number edit (coins in the bag)
await page.evaluate(() => { __dbg.setOverlay(null); __dbg.ui.openBag(); });
await page.waitForTimeout(500);
R(await page.evaluate(() => { const b = document.querySelector('#bag-coin [data-edit]'); if (!b) return 'no coin edit button'; b.click(); return 'numedit open ' + !document.getElementById('numedit').hidden + ' value ' + document.getElementById('ne-v').value; }));
await page.screenshot({ path: 'shot_v13_numedit.png' });
R(await page.evaluate(() => { document.getElementById('ne-v').value = '123456'; document.getElementById('ne-ok').click(); return 'coins now ' + __dbg.inv.count('coin') + ' closed ' + document.getElementById('numedit').hidden; }));
// 5. time panel
await page.evaluate(() => __dbg.setOverlay(null));
await page.keyboard.press('t'); await page.waitForTimeout(500);
R('T -> ' + await page.evaluate(() => __dbg.overlayName()));
await page.screenshot({ path: 'shot_v13_time.png' });
R(await page.evaluate(() => { const dn = __dbg.dayNight, t0 = dn.time; const back = dn.skipTo(t0 - 10), far = dn.skipTo(t0 + 2881), ok = dn.skipTo(t0 + 600); for (let i = 0; i < 100; i++) dn.update(0.05); return `skip back ${back} >48h ${far} +10h ${ok} -> moved ${(dn.time - t0).toFixed(0)} min`; }));
// 6. magic square: hit only nearest
R(await page.evaluate(() => {
  const d = __dbg, pz = d.puzzles.list.find((x) => x.id === 'magic'), D = pz.debug; const t = D.tabs[4].grp.position; d.player.teleport(t.x - 1.4, t.y + 0.3, t.z); const before = D.vals.slice();
  const n = d.combat.hitBreakables(t.x - 0.6, t.y + 1, t.z, 3.0, false); const changed = D.vals.map((v, i) => v !== before[i] ? i : -1).filter((i) => i >= 0);
  return `MAGIC strike r=3 hit ${n} changed cells ${changed.join(',')}`;
}));
// 7. reset
await page.evaluate(() => { __dbg.save.puzzles.seal.solved = true; __dbg.inv.add('coin', 5); });
await page.evaluate(() => __dbg.setOverlay('menu')); await page.waitForTimeout(300);
R(await page.evaluate(() => { const b = document.querySelector('#menu [data-m="reset"]') || document.querySelector('[data-m="reset"]'); if (!b) return 'no reset tile: ' + [...document.querySelectorAll('#menu [data-a],#menu button')].map((x) => x.outerHTML.slice(0, 60)).slice(0, 12).join(' | '); b.click(); return 'reset clicked, overlay ' + __dbg.overlayName(); }));
await page.screenshot({ path: 'shot_v13_reset.png' });
R(await page.evaluate(() => 'confirm visible ' + !document.getElementById('confirm').hidden + ' title ' + document.getElementById('cf-title').textContent));
await Promise.all([page.waitForNavigation({ timeout: 120000 }).catch(() => {}), page.evaluate(() => document.getElementById('cf-yes').click())]);
await page.waitForFunction(() => document.getElementById('go') && !document.getElementById('go').disabled, null, { timeout: 180000 }).catch(() => {});
R(await page.evaluate(() => 'after reset keys: ' + Object.keys(localStorage).join(',') + ' save=' + (localStorage.getItem('rainbow-sea:save') || 'null').slice(0, 80)));
console.log(logs.join('\n') || 'no errors');
await browser.close();
