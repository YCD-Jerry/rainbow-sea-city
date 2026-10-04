import * as THREE from 'three';
import { nearFade } from './nearfade.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, rng, ss } from './noise.js';
import { H, H0, slope, coastX, FALL_Z, ISLANDS, streamCarve , reserved } from './terrain.js';
import { Batch, Blobs, M, latheGeo } from './geo.js';
import { makeFallMaterial } from './water.js';

const LEAF_GREENS = ['#7fc23a', '#93cf45', '#6cb135', '#a5d957', '#5f9f30', '#88c84a'];

export function rockGeo(seed) {
  let g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position; const v = new THREE.Vector3();
  const col = new Float32Array(p.count * 3);
  const base = new THREE.Color('#b2b5ad'), dark = new THREE.Color('#8b918c'), moss = new THREE.Color('#7da650'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.4 + seed * 7.1, v.z * 1.4 + v.y * 1.7, 4, seed);
    let s = 0.72 + 0.5 * n;
    v.multiplyScalar(s);
    if (v.y < -0.25) v.y = -0.25 + (v.y + 0.25) * 0.35;
    if (v.y > 0.55) v.y = 0.55 + (v.y - 0.55) * 0.55;
    p.setXYZ(i, v.x, v.y, v.z);
    c.copy(base).lerp(dark, ss(0.45, 0.25, n) + ss(0.1, -0.3, v.y) * 0.5);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const up = nr.getY(i);
    const t = ss(0.62, 0.92, up) * 0.75;
    if (t > 0) { c.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]).lerp(moss, t); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function leafTexture() {
  const S = 128; const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const leaf = (x, y, a, len, wid, c1, c2) => {
    g.save(); g.translate(x, y); g.rotate(a);
    const gr = g.createLinearGradient(0, -len / 2, 0, len / 2);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, -len / 2);
    g.quadraticCurveTo(wid, -len * 0.1, 0, len / 2);
    g.quadraticCurveTo(-wid, -len * 0.1, 0, -len / 2);
    g.fill();
    g.strokeStyle = 'rgba(70,110,30,0.55)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, -len / 2 + 3); g.lineTo(0, len / 2 - 2); g.stroke();
    g.restore();
  };
  const L = [[64, 40, 0.1], [36, 64, -1.2], [92, 66, 1.25], [52, 92, -2.6], [80, 94, 2.5], [64, 66, 0.6]];
  for (const [x, y, a] of L) leaf(x, y, a, 46, 17, '#e6f58e', '#86c43e');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function softDot() {
  const S = 64; const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function windify(mat, timeU, amount, leaf = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', leaf ? /* glsl */`
        #include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float ph = uTime * 2.3 + ip.x * 0.7 + ip.z * 0.5 + ip.y * 0.9;
        transformed += vec3(sin(ph), cos(ph * 1.3) * 0.6, cos(ph * 0.8)) * ${amount.toFixed(3)};`
        : /* glsl */`
        #include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sw = sin(uTime * 1.7 + ip.x * 0.31 + ip.z * 0.23) * 0.6 + sin(uTime * 3.3 + ip.x * 0.9 + ip.z * 0.4) * 0.25;
        float k = position.y * position.y;
        transformed.x += sw * ${amount.toFixed(3)} * k;
        transformed.z += sw * ${(amount * 0.6).toFixed(3)} * k;`);
  };
}

function grassClumpGeo() {
  const pos = [], col = [], idx = [];
  const base = new THREE.Color('#68ad37'), tip = new THREE.Color('#cfec78'), c = new THREE.Color();
  const r = rng(5);
  for (let b = 0; b < 10; b++) {
    const a = r() * Math.PI * 2, d = r() * 0.32;
    const ox = Math.cos(a) * d, oz = Math.sin(a) * d;
    const h = 0.26 + r() * 0.3, w = 0.032 + r() * 0.022;
    const rot = r() * Math.PI; const cx = Math.cos(rot), cz = Math.sin(rot);
    const bend = (r() - 0.5) * 0.35;
    const start = pos.length / 3;
    const segs = 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs; const ww = w * (1 - t * 0.85);
      const bx = ox + bend * t * t * cz, bz = oz - bend * t * t * cx;
      pos.push(bx - cx * ww, h * t, bz - cz * ww, bx + cx * ww, h * t, bz + cz * ww);
      c.copy(base).lerp(tip, t); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let s = 0; s < segs; s++) {
      const a0 = start + s * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

export function buildNature(scene, ctx) {
  const { colliders, timeU, quality, foliage, mats, spawn } = ctx;
  const R = rng(1234);
  const out = { animate: [] };

  // ---------- Rocks ----------
  const rockGeos = [rockGeo(1), rockGeo(2), rockGeo(3)];
  const rockMat = nearFade(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.4, 1.3);
  const rocks = [[], [], []];
  const addRock = (x, z, sx, sy, sz, yOff = 0, collide = true) => {
    if (reserved(x, z, Math.max(sx, sz))) return;
    const y = H(x, z) + yOff;
    const ry = R() * Math.PI * 2;
    const v = Math.floor(R() * 3);
    rocks[v].push([x, y, z, sx, sy, sz, ry]);
    if (collide && y + sy * 0.55 > -1.6) colliders.add({ type: 'ell', x, y, z, rx: sx * 0.93, ry: sy * 0.6, rz: sz * 0.93, rot: ry, bottom: y - sy * 0.3, tag: 'rock' });
  };
  // shoreline boulders on the spawn coast
  for (let z = -175; z < 140; z += 1.9) {
    if (R() < 0.25) continue;
    const d = -7 + R() * 9;
    const x = coastX(z) + d;
    const s = 1.1 + R() * R() * 4.2;
    addRock(x, z, s * (0.9 + R() * 0.5), s * (0.55 + R() * 0.5), s * (0.9 + R() * 0.5), -s * 0.12);
  }
  // waterfall flank boulders
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1;
    const z = FALL_Z + side * (4.5 + R() * 6);
    const d = -2 + R() * 9;
    const s = 2.2 + R() * 2.4;
    addRock(coastX(z) + d, z, s, s * (0.8 + R() * 0.4), s, -s * 0.2);
  }
  // flat stepping stones visible through the shallows
  for (let i = 0; i < 170; i++) {
    const z = -70 + R() * 200;
    const d = -60 + R() * 54;
    const x = coastX(z) + d;
    const h = H(x, z);
    if (h > -0.3) continue;
    const s = 1.6 + R() * 3.4;
    const sy = 0.5 + R() * 0.7;
    addRock(x, z, s, sy * (h > -1.6 ? 1.6 : 1.0), s * (0.7 + R() * 0.5), sy * 0.15, h > -2.2);
  }
  // island shore rocks
  for (const I of ISLANDS) {
    if (I.r > 100) continue;
    const n = Math.round(I.r * 1.1);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2; const rr = I.r + (R() - 0.6) * 9;
      const x = I.x + Math.cos(a) * rr, z = I.z + Math.sin(a) * rr;
      const s = 0.8 + R() * R() * 3;
      addRock(x, z, s, s * 0.6, s, -s * 0.15);
    }
  }
  rocks.forEach((list, v) => {
    const mesh = new THREE.InstancedMesh(rockGeos[v], rockMat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    list.forEach(([x, y, z, sx, sy, sz, ry], i) => {
      q.setFromEuler(e.set((R() - 0.5) * 0.25, ry, (R() - 0.5) * 0.25));
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
      mesh.setMatrixAt(i, m);
      const k = 0.88 + R() * 0.2; mesh.setColorAt(i, col.setRGB(k, k, k * (0.97 + R() * 0.05)));
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  });

  // ---------- Trees ----------
  const bark = nearFade(new THREE.MeshLambertMaterial({ color: '#8d6b4f' }));
  const trunkBatch = new Batch();
  const leafCards = [];
  const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();

  const blobTree = (x, z, s = 1) => {
    const y = H(x, z) - 0.2;
    const h = (3.2 + R() * 2.4) * s;
    trunkBatch.add(new THREE.CylinderGeometry(0.16 * s, 0.28 * s, h, 6), bark, M(x, y + h / 2, z));
    const n = 3 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, rr = (i === 0 ? 0 : 0.9 + R() * 0.6) * s;
      const sz = (1.3 + R() * 0.9) * s;
      foliage.add(x + Math.cos(a) * rr, y + h + (i === 0 ? 0.4 : -0.3 + R() * 0.9) * s, z + Math.sin(a) * rr, sz, sz * 0.85, sz, LEAF_GREENS[Math.floor(R() * LEAF_GREENS.length)], R() * 6);
    }
    colliders.add({ type: 'cyl', x, z, r: 0.35 * s, top: y + h * 0.7, bottom: y - 1, tag: 'tree' });
    colliders.add({ type: 'ell', x, y: y + h + 0.35 * s, z, rx: 1.75 * s, ry: 1.25 * s, rz: 1.75 * s, bottom: y + h - 0.7 * s, tag: 'tree' });
  };

  const cardTree = (x, z, s = 1, big = false) => {
    const y = H(x, z) - 0.25;
    const h = (big ? 9.5 : 5.5 + R() * 2.5) * s;
    const lean = (R() - 0.5) * 0.12;
    trunkBatch.add(latheGeo(h * 0.8, (big ? 0.5 : 0.3) * s, (t) => 1 - 0.6 * t, 8, 6), bark, M(x, y, z, lean, 0, lean * 0.7));
    const tops = [];
    const nb = big ? 7 : 4 + Math.floor(R() * 2);
    for (let i = 0; i < nb; i++) {
      const a = i / nb * Math.PI * 2 + R() * 0.6;
      const hy = y + h * (0.42 + R() * 0.3);
      const len = (big ? 4.2 : 2.2) * s * (0.8 + R() * 0.5);
      const p0 = new THREE.Vector3(x, hy, z);
      const p2 = new THREE.Vector3(x + Math.cos(a) * len, hy + len * (0.45 + R() * 0.35), z + Math.sin(a) * len);
      const p1 = p0.clone().lerp(p2, 0.5).add(new THREE.Vector3(0, -0.3, 0));
      trunkBatch.add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 6, (big ? 0.18 : 0.1) * s, 5), bark);
      tops.push([p2, (big ? 2.6 : 1.7) * s * (0.85 + R() * 0.35)]);
    }
    tops.push([new THREE.Vector3(x, y + h * 0.95, z), (big ? 3.0 : 2.0) * s]);
    for (const [c, rc] of tops) {
      foliage.add(c.x, c.y, c.z, rc * 0.78, rc * 0.62, rc * 0.78, '#4f8f2c', R() * 6);
      const nl = Math.round(rc * rc * (big ? 34 : 38));
      for (let k = 0; k < nl; k++) {
        let px, py, pz;
        do { px = R() * 2 - 1; py = R() * 2 - 1; pz = R() * 2 - 1; } while (px * px + py * py + pz * pz > 1);
        const sc = 0.55 + R() * 0.5;
        tmpQ.setFromEuler(tmpE.set(R() * 6.28, R() * 6.28, R() * 6.28));
        leafCards.push([c.x + px * rc, c.y + py * rc * 0.8, c.z + pz * rc, sc, tmpQ.clone(), 0.85 + R() * 0.3]);
      }
    }
    colliders.add({ type: 'cyl', x, z, r: 0.5 * s, top: y + h * 0.45, bottom: y - 1, tag: 'tree' });
    for (const [c, rc] of tops) colliders.add({ type: 'ell', x: c.x, y: c.y + rc * 0.15, z: c.z, rx: rc * 0.85, ry: rc * 0.6, rz: rc * 0.85, bottom: c.y - rc * 0.45, tag: 'tree' });
  };

  // big framing trees next to the spawn point
  cardTree(spawn.x + 7.5, spawn.z + 3.5, 1.15, true);
  cardTree(spawn.x + 4.5, spawn.z - 13, 1.0, true);
  // coast groves
  let placed = 0, tries = 0;
  const nCard = quality === 'low' ? 26 : 46;
  while (placed < nCard && tries < 3000) {
    tries++;
    const z = -220 + R() * 400;
    const x = coastX(z) + 10 + R() * 120;
    const h = H(x, z);
    if (h < 2 || slope(x, z).m > 0.8) continue;
    if (Math.hypot(x - spawn.x, z - spawn.z) < 9) continue;
    if (Math.abs(z - FALL_Z) < 9 && x < coastX(z) + 75) continue;
    if (colliders.support(x, z, 999, 2) > h + 0.5 || reserved(x, z, 4)) continue;
    cardTree(x, z, 0.85 + R() * 0.4);
    placed++;
  }
  // blob trees on islands and inland hills
  const islandTrees = { central: 46, spire: 14, needle: 12, islet1: 6, islet2: 1, islet3: 8, west: 26, farwest: 70, farnorth: 26 };
  for (const I of ISLANDS) {
    const want = islandTrees[I.name] || 0; let got = 0, t = 0;
    while (got < want && t < want * 40) {
      t++;
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * (I.r - 6);
      const x = I.x + Math.cos(a) * rr, z = I.z + Math.sin(a) * rr;
      const h = H(x, z); if (h < 1.3) continue;
      if (colliders.support(x, z, 999, 2.5) > h + 0.5 || reserved(x, z, 3)) continue;
      blobTree(x, z, I.r > 100 ? 1.6 : 0.85 + R() * 0.5);
      got++;
    }
  }
  for (let i = 0; i < 160; i++) {
    const z = -900 + R() * 1100;
    const x = coastX(z) + 40 + R() * 320;
    const h = H(x, z); if (h < 3) continue;
    if (colliders.support(x, z, 999, 2) > h + 0.5 || reserved(x, z, 3)) continue;
    blobTree(x, z, 1 + R() * 0.8);
  }
  trunkBatch.build(scene, { cast: true });

  // leaf cards
  {
    const tex = leafTexture();
    const mat = nearFade(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, emissive: new THREE.Color('#2a3a0c') }), 0.6, 2.2);
    windify(mat, timeU, 0.035, true);
    const geo = new THREE.PlaneGeometry(0.9, 0.9);
    const mesh = new THREE.InstancedMesh(geo, mat, leafCards.length);
    const m = new THREE.Matrix4(), c = new THREE.Color(), v = new THREE.Vector3();
    leafCards.forEach(([x, y, z, sc, q, k], i) => {
      m.compose(v.set(x, y, z), q, new THREE.Vector3(sc, sc, sc));
      mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.setRGB(k, k, k * 0.95));
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 });
    mesh.customDepthMaterial = depth;
  }

  // ---------- Bushes & flowers ----------
  const flowers = new Blobs(new THREE.IcosahedronGeometry(1, 0));
  const FLOWER = ['#ff9cc8', '#ffc2dc', '#ffffff', '#ffe27a', '#d8b4ff', '#ff86b6'];
  for (let i = 0; i < 260; i++) {
    const z = -160 + R() * 300;
    const x = coastX(z) + 2.5 + R() * 13;
    const h = H(x, z); if (h < 1.2) continue;
    if (Math.hypot(x - spawn.x, z - spawn.z) < 16) continue;
    if (Math.abs(z - FALL_Z) < 13) continue;
    const s = 0.45 + R() * 0.55;
    if (reserved(x, z, s + 0.6)) continue;
    const pink = R() < 0.45;
    const bc = pink ? '#6db53b' : LEAF_GREENS[Math.floor(R() * 6)];
    for (let k = 0; k < 3; k++) {
      const a = R() * 6.28, rr = k ? s * 0.7 : 0, ks = k ? 0.75 : 1;
      foliage.add(x + Math.cos(a) * rr, h + s * 0.3 * ks, z + Math.sin(a) * rr, s * ks, s * 0.75 * ks, s * ks, bc, R() * 6);
    }
    if (pink) for (let k = 0; k < 14; k++) {
      const a = R() * 6.28, rr = R() * s * 1.1;
      flowers.add(x + Math.cos(a) * rr, h + s * 0.35 + s * 0.6 * (0.6 + R() * 0.5), z + Math.sin(a) * rr, 0.075, 0.05, 0.075, FLOWER[Math.floor(R() * 2)]);
    }
  }
  // meadow flowers
  const nFl = quality === 'low' ? 1500 : 3600;
  for (let i = 0; i < nFl; i++) {
    let x, z;
    if (R() < 0.6) { const a = R() * 6.28, rr = Math.sqrt(R()) * 70; x = spawn.x + 25 + Math.cos(a) * rr; z = spawn.z - 20 + Math.sin(a) * rr; }
    else { z = -250 + R() * 400; x = coastX(z) + 4 + R() * 110; }
    const h = H(x, z); if (h < 1.5) continue;
    const cl = fbm(x * 0.05, z * 0.05, 2, 41); if (cl < 0.5) continue;
    if (reserved(x, z, 0.6)) continue;
    const col = FLOWER[Math.floor(R() * FLOWER.length)];
    for (let k = 0; k < 3; k++) flowers.add(x + (R() - 0.5) * 0.8, h + 0.24 + R() * 0.14, z + (R() - 0.5) * 0.8, 0.06, 0.04, 0.06, col);
  }
  out.flowers = flowers.build(scene, nearFade(new THREE.MeshLambertMaterial({ emissive: '#3a2a30' }), 0.3, 0.9), { cast: false });

  // ---------- Grass ----------
  {
    const geo = grassClumpGeo();
    const mat = nearFade(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.3, 0.9);
    windify(mat, timeU, 0.22);
    const max = quality === 'high' ? 26000 : quality === 'mid' ? 15000 : 7000;
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0, t = 0;
    const central = ISLANDS[0];
    while (n < max && t < max * 6) {
      t++;
      let x, z; const pick = R();
      if (pick < 0.55) { const a = R() * 6.28, rr = Math.sqrt(R()) * 95; x = spawn.x + 20 + Math.cos(a) * rr; z = spawn.z - 25 + Math.sin(a) * rr; }
      else if (pick < 0.8) { const a = R() * 6.28, rr = Math.sqrt(R()) * central.r; x = central.x + Math.cos(a) * rr; z = central.z + Math.sin(a) * rr; }
      else { z = -260 + R() * 300; x = coastX(z) + 3 + R() * 90; }
      const h = H(x, z);
      if (h < 1.25) continue;
      if (slope(x, z).m > 0.95) continue;
      if (Math.abs(z - FALL_Z) < 3.6 && streamCarve(x, FALL_Z) > 0.01) continue;
      if (colliders.support(x, z, 999, 0.3) > h - 1.0 || reserved(x, z, 0.4)) continue;
      const s = 0.75 + R() * 0.6;
      q.setFromEuler(e.set(0, R() * 6.28, 0));
      m.compose(v.set(x, h - 0.05, z), q, sc.set(s, s * (0.8 + R() * 0.5), s));
      mesh.setMatrixAt(n++, m);
    }
    mesh.count = n; mesh.userData.n = n;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.name = 'grass';
    scene.add(mesh);
    out.grass = mesh;
  }

  // ---------- Waterfall + stream ----------
  {
    const z0 = FALL_Z;
    const xc = coastX(z0);
    const rows = [];
    for (let x = xc + 70; x >= xc - 1.5; x -= (x > xc + 10 ? 2 : 0.5)) {
      let top = -Infinity;
      for (let k = -1; k <= 1; k++) top = Math.max(top, H0(x, z0 + k * 1.6));
      rows.push([x, top]);
    }
    const pos = [], uv = [], st = [], idx = [];
    let acc = 0;
    const W = 3.6;
    for (let i = 0; i < rows.length; i++) {
      const [x, h] = rows[i];
      const prev = rows[Math.max(0, i - 1)], next = rows[Math.min(rows.length - 1, i + 1)];
      const s = Math.abs(prev[1] - next[1]) / Math.max(0.01, Math.abs(prev[0] - next[0]));
      const steep = ss(0.15, 1.2, s);
      const wid = W * (1 - 0.35 * (1 - steep)) + steep * 1.2;
      const y = streamCarve(x, z0) > 0.03 ? H0(x, z0) - 0.1 : Math.max(h + 0.18 + steep * 0.5, 0.05);
      if (i > 0) acc += Math.hypot(x - rows[i - 1][0], h - rows[i - 1][1]);
      for (let k = 0; k <= 4; k++) {
        const u = k / 4;
        pos.push(x + steep * 0.4, y, z0 + (u - 0.5) * wid * 2);
        uv.push(u, acc / 10); st.push(steep);
      }
    }
    for (let i = 0; i < rows.length - 1; i++) for (let k = 0; k < 4; k++) {
      const a = i * 5 + k, b = a + 1, c = a + 5, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('steep', new THREE.Float32BufferAttribute(st, 1));
    g.setIndex(idx);
    const fall = new THREE.Mesh(g, makeFallMaterial(timeU));
    fall.renderOrder = 3;
    scene.add(fall);
    out.fall = fall;

    // mist
    const N = 70; const mp = new Float32Array(N * 3); const seeds = [];
    for (let i = 0; i < N; i++) { seeds.push(R()); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    const mm = new THREE.PointsMaterial({ size: 2.6, map: softDot(), transparent: true, opacity: 0.55, depthWrite: false, color: '#ffffff' });
    const mist = new THREE.Points(mg, mm); mist.frustumCulled = false; mist.renderOrder = 4;
    scene.add(mist);
    // churning foam where the fall hits the sea, plus droplets thrown up from the impact
    const foam = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.ShaderMaterial({
      uniforms: { uTime: timeU }, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vP;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
        void main(){
          float r = length(vP) / 7.0;
          vec2 q = vP * 1.6 + vec2(sin(uTime * 0.7), cos(uTime * 0.5)) * 0.6;
          float f = n(q + vec2(0.0, uTime * 1.3)) * 0.6 + n(q * 2.3 - vec2(uTime * 1.1, 0.0)) * 0.4;
          float a = smoothstep(0.42, 0.75, f + (1.0 - r) * 0.45) * (1.0 - smoothstep(0.55, 1.0, r));
          gl_FragColor = vec4(vec3(1.0), a * 0.9);
          #include <colorspace_fragment>
        }`,
    }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(xc - 1.5, 0.05, z0); foam.renderOrder = 5;
    scene.add(foam);
    const DN = 90, dp = new Float32Array(DN * 3), dv = [];
    for (let i = 0; i < DN; i++) dv.push({ t: R() * 1.2, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const drops = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.22, map: softDot(), transparent: true, opacity: 0.9, depthWrite: false, color: '#ffffff' }));
    drops.frustumCulled = false; drops.renderOrder = 4; scene.add(drops);
    let lastT = 0;
    out.animate.push((time) => {
      const dt = Math.min(0.05, Math.max(0, time - lastT)); lastT = time;
      for (let i = 0; i < DN; i++) {
        const d = dv[i]; d.t -= dt;
        if (d.t <= 0) { d.t = 0.7 + R() * 0.6; d.x = xc - 1.2 + (R() - 0.5) * 2; d.y = 0.1; d.z = z0 + (R() - 0.5) * 6; const a = R() * Math.PI * 2; d.vx = Math.cos(a) * 2.2 - 1.2; d.vz = Math.sin(a) * 2.2; d.vy = 3 + R() * 4; }
        d.vy -= 12 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        dp[i * 3] = d.x; dp[i * 3 + 1] = Math.max(0, d.y); dp[i * 3 + 2] = d.z;
      }
      dg.attributes.position.needsUpdate = true;
    });
    out.animate.push((time) => {
      for (let i = 0; i < N; i++) {
        const s = seeds[i]; const ph = (time * (0.15 + s * 0.2) + s) % 1;
        const a = s * 40.0;
        mp[i * 3] = xc - 1 - ph * 3 * Math.abs(Math.cos(a)) ;
        mp[i * 3 + 1] = 0.2 + ph * 4.5;
        mp[i * 3 + 2] = z0 + Math.sin(a) * (1 + ph * 3.5);
      }
      mg.attributes.position.needsUpdate = true;
      mm.opacity = 0.5;
    });
  }

  return out;
}
