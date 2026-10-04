import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M } from './geo.js';
import { H } from './terrain.js';
import { nearFade } from './nearfade.js';
import { rng } from './noise.js';

// Original orchard silhouettes: broad, broken leaf fans on a visible branching
// structure. Geometry is baked together for both trees, with no leaf alpha cards.
function branchGeo(points, radius, tip, sides = 9, steps = 9) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const frames = curve.computeFrenetFrames(steps, false);
  const pos = [], idx = [], colors = [], v = new THREE.Vector3();
  const dark = new THREE.Color('#6e4934'), light = new THREE.Color('#b48c60'), c = new THREE.Color();
  for (let j = 0; j <= steps; j++) {
    const t = j / steps, center = curve.getPoint(t);
    const r = radius * Math.pow(1 - t, 0.82) + tip * t;
    for (let k = 0; k < sides; k++) {
      const a = k / sides * Math.PI * 2;
      const ridges = 1 + 0.045 * Math.sin(a * 5 + t * 0.65);
      v.copy(center).addScaledVector(frames.normals[j], Math.cos(a) * r * ridges)
        .addScaledVector(frames.binormals[j], Math.sin(a) * r * ridges);
      pos.push(v.x, v.y, v.z);
      c.copy(dark).lerp(light, 0.4 + 0.16 * t + 0.15 * Math.cos(a * 3 + 0.7));
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < steps; j++) for (let k = 0; k < sides; k++) {
    const a = j * sides + k, b = j * sides + (k + 1) % sides;
    idx.push(a, b, a + sides, b, b + sides, a + sides);
  }
  for (let end = 0; end < 2; end++) {
    const center = pos.length / 3, p = points[end ? points.length - 1 : 0], ring = end * steps * sides;
    pos.push(p.x, p.y, p.z); colors.push(dark.r, dark.g, dark.b);
    for (let k = 0; k < sides; k++) {
      const a = ring + k, b = ring + (k + 1) % sides;
      if (end) idx.push(center, a, b); else idx.push(center, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function leafFanGeo(seed, orange) {
  const g = new THREE.SphereGeometry(1, 18, 9);
  const p = g.attributes.position, colors = [];
  const bottom = new THREE.Color(orange ? '#41864e' : '#488b4b');
  const middle = new THREE.Color(orange ? '#75af57' : '#85b951');
  const top = new THREE.Color(orange ? '#bed979' : '#d1e28d'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    // Rounded, asymmetric leaf pillows: volume and uneven lobes replace the old
    // flattened discs. A few bigger lobes read at mobile distance without noise.
    const edge = 0.94 + 0.12 * Math.sin(a * 3 + seed) + 0.075 * Math.sin(a * 7 - seed + y * 2);
    const py = y * (y > 0 ? 0.77 : 0.56);
    const rise = (1 - y * y) * (0.13 * Math.sin(a * 3 + seed) + 0.075 * Math.cos(a * 5 - seed));
    p.setXYZ(i, x * edge * (1 + y * 0.05), py + rise, z * edge * (0.93 + 0.06 * Math.sin(seed)));
    c.copy(bottom).lerp(middle, THREE.MathUtils.smoothstep(y, -0.9, 0.1));
    c.lerp(top, THREE.MathUtils.smoothstep(y, 0, 1) * 0.78);
    const patch = 0.97 + 0.03 * Math.sin(a * 2 + seed + y * 3);
    colors.push(c.r * patch, c.g * patch, c.b * patch);
  }
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.7, uv.getY(i) * 1.4);
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function leafBladeGeo(color) {
  const pos = [], idx = [], col = [], uv = [];
  const c = new THREE.Color(color);
  for (let j = 0; j <= 4; j++) {
    const t = j / 4, width = Math.sin(t * Math.PI) * 0.21;
    pos.push(-width, 0, t * 0.74, 0, Math.sin(t * Math.PI) * 0.055, t * 0.74, width * 0.88, 0, t * 0.74);
    uv.push(0.07, 0.08 + t * 0.05, 0.085, 0.08 + t * 0.05, 0.10, 0.08 + t * 0.05);
    for (let k = 0; k < 3; k++) col.push(c.r * (k === 1 ? 1.08 : 0.94), c.g * (k === 1 ? 1.08 : 0.94), c.b * (k === 1 ? 1.08 : 0.94));
  }
  for (let j = 0; j < 4; j++) for (let k = 0; k < 2; k++) {
    const a = j * 3 + k; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function canopyTexture() {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), R = rng(150624);
  g.fillStyle = '#dce6c9'; g.fillRect(0, 0, S, S);
  const palette = [['#edf2d6', '#c4d2a5'], ['#d2deb8', '#9fb483'], ['#f2f5df', '#c8d9aa'], ['#dbe6c4', '#b5c799']];
  // Opaque, authored leaf marks sit on the crown surface. Seam copies make the
  // single shared texture tile cleanly, with no alpha-test or transparent cards.
  for (let i = 0; i < 158; i++) {
    const x = R() * S, y = R() * S, angle = R() * Math.PI * 2;
    const len = 28 + R() * 38, wid = len * (0.22 + R() * 0.08);
    const pair = palette[Math.floor(R() * palette.length)];
    for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
      g.save(); g.translate(x + ox, y + oy); g.rotate(angle);
      const fill = g.createLinearGradient(-wid, -len * 0.25, wid, len * 0.35);
      fill.addColorStop(0, pair[0]); fill.addColorStop(1, pair[1]);
      g.fillStyle = fill; g.strokeStyle = 'rgba(72,102,43,0.23)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(0, -len * 0.5);
      g.bezierCurveTo(wid * 0.75, -len * 0.36, wid, len * 0.12, 0, len * 0.5);
      g.bezierCurveTo(-wid * 0.8, len * 0.1, -wid * 0.7, -len * 0.27, 0, -len * 0.5);
      g.fill(); g.stroke();
      g.strokeStyle = 'rgba(70,101,43,0.31)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(0, -len * 0.41); g.quadraticCurveTo(wid * 0.12, 0, 0, len * 0.39); g.stroke();
      g.lineWidth = 0.85;
      for (let k = -1; k <= 1; k++) {
        const vy = k * len * 0.16;
        g.beginPath(); g.moveTo(0, vy + 4); g.lineTo(wid * 0.66, vy - 5);
        g.moveTo(0, vy + 4); g.lineTo(-wid * 0.58, vy - 4); g.stroke();
      }
      g.restore();
    }
  }
  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  return texture;
}

function mergeParts(parts) {
  const list = parts.map(g => g.index ? g.toNonIndexed() : g);
  const g = mergeGeometries(list, false);
  for (const p of list) p.dispose();
  for (const p of parts) if (p.index) p.dispose();
  g.computeBoundingSphere();
  return g;
}

export function buildSpawnFruitTrees(scene, specs, timeU, quality) {
  const wood = [], leaves = [], solids = [], trees = [];
  const fanCache = [leafFanGeo(0.8, false), leafFanGeo(2.7, false), leafFanGeo(1.6, true), leafFanGeo(3.2, true)];
  const leafCache = [leafBladeGeo('#85b655'), leafBladeGeo('#a5c867')];
  const woodSides = quality === 'low' ? 9 : 11;
  for (const spec of specs) {
    const { id, type, x, z, s } = spec, y = H(x, z);
    const orange = type === 'orange', R = rng(orange ? 80531 : 30617);
    const P = (a, b, c) => new THREE.Vector3(x + a * s, y + b * s, z + c * s);
    const addWood = (points, r, tip, steps = 9) => wood.push(branchGeo(points, r * s, tip * s, woodSides, steps));
    const addFan = (center, sx, sy, sz, turn, variant = 0) => {
      const g = fanCache[(orange ? 2 : 0) + variant].clone();
      g.applyMatrix4(M(center.x, center.y, center.z, 0, turn, 0, sx * s, sy * s, sz * s));
      leaves.push(g);
    };
    const addLeaf = (center, turn, tilt = 0.25, scale = 1, bright = false) => {
      const g = leafCache[bright ? 1 : 0].clone();
      g.applyMatrix4(M(center.x, center.y, center.z, tilt, turn, -0.12, scale * s));
      leaves.push(g);
    };
    // A short, curved base forks early rather than a straight telephone pole.
    const fork = P(0.18, 2.65, 0.13);
    addWood([P(0, -0.2, 0), P(-0.12, 0.7, 0.07), P(0.27, 1.75, -0.1), fork], 0.5, 0.32, 11);
    addWood([fork, P(0.05, 3.8, -0.12), P(0.4, 5.2, -0.42), P(0.05, 6.95, -0.35)], 0.29, 0.045, 10);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + 0.3;
      addWood([P(0, 0.38, 0), P(Math.cos(a) * 0.48, 0.07, Math.sin(a) * 0.48),
        P(Math.cos(a) * 0.74, -0.13, Math.sin(a) * 0.74)], 0.16, 0.025, 5);
    }
    const crowns = orange
      ? [[-2.2, 4.85, -0.9], [-1.5, 6.25, 1.15], [0.1, 7.05, -0.25], [2.0, 6.0, -0.7], [1.8, 4.95, 1.45]]
      : [[-2.9, 4.65, -0.65], [-1.55, 6.1, 1.45], [0.45, 7.0, -0.4], [2.7, 5.75, -0.65], [1.95, 4.7, 1.9]];
    crowns.forEach(([cx, cy, cz], i) => {
      const end = P(cx, cy, cz), rise = 0.6 + R() * 0.3;
      const start = i === 2 ? P(0.3, 5.1, -0.35) : fork;
      const mid = start.clone().lerp(end, 0.55).add(new THREE.Vector3(0, rise * s, 0));
      addWood([start, mid, end], i === 2 ? 0.15 : 0.24, 0.04, 8);
      const turn = Math.atan2(cz, cx) + 0.4;
      // Adjacent fans form one readable crown tier, while gaps expose forks.
      const width = (i === 2 ? 1.55 : 1.85) * (orange ? 0.86 : 1);
      addFan(end, width, 1.08 + (i % 2) * 0.16, width * 0.88, turn, i % 2);
      for (let k = 0; k < 2; k++) {
        const a = turn + (k ? 1.1 : -1.0), off = width * 0.62;
        const c = end.clone().add(new THREE.Vector3(Math.cos(a) * off * s, (k ? 0.47 : -0.26) * s, Math.sin(a) * off * s));
        addFan(c, width * (k ? 0.52 : 0.61), k ? 0.92 : 0.75, width * 0.61, a + 0.35, (i + k) % 2);
        // Sparse, larger edge leaves give a leafy contour without particle noise.
        for (let l = 0; l < 3; l++) {
          const la = a + (l - 1) * 0.32;
          const p = c.clone().add(new THREE.Vector3(Math.sin(la) * 0.84 * s, 0.03 * s, Math.cos(la) * 0.84 * s));
          addLeaf(p, la, 0.3 + l * 0.16, 0.94, l === 1);
        }
      }
      solids.push({ type: 'ell', x: end.x, y: end.y + 0.15 * s, z: end.z,
        rx: width * 1.1 * s, ry: 0.6 * s, rz: width * s, bottom: end.y - 0.38 * s, tag: 'tree' });
    });
    // Reachable fruit arms are deliberately separate from the high shade crown.
    const fruitLayout = [[-1.9, 2.10, -0.65], [-1.35, 2.35, 1.25], [0.1, 2.55, 1.9], [1.8, 2.25, 0.65], [1.45, 2.45, -1.3]];
    const fruits = fruitLayout.map(([fx, height, fz], i) => {
      const fruit = P(fx * (orange ? 0.9 : 1), 0, fz * (orange ? 0.9 : 1));
      fruit.y = H(fruit.x, fruit.z) + height;
      const attach = fruit.clone(); attach.y += orange ? 0.20 : 0.22;
      const start = P(0.2, 2.0 + i * 0.06, 0.03);
      const elbow = start.clone().lerp(attach, 0.58); elbow.y = Math.max(start.y, attach.y) + 0.48 * s;
      addWood([start, elbow, attach], 0.082, 0.009, 7);
      const a = Math.atan2(fruit.x - x, fruit.z - z);
      const leafStart = attach.clone().lerp(elbow, 0.35);
      addLeaf(leafStart, a + 0.45, 0.12, 0.8);
      addLeaf(leafStart, a - 0.75, -0.05, 0.65, true);
      // A small leaf fan over the elbow signals a low branch; the fruit stays
      // outside/below its edge, visible from the ground along the promenade.
      const cover = elbow.clone(); cover.y += 0.17 * s;
      addFan(cover, 0.55, 0.52, 0.48, a, i % 2);
      return { x: fruit.x, y: fruit.y, z: fruit.z };
    });
    solids.push({ type: 'cyl', x, z, r: 0.62 * s, top: y + 3.0 * s, bottom: y - 1, tag: 'tree' });
    trees.push({ id, type, x, y, z, fruits });
  }
  const barkMat = nearFade(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.4, 1.3);
  const tex = canopyTexture();
  const leafMat = nearFade(new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide,
    emissive: '#456031', emissiveIntensity: 0.26, emissiveMap: tex }), 0.6, 2.2);
  leafMat.onBeforeCompile = sh => {
    sh.uniforms.uTreeTime = timeU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTreeTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float sw = sin(uTreeTime * 1.1 + position.x * 0.53 + position.z * 0.41);
        transformed.x += sw * 0.035; transformed.z += cos(uTreeTime + position.z * 0.61) * 0.025;`);
  };
  for (const [name, parts, mat] of [['orchard-bark', wood, barkMat], ['orchard-canopies', leaves, leafMat]]) {
    const mesh = new THREE.Mesh(mergeParts(parts), mat);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
  }
  for (const g of [...fanCache, ...leafCache]) g.dispose();
  return { trees, solids };
}
