import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Collects static geometry per material and merges it into few draw calls.
export class Batch {
  constructor() { this.map = new Map(); }
  add(geo, mat, mtx) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    g.morphAttributes = {};
    if (mtx) g.applyMatrix4(mtx);
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(g);
    return this;
  }
  build(parent, { cast = true, receive = true } = {}) {
    const out = [];
    for (const [mat, list] of this.map) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = cast && !mat.transparent;
      mesh.receiveShadow = receive;
      if (mat.transparent) mesh.renderOrder = 1;
      parent.add(mesh);
      out.push(mesh);
    }
    this.map.clear();
    return out;
  }
}

export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(sx, sy, sz));
}

// A lens-section curved blade ("sail") that tapers to a point.
export function bladeGeo(h, w, lean, thick = 0.9, curl = 0.05) {
  const U = 10, V = 36; const pos = [], idx = [];
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? 1 : -1;
    const base = pos.length / 3;
    for (let j = 0; j <= V; j++) {
      const v = j / V;
      const hw = w / 2 * Math.pow(1 - v, 0.75) * (1 + 0.35 * Math.sin(Math.PI * v));
      const xc = lean * v * v;
      for (let i = 0; i <= U; i++) {
        const u = i / U * 2 - 1;
        const th = thick * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.85 * v);
        pos.push(xc + u * hw, h * v, curl * (u * hw) ** 2 + side * th);
      }
    }
    for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) {
      const a = base + j * (U + 1) + i, b = a + 1, c = a + U + 1, d = c + 1;
      if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function latheGeo(h, r, fn, seg = 28, steps = 48) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(new THREE.Vector2(Math.max(0.02, r * fn(t)), h * t));
  }
  return new THREE.LatheGeometry(pts, seg);
}

// Box-section ribbon following a polyline (bridges, ramps). thickFn(t, i) gives depth below top.
export function ribbonGeo(points, width, thickFn) {
  const n = points.length;
  const L = [], R = [], BL = [], BR = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    const t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    const side = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(width / 2);
    const p = points[i];
    const th = thickFn ? thickFn(i / (n - 1), i) : 0.6;
    L.push(p.clone().add(side)); R.push(p.clone().sub(side));
    BL.push(L[i].clone().addScaledVector(up, -th)); BR.push(R[i].clone().addScaledVector(up, -th));
  }
  const pos = [], idx = [];
  const strip = (A, B) => {
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) { pos.push(A[i].x, A[i].y, A[i].z, B[i].x, B[i].y, B[i].z); }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
  };
  strip(L, R); strip(R, BR); strip(BR, BL); strip(BL, L);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// One reusable canopy for trees, hedges and balcony planting. Rounded lobes and
// a baked underside tint add depth without more triangles or extra draw calls.
export function foliageGeo() {
  const source = new THREE.IcosahedronGeometry(1, 2);
  source.deleteAttribute('normal'); source.deleteAttribute('uv');
  const g = mergeVertices(source); source.dispose();
  const p = g.attributes.position, colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const r = Math.min(1, 0.94 + 0.045 * Math.sin(a * 5 + y * 2)
      + 0.02 * Math.cos(a * 8 - y * 3) + 0.025 * Math.sin(y * 8));
    p.setXYZ(i, x * r, y * r, z * r);
    const t = THREE.MathUtils.smoothstep(y, -0.85, 0.8);
    colors[i * 3] = 0.68 + 0.32 * t;
    colors[i * 3 + 1] = 0.76 + 0.24 * t;
    colors[i * 3 + 2] = 0.70 + 0.30 * t;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

// Instanced blobs (foliage, bushes, building greenery) with per-instance colour.
export class Blobs {
  constructor(geo) { this.geo = geo; this.items = []; }
  add(x, y, z, sx, sy, sz, color, ry = 0) { this.items.push([x, y, z, sx, sy, sz, color, ry]); }
  build(parent, mat, { cast = true, receive = true } = {}) {
    const n = this.items.length;
    const mesh = new THREE.InstancedMesh(this.geo, mat, Math.max(1, n));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const [x, y, z, sx, sy, sz, col, ry] = this.items[i];
      q.setFromEuler(e.set(0, ry, 0));
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(col));
    }
    mesh.count = n;
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    mesh.computeBoundingSphere();
    parent.add(mesh);
    return mesh;
  }
}
