import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sizes = (process.argv[2] || '873x393').split(',').map((s) => s.split('x').map(Number));
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(150000);
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify('low')); } catch (e) {} });
  await page.goto('file://' + process.cwd() + '/test.html?debug');
  await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 200000 });
  await page.evaluate(() => document.getElementById('go').click());
  await page.waitForTimeout(1200);
  for (let k = 0; k < 8; k++) { await page.evaluate(() => { const d = __dbg; d.skipCine(); for (let i = 0; i < 60; i++) d.dlgAdvance(); }); await page.waitForTimeout(1200); if (await page.evaluate(() => !__dbg.overlayName())) break; }
  await page.evaluate(() => { const d = __dbg; d.setOverlay(null); document.body.classList.remove('talking', 'cine'); d.player.setParty(['silk', 'feather', 'gale', 'ai']); d.syncModels && d.syncModels(); });
  await page.waitForTimeout(2500);
  const rects = await page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)].filter((e) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && e.getBoundingClientRect().width > 0; });
    const out = [];
    const add = (name, els) => els.forEach((e, i) => { const r = e.getBoundingClientRect(); out.push({ name: name + (els.length > 1 ? i : ''), x: r.left, y: r.top, w: r.width, h: r.height }); });
    add('attack', q('#tatk')); add('jump', q('#tjump')); add('skillE', q('#sk-e')); add('burstQ', q('#sk-q')); add('sprint', q('#tsprint')); add('aim', q('#taim'));
    add('party', q('#party .pm')); add('topbtn', q('#topbar > *')); add('joy', q('#joy')); add('minimap', q('#minimap-wrap')); add('quest', q('#quest')); add('hp', q('#hpwrap'));
    return out;
  });
  const hit = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 1 && oy > 1) hit.push(`${a.name} x ${b.name} (${ox.toFixed(0)}x${oy.toFixed(0)})`);
  }
  const R = Object.fromEntries(rects.map((r) => [r.name, `${r.w.toFixed(0)}px @ ${(w - r.x - r.w).toFixed(0)}r,${(h - r.y - r.h).toFixed(0)}b`]));
  console.log(`${w}x${h}: sizes`, JSON.stringify({ attack: R.attack, jump: R.jump, E: R.skillE, Q: R.burstQ, sprint: R.sprint, party0: R.party0, joy: R.joy }));
  console.log(`${w}x${h}: overlaps ->`, hit.length ? hit.join('; ') : 'none');
  await page.screenshot({ path: `hud_${w}x${h}.png`, timeout: 150000 });
  if (w === 873) {
    // floating stick: drag with a real touch away from the stick's resting place
    const cdp = await ctx.newCDPSession(page);
    const T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await T('touchStart', 250, 170); await T('touchMove', 290, 170); await page.waitForTimeout(150);
    console.log('floating stick during touch:', await page.evaluate(() => { const j = document.getElementById('joy'); const r = j.getBoundingClientRect(); return `centre ${(r.left + r.width / 2).toFixed(0)},${(r.top + r.height / 2).toFixed(0)} on=${j.classList.contains('on')} knob=${document.getElementById('knob').style.transform}`; }));
    await page.screenshot({ path: 'hud_stick.png', timeout: 150000 });
    await T('touchEnd'); await page.waitForTimeout(150);
    console.log('after release:', await page.evaluate(() => { const j = document.getElementById('joy'); return `inline left='${j.style.left}' top='${j.style.top}' on=${j.classList.contains('on')} knob='${document.getElementById('knob').style.transform}'`; }));
  }
  console.log('errors', JSON.stringify(errs));
  await ctx.close();
}
await browser.close();
