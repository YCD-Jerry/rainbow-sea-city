import { chromium } from 'playwright-core';
const which = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.setDefaultTimeout(120000);
await page.addInitScript(() => { try { localStorage.setItem('rainbow-sea:quality', JSON.stringify('mid')); } catch (e) {} });
await page.goto('file://' + process.cwd() + '/' + which + '?debug');
await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 200000 });
await page.evaluate(() => document.getElementById('go').click());
await page.waitForTimeout(1200);
for (let k = 0; k < 8; k++) { await page.evaluate(() => { const d = __dbg; d.skipCine(); for (let i = 0; i < 60; i++) d.dlgAdvance(); }); await page.waitForTimeout(1500); if (await page.evaluate(() => !__dbg.overlayName() && !document.body.classList.contains('cine'))) break; }
await page.evaluate(() => {
  const d = __dbg; d.setOverlay(null); document.body.classList.remove('talking', 'cine'); const c = document.getElementById('cine'); if (c) c.hidden = true;
  document.querySelectorAll('.hud').forEach((e) => (e.style.display = 'none'));
  const water = d.scene.getObjectByName('water'); const SM = water.material.constructor, Mesh = water.constructor, PG = water.geometry.constructor;
  const mat = new SM({
    uniforms: { uZero: { value: 0 } }, depthTest: false, depthWrite: false, side: 2,
    vertexShader: 'void main(){ gl_Position = vec4(position.x > 0.0 ? 0.12 : 0.10, position.z > 0.0 ? 0.12 : 0.10, 0.0, 1.0); }',
    fragmentShader: 'uniform float uZero; void main(){ float n = uZero / uZero; gl_FragColor = vec4(n, n, n, 1.0); }',
  });
  const geo = new PG(2, 2, 1, 1); geo.rotateX(-Math.PI / 2);
  const m = new Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 999; d.scene.add(m);
});
await page.waitForTimeout(6000);
await page.screenshot({ path: `nan2_${which.replace('.html', '')}.png`, timeout: 120000 });
console.log('done', which);
await browser.close();
