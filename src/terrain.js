import * as THREE from 'three';
import { fbm, ss, NOISE_GLSL } from './noise.js';

// ---- World layout -------------------------------------------------------
// Water surface is y = 0. Player spawns on the eastern sea cliff and looks
// north-west across the bay toward the central spire island.
export const GC = { x: 30, z: -130 };   // terrain grid centre
export const GR = 1700;                  // terrain half-extent
export const HB = { x0: -770, z0: -1130, size: 1600 }; // seabed height texture bounds

export function coastX(z) {
  return 88 + 0.3 * Math.max(0, -z - 20)
    - 32 * Math.exp(-(((z - 45) / 60) ** 2))
    + 5 * Math.sin(z * 0.021) + 3 * Math.sin(z * 0.057 + 1.3);
}
export const FALL_Z = -60; // waterfall location along the coast

function cliffH(z) {
  return 4.2 + 3.0 * fbm(z * 0.012, 3.7, 3, 21) + 6.5 * Math.exp(-(((z - FALL_Z) / 24) ** 2));
}

export const ISLANDS = [
  { name: 'central', x: -40, z: -195, r: 58, top: 3.3, wob: 7 },
  { name: 'spire', x: 95, z: -335, r: 34, top: 2.7, wob: 4 },
  { name: 'needle', x: 40, z: -650, r: 30, top: 2.4, wob: 5 },
  { name: 'islet1', x: -150, z: -110, r: 15, top: 1.7, wob: 3 },
  { name: 'islet2', x: -8, z: -55, r: 7, top: 1.1, wob: 2 },
  { name: 'islet3', x: -230, z: -330, r: 22, top: 2.0, wob: 4 },
  { name: 'west', x: -330, z: -560, r: 44, top: 2.6, wob: 7 },
  { name: 'farwest', x: -560, z: -930, r: 120, top: 5, wob: 20, hills: 40 },
  { name: 'farnorth', x: 160, z: -1050, r: 70, top: 3, wob: 12, hills: 18 },
];

function shelf(d, a, b) {
  return -0.35 - 2.6 * (1 - Math.exp(d / a)) - 15 * (1 - Math.exp(d / b));
}

// The stream that feeds the waterfall runs east→west along z = FALL_Z; it is carved into the ground
// so the player wades in it rather than walking on top of the water ribbon.
export function streamCarve(x, z) {
  const xc = coastX(FALL_Z), dz = Math.abs(z - FALL_Z);
  if (dz > 3.2 || x < xc + 4 || x > xc + 72) return 0;
  return 0.5 * ss(xc + 4, xc + 9, x) * (1 - ss(xc + 62, xc + 72, x)) * (1 - ss(1.3, 3.0, dz));
}
export function H(x, z) { return H0(x, z) - streamCarve(x, z); }
// water surface height at (x,z), or null on dry land
export function waterSurface(x, z) {
  const c = streamCarve(x, z);
  if (c > 0.03) return H0(x, z) - 0.1;
  return H0(x, z) < 0.05 ? 0 : null;
}
// ---- Flattened pads -------------------------------------------------------
// Building lots, plazas and road beds are graded flat so every structure meets the ground.
// Pads are registered (planCity / planStructures) before the terrain mesh is built; H0 blends
// the natural ground toward each pad's height with a smooth bank around the footprint.
export const PADS = [];
const PGRID = new Map(), PCELL = 32;
const pkey = (i, j) => i * 92821 + j;
export function addPad(p) {
  p.blend = p.blend ?? 5;
  if (p.type === 'poly') {
    // a road or path: one pad whose height follows the nearest point of the whole polyline
    PADS.push(p);
    for (let i = 0; i < p.pts.length - 1; i++) {
      const [ax, az] = p.pts[i], [bx, bz] = p.pts[i + 1];
      const e = { parent: p, ax, az, bx, bz, ay: p.hs[i], by: p.hs[i + 1] };
      const R = p.hw + p.blend;
      const i0 = Math.floor((Math.min(ax, bx) - R) / PCELL), i1 = Math.floor((Math.max(ax, bx) + R) / PCELL), j0 = Math.floor((Math.min(az, bz) - R) / PCELL), j1 = Math.floor((Math.max(az, bz) + R) / PCELL);
      for (let ii = i0; ii <= i1; ii++) for (let jj = j0; jj <= j1; jj++) { const k = pkey(ii, jj); if (!PGRID.has(k)) PGRID.set(k, []); PGRID.get(k).push(e); }
    }
    return p;
  }
  let ext;
  if (p.type === 'circle') ext = p.r;
  else if (p.type === 'rect') { ext = Math.hypot(p.hw, p.hd); p.c = Math.cos(p.rot || 0); p.s = Math.sin(p.rot || 0); }
  else { p.x = (p.ax + p.bx) / 2; p.z = (p.az + p.bz) / 2; ext = Math.hypot(p.bx - p.ax, p.bz - p.az) / 2 + p.hw; }
  p.R = ext + p.blend;
  const i0 = Math.floor((p.x - p.R) / PCELL), i1 = Math.floor((p.x + p.R) / PCELL), j0 = Math.floor((p.z - p.R) / PCELL), j1 = Math.floor((p.z + p.R) / PCELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = pkey(i, j); if (!PGRID.has(k)) PGRID.set(k, []); PGRID.get(k).push(p); }
  PADS.push(p);
  return p;
}
// signed distance from (x,z) to the pad footprint (<0 inside) and the pad height there
function padDist(p, x, z) {
  const dx = x - p.x, dz = z - p.z;
  if (p.type === 'circle') return [Math.hypot(dx, dz) - p.r, p.y];
  if (p.type === 'rect') {
    const lx = dx * p.c - dz * p.s, lz = dx * p.s + dz * p.c;
    const qx = Math.abs(lx) - p.hw, qz = Math.abs(lz) - p.hd;
    return [Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0), p.y];
  }
  const vx = p.bx - p.ax, vz = p.bz - p.az, L2 = vx * vx + vz * vz;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - p.ax) * vx + (z - p.az) * vz) / L2)) : 0;
  return [Math.hypot(p.ax + vx * t - x, p.az + vz * t - z) - p.hw, p.ay + (p.by - p.ay) * t];
}
function segD(e, x, z) {
  const vx = e.bx - e.ax, vz = e.bz - e.az, L2 = vx * vx + vz * vz;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - e.ax) * vx + (z - e.az) * vz) / L2)) : 0;
  return [Math.hypot(e.ax + vx * t - x, e.az + vz * t - z), e.ay + (e.by - e.ay) * t];
}
function applyPads(x, z, h) {
  const list = PGRID.get(pkey(Math.floor(x / PCELL), Math.floor(z / PCELL)));
  if (!list) return h;
  for (let k = 0; k < list.length; k++) {
    const p = list[k];
    if (p.parent) {
      // the run of segments that belong to one polyline: nearest one decides
      const par = p.parent; let bd = Infinity, by = 0;
      while (k < list.length && list[k].parent === par) { const [d, y] = segD(list[k], x, z); if (d < bd) { bd = d; by = y; } k++; }
      k--;
      const d = bd - par.hw;
      if (d >= par.blend) continue;
      const w = d <= 0 ? 1 : 1 - ss(0, par.blend, d);
      h += (by - h) * w;
      continue;
    }
    const dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz > p.R * p.R) continue;
    const [d, y] = padDist(p, x, z);
    if (d >= p.blend) continue;
    const w = d <= 0 ? 1 : 1 - ss(0, p.blend, d);
    h += (y - h) * w;
  }
  return h;
}
// is (x,z) on a pad that should stay clear of trees, rocks and grass?
export function reserved(x, z, margin = 0) {
  const list = PGRID.get(pkey(Math.floor(x / PCELL), Math.floor(z / PCELL)));
  if (!list) return null;
  for (const p of list) {
    if (p.parent) { if (p.parent.clear === false) continue; const [d] = segD(p, x, z); if (d - p.parent.hw < margin + (p.parent.margin || 0)) return p.parent; continue; }
    if (p.clear === false) continue;
    const [d] = padDist(p, x, z);
    if (d < margin + (p.margin || 0)) return p;
  }
  return null;
}
// within a pad or its graded bank? (the terrain shader keeps these grassy instead of painting rock)
export function onPad(x, z) {
  const list = PGRID.get(pkey(Math.floor(x / PCELL), Math.floor(z / PCELL)));
  if (!list) return false;
  for (const p of list) {
    if (p.parent) { const [d] = segD(p, x, z); if (d - p.parent.hw < p.parent.blend + 0.5) return true; continue; }
    const [d] = padDist(p, x, z); if (d < p.blend + 0.5) return true;
  }
  return false;
}
// natural ground without any grading (used to choose pad heights)
export function rawH0(x, z) { return baseH0(x, z); }
export function H0(x, z) {
  let h = baseH0(x, z);
  if (PADS.length) h = applyPads(x, z, h);
  return h;
}
function baseH0(x, z) {
  const n1 = fbm(x * 0.02, z * 0.02, 3, 3);
  // East coast with cliff
  let h;
  {
    const d = x - coastX(z) + (n1 - 0.5) * 9;
    if (d < 0) h = shelf(d, 30, 170);
    else {
      const steep = 1 + 1.6 * Math.exp(-(((z - FALL_Z) / 22) ** 2));
      h = -0.35 + 1.1 * ss(0, 2.2, d) + cliffH(z) * ss(1.6, 1.6 + 5.5 / steep, d);
      h += 36 * ss(30, 210, d) * (0.5 + 0.9 * fbm(x * 0.006, z * 0.006, 3, 11));
    }
  }
  for (let i = 0; i < ISLANDS.length; i++) {
    const I = ISLANDS[i];
    const dx = x - I.x, dz = z - I.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > I.r + 900) continue;
    const d = I.r + (n1 - 0.5) * 2 * I.wob - dist;
    let v;
    if (d < 0) v = shelf(d, 20, 130);
    else {
      v = -0.35 + 0.95 * ss(0, 5, d) + (I.top - 0.6) * ss(5, 18, d);
      if (I.hills) v += I.hills * ss(20, I.r, d) * (0.4 + fbm(x * 0.01, z * 0.01, 3, 31));
    }
    if (v > h) h = v;
  }
  if (h < -22) h = -22;
  if (h > 0.8) h += (fbm(x * 0.035, z * 0.035, 4, 5) - 0.5) * 3.0 * ss(0.8, 6, h);
  else if (h < -0.8) h += (fbm(x * 0.06, z * 0.06, 3, 9) - 0.5) * 1.8 * ss(-0.8, -4, h);
  // sink everything near the grid edge so the mesh border is never seen
  const e = Math.max(Math.abs(x - GC.x), Math.abs(z - GC.z)) / GR;
  if (e > 0.8) h = h + (-24 - h) * ss(0.8, 0.97, e);
  return h;
}

export function slope(x, z) {
  const e = 0.6;
  const gx = (H(x + e, z) - H(x - e, z)) / (2 * e);
  const gz = (H(x, z + e) - H(x, z - e)) / (2 * e);
  return { gx, gz, m: Math.hypot(gx, gz) };
}

// ---- Terrain mesh ---------------------------------------------------------
function mapU(u) { return GR * (0.18 * u + 0.82 * Math.sign(u) * Math.abs(u) ** 5); }

export function buildTerrain(timeUniform, quality) {
  const N = quality === 'low' ? 384 : 512;
  const verts = (N + 1) * (N + 1);
  const pos = new Float32Array(verts * 3);
  const col = new Float32Array(verts * 3);
  const idx = new Uint32Array(N * N * 6);
  for (let j = 0; j <= N; j++) {
    const z = GC.z + mapU(j / N * 2 - 1);
    for (let i = 0; i <= N; i++) {
      const x = GC.x + mapU(i / N * 2 - 1);
      const k = (j * (N + 1) + i) * 3;
      pos[k] = x; pos[k + 1] = H(x, z); pos[k + 2] = z;
    }
  }
  let t = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
    idx[t++] = a; idx[t++] = c; idx[t++] = b;
    idx[t++] = b; idx[t++] = c; idx[t++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal.array;

  const C = (h) => new THREE.Color(h);
  const sandDry = C('#f6eed5'), sandWet = C('#dccf9f'), sandSea = C('#e9dcae'),
    seaTeal = C('#62c6b2'), seaWeed = C('#3f9474'), seaDeep = C('#2f8aa6'),
    grassA = C('#86c847'), grassB = C('#5fa936'), grassHigh = C('#5c9a3c'),
    rock = C('#a9aca3'), rockDark = C('#7f8580');
  const c = new THREE.Color();
  for (let v = 0; v < verts; v++) {
    const x = pos[v * 3], h = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const ny = nrm[v * 3 + 1];
    const n = fbm(x * 0.05, z * 0.05, 3, 77);
    if (h < -0.25) {
      const dep = -h;
      c.copy(sandSea).lerp(seaTeal, ss(0.3, 7, dep));
      c.lerp(seaWeed, ss(0.55, 0.75, n) * ss(1.5, 4, dep) * 0.8);
      c.lerp(seaDeep, ss(8, 18, dep));
    } else if (h < 1.6) {
      c.copy(sandWet).lerp(sandDry, ss(-0.2, 0.6, h));
      c.lerp(grassA, ss(1.0, 1.6, h) * 0.6);
    } else {
      c.copy(grassA).lerp(grassB, ss(0.35, 0.7, n));
      c.lerp(grassHigh, ss(18, 40, h));
    }
    // rock on steep slopes
    const r = ss(0.86, 0.62, ny) * (h > -1.5 ? 1 : 0.4) * (h > 1.5 && onPad(x, z) ? 0 : 1);
    if (r > 0) c.lerp(n > 0.5 ? rock : rockDark, r);
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\n' + NOISE_GLSL)
      .replace('#include <opaque_fragment>', /* glsl */`
        float dep = -vWPos.y;
        if (dep > 0.0) {
          float cz = caustic(vWPos.xz * 0.42, uTime * 0.9);
          outgoingLight *= mix(vec3(1.0), vec3(0.72, 0.97, 1.0), smoothstep(0.0, 6.0, dep));
          outgoingLight += vec3(0.85, 1.0, 1.0) * cz * 0.55 * smoothstep(0.0, 0.35, dep) * (1.0 - smoothstep(1.0, 10.0, dep));
        }
        #include <opaque_fragment>`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// Seabed height texture for the water shader (depth colour, transparency, foam).
export function buildHeightTexture(res = 512) {
  const data = new Uint16Array(res * res);
  const heights = new Float32Array(res * res);
  for (let j = 0; j < res; j++) {
    const z = HB.z0 + (j + 0.5) / res * HB.size;
    for (let i = 0; i < res; i++) {
      const x = HB.x0 + (i + 0.5) / res * HB.size;
      const h = H(x, z);
      heights[j * res + i] = h;
      data[j * res + i] = THREE.DataUtils.toHalfFloat(h);
    }
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  tex.userData = { heights, res };
  return tex;
}
