import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.addInitScript(() => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify('low')); } catch (e) {} });
await page.goto('file://' + process.cwd() + '/test.html?debug');
await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('go').click());
await page.waitForTimeout(1500);
const R = (s) => console.log(s);
R(await page.evaluate(() => { const d = __dbg; d.skipCine(); for (let i = 0; i < 40; i++) d.dlgAdvance(); d.setOverlay(null); return 'overlay ' + d.overlayName(); }));
// --- A. warden vs trees: spawn ground must ignore tree tops; walk it hard through the forest around its camp
R(await page.evaluate(() => {
  const d = __dbg, c = d.combat;
  const ws = c.enemies.filter((e) => e.isWarden);
  const out = [];
  for (const w of ws) {
    const trees = d.colliders.list.filter((t) => t.tag === 'tree' && Math.hypot(t.x - w.pos.x, t.z - w.pos.z) < 40);
    out.push(`warden@${w.pos.x.toFixed(0)},${w.pos.z.toFixed(0)} y=${w.pos.y.toFixed(2)} H=${d.H(w.pos.x, w.pos.z).toFixed(2)} nearTrees=${trees.length}`);
  }
  return out.join(' | ');
}));
// Stress: for every tree near each warden, place the warden next to it at ground level and push it across the trunk with a huge step
R(await page.evaluate(() => {
  const d = __dbg, c = d.combat; let maxLift = 0, tested = 0, hopped = 0;
  for (const w of c.enemies.filter((e) => e.isWarden)) {
    const trees = d.colliders.list.filter((t) => t.tag === 'tree' && Math.hypot(t.x - w.pos.x, t.z - w.pos.z) < 45);
    for (const t of trees) {
      const gx = t.x - 3, gz = t.z; const gy = d.H(gx, gz);
      if (gy < 0) continue;
      w.bounds = null; w.pos.set(gx, gy, gz); w.state = 'chase'; tested++;
      for (let i = 0; i < 30; i++) { w.tryMove(0.25, 0, c.W); w.settle(0.1, c.W); }
      for (let i = 0; i < 4; i++) { w.tryMove(1.6, 0, c.W); w.settle(0.1, c.W); }  // slow-frame charge step
      maxLift = Math.max(maxLift, w.pos.y - d.H(w.pos.x, w.pos.z));
      if (w.pos.x > t.x + 0.3) { hopped++; if (hopped <= 4) window.__hop = (window.__hop || []).concat([`tree ${t.type} r=${t.r} top=${(t.top - gy).toFixed(2)} bot=${(t.bottom - gy).toFixed(2)} rel=${(t.z - gz).toFixed(2)} endx=${(w.pos.x - t.x).toFixed(2)} endY=${(w.pos.y - gy).toFixed(2)}`]); }
    }
  }
  return `TREE-STRESS tested ${tested} trees, max lift above terrain ${maxLift.toFixed(2)} m, hopped past trunk ${hopped}`;
}));
// --- B. pointer-lock fallback: simulate refused lock attempts
R(await page.evaluate(() => {
  const cv = __dbg.renderer.domElement;
  let calls = 0; cv.requestPointerLock = () => { calls++; setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0); };
  // soft re-lock after Alt, refused: must NOT disable locking
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'AltLeft', key: 'Alt', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'AltLeft', key: 'Alt', bubbles: true }));
  return 'alt cycle done, lock calls ' + calls;
}));
await page.waitForTimeout(100);
R(await page.evaluate(() => new Promise((res) => {
  const cv = __dbg.renderer.domElement; let calls = 0;
  cv.requestPointerLock = () => { calls++; };   // now a click is allowed to lock (no error)
  cv.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerType: 'mouse', bubbles: true, clientX: 100, clientY: 100, pointerId: 1 }));
  res('click after refused soft-lock -> requestPointerLock called ' + calls + ' time(s) (1 = recovered)');
})));
console.log('HOP', JSON.stringify(await page.evaluate(() => window.__hop)));
console.log('LOGS', JSON.stringify(logs));
await browser.close();
