import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, M, bladeGeo, latheGeo, ribbonGeo } from './geo.js';
import { H, rawH0, addPad, coastX, ISLANDS } from './terrain.js';
import { rng } from './noise.js';

const GREENS = ['#6db83a', '#85c94a', '#5aa232', '#9fd65a', '#4f9330'];

export function makeMaterials() {
  return {
    white: new THREE.MeshStandardMaterial({ color: '#eef1f4', roughness: 0.4, metalness: 0.04, side: THREE.DoubleSide }),
    plaza: new THREE.MeshStandardMaterial({ color: '#dfe4e7', roughness: 0.85, metalness: 0.0 }),
    whiteMatte: new THREE.MeshStandardMaterial({ color: '#eceff1', roughness: 0.7, metalness: 0.0, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: '#4fa9ee', roughness: 0.07, metalness: 0.8, envMapIntensity: 1.5 }),
    glassDark: new THREE.MeshStandardMaterial({ color: '#1f5fa6', roughness: 0.1, metalness: 0.7, envMapIntensity: 1.3 }),
    glassClear: new THREE.MeshStandardMaterial({ color: '#c8f1ff', roughness: 0.03, metalness: 0.25, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 2.0 }),
    gold: new THREE.MeshStandardMaterial({ color: '#e9c77b', roughness: 0.3, metalness: 0.6 }),
    crystal: new THREE.MeshStandardMaterial({ color: '#7fe9ff', emissive: '#3fd8ff', emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92 }),
  };
}

function helixPts(cx, cz, r, y0, y1, a0, turns, step = 1.6) {
  const len = Math.abs(turns) * Math.PI * 2 * r;
  const n = Math.max(4, Math.ceil(len / step));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; const a = a0 + turns * Math.PI * 2 * t;
    pts.push(new THREE.Vector3(cx + Math.cos(a) * r, y0 + (y1 - y0) * t, cz + Math.sin(a) * r));
  }
  return pts;
}

function walkway(b, ctx, pts, width, thick = 0.5, mat) {
  b.add(ribbonGeo(pts, width, () => thick), mat || ctx.mats.white);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], c = pts[i + 1];
    ctx.colliders.add({ type: 'seg', ax: a.x, az: a.z, ay: a.y, bx: c.x, bz: c.z, by: c.y, w: width / 2, thick: thick + 0.4 });
  }
}

function ringPlatform(b, ctx, x, y, z, r0, r1, thick = 0.6) {
  const pts = [new THREE.Vector2(r0, -thick), new THREE.Vector2(r1, -thick), new THREE.Vector2(r1 + 0.2, -thick * 0.4), new THREE.Vector2(r1, 0), new THREE.Vector2(r0, 0), new THREE.Vector2(r0, -thick)];
  b.add(new THREE.LatheGeometry(pts, 56), ctx.mats.white, M(x, y, z));
  ctx.colliders.add({ type: 'ring', x, z, r0, r1, top: y, bottom: y - thick - 0.4 });
}

function greenTower(b, ctx, x, y0, z, r, h, R) {
  const { mats, foliage, colliders } = ctx;
  b.add(new THREE.CylinderGeometry(r + 1.5, r + 1.8, 4.2, 40), mats.plaza, M(x, y0 - 1.6, z));
  b.add(new THREE.CylinderGeometry(r + 1.25, r + 1.25, 3.2, 40, 1, true), mats.glassDark, M(x, y0 + 1.9, z));
  b.add(new THREE.CylinderGeometry(r * 0.94, r, h, 36, 1, true), mats.glass, M(x, y0 + h / 2, z));
  for (let fy = 3.4; fy < h - 1; fy += 3.6) {
    b.add(new THREE.CylinderGeometry(r + 1.1, r + 1.0, 0.45, 40), mats.white, M(x, y0 + fy, z));
    const n = Math.round((r + 1) * 3.3);
    for (let k = 0; k < n; k++) {
      if (R() < 0.22) continue;
      const a = k / n * Math.PI * 2 + R() * 0.2;
      const s = 0.65 + R() * 0.45;
      foliage.add(x + Math.cos(a) * (r + 0.6), y0 + fy + 0.25 + s * 0.4, z + Math.sin(a) * (r + 0.6), s, s * 0.7, s, GREENS[Math.floor(R() * GREENS.length)], R() * 6);
      if (R() < 0.3) foliage.add(x + Math.cos(a) * (r + 1.0), y0 + fy - 0.9, z + Math.sin(a) * (r + 1.0), 0.35, 1.1, 0.35, GREENS[4], 0);
    }
  }
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.4, h, 0.8), mats.white, M(x + Math.cos(a) * (r + 0.25), y0 + h / 2, z + Math.sin(a) * (r + 0.25), 0, -a, 0));
  }
  b.add(new THREE.SphereGeometry(r + 1.1, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.white, M(x, y0 + h, z, 0, 0, 0, 1, 0.32, 1));
  colliders.add({ type: 'cyl', x, z, r: r + 1.1, top: y0 + h, bottom: y0 - 3 });
  colliders.add({ type: 'ell', x, y: y0 + h, z, rx: r + 1.1, ry: (r + 1.1) * 0.32, rz: r + 1.1, bottom: y0 + h - 0.2 });
}

// two sloped wall segments that follow a sail blade's tent-like outline
function bladeCollider(colliders, bx, by, bz, rotY, hgt, w, lean) {
  const ax = Math.cos(rotY), az = -Math.sin(rotY);
  const hw = w / 2 * 0.95, pk = Math.max(-hw * 0.5, Math.min(hw * 0.5, lean * 0.4));
  const Lx = bx - ax * hw, Lz = bz - az * hw, Cx = bx + ax * pk, Cz = bz + az * pk, Rx = bx + ax * hw, Rz = bz + az * hw;
  colliders.add({ type: 'seg', ax: Lx, az: Lz, ay: by + hgt * 0.32, bx: Cx, bz: Cz, by: by + hgt * 0.92, w: 0.8, thick: hgt + 3 });
  colliders.add({ type: 'seg', ax: Cx, az: Cz, ay: by + hgt * 0.92, bx: Rx, bz: Rz, by: by + hgt * 0.32, w: 0.8, thick: hgt + 3 });
}

function crown(b, ctx, x, y0, z, heights, Rr, coreH, R, lean = 3.5) {
  const { mats, colliders } = ctx;
  b.add(latheGeo(coreH, 3.6, (t) => 1 - 0.35 * t, 32, 12), mats.glass, M(x, y0, z));
  for (let ry = 6; ry < coreH; ry += 6) b.add(new THREE.TorusGeometry(3.6 * (1 - 0.35 * ry / coreH) + 0.15, 0.18, 6, 40), mats.white, M(x, y0 + ry, z, Math.PI / 2, 0, 0));
  heights.forEach((hgt, k) => {
    const a = k / heights.length * Math.PI * 2 + 0.3;
    const bx = x + Math.cos(a) * Rr, bz = z + Math.sin(a) * Rr;
    const bw = 7.5 + hgt * 0.06, bl = lean + (k % 2) * 2.2;
    const g = bladeGeo(hgt, bw, bl, 0.9, 0.05);
    b.add(g, mats.white, M(bx, y0 - 0.5, bz, 0.07, Math.PI / 2 - a, 0));
    bladeCollider(colliders, bx, y0 - 0.5, bz, Math.PI / 2 - a, hgt, bw, bl);
  });
  colliders.add({ type: 'cyl', x, z, r: Math.min(Rr, 4.8), top: y0 + coreH, bottom: y0 - 3 });
}

function shell(b, ctx, x, y, z, r, rot, sy, arc = 1.1) {
  b.add(new THREE.SphereGeometry(r, 40, 14, 0, Math.PI * arc, 0, Math.PI / 2), ctx.mats.white, M(x, y, z, 0, rot, 0, 1, sy, 0.75));
  ctx.colliders.add({ type: 'ell', x, y, z, rx: r * 0.95, ry: r * sy * 0.98, rz: r * 0.72, rot, bottom: y - 2 });
}

export function dome(b, ctx, x, y, z, r, trees = true) {
  const { mats, foliage, colliders } = ctx;
  b.add(new THREE.SphereGeometry(r, 44, 18, 0, Math.PI * 2, 0, Math.PI / 2), mats.glassClear, M(x, y, z));
  for (let k = 0; k < 7; k++) b.add(new THREE.TorusGeometry(r, 0.13, 6, 44, Math.PI), mats.white, M(x, y, z, 0, k / 7 * Math.PI, 0));
  for (const phi of [0.33, 0.68, 1.02, 1.3]) b.add(new THREE.TorusGeometry(r * Math.cos(phi), 0.11, 6, 48), mats.white, M(x, y + r * Math.sin(phi), z, Math.PI / 2, 0, 0));
  b.add(new THREE.CylinderGeometry(r + 0.6, r + 1.0, 4.6, 48), mats.white, M(x, y - 1.4, z));
  {
    const a = (x * 0.37 + z * 0.11) % (Math.PI * 2), ex = x + Math.cos(a) * (r + 1.2), ez = z + Math.sin(a) * (r + 1.2), rot = Math.PI / 2 - a;
    b.add(new THREE.BoxGeometry(4.2, 3.2, 3.2), mats.glassClear, M(ex, y + 2.4, ez, 0, rot, 0));
    b.add(new RoundedBoxGeometry(4.8, 0.35, 3.8, 2, 0.15), mats.white, M(ex, y + 4.1, ez, 0, rot, 0));
    for (const sx of [-1, 1]) b.add(new THREE.BoxGeometry(0.25, 3.2, 3.4), mats.white, M(ex + Math.cos(rot) * sx * 2.2, y + 2.4, ez - Math.sin(rot) * sx * 2.2, 0, rot, 0));
    colliders.add({ type: 'box', x: ex, z: ez, hw: 2.4, hd: 1.9, rot, top: y + 4.3, bottom: y - 1 });
  }
  if (trees) {
    const R = rng(Math.floor(x * 13 + z));
    for (let i = 0; i < 6; i++) {
      const a = R() * 6.28, rr = R() * r * 0.55, s = 1.2 + R() * 1.6;
      foliage.add(x + Math.cos(a) * rr, y + s * 0.8 + R() * r * 0.25, z + Math.sin(a) * rr, s, s, s, GREENS[Math.floor(R() * 5)], R() * 6);
    }
  }
  colliders.add({ type: 'ell', x, y, z, rx: r, ry: r, rz: r, bottom: y - 2 });
}

function spire(b, ctx, x, y0, z, h, r, opts = {}) {
  const { mats, colliders } = ctx;
  const prof = (t) => Math.pow(1 - t, 1.15) * (1 + 0.3 * Math.sin(t * Math.PI * 2.6) * (1 - t)) + 0.004;
  b.add(latheGeo(h, r, prof, 28, 64), mats.white, M(x, y0, z));
  // grounded: plinth below, a glazed lobby ring and an entrance canopy at street level
  b.add(new THREE.CylinderGeometry(r + 1.6, r + 2.0, 4.4, 32), mats.plaza, M(x, y0 - 1.8, z));
  b.add(new THREE.CylinderGeometry(r + 0.45, r + 0.45, 3.4, 32, 1, true), mats.glassDark, M(x, y0 + 2.1, z));
  b.add(new THREE.CylinderGeometry(r + 0.9, r + 0.9, 0.35, 32), mats.white, M(x, y0 + 3.95, z));
  {
    const a = opts.door ?? ((x * 0.13 + z * 0.07) % (Math.PI * 2));
    b.add(new RoundedBoxGeometry(4.2, 0.3, 3.0, 2, 0.12), mats.white, M(x + Math.cos(a) * (r + 1.8), y0 + 3.3, z + Math.sin(a) * (r + 1.8), 0, Math.PI / 2 - a, 0));
    b.add(new THREE.BoxGeometry(2.0, 2.6, 0.2), mats.glass, M(x + Math.cos(a) * (r + 0.55), y0 + 1.5, z + Math.sin(a) * (r + 0.55), 0, Math.PI / 2 - a, 0));
  }
  if (h > 45) {
    const t = 0.62, rr = r * prof(t);
    b.add(new THREE.CylinderGeometry(rr + 2.4, rr + 1.6, 0.6, 36), mats.white, M(x, y0 + h * t, z));
    b.add(new THREE.CylinderGeometry(rr + 2.3, rr + 2.3, 1.1, 36, 1, true), mats.glassClear, M(x, y0 + h * t + 0.85, z));
    b.add(new THREE.CylinderGeometry(rr + 0.9, rr + 0.9, 2.6, 30, 1, true), mats.glassDark, M(x, y0 + h * t + 1.6, z));
    b.add(new THREE.TorusGeometry(rr + 2.3, 0.06, 6, 40), mats.gold, M(x, y0 + h * t + 1.4, z, Math.PI / 2, 0, 0));
  }
  b.add(new THREE.CylinderGeometry(0.06, 0.12, h * 0.12, 6), mats.gold, M(x, y0 + h * 1.04, z));
  // 集光塔: tall spires carry a collector prism that draws light down from the rainbow
  if (h > 45 && ctx.tips) {
    const cy = y0 + h * 0.9, cr = Math.max(0.9, r * prof(0.9) + 0.8);
    b.add(new THREE.TorusGeometry(cr, 0.14, 8, 36), mats.gold, M(x, cy, z, Math.PI / 2, 0, 0));
    b.add(new THREE.TorusGeometry(cr * 0.8, 0.08, 6, 36), mats.gold, M(x, cy + 1.2, z, Math.PI / 2, 0, 0));
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; b.add(new THREE.OctahedronGeometry(0.42, 0), mats.crystal, M(x + Math.cos(a) * cr, cy + 0.55, z + Math.sin(a) * cr, 0, a, 0, 0.7, 1.5, 0.7)); }
    ctx.tips.push({ x, y: y0 + h * 1.0, z, ring: cy });
  }
  const bands = opts.bands || [0.18, 0.3, 0.42, 0.55];
  for (const t of bands) {
    const rr = r * prof(t) + 0.12;
    b.add(new THREE.CylinderGeometry(rr * 0.98, rr, h * 0.035, 28, 1, true), mats.glass, M(x, y0 + h * t, z));
  }
  if (opts.collide !== false) {
    const S = [0, 0.1, 0.2, 0.32, 0.45, 0.6, 0.75, 0.88];
    for (let i = 0; i < S.length - 1; i++) {
      let mr = 0; for (let k = 0; k <= 4; k++) mr = Math.max(mr, prof(S[i] + (S[i + 1] - S[i]) * k / 4));
      colliders.add({ type: 'cyl', x, z, r: Math.max(0.35, r * mr * 0.98), top: y0 + h * S[i + 1], bottom: i === 0 ? y0 - 3 : y0 + h * S[i] - 0.2 });
    }
    colliders.add({ type: 'cyl', x, z, r: r + 1.0, top: y0 + 4.1, bottom: y0 - 3 });
  }
}

function pod(b, ctx, x, y, z, w, hgt, d, rot) {
  b.add(new THREE.BoxGeometry(w + 1.2, 3.4, d + 1.2), ctx.mats.plaza, M(x, y - 1.55, z, 0, rot, 0));
  b.add(new RoundedBoxGeometry(w, hgt, d, 3, Math.min(1.6, hgt * 0.45)), ctx.mats.white, M(x, y + hgt / 2 + 0.15, z, 0, rot, 0));
  b.add(new THREE.BoxGeometry(w * 0.92, hgt * 0.42, d + 0.12), ctx.mats.glassDark, M(x, y + hgt * 0.45 + 0.1, z, 0, rot, 0));
  b.add(new THREE.BoxGeometry(w * 0.7, 0.12, d * 0.6), new THREE.MeshLambertMaterial({ color: '#7cc24c' }), M(x, y + hgt + 0.18, z, 0, rot, 0));
  if (ctx.foliage) for (let k = -1; k <= 1; k++) ctx.foliage.add(x + Math.cos(rot) * k * w * 0.25, y + hgt + 0.55, z - Math.sin(rot) * k * w * 0.25, 0.8, 0.6, 0.8, GREENS[(k + 4) % 5], k);
  const ca = Math.cos(rot), sa = Math.sin(rot);
  const hx = (w / 2 - d / 2);
  ctx.colliders.add({ type: 'box', x, z, hw: w / 2, hd: d / 2, rot, top: y + hgt + 0.15, bottom: y - 3 });
}

function terraceBuilding(b, ctx, x, y, z, w, d, floors, rot, R) {
  const { mats, foliage } = ctx;
  for (let f = 0; f < floors; f++) {
    const s = 1 - f * 0.12;
    const fy = y + f * 4.2;
    b.add(new RoundedBoxGeometry(w * s, 0.8, d * s, 2, 0.35), mats.white, M(x, fy + 0.4, z, 0, rot, 0));
    b.add(new THREE.BoxGeometry(w * s * 0.94, 3.4, d * s * 0.9), mats.glass, M(x, fy + 2.5, z, 0, rot, 0));
    // terrace planting
    const n = 10;
    for (let k = 0; k < n; k++) {
      const u = (k / (n - 1) - 0.5) * w * s * 0.9;
      const ca = Math.cos(rot), sa = Math.sin(rot);
      const ox = u * ca + (d * s * 0.47) * sa, oz = -u * sa + (d * s * 0.47) * ca;
      foliage.add(x + ox, fy + 1.1, z + oz, 0.7 + R() * 0.3, 0.45, 0.7, GREENS[Math.floor(R() * 5)], R() * 6);
    }
  }
  b.add(new RoundedBoxGeometry(w * (1 - floors * 0.12), 0.8, d * (1 - floors * 0.12), 2, 0.35), mats.white, M(x, y + floors * 4.2 + 0.4, z, 0, rot, 0));
  const ca = Math.cos(rot), sa = Math.sin(rot), hx = Math.max(0, w / 2 - d / 2);
  ctx.colliders.add({ type: 'seg', ax: x - ca * hx, az: z + sa * hx, ay: y + floors * 4.2 + 0.8, bx: x + ca * hx, bz: z - sa * hx, by: y + floors * 4.2 + 0.8, w: d / 2, thick: floors * 4.2 + 3 });
}

// Viaduct with arched spans, parapets, monorail beam and pillars.
function bridge(b, ctx, pts, deckW = 5, span = 26, collide = true) {
  const { mats, colliders } = ctx;
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const L = curve.getLength();
  const n = Math.ceil(L / 2);
  const sp = curve.getSpacedPoints(n);
  const thick = (t) => { const s = t * L; const f = (s % span) / span; return 0.9 + 2.3 * Math.pow(1 - Math.sin(Math.PI * f), 2.2); };
  b.add(ribbonGeo(sp, deckW, thick), mats.white);
  // parapets + monorail beam
  const left = [], right = [], beam = [];
  for (let i = 0; i < sp.length; i++) {
    const a = sp[Math.max(0, i - 1)], c = sp[Math.min(sp.length - 1, i + 1)];
    const t = new THREE.Vector3(c.x - a.x, 0, c.z - a.z).normalize();
    const side = new THREE.Vector3(-t.z, 0, t.x);
    left.push(sp[i].clone().addScaledVector(side, deckW / 2 - 0.15).add(new THREE.Vector3(0, 1.0, 0)));
    right.push(sp[i].clone().addScaledVector(side, -deckW / 2 + 0.15).add(new THREE.Vector3(0, 1.0, 0)));
    beam.push(sp[i].clone().add(new THREE.Vector3(0, 0.55, 0)));
  }
  b.add(ribbonGeo(left, 0.22, () => 1.0), mats.white);
  b.add(ribbonGeo(right, 0.22, () => 1.0), mats.white);
  b.add(ribbonGeo(beam, 1.1, () => 0.55), mats.whiteMatte);
  // pillars
  for (let s = span; s < L - 2; s += span) {
    const p = curve.getPointAt(s / L);
    const g = H(p.x, p.z);
    const hgt = p.y - 3.1 - (g - 1);
    if (hgt < 1) continue;
    b.add(new THREE.CylinderGeometry(0.9, 1.35, hgt, 18), mats.white, M(p.x, g - 1 + hgt / 2, p.z));
    b.add(new THREE.CylinderGeometry(2.2, 1.0, 1.2, 18), mats.white, M(p.x, p.y - 3.1 + 0.4, p.z));
    if (collide) colliders.add({ type: 'cyl', x: p.x, z: p.z, r: 1.3, top: p.y - 3.1, bottom: g - 2 });
  }
  if (collide) for (let i = 0; i < sp.length - 1; i++) {
    const a = sp[i], c = sp[i + 1];
    colliders.add({ type: 'seg', ax: a.x, az: a.z, ay: a.y, bx: c.x, bz: c.z, by: c.y, w: deckW / 2, thick: 1.3 });
    for (const side of [left, right]) {
      const p0 = side[i], p1 = side[i + 1];
      colliders.add({ type: 'seg', ax: p0.x, az: p0.z, ay: p0.y, bx: p1.x, bz: p1.z, by: p1.y, w: 0.14, thick: 1.15, tag: 'rail' });
    }
  }
  return { curve, L };
}

function makeTrain(mats, cars = 3) {
  const group = new THREE.Group();
  const body = new THREE.CapsuleGeometry(1.35, 7.2, 6, 16); body.rotateX(Math.PI / 2);
  const band = new THREE.CapsuleGeometry(1.38, 6.4, 6, 16); band.rotateX(Math.PI / 2);
  const skirt = new THREE.BoxGeometry(1.6, 0.8, 8.6);
  const glass = new THREE.MeshStandardMaterial({ color: '#163c6e', roughness: 0.1, metalness: 0.6, emissive: '#0d2a55', emissiveIntensity: 0.4 });
  const stripe = new THREE.MeshStandardMaterial({ color: '#3fb7ff', emissive: '#2aa8ff', emissiveIntensity: 0.6, roughness: 0.3 });
  const stripeG = new THREE.BoxGeometry(2.78, 0.12, 8.8);
  const list = [];
  for (let i = 0; i < cars; i++) {
    const car = new THREE.Group();
    const m1 = new THREE.Mesh(body, mats.white); m1.scale.set(1, 1.08, 1); m1.castShadow = true; car.add(m1);
    const m2 = new THREE.Mesh(band, glass); m2.scale.set(1, 0.3, 1); m2.position.y = 0.42; car.add(m2);
    const m3 = new THREE.Mesh(skirt, mats.whiteMatte); m3.position.y = -1.2; car.add(m3);
    const m4 = new THREE.Mesh(stripeG, stripe); m4.position.y = -0.25; car.add(m4);
    group.add(car); list.push(car);
  }
  return { group, cars: list };
}

function waypoint(scene, mats, x, y, z, colliders) {
  if (colliders) {
    colliders.add({ type: 'cyl', x, z, r: 1.05, top: y + 0.35, bottom: y - 1 });
    colliders.add({ type: 'cyl', x, z, r: 0.32, top: y + 2.5, bottom: y + 0.3, noClimb: true });
  }
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.35, 24), mats.white); base.position.y = 0.17;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.0, 12), mats.white); col.position.y = 1.2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 32), mats.gold); ring.position.y = 2.3; ring.rotation.x = Math.PI / 2;
  const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), mats.crystal); cr.position.y = 2.95; cr.scale.set(1, 1.6, 1);
  [base, col, ring].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  g.add(base, col, ring, cr);
  g.position.set(x, y, z);
  scene.add(g);
  return { group: g, crystal: cr, ring };
}

// 虹之像 — a statue that restores and revives the party, and accepts rainbow crystals
export function makeStatue(scene, mats, colliders, x, y, z, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
  const marble = new THREE.MeshStandardMaterial({ color: '#f3f1ea', roughness: 0.55, metalness: 0.05 });
  const add = (geo, mat, px, py, pz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(3.3, 3.6, 0.5, 8), marble, 0, 0.25, 0, 0, Math.PI / 8);
  add(new THREE.TorusGeometry(3.32, 0.07, 6, 8), mats.gold, 0, 0.5, 0, Math.PI / 2, 0, Math.PI / 8);
  add(new THREE.CylinderGeometry(2.4, 2.6, 0.45, 8), marble, 0, 0.72, 0, 0, Math.PI / 8);
  add(new THREE.CylinderGeometry(1.25, 1.55, 0.9, 12), marble, 0, 1.4, 0);
  // robed figure
  add(new THREE.CylinderGeometry(0.55, 1.35, 3.6, 18), marble, 0, 3.6, 0);
  add(new THREE.CylinderGeometry(0.42, 0.55, 1.2, 14), marble, 0, 5.95, 0);
  add(new THREE.SphereGeometry(0.42, 18, 14), marble, 0, 6.9, 0);
  add(new THREE.ConeGeometry(0.62, 1.1, 16, 1, true), marble, 0, 7.05, -0.08, -0.25);
  for (const s of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.15, 1.3, 4, 10), marble, s * 0.55, 6.6, 0.25, -0.6, 0, s * 0.45);
    add(new THREE.ConeGeometry(0.35, 1.6, 10, 1, true), marble, s * 0.55, 5.6, 0.0, 0, 0, s * 0.25);
  }
  add(new THREE.TorusGeometry(0.62, 0.05, 6, 32), mats.gold, 0, 5.45, 0, Math.PI / 2);
  const orbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff9ad5', emissiveIntensity: 1.6, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.92 });
  const orb = add(new THREE.SphereGeometry(0.75, 24, 18), orbMat, 0, 8.25, 0.55);
  const rings = [0, 1].map((i) => add(new THREE.TorusGeometry(1.15 + i * 0.25, 0.04, 6, 48), mats.gold, 0, 8.25, 0.55, Math.PI / 2 + i * 0.6, i * 0.8));
  const glow = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.0, 64), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.08; g.add(glow);
  scene.add(g);
  colliders.add({ type: 'cyl', x, z, r: 3.5, top: y + 0.5, bottom: y - 1 });
  colliders.add({ type: 'cyl', x, z, r: 2.55, top: y + 0.95, bottom: y + 0.3 });
  colliders.add({ type: 'cyl', x, z, r: 1.45, top: y + 6.4, bottom: y + 0.8 });
  return { group: g, orb, orbMat, rings, pos: g.position };
}

export function buildStructures(scene, ctx) {
  const { mats, colliders } = ctx;
  const b = new Batch();
  const R = rng(77);
  const out = { trains: [], waypoints: [], animate: [] };

  // ================= Central spire island =================
  const C = ISLANDS[0];
  const g0 = 3.6;
  // plaza
  b.add(new THREE.CylinderGeometry(21, 22.5, 4.4, 72), mats.plaza, M(-36, g0 + 0.8 - 2.2, -197));
  for (const rr of [9, 15.5]) b.add(new THREE.CylinderGeometry(rr + 0.25, rr + 0.25, 0.06, 72, 1, true), mats.glassDark, M(-36, g0 + 0.8, -197));
  b.add(new THREE.RingGeometry(15.25, 15.75, 72).rotateX(-Math.PI / 2), mats.glassDark, M(-36, g0 + 0.81, -197));
  b.add(new THREE.RingGeometry(8.75, 9.25, 72).rotateX(-Math.PI / 2), mats.glassDark, M(-36, g0 + 0.81, -197));
  colliders.add({ type: 'cyl', x: -36, z: -197, r: 21.5, top: g0 + 0.8, bottom: g0 - 3 });
  // sail crown (main landmark)
  crown(b, ctx, -54, g0, -193, [68, 60, 53, 47, 41], 4.8, 44, R);
  // green tower with ramp & ring
  greenTower(b, ctx, -34, g0, -205, 5, 46, R);
  ringPlatform(b, ctx, -34, g0 + 12.2, -205, 6.1, 10.2);
  walkway(b, ctx, helixPts(-34, -205, 11.6, g0 + 0.05, g0 + 12.2, Math.PI * 0.55, 1.0), 2.6, 0.5);
  // right group: green tower + twin blades
  greenTower(b, ctx, -6, g0, -193, 3.6, 38, R);
  walkway(b, ctx, helixPts(-6, -193, 10.2, g0 + 0.05, 11.9, Math.PI * 1.2, 0.85), 2.4, 0.5);
  b.add(bladeGeo(54, 8, 6, 0.9, 0.05), mats.white, M(9, g0 - 0.5, -186, 0.05, -0.4, -0.05));
  b.add(bladeGeo(45, 7, 4.5, 0.9, 0.05), mats.white, M(11, g0 - 0.5, -198, -0.05, -0.9, -0.08));
  bladeCollider(colliders, 9, g0 - 0.5, -186, -0.4, 54, 8, 6);
  bladeCollider(colliders, 11, g0 - 0.5, -198, -0.9, 45, 7, 4.5);
  // arched skybridge between the towers
  {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(new THREE.Vector3(-34 + 6.5 + (-6 - 4.0 - (-34 + 6.5)) * t, g0 + 26 + Math.sin(t * Math.PI) * 5, -205 + 12 * t));
    }
    walkway(b, ctx, pts, 2.6, 0.7);
    // underside arch rib
    const rib = new THREE.CatmullRomCurve3(pts.map((p, i) => p.clone().add(new THREE.Vector3(0, -1.2 - Math.sin(i / 24 * Math.PI) * 1.5, 0))));
    b.add(new THREE.TubeGeometry(rib, 40, 0.35, 8), mats.white);
  }
  // sweeping shell roofs around the base
  shell(b, ctx, -62, g0 - 0.3, -175, 15, 0.4, 0.42);
  shell(b, ctx, -44, g0 - 0.3, -177, 11, 2.3, 0.52);
  shell(b, ctx, -28, g0 - 0.3, -174, 11, 1.0, 0.4);
  shell(b, ctx, -72, g0 - 0.3, -207, 11, 3.7, 0.5);
  shell(b, ctx, -20, g0 - 0.3, -216, 10, 4.7, 0.45);
  // sweeping ramp ribbons (decorative curves)
  {
    const c1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-86, g0 - 0.2, -180), new THREE.Vector3(-80, g0 + 2.5, -160), new THREE.Vector3(-60, g0 + 6, -156),
      new THREE.Vector3(-44, g0 + 9, -168), new THREE.Vector3(-41, g0 + 12.2, -198)]);
    walkway(b, ctx, c1.getSpacedPoints(48), 3.2, 0.6);
  }
  // glass dome by the water
  dome(b, ctx, -8, g0 - 0.9, -160, 12);
  // pods & a small lighthouse-like spire
  pod(b, ctx, -84, H(-84, -196), -196, 12, 4.5, 6, 0.6);
  pod(b, ctx, -66, H(-66, -228), -228, 10, 4, 6, -0.4);
  pod(b, ctx, -30, H(-30, -232), -232, 11, 4, 6, 0.2);
  spire(b, ctx, -92, H(-92, -214), -214, 24, 2.2, { bands: [0.3, 0.5] });

  // ================= Bridge 1: central → spire island → coast =================
  const P = [
    new THREE.Vector3(-1, 12, -200), new THREE.Vector3(26, 12, -246), new THREE.Vector3(62, 12, -300),
    new THREE.Vector3(95, 12, -335), new THREE.Vector3(132, 12, -360), new THREE.Vector3(170, 12, -377),
    new THREE.Vector3(206, 12, -388),
  ];
  const br1 = bridge(b, ctx, P);
  // central end landing: a column + ring around tower group
  ringPlatform(b, ctx, -6, 11.9, -193, 4.7, 9.0, 0.7);
  // coast end ramp down to land
  {
    const end = P[P.length - 1];
    const tx = 238, tz = -398; const gy = H(tx, tz) + 0.25;
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3(end.x + (tx - end.x) * t, 12 + (gy - 12) * t, end.z + (tz - end.z) * t)); }
    walkway(b, ctx, pts, 5, 1.2);
  }
  // ================= Spire island station =================
  const S = ISLANDS[1];
  const sg = 2.9;
  spire(b, ctx, S.x, sg, S.z, 96, 6.4, { bands: [0.16, 0.27, 0.38, 0.5, 0.6] });
  crown(b, ctx, S.x, sg, S.z, [46, 40, 36], 7.2, 8, R, 2.5);
  ringPlatform(b, ctx, S.x, 11.9, S.z, 9.5, 14.5, 0.8);
  walkway(b, ctx, helixPts(S.x, S.z, 16.2, sg + 0.05, 11.9, Math.PI * 0.75, 1.0), 2.6, 0.5);
  dome(b, ctx, S.x - 22, H(S.x - 22, S.z + 8) - 0.4, S.z + 8, 8);
  pod(b, ctx, S.x + 16, H(S.x + 16, S.z + 18), S.z + 18, 10, 4, 6, 1.2);

  // ================= Distant landmarks =================
  const N = ISLANDS[2];
  spire(b, ctx, N.x, 2.4, N.z, 138, 7.5, { bands: [0.12, 0.2, 0.28, 0.36, 0.44, 0.52] });
  spire(b, ctx, N.x + 15, 2.4, N.z + 9, 46, 3.2);
  spire(b, ctx, N.x - 13, 2.4, N.z + 12, 34, 2.6);
  dome(b, ctx, N.x - 4, 2.0, N.z + 20, 7);
  const br2 = bridge(b, ctx, [new THREE.Vector3(N.x + 12, 14, N.z - 6), new THREE.Vector3(150, 14, -700), new THREE.Vector3(250, 14, -742), new THREE.Vector3(coastX(-770) + 14, 14, -770)], 5, 30, true);
  // far coast city
  const fx = coastX(-900) + 40;
  spire(b, ctx, fx, H(fx, -900), -900, 104, 7, {});
  spire(b, ctx, fx + 30, H(fx + 30, -880), -880, 82, 5.5, {});
  spire(b, ctx, fx + 8, H(fx + 8, -950), -950, 66, 5, {});
  crown(b, ctx, fx - 26, H(fx - 26, -870), -870, [52, 46, 40, 35], 4, 30, R);
  dome(b, ctx, fx - 10, H(fx - 10, -858), -858, 12);
  // a second coast tower group visible right of the bay
  {
    const cz = -520; const cx = coastX(cz) + 30;
    spire(b, ctx, cx, H(cx, cz), cz, 88, 5.6, {});
    greenTower(b, ctx, cx + 18, H(cx + 18, cz + 14), cz + 14, 3.4, 34, R);
  }
  // west island tower & dome
  const Wst = ISLANDS[6];
  spire(b, ctx, Wst.x, 2.6, Wst.z, 40, 3.4, {});
  dome(b, ctx, Wst.x + 16, H(Wst.x + 16, Wst.z + 6) - 0.3, Wst.z + 6, 10);
  const FN = ISLANDS[8];
  spire(b, ctx, FN.x, H(FN.x, FN.z), FN.z, 74, 5, {});
  const I3 = ISLANDS[5];
  dome(b, ctx, I3.x, H(I3.x, I3.z) - 0.3, I3.z, 6);

  // ================= Coast near spawn: the dome garden (the suburb itself is built in city.js) =================
  {
    const dz = -122, dx = coastX(dz) + 26;
    dome(b, ctx, dx, H(dx, dz) - 0.5, dz, 11);
  }

  b.build(scene);

  // ================= Trains =================
  for (const [br, speed, cars] of [[br1, 17, 3], [br2, 20, 2]]) {
    const t = makeTrain(mats, cars);
    scene.add(t.group);
    out.trains.push({ ...t, curve: br.curve, L: br.L, speed, s: br.L * 0.3, dir: 1, wait: 0, deck: 12 + (br === br2 ? 2 : 0) });
  }

  return out;
}

const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _la = new THREE.Vector3();
export function updateTrains(trains, dt) {
  for (const tr of trains) {
    const gap = 9.6, len = gap * tr.cars.length;
    if (tr.wait > 0) { tr.wait -= dt; }
    else {
      const prev = tr.s;
      tr.s += tr.dir * tr.speed * dt;
      if (tr.stops) for (const sp of tr.stops) {
        const at = sp + (gap * tr.cars.length - gap) / 2;
        if ((tr.dir > 0 && prev < at && tr.s >= at) || (tr.dir < 0 && prev > at && tr.s <= at)) { tr.s = at; tr.wait = 3.5; break; }
      }
      const lo = 4 + len, hi = tr.L - 4;
      if (tr.s > hi) { tr.s = hi; tr.dir = -1; tr.wait = 4; }
      if (tr.s < lo) { tr.s = lo; tr.dir = 1; tr.wait = 4; }
    }
    tr.cars.forEach((car, i) => {
      // cars trail behind the lead car relative to the travel direction
      const s = tr.dir > 0 ? tr.s - i * gap : tr.s - len + gap + i * gap;
      const u = Math.min(1, Math.max(0, s / tr.L));
      tr.curve.getPointAt(u, _p);
      tr.curve.getTangentAt(u, _t);
      car.position.set(_p.x, _p.y + 0.55 + 1.75, _p.z);
      car.lookAt(_la.copy(car.position).add(_t));
    });
  }
}

export { waypoint, bridge, makeTrain };

// Grade the ground under every structure that stands on land, before the terrain mesh is built.
export function planStructures() {
  const pad = (x, z, r, y, blend = 6) => addPad({ type: 'circle', x, z, r, y: y ?? rawH0(x, z), blend, margin: -1 });
  const C = ISLANDS[0], S = ISLANDS[1], N = ISLANDS[2], Wst = ISLANDS[6], FN = ISLANDS[8], I3 = ISLANDS[5];
  pad(-38, -195, 42, 3.3, 10); pad(-92, -214, 5); void C;
  pad(S.x, S.z, 22, 2.75, 8); pad(S.x - 22, S.z + 8, 10); pad(S.x + 16, S.z + 18, 9);
  pad(N.x, N.z + 4, 24, 2.3, 8);
  const fx = coastX(-900) + 40;
  pad(fx, -900, 10); pad(fx + 30, -880, 8.5); pad(fx + 8, -950, 8); pad(fx - 26, -870, 9); pad(fx - 10, -858, 13.5);
  { const cz = -520, cx = coastX(cz) + 30; pad(cx, cz, 8.5); pad(cx + 18, cz + 14, 7); }
  pad(Wst.x + 6, Wst.z + 3, 22, 2.6, 8);
  pad(FN.x, FN.z, 8);
  pad(I3.x, I3.z, 8.5);
  { const dz = -122, dx = coastX(dz) + 26; pad(dx, dz, 12.5, rawH0(dx, dz), 5); }
}
