import { HB } from './terrain.js';

export const MB = { x0: -560, x1: 600, z0: -1080, z1: 200 };
const PPM = 1.4; // base map pixels per metre

// Map icons follow the Genshin look: dark navy badge, white outline, bright core.
const ICON_SVG = {
  quest: `<svg viewBox="0 0 32 32"><path d="M16 2 L30 16 L16 30 L2 16 Z" fill="#ffcf5a" stroke="#fff6dc" stroke-width="2"/><path d="M16 8.5 V18.5" stroke="#5a3a08" stroke-width="3.4" stroke-linecap="round"/><circle cx="16" cy="23.5" r="2" fill="#5a3a08"/></svg>`,
  wp: `<svg viewBox="0 0 32 32"><path d="M16 1.5 L27 16 L16 30.5 L5 16 Z" fill="#26334a" stroke="#ffffff" stroke-width="2"/><path d="M16 7 L22.5 16 L16 25 L9.5 16 Z" fill="#3b4f6e"/><path d="M16 10.5 L20 16 L16 21.5 L12 16 Z" fill="#7ff3ff"/><path d="M16 10.5 L20 16 L16 16 Z" fill="#d8fdff"/></svg>`,
  statue: `<svg viewBox="0 0 32 32"><rect x="2.5" y="2.5" width="27" height="27" rx="7" fill="#26334a" stroke="#ffffff" stroke-width="2"/><circle cx="16" cy="10" r="3.4" fill="#ffe08a"/><path d="M10.5 26 L12.5 15.5 C14 14 18 14 19.5 15.5 L21.5 26 Z" fill="#e9d7a8"/><path d="M8 18 C10 15 12 15 13 16 M24 18 C22 15 20 15 19 16" stroke="#e9d7a8" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
  camp: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13.5" fill="#5b2626" stroke="#ffffff" stroke-width="2"/><path d="M9 10 L12.5 15 L7.5 14.5 Z M23 10 L19.5 15 L24.5 14.5 Z" fill="#ffd0c2"/><path d="M10 16 C10 11 22 11 22 16 L21 21 L11 21 Z" fill="#ffd0c2"/><circle cx="13.3" cy="17" r="1.7" fill="#5b2626"/><circle cx="18.7" cy="17" r="1.7" fill="#5b2626"/><path d="M13 23.5 H19" stroke="#ffd0c2" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  campDone: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13.5" fill="#55606a" stroke="#ffffff" stroke-width="2"/><path d="M10 16.5 L14 20.5 L22 11.5" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  crystal: `<svg viewBox="0 0 32 32"><defs><linearGradient id="mg-rb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a8a"/><stop offset=".25" stop-color="#ffd36a"/><stop offset=".5" stop-color="#8cf08c"/><stop offset=".75" stop-color="#6fd0ff"/><stop offset="1" stop-color="#c39bff"/></linearGradient></defs><circle cx="16" cy="16" r="13.5" fill="#26334a" stroke="#ffffff" stroke-width="2"/><path d="M16 5.5 L23 14 L16 26.5 L9 14 Z" fill="url(#mg-rb)"/><path d="M16 5.5 L19 14 L16 26.5 L13 14 Z" fill="#ffffff" opacity=".45"/><path d="M9 14 H23" stroke="#ffffff" stroke-width="1" opacity=".7"/></svg>`,
  domain: `<svg viewBox="0 0 32 32"><rect x="2.5" y="2.5" width="27" height="27" rx="7" fill="#26334a" stroke="#ffffff" stroke-width="2"/><path d="M8.5 25 V14 A7.5 7.5 0 0 1 23.5 14 V25" fill="none" stroke="#e9d7a8" stroke-width="2.6"/><path d="M11.5 25 V14.5 A4.5 4.5 0 0 1 20.5 14.5 V25 Z" fill="#7ff3ff"/><path d="M13.5 25 V15 A2.5 2.5 0 0 1 18.5 15 V25 Z" fill="#e6fdff"/><path d="M7 25.5 H25" stroke="#e9d7a8" stroke-width="2" stroke-linecap="round"/></svg>`,
  domainLocked: `<svg viewBox="0 0 32 32"><rect x="2.5" y="2.5" width="27" height="27" rx="7" fill="#3b4252" stroke="#b9c0cc" stroke-width="2"/><path d="M8.5 25 V14 A7.5 7.5 0 0 1 23.5 14 V25" fill="none" stroke="#9aa3b2" stroke-width="2.6"/><path d="M11.5 25 V14.5 A4.5 4.5 0 0 1 20.5 14.5 V25 Z" fill="#5b6475"/><path d="M7 25.5 H25" stroke="#9aa3b2" stroke-width="2" stroke-linecap="round"/></svg>`,
};
export const MAP_ICONS = ICON_SVG;
const RAINBOW = ['#ff7a8a', '#ffd36a', '#8cf08c', '#6fd0ff', '#c39bff'];

export class WorldMap {
  constructor({ heights, res, colliders, labels, roads = [], paths = [] }) {
    this.heights = heights; this.res = res; this.colliders = colliders; this.labels = labels; this.roads = roads; this.paths = paths;
    this.base = this.buildBase();
    this.view = { cx: 0, cz: -300, z: 1.0 };
    this.pois = [];
    this.open = false;
  }
  hAt(x, z) {
    const r = this.res;
    let u = (x - HB.x0) / HB.size * r - 0.5, v = (z - HB.z0) / HB.size * r - 0.5;
    if (u < 0 || v < 0 || u > r - 1 || v > r - 1) return -25;
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const H = this.heights;
    const a = H[j * r + i], b = H[j * r + i + 1], c = H[(j + 1) * r + i], d = H[(j + 1) * r + i + 1];
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
  }
  buildBase() {
    const W = Math.round((MB.x1 - MB.x0) * PPM), Hh = Math.round((MB.z1 - MB.z0) * PPM);
    // terrain raster at half resolution, then scaled up smoothly
    const rw = Math.round(W / 2), rh = Math.round(Hh / 2);
    const tcv = document.createElement('canvas'); tcv.width = rw; tcv.height = rh;
    const tctx = tcv.getContext('2d');
    const img = tctx.createImageData(rw, rh);
    const mpp = 2 / PPM; // metres per raster pixel
    const hs = new Float32Array(rw * rh);
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) hs[j * rw + i] = this.hAt(MB.x0 + (i + 0.5) * mpp, MB.z0 + (j + 0.5) * mpp);
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const C = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const shallow = C('#a6e3df'), mid = C('#5db7d6'), deep = C('#2c6aa3'), sand = C('#eee2bb'), grass = C('#a9d07c'), hill = C('#c3c98f'), peak = C('#d6d1a6'), coast = C('#3f7287');
    const L = [-0.55, 0.62, -0.55]; const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
      const k = j * rw + i, h = hs[k];
      let c;
      if (h < -0.15) {
        const d = -h;
        c = d < 4 ? mix(shallow, mid, Math.min(1, d / 4)) : mix(mid, deep, Math.min(1, (d - 4) / 14));
      } else if (h < 1.2) c = sand;
      else {
        c = h < 20 ? mix(grass, hill, (h - 1.2) / 18.8) : mix(hill, peak, Math.min(1, (h - 20) / 25));
        const hx = hs[k + (i < rw - 1 ? 1 : 0)] - hs[k - (i > 0 ? 1 : 0)];
        const hz = hs[k + (j < rh - 1 ? rw : 0)] - hs[k - (j > 0 ? rw : 0)];
        let nx = -hx / (2 * mpp), ny = 1, nz = -hz / (2 * mpp); const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const sh = 0.78 + 0.42 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        c = [c[0] * sh, c[1] * sh, c[2] * sh];
      }
      // coastline
      if (i > 0 && j > 0 && ((h >= -0.15) !== (hs[k - 1] >= -0.15) || (h >= -0.15) !== (hs[k - rw] >= -0.15))) c = coast;
      img.data[k * 4] = c[0]; img.data[k * 4 + 1] = c[1]; img.data[k * 4 + 2] = c[2]; img.data[k * 4 + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(tcv, 0, 0, W, Hh);
    const P = (x, z) => [(x - MB.x0) * PPM, (z - MB.z0) * PPM];
    const list = this.colliders.list;
    // streets of the new town
    g.lineCap = 'round'; g.lineJoin = 'round';
    const line = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([x, z], i) => { const [px, py] = P(x, z); if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke(); };
    for (const r of this.paths) line(r.pts, Math.max(1.5, r.half * 2 * PPM), '#e8e1cf');
    for (const r of this.roads) line(r.pts, r.half * 2 * PPM + 2, '#8a98a4');
    for (const r of this.roads) line(r.pts, r.half * 2 * PPM, '#dfe3e8');
    // bridges & walkways first
    g.lineCap = 'round';
    for (const c of list) {
      if (c.type !== 'seg' || c.tag === 'rail') continue;
      const [ax, ay] = P(c.ax, c.az), [bx, by] = P(c.bx, c.bz);
      g.strokeStyle = '#8a98a4'; g.lineWidth = (c.w * 2 + 0.8) * PPM; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    }
    for (const c of list) {
      if (c.type !== 'seg' || c.tag === 'rail') continue;
      const [ax, ay] = P(c.ax, c.az), [bx, by] = P(c.bx, c.bz);
      g.strokeStyle = '#f7f5ef'; g.lineWidth = c.w * 2 * PPM; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    }
    for (const c of list) {
      if (c.type === 'seg') continue;
      if (c.tag === 'rock') { const [x, y] = P(c.x, c.z); g.fillStyle = 'rgba(120,128,124,0.55)'; g.beginPath(); g.arc(x, y, Math.max(1, c.rx * PPM * 0.8), 0, 7); g.fill(); continue; }
      if (c.tag === 'tree') { if (c.type !== 'cyl') continue; const [x, y] = P(c.x, c.z); g.fillStyle = 'rgba(64,118,52,0.55)'; g.beginPath(); g.arc(x, y, 2.2 * PPM, 0, 7); g.fill(); continue; }
      const [x, y] = P(c.x, c.z);
      g.fillStyle = '#f7f5ef'; g.strokeStyle = '#8a98a4'; g.lineWidth = 1.2;
      g.beginPath();
      if (c.type === 'cyl') g.arc(x, y, c.r * PPM, 0, Math.PI * 2);
      else if (c.type === 'ell') g.ellipse(x, y, c.rx * PPM, c.rz * PPM, -(c.rot || 0), 0, Math.PI * 2);
      else if (c.type === 'ring') { g.arc(x, y, c.r1 * PPM, 0, Math.PI * 2); g.arc(x, y, c.r0 * PPM, 0, Math.PI * 2, true); }
      else if (c.type === 'box') { if (c.tag === 'prop' || c.top - c.bottom < 1.2) continue; g.save(); g.translate(x, y); g.rotate(-(c.rot || 0)); g.rect(-c.hw * PPM, -c.hd * PPM, c.hw * 2 * PPM, c.hd * 2 * PPM); g.restore(); }
      g.fill('evenodd'); g.stroke();
    }
    // region names
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const l of this.labels) {
      const [x, y] = P(l.x, l.z);
      g.font = `${l.big ? 700 : 600} ${l.big ? 30 : 22}px "Noto Serif SC", "Songti SC", serif`;
      g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = 'rgba(28,38,56,0.78)'; g.strokeText(l.name, x, y);
      g.fillStyle = '#ffffff'; g.fillText(l.name, x, y);
    }
    return cv;
  }

  // ---------- minimap ----------
  drawMini(cv, px, pz, facing, camYaw, extras) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = cv.clientWidth || 150;
    if (cv.width !== Math.round(size * dpr)) { cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    g.save();
    g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#2c6aa3'; g.fillRect(0, 0, size, size);
    const viewR = 70, scale = size / (viewR * 2);
    const sx = (px - viewR - MB.x0) * PPM, sy = (pz - viewR - MB.z0) * PPM, sw = viewR * 2 * PPM;
    this.blit(g, sx, sy, sw, sw, 0, 0, size, size);
    const toS = (x, z) => [(x - px) * scale + size / 2, (z - pz) * scale + size / 2];
    for (const e of extras.enemies) {
      const [x, y] = toS(e.x, e.z);
      if (Math.hypot(x - size / 2, y - size / 2) > size / 2 - 4) continue;
      g.fillStyle = e.elite ? '#ff6b4a' : '#ff8f7a'; g.beginPath(); g.arc(x, y, e.elite ? 4 : 2.6, 0, 7); g.fill();
    }
    for (const p of (extras.noPois ? [] : this.pois)) {
      if (p.hidden && p.hidden()) continue;
      const [x, y] = toS(p.x, p.z);
      const d = Math.hypot(x - size / 2, y - size / 2);
      const r = size / 2 - 9;
      if (p.type === 'crystal' && d > r) continue;
      const cx = d > r ? size / 2 + (x - size / 2) * r / d : x, cy = d > r ? size / 2 + (y - size / 2) * r / d : y;
      if (d > r && p.type !== 'statue' && p.type !== 'domain' && p.type !== 'quest') continue;
      this.miniIcon(g, p, cx, cy);
    }
    // view cone
    const ca = Math.atan2(-Math.cos(camYaw), -Math.sin(camYaw));
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.42);
    grd.addColorStop(0, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(size / 2, size / 2); g.arc(size / 2, size / 2, size * 0.42, ca - 0.75, ca + 0.75); g.closePath(); g.fill();
    g.restore();
    // player arrow
    g.save(); g.translate(size / 2, size / 2); g.rotate(Math.atan2(Math.cos(facing), Math.sin(facing)) + Math.PI / 2);
    g.fillStyle = '#ffd35a'; g.strokeStyle = '#6a4b10'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6.5, 7); g.lineTo(0, 3.5); g.lineTo(-6.5, 7); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  miniIcon(g, p, x, y) {
    g.save(); g.translate(x, y);
    g.lineWidth = 1.5; g.strokeStyle = '#ffffff';
    if (p.type === 'quest') { g.fillStyle = '#ffcf5a'; g.strokeStyle = '#fff6dc'; g.beginPath(); g.moveTo(0, -7.5); g.lineTo(7.5, 0); g.lineTo(0, 7.5); g.lineTo(-7.5, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#5a3a08'; g.fillRect(-1, -4, 2, 4.6); g.fillRect(-1, 2, 2, 2); }
    else if (p.type === 'wp') { g.fillStyle = '#26334a'; g.beginPath(); g.moveTo(0, -7.5); g.lineTo(5.5, 0); g.lineTo(0, 7.5); g.lineTo(-5.5, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#7ff3ff'; g.beginPath(); g.moveTo(0, -3); g.lineTo(2.2, 0); g.lineTo(0, 3); g.lineTo(-2.2, 0); g.closePath(); g.fill(); }
    else if (p.type === 'statue') { g.fillStyle = '#26334a'; g.beginPath(); if (g.roundRect) g.roundRect(-6.5, -6.5, 13, 13, 3.5); else g.rect(-6.5, -6.5, 13, 13); g.fill(); g.stroke(); g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(0, -2.5, 1.8, 0, 7); g.fill(); g.fillStyle = '#e9d7a8'; g.fillRect(-2, 0, 4, 4.5); }
    else if (p.type === 'camp') { const done = p.done && p.done(); g.fillStyle = done ? '#55606a' : '#5b2626'; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); g.stroke(); g.fillStyle = done ? '#ffffff' : '#ffd0c2'; g.beginPath(); g.arc(0, 0.5, 2.6, 0, 7); g.fill(); }
    else if (p.type === 'domain') { const lk = p.locked(); g.fillStyle = lk ? '#3b4252' : '#26334a'; g.strokeStyle = lk ? '#b9c0cc' : '#ffffff'; g.beginPath(); if (g.roundRect) g.roundRect(-6.5, -6.5, 13, 13, 3.5); else g.rect(-6.5, -6.5, 13, 13); g.fill(); g.stroke(); g.fillStyle = lk ? '#5b6475' : '#7ff3ff'; g.beginPath(); g.moveTo(-2.6, 4.5); g.lineTo(-2.6, -0.5); g.arc(0, -0.5, 2.6, Math.PI, 0); g.lineTo(2.6, 4.5); g.closePath(); g.fill(); }
    else if (p.type === 'crystal') {
      g.fillStyle = '#26334a'; g.beginPath(); g.arc(0, 0, 5.5, 0, 7); g.fill(); g.stroke();
      const gr = g.createLinearGradient(-3, -4, 3, 4); RAINBOW.forEach((c, i) => gr.addColorStop(i / 4, c));
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -4); g.lineTo(2.8, -0.5); g.lineTo(0, 4.2); g.lineTo(-2.8, -0.5); g.closePath(); g.fill();
    }
    g.restore();
  }
  blit(g, sx, sy, sw, sh, dx, dy, dw, dh) {
    // draw the part of the base map that falls inside the source rectangle
    const B = this.base;
    const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(B.width, sx + sw), y1 = Math.min(B.height, sy + sh);
    if (x1 <= x0 || y1 <= y0) return;
    const kx = dw / sw, ky = dh / sh;
    g.drawImage(B, x0, y0, x1 - x0, y1 - y0, dx + (x0 - sx) * kx, dy + (y0 - sy) * ky, (x1 - x0) * kx, (y1 - y0) * ky);
  }

  // ---------- full-screen map ----------
  render(cv, iconsEl, player, camYaw) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, Hh = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(Hh * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#2c6aa3'; g.fillRect(0, 0, W, Hh);
    const v = this.view;
    const wx0 = v.cx - W / 2 / v.z, wz0 = v.cz - Hh / 2 / v.z;
    this.blit(g, (wx0 - MB.x0) * PPM, (wz0 - MB.z0) * PPM, W / v.z * PPM, Hh / v.z * PPM, 0, 0, W, Hh);
    const toS = (x, z) => [(x - v.cx) * v.z + W / 2, (z - v.cz) * v.z + Hh / 2];
    // icons
    if (!this.iconEls) {
      this.iconEls = this.pois.map((p, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'micon ' + p.type; b.dataset.i = i; b.setAttribute('aria-label', p.name);
        b.innerHTML = p.type === 'camp' ? ICON_SVG.camp : ICON_SVG[p.type];
        iconsEl.appendChild(b);
        return b;
      });
      this.playerEl = document.createElement('div'); this.playerEl.className = 'mplayer';
      this.playerEl.innerHTML = '<svg viewBox="0 0 32 32"><path d="M16 3 L26 27 L16 21 L6 27 Z" fill="#ffd35a" stroke="#6a4b10" stroke-width="2" stroke-linejoin="round"/></svg>';
      iconsEl.appendChild(this.playerEl);
    }
    this.pois.forEach((p, i) => {
      const [x, y] = toS(p.x, p.z);
      const el = this.iconEls[i];
      const hid = !!(p.hidden && p.hidden());
      if (el.hidden !== hid) el.hidden = hid;
      if (hid) return;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      if (p.type === 'domain') { const lk = String(p.locked()); if (el.dataset.lk !== lk) { el.dataset.lk = lk; el.innerHTML = lk === 'true' ? ICON_SVG.domainLocked : ICON_SVG.domain; } }
      if (p.type === 'camp') { const done = p.done(); if (el.dataset.done !== String(done)) { el.dataset.done = String(done); el.innerHTML = done ? ICON_SVG.campDone : ICON_SVG.camp; } }
      el.classList.toggle('sel', this.selected === i);
    });
    const [px, py] = toS(player.pos.x, player.pos.z);
    const rot = Math.atan2(Math.sin(player.facing), -Math.cos(player.facing)) * 180 / Math.PI;
    this.playerEl.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -50%) rotate(${rot.toFixed(1)}deg)`;
  }
  zoomAt(sx, sy, factor, W, Hh) {
    const v = this.view;
    const wx = (sx - W / 2) / v.z + v.cx, wz = (sy - Hh / 2) / v.z + v.cz;
    v.z = Math.min(6, Math.max(0.3, v.z * factor));
    v.cx = wx - (sx - W / 2) / v.z; v.cz = wz - (sy - Hh / 2) / v.z;
    this.clamp();
  }
  clamp() {
    const v = this.view;
    v.cx = Math.min(MB.x1, Math.max(MB.x0, v.cx)); v.cz = Math.min(MB.z1, Math.max(MB.z0, v.cz));
  }
}
