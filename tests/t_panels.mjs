import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const [w, h] = (process.argv[2] || '873x393').split('x').map(Number);
const only = process.argv[3] ? process.argv[3].split(',') : null;
const shot = process.argv[4] === 'shot';
const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const page = await ctx.newPage(); page.setDefaultTimeout(150000);
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify('low')); } catch (e) {} });
await page.goto('file://' + process.cwd() + '/test.html?debug');
await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 200000 });
await page.evaluate(() => document.getElementById('go').click());
await page.waitForTimeout(1200);
for (let k = 0; k < 8; k++) { await page.evaluate(() => { const d = __dbg; d.skipCine(); for (let i = 0; i < 60; i++) d.dlgAdvance(); }); await page.waitForTimeout(1200); if (await page.evaluate(() => !__dbg.overlayName())) break; }
await page.evaluate(() => { const d = __dbg; d.setOverlay(null); document.body.classList.remove('talking', 'cine'); d.player.setParty(['silk', 'feather', 'gale', 'ai']); });
await page.waitForTimeout(1500);

// panel openers: each returns the root element id(s) to examine
const PANELS = {
  menu: () => __dbg.setOverlay('menu'),
  map: () => __dbg.setOverlay('map'),
  bag: () => document.getElementById('btn-bag').click(),
  chars: () => __dbg.setOverlay('chars'),
  help: () => __dbg.setOverlay('help'),
  achv: () => __dbg.setOverlay('achv'),
  gacha: () => __dbg.setOverlay('gacha'),
  'gacha-detail': () => { __dbg.setOverlay('gacha'); const b = [...document.querySelectorAll('#gacha button')].find((x) => x.textContent.trim() === '详情'); b && b.click(); },
  'gacha-record': () => { __dbg.setOverlay('gacha'); const b = [...document.querySelectorAll('#gacha button')].find((x) => x.textContent.trim() === '记录'); b && b.click(); },
  timep: () => __dbg.setOverlay('timep'),
  confirm: () => __dbg.setOverlay('confirm'),
  domain: () => __dbg.setOverlay('domain'),
  dreward: () => __dbg.setOverlay('dreward'),
  dfail: () => __dbg.setOverlay('dfail'),
  restartp: () => { document.getElementById('restartp').hidden = false; },
  numedit: () => { document.getElementById('numedit').hidden = false; },
  death: () => { document.getElementById('death').hidden = false; },
  mapcard: () => { __dbg.setOverlay('map'); document.getElementById('mapcard').hidden = false; },
};
const AUDIT = () => {
  const W = innerWidth, H = innerHeight, bad = [];
  const roots = [...document.querySelectorAll('body > *')].filter((e) => !e.hidden && getComputedStyle(e).display !== 'none' && ['fixed', 'absolute'].includes(getComputedStyle(e).position) && +getComputedStyle(e).zIndex >= 20);
  const clipped = (el, root) => { let p = el.parentElement; while (p && p !== root.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY) && p !== el) return true; p = p.parentElement; } return false; };
  for (const root of roots) {
    if (['start', 'rotate', 'hud'].includes(root.id)) continue;
    for (const el of root.querySelectorAll('*')) {
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
      const isBtn = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button';
      const off = r.right > W + 2 || r.bottom > H + 2 || r.left < -2 || r.top < -2;
      if (off && !clipped(el, root) && (isBtn || el.children.length === 0 || r.width > W)) bad.push(`${root.id}>${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${(el.className + '').split(' ')[0]} "${(el.textContent || '').trim().slice(0, 10)}" [${r.left.toFixed(0)},${r.top.toFixed(0)}..${r.right.toFixed(0)},${r.bottom.toFixed(0)}]`);
    }
    // is there a reachable close / back control?
    const closers = [...root.querySelectorAll('button, [role=button]')].filter((b) => /关闭|返回|×|✕|✖|退出|继续|确认|离开|取消|知道|ok/i.test((b.getAttribute('aria-label') || '') + (b.textContent || '')) || /close|back|x/.test(b.id + ' ' + b.className));
    const reach = closers.filter((b) => { const r = b.getBoundingClientRect(), cs = getComputedStyle(b); if (cs.display === 'none' || r.width < 2) return false; const cx = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(H - 1, Math.max(0, r.top + r.height / 2)); const hit = document.elementFromPoint(cx, cy); return r.left >= -2 && r.right <= W + 2 && r.top >= -2 && r.bottom <= H + 2 && hit && (b === hit || b.contains(hit)); });
    root.__info = `${root.id}: closers ${closers.length}, reachable ${reach.length}`;
    bad.unshift(root.__info);
  }
  return bad;
};
for (const [name, open] of Object.entries(PANELS)) {
  if (only && !only.includes(name)) continue;
  await page.evaluate(() => { __dbg.setOverlay(null); for (const id of ['restartp', 'numedit', 'death', 'mapcard', 'gc-modal', 'gp-reveal', 'gp-summary', 'bag']) { const e = document.getElementById(id); if (e) e.hidden = true; } __dbg.ui && (__dbg.ui.bagOpen = false); });
  await page.waitForTimeout(250);
  try { await page.evaluate(`(${PANELS[name].toString()})()`); } catch (e) { console.log(name, 'open error', e.message.slice(0, 80)); continue; }
  await page.waitForTimeout(700);
  const out = await page.evaluate(`(${AUDIT.toString()})()`);
  const issues = out.filter((l) => l.includes('['));
  console.log(`== ${name}: ${issues.length} off-screen items | ${out.filter((l) => !l.includes('[')).join(' ; ') || 'no panel root found'}`);
  issues.slice(0, 6).forEach((l) => console.log('   ' + l));
  if (shot) await page.screenshot({ path: `panel_${name}_${w}x${h}.png`, timeout: 120000 });
}
console.log('errors', JSON.stringify(errs));
await browser.close();
