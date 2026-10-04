import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, M } from './geo.js';
import { H, rawH0, addPad, coastX, FALL_Z } from './terrain.js';
import { rng } from './noise.js';

// 海湾新城 — the seaside suburb around the starting cliff: a boulevard with an elevated monorail,
// villas and mid-rise apartments stepping up the hill, two stations, a promenade, wind turbines.
// planCity() runs before the terrain is built (it grades lots and road beds); buildCity() adds the meshes.

const G = ['#6db83a', '#85c94a', '#5aa232', '#9fd65a', '#4f9330'];
const ACC = ['#ff8fa3', '#ffb36a', '#ffd86b', '#7fd88f', '#6fc8ff', '#9a8cff'];
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- textures
function canvasTex(w, h, paint, rep = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  paint(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// curtain wall: 4 x 4 window modules (3 m x 3.3 m each), spandrel band, mullions, sky reflections
function facadeTex(R, tint = 0) {
  return canvasTex(512, 512, (g, W) => {
    const m = W / 4;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const x = i * m, y = j * m;
      const gr = g.createLinearGradient(0, y, 0, y + m);
      const k = R();
      const top = k < 0.15 ? '#cfe9fb' : k < 0.3 ? '#7fb6e6' : '#a8d4f4';
      const bot = tint ? '#2a5f8a' : (k < 0.5 ? '#2d6db0' : '#25609e');
      gr.addColorStop(0, top); gr.addColorStop(0.82, bot); gr.addColorStop(1, bot);
      g.fillStyle = gr; g.fillRect(x, y, m, m);
      // interior hints: warm lit room or curtains in some panes
      if (R() < 0.22) { g.fillStyle = 'rgba(255,214,150,0.35)'; g.fillRect(x + 6, y + m * 0.35, m / 2 - 8, m * 0.45); }
      if (R() < 0.2) { g.fillStyle = 'rgba(240,244,248,0.55)'; g.fillRect(x + m / 2 + 2, y + 8, m / 2 - 8, m * 0.6); }
      // reflection streak
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath(); g.moveTo(x + m * 0.15, y); g.lineTo(x + m * 0.35, y); g.lineTo(x + m * 0.05, y + m * 0.8); g.lineTo(x - m * 0.15 + 2, y + m * 0.8); g.fill();
      // spandrel (slab edge) + mullions + transom
      g.fillStyle = '#eef2f5'; g.fillRect(x, y + m * 0.84, m, m * 0.16);
      g.fillStyle = 'rgba(70,90,110,0.5)'; g.fillRect(x, y + m * 0.84, m, 2);
      g.fillStyle = '#f4f7f9';
      g.fillRect(x, y, 4, m); g.fillRect(x + m / 2 - 1.5, y, 3, m * 0.84); g.fillRect(x, y + m * 0.22, m, 3);
    }
  });
}
function panelTex() {
  return canvasTex(256, 256, (g, W) => {
    g.fillStyle = '#f2f4f5'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 1400; i++) { const v = 236 + Math.random() * 14; g.fillStyle = `rgb(${v},${v + 1},${v + 3})`; g.fillRect(Math.random() * W, Math.random() * W, 2, 2); }
    g.fillStyle = 'rgba(150,160,170,0.45)';
    for (let y = 0; y < W; y += 32) g.fillRect(0, y, W, 1.5);
    g.fillStyle = 'rgba(150,160,170,0.3)';
    for (let x = 0; x < W; x += 128) g.fillRect(x, 0, 1.5, W);
  });
}
function woodTex() {
  return canvasTex(256, 256, (g, W) => {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const c = new THREE.Color('#b9875a').offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(i * W / n, 0, W / n - 3, W);
      g.fillStyle = 'rgba(80,50,25,0.18)'; for (let k = 0; k < 4; k++) g.fillRect(i * W / n + Math.random() * 10, 0, 1, W);
    }
    g.fillStyle = '#4a3420'; for (let i = 0; i < n; i++) g.fillRect(i * W / n + W / n - 3, 0, 3, W);
  });
}
function deckTex() {
  return canvasTex(256, 256, (g, W) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const c = new THREE.Color('#d2a878').offsetHSL(0, 0, (Math.random() - 0.5) * 0.07);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(0, i * W / n, W, W / n - 2);
      g.fillStyle = 'rgba(110,70,35,0.15)'; for (let k = 0; k < 3; k++) g.fillRect(0, i * W / n + 4 + Math.random() * 20, W, 1);
      g.fillStyle = 'rgba(90,60,30,0.6)'; g.fillRect(((i * 97) % 5) * W / 5, i * W / n, 2, W / n);
    }
    g.fillStyle = '#7a5532'; for (let i = 0; i < n; i++) g.fillRect(0, i * W / n + W / n - 2, W, 2);
  });
}
function solarTex() {
  return canvasTex(128, 192, (g, W, Hh) => {
    g.fillStyle = '#c9d2dc'; g.fillRect(0, 0, W, Hh);
    const gr = g.createLinearGradient(0, 0, W, Hh); gr.addColorStop(0, '#2c4f86'); gr.addColorStop(1, '#16274a');
    g.fillStyle = gr; g.fillRect(4, 4, W - 8, Hh - 8);
    g.strokeStyle = 'rgba(200,215,235,0.55)'; g.lineWidth = 1.5;
    for (let x = 4; x <= W - 4; x += (W - 8) / 4) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x, Hh - 4); g.stroke(); }
    for (let y = 4; y <= Hh - 4; y += (Hh - 8) / 6) { g.beginPath(); g.moveTo(4, y); g.lineTo(W - 4, y); g.stroke(); }
  }, false);
}
// asphalt: u runs across the carriageway, v along it (one tile = 12 m)
function roadTex(kind) {
  return canvasTex(256, 512, (g, W, Hh) => {
    g.fillStyle = '#5d6571'; g.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 9000; i++) { const v = 80 + Math.random() * 40; g.fillStyle = `rgba(${v},${v + 6},${v + 14},0.5)`; g.fillRect(Math.random() * W, Math.random() * Hh, 1.5, 1.5); }
    g.fillStyle = '#eef2f4';
    g.fillRect(W * 0.025, 0, 5, Hh); g.fillRect(W * 0.975 - 5, 0, 5, Hh);
    if (kind === 'side') { g.fillStyle = '#ffd36b'; for (let y = 0; y < Hh; y += 128) g.fillRect(W / 2 - 3, y, 6, 64); }
    // a glowing guide strip, the futuristic touch
    g.fillStyle = 'rgba(110,220,255,0.55)'; g.fillRect(W * 0.06, 0, 3, Hh); g.fillRect(W * 0.94 - 3, 0, 3, Hh);
  });
}
function paverTex() {
  return canvasTex(256, 256, (g, W) => {
    g.fillStyle = '#c9c4ba'; g.fillRect(0, 0, W, W);
    const n = 4, s = W / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n * 2; i++) {
      const x = (i * s / 2 + (j % 2) * s / 4) % W, c = 222 + Math.random() * 18;
      g.fillStyle = `rgb(${c},${c - 4},${c - 12})`; g.fillRect(x + 1.5, j * s + 1.5, s / 2 - 3, s - 3);
      if (x + s / 2 > W) g.fillRect(x - W + 1.5, j * s + 1.5, s / 2 - 3, s - 3);
    }
  });
}
function signTex(lines, w = 512, h = 256, bg = 'rgba(10,30,60,0.0)') {
  return canvasTex(w, h, (g, W, Hh) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([t, size, col, y]) => { g.font = `700 ${size}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`; g.fillStyle = col; g.fillText(t, W / 2, y * Hh); });
  }, false);
}

// ---------------------------------------------------------------- geometry helpers
// box with UVs in world metres (tu x tv per texture repeat) so facades line up floor by floor
function tbox(w, h, d, tu = 4, tv = tu) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const [fu, fv] = f < 2 ? [d, h] : f < 4 ? [w, d] : [w, h];
    for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * fu / tu, uv.getY(i) * fv / tv); }
  }
  return g;
}
const rbox = (w, h, d, r = 0.2, seg = 1) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.05, h / 2.05, d / 2.05));
// local frame: world = T(x,y,z) * Ry(rot) * local
function frame(x, y, z, rot) {
  const base = new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z);
  return (lx = 0, ly = 0, lz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => base.clone().multiply(M(lx, ly, lz, rx, ry, rz, sx, sy, sz));
}
const wp = (x, z, rot, lx, lz) => { const c = Math.cos(rot), s = Math.sin(rot); return [x + lx * c + lz * s, z - lx * s + lz * c]; };
// flat strip between lateral offsets a..b (left-hand normal) along a polyline, with optional side walls
function strip(pts, hs, a, b, lift, { u = 1, vLen = 12, walls = 0, uFixed = false } = {}) {
  const pos = [], uv = [], idx = [];
  let acc = 0;
  const n = pts.length;
  const side = (i) => { const p = pts[Math.max(0, i - 1)], q = pts[Math.min(n - 1, i + 1)]; const tx = q[0] - p[0], tz = q[1] - p[1], l = Math.hypot(tx, tz) || 1; return [-tz / l, tx / l]; };
  const rows = [];
  for (let i = 0; i < n; i++) {
    if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const [nx, nz] = side(i), y = hs[i] + lift;
    rows.push([pts[i][0] + nx * a, y, pts[i][1] + nz * a, pts[i][0] + nx * b, y, pts[i][1] + nz * b, acc]);
  }
  const uw = uFixed ? u : Math.abs(b - a) / u;
  const quad = (A, B, C, D, ua, ub, va, vb) => { const k = pos.length / 3; pos.push(...A, ...B, ...C, ...D); uv.push(ua, va, ub, va, ua, vb, ub, vb); idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); };
  for (let i = 0; i < n - 1; i++) {
    const r0 = rows[i], r1 = rows[i + 1], v0 = r0[6] / vLen, v1 = r1[6] / vLen;
    quad([r0[0], r0[1], r0[2]], [r0[3], r0[4], r0[5]], [r1[0], r1[1], r1[2]], [r1[3], r1[4], r1[5]], 0, uw, v0, v1);
    if (walls > 0) {
      quad([r0[0], r0[1] - walls, r0[2]], [r0[0], r0[1], r0[2]], [r1[0], r1[1] - walls, r1[2]], [r1[0], r1[1], r1[2]], 0, 0.05, v0, v1);
      quad([r0[3], r0[4], r0[5]], [r0[3], r0[4] - walls, r0[5]], [r1[3], r1[4], r1[5]], [r1[3], r1[4] - walls, r1[5]], 0, 0.05, v0, v1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // keep the winding facing up whichever way the polyline runs
  const nr = g.attributes.normal; let up = 0; for (let i = 0; i < nr.count; i++) up += nr.getY(i);
  if (up < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}
// polyline helpers
function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az);
    let t = step - carry;
    while (t <= L) { out.push([ax + (bx - ax) * t / L, az + (bz - az) * t / L]); t += step; }
    carry = L - (t - step);
  }
  const last = pts[pts.length - 1], pl = out[out.length - 1];
  if (Math.hypot(last[0] - pl[0], last[1] - pl[1]) > step * 0.3) out.push(last); else out[out.length - 1] = last;
  return out;
}
function smooth(a, r, n = 2) {
  let v = a.slice();
  for (let k = 0; k < n; k++) v = v.map((_, i) => { let s = 0, c = 0; for (let j = -r; j <= r; j++) { const q = v[Math.max(0, Math.min(v.length - 1, i + j))]; s += q; c++; } return s / c; });
  return v;
}
function along(pts, s) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + L >= s) { const t = (s - acc) / L; return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, z: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, i, t, dx: (pts[i][0] - pts[i - 1][0]) / L, dz: (pts[i][1] - pts[i - 1][1]) / L }; }
    acc += L;
  }
  const n = pts.length - 1, L = Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]);
  return { x: pts[n][0], z: pts[n][1], i: n, t: 1, dx: (pts[n][0] - pts[n - 1][0]) / L, dz: (pts[n][1] - pts[n - 1][1]) / L };
}
const plen = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
// nearest point on a polyline: { d, s, h }
function nearest(road, x, z) {
  let best = { d: Infinity, s: 0, h: 0 }, acc = 0;
  for (let i = 1; i < road.pts.length; i++) {
    const [ax, az] = road.pts[i - 1], [bx, bz] = road.pts[i], vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz, L = Math.sqrt(L2);
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
    const d = Math.hypot(ax + vx * t - x, az + vz * t - z);
    if (d < best.d) best = { d, s: acc + t * L, h: road.hs[i - 1] + (road.hs[i] - road.hs[i - 1]) * t };
    acc += L;
  }
  return best;
}

// ---------------------------------------------------------------- plan (before the terrain exists)
export const CITY = { plan: null };
const OFF = (o, z) => coastX(z) + o;

function makeRoad(name, ctrl, half, opts = {}) {
  const pts = resample(ctrl, 4);
  // bed height: natural ground averaged across the width, then smoothed along the road
  let hs = pts.map(([x, z], i) => {
    const p = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)];
    const tx = q[0] - p[0], tz = q[1] - p[1], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
    let s = 0; for (const k of [-1, -0.5, 0, 0.5, 1]) s += rawH0(x + nx * half * k, z + nz * half * k);
    return s / 5;
  });
  hs = smooth(hs, opts.smooth ?? 4, 3).map((h) => Math.max(1.2, h));
  if (opts.y0 !== undefined) { const n = Math.min(hs.length, 6); for (let i = 0; i < n; i++) hs[i] = opts.y0 + (hs[i] - opts.y0) * ss(0, n, i); }
  return { name, pts, hs, half, L: plen(pts), ...opts };
}

export function planCity(spawn) {
  const P = { roads: [], lots: [], paths: [], stations: [], turbines: [], keep: [], spots: {} };
  const keep = (x, z, r) => P.keep.push([x, z, r]);
  // things that already live here
  keep(spawn.x - 1, spawn.z, 12);                         // cliff observation deck
  keep(spawn.x + 7.5, spawn.z + 3.5, 6); keep(spawn.x + 4.5, spawn.z - 13, 6); // framing trees
  P.spots.statue = [spawn.x + 20, spawn.z + 12]; keep(...P.spots.statue, 9);
  keep(89, 63, 12); keep(76, 56, 6);                      // 光锁 puzzle + the spot to shoot from
  keep(102, 2, 13); keep(104, -6, 3);                     // meadow slimes + their chest
  P.spots.domain = [150, 25]; keep(150, 25, 13);
  keep(OFF(16, FALL_Z - 6), FALL_Z - 6, 4); keep(OFF(8, FALL_Z + 10), FALL_Z + 10, 3); keep(OFF(12, FALL_Z + 6.5), FALL_Z + 6.5, 3);
  keep(OFF(170, -30), -30, 6); keep(OFF(168, -26), -26, 4);
  keep(158, -168, 16);
  P.spots.dome = [OFF(26, -122), -122]; keep(...P.spots.dome, 13);
  const clearOf = (x, z, r) => P.keep.every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr + r) && !(Math.abs(z - FALL_Z) < 7 + r && x > OFF(0, FALL_Z) && x < OFF(76, FALL_Z));

  // ---- roads
  const blvdCtrl = []; for (let z = 122; z >= -152; z -= 8) blvdCtrl.push([OFF(50, z), z]);
  const blvd = makeRoad('海湾大道', blvdCtrl, 8.2, { kind: 'blvd', carriage: 5.2, smooth: 5 });
  P.roads.push(blvd); P.blvd = blvd;
  const at = (z) => { let b = null; for (let i = 0; i < blvd.pts.length; i++) if (!b || Math.abs(blvd.pts[i][1] - z) < Math.abs(b[1] - z)) b = [...blvd.pts[i], blvd.hs[i]]; return b; };
  const side = (name, z0, ctrl) => {
    const j = at(z0), dx = ctrl[0][0] - j[0], dz = ctrl[0][1] - j[1], l = Math.hypot(dx, dz);
    const st = [j[0] + dx / l * (blvd.half - 0.4), j[1] + dz / l * (blvd.half - 0.4)];
    const r = makeRoad(name, [st, ...ctrl], 4.2, { kind: 'side', carriage: 3.2, y0: j[2] + 0.12, smooth: 3 }); P.roads.push(r); return r;
  };
  P.domRoad = side('回廊路', 25, [[128, 25], [139, 25]]);
  { // the street climbs gently to meet the heritage plaza at its own level
    const r = P.domRoad, yT = rawH0(...P.spots.domain), n = r.hs.length;
    for (let i = 0; i < n; i++) { const k = ss(0, n - 1, i); r.hs[i] = r.hs[i] * (1 - k) + yT * k; }
  }
  P.hillRoad = side('云台路', 88, [[OFF(64, 89), 89], [OFF(84, 91), 90], [OFF(104, 88), 87], [OFF(124, 88), 88]]);
  P.northRoad = side('晴岚路', -36, [[OFF(66, -36), -36], [OFF(86, -35), -35], [OFF(110, -36), -36]]);

  // ---- lots: [kind, x, z, rot, params]
  const lot = (kind, x, z, rot, w, d, opt = {}) => {
    if (!clearOf(x, z, Math.max(w, d) * 0.5)) { if (typeof location !== 'undefined' && /debug/.test(location.search)) console.log('LOG lot skipped', kind, x.toFixed(0), z.toFixed(0)); return null; }
    for (const r of P.roads) { const n = nearest(r, x, z); if (n.d < r.half + Math.max(w, d) * 0.5 + 0.5) { if (typeof location !== 'undefined' && /debug/.test(location.search)) console.log('LOG lot on road', kind, r.name, x.toFixed(0), z.toFixed(0)); return null; } }
    let s = 0, c = 0;
    for (const [lx, lz] of [[0, 0], [-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) { const [px, pz] = wp(x, z, rot, lx, lz); s += rawH0(px, pz); c++; }
    let y = s / c;
    const L = { kind, x, z, rot, w, d, y, ...opt };
    // the yard faces the nearest road; never sink a house below the street in front of it
    let best = null; for (const r of P.roads) { const n = nearest(r, x, z); if (!best || n.d < best.d) best = { ...n, road: r }; }
    if (best) { L.road = best.road; L.roadH = best.h; if (best.d < 40) L.y = y = Math.max(y, best.h + 0.3); }
    P.lots.push(L);
    keep(x, z, Math.max(w, d) * 0.5 + 2);
    return L;
  };
  // seaward row: villas open to the sea, entrance from the boulevard
  lot('villa', OFF(25, 115), 115, Math.PI / 2, 13, 10, { v: 0 });
  lot('villa', OFF(25, 100), 100, Math.PI / 2, 13, 10, { v: 1 });
  lot('cafe', OFF(23, 84), 84, 0, 13, 13, {});
  lot('villa', OFF(25, -22), -22, Math.PI / 2, 13, 10, { v: 2 });
  lot('villa', OFF(26, -38), -38, Math.PI / 2, 13, 10, { v: 0 });
  lot('villa', OFF(25, -92), -92, Math.PI / 2, 13, 10, { v: 1 });
  lot('cafe', OFF(24, -143), -143, 0, 13, 13, {});
  // inland row
  lot('villa', OFF(73, 66), 66, -Math.PI / 2, 13, 10, { v: 0 });
  lot('villa', OFF(73, 48), 48, -Math.PI / 2, 13, 10, { v: 1 });
  lot('tower', OFF(74, 3), 3, -Math.PI / 2, 15, 11, { floors: 9 });
  lot('tower', OFF(74, -17), -17, -Math.PI / 2, 15, 11, { floors: 12 });
  lot('villa', OFF(72, -80), -80, -Math.PI / 2, 13, 10, { v: 2 });
  lot('terrace', OFF(74, -102), -102, -Math.PI / 2 + 0.2, 22, 13, {});
  lot('tower', OFF(73, -128), -128, -Math.PI / 2, 15, 11, { floors: 14 });
  lot('tower', OFF(72, -148), -148, -Math.PI / 2, 15, 11, { floors: 10 });
  // 云台路 (up the hill)
  for (const [o, zz, rot, v] of [[80, 76, 0, 1], [100, 75, 0, 2], [118, 76, 0, 0], [82, 101, Math.PI, 0], [102, 100, Math.PI, 1], [121, 101, Math.PI, 2]]) lot('villa', OFF(o, zz), zz, rot, 13, 10, { v });
  // 晴岚路
  lot('tower', OFF(95, -22), -22, Math.PI, 15, 11, { floors: 8 });
  lot('tower', OFF(115, -22), -22, Math.PI, 15, 11, { floors: 11 });
  lot('villa', OFF(90, -48), -48, 0, 13, 10, { v: 2 });
  lot('villa', OFF(108, -49), -49, 0, 13, 10, { v: 1 });

  // ---- outposts up the coast: the lone towers get neighbours, paths, lamps and trees
  {
    const fx = OFF(40, -900);
    lot('tower', fx + 36, -914, -Math.PI / 2, 15, 11, { floors: 11 });
    lot('tower', fx + 22, -934, -Math.PI / 2 + 0.4, 15, 11, { floors: 8 });
    lot('cafe', fx + 4, -878, 0, 13, 13, {});
    const walk = (ctrl, name) => { const r = makeRoad(name, ctrl, 1.6, { kind: 'path', smooth: 3 }); r.lit = true; P.paths.push(r); return r; };
    walk([[fx - 10, -846], [fx - 22, -858], [fx - 14, -884], [fx - 6, -912], [fx + 14, -908], [fx + 26, -898], [fx + 28, -920], [fx + 12, -944], [fx + 2, -960]], '远方城步道');
    const cz = -520, cx = OFF(30, cz);
    walk([[238, -402], [246, -440], [256, -478], [cx - 8, cz + 12], [cx + 8, cz + 14], [cx + 18, cz + 4]], '尖塔海岸步道');
  }
  // ---- promenade along the cliff edge
  const prom = (z0, z1) => { const c = []; for (let z = z0; z >= z1; z -= 6) c.push([OFF(14, z), z]); const r = makeRoad('海崖步道', c, 1.6, { kind: 'path', smooth: 3 }); P.paths.push(r); return r; };
  P.prom1 = prom(118, 49); P.prom2 = prom(30, -30); P.prom3 = prom(-84, -150);
  // footpaths from each lot to its road, and from the deck to the boulevard
  const foot = (a, b, ya, yb) => {
    const pts = resample([a, b], 3), hs = pts.map((_, i) => ya + (yb - ya) * i / (pts.length - 1));
    const r = { name: 'path', pts, hs, half: 1.3, L: plen(pts), kind: 'path' }; P.paths.push(r); return r;
  };
  for (const L of P.lots) {
    if (!L.road) continue;
    const [fx, fz] = wp(L.x, L.z, L.rot, 0, L.d / 2 + 0.6);
    const n = nearest(L.road, fx, fz); if (n.d > 30) continue;
    const q = along(L.road.pts, n.s);
    const nx = -q.dz, nz = q.dx, sgn = (fx - q.x) * nx + (fz - q.z) * nz > 0 ? 1 : -1;
    const ex = q.x + nx * sgn * (L.road.half - 0.3), ez = q.z + nz * sgn * (L.road.half - 0.3);
    L.path = foot([fx, fz], [ex, ez], L.y + 0.2, n.h + 0.12);
  }
  { const j = at(spawn.z); P.deckPath = foot([spawn.x + 5, spawn.z - 0.5], [j[0] - blvd.half + 0.3, j[1]], rawH0(spawn.x, spawn.z) + 0.2, j[2] + 0.12); }
  { const s = P.spots.statue; P.statuePath = foot([s[0] + 4, s[1] - 4], [s[0] + 9, s[1] - 11.5], rawH0(...s), rawH0(s[0] + 9, s[1] - 11.5)); }

  // ---- stations on the boulevard (the monorail runs above its median)
  const stAt = (z, name, sub) => { const s = nearest(blvd, OFF(50, z), z).s; P.stations.push({ name, sub, s }); };
  stAt(14, '海崖站', 'CLIFFSIDE'); stAt(-112, '穹顶站', 'DOME GARDEN');
  // ---- wind turbines on the ridge
  for (const z of [112, 72, 34, -6, -46, -96, -138]) { const x = OFF(150, z); if (clearOf(x, z, 4)) P.turbines.push([x, z, rawH0(x, z)]); }

  // ---------------- grade the ground
  addPad({ type: 'rect', x: spawn.x - 1, z: spawn.z, hw: 6.2, hd: 8.2, rot: 0, y: rawH0(spawn.x, spawn.z) + 0.05, blend: 4, margin: 0.5 });
  P.deckY = rawH0(spawn.x, spawn.z) + 0.05;
  { const s = P.spots.statue; addPad({ type: 'circle', x: s[0], z: s[1], r: 7.5, y: rawH0(...s), blend: 5 }); }
  for (const r of P.roads) addPad({ type: 'poly', pts: r.pts, hs: r.hs, hw: r.half + 0.6, blend: 6, margin: 1.2 });
  for (const r of P.paths) addPad({ type: 'poly', pts: r.pts, hs: r.hs, hw: r.half + 0.4, blend: 2.5, margin: 0.6 });
  for (const L of P.lots) addPad({ type: 'rect', x: L.x, z: L.z, hw: L.w / 2 + 3, hd: L.d / 2 + 3, rot: L.rot, y: L.y, blend: 1.6, margin: -2.5 });
  for (const [x, z, y] of P.turbines) addPad({ type: 'circle', x, z, r: 4, y, blend: 4 });
  { const s = P.spots.domain; addPad({ type: 'circle', x: s[0], z: s[1], r: 13, y: rawH0(...s), blend: 6 }); }
  CITY.plan = P;
  return P;
}

// ---------------------------------------------------------------- build
function cityMaterials(base) {
  const R = rng(4242);
  const STD = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const road = STD({ map: roadTex('blvd'), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const roadS = STD({ map: roadTex('side'), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  return {
    ...base,
    facade: STD({ map: facadeTex(R), metalness: 0.35, roughness: 0.14, envMapIntensity: 1.25 }),
    facade2: STD({ map: facadeTex(R, 1), metalness: 0.35, roughness: 0.14, envMapIntensity: 1.25 }),
    // (windows light up at night: see nightMats below)
    panel: STD({ map: panelTex(), roughness: 0.5 }),
    trim: STD({ color: '#f7f8fa', roughness: 0.32 }),
    wood: STD({ map: woodTex(), roughness: 0.75 }),
    deck: STD({ map: deckTex(), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    solar: STD({ map: solarTex(), metalness: 0.45, roughness: 0.25 }),
    dark: STD({ color: '#2c3442', roughness: 0.4, metalness: 0.5 }),
    steel: STD({ color: '#c9d1da', roughness: 0.3, metalness: 0.7 }),
    road, roadS,
    pave: STD({ map: paverTex(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    curb: STD({ color: '#e9ecef', roughness: 0.6 }),
    stone: STD({ map: panelTex(), color: '#eee5d4', roughness: 0.7 }),
    lawn: new THREE.MeshLambertMaterial({ color: '#7cc24c' }),
    bark: new THREE.MeshLambertMaterial({ color: '#8d6b4f' }),
    pool: STD({ color: '#5cd0f2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.82, envMapIntensity: 1.6 }),
    led: new THREE.MeshBasicMaterial({ color: '#9ee8ff' }),
    warm: new THREE.MeshBasicMaterial({ color: '#fff1c8' }),
    acc: ACC.map((c) => STD({ color: c, roughness: 0.45 })),
  };
}

export function buildCity(scene, ctx, spawn) {
  const P = CITY.plan; if (!P) return { animate: [], trains: [], cars: [] };
  const { colliders: C, foliage } = ctx;
  const mats = cityMaterials(ctx.mats);
  const b = new Batch();
  const R = rng(9090);
  const out = { animate: [], trains: [], cars: [], drones: [], rotors: [], stations: [], nightMats: [], nightFx: [] };
  for (const m of [mats.facade, mats.facade2]) { m.emissive = new THREE.Color('#ffd49a'); m.emissiveMap = m.map; m.emissiveIntensity = 0; m.userData.nightI = 0.75; out.nightMats.push(m); }
  mats.led.color.set('#9ee8ff');
  const box = (x, z, w, d, rot, bottom, top, tag) => C.add({ type: 'box', x, z, hw: w / 2, hd: d / 2, rot, bottom, top, tag });
  const tree = (x, y, z, s = 1, cols = G) => {
    b.add(new THREE.CylinderGeometry(0.14 * s, 0.22 * s, 3.2 * s, 7), mats.bark, M(x, y + 1.6 * s, z));
    foliage.add(x, y + 3.6 * s, z, 1.5 * s, 1.25 * s, 1.5 * s, cols[Math.floor(R() * cols.length)], R() * 6);
    foliage.add(x + 0.7 * s, y + 3.1 * s, z + 0.3 * s, 1.0 * s, 0.85 * s, 1.0 * s, cols[Math.floor(R() * cols.length)], R() * 6);
    foliage.add(x - 0.6 * s, y + 3.2 * s, z - 0.4 * s, 1.0 * s, 0.85 * s, 1.0 * s, cols[Math.floor(R() * cols.length)], R() * 6);
    C.add({ type: 'cyl', x, z, r: 0.3 * s, top: y + 2.6 * s, bottom: y - 1, tag: 'tree' });
  };
  const shrub = (x, y, z, s = 0.6) => foliage.add(x, y + s * 0.55, z, s, s * 0.75, s, G[Math.floor(R() * G.length)], R() * 6);
  const bench = (x, y, z, rot) => {
    const F = frame(x, y, z, rot);
    b.add(tbox(1.9, 0.08, 0.5, 2), mats.wood, F(0, 0.46, 0));
    b.add(tbox(1.9, 0.42, 0.06, 2), mats.wood, F(0, 0.72, -0.24, -0.18, 0, 0));
    for (const sx of [-0.75, 0.75]) b.add(rbox(0.1, 0.46, 0.55, 0.04), mats.trim, F(sx, 0.23, 0));
    box(x, z, 2, 0.6, rot, y - 0.5, y + 0.5, 'prop');
  };
  const lamps = [];
  const lamp = (x, y, z, rot) => { lamps.push([x, y, z, rot]); C.add({ type: 'cyl', x, z, r: 0.18, top: y + 5.6, bottom: y - 1, tag: 'prop' }); };

  // ================= roads & paths =================
  for (const r of P.roads) {
    const { pts, hs } = r;
    if (r.kind === 'blvd') {
      b.add(strip(pts, hs, -r.carriage, r.carriage, 0.04, { u: 1, uFixed: true, vLen: 12 }), mats.road);
      for (const sg of [-1, 1]) {
        b.add(strip(pts, hs, sg * r.carriage, sg * r.half, 0.17, { u: 2, vLen: 2, walls: 0.2 }), mats.pave);
        b.add(strip(pts, hs, sg * r.carriage, sg * (r.carriage + 0.28), 0.19, { u: 1, vLen: 4 }), mats.curb);
      }
      // planted median under the monorail
      b.add(strip(pts, hs, -1.6, 1.6, 0.26, { u: 1, vLen: 4, walls: 0.3 }), mats.curb);
      b.add(strip(pts, hs, -1.35, 1.35, 0.3, { u: 1, vLen: 4 }), mats.lawn);
      for (let s = 3; s < r.L - 3; s += 2.6) { const q = along(pts, s); const h = hs[q.i - 1] + (hs[q.i] - hs[q.i - 1]) * q.t; if (s % 26 > 3.5 && s % 26 < 22.5) shrub(q.x, h + 0.2, q.z, 0.55 + R() * 0.2); }
    } else if (r.kind === 'side') {
      b.add(strip(pts, hs, -r.carriage, r.carriage, 0.04, { u: 1, uFixed: true, vLen: 12 }), mats.roadS);
      for (const sg of [-1, 1]) b.add(strip(pts, hs, sg * r.carriage, sg * r.half, 0.17, { u: 2, vLen: 2, walls: 0.2 }), mats.pave);
    }
  }
  for (const r of P.paths) b.add(strip(r.pts, r.hs, -r.half, r.half, 0.08, { u: 2, vLen: 2, walls: 0.12 }), mats.pave);
  // street lamps & trees along the boulevard and side streets (kept clear of junctions and stations)
  const nearStation = (s) => P.stations.some((st) => Math.abs(s - st.s) < 34);
  const nearJunction = (x, z) => P.roads.some((r) => r.kind === 'side' && Math.hypot(r.pts[0][0] - x, r.pts[0][1] - z) < 12);
  for (const r of P.roads) {
    const step = r.kind === 'blvd' ? 22 : 16;
    for (let s = 6; s < r.L - 4; s += step) {
      for (const sg of [-1, 1]) {
        const q = along(r.pts, s), h = r.hs[q.i - 1] + (r.hs[q.i] - r.hs[q.i - 1]) * q.t, nx = -q.dz, nz = q.dx;
        const lo = r.half - 0.5, x = q.x + nx * sg * lo, z = q.z + nz * sg * lo;
        if (nearJunction(x, z) || (r.kind === 'blvd' && nearStation(s))) continue;
        lamp(x, h + 0.17, z, Math.atan2(-nx * sg, -nz * sg));
        const q2 = along(r.pts, s + step / 2), h2 = r.hs[q2.i - 1] + (r.hs[q2.i] - r.hs[q2.i - 1]) * q2.t;
        const tx = q2.x - q2.dz * sg * (r.half - 1.3), tz = q2.z + q2.dx * sg * (r.half - 1.3);
        if (s + step / 2 < r.L - 4 && !nearJunction(tx, tz) && !(r.kind === 'blvd' && nearStation(s + step / 2))) {
          b.add(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 16), mats.curb, M(tx, h2 + 0.2, tz));
          tree(tx, h2 + 0.17, tz, 0.95 + R() * 0.2);
        }
      }
    }
  }
  for (const r of P.paths) if (r.lit) for (let s = 6; s < r.L - 3; s += 18) {
    const q = along(r.pts, s), h = r.hs[q.i - 1] + (r.hs[q.i] - r.hs[q.i - 1]) * q.t, nx = -q.dz, nz = q.dx, sg = (s / 18) % 2 < 1 ? 1 : -1;
    lamp(q.x + nx * sg * 2.1, h + 0.08, q.z + nz * sg * 2.1, Math.atan2(-nx * sg, -nz * sg));
    const tx = q.x - nx * sg * 3.6, tz = q.z - nz * sg * 3.6; tree(tx, H(tx, tz) - 0.05, tz, 0.9 + R() * 0.3);
    if (Math.round(s / 18) % 3 === 1) bench(q.x - nx * sg * 2.4, h + 0.08, q.z - nz * sg * 2.4, Math.atan2(nx * sg, nz * sg));
  }
  // promenade: lamps, benches facing the bay
  for (const r of [P.prom1, P.prom2, P.prom3]) for (let s = 8; s < r.L - 4; s += 24) {
    const q = along(r.pts, s), h = r.hs[q.i - 1] + (r.hs[q.i] - r.hs[q.i - 1]) * q.t;
    lamp(q.x + 2.1, h + 0.08, q.z, -Math.PI / 2);
    const q2 = along(r.pts, Math.min(r.L - 2, s + 12)), h2 = r.hs[q2.i - 1] + (r.hs[q2.i] - r.hs[q2.i - 1]) * q2.t;
    bench(q2.x - 2.3, h2 + 0.02, q2.z, -Math.PI / 2);
  }
  // little bridge where the boulevard crosses the stream
  {
    const n = nearest(P.blvd, OFF(50, FALL_Z), FALL_Z), q = along(P.blvd.pts, n.s), rot = Math.atan2(q.dx, q.dz);
    const F = frame(q.x, n.h, q.z, rot);
    b.add(rbox(P.blvd.half * 2 + 0.6, 0.7, 9, 0.2), mats.curb, F(0, -0.2, 0));
    for (const sg of [-1, 1]) {
      b.add(rbox(0.35, 1.0, 9.4, 0.12), mats.trim, F(sg * (P.blvd.half + 0.1), 0.65, 0));
      const [x, z] = wp(q.x, q.z, rot, sg * (P.blvd.half + 0.1), 0); box(x, z, 0.4, 9.4, rot, n.h - 1, n.h + 1.15, 'rail');
    }
  }

  // ================= 海崖观景台: the deck around the starting waypoint =================
  {
    const x = spawn.x - 1, z = spawn.z, y = P.deckY, F = frame(x, y, z, 0);
    b.add(tbox(12, 0.5, 16, 3), mats.deck, F(0, -0.1, 0));
    b.add(rbox(12.6, 0.42, 0.5, 0.12), mats.trim, F(0, -0.05, 8.2)); b.add(rbox(12.6, 0.42, 0.5, 0.12), mats.trim, F(0, -0.05, -8.2));
    b.add(rbox(0.5, 0.42, 16.8, 0.12), mats.trim, F(6.2, -0.05, 0));
    box(x, z, 12.4, 16.6, 0, y - 1.5, y + 0.15);
    // glass balustrade on the seaward edge, with a gap to the steps down to the shore path
    for (const [z0, z1] of [[-8.2, -1.6], [1.6, 8.2]]) {
      const L = z1 - z0, zc = (z0 + z1) / 2;
      b.add(tbox(0.06, 1.0, L, 2), mats.glassClear, F(-6.05, 0.65, zc));
      b.add(rbox(0.16, 0.12, L + 0.1, 0.05), mats.trim, F(-6.05, 1.18, zc));
      for (let k = 0; k <= Math.round(L / 1.6); k++) b.add(rbox(0.12, 1.1, 0.12, 0.04), mats.trim, F(-6.05, 0.62, z0 + k * L / Math.round(L / 1.6)));
      box(x - 6.05, z + zc, 0.3, L, 0, y - 0.5, y + 1.2, 'rail');
    }
    b.add(rbox(0.5, 0.42, 16.8, 0.12), mats.trim, F(-6.2, -0.05, 0));
    // coin telescope
    b.add(new THREE.CylinderGeometry(0.12, 0.18, 1.0, 10), mats.steel, F(-5.1, 0.6, 3.2));
    b.add(new THREE.CapsuleGeometry(0.14, 0.55, 4, 10), mats.dark, F(-5.25, 1.25, 3.2, 0, 0, Math.PI / 2 - 0.25));
    C.add({ type: 'cyl', x: x - 5.1, z: z + 3.2, r: 0.3, top: y + 1.4, bottom: y - 1, tag: 'prop' });
    bench(x - 4.2, y + 0.15, z - 5.6, -Math.PI / 2); bench(x - 4.2, y + 0.15, z + 6.2, -Math.PI / 2);
    for (const [lx, lz] of [[5.4, -7.4], [5.4, 7.4]]) b.add(new THREE.CylinderGeometry(0.75, 0.6, 0.6, 14), mats.trim, F(lx, 0.4, lz));
    shrub(x + 5.4, y + 0.6, z - 7.4, 0.7); shrub(x + 5.4, y + 0.6, z + 7.4, 0.7);
    lamp(x + 5.6, y + 0.15, z - 3.2, -Math.PI / 2);
    // info board: 「虹海之城 · 海崖观景台」
    const sg = new THREE.MeshBasicMaterial({ map: signTex([['海崖观景台', 64, '#ffffff', 0.38], ['虹海之城 · 新城区  RAINBOW BAY', 26, '#bfe8ff', 0.72]], 512, 256), transparent: true });
    // board in the far corner, angled toward the deck (and the starting view)
    const br = -Math.PI / 4, [bx0, bz0] = [x + 4.3, z - 6.4], nx = Math.sin(br), nz = Math.cos(br);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), sg); panel.position.set(bx0 + nx * 0.07, y + 1.55, bz0 + nz * 0.07); panel.rotation.y = br; scene.add(panel);
    b.add(rbox(2.4, 1.3, 0.12, 0.06), mats.trim, M(bx0, y + 1.55, bz0, 0, br, 0));
    b.add(new THREE.PlaneGeometry(2.3, 1.2), mats.dark, M(bx0 + nx * 0.065, y + 1.55, bz0 + nz * 0.065, 0, br, 0));
    for (const e of [-0.9, 0.9]) b.add(rbox(0.12, 1.0, 0.12, 0.04), mats.trim, M(bx0 + Math.cos(br) * e, y + 0.6, bz0 - Math.sin(br) * e));
    box(bx0, bz0, 2.4, 0.4, br, y - 0.5, y + 2.2, 'prop');
  }

  // ================= buildings =================
  const glassBand = (F, w, h, ly, lz, tu = 6, tv = 6.6, mat = mats.facade) => b.add(tbox(w, h, 0.14, tu, tv), mat, F(0, ly, lz));
  const railRun = (F, x0, z0, x1, z1, y) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0); b.add(tbox(0.05, 1.0, L, 2), mats.glassClear, F((x0 + x1) / 2, y + 0.5, (z0 + z1) / 2, 0, a, 0)); b.add(rbox(0.1, 0.08, L, 0.03), mats.trim, F((x0 + x1) / 2, y + 1.02, (z0 + z1) / 2, 0, a, 0)); };
  const solarArray = (F, cx, y, cz, nx, nz) => { for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { const px = cx + (i - (nx - 1) / 2) * 1.15, pz = cz + (k - (nz - 1) / 2) * 1.8; b.add(new THREE.BoxGeometry(1.05, 0.05, 1.6), mats.solar, F(px, y + 0.45, pz, -0.32, 0, 0)); b.add(new THREE.BoxGeometry(0.06, 0.45, 0.06), mats.steel, F(px, y + 0.22, pz + 0.55)); } };

  function villa(L) {
    const { x, z, rot, w: W, d: D, y, v } = L, F = frame(x, y, z, rot);
    const acc = mats.acc[Math.floor(R() * mats.acc.length)];
    // lot: lawn edge wall, hedges, plinth
    b.add(tbox(W + 1.4, 0.7, D + 1.4, 2), mats.pave, F(0, -0.2, 0));
    // ground floor: panel core, sea/street glass, wood slats, door with canopy
    const h1 = 3.2;
    b.add(tbox(W, h1, D, 4), mats.panel, F(0, 0.15 + h1 / 2, 0));
    glassBand(F, W * 0.56, 2.7, 0.15 + 1.45, D / 2 + 0.02);
    glassBand(F, W * 0.86, 2.7, 0.15 + 1.45, -D / 2 - 0.02);
    b.add(tbox(W * 0.24, 2.9, 0.12, 2), mats.wood, F(-W * 0.36, 0.15 + 1.55, D / 2 + 0.03));
    b.add(rbox(1.15, 2.35, 0.12, 0.04), acc, F(W * 0.38, 0.15 + 1.2, D / 2 + 0.05));
    b.add(rbox(0.08, 0.5, 0.1, 0.03), mats.steel, F(W * 0.38 - 0.4, 1.3, D / 2 + 0.13));
    b.add(rbox(2.6, 0.18, 1.6, 0.08), mats.trim, F(W * 0.38, 2.85, D / 2 + 0.8));
    b.add(new THREE.BoxGeometry(2.4, 0.04, 0.06), mats.led, F(W * 0.38, 2.75, D / 2 + 1.58));
    for (let k = 0; k < 2; k++) b.add(rbox(2.2, 0.16, 0.5, 0.04), mats.pave, F(W * 0.38, -0.05 + k * 0.16 - 0.1, D / 2 + 0.95 - k * 0.4));
    // first-floor slab with a soft LED line under the eave
    b.add(rbox(W + 0.9, 0.34, D + 0.9, 0.14), mats.trim, F(0, h1 + 0.32, 0));
    b.add(new THREE.BoxGeometry(W + 0.5, 0.04, 0.05), mats.led, F(0, h1 + 0.12, D / 2 + 0.44));
    // upper volume
    let ux = 0, uz = 0, uw = W * 0.7, ud = D * 0.92;
    if (v === 0) { ux = W * 0.15; uz = 0.9; }          // cantilevered over the entrance
    if (v === 1) { ux = -W * 0.12; uz = -0.4; uw = W * 0.66; }
    if (v === 2) { ux = W * 0.1; uz = -0.8; uw = W * 0.62; ud = D * 0.8; }
    const y2 = h1 + 0.5, h2 = 2.9;
    if (v === 1) b.add(rbox(uw, h2, ud, 1.3, 4), mats.panel, F(ux, y2 + h2 / 2, uz));
    else b.add(tbox(uw, h2, ud, 4), mats.panel, F(ux, y2 + h2 / 2, uz));
    glassBand(F, uw * (v === 1 ? 0.7 : 0.9), 2.3, y2 + 1.3, uz + ud / 2 + 0.03);
    glassBand(F, uw * 0.7, 2.3, y2 + 1.3, uz - ud / 2 - 0.03);
    if (v !== 1) { b.add(tbox(0.14, 2.2, ud * 0.5, 6, 6.6), mats.facade, F(ux + uw / 2 + 0.02, y2 + 1.3, uz)); }
    b.add(rbox(uw + 0.8, 0.32, ud + 0.8, 0.14), mats.trim, F(ux, y2 + h2 + 0.16, uz));
    // roof: green roof + solar array, terrace railing on the lower roof
    b.add(new THREE.BoxGeometry(uw - 0.2, 0.08, ud - 0.2), mats.lawn, F(ux, y2 + h2 + 0.36, uz));
    solarArray(F, ux, y2 + h2 + 0.3, uz - ud * 0.12, Math.max(2, Math.floor(uw / 1.3) - 1), 2);
    const tx0 = -W / 2 + 0.3, tx1 = ux - uw / 2 - 0.2;
    if (tx1 - tx0 > 1.5) {
      railRun(F, tx0, -D / 2 - 0.2, tx0, D / 2 + 0.2, h1 + 0.5); railRun(F, tx0, D / 2 + 0.25, tx1, D / 2 + 0.25, h1 + 0.5); railRun(F, tx0, -D / 2 - 0.25, tx1, -D / 2 - 0.25, h1 + 0.5);
      for (let k = 0; k < 3; k++) shrub(...wp(x, z, rot, tx0 + 0.8, -D / 2 + 1.5 + k * (D - 3) / 2).flatMap((v, i) => i === 0 ? [v, y + h1 + 0.6] : [v]), 0.45);
      b.add(rbox(1.6, 0.45, 0.6, 0.1), mats.wood, F((tx0 + tx1) / 2, h1 + 0.75, 0));
    }
    // curved stair tower for v1
    if (v === 1) {
      b.add(new THREE.CylinderGeometry(1.5, 1.5, h1 + h2 + 0.6, 24, 1, true), mats.glassClear, F(W / 2 - 1.2, (h1 + h2 + 0.6) / 2 + 0.15, D / 2 - 1.2));
      b.add(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 24), mats.trim, F(W / 2 - 1.2, h1 + h2 + 0.9, D / 2 - 1.2));
    }
    // back garden: pool for v0, pergola for v2
    if (v === 0) { b.add(tbox(W * 0.6, 0.5, 3.2, 2), mats.curb, F(-W * 0.1, -0.05, -D / 2 - 2.6)); b.add(new THREE.BoxGeometry(W * 0.56, 0.06, 2.8), mats.pool, F(-W * 0.1, 0.18, -D / 2 - 2.6)); }
    if (v === 2) { for (const sx of [-1, 1]) b.add(rbox(0.16, 2.6, 0.16, 0.05), mats.trim, F(sx * W * 0.3, 1.4, -D / 2 - 2.6)); b.add(tbox(W * 0.66, 0.12, 3.2, 2), mats.wood, F(0, 2.75, -D / 2 - 2.4)); }
    // garden hedges & a tree
    for (let k = 0; k < 4; k++) { const [hx, hz] = wp(x, z, rot, -W / 2 - 1.6, -D / 2 + k * D / 3); shrub(hx, y, hz, 0.7); }
    { const [tx, tz] = wp(x, z, rot, W / 2 + 2, -D / 2 + 1); tree(tx, y, tz, 0.9); }
    // colliders: ground floor, upper floor
    box(x, z, W + 0.9, D + 0.9, rot, y - 1, y + h1 + 0.49);
    const [cx, cz] = wp(x, z, rot, ux, uz); box(cx, cz, uw + 0.8, ud + 0.8, rot, y + h1 + 0.4, y + y2 + h2 + 0.32 - 0.0);
    { const [cx2, cz2] = wp(x, z, rot, W * 0.38, D / 2 + 0.8); box(cx2, cz2, 2.6, 1.6, rot, y + 2.75, y + 2.95, 'prop'); }
  }

  function tower(L) {
    const { x, z, rot, w: W, d: D, y, floors: NF } = L, F = frame(x, y, z, rot);
    const ph = R() * 6, fh = 3.3, y0 = 4.8, topY = y0 + NF * fh;
    const fac = R() < 0.5 ? mats.facade : mats.facade2;
    b.add(tbox(W + 2, 0.6, D + 2, 2), mats.pave, F(0, -0.15, 0));
    // lobby: double-height glass, entrance canopy with the building number
    b.add(tbox(W - 1, 4.4, D - 1, 6, 4.4), fac, F(0, 2.35, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rbox(0.6, 4.6, 0.6, 0.15), mats.trim, F(sx * (W / 2 - 0.6), 2.4, sz * (D / 2 - 0.6)));
    b.add(rbox(6, 0.3, 3.2, 0.12), mats.trim, F(0, 4.1, D / 2 + 1.4));
    b.add(new THREE.BoxGeometry(5.6, 0.04, 0.06), mats.led, F(0, 3.93, D / 2 + 2.98));
    // glass core
    b.add(tbox(W - 2.6, NF * fh, D - 2.6, 12, 13.2), fac, F(0, y0 + NF * fh / 2, 0));
    // wavy balcony slabs, glass railings, planters
    let maxW = W, maxD = D;
    for (let f = 0; f <= NF; f++) {
      const bw = W + 0.6 + 1.4 * Math.sin(f * 0.8 + ph), bd = D + 1.0 + 1.6 * Math.cos(f * 0.65 + ph);
      maxW = Math.max(maxW, bw); maxD = Math.max(maxD, bd);
      const fy = y0 + f * fh;
      b.add(rbox(bw, 0.32, bd, 1.0, 2), mats.trim, F(0, fy, 0));
      if (f === NF) break;
      for (const sz of [-1, 1]) {
        b.add(tbox(bw - 2.2, 1.0, 0.05, 2), mats.glassClear, F(0, fy + 0.66, sz * (bd / 2 - 0.1)));
        b.add(rbox(bw - 2.2, 0.06, 0.08, 0.03), mats.trim, F(0, fy + 1.18, sz * (bd / 2 - 0.1)));
      }
      if (f % 2 === 0) for (let k = -2; k <= 2; k++) { const [px, pz] = wp(x, z, rot, k * (bw - 3) / 4, bd / 2 - 0.55); if (R() < 0.7) shrub(px, y + fy + 0.2, pz, 0.42); }
    }
    // roof crown: frame, garden, antenna
    const cw = W - 1, cd = D - 1;
    for (const sz of [-1, 1]) b.add(rbox(cw, 0.4, 0.4, 0.12), mats.trim, F(0, topY + 2.6, sz * cd / 2));
    for (const sx of [-1, 1]) { b.add(rbox(0.4, 0.4, cd, 0.12), mats.trim, F(sx * cw / 2, topY + 2.6, 0)); for (const sz of [-1, 1]) b.add(rbox(0.3, 2.6, 0.3, 0.08), mats.trim, F(sx * cw / 2, topY + 1.3, sz * cd / 2)); }
    b.add(new THREE.BoxGeometry(W - 3, 0.1, D - 3), mats.lawn, F(0, topY + 0.2, 0));
    for (let k = 0; k < 5; k++) shrub(...wp(x, z, rot, (R() - 0.5) * (W - 5), (R() - 0.5) * (D - 5)).flatMap((v, i) => i === 0 ? [v, y + topY + 0.2] : [v]), 0.7);
    b.add(new THREE.CylinderGeometry(0.08, 0.14, 6, 8), mats.steel, F(W / 2 - 2.2, topY + 3.2, -D / 2 + 2.2));
    b.add(new THREE.SphereGeometry(0.22, 10, 8), mats.acc[0], F(W / 2 - 2.2, topY + 6.3, -D / 2 + 2.2));
    // number sign on the canopy
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: signTex([[`${L.name || '虹湾'}公寓`, 56, '#26334a', 0.55]], 512, 128, '#ffffff'), transparent: false }));
    const [sx, sz] = wp(x, z, rot, 0, D / 2 + 3.02); sign.position.set(sx, y + 4.42, sz); sign.rotation.y = rot; scene.add(sign);
    box(x, z, maxW, maxD, rot, y - 1, y + topY + 0.2);
    { const [cx, cz] = wp(x, z, rot, 0, D / 2 + 1.4); box(cx, cz, 6, 3.2, rot, y + 3.95, y + 4.25, 'prop'); }
  }

  function cafe(L) {
    const { x, z, y } = L, F = frame(x, y, z, L.rot);
    b.add(new THREE.CylinderGeometry(6.4, 6.6, 0.6, 40), mats.pave, F(0, -0.15, 0));
    b.add(new THREE.CylinderGeometry(4.6, 4.6, 3.0, 40, 1, true), mats.glassClear, F(0, 1.65, 0));
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; b.add(rbox(0.12, 3.1, 0.12, 0.04), mats.trim, F(Math.cos(a) * 4.6, 1.7, Math.sin(a) * 4.6)); }
    // floating roof disc with a soft rim and a skylight
    b.add(new THREE.CylinderGeometry(6.8, 6.4, 0.45, 48), mats.trim, F(0, 3.45, 0));
    b.add(new THREE.TorusGeometry(6.6, 0.22, 8, 48), mats.trim, F(0, 3.45, 0, Math.PI / 2, 0, 0));
    b.add(new THREE.CylinderGeometry(1.8, 1.8, 0.1, 24), mats.glassClear, F(0, 3.7, 0));
    b.add(new THREE.TorusGeometry(6.55, 0.05, 6, 48), mats.led, F(0, 3.18, 0, Math.PI / 2, 0, 0));
    // counter, stools, interior plants
    b.add(rbox(3.4, 1.05, 0.9, 0.2), mats.wood, F(0, 0.65, -1.6));
    b.add(rbox(3.6, 0.08, 1.1, 0.04), mats.trim, F(0, 1.2, -1.6));
    shrub(...wp(x, z, L.rot, 2.8, 2.6).flatMap((v, i) => i === 0 ? [v, y + 0.2] : [v]), 0.6);
    // terrace tables with parasols
    for (let k = 0; k < 5; k++) {
      const a = 0.4 + k * 0.62, tx = Math.cos(a) * 7.4, tz = Math.sin(a) * 7.4;
      if (tz < -2) continue;
      b.add(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16), mats.trim, F(tx, 0.92, tz));
      b.add(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), mats.steel, F(tx, 1.3, tz));
      b.add(new THREE.ConeGeometry(1.4, 0.55, 12, 1, true), mats.acc[k % mats.acc.length], F(tx, 2.55, tz));
      for (const ca of [0, Math.PI]) b.add(rbox(0.4, 0.45, 0.4, 0.06), mats.wood, F(tx + Math.cos(a + ca) * 0.9, 0.38, tz + Math.sin(a + ca) * 0.9));
      const [wx, wz] = wp(x, z, L.rot, tx, tz); C.add({ type: 'cyl', x: wx, z: wz, r: 0.6, top: y + 0.98, bottom: y - 0.5, tag: 'prop' });
    }
    C.add({ type: 'cyl', x, z, r: 4.75, top: y + 3.2, bottom: y - 1 });
    C.add({ type: 'cyl', x, z, r: 6.8, top: y + 3.68, bottom: y + 3.2 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: signTex([['虹 湾 咖 啡', 60, '#ffffff', 0.5]], 512, 128, 'rgba(38,51,74,0.92)') }));
    const [sx, sz] = wp(x, z, L.rot, 0, 6.85); sign.position.set(sx, y + 3.45, sz); sign.rotation.y = L.rot; scene.add(sign);
  }

  function terrace(L) {
    const { x, z, rot, w: W, d: D, y } = L, F = frame(x, y, z, rot);
    b.add(tbox(W + 2, 0.6, D + 2, 2), mats.pave, F(0, -0.15, 0));
    for (let f = 0; f < 3; f++) {
      const s = 1 - f * 0.14, fy = f * 4.2, w = W * s, d = D * s;
      b.add(rbox(w + 0.6, 0.6, d + 0.6, 0.25), mats.trim, F(0, fy + 0.3, 0));
      b.add(tbox(w - 0.6, 3.6, d - 0.6, 12, 13.2), mats.facade, F(0, fy + 2.4, 0));
      for (let k = 0; k < 12; k++) { const u = (k / 11 - 0.5) * (w - 1); shrub(...wp(x, z, rot, u, d / 2 + 0.05).flatMap((v, i) => i === 0 ? [v, y + fy + 0.55] : [v]), 0.5); }
      b.add(tbox(w + 0.2, 0.5, 0.5, 2), mats.curb, F(0, fy + 0.6, d / 2 + 0.05));
    }
    b.add(rbox(W * 0.58 + 0.6, 0.6, D * 0.58 + 0.6, 0.25), mats.trim, F(0, 12.9, 0));
    b.add(new THREE.BoxGeometry(W * 0.5, 0.1, D * 0.5), mats.lawn, F(0, 13.25, 0));
    solarArray(F, 0, 13.0, 0, 6, 2);
    box(x, z, W + 0.6, D + 0.6, rot, y - 1, y + 4.2);
    box(x, z, W * 0.86 + 0.6, D * 0.86 + 0.6, rot, y + 4.2, y + 8.4);
    box(x, z, W * 0.72 + 0.6, D * 0.72 + 0.6, rot, y + 8.4, y + 13.2);
    L.top = y + 13.3;
  }
  // terraced lots: a stone retaining wall wherever the graded lot meets higher or lower ground
  for (const L of P.lots) {
    const hw = L.w / 2 + 3, hd = L.d / 2 + 3;
    for (const [ex, ez, len, nx, nz] of [[0, hd, 2 * hw, 0, 1], [0, -hd, 2 * hw, 0, -1], [hw, 0, 2 * hd, 1, 0], [-hw, 0, 2 * hd, -1, 0]]) {
      const n = Math.max(1, Math.round(len / 1.6)), sl = len / n;
      for (let k = 0; k < n; k++) {
        const u = -len / 2 + (k + 0.5) * sl, lx = ex + (nz ? u : 0), lz = ez + (nx ? u : 0);
        if (nz === 1 && Math.abs(lx) < 2.2) continue;                        // gap for the front path
        const [px, pz] = wp(L.x, L.z, L.rot, lx, lz), [ox, oz] = wp(L.x, L.z, L.rot, lx + nx * 1.7, lz + nz * 1.7);
        const outer = H(ox, oz), [ix, iz] = wp(L.x, L.z, L.rot, lx - nx * 0.8, lz - nz * 0.8);
        if (Math.abs(outer - L.y) < 0.5) continue;
        const top = Math.max(L.y + 0.5, outer + 0.15), bot = Math.min(L.y, outer, H(px, pz), H(ix, iz)) - 0.6;
        const g = nz ? tbox(sl + 0.02, top - bot, 0.45, 3) : tbox(0.45, top - bot, sl + 0.02, 3);
        b.add(g, mats.stone, M(px, (top + bot) / 2, pz, 0, L.rot, 0));
        b.add(nz ? new THREE.BoxGeometry(sl + 0.04, 0.08, 0.55) : new THREE.BoxGeometry(0.55, 0.08, sl + 0.04), mats.trim, M(px, top + 0.04, pz, 0, L.rot, 0));
        box(px, pz, nz ? sl : 0.45, nz ? 0.45 : sl, L.rot, bot, top);
      }
    }
  }
  const names = ['晴川', '云栖', '海澜', '虹岸', '星屿', '澄湾'];
  let ni = 0;
  for (const L of P.lots) {
    if (L.kind === 'villa') villa(L);
    else if (L.kind === 'tower') { L.name = names[ni++ % names.length]; tower(L); }
    else if (L.kind === 'cafe') cafe(L);
    else if (L.kind === 'terrace') terrace(L);
  }

  // ================= elevated monorail over the boulevard =================
  {
    const rp = P.blvd.pts, rh = P.blvd.hs;
    const sel = []; for (let i = 2; i < rp.length - 2; i += 2) sel.push(i);
    const ys = smooth(sel.map((i) => rh[i] + 9.6), 2, 2);
    const pts = sel.map((i, k) => new THREE.Vector3(rp[i][0], ys[k], rp[i][1]));
    const rail = ctx.bridge(b, { ...ctx, mats }, pts, 5, 26, true);
    out.rail = rail;
    // stations
    const samples = 800;
    for (const st of P.stations) {
      const q = along(rp, st.s); let bu = 0, bd = Infinity;
      for (let k = 0; k <= samples; k++) { const p = rail.curve.getPointAt(k / samples); const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < bd) { bd = d; bu = k / samples; } }
      st.u = bu; st.rs = bu * rail.L;
      const p = rail.curve.getPointAt(bu), t = rail.curve.getTangentAt(bu), rot = Math.atan2(t.x, t.z);
      const F = frame(p.x, p.y, p.z, rot);
      const sea = Math.cos(rot) < 0 ? 1 : -1;                 // which local x side faces the bay
      const ground = nearest(P.blvd, p.x, p.z).h + 0.17;
      const top = 1.05, half = 15;
      for (const sx of [-1, 1]) {
        const xin = 2.75, xout = sx === sea ? 7.45 : 6.4, xc = sx * (xin + xout) / 2, wdt = xout - xin;
        b.add(tbox(wdt, 0.5, half * 2, 2), mats.pave, F(xc, top - 0.25, 0));
        b.add(rbox(wdt + 0.2, 0.42, half * 2 + 0.2, 0.15), mats.trim, F(xc, top - 0.62, 0));
        b.add(new THREE.BoxGeometry(0.05, 0.03, half * 2), mats.led, F(sx * (xin + 0.35), top + 0.02, 0));
        b.add(tbox(0.06, 1.15, half * 2, 2), mats.glassClear, F(sx * (xout - 0.05), top + 0.6, 0));
        b.add(rbox(0.12, 0.08, half * 2, 0.03), mats.trim, F(sx * (xout - 0.05), top + 1.2, 0));
        const gapEnd = (z) => sx === sea && z < 0;   // the stairs leave from this end
        for (const z of [-half, half]) {
          if (gapEnd(z)) { for (const [x0, x1] of [[xin, 5.35], [7.45, xout]]) if (x1 - x0 > 0.1) b.add(tbox(x1 - x0, 1.15, 0.06, 2), mats.glassClear, F(sx * (x0 + x1) / 2, top + 0.6, z + 0.03)); }
          else b.add(tbox(wdt, 1.15, 0.06, 2), mats.glassClear, F(xc, top + 0.6, z - Math.sign(z) * 0.03));
        }
        for (const z of [-10, 0, 10]) { b.add(rbox(0.36, 5.4, 0.36, 0.1), mats.trim, F(sx * (xout - 0.5), top + 2.7, z)); }
        for (const z of [-7, 7]) { const [bx3, bz3] = wp(p.x, p.z, rot, xc, z); bench(bx3, p.y + top, bz3, rot + (sx > 0 ? -Math.PI / 2 : Math.PI / 2)); }
        const [cx, cz] = wp(p.x, p.z, rot, xc, 0); box(cx, cz, wdt, half * 2, rot, p.y + top - 0.9, p.y + top);
        const [gx, gz] = wp(p.x, p.z, rot, sx * (xout - 0.05), 0); box(gx, gz, 0.25, half * 2, rot, p.y + top, p.y + top + 1.2, 'rail');
        for (const z of [-half, half]) {
          if (gapEnd(z)) { const x0 = xin, x1 = 5.35, [ex, ez] = wp(p.x, p.z, rot, sx * (x0 + x1) / 2, z); box(ex, ez, x1 - x0, 0.25, rot, p.y + top, p.y + top + 1.2, 'rail'); continue; }
          const [ex, ez] = wp(p.x, p.z, rot, xc, z); box(ex, ez, wdt, 0.25, rot, p.y + top, p.y + top + 1.2, 'rail');
        }
        // station name boards facing the track
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: signTex([[st.name, 64, '#ffffff', 0.42], [st.sub + '  ·  虹湾环线', 26, '#bfe8ff', 0.8]], 512, 128, 'rgba(32,52,84,0.96)') }));
        const [nx, nz] = wp(p.x, p.z, rot, sx * (xout - 0.3), 5); sg.position.set(nx, p.y + top + 3.3, nz); sg.rotation.y = rot - sx * Math.PI / 2; scene.add(sg);
      }
      // vaulted roof with a skylight spine
      {
        const r = 11, ph = 0.72, nA = 18, nZ = 2, len = half * 2 + 4, pos = [], idx = [];
        for (let j = 0; j <= nZ; j++) for (let i = 0; i <= nA; i++) { const a = -ph + 2 * ph * i / nA; pos.push(Math.sin(a) * r, Math.cos(a) * r - r + 7.6, -len / 2 + len * j / nZ); }
        for (let j = 0; j < nZ; j++) for (let i = 0; i < nA; i++) { const k = j * (nA + 1) + i; idx.push(k, k + nA + 1, k + 1, k + 1, k + nA + 1, k + nA + 2); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        b.add(g, mats.white, F(0, top, 0));
        b.add(tbox(2.2, 0.12, len, 2), mats.glassClear, F(0, top + 7.62, 0));
        for (let z = -len / 2; z <= len / 2 + 0.1; z += len / 6) b.add(new THREE.TorusGeometry(r, 0.12, 6, 24, 2 * ph), mats.trim, F(0, top + 7.6 - r, z, 0, 0, Math.PI / 2 - ph));
        const [rx, rz] = wp(p.x, p.z, rot, 0, 0); box(rx, rz, 2 * r * Math.sin(ph), len, rot, p.y + top + 5.6, p.y + top + 7.8);
      }
      // stairs from the platform end down to the bay-side pavement. The boulevard curves, so the flight
      // is aimed at a point on the pavement rather than run straight along the track.
      {
        const w = 1.9, sx = sea * 6.4;
        const [Sx, Sz] = wp(p.x, p.z, rot, sx, -half);
        const sTop = p.y + top;
        let fq = along(rp, Math.max(4, st.s - 30)); const nx0 = -fq.dz, nz0 = fq.dx;
        const Fx = fq.x - nx0 * sea * 6.7, Fz = fq.z - nz0 * sea * 6.7;
        const ground = rh[fq.i - 1] + (rh[fq.i] - rh[fq.i - 1]) * fq.t + 0.17;
        const rise = sTop - ground, n = Math.max(8, Math.round(rise / 0.3)), Lh = Math.hypot(Fx - Sx, Fz - Sz), a = Math.atan2(Fx - Sx, Fz - Sz), run = Lh / n;
        const G = frame(Sx, sTop, Sz, a);
        for (let k = 0; k < n; k++) b.add(tbox(w, 0.3, run + 0.03, 2), mats.pave, G(0, -(k + 0.5) * (rise / n) - 0.15, (k + 0.5) * run));
        const sl = Math.hypot(Lh, rise), ang = Math.atan2(rise, Lh);
        for (const e of [-1, 1]) {
          b.add(rbox(0.18, 0.7, sl, 0.06), mats.trim, G(e * (w / 2 + 0.09), -rise / 2 + 0.05, Lh / 2, ang, 0, 0));
          b.add(tbox(0.05, 1.0, sl, 2), mats.glassClear, G(e * (w / 2 + 0.09), -rise / 2 + 0.85, Lh / 2, ang, 0, 0));
          const [ax, az] = wp(Sx, Sz, a, e * (w / 2 + 0.09), 0), [bx2, bz2] = wp(Sx, Sz, a, e * (w / 2 + 0.09), Lh);
          C.add({ type: 'seg', ax, az, ay: sTop + 1.1, bx: bx2, bz: bz2, by: ground + 1.1, w: 0.12, thick: 1.0, tag: 'rail' });
        }
        for (const f of [0.35, 0.7]) { const hy = rise * (1 - f); b.add(rbox(0.4, hy + 0.2, 0.4, 0.1), mats.trim, G(0, -rise + hy / 2 - 0.3, f * Lh)); const [lx, lz] = wp(Sx, Sz, a, 0, f * Lh); C.add({ type: 'cyl', x: lx, z: lz, r: 0.3, top: ground + hy - 0.4, bottom: ground - 1, tag: 'prop' }); }
        C.add({ type: 'seg', ax: Sx, az: Sz, ay: sTop, bx: Fx, bz: Fz, by: ground, w: w / 2, thick: 0.5 });
        // holographic pylon just past the foot of the stairs
        const ux = (Fx - Sx) / Lh, uz = (Fz - Sz) / Lh, hx = Fx + ux * 2.4 - nx0 * sea * 0.2, hz = Fz + uz * 2.4 - nz0 * sea * 0.2;
        b.add(rbox(0.5, 4.2, 1.3, 0.12), mats.dark, M(hx, ground + 2.1, hz, 0, a, 0));
        const hm = new THREE.MeshBasicMaterial({ map: signTex([['虹', 150, '#ffffff', 0.2], [st.name, 82, '#ffffff', 0.5], ['MONORAIL', 34, '#9ee8ff', 0.74]], 256, 640, 'rgba(0,0,0,0)'), transparent: true, side: THREE.DoubleSide, depthWrite: false });
        const holo = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.9), hm); holo.position.set(hx, ground + 2.5, hz); holo.rotation.y = a + Math.PI / 2; scene.add(holo);
        C.add({ type: 'cyl', x: hx, z: hz, r: 0.6, top: ground + 4.2, bottom: ground - 1, tag: 'prop' });
        out.animate.push((t) => { hm.opacity = 0.82 + Math.sin(t * 3.1) * 0.08 + (Math.sin(t * 17) > 0.97 ? -0.3 : 0); });
        st.foot = [Fx + ux * 1.0 + nx0 * sea * 1.4, ground, Fz + uz * 1.0 + nz0 * sea * 1.4, a];
        st.stair = { S: new THREE.Vector3(Sx, sTop, Sz), F: new THREE.Vector3(Fx, ground, Fz) };
        if (typeof location !== 'undefined' && /debug/.test(location.search)) { const nn = nearest(P.blvd, Fx, Fz); console.log('LOG stairs', st.name, 'foot', Fx.toFixed(1), Fz.toFixed(1), 'ground', ground.toFixed(2), 'H', H(Fx, Fz).toFixed(2), 'roadDist', nn.d.toFixed(2), 'len', Lh.toFixed(1), 'steps', n); }
      }
      out.stations.push({ name: st.name, x: p.x, z: p.z, y: p.y + top, rs: st.rs, foot: st.foot, stair: st.stair });
    }
    // trains run the line and stop at both stations
    for (const [cars, s0, dir] of [[3, 0.25, 1], [2, 0.75, -1]]) {
      const t = ctx.makeTrain(mats, cars); scene.add(t.group);
      out.trains.push({ ...t, curve: rail.curve, L: rail.L, speed: 13, s: rail.L * s0, dir, wait: 0, deck: pts[0].y, stops: P.stations.map((s) => s.rs) });
    }
  }

  // ================= wind turbines on the ridge (vertical axis, slowly turning) =================
  {
    const bladeGeo = (() => {
      const gs = [];
      for (let k = 0; k < 3; k++) {
        const a0 = k / 3 * Math.PI * 2, pts = [];
        for (let i = 0; i <= 24; i++) { const t = i / 24, a = a0 + t * Math.PI * 0.75, r = 2.2 * Math.sin(Math.PI * (0.12 + 0.76 * t)) + 0.4; pts.push(new THREE.Vector3(Math.cos(a) * r, t * 10, Math.sin(a) * r)); }
        gs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.16, 6));
        for (const t of [0.25, 0.75]) { const a = a0 + t * Math.PI * 0.75, r = 2.2 * Math.sin(Math.PI * (0.12 + 0.76 * t)) + 0.4; const s = new THREE.CylinderGeometry(0.05, 0.05, r, 5); s.rotateZ(Math.PI / 2); s.translate(r / 2, t * 10, 0); s.rotateY(-a); gs.push(s); }
      }
      const tmp = new Batch(); for (const g of gs) tmp.add(g, mats.trim); const m = tmp.build(new THREE.Group())[0]; return m.geometry;
    })();
    for (const [x, z, y] of P.turbines) {
      b.add(new THREE.CylinderGeometry(1.7, 2.0, 0.9, 20), mats.curb, M(x, y + 0.2, z));
      b.add(new THREE.CylinderGeometry(0.32, 0.55, 15, 14), mats.trim, M(x, y + 7.9, z));
      b.add(new THREE.CylinderGeometry(0.42, 0.42, 0.7, 14), mats.steel, M(x, y + 15.6, z));
      b.add(new THREE.CylinderGeometry(0.12, 0.12, 10.6, 8), mats.steel, M(x, y + 20.9, z));
      const rotor = new THREE.Mesh(bladeGeo, mats.trim); rotor.position.set(x, y + 15.9, z); rotor.castShadow = true; scene.add(rotor);
      out.rotors.push(rotor);
      C.add({ type: 'cyl', x, z, r: 1.8, top: y + 0.65, bottom: y - 1 }); C.add({ type: 'cyl', x, z, r: 0.6, top: y + 15.6, bottom: y + 0.5, tag: 'prop' });
    }
    out.animate.push((t, dt) => { for (const r of out.rotors) r.rotation.y += dt * 0.9; });
  }

  // ================= street lamps (instanced) =================
  {
    const pole = new Batch();
    pole.add(new THREE.CylinderGeometry(0.2, 0.26, 0.4, 10), mats.trim, M(0, 0.2, 0));
    pole.add(new THREE.CylinderGeometry(0.07, 0.11, 5.2, 8), mats.trim, M(0, 2.8, 0));
    pole.add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 5.3, 0), new THREE.Vector3(0, 5.85, 0.2), new THREE.Vector3(0, 5.75, 1.25)), 10, 0.06, 6), mats.trim);
    pole.add(rbox(0.36, 0.12, 0.9, 0.05), mats.trim, M(0, 5.72, 1.45));
    const pg = pole.build(new THREE.Group())[0].geometry;
    const lg = new THREE.BoxGeometry(0.26, 0.03, 0.75); lg.translate(0, 5.65, 1.45);
    const pm = new THREE.InstancedMesh(pg, mats.trim, lamps.length), lm = new THREE.InstancedMesh(lg, mats.warm, lamps.length);
    const m4 = new THREE.Matrix4();
    lamps.forEach(([x, y, z, r], i) => { m4.copy(M(x, y, z, 0, r, 0)); pm.setMatrixAt(i, m4); lm.setMatrixAt(i, m4); });
    pm.castShadow = true; pm.receiveShadow = true; pm.computeBoundingSphere(); lm.computeBoundingSphere();
    scene.add(pm, lm);
    // night: a soft cone of light and a warm pool on the pavement under every lamp (additive, faded in by the day/night cycle)
    const radial = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,226,170,1)'); gr.addColorStop(0.45, 'rgba(255,214,150,0.45)'); gr.addColorStop(1, 'rgba(255,200,130,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const coneTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, 'rgba(255,230,180,0.9)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const poolM = new THREE.MeshBasicMaterial({ map: radial, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, fog: true });
    const coneM = new THREE.MeshBasicMaterial({ map: coneTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, side: THREE.DoubleSide, fog: true });
    const pg2 = new THREE.CircleGeometry(3.6, 24); pg2.rotateX(-Math.PI / 2); pg2.translate(0, 0.06, 1.45);
    const cg = new THREE.CylinderGeometry(0.2, 2.1, 5.5, 18, 1, true); cg.translate(0, 2.9, 1.45);
    const pool = new THREE.InstancedMesh(pg2, poolM, lamps.length), cone = new THREE.InstancedMesh(cg, coneM, lamps.length);
    lamps.forEach(([x, y, z, r], i) => { m4.copy(M(x, y, z, 0, r, 0)); pool.setMatrixAt(i, m4); cone.setMatrixAt(i, m4); });
    pool.computeBoundingSphere(); cone.computeBoundingSphere(); pool.renderOrder = 2; cone.renderOrder = 3; pool.visible = cone.visible = false;
    poolM.userData = { nightO: 0.55, mesh: [pool] }; coneM.userData = { nightO: 0.16, mesh: [cone] };
    out.nightFx.push(poolM, coneM);
    scene.add(pool, cone);
  }
  // signpost to the 回廊 gate
  {
    const r = P.domRoad, q = along(r.pts, 6), h = r.hs[q.i - 1], x = q.x - q.dz * 4.6, z = q.z + q.dx * 4.6;
    b.add(rbox(0.14, 3.0, 0.14, 0.05), mats.trim, M(x, h + 1.6, z));
    const sm = new THREE.MeshBasicMaterial({ map: signTex([['回廊  →', 62, '#ffffff', 0.5]], 256, 96, 'rgba(70,58,120,0.95)') });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), sm); s.position.set(x, h + 2.75, z); s.rotation.y = Math.atan2(q.dx, q.dz) - Math.PI / 2; scene.add(s);
    const s2 = s.clone(); s2.rotation.y += Math.PI; s2.position.set(x + q.dx * 0.02, h + 2.75, z + q.dz * 0.02); scene.add(s2);
    C.add({ type: 'cyl', x, z, r: 0.2, top: h + 3.2, bottom: h - 1, tag: 'prop' });
  }

  // ================= hover cars on the boulevard & delivery drones =================
  {
    const road = P.blvd, n = 6;
    const bodyG = rbox(1.9, 0.75, 4.3, 0.36, 3), canG = new THREE.SphereGeometry(1, 20, 12); canG.scale(0.82, 0.5, 1.45);
    const glowG = new THREE.PlaneGeometry(1.6, 3.6); glowG.rotateX(-Math.PI / 2);
    const canM = new THREE.MeshStandardMaterial({ color: '#16304f', roughness: 0.08, metalness: 0.6, envMapIntensity: 1.4 });
    const glowM = new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.45, depthWrite: false });
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyG, i % 3 === 0 ? mats.trim : mats.acc[(i * 2) % mats.acc.length]); body.castShadow = true; g.add(body);
      const can = new THREE.Mesh(canG, canM); can.position.set(0, 0.42, -0.2); g.add(can);
      const glow = new THREE.Mesh(glowG, glowM); glow.position.y = -0.48; g.add(glow);
      scene.add(g);
      const dir = i % 2 ? 1 : -1;
      out.cars.push({ g, s: road.L * (i + 0.5) / n, dir, v: 0, vmax: 8 + R() * 3, ph: R() * 6 });
    }
    out.road = road;
    const droneG = new Batch();
    droneG.add(rbox(0.7, 0.2, 0.7, 0.08), mats.trim);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { droneG.add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), mats.steel, M(sx * 0.3, 0.05, sz * 0.3, 0, Math.atan2(sx, sz), Math.PI / 2)); droneG.add(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 14), mats.dark, M(sx * 0.48, 0.14, sz * 0.48)); }
    droneG.add(rbox(0.36, 0.3, 0.36, 0.06), mats.acc[1], M(0, -0.25, 0));
    const dg = droneG.build(new THREE.Group());
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group(); for (const m of dg) g.add(m.clone());
      scene.add(g);
      const q = along(road.pts, road.L * (0.15 + i * 0.22)); const h = road.hs[q.i - 1];
      out.drones.push({ g, cx: q.x, cz: q.z, cy: h + 17 + i * 2, r: 18 + i * 4, sp: 0.18 + i * 0.04, ph: i * 1.7 });
    }
  }

  b.build(scene);
  // the far end of the terrace building carries a crystal
  const ter = P.lots.find((l) => l.kind === 'terrace'); if (ter) out.terrace = { x: ter.x, z: ter.z, top: ter.top };
  return out;
}

// cars cruise their lane, stop for the player, turn round at the ends; drones circle the boulevard
export function updateCity(city, dt, t, player) {
  if (!city || !city.road) return;
  const road = city.road, P = player.pos;
  for (const a of city.animate) a(t, dt);
  for (const c of city.cars) {
    const q = along(road.pts, c.s), nx = -q.dz, nz = q.dx, lane = -c.dir * 3.4;
    const x = q.x + nx * lane, z = q.z + nz * lane;
    const fx = q.dx * c.dir, fz = q.dz * c.dir;
    // yield to the player and keep distance to the car ahead
    const px = P.x - x, pz = P.z - z, ahead = px * fx + pz * fz, lat = Math.abs(px * -fz + pz * fx);
    let want = c.vmax;
    c.forPlayer = false;
    if (ahead > -1 && ahead < 9 && lat < 2.2 && Math.abs(P.y - (road.hs[q.i - 1] + 1)) < 3) { want = 0; c.forPlayer = true; }
    for (const o of city.cars) if (o !== c && o.dir === c.dir) { const gap = (o.s - c.s) * c.dir; if (gap > 0 && gap < 9) want = Math.min(want, Math.max(0, (gap - 6) * 2)); }
    c.v += (want - c.v) * Math.min(1, dt * (want < c.v ? 4 : 1.2));
    c.s += c.v * c.dir * dt;
    if (c.forPlayer && c.v < 0.3) city.carStopped = (city.carStopped || 0) + dt;
    if (c.s > road.L - 4) { c.s = road.L - 4; c.dir = -1; c.v = 0; }
    if (c.s < 4) { c.s = 4; c.dir = 1; c.v = 0; }
    const h = road.hs[q.i - 1] + (road.hs[q.i] - road.hs[q.i - 1]) * q.t;
    c.g.position.set(x, h + 0.75 + Math.sin(t * 2.2 + c.ph) * 0.05, z);
    c.g.rotation.y = Math.atan2(fx, fz);
    c.x = x; c.z = z; c.fx = fx; c.fz = fz; c.y = h;
  }
  for (const d of city.drones) {
    if (d.down) continue;
    const a = t * d.sp + d.ph;
    d.g.position.set(d.cx + Math.sin(a) * d.r, d.cy + Math.sin(a * 2.3) * 1.2, d.cz + Math.sin(a * 2) * d.r * 0.5);
    d.g.rotation.y = Math.atan2(Math.cos(a) * d.r, Math.cos(a * 2) * d.r);
  }
}
