import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bake } from './charmodel.js';

// Four chest tiers, each with its own build and hand-painted canvas textures:
// 普通 = plank crate with rope · 精致 = banded wooden chest · 珍贵 = blue lacquer with silver frame · 华丽 = gold-and-plum reliquary on a pedestal.

const texCache = new Map();
function canvasTex(key, w, h, paint) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  paint(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
function wood(base, dark, planks = 4) {
  return canvasTex('wood' + base + planks, 256, 256, (g, W, Hh) => {
    const ph = Hh / planks;
    for (let i = 0; i < planks; i++) {
      const c = new THREE.Color(base).offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(0, i * ph, W, ph);
      g.strokeStyle = dark; g.globalAlpha = 0.28; g.lineWidth = 1.2;
      for (let k = 0; k < 7; k++) {
        const y0 = i * ph + 4 + rnd() * (ph - 8), amp = 1 + rnd() * 3, f = 0.02 + rnd() * 0.03, ph0 = rnd() * 6;
        g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, y0 + Math.sin(x * f + ph0) * amp); g.stroke();
      }
      // a knot now and then
      if (rnd() < 0.5) { g.globalAlpha = 0.35; g.beginPath(); g.ellipse(rnd() * W, i * ph + ph / 2, 7, 3.5, 0, 0, 7); g.stroke(); }
      g.globalAlpha = 0.85; g.fillStyle = dark; g.fillRect(0, i * ph, W, 2.5);
      g.globalAlpha = 1;
    }
  });
}
function lacquer(base, line) {
  return canvasTex('lac' + base, 256, 256, (g, W, Hh) => {
    const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, new THREE.Color(base).offsetHSL(0, 0, 0.06).getStyle()); gr.addColorStop(1, base);
    g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
    g.strokeStyle = line; g.lineWidth = 3; g.lineCap = 'round';
    // scroll filigree: mirrored spirals
    for (const s of [-1, 1]) {
      g.beginPath();
      for (let t = 0; t < 9; t += 0.05) { const r = 6 + t * 7; g.lineTo(W / 2 + s * (30 + Math.cos(t) * r * 0.9), Hh / 2 + Math.sin(t) * r * 0.6); }
      g.stroke();
      g.beginPath(); g.moveTo(W / 2 + s * 10, Hh * 0.15); g.quadraticCurveTo(W / 2 + s * 90, Hh * 0.05, W / 2 + s * 118, Hh * 0.3); g.stroke();
      g.beginPath(); g.moveTo(W / 2 + s * 10, Hh * 0.85); g.quadraticCurveTo(W / 2 + s * 90, Hh * 0.95, W / 2 + s * 118, Hh * 0.7); g.stroke();
    }
    g.lineWidth = 2; g.strokeRect(8, 8, W - 16, Hh - 16);
  });
}
function velvet(base, gold) {
  return canvasTex('vel' + base, 256, 256, (g, W, Hh) => {
    g.fillStyle = base; g.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`; g.fillRect(rnd() * W, rnd() * Hh, 2, 2); }
    g.strokeStyle = gold; g.lineWidth = 2.5;
    const s = 64;
    for (let y = 0; y <= Hh; y += s) for (let x = 0; x <= W; x += s) {
      g.beginPath(); g.moveTo(x, y - s / 2); g.lineTo(x + s / 2, y); g.lineTo(x, y + s / 2); g.lineTo(x - s / 2, y); g.closePath(); g.stroke();
      g.fillStyle = gold; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
    }
  });
}
function brushed(base, hi) {
  return canvasTex('br' + base, 128, 128, (g, W, Hh) => {
    g.fillStyle = base; g.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 140; i++) { g.strokeStyle = `rgba(255,255,255,${rnd() * 0.12})`; g.lineWidth = 1; const y = rnd() * Hh; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + (rnd() - 0.5) * 3); g.stroke(); }
    const gr = g.createLinearGradient(0, 0, W, Hh); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, hi);
    g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
  });
}

// rounded rectangle in the xz footprint (drawn in shape xy, extruded upwards)
function rrect(p, w, d, r) {
  const x = w / 2, z = d / 2; r = Math.max(0.002, Math.min(r, x * 0.9, z * 0.9));
  p.moveTo(-x + r, -z); p.lineTo(x - r, -z); p.quadraticCurveTo(x, -z, x, -z + r);
  p.lineTo(x, z - r); p.quadraticCurveTo(x, z, x - r, z); p.lineTo(-x + r, z);
  p.quadraticCurveTo(-x, z, -x, z - r); p.lineTo(-x, -z + r); p.quadraticCurveTo(-x, -z, -x + r, -z);
  return p;
}
// box walls of thickness t from y=0 to y=h, open at top and bottom (so the chest is hollow when the lid lifts)
function shellGeo(w, h, d, t, r) {
  const b = Math.min(0.01, t * 0.25);
  const sh = rrect(new THREE.Shape(), w - 2 * b, d - 2 * b, r);
  sh.holes.push(rrect(new THREE.Path(), w - 2 * t + 2 * b, d - 2 * t + 2 * b, r - t));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, h - 2 * b), bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 1, curveSegments: 3 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, b, 0);
  // one texture repeat per face, like the rounded boxes
  const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (Math.abs(N.getY(i)) > 0.7) UV.setXY(i, x / w + 0.5, z / d + 0.5);
    else if (Math.abs(N.getX(i)) > Math.abs(N.getZ(i))) UV.setXY(i, z / d + 0.5, y / h);
    else UV.setXY(i, x / w + 0.5, y / h);
  }
  return geo;
}
// closed half-cylinder along x (flat face down) — a lid that is solid from every side
function dPrism(r, l, seg = 24) {
  const sh = new THREE.Shape(); sh.moveTo(r, 0); sh.absarc(0, 0, r, 0, Math.PI, false); sh.lineTo(r, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: l, bevelEnabled: false, curveSegments: seg });
  geo.rotateY(Math.PI / 2); geo.translate(-l / 2, 0, 0);
  const P = geo.attributes.position, UV = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); UV.setXY(i, x / l + 0.5, (Math.atan2(y, -z) / Math.PI)); }
  return geo;
}

export function buildChestModel(tier, g) {
  const STD = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const part = (geo, mat, p, r = [0, 0, 0], parent = g, outline = '#2a1a10') => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r); m.castShadow = true; m.receiveShadow = true; parent.add(m);
    if (outline) { m.userData.ow = 0.8; m.userData.oc = outline; }
    return m;
  };
  const rb = (w, h, d, rad = 0.02) => new RoundedBoxGeometry(w, h, d, 2, Math.min(rad, w / 2.1, h / 2.1, d / 2.1));
  const halfCyl = (r, l, seg = 24) => dPrism(r, l, seg);
  // hollow body: walls, a floor, an inner lining and a lining under the lid
  const hollow = (W, Hh, D, t, mat, lining, y0 = 0, oc = '#2a1a10', rad = 0.03) => {
    const depth = Hh * 0.6, fy = y0 + Hh - depth;
    part(shellGeo(W, Hh, D, t, rad), mat, [0, y0, 0], [0, 0, 0], g, oc);
    part(rb(W - t, fy - y0 + 0.01, D - t, 0.01), mat, [0, y0 + (fy - y0 + 0.01) / 2, 0], [0, 0, 0], g, null);
    const li = part(shellGeo(W - 2 * t - 0.006, depth - 0.012, D - 2 * t - 0.006, 0.012, Math.max(0.004, rad - t)), lining, [0, fy + 0.01, 0], [0, 0, 0], g, null);
    li.castShadow = false;
    const fl = part(new THREE.PlaneGeometry(W - 2 * t - 0.01, D - 2 * t - 0.01), lining, [0, fy + 0.012, 0], [-Math.PI / 2, 0, 0], g, null);
    fl.castShadow = false;
    return { fy, inW: W - 2 * t, inD: D - 2 * t };
  };
  const lidLining = (w, d, lining, z0, parent) => { const m = part(new THREE.PlaneGeometry(w, d), lining, [0, -0.012, z0], [Math.PI / 2, 0, 0], parent, null); m.castShadow = false; };
  // a few coins and gems resting inside (only seen once the lid lifts)
  const hoard = (fy, inW, inD, n, coinMat, gemMat) => {
    const cg = new THREE.CylinderGeometry(0.042, 0.042, 0.01, 12);
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(cg, coinMat);
      const rr = Math.sqrt(rnd()) * 0.42, a = rnd() * Math.PI * 2;
      c.position.set(Math.cos(a) * rr * inW * 0.75, fy + 0.03 + (0.42 - rr) * 0.22 + rnd() * 0.012, Math.sin(a) * rr * inD * 0.75);
      c.rotation.set((rnd() - 0.5) * 0.45, rnd() * 3, (rnd() - 0.5) * 0.45); g.add(c);
    }
    if (gemMat) for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), gemMat); m.position.set((rnd() - 0.5) * inW * 0.5, fy + 0.05, (rnd() - 0.5) * inD * 0.5); m.rotation.set(rnd(), rnd(), rnd()); g.add(m); }
  };
  const studs = (mat, pts, r = 0.016, parent = g) => { const geo = new THREE.SphereGeometry(r, 10, 8); for (const p of pts) { const s = new THREE.Mesh(geo, mat); s.position.set(...p); parent.add(s); } };
  const row = (x0, x1, n, y, z) => Array.from({ length: n }, (_, i) => [x0 + (x1 - x0) * (i / (n - 1)), y, z]);
  let hinge, glow, deco = null, r = 0.7, h = 0.95;

  if (tier === 'common') {
    const W = 0.84, Hh = 0.48, D = 0.58;
    const plank = STD({ map: wood('#b88a58', '#6d4a2a', 4), roughness: 0.92 });
    const post = STD({ map: wood('#8a6440', '#4a2f18', 2), roughness: 0.95 });
    const iron = STD({ color: '#5d5a58', roughness: 0.5, metalness: 0.6 });
    const rope = STD({ color: '#d9c48f', roughness: 1 });
    const inner = STD({ map: wood('#8a6440', '#4a2f18', 3), color: '#9a8a7a', roughness: 1 });
    hollow(W, Hh, D, 0.05, plank, inner, 0, '#2a1a10', 0.025);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(rb(0.07, Hh + 0.02, 0.07, 0.012), post, [sx * (W / 2 - 0.02), Hh / 2, sz * (D / 2 - 0.02)]);
    studs(iron, [...row(-W / 2 + 0.02, W / 2 - 0.02, 2, Hh - 0.04, D / 2 + 0.018), ...row(-W / 2 + 0.02, W / 2 - 0.02, 2, 0.05, D / 2 + 0.018)], 0.014);
    hinge = new THREE.Group(); hinge.position.set(0, Hh, -D / 2); g.add(hinge);
    part(rb(W + 0.04, 0.09, D + 0.04, 0.025), plank, [0, 0.045, D / 2], [0, 0, 0], hinge);
    lidLining(W - 0.1, D - 0.1, inner, D / 2, hinge);
    part(rb(W + 0.05, 0.03, 0.06, 0.01), post, [0, 0.06, D + 0.0], [0, 0, 0], hinge);
    // rope: around the lid and down the front, tied in a knot
    part(new THREE.BoxGeometry(0.035, 0.1, D + 0.08), rope, [0, 0.05, D / 2], [0, 0, 0], hinge, '#5a4a2a');
    part(new THREE.BoxGeometry(0.035, Hh * 0.6, 0.03), rope, [0, Hh * 0.68, D / 2 + 0.02], [0, 0, 0], g, '#5a4a2a');
    part(new THREE.SphereGeometry(0.035, 10, 8), rope, [0, Hh - 0.04, D / 2 + 0.04], [0, 0, 0], g, '#5a4a2a');
    part(new THREE.BoxGeometry(0.08, 0.02, 0.02), iron, [0, Hh * 0.45, D / 2 + 0.02]);
    r = 0.55; h = 0.62;
    glow = new THREE.PointLight('#ffffff', 0, 3);
  } else if (tier === 'exquisite') {
    const W = 1.0, Hh = 0.56, D = 0.68;
    const woodM = STD({ map: wood('#7a5232', '#3d2412', 5), roughness: 0.75 });
    const cu = STD({ map: brushed('#d08a46', 'rgba(255,220,170,0.25)'), roughness: 0.32, metalness: 0.75, emissive: '#3a1c06', emissiveIntensity: 0.25 });
    const dark = STD({ color: '#24160c', roughness: 0.6 });
    const cloth = STD({ map: velvet('#7a2430', '#b88a3a'), roughness: 0.9 });
    const coinM = STD({ color: '#f2c14a', roughness: 0.35, metalness: 0.7, emissive: '#5a3a04', emissiveIntensity: 0.3 });
    const hc = hollow(W, Hh, D, 0.055, woodM, cloth, 0, '#2a1a10', 0.03);
    hoard(hc.fy, hc.inW, hc.inD, 14, coinM, null);
    for (const y of [0, Hh - 0.06]) part(shellGeo(W + 0.03, 0.06, D + 0.03, 0.07, 0.03), cu, [0, y, 0], [0, 0, 0], g, '#3a1c06');
    for (const sx of [-0.33, 0.33]) for (const sz of [-1, 1]) part(rb(0.09, Hh + 0.02, 0.03, 0.012), cu, [sx, Hh / 2, sz * (D / 2 + 0.003)], [0, 0, 0], g, '#3a1c06');
    // corner brackets
    for (const sx of [-1, 1]) for (const y of [0.09, Hh - 0.09]) part(rb(0.1, 0.1, 0.02, 0.008), cu, [sx * (W / 2 - 0.04), y, D / 2 + 0.012], [0, 0, 0], g, '#3a1c06');
    studs(cu, [...row(-0.33, 0.33, 2, Hh - 0.03, D / 2 + 0.03), ...row(-0.33, 0.33, 2, 0.03, D / 2 + 0.03), ...row(-W / 2 + 0.06, W / 2 - 0.06, 7, Hh * 0.5, D / 2 + 0.012)], 0.013);
    // lock plate + keyhole
    part(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 6), cu, [0, Hh - 0.08, D / 2 + 0.02], [Math.PI / 2, 0, 0], g, '#3a1c06');
    part(new THREE.BoxGeometry(0.02, 0.045, 0.01), dark, [0, Hh - 0.09, D / 2 + 0.035], [0, 0, 0], g, null);
    for (const sx of [-1, 1]) part(new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI), cu, [sx * (W / 2 + 0.015), Hh * 0.62, 0], [0, Math.PI / 2, Math.PI], g, '#3a1c06');
    hinge = new THREE.Group(); hinge.position.set(0, Hh, -D / 2); g.add(hinge);
    const lid = part(halfCyl(D / 2, W), woodM, [0, 0, D / 2], [0, 0, 0], hinge);
    lidLining(W - 0.11, D - 0.11, cloth, D / 2, hinge);
    for (const sx of [-0.33, 0.33, -W / 2 + 0.015, W / 2 - 0.015]) part(halfCyl(D / 2 + 0.012, 0.085), cu, [sx, 0, D / 2], [0, 0, 0], hinge, '#3a1c06');
    part(new THREE.BoxGeometry(0.12, 0.1, 0.03), cu, [0, -0.02, D + 0.006], [0, 0, 0], hinge, '#3a1c06');
    void lid;
    r = 0.62; h = 0.95;
    glow = new THREE.PointLight('#ffe7a8', 0, 4);
  } else if (tier === 'precious') {
    const W = 1.15, Hh = 0.6, D = 0.78, y0 = 0.1;
    const lac = STD({ map: lacquer('#2a5aa0', '#e8d58a'), roughness: 0.35 });
    const ag = STD({ map: brushed('#e6edf5', 'rgba(200,220,255,0.3)'), roughness: 0.2, metalness: 0.85 });
    const gemM = STD({ color: '#8fe8ff', emissive: '#3fb6ff', emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.2 });
    const silk = STD({ map: velvet('#e9e4f2', '#9fb6e0'), roughness: 0.85 });
    const coinM = STD({ color: '#e8eef6', roughness: 0.25, metalness: 0.85 });
    const hc = hollow(W, Hh, D, 0.06, lac, silk, y0, '#0e1e3a', 0.035);
    hoard(hc.fy, hc.inW, hc.inD, 16, coinM, gemM);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      part(rb(0.075, Hh + 0.02, 0.075, 0.015), ag, [sx * W / 2, y0 + Hh / 2, sz * D / 2], [0, 0, 0], g, '#334058');
      part(new THREE.SphereGeometry(0.06, 14, 10), ag, [sx * (W / 2 - 0.02), y0 * 0.6, sz * (D / 2 - 0.02)], [0, 0, 0], g, '#334058');
    }
    for (const y of [y0, y0 + Hh]) for (const sz of [-1, 1]) part(rb(W + 0.04, 0.055, 0.055, 0.012), ag, [0, y, sz * D / 2], [0, 0, 0], g, '#334058');
    for (const y of [y0, y0 + Hh]) for (const sx of [-1, 1]) part(rb(0.055, 0.055, D + 0.04, 0.012), ag, [sx * W / 2, y, 0], [0, 0, 0], g, '#334058');
    studs(ag, row(-W / 2 + 0.1, W / 2 - 0.1, 8, y0 + 0.07, D / 2 + 0.02), 0.012);
    // medallion
    const med = part(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 24), ag, [0, y0 + Hh * 0.55, D / 2 + 0.02], [Math.PI / 2, 0, 0], g, '#334058');
    void med;
    const gm = part(new THREE.OctahedronGeometry(0.06, 0), gemM, [0, y0 + Hh * 0.55, D / 2 + 0.06], [0, 0, 0], g, '#0e3a5a'); gm.userData.keep = true;
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; part(new THREE.SphereGeometry(0.018, 8, 6), gemM, [Math.cos(a) * 0.09, y0 + Hh * 0.55 + Math.sin(a) * 0.09, D / 2 + 0.04], [0, 0, 0], g, null); }
    for (const sx of [-1, 1]) part(new THREE.TorusGeometry(0.055, 0.013, 6, 16, Math.PI), ag, [sx * (W / 2 + 0.03), y0 + Hh * 0.62, 0], [0, Math.PI / 2, Math.PI], g, '#334058');
    hinge = new THREE.Group(); hinge.position.set(0, y0 + Hh, -D / 2); g.add(hinge);
    part(halfCyl(D / 2, W, 28), lac, [0, 0, D / 2], [0, 0, 0], hinge, '#0e1e3a');
    lidLining(W - 0.12, D - 0.12, silk, D / 2, hinge);
    for (const sx of [-W / 2, -0.22, 0.22, W / 2]) part(halfCyl(D / 2 + 0.014, 0.06, 28), ag, [sx, 0, D / 2], [0, 0, 0], hinge, '#334058');
    part(rb(0.2, 0.16, 0.04, 0.015), ag, [0, -0.02, D + 0.01], [0, 0, 0], hinge, '#334058');
    r = 0.72; h = 1.1;
    glow = new THREE.PointLight('#bfe2ff', 0, 4.5);
    deco = (t) => { gm.rotation.z = t * 1.5; gemM.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.3; };
  } else {
    const W = 1.4, Hh = 0.74, D = 0.95, y0 = 0.27;
    const gold = STD({ map: brushed('#f2b437', 'rgba(255,236,170,0.35)'), roughness: 0.28, metalness: 0.65, emissive: '#6a3e04', emissiveIntensity: 0.45 });
    const vel = STD({ map: velvet('#5a3a8e', '#e8c45a'), roughness: 0.8 });
    const marble = STD({ color: '#f6f2ea', roughness: 0.35 });
    const cols = ['#ff7a8a', '#ffb36a', '#ffe27a', '#8cf08c', '#6fd0ff', '#7f9bff', '#c39bff'];
    // two-step pedestal
    part(rb(W + 0.4, 0.14, D + 0.4, 0.03), marble, [0, 0.07, 0], [0, 0, 0], g, '#7a7060');
    part(rb(W + 0.22, 0.12, D + 0.22, 0.03), gold, [0, 0.2, 0], [0, 0, 0], g, '#5a3a08');
    const satin = STD({ map: velvet('#b8283e', '#ffd77a'), roughness: 0.8 });
    const hc = hollow(W, Hh, D, 0.07, vel, satin, y0, '#2a1440', 0.04);
    hoard(hc.fy, hc.inW, hc.inD, 26, gold, null);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      part(rb(0.11, Hh + 0.04, 0.11, 0.02), gold, [sx * W / 2, y0 + Hh / 2, sz * D / 2], [0, 0, 0], g, '#5a3a08');
      part(new THREE.SphereGeometry(0.075, 14, 10), gold, [sx * W / 2, y0 + Hh + 0.3, sz * D / 2], [0, 0, 0], g, '#5a3a08');
      part(new THREE.ConeGeometry(0.06, 0.24, 10), gold, [sx * W / 2, y0 + Hh + 0.47, sz * D / 2], [0, 0, 0], g, '#5a3a08');
      part(new THREE.CylinderGeometry(0.035, 0.05, 0.26, 10), gold, [sx * W / 2, y0 + Hh + 0.13, sz * D / 2], [0, 0, 0], g, '#5a3a08');
    }
    for (const y of [y0, y0 + Hh]) for (const sz of [-1, 1]) part(rb(W + 0.08, 0.08, 0.08, 0.02), gold, [0, y, sz * D / 2], [0, 0, 0], g, '#5a3a08');
    for (const y of [y0, y0 + Hh]) for (const sx of [-1, 1]) part(rb(0.08, 0.08, D + 0.08, 0.02), gold, [sx * W / 2, y, 0], [0, 0, 0], g, '#5a3a08');
    // front crest plate with the rainbow gem row and a large centre gem
    part(rb(0.62, 0.36, 0.04, 0.03), gold, [0, y0 + Hh * 0.5, D / 2 + 0.02], [0, 0, 0], g, '#5a3a08');
    const gemMats = cols.map((c) => STD({ color: '#ffffff', emissive: c, emissiveIntensity: 1, roughness: 0.1 }));
    cols.forEach((c, i) => part(new THREE.OctahedronGeometry(0.035, 0), gemMats[i], [-0.24 + i * 0.08, y0 + Hh * 0.5 - 0.12, D / 2 + 0.06], [0, 0, 0], g, null));
    const big = STD({ color: '#ffffff', emissive: '#ff9ad5', emissiveIntensity: 1.1, roughness: 0.1 });
    part(new THREE.OctahedronGeometry(0.09, 0), big, [0, y0 + Hh * 0.55, D / 2 + 0.07], [0, 0, Math.PI / 4], g, '#5a1a3a');
    for (const sx of [-1, 1]) part(new THREE.TorusGeometry(0.11, 0.022, 8, 18, Math.PI * 1.4), gold, [sx * 0.2, y0 + Hh * 0.58, D / 2 + 0.05], [0, 0, sx > 0 ? -0.3 : Math.PI + 0.3], g, '#5a3a08');
    for (const sx of [-1, 1]) part(new THREE.TorusGeometry(0.07, 0.016, 6, 16, Math.PI), gold, [sx * (W / 2 + 0.04), y0 + Hh * 0.6, 0], [0, Math.PI / 2, Math.PI], g, '#5a3a08');
    hinge = new THREE.Group(); hinge.position.set(0, y0 + Hh, -D / 2); g.add(hinge);
    part(halfCyl(D / 2, W, 32), vel, [0, 0, D / 2], [0, 0, 0], hinge, '#2a1440');
    lidLining(W - 0.14, D - 0.14, satin, D / 2, hinge);
    for (const sx of [-W / 2, -0.26, 0.26, W / 2]) part(halfCyl(D / 2 + 0.02, 0.08, 32), gold, [sx, 0, D / 2], [0, 0, 0], hinge, '#5a3a08');
    const crestBase = part(new THREE.CylinderGeometry(0.16, 0.22, 0.12, 14), gold, [0, D / 2 + 0.06, D / 2], [0, 0, 0], hinge, '#5a3a08');
    void crestBase;
    const crestMat = STD({ color: '#ffffff', emissive: '#ff9ad5', emissiveIntensity: 1.2, roughness: 0.1 });
    const crest = part(new THREE.OctahedronGeometry(0.2, 0), crestMat, [0, D / 2 + 0.38, D / 2], [0, 0, 0], hinge, '#5a1a3a'); crest.userData.keep = true;
    crest.scale.set(1, 1.5, 1);
    // gold wings either side of the crest
    for (const sx of [-1, 1]) {
      const wg = new THREE.Shape(); wg.moveTo(0, 0); wg.quadraticCurveTo(0.18, 0.2, 0.36, 0.12); wg.quadraticCurveTo(0.22, 0.06, 0.3, -0.02); wg.quadraticCurveTo(0.16, 0.02, 0, 0);
      const geo = new THREE.ExtrudeGeometry(wg, { depth: 0.025, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 });
      part(geo, gold, [sx * 0.12, D / 2 + 0.08, D / 2], [0, 0, 0], hinge, '#5a3a08').scale.set(sx, 1, 1);
    }
    part(rb(0.28, 0.3, 0.06, 0.02), gold, [0, -0.04, D + 0.02], [0, 0, 0], hinge, '#5a3a08');
    // halo + orbiting motes
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.55, 64), new THREE.MeshBasicMaterial({ color: '#ffe7a0', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.16; g.add(halo);
    const motes = new THREE.Group(); g.add(motes);
    for (let i = 0; i < 7; i++) motes.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: cols[i] })));
    r = 1.0; h = 1.35;
    glow = new THREE.PointLight('#ffd77a', 0.8, 5);
    deco = (t) => {
      crest.rotation.y = t * 1.2; crestMat.emissive.setHSL((t * 0.12) % 1, 0.8, 0.62);
      halo.material.opacity = 0.25 + Math.sin(t * 2) * 0.1;
      motes.children.forEach((m, i) => { const a = t * 0.8 + i / 7 * Math.PI * 2; m.position.set(Math.cos(a) * 1.15, 0.9 + Math.sin(t * 2 + i) * 0.25, Math.sin(a) * 1.15); });
    };
  }
  glow.position.y = 1; g.add(glow);
  bake(g);
  return { hinge, glow, deco, r, h };
}
