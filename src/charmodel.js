import * as THREE from 'three';
import { applyModelTrial } from './modeltrial.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Anime-style character builder (original designs).
// Rendering follows common NPR practice: two-tone ramp with a tinted shadow colour, a fresnel rim light,
// an inverted-hull outline, a hand-painted face texture and strand-built hair with a highlight band.
// The rig is the same group hierarchy the animation code drives: pose → torso → head / shoulders, pose → hips.

const C = (hex) => new THREE.Color(hex);
const lin = (hex) => C(hex); // THREE.Color stores linear values

// ---------- materials ----------
const rampCache = new Map();
function ramp(shadeHex) {
  if (rampCache.has(shadeHex)) return rampCache.get(shadeHex);
  const s = lin(shadeHex), N = 8, d = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const k = i < 3 ? 0 : i === 3 ? 0.35 : 1;
    d[i * 4] = Math.round((s.r + (1 - s.r) * k) * 255); d[i * 4 + 1] = Math.round((s.g + (1 - s.g) * k) * 255); d[i * 4 + 2] = Math.round((s.b + (1 - s.b) * k) * 255); d[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  rampCache.set(shadeHex, t);
  return t;
}
const GRAD_RGB = `
#ifdef USE_GRADIENTMAP
uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
  float dotNL = dot( normal, lightDirection );
  vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
  #ifdef USE_GRADIENTMAP
  return texture2D( gradientMap, coord ).rgb;
  #else
  return vec3( 1.0 );
  #endif
}`;
let matId = 0;
export function toon(color, shade, { side = THREE.FrontSide, map = null, rim = 0.35, rimColor = '#ffffff', hair = false, emissive = null, ei = 0 } = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp(shade), side, map });
  if (emissive) { m.emissive = C(emissive); m.emissiveIntensity = ei; }
  const id = matId++;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rim }; sh.uniforms.uRimColor = { value: C(rimColor) };
    sh.fragmentShader = 'uniform float uRim; uniform vec3 uRimColor;\n' + sh.fragmentShader
      .replace('#include <gradientmap_pars_fragment>', GRAD_RGB)
      .replace('#include <opaque_fragment>', `
        {
          vec3 vd = normalize( vViewPosition );
          float ndv = clamp( dot( normal, vd ), 0.0, 1.0 );
          outgoingLight += uRimColor * smoothstep( 0.55, 0.95, 1.0 - ndv ) * uRim;
          ${hair ? 'float band = smoothstep(0.18, 0.3, normal.y) * smoothstep(0.52, 0.38, normal.y) * smoothstep(0.25, 0.65, ndv); outgoingLight += vec3(1.0, 0.98, 0.95) * band * 0.22;' : ''}
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'toon' + (hair ? 'h' : '') + (map ? 'm' : '');
  m.userData.id = id;
  return m;
}
const outlineCache = new Map();
export function outlineMat(hex, width = 1) {
  const key = hex + width;
  if (outlineCache.has(key)) return outlineCache.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: C(hex) }, uW: { value: 0.0021 * width } },
    side: THREE.BackSide,
    vertexShader: `uniform float uW; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); mv.xyz += n * uW * clamp(-mv.z, 1.2, 24.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor;
void main(){
  gl_FragColor = vec4(uColor, 1.0);
  #include <colorspace_fragment>
}`,
  });
  outlineCache.set(key, m);
  return m;
}

// ---------- baking: merge static parts per (group, material) and add outlines once ----------
// Characters and chests are assembled from many small primitives; merging them keeps draw calls low.
const KEEP = ['position', 'normal', 'uv'];
function prepGeo(m) {
  m.updateMatrix();
  let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
  for (const n of Object.keys(g.attributes)) if (!KEEP.includes(n)) g.deleteAttribute(n);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.applyMatrix4(m.matrix);
  if (m.matrix.determinant() < 0) { // mirrored part: restore winding
    for (const n of KEEP) {
      const a = g.attributes[n], k = a.itemSize;
      for (let i = 0; i < a.count; i += 3) for (let c = 0; c < k; c++) { const t = a.array[(i + 1) * k + c]; a.array[(i + 1) * k + c] = a.array[(i + 2) * k + c]; a.array[(i + 2) * k + c] = t; }
    }
  }
  g.morphAttributes = {};
  return g;
}
export function bake(root) {
  const groups = [];
  root.traverse((o) => { if (!o.isMesh && !o.isSprite && !o.isLight && !o.isPoints) groups.push(o); });
  for (const grp of groups) {
    const buckets = new Map();
    for (const c of [...grp.children]) {
      if (!c.isMesh || c.children.length || c.userData.keep || !c.visible) continue;
      const key = c.material.uuid + '|' + (c.userData.ow || 0) + '|' + (c.userData.oc || '') + '|' + c.castShadow + c.receiveShadow + c.renderOrder;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const merged = mergeGeometries(list.map(prepGeo), false);
      if (!merged) continue;
      const mm = new THREE.Mesh(merged, list[0].material);
      mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow; mm.renderOrder = list[0].renderOrder;
      mm.userData.ow = list[0].userData.ow; mm.userData.oc = list[0].userData.oc;
      for (const m of list) { grp.remove(m); m.geometry.dispose(); }
      grp.add(mm);
    }
  }
  root.traverse((o) => {
    if (!o.isMesh || !o.userData.ow || o.userData.hasOutline) return;
    const col = o.userData.oc || (o.material.userData.outline ? '#' + o.material.userData.outline : null);
    if (!col) return;
    const ol = new THREE.Mesh(o.geometry, outlineMat(col, o.userData.ow)); ol.castShadow = false; ol.raycast = () => {};
    o.add(ol); o.userData.hasOutline = true;
  });
}

// ---------- geometry helpers ----------
// loft: rings of ellipses stacked in y. ring = [y, rx, rz, cz=0, cx=0]. th0/th1 limit the sweep (partial = open sheet).
function loft(rings, seg = 24, { th0 = -Math.PI, th1 = Math.PI, wave = 0, waveN = 0 } = {}) {
  const full = Math.abs(th1 - th0 - Math.PI * 2) < 1e-4;
  const pos = [], uv = [], idx = [];
  const ys = rings.map((r) => r[0]), ymin = Math.min(...ys), ymax = Math.max(...ys);
  for (let i = 0; i < rings.length; i++) {
    const [y, rx, rz, cz = 0, cx = 0] = rings[i];
    for (let j = 0; j <= seg; j++) {
      const u = j / seg, th = th0 + (th1 - th0) * u;
      const w = 1 + (wave ? wave * Math.sin(th * waveN) * (i / (rings.length - 1)) : 0);
      pos.push(cx + Math.sin(th) * rx * w, y, cz + Math.cos(th) * rz * w);
      uv.push(full ? (th + Math.PI) / (Math.PI * 2) : u, (y - ymin) / ((ymax - ymin) || 1));
    }
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + 1, c2 = a + seg + 1, d = c2 + 1;
    idx.push(a, b, c2, b, d, c2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (full) { // weld the seam normals so the outline does not crack
    const n = g.attributes.normal;
    for (let i = 0; i < rings.length; i++) {
      const a = i * (seg + 1), b = a + seg;
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
  }
  // flip winding if needed so normals point outward (rings listed bottom→top)
  return g;
}
// tapered limb along -y: profile [[t(0..1), r], ...]
function limb(len, prof, seg = 12, flat = 1) {
  return loft(prof.map(([t, r]) => [-t * len, r, r * flat]).reverse(), seg);
}
// hair / ribbon strand along a curve; width tapers to the tip
function strand(pts, w0, th, { hint = new THREE.Vector3(0, 0, 1), taper = 1.4, wEnd = 0.08, n = 10, rs = 6 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const pos = [], idx = [];
  const T = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3(), P = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    curve.getPointAt(t, P); curve.getTangentAt(t, T);
    B.crossVectors(T, hint).normalize(); if (B.lengthSq() < 1e-6) B.set(1, 0, 0);
    N.crossVectors(B, T).normalize();
    const k = 1 - Math.pow(t, taper) * (1 - wEnd);
    const w = w0 * k * (0.75 + 0.25 * Math.sin(Math.min(1, t * 4) * Math.PI / 2)), h = th * (0.6 + 0.4 * k);
    for (let j = 0; j < rs; j++) {
      const a = j / rs * Math.PI * 2;
      pos.push(P.x + B.x * Math.cos(a) * w + N.x * Math.sin(a) * h, P.y + B.y * Math.cos(a) * w + N.y * Math.sin(a) * h, P.z + B.z * Math.cos(a) * w + N.z * Math.sin(a) * h);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < rs; j++) {
    const a = i * rs + j, b = i * rs + (j + 1) % rs, c2 = a + rs, d = b + rs;
    idx.push(a, c2, b, b, c2, d);
  }
  // caps
  const s0 = pos.length / 3; curve.getPointAt(0, P); pos.push(P.x, P.y, P.z);
  const s1 = pos.length / 3; curve.getPointAt(1, P); pos.push(P.x, P.y, P.z);
  for (let j = 0; j < rs; j++) { idx.push(s0, (j + 1) % rs, j); idx.push(s1, n * rs + j, n * rs + (j + 1) % rs); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const ellip = (rx, ry, rz, w = 16, h = 10, opts = {}) => { const g = new THREE.SphereGeometry(1, w, h, opts.p0 ?? 0, opts.pl ?? Math.PI * 2, opts.t0 ?? 0, opts.tl ?? Math.PI); g.scale(rx, ry, rz); return g; };

// A continuous cheek / jaw surface keeps the face smooth at portrait distance.
// The front is a little flatter than the skull, so the painted eyes sit on a face rather than a ball.
function faceGeometry(rings) {
  const smooth = [];
  const cubic = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[Math.max(0, i - 1)], b = rings[i], c = rings[i + 1], d = rings[Math.min(rings.length - 1, i + 2)];
    for (let j = 0; j < 2; j++) {
      const t = j / 2;
      smooth.push([THREE.MathUtils.lerp(b[0], c[0], t), Math.max(0.002, cubic(a[1], b[1], c[1], d[1], t)), Math.max(0.002, cubic(a[2], b[2], c[2], d[2], t)), cubic(a[3] || 0, b[3] || 0, c[3] || 0, d[3] || 0, t)]);
    }
  }
  smooth.push(rings[rings.length - 1]);
  const geo = loft(smooth, 40), pos = geo.attributes.position;
  for (let i = 0; i < smooth.length; i++) {
    const [y, , rz, cz = 0] = smooth[i];
    const cheek = THREE.MathUtils.smoothstep(y, -0.12, -0.04) * (1 - THREE.MathUtils.smoothstep(y, 0.035, 0.10));
    for (let j = 0; j <= 40; j++) {
      const th = -Math.PI + j / 40 * Math.PI * 2, front = Math.max(0, Math.cos(th));
      pos.setZ(i * 41 + j, cz + rz * Math.cos(th) + rz * 0.1 * cheek * Math.sin(th) ** 2 * front);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// Cloth panels use a continuous curved sheet with a stitched hem, instead of a flat box edge.
function clothPanel(len, w0, w1, curl = 0, pleat = 0.008) {
  const pos = [], uv = [], idx = [], rows = 6, cols = 8;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, w = THREE.MathUtils.lerp(w0, w1, t * t * (3 - 2 * t));
    for (let j = 0; j <= cols; j++) {
      const u = j / cols, x = (u * 2 - 1) * w;
      pos.push(x, -len * t + Math.sin(u * Math.PI) * 0.008 * t, curl * t * t + pleat * Math.cos((u - 0.5) * Math.PI * 2) * (0.3 + t * 0.7));
      uv.push(u, 1 - t);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + 1, c = a + cols + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

function clothHem(add, parent, w, len, curl, mat, pleat = 0.008) {
  const pts = [];
  for (let j = 0; j <= 8; j++) { const u = j / 8; pts.push(new THREE.Vector3((u * 2 - 1) * w, -len + Math.sin(u * Math.PI) * 0.008, curl + pleat * Math.cos((u - 0.5) * Math.PI * 2))); }
  add(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.005, 4, false), mat, [0, 0.009, 0], [0, 0, 0], null, { outline: 0 });
}

// ---------- face texture ----------
function faceTexture(F, closed = false) {
  const W = 1024, Hh = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
  const g = cv.getContext('2d');
  g.fillStyle = F.skin; g.fillRect(0, 0, W, Hh);
  const ymin = -0.135, ymax = 0.155;
  const Y = (y) => (1 - (y - ymin) / (ymax - ymin)) * Hh;
  const X = (th) => (th + Math.PI) / (Math.PI * 2) * W;
  const ey = Y(F.eyeY ?? -0.008), ex = 0.43;
  // blush
  for (const s of [-1, 1]) { const gr = g.createRadialGradient(X(s * 0.62), Y(-0.05), 2, X(s * 0.62), Y(-0.05), 30); gr.addColorStop(0, 'rgba(255,140,150,0.45)'); gr.addColorStop(1, 'rgba(255,140,150,0)'); g.fillStyle = gr; g.fillRect(X(s * 0.62) - 40, Y(-0.05) - 30, 80, 60); }
  for (const s of [-1, 1]) {
    const cx = X(s * ex), cy = ey, w = F.male ? 56 : 66, h = F.male ? 58 : 80;
    // brow
    g.strokeStyle = F.brow; g.lineWidth = F.male ? 6 : 4.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - s * w * 0.55, cy - h * 0.82 + (F.male ? 4 : 0)); g.quadraticCurveTo(cx + s * 0.05 * w, cy - h * 1.0, cx + s * w * 0.62, cy - h * 0.78); g.stroke();
    if (closed) {
      g.strokeStyle = F.lash; g.lineWidth = 6;
      g.beginPath(); g.moveTo(cx - w * 0.55, cy + 4); g.quadraticCurveTo(cx, cy + 16, cx + w * 0.55, cy + 4); g.stroke();
      continue;
    }
    // sclera
    g.save();
    g.beginPath(); g.moveTo(cx - w / 2, cy - h * 0.18); g.quadraticCurveTo(cx - w * 0.1, cy - h * 0.56, cx + w / 2, cy - h * 0.3);
    g.quadraticCurveTo(cx + w * 0.52, cy + h * 0.4, cx, cy + h * 0.5); g.quadraticCurveTo(cx - w * 0.5, cy + h * 0.4, cx - w / 2, cy - h * 0.18);
    g.closePath(); g.fillStyle = '#fbfbff'; g.fill(); g.clip();
    // iris
    const ix = cx + s * 2, iy = cy + h * 0.04, irx = w * 0.36, iry = h * 0.46;
    const gr = g.createLinearGradient(0, iy - iry, 0, iy + iry);
    gr.addColorStop(0, F.iris0); gr.addColorStop(0.55, F.iris1); gr.addColorStop(1, F.iris2);
    g.fillStyle = gr; g.beginPath(); g.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = F.iris0; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = F.pupil; g.beginPath(); g.ellipse(ix, iy - 2, irx * 0.42, iry * 0.45, 0, 0, Math.PI * 2); g.fill();
    // inner glow ring
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 3; g.beginPath(); g.ellipse(ix, iy + iry * 0.3, irx * 0.6, iry * 0.4, 0, 0.2, Math.PI - 0.2); g.stroke();
    // lid shadow
    const sh = g.createLinearGradient(0, cy - h * 0.5, 0, cy - h * 0.05); sh.addColorStop(0, 'rgba(60,40,60,0.45)'); sh.addColorStop(1, 'rgba(60,40,60,0)');
    g.fillStyle = sh; g.fillRect(cx - w, cy - h, w * 2, h);
    // highlights
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(ix - s * irx * 0.35, iy - iry * 0.42, 7.5, 9, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(ix + s * irx * 0.4, iy + iry * 0.4, 3.5, 0, Math.PI * 2); g.fill();
    g.restore();
    // upper lash line with outer flick
    g.strokeStyle = F.lash; g.lineWidth = F.male ? 6 : 7.5; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(cx - s * w * 0.52, cy - h * 0.12); g.quadraticCurveTo(cx - s * w * 0.1, cy - h * 0.6, cx + s * w * 0.52, cy - h * 0.3);
    if (!F.male) g.lineTo(cx + s * w * 0.66, cy - h * 0.38);
    g.stroke();
    // lower lash hint
    g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx + s * w * 0.42, cy + h * 0.32); g.quadraticCurveTo(cx + s * w * 0.15, cy + h * 0.5, cx - s * w * 0.05, cy + h * 0.48); g.stroke();
  }
  // nose + mouth
  g.strokeStyle = 'rgba(190,110,100,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(0.02), Y(-0.045)); g.lineTo(X(-0.01), Y(-0.052)); g.stroke();
  g.strokeStyle = '#9a4a50'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(X(-0.14), Y(-0.083)); g.quadraticCurveTo(X(0), Y(F.smile ? -0.093 : -0.088), X(0.14), Y(-0.083)); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------- character definitions (looks) ----------
export const LOOKS = {
  lan: {
    build: 'f', skin: '#ffe6d8', skinShade: '#f0b3a8',
    hair: '#2b3f7a', hairShade: '#1a2350', hairStyle: 'pony', hairAcc: '#ffcf6a',
    face: { iris0: '#16306e', iris1: '#2f6fd6', iris2: '#9fe0ff', pupil: '#0d1838', lash: '#1d1a2c', brow: '#22305c' },
    pal: { top: ['#f8fbff', '#b9c6e6'], coat: ['#3d7fe0', '#24488f'], trim: ['#f3cd6e', '#b98a32'], dark: ['#26324f', '#141a2c'], scarf: ['#ff9348', '#c95a2e'], leg: ['#2a2f45', '#151826'], boot: ['#f5f7fb', '#a9b6cf'], accent: ['#7fe0ff', '#3f8fd0'] },
    outfit: 'lan', weapon: { kind: 'sword', blade: '#e2f6ff', glow: '#7fd4ff', metal: '#f3cd6e', grip: '#26324f', gem: '#4fc3ff' },
  },
  yao: {
    build: 'f', skin: '#ffe9dc', skinShade: '#f2b8aa',
    hair: '#efeafc', hairShade: '#b6aed6', hairStyle: 'short', hairAcc: '#ffcf5a',
    face: { iris0: '#6b3608', iris1: '#d4891e', iris2: '#ffe08a', pupil: '#2b1404', lash: '#2a1e1a', brow: '#9a8fb5' },
    pal: { top: ['#fff6e6', '#dcc8a8'], coat: ['#2f857c', '#1b4d4a'], trim: ['#f2c14e', '#b48526'], dark: ['#5b3b26', '#341f13'], scarf: ['#f2c14e', '#b48526'], leg: ['#f7efe4', '#cfbfa8'], boot: ['#7a4e2e', '#47291a'], accent: ['#ffe08a', '#d49a2a'] },
    outfit: 'yao', weapon: { kind: 'bow', blade: '#fff3d0', glow: '#ffcf5a', metal: '#f2c14e', grip: '#7a5232', gem: '#ffe08a' },
  },
  po: {
    build: 'f', skin: '#ffe7d6', skinShade: '#f0b49e',
    hair: '#e9a94a', hairShade: '#a8641f', hairStyle: 'bob', hairAcc: '#ffd27a',
    face: { iris0: '#7a3a06', iris1: '#e08a1e', iris2: '#ffe6a0', pupil: '#3a1a04', lash: '#3a2214', brow: '#9a5a20' },
    pal: { top: ['#fffaf0', '#e0cfb0'], coat: ['#f6efe4', '#c9b79c'], trim: ['#ffb84a', '#c07818'], dark: ['#3a2a22', '#1f1612'], scarf: ['#ffb84a', '#c07818'], leg: ['#fff4e6', '#d8c4a6'], boot: ['#4a3426', '#2a1c14'], accent: ['#ffc861', '#e08a1e'] },
    outfit: 'po', weapon: { kind: 'sword', blade: '#ffd99a', glow: '#ffb347', metal: '#fff1cf', grip: '#3a2a22', gem: '#ffb347' },
  },
  ting: {
    build: 'm', skin: '#fde3d2', skinShade: '#e8ad98',
    hair: '#d6e8ec', hairShade: '#8aa6b4', hairStyle: 'male', hairAcc: '#9fe8e0',
    face: { iris0: '#0f4a4a', iris1: '#2aa6a0', iris2: '#bff7ee', pupil: '#062222', lash: '#1e2a2e', brow: '#6f8a96', male: true },
    pal: { top: ['#f6fbfb', '#b8cccc'], coat: ['#24324f', '#121a2c'], trim: ['#cfe8ee', '#7f9fb0'], dark: ['#2a2d38', '#15161d'], scarf: ['#3fb8ae', '#1f7a74'], leg: ['#2a2d38', '#15161d'], boot: ['#3a3f4f', '#1d2029'], accent: ['#9fe8e0', '#3fb8ae'] },
    outfit: 'ting', weapon: { kind: 'bow', blade: '#e8fbff', glow: '#9fe8e0', metal: '#cfe8ee', grip: '#24324f', gem: '#bff7ee' },
  },
  ai: {
    build: 'f', skin: '#fdeae0', skinShade: '#e9b4ad',
    hair: '#c9b8ff', hairShade: '#7c68c6', hairStyle: 'long', hairAcc: '#e8e0ff',
    face: { iris0: '#3b2276', iris1: '#7d5ad8', iris2: '#e2d6ff', pupil: '#1c0f3a', lash: '#2a2036', brow: '#8a78c4' },
    pal: { top: ['#fbf8ff', '#cfc6e6'], coat: ['#8f7fd8', '#54489a'], trim: ['#e9e2ff', '#a99ad8'], dark: ['#3a3256', '#1f1a33'], scarf: ['#d9ceff', '#9a8ad8'], leg: ['#f5f1ff', '#c9c0e6'], boot: ['#4a4066', '#272138'], accent: ['#bfa8ff', '#7d5ad8'] },
    outfit: 'ai', weapon: { kind: 'sword', blade: '#efe8ff', glow: '#b9a6ff', metal: '#e9e2ff', grip: '#3a3256', gem: '#b9a6ff' },
  },
  // 绫：墨蓝短发的弓手，深色外衣配水蓝丝带
  silk: {
    build: 'f', skin: '#ffe8da', skinShade: '#f1b6a8',
    hair: '#2c3463', hairShade: '#161a3c', hairStyle: 'bob', hairAcc: '#7fe0ff',
    face: { iris0: '#0e3a5c', iris1: '#2f9fd6', iris2: '#b8f0ff', pupil: '#06182a', lash: '#16182a', brow: '#2a3260' },
    pal: { top: ['#f4fbff', '#c4d8e8'], coat: ['#2b3a5e', '#141c32'], trim: ['#6fd6ff', '#2f8fb8'], dark: ['#1c2236', '#0d111c'], scarf: ['#6fd6ff', '#2f8fb8'], leg: ['#f4fbff', '#c4d8e8'], boot: ['#2b3a5e', '#141c32'], accent: ['#8fe8ff', '#3fb0d8'] },
    outfit: 'silk', weapon: { kind: 'bow', blade: '#e6f8ff', glow: '#5fd0ff', metal: '#6fd6ff', grip: '#1c2236', gem: '#8fe8ff' },
  },
  // 翎：青碧长发的御风者，白绿长袍
  feather: {
    build: 'f', skin: '#ffe9dd', skinShade: '#f0b9ac',
    hair: '#7fe6c8', hairShade: '#3a9c85', hairStyle: 'long', hairAcc: '#f6ffd0',
    face: { iris0: '#0f4a40', iris1: '#2fb890', iris2: '#c8ffec', pupil: '#062a22', lash: '#1c2a26', brow: '#4a9c88' },
    pal: { top: ['#f6fff9', '#c8e4d6'], coat: ['#4fc7a8', '#2a7f6a'], trim: ['#f0d27a', '#b08a2c'], dark: ['#2d4a44', '#16282a'], scarf: ['#bdf5e0', '#5fc8a6'], leg: ['#f6fff9', '#c8e4d6'], boot: ['#34584f', '#1b302b'], accent: ['#9ff5df', '#3fb89a'] },
    outfit: 'feather', weapon: { kind: 'sword', blade: '#e8fff6', glow: '#7fe6c8', metal: '#f0d27a', grip: '#2d4a44', gem: '#7fe6c8' },
  },
  // 岚：深青短发的少年剑客
  gale: {
    build: 'm', skin: '#fde3d2', skinShade: '#e8ad98',
    hair: '#2f6f74', hairShade: '#173a40', hairStyle: 'male', hairAcc: '#8fe9d4',
    face: { iris0: '#0f4a4a', iris1: '#2ab08e', iris2: '#c0ffe9', pupil: '#062222', lash: '#1e2a2e', brow: '#2a5a5e', male: true },
    pal: { top: ['#f6fbfb', '#b8cccc'], coat: ['#3f9c8a', '#215a50'], trim: ['#f3dd9a', '#b8963c'], dark: ['#2a3338', '#14191c'], scarf: ['#e8fff4', '#8cc9b4'], leg: ['#2a3338', '#14191c'], boot: ['#3a4a48', '#1d2827'], accent: ['#8fe9d4', '#3fb89a'] },
    outfit: 'gale', weapon: { kind: 'sword', blade: '#e2fff4', glow: '#8fe9d4', metal: '#f3dd9a', grip: '#2a3338', gem: '#8fe9d4' },
  },
};

// ---------- builder ----------
export function makeCharacter(look) {
  const L = typeof look === 'string' ? LOOKS[look] : look;
  const male = L.build === 'm';
  const root = new THREE.Group();
  const pose = new THREE.Group(); pose.position.y = 0.9; root.add(pose);
  const mats = {};
  const M = (name, opts) => {
    if (!mats[name]) {
      const [c, s] = L.pal[name] || [name, name];
      mats[name] = toon(c, s, opts);
      mats[name].userData.outline = new THREE.Color(s).multiplyScalar(0.16).getHexString();
    }
    return mats[name];
  };
  mats.skin = toon(L.skin, L.skinShade, { rim: 0.25, rimColor: '#ffd9d0' }); mats.skin.userData.outline = '3a1a18';
  mats.hair = toon(L.hair, L.hairShade, { hair: true, rim: 0.3 }); mats.hair.userData.outline = new THREE.Color(L.hairShade).multiplyScalar(0.18).getHexString();
  mats.hairD = toon(L.hair, L.hairShade, { hair: true, rim: 0.3, side: THREE.DoubleSide }); mats.hairD.userData.outline = mats.hair.userData.outline;
  const D = (name) => { const k = name + 'D'; if (!mats[k]) { const [c, s] = L.pal[name]; mats[k] = toon(c, s, { side: THREE.DoubleSide }); mats[k].userData.outline = new THREE.Color(s).multiplyScalar(0.16).getHexString(); } return mats[k]; };
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = null, { outline = 0.8, cast = true } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r); if (s) m.scale.set(...s);
    m.castShadow = cast; parent.add(m);
    m.userData.ow = outline && mat.userData.outline ? outline : 0;
    return m;
  };
  const sway = [];

  // ---- pelvis / torso ----
  const SH = male ? 0.2 : 0.172;
  add(pose, loft(male
    ? [[-0.15, 0.02, 0.02], [-0.12, 0.08, 0.07], [-0.08, 0.12, 0.085], [-0.03, 0.13, 0.09], [0.03, 0.12, 0.085], [0.09, 0.11, 0.08]]
    : [[-0.15, 0.02, 0.02], [-0.12, 0.075, 0.065], [-0.08, 0.12, 0.085], [-0.03, 0.134, 0.092], [0.03, 0.122, 0.085], [0.09, 0.1, 0.075]], 22), M('dark'));
  const torso = new THREE.Group(); torso.position.y = 0.05; pose.add(torso);
  const torsoRings = male
    ? [[-0.04, 0.11, 0.082], [0.05, 0.112, 0.08], [0.14, 0.125, 0.088, 0.004], [0.22, 0.14, 0.095, 0.01], [0.3, 0.15, 0.092, 0.006], [0.36, 0.165, 0.08, -0.004], [0.4, 0.12, 0.066, -0.006], [0.43, 0.055, 0.048, -0.004], [0.445, 0.01, 0.01]]
    : [[-0.04, 0.105, 0.08], [0.04, 0.097, 0.074], [0.12, 0.103, 0.078, 0.004], [0.19, 0.117, 0.088, 0.014], [0.25, 0.123, 0.095, 0.02], [0.31, 0.123, 0.084, 0.008], [0.36, 0.138, 0.074, -0.004], [0.4, 0.104, 0.062, -0.008], [0.43, 0.05, 0.045, -0.005], [0.445, 0.01, 0.01]];
  add(torso, loft(torsoRings, 24), M('top'));
  add(torso, loft([[0.41, male ? 0.052 : 0.046, 0.041, -0.006], [0.445, male ? 0.044 : 0.039, 0.036, -0.004], [0.49, male ? 0.039 : 0.035, 0.034, -0.002], [0.535, male ? 0.043 : 0.039, 0.037, 0]], 16), mats.skin);

  // ---- head ----
  const head = new THREE.Group(); head.position.y = 0.6; head.scale.setScalar(male ? 1.04 : 1.08); torso.add(head);
  const faceMap = faceTexture({ ...L.face, skin: L.skin, male }), faceClosed = faceTexture({ ...L.face, skin: L.skin, male }, true);
  const faceMat = toon('#ffffff', '#' + new THREE.Color(L.skinShade).lerp(new THREE.Color('#ffffff'), 0.45).getHexString(), { map: faceMap, rim: 0.2, rimColor: '#ffd9d0' }); faceMat.userData.outline = '3a1a18';
  const headRings = (male
    ? [[-0.138, 0.015, 0.015, 0.03], [-0.125, 0.032, 0.03, 0.028], [-0.1, 0.066, 0.066, 0.01], [-0.07, 0.086, 0.086, 0], [-0.035, 0.098, 0.094, -0.004], [0, 0.103, 0.1, -0.008], [0.04, 0.106, 0.106, -0.012], [0.08, 0.102, 0.104, -0.016], [0.11, 0.087, 0.09, -0.02], [0.135, 0.056, 0.06, -0.022], [0.15, 0.02, 0.025, -0.022], [0.155, 0.002, 0.002, -0.022]]
    : [[-0.135, 0.01, 0.01, 0.034], [-0.125, 0.024, 0.024, 0.03], [-0.1, 0.056, 0.06, 0.012], [-0.07, 0.079, 0.08, 0], [-0.035, 0.094, 0.092, -0.004], [0, 0.1, 0.1, -0.008], [0.04, 0.104, 0.106, -0.012], [0.08, 0.1, 0.104, -0.016], [0.11, 0.085, 0.09, -0.02], [0.135, 0.055, 0.06, -0.022], [0.15, 0.02, 0.025, -0.022], [0.155, 0.002, 0.002, -0.022]]);
  const headMesh = add(head, faceGeometry(headRings), faceMat); headMesh.userData.keep = true;
  // A small nose tip catches light in profile without interrupting the painted face.
  add(head, ellip(0.008, 0.009, 0.01, 10, 8), mats.skin, [0, -0.047, 0.091], [0, 0, 0], null, { outline: 0 });
  for (const s of [-1, 1]) {
    add(head, ellip(0.018, 0.029, 0.015, 14, 10), mats.skin, [s * 0.098, -0.014, -0.009], [0, s * 0.3, 0], null, { outline: 0.6 });
    add(head, ellip(0.008, 0.016, 0.006, 10, 8), toonAcc(L.skinShade, 0), [s * 0.106, -0.014, 0.003], [0, s * 0.3, 0], null, { outline: 0 });
  }
  buildHair(L, head, add, mats, sway);

  // ---- arms ----
  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * SH, 0.385, -0.005); torso.add(sh);
    add(sh, ellip(male ? 0.046 : 0.04, 0.04, 0.04), M('top'), [0, -0.016, 0]);
    add(sh, limb(0.27, [[0, male ? 0.05 : 0.044], [0.4, male ? 0.046 : 0.04], [1, male ? 0.04 : 0.034]]), M('top'), [0, 0, 0]);
    const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
    add(el, ellip(male ? 0.04 : 0.035, 0.035, 0.035), M('top'));
    add(el, limb(0.24, [[0, male ? 0.04 : 0.034], [0.35, male ? 0.041 : 0.035], [1, male ? 0.03 : 0.025]]), mats.skin, [0, 0, 0]);
    // Palm, four tapered fingers and an opposed thumb read as a hand in portraits and close views.
    const hand = new THREE.Group(); hand.position.y = -0.255; el.add(hand);
    add(hand, ellip(male ? 0.031 : 0.027, 0.034, 0.015, 14, 10), mats.skin, [0, -0.019, 0], [0, 0, 0], null, { outline: 0.5 });
    const fingerScale = male ? 1.07 : 1;
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.013 * fingerScale, len = [0.039, 0.049, 0.046, 0.034][i] * fingerScale;
      add(hand, strand([[x, -0.039, 0.001], [x + side * 0.001, -0.047 - len * 0.4, 0.005], [x + side * 0.002, -0.039 - len, 0.012]], 0.006 * fingerScale, 0.006, { hint: new THREE.Vector3(0, 0, 1), n: 4, rs: 6, wEnd: 0.45 }), mats.skin, [0, 0, 0], [0, 0, 0], null, { outline: 0.5 });
    }
    add(hand, strand([[side * -0.023, -0.005, 0.005], [side * -0.037, -0.019, 0.012], [side * -0.033, -0.044, 0.02]], 0.009, 0.008, { hint: new THREE.Vector3(0, 0, 1), n: 5, rs: 6, wEnd: 0.4 }), mats.skin, [0, 0, 0], [0, 0, 0], null, { outline: 0.5 });
    const hip = new THREE.Group(); hip.position.set(side * (male ? 0.09 : 0.085), -0.04, 0); pose.add(hip);
    const kn = new THREE.Group(); kn.position.y = -0.42; hip.add(kn);
    return { sh, el, hand, hip, kn, side };
  };
  const LA = arm(1), RA = arm(-1);
  // legs: thigh (skin top + legwear), shin, feet
  for (const A of [LA, RA]) {
    const thigh = limb(0.43, male ? [[0, 0.078], [0.3, 0.068], [0.75, 0.054], [1, 0.047]] : [[0, 0.076], [0.25, 0.07], [0.7, 0.052], [1, 0.044]]);
    add(A.hip, thigh, M('leg'), [0, 0.01, 0]);
    add(A.kn, ellip(male ? 0.05 : 0.046, 0.05, 0.048), M('leg'));
    add(A.kn, limb(0.42, male ? [[0, 0.05], [0.25, 0.054], [0.75, 0.036], [1, 0.03]] : [[0, 0.045], [0.22, 0.05], [0.75, 0.032], [1, 0.026]]), M('leg'));
  }

  // ---- outfit ----
  const R = { root, pose, torso, head, L: LA, R: RA, M, D, add, mats, male, sway, look: L };
  const tail = new THREE.Group(), tail2 = new THREE.Group(), pony = head.userData.pony || new THREE.Group();
  if (!pony.parent) head.add(pony);
  R.tail = tail; R.tail2 = tail2; torso.add(tail); torso.add(tail2);
  OUTFITS[L.outfit](R);

  // ---- weapon ----
  const { sword, bladeMat } = buildWeapon(L.weapon, LA, RA, add, M);

  // ---- glider ----
  const glider = new THREE.Group(); glider.position.y = 2.05; root.add(glider);
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.05); wingShape.quadraticCurveTo(0.8, 0.25, 1.45, -0.05); wingShape.quadraticCurveTo(0.9, -0.12, 0.6, -0.42);
  wingShape.quadraticCurveTo(0.35, -0.2, 0, -0.32); wingShape.lineTo(0, 0.05);
  const wg = new THREE.ShapeGeometry(wingShape, 16); wg.rotateX(-Math.PI / 2);
  const wm = toon('#ffffff', '#c9d6e6', { side: THREE.DoubleSide }), wm2 = toon(L.pal.accent[0], L.pal.accent[1], { side: THREE.DoubleSide });
  for (const s of [1, -1]) { const w = new THREE.Mesh(wg, s > 0 ? wm : wm2); w.scale.set(s, 1, 1); w.rotation.z = s * 0.12; w.castShadow = true; glider.add(w); }
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), toon('#bbbbbb', '#777777')); strut.position.y = -0.3; glider.add(strut);
  glider.visible = false;
  if (male) root.scale.setScalar(1.06);

  // ---- secondary motion: skirt panels follow the legs, cloth & hair sway, blinking ----
  let blinkT = 2 + Math.random() * 3;
  const update = (dt, t, flow, hipL, hipR) => {
    for (const s of sway) {
      if (s.type === 'skirt') {
        // panel facing angle a: lift by the leg on that side swinging toward it
        const fwdL = Math.max(0, -hipL), fwdR = Math.max(0, -hipR), backL = Math.max(0, hipL), backR = Math.max(0, hipR);
        const ca = Math.cos(s.a), sa = Math.sin(s.a);
        const front = Math.max(0, ca), back = Math.max(0, -ca), left = Math.max(0, sa), right = Math.max(0, -sa);
        const lift = front * (fwdL * (0.5 + left) + fwdR * (0.5 + right)) * 0.55 + back * (backL * (0.5 + left) + backR * (0.5 + right)) * 0.55;
        s.g.rotation.x = -(s.base + lift + flow * 0.12 * back + Math.sin(t * 7 + s.a * 3) * 0.02 * (0.3 + flow));
      } else if (s.type === 'wave') {
        s.g.rotation.x = s.base + flow * s.k + Math.sin(t * s.f + s.ph) * s.amp * (0.4 + flow);
        if (s.z) s.g.rotation.z = Math.sin(t * s.f * 0.7 + s.ph) * s.amp * 0.6;
      }
    }
    blinkT -= dt;
    if (blinkT <= 0) { faceMat.map = faceClosed; if (blinkT < -0.12) { faceMat.map = faceMap; blinkT = 2 + Math.random() * 4; } }
    else if (faceMat.map !== faceMap) faceMat.map = faceMap;
  };

  bake(root);
  return applyModelTrial({ root, pose, torso, head, tail, tail2, pony, L: LA, R: RA, glider, sword, bladeMat, update, headMesh }, typeof look === 'string' ? look : null);
}

// ---------- hair ----------
// Strands are laid on an ellipsoid "skull cap" so they hug the head, then hang freely past its rim.
const CAP = { c: [0, 0.012, -0.012], r: [0.114, 0.146, 0.122] };
const capPt = (phi, e, off = 1.0) => [CAP.c[0] + CAP.r[0] * off * Math.cos(e) * Math.sin(phi), CAP.c[1] + CAP.r[1] * off * Math.sin(e), CAP.c[2] + CAP.r[2] * off * Math.cos(e) * Math.cos(phi)];
const outward = (p) => new THREE.Vector3(p[0] - CAP.c[0], (p[1] - CAP.c[1]) * 0.4, p[2] - CAP.c[2]).normalize();
function buildHair(L, head, add, mats, sway) {
  const H = mats.hair, HD = mats.hairD;
  const style = L.hairStyle;
  add(head, ellip(CAP.r[0], CAP.r[1], CAP.r[2], 28, 18, { t0: 0, tl: Math.PI * 0.4 }), H, CAP.c);
  add(head, ellip(0.113, 0.15, 0.12, 24, 18, { p0: Math.PI, pl: Math.PI, t0: Math.PI * 0.12, tl: Math.PI * 0.7 }), HD, [0, 0.0, -0.016]);
  const S = (pts, w, th = 0.013, o = {}) => add(head, strand(pts, w, th, { hint: o.hint || outward(pts[Math.floor(pts.length / 2)]), ...o }), H);
  // bangs over the forehead, ending above the eyes
  const bangs = L.outfit === 'silk'
    ? [[-0.68, -0.008, 0.85], [-0.43, 0.024, 1.0], [-0.2, 0.064, 0.9], [0.07, 0.080, 0.9], [0.34, 0.048, 1.0], [0.63, 0.012, 1.0]]
    : L.outfit === 'gale'
      ? [[-0.66, -0.005, 1.0], [-0.40, 0.018, 1.1], [-0.13, 0.047, 1.1], [0.16, 0.078, 1.0], [0.42, 0.065, 1.0], [0.66, 0.027, 0.9]]
    : style === 'bob'
      ? [-0.62, -0.38, -0.13, 0.13, 0.38, 0.62].map((f) => [f, 0.035, 1])
    : style === 'male'
      ? [[-0.68, 0.0], [-0.42, 0.03], [-0.16, 0.0], [0.1, 0.035], [0.36, 0.01], [0.62, 0.03]].map(([f, y]) => [f, y, 1.05])
      : [[-0.7, -0.03], [-0.44, 0.03], [-0.17, 0.045], [0.1, 0.03], [0.36, 0.045], [0.64, -0.02]].map(([f, y]) => [f, y, 1]);
  for (const [f, yEnd, w] of bangs) {
    const eEnd = Math.asin(Math.max(-0.9, Math.min(0.9, (yEnd - CAP.c[1]) / CAP.r[1])));
    S([capPt(f * 0.25, 1.3, 1.0), capPt(f * 0.65, 0.95, 1.03), capPt(f * 0.95, 0.55, 1.05), capPt(f * 1.05, 0.2, 1.08), capPt(f * 1.1, eEnd, 1.12)], 0.034 * w, 0.012);
  }
  // side locks in front of the ears
  const sideLen = style === 'long' ? -0.36 : style === 'pony' ? -0.24 : style === 'bob' ? -0.13 : style === 'male' ? -0.07 : -0.11;
  for (const sd of [-1, 1]) {
    const p3 = capPt(sd * 1.3, 0.0, 1.1);
    S([capPt(sd * 0.95, 0.95, 1.02), capPt(sd * 1.2, 0.45, 1.06), p3, [p3[0] * 1.02, (p3[1] + sideLen) / 2, p3[2] + 0.004], [p3[0] * 0.98, sideLen, p3[2] - 0.004]], style === 'male' ? 0.022 : 0.026, 0.012);
  }
  // hair around the sides and back
  const ring = (n, from, to, yLow, w, flare = 1.12) => {
    for (let i = 0; i < n; i++) {
      const phi = from + (to - from) * (i / (n - 1));
      const p2 = capPt(phi, 0.0, 1.08), lowY = yLow + Math.sin(i * 2.3) * 0.018;
      S([capPt(phi, 1.15, 1.0), capPt(phi, 0.6, 1.04), p2, [p2[0] * flare, lowY, p2[2] * flare + (p2[2] < 0 ? -0.004 : 0)]], w, 0.014, { wEnd: 0.25 });
    }
  };
  if (style === 'pony') {
    ring(9, Math.PI * 0.62, Math.PI * 1.38, -0.12, 0.03, 1.05);
    const pony = new THREE.Group(); pony.position.set(0, 0.105, -0.115); head.add(pony); head.userData.pony = pony;
    add(pony, new THREE.TorusGeometry(0.03, 0.012, 8, 16), toonAcc(L.hairAcc), [0, 0, 0], [0.4, 0, 0]);
    for (const s of [-1, 1]) add(pony, ellip(0.045, 0.022, 0.01), toonAcc(L.pal.accent[0]), [s * 0.04, 0.012, -0.012], [0, 0, s * 0.4]);
    for (let i = 0; i < 7; i++) {
      const dx = (i - 3) * 0.016, w = 0.042 - Math.abs(i - 3) * 0.004;
      add(pony, strand([[dx * 0.3, 0, 0], [dx * 0.8, 0.03, -0.06], [dx * 1.3, -0.1, -0.13], [dx * 1.6, -0.34, -0.14], [dx * 2.0, -0.58, -0.1 + Math.abs(dx) * 0.6]], w, 0.02, { hint: new THREE.Vector3(0, 0, -1) }), H);
    }
  } else if (style === 'short') {
    ring(11, Math.PI * 0.45, Math.PI * 1.55, -0.1, 0.034, 1.18);
    const bx = -0.11;
    for (let k = 0; k < 4; k++) add(head, ellip(0.014, 0.022, 0.014), H, [bx, -0.03 - k * 0.035, 0.035], [0, 0, (k % 2 ? 0.3 : -0.3)]);
    add(head, ellip(0.012, 0.012, 0.012), toonAcc(L.hairAcc), [bx, -0.17, 0.035]);
    S([capPt(0, 1.45, 1.0), [0.02, 0.2, -0.02], [0.045, 0.205, 0.0]], 0.018, 0.01, { hint: new THREE.Vector3(1, 0, 0) });
  } else if (style === 'bob') {
    ring(11, Math.PI * 0.42, Math.PI * 1.58, L.outfit === 'silk' ? -0.155 : -0.12, 0.037, L.outfit === 'silk' ? 1.17 : 1.1);
    const cm = toonAcc(L.hairAcc, 0.5);
    for (const [y, rz] of [[0.07, 0.4], [0.035, 0.7]]) add(head, new THREE.OctahedronGeometry(0.018, 0), cm, [0.112, y, 0.03], [0, 0, rz], [1, 1.8, 1]);
  } else if (style === 'long') {
    ring(9, Math.PI * 0.55, Math.PI * 1.45, -0.14, 0.032, 1.06);
    const back = new THREE.Group(); back.position.set(0, 0.06, -0.1); head.add(back); head.userData.pony = back;
    for (let i = 0; i < 11; i++) {
      const x = (i - 5) * 0.02;
      const tip = -0.80 + Math.abs(i - 5) * 0.025;
      add(back, strand([[x * 0.8, 0.02, 0], [x * 1.2, -0.08, -0.04], [x * 1.45, -0.28, -0.06], [x * 1.5, -0.56, -0.07], [x * 1.45, tip, -0.05]], 0.032, 0.014, { hint: new THREE.Vector3(0, 0, -1), wEnd: 0.15 }), H);
    }
    const rib = toonAcc(L.pal.accent[0]);
    add(back, new THREE.TorusGeometry(0.03, 0.01, 6, 16), rib, [0, -0.45, -0.075], [0.1, 0, 0]);
    for (const s of [-1, 1]) add(back, strand([[0, -0.45, -0.08], [s * 0.05, -0.5, -0.085], [s * 0.06, -0.62, -0.085]], 0.018, 0.004, { hint: new THREE.Vector3(0, 0, -1) }), rib);
    add(head, new THREE.TorusGeometry(0.03, 0.007, 6, 20, Math.PI * 1.3), toonAcc(L.hairAcc, 0.4), [-0.1, 0.085, 0.03], [0, 0.9, 0.6]);
  } else if (style === 'male') {
    ring(10, Math.PI * 0.5, Math.PI * 1.5, -0.05, 0.034, 1.12);
    S([capPt(0.2, 1.4, 1.0), [0.03, 0.19, 0.02], [0.06, 0.18, -0.01]], 0.018, 0.01, { hint: new THREE.Vector3(1, 0, 0) });
  }
}
const accCache = new Map();
function toonAcc(hex, ei = 0.15) {
  const k = hex + ei; if (accCache.has(k)) return accCache.get(k);
  const c = new THREE.Color(hex), s = '#' + c.clone().multiplyScalar(0.62).getHexString();
  const m = toon(hex, s, { emissive: hex, ei }); m.userData.outline = c.clone().multiplyScalar(0.12).getHexString();
  accCache.set(k, m); return m;
}

// ---------- outfits (one per character) ----------
function skirt(R, parent, { y = 0.04, len = 0.2, r0 = 0.13, r1 = 0.22, n = 10, mat, trim = null, from = -Math.PI, to = Math.PI, flare = 0.15, rz = 0.85 }) {
  const span = (to - from) / n;
  for (let i = 0; i < n; i++) {
    const a = from + span * (i + 0.5);
    const g = new THREE.Group(); g.position.set(Math.sin(a) * r0, y, Math.cos(a) * r0 * rz); g.rotation.y = a; parent.add(g);
    const inner = new THREE.Group(); g.add(inner);
    const w0 = r0 * span * 0.62, w1 = r1 * span * 0.62;
    R.add(inner, clothPanel(len, w0, w1), mat, [0, 0, 0], [0, 0, 0], null, { outline: 0.7 });
    if (trim) clothHem(R.add, inner, w1, len, 0, trim);
    R.sway.push({ type: 'skirt', g: inner, a, base: flare });
    inner.rotation.x = -flare;
  }
}
function coatTail(R, group, { len = 0.55, w0 = 0.07, w1 = 0.11, mat, trim, curl = 0.12 }) {
  const panel = new THREE.Group(); panel.rotation.y = Math.PI; group.add(panel);
  const m = R.add(panel, clothPanel(len, w0, w1, curl * 0.6, 0.01), mat, [0, 0, 0], [0, 0, 0], null, { outline: 0.7 });
  if (trim) clothHem(R.add, panel, w1, len, curl * 0.6, trim, 0.01);
  return m;
}
function belt(R, parent, y, rx, rz, mat, h = 0.035) {
  return R.add(parent, loft([[y - h / 2, rx, rz], [y + h / 2, rx, rz]], 28), mat);
}
function boot(R, A, { mat, trim, top = 0.18, rTop = 0.052, toe = true }) {
  // Shaped ankle, continuous vamp and a separate sole replace the oval "slipper" silhouette.
  R.add(A.kn, loft([[-0.418, 0.038, 0.044], [-0.36, 0.034, 0.039], [-0.25, 0.041, 0.044], [-top, rTop, rTop]].sort((a, b) => a[0] - b[0]), 18), mat);
  if (trim) R.add(A.kn, loft([[-top - 0.012, rTop + 0.006, rTop + 0.006], [-top + 0.012, rTop + 0.006, rTop + 0.006]], 16), trim);
  const foot = R.add(A.kn, loft([[-0.443, 0.044, 0.097, 0.038], [-0.433, 0.046, 0.10, 0.04], [-0.416, 0.043, 0.095, 0.037], [-0.398, 0.033, 0.067, 0.022], [-0.386, 0.024, 0.036, 0.006]], 20), mat);
  R.add(A.kn, loft([[-0.452, 0.043, 0.096, 0.039], [-0.45, 0.047, 0.102, 0.04], [-0.438, 0.047, 0.102, 0.04]], 20), R.M('dark'), [0, 0, 0], [0, 0, 0], null, { outline: 0 });
  if (trim) {
    const seam = new THREE.EllipseCurve(0, 0, 0.044, 0.096, Math.PI * 0.35, Math.PI * 1.65, false, 0).getPoints(12).map((p) => new THREE.Vector3(p.x, -0.429, p.y + 0.038));
    R.add(A.kn, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seam), 12, 0.003, 4, false), trim, [0, 0, 0], [0, 0, 0], null, { outline: 0 });
    // Twin clasps provide readable construction detail while staying merged into the boot material bucket.
    for (const y of [-top - 0.025, -top - 0.065]) R.add(A.kn, new THREE.BoxGeometry(0.023, 0.012, 0.012), trim, [A.side * (rTop - 0.003), y, 0.018], [0, 0, 0], null, { outline: 0 });
  }
  return foot;
}
function sleeve(R, A, { mat, cuffMat, puff = 0.06, len = 0.2 }) {
  R.add(A.sh, limb(len, [[-0.26, 0.012], [-0.2, puff * 0.62], [-0.1, puff * 0.92], [0, puff], [0.5, puff * 1.02], [1, puff * 0.82]]), mat);
  if (cuffMat) R.add(A.sh, loft([[-len - 0.012, puff * 0.86, puff * 0.86], [-len + 0.012, puff * 0.86, puff * 0.86]], 16), cuffMat);
}
function glove(R, A, { mat, cuff, len = 0.1 }) {
  R.add(A.el, limb(len, [[0, 0.037], [1, 0.03]]), mat, [0, -0.255 + len, 0]);
  if (cuff) R.add(A.el, loft([[-0.255 + len - 0.012, 0.042, 0.042], [-0.255 + len + 0.012, 0.042, 0.042]], 16), cuff);
}

const OUTFITS = {
  // 澜: white blouse, cropped blue jacket with gold trim, long two-panel coat tails, orange scarf, dark shorts, thigh-highs, white boots
  lan(R) {
    const { torso, pose, M, D, add } = R;
    add(torso, loft([[0.16, 0.128, 0.1, 0.016], [0.25, 0.134, 0.104, 0.022], [0.31, 0.134, 0.094, 0.01], [0.36, 0.15, 0.084, -0.004], [0.4, 0.118, 0.07, -0.008]], 26, { th0: 0.42, th1: Math.PI * 2 - 0.42 }), D('coat'));
    for (const s of [-1, 1]) add(torso, new THREE.BoxGeometry(0.012, 0.22, 0.012), M('trim'), [s * 0.05, 0.275, 0.115], [0.0, 0, s * 0.08], null, { outline: 0 });
    belt(R, torso, 0.03, 0.104, 0.08, M('dark'), 0.05);
    add(torso, new THREE.TorusGeometry(0.02, 0.008, 6, 14), M('trim'), [0, 0.03, 0.082]);
    // collar + scarf
    add(torso, loft([[0.42, 0.06, 0.052], [0.48, 0.05, 0.046]], 20), M('top'));
    add(torso, new THREE.TorusGeometry(0.058, 0.026, 10, 22), M('scarf'), [0, 0.43, 0.005], [Math.PI / 2, 0, 0]);
    const sc = new THREE.Group(); sc.position.set(0.04, 0.42, 0.05); torso.add(sc);
    add(sc, strand([[0, 0, 0], [0.02, -0.06, 0.03], [0.03, -0.18, 0.04], [0.05, -0.26, 0.02]], 0.03, 0.006, { hint: new THREE.Vector3(0, 0, 1), wEnd: 0.6 }), D('scarf'));
    R.sway.push({ type: 'wave', g: sc, base: 0, k: -0.7, f: 9, ph: 0, amp: 0.1, z: true });
    // shoulder pads + sleeves (jacket) + gloves
    for (const A of [R.L, R.R]) {
      sleeve(R, A, { mat: M('coat'), cuffMat: M('trim'), puff: 0.05, len: 0.2 });
      add(A.sh, ellip(0.052, 0.022, 0.05), M('trim'), [A.side * 0.006, 0.022, 0], [0, 0, -A.side * 0.25]);
      glove(R, A, { mat: M('dark'), cuff: M('trim'), len: 0.1 });
    }
    // shorts + coat tails
    add(pose, loft([[-0.15, 0.08, 0.07], [-0.08, 0.128, 0.09], [0.0, 0.132, 0.094], [0.06, 0.112, 0.084]], 22), M('dark'));
    R.tail.position.set(0.055, 0.0, -0.07); R.tail2.position.set(-0.055, 0.0, -0.07);
    coatTail(R, R.tail, { len: 0.62, w0: 0.06, w1: 0.1, mat: D('coat'), trim: M('trim') });
    coatTail(R, R.tail2, { len: 0.58, w0: 0.06, w1: 0.1, mat: D('coat'), trim: M('trim') });
    skirt(R, pose, { y: 0.04, len: 0.14, r0: 0.132, r1: 0.17, n: 5, mat: D('coat'), trim: M('trim'), from: Math.PI * 0.55, to: Math.PI * 1.45, flare: 0.12 });
    // legwear: skin band at the top of the thighs, then boots
    for (const A of [R.L, R.R]) {
      add(A.hip, limb(0.1, [[0, 0.077], [1, 0.07]]), R.mats.skin, [0, -0.08, 0]);
      add(A.hip, loft([[-0.19, 0.073, 0.073], [-0.17, 0.073, 0.073]], 16), M('accent'), [0, 0, 0], [0, 0, 0], null, { outline: 0 });
      boot(R, A, { mat: M('boot'), trim: M('trim'), top: 0.12, rTop: 0.054 });
    }
    add(R.head, new THREE.OctahedronGeometry(0.014, 0), toonAcc('#7fe0ff', 0.6), [0.1, -0.04, 0.0], [0, 0, 0], [1, 1.6, 1]);
  },
  // 曜: teal hooded short cape over a cream top, corset belt, short pleated skirt, white stockings, brown thigh boots, quiver
  yao(R) {
    const { torso, pose, M, D, add } = R;
    add(torso, loft([[0.06, 0.112, 0.088], [0.14, 0.114, 0.088, 0.006], [0.2, 0.124, 0.094, 0.014]], 22), M('dark'));
    for (let i = 0; i < 3; i++) add(torso, new THREE.TorusGeometry(0.008, 0.003, 4, 8), M('trim'), [0, 0.09 + i * 0.04, 0.095], [0, 0, 0], null, { outline: 0 });
    // capelet + hood
    add(torso, loft([[0.2, 0.2, 0.15, -0.01], [0.28, 0.18, 0.13, -0.006], [0.35, 0.165, 0.105, -0.004], [0.41, 0.11, 0.08, -0.006], [0.44, 0.07, 0.06, -0.004]], 28), D('coat'));
    add(torso, loft([[0.2, 0.202, 0.152, -0.01], [0.22, 0.202, 0.152, -0.01]], 28), M('trim'), [0, 0, 0], [0, 0, 0], null, { outline: 0 });
    add(torso, ellip(0.13, 0.1, 0.1, 18, 12, { p0: Math.PI, pl: Math.PI, t0: Math.PI * 0.3, tl: Math.PI * 0.55 }), D('coat'), [0, 0.47, -0.07], [0.3, 0, 0]);
    add(torso, new THREE.OctahedronGeometry(0.02, 0), toonAcc('#ffe08a', 0.5), [0, 0.41, 0.07]);
    for (const A of [R.L, R.R]) {
      sleeve(R, A, { mat: M('top'), cuffMat: M('trim'), puff: 0.046, len: 0.14 });
      glove(R, A, { mat: M('dark'), cuff: M('trim'), len: 0.12 });
    }
    // skirt (pleated)
    add(pose, loft([[-0.12, 0.09, 0.07], [-0.05, 0.13, 0.09], [0.06, 0.112, 0.084]], 22), M('dark'));
    skirt(R, pose, { y: 0.06, len: 0.2, r0: 0.118, r1: 0.2, n: 12, mat: D('coat'), trim: M('trim'), flare: 0.2 });
    for (const A of [R.L, R.R]) boot(R, A, { mat: M('boot'), trim: M('trim'), top: -0.05, rTop: 0.06 });
    R.tail.position.set(0, 0.42, -0.1);
    // short cape tail at the back
    coatTail(R, R.tail, { len: 0.32, w0: 0.1, w1: 0.14, mat: D('coat'), trim: M('trim'), curl: 0.05 });
    // quiver
    const q = new THREE.Group(); q.position.set(-0.09, 0.2, -0.13); q.rotation.set(0.25, 0, 0.35); torso.add(q);
    add(q, new THREE.CylinderGeometry(0.045, 0.038, 0.38, 12), M('dark'));
    add(q, loft([[0.17, 0.05, 0.05], [0.2, 0.05, 0.05]], 12), M('trim'));
    for (const dx of [-0.018, 0.016, 0.0]) add(q, new THREE.ConeGeometry(0.016, 0.07, 6), toonAcc('#fff1c2', 0.4), [dx, 0.24, dx * 0.5]);
  },
  // 珀: white-and-amber court dress, crystal shoulder pieces, long split back skirt, amber gauntlets
  po(R) {
    const { torso, pose, M, D, add } = R;
    add(torso, loft([[0.0, 0.106, 0.082], [0.1, 0.104, 0.08, 0.004], [0.18, 0.12, 0.09, 0.014], [0.25, 0.126, 0.097, 0.02], [0.3, 0.124, 0.086, 0.008]], 24), M('coat'));
    add(torso, loft([[0.06, 0.107, 0.082], [0.1, 0.108, 0.083]], 24), M('trim'));
    add(torso, new THREE.OctahedronGeometry(0.026, 0), toonAcc('#ffb347', 0.6), [0, 0.2, 0.11], [0, 0, 0], [1, 1.5, 0.6]);
    // crystal pauldrons
    const cm = toonAcc('#ffc861', 0.45);
    for (const A of [R.L, R.R]) {
      for (let k = 0; k < 3; k++) add(A.sh, new THREE.OctahedronGeometry(0.03 - k * 0.006, 0), cm, [A.side * (0.02 + k * 0.012), 0.03 - k * 0.025, (k - 1) * 0.02], [0, 0, A.side * (0.4 + k * 0.2)], [1, 1.7, 1]);
      sleeve(R, A, { mat: M('top'), cuffMat: M('trim'), puff: 0.044, len: 0.16 });
      glove(R, A, { mat: M('trim'), cuff: M('coat'), len: 0.13 });
    }
    add(torso, loft([[0.42, 0.055, 0.05], [0.47, 0.05, 0.045]], 20), M('trim'));
    // dress skirt: short front, long split back
    add(pose, loft([[-0.12, 0.09, 0.07], [-0.05, 0.13, 0.09], [0.06, 0.112, 0.084]], 22), M('coat'));
    skirt(R, pose, { y: 0.06, len: 0.21, r0: 0.12, r1: 0.2, n: 12, mat: D('coat'), trim: M('trim'), flare: 0.16 });
    R.tail.position.set(0.05, 0.0, -0.075); R.tail2.position.set(-0.05, 0.0, -0.075);
    coatTail(R, R.tail, { len: 0.72, w0: 0.07, w1: 0.13, mat: D('trim'), trim: M('coat'), curl: 0.16 });
    coatTail(R, R.tail2, { len: 0.72, w0: 0.07, w1: 0.13, mat: D('trim'), trim: M('coat'), curl: 0.16 });
    for (const A of [R.L, R.R]) {
      add(A.hip, limb(0.08, [[0, 0.077], [1, 0.072]]), R.mats.skin, [0, -0.1, 0]);
      boot(R, A, { mat: M('boot'), trim: M('trim'), top: 0.1, rTop: 0.056 });
    }
  },
  // 汀: long navy coat (open), white shirt, teal sash, dark trousers, a round mirror disc on the back
  ting(R) {
    const { torso, pose, M, D, add } = R;
    add(torso, loft([[-0.02, 0.118, 0.09], [0.14, 0.134, 0.098, 0.004], [0.24, 0.15, 0.104, 0.01], [0.31, 0.158, 0.098, 0.006], [0.36, 0.172, 0.086, -0.004], [0.41, 0.13, 0.074, -0.006]], 28, { th0: 0.45, th1: Math.PI * 2 - 0.45 }), D('coat'));
    add(torso, loft([[0.4, 0.07, 0.06], [0.48, 0.06, 0.054]], 20), M('coat'));
    belt(R, torso, 0.04, 0.12, 0.09, M('scarf'), 0.06);
    const sash = new THREE.Group(); sash.position.set(0.07, 0.03, 0.06); torso.add(sash);
    add(sash, strand([[0, 0, 0], [0.02, -0.08, 0.02], [0.03, -0.24, 0.02]], 0.028, 0.005, { hint: new THREE.Vector3(0, 0, 1), wEnd: 0.7 }), D('scarf'));
    R.sway.push({ type: 'wave', g: sash, base: 0, k: -0.4, f: 8, ph: 1, amp: 0.08 });
    for (const A of [R.L, R.R]) {
      sleeve(R, A, { mat: M('coat'), cuffMat: M('trim'), puff: 0.054, len: 0.27 });
      glove(R, A, { mat: M('dark'), cuff: M('coat'), len: 0.16 });
    }
    // trousers
    add(pose, loft([[-0.15, 0.09, 0.075], [-0.06, 0.136, 0.094], [0.06, 0.122, 0.088]], 22), M('dark'));
    for (const A of [R.L, R.R]) {
      add(A.hip, limb(0.44, [[0, 0.084], [0.6, 0.066], [1, 0.056]]), M('dark'), [0, 0.01, 0]);
      boot(R, A, { mat: M('boot'), trim: M('trim'), top: 0.16, rTop: 0.056 });
    }
    // long coat skirt (open at the front)
    skirt(R, pose, { y: 0.07, len: 0.6, r0: 0.135, r1: 0.25, n: 10, mat: D('coat'), trim: M('trim'), from: Math.PI * 0.18, to: Math.PI * 1.82, flare: 0.08 });
    // mirror disc on the back
    const md = new THREE.Group(); md.position.set(0, 0.24, -0.12); torso.add(md);
    add(md, new THREE.TorusGeometry(0.1, 0.012, 8, 32), M('trim'));
    add(md, new THREE.CircleGeometry(0.095, 32), toonAcc('#bff7ee', 0.5), [0, 0, -0.002], [0, Math.PI, 0], null, { outline: 0 });
    R.tail.position.set(0, 0.42, -0.1);
  },
  // 霭: flowing two-layer robe dress, translucent shawl, sash bow
  ai(R) {
    const { torso, pose, M, D, add } = R;
    add(torso, loft([[0.0, 0.106, 0.082], [0.12, 0.106, 0.081, 0.004], [0.2, 0.12, 0.092, 0.014], [0.27, 0.126, 0.096, 0.018], [0.33, 0.128, 0.086, 0.006], [0.38, 0.14, 0.076, -0.004], [0.42, 0.09, 0.06, -0.006]], 26), M('top'));
    add(torso, loft([[0.18, 0.124, 0.096, 0.012], [0.33, 0.13, 0.089, 0.006]], 26, { th0: -1.2, th1: 1.2 }), D('coat'));
    belt(R, torso, 0.05, 0.106, 0.082, M('coat'), 0.06);
    const bow = new THREE.Group(); bow.position.set(0, 0.05, -0.085); torso.add(bow);
    for (const s of [-1, 1]) add(bow, ellip(0.05, 0.028, 0.012), M('scarf'), [s * 0.045, 0, 0], [0, 0, s * 0.3]);
    for (const s of [-1, 1]) add(bow, strand([[s * 0.01, 0, 0], [s * 0.03, -0.1, -0.02], [s * 0.04, -0.32, -0.02]], 0.026, 0.004, { hint: new THREE.Vector3(0, 0, -1), wEnd: 0.6 }), D('scarf'));
    R.sway.push({ type: 'wave', g: bow, base: 0, k: 0.3, f: 6, ph: 0, amp: 0.06 });
    // shawl draped over the shoulders
    add(torso, loft([[0.3, 0.16, 0.12, -0.01], [0.37, 0.162, 0.1, -0.006], [0.42, 0.12, 0.08, -0.006]], 26, { th0: Math.PI * 0.35, th1: Math.PI * 1.65 }), D('scarf'));
    for (const A of [R.L, R.R]) {
      // wide sleeves
      add(A.sh, limb(0.3, [[0, 0.055], [0.6, 0.07], [1, 0.09]]), D('top'));
      add(A.sh, loft([[-0.305, 0.091, 0.091], [-0.285, 0.091, 0.091]], 18), M('coat'));
    }
    add(pose, loft([[-0.12, 0.09, 0.07], [-0.05, 0.13, 0.09], [0.06, 0.112, 0.084]], 22), M('top'));
    // long layered skirt
    skirt(R, pose, { y: 0.07, len: 0.72, r0: 0.12, r1: 0.3, n: 14, mat: D('top'), trim: M('coat'), flare: 0.05 });
    skirt(R, pose, { y: 0.075, len: 0.42, r0: 0.128, r1: 0.26, n: 10, mat: D('coat'), trim: M('trim'), from: Math.PI * 0.4, to: Math.PI * 1.6, flare: 0.1 });
    for (const A of [R.L, R.R]) boot(R, A, { mat: M('boot'), trim: M('trim'), top: 0.32, rTop: 0.042 });
  },
  // 绫: fitted navy archer jacket, split water-blue ribbons and a practical side quiver.
  silk(R) {
    const { torso, pose, M, D, add } = R;
    add(torso, loft([[0.06, 0.106, 0.084], [0.15, 0.114, 0.09, 0.006], [0.25, 0.132, 0.102, 0.014], [0.34, 0.142, 0.086], [0.40, 0.104, 0.065]], 24, { th0: 0.4, th1: Math.PI * 2 - 0.4 }), D('coat'));
    add(torso, loft([[0.42, 0.055, 0.049], [0.48, 0.046, 0.044]], 18), M('coat'));
    belt(R, torso, 0.035, 0.107, 0.086, M('dark'), 0.065);
    add(torso, new THREE.TorusGeometry(0.022, 0.005, 6, 16), M('trim'), [0, 0.04, 0.092]);
    for (const s of [-1, 1]) {
      add(torso, strand([[s * 0.062, 0.40, 0.071], [s * 0.07, 0.32, 0.096], [s * 0.046, 0.15, 0.103]], 0.007, 0.004, { n: 6, rs: 4, wEnd: 1 }), M('trim'), [0, 0, 0], [0, 0, 0], null, { outline: 0 });
    }
    add(pose, loft([[-0.14, 0.09, 0.07], [-0.05, 0.13, 0.09], [0.06, 0.112, 0.084]], 22), M('dark'));
    skirt(R, pose, { y: 0.055, len: 0.18, r0: 0.124, r1: 0.185, n: 6, mat: D('coat'), trim: M('trim'), from: Math.PI * 0.35, to: Math.PI * 1.65, flare: 0.14 });
    for (const A of [R.L, R.R]) {
      sleeve(R, A, { mat: M('coat'), cuffMat: M('trim'), puff: 0.045, len: A.side > 0 ? 0.14 : 0.20 });
      glove(R, A, { mat: M('dark'), cuff: M('trim'), len: A.side > 0 ? 0.16 : 0.10 });
      boot(R, A, { mat: M('boot'), trim: M('trim'), top: 0.16, rTop: 0.052 });
    }
    // Water ribbons retain the existing secondary-motion groups.
    R.tail.position.set(0.066, 0.38, -0.068); R.tail2.position.set(-0.04, 0.38, -0.08);
    coatTail(R, R.tail, { len: 0.66, w0: 0.022, w1: 0.039, mat: D('scarf'), trim: M('top'), curl: 0.11 });
    coatTail(R, R.tail2, { len: 0.56, w0: 0.017, w1: 0.026, mat: D('scarf'), trim: M('trim'), curl: 0.08 });
    const q = new THREE.Group(); q.position.set(-0.12, 0.08, -0.102); q.rotation.z = -0.14; torso.add(q);
    add(q, new THREE.CylinderGeometry(0.032, 0.025, 0.28, 10), M('dark'));
    add(q, new THREE.TorusGeometry(0.034, 0.004, 4, 12), M('trim'), [0, 0.14, 0], [Math.PI / 2, 0, 0]);
    for (const x of [-0.012, 0.012]) {
      add(q, new THREE.CylinderGeometry(0.003, 0.003, 0.15, 4), M('trim'), [x, 0.18, 0]);
      add(q, ellip(0.007, 0.025, 0.012, 8, 6), M('top'), [x, 0.23, 0]);
    }
  },
  // 翎: a white robe with a leaf-shaped green mantle, open front and three floating coat panels.
  feather(R) {
    const { torso, pose, M, D, add } = R;
    add(torso, loft([[0.02, 0.109, 0.084], [0.15, 0.109, 0.084, 0.004], [0.27, 0.128, 0.098, 0.014], [0.35, 0.14, 0.083], [0.41, 0.09, 0.061]], 24), M('top'));
    add(torso, loft([[0.24, 0.17, 0.127], [0.32, 0.163, 0.109], [0.39, 0.12, 0.079], [0.44, 0.06, 0.055]], 24, { th0: Math.PI * 0.32, th1: Math.PI * 1.68 }), D('coat'));
    belt(R, torso, 0.075, 0.111, 0.086, M('coat'), 0.065);
    add(torso, new THREE.OctahedronGeometry(0.026, 0), M('trim'), [0, 0.085, 0.095], [0, 0, 0], [0.75, 1.4, 0.4]);
    const clasp = new THREE.Group(); clasp.position.set(0.04, 0.36, 0.09); torso.add(clasp);
    for (const s of [-1, 1]) add(clasp, ellip(0.01, 0.036, 0.007, 10, 8), M('trim'), [s * 0.012, 0, 0], [0, 0, s * -0.5]);
    add(pose, loft([[-0.12, 0.09, 0.07], [-0.05, 0.13, 0.09], [0.06, 0.112, 0.084]], 22), M('top'));
    skirt(R, pose, { y: 0.065, len: 0.37, r0: 0.121, r1: 0.24, n: 10, mat: D('top'), trim: M('coat'), flare: 0.1 });
    skirt(R, pose, { y: 0.07, len: 0.66, r0: 0.13, r1: 0.29, n: 7, mat: D('coat'), trim: M('trim'), from: Math.PI * 0.32, to: Math.PI * 1.68, flare: 0.06 });
    for (const A of [R.L, R.R]) {
      sleeve(R, A, { mat: M('top'), cuffMat: M('coat'), puff: 0.047, len: 0.15 });
      add(A.el, limb(0.12, [[0, 0.033], [0.6, 0.044], [1, 0.061]], 14), D('top'), [0, -0.04, 0]);
      add(A.el, loft([[-0.17, 0.06, 0.059], [-0.155, 0.06, 0.059]], 16), M('trim'));
      boot(R, A, { mat: M('boot'), trim: M('trim'), top: 0.23, rTop: 0.047 });
    }
    R.tail.position.set(0.045, 0.075, -0.085); R.tail2.position.set(-0.045, 0.075, -0.085);
    coatTail(R, R.tail, { len: 0.58, w0: 0.022, w1: 0.045, mat: D('scarf'), trim: M('trim'), curl: 0.14 });
    coatTail(R, R.tail2, { len: 0.68, w0: 0.022, w1: 0.045, mat: D('scarf'), trim: M('trim'), curl: 0.14 });
  },
  // 岚: a short field jacket, diagonal scarf, fitted trousers and a single shoulder guard.
  gale(R) {
    const { torso, pose, M, D, add } = R;
    // Keep the jacket shell clear of the shirt at the chest and shoulder transitions.
    add(torso, loft([[0.035, 0.12, 0.091], [0.17, 0.139, 0.111], [0.28, 0.158, 0.112], [0.36, 0.171, 0.093], [0.42, 0.117, 0.078]], 26, { th0: 0.36, th1: Math.PI * 2 - 0.36 }), D('coat'));
    add(torso, loft([[0.40, 0.067, 0.06], [0.47, 0.05, 0.047]], 18), M('coat'));
    belt(R, torso, 0.025, 0.119, 0.091, M('dark'), 0.06);
    add(torso, new THREE.BoxGeometry(0.032, 0.026, 0.012), M('trim'), [0, 0.025, 0.098], [0, 0, 0], null, { outline: 0 });
    add(torso, strand([[0.092, 0.40, 0.073], [0.02, 0.36, 0.099], [-0.13, 0.31, 0.074]], 0.029, 0.01, { n: 8, rs: 6, wEnd: 0.8 }), M('scarf'));
    const sc = new THREE.Group(); sc.position.set(-0.10, 0.36, -0.055); torso.add(sc);
    add(sc, strand([[0, 0, 0], [-0.035, -0.04, -0.06], [-0.055, -0.19, -0.10], [-0.045, -0.31, -0.085]], 0.032, 0.006, { hint: new THREE.Vector3(0, 0, -1), n: 8, wEnd: 0.6 }), D('scarf'));
    R.sway.push({ type: 'wave', g: sc, base: 0, k: 0.4, f: 8, ph: 0.4, amp: 0.08 });
    add(pose, loft([[-0.15, 0.09, 0.075], [-0.06, 0.136, 0.094], [0.06, 0.122, 0.088]], 22), M('dark'));
    for (const A of [R.L, R.R]) {
      sleeve(R, A, { mat: M('coat'), cuffMat: M('trim'), puff: 0.052, len: 0.18 });
      glove(R, A, { mat: M('dark'), cuff: M('trim'), len: 0.13 });
      add(A.hip, limb(0.43, [[0, 0.083], [0.5, 0.069], [0.85, 0.057], [1, 0.052]], 16), M('dark'), [0, 0.012, 0]);
      boot(R, A, { mat: M('boot'), trim: M('trim'), top: 0.19, rTop: 0.052 });
    }
    add(R.L.sh, ellip(0.062, 0.024, 0.061, 16, 10), M('dark'), [0.005, 0.025, 0], [0, 0, -0.2]);
    add(R.L.sh, ellip(0.055, 0.016, 0.055, 16, 8), M('trim'), [0.007, 0.042, 0], [0, 0, -0.2]);
    R.tail.position.set(0.08, 0.045, -0.073); R.tail2.position.set(-0.08, 0.045, -0.073);
    coatTail(R, R.tail, { len: 0.31, w0: 0.047, w1: 0.068, mat: D('coat'), trim: M('trim'), curl: 0.065 });
    coatTail(R, R.tail2, { len: 0.31, w0: 0.047, w1: 0.068, mat: D('coat'), trim: M('trim'), curl: 0.065 });
  },
};

// ---------- weapons ----------
function buildWeapon(W, LA, RA, add, M) {
  const metal = toonAcc(W.metal, 0.12), gem = toonAcc(W.gem, 0.8), grip = toon(W.grip, '#111111'); grip.userData.outline = '0a0a0a';
  const bladeMat = new THREE.MeshStandardMaterial({ color: W.blade, emissive: W.glow, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.7 });
  let sword;
  if (W.kind === 'bow') {
    sword = new THREE.Group(); sword.position.set(0, -0.26, 0); LA.el.add(sword);
    const R = 0.55;
    const bowMat = new THREE.MeshStandardMaterial({ color: W.blade, emissive: W.glow, emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.5 });
    const arc = new THREE.TorusGeometry(R, 0.024, 8, 36, Math.PI * 0.85);
    arc.rotateZ(Math.PI * 0.075); arc.translate(0, -R, 0);
    arc.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
    const bow = new THREE.Mesh(arc, bowMat); bow.castShadow = true; sword.add(bow);
    const g2 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.16, 10), grip); g2.rotation.x = Math.PI / 2; sword.add(g2);
    for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), gem); o.position.set(0, 0.04, s * 0.12); o.scale.set(1, 1.6, 1); sword.add(o); }
    const ex = 0.97 * R, ey = 0.77 * R;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, ex * 2, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    string.rotation.x = Math.PI / 2; string.position.y = ey; sword.add(string);
    sword.userData.bowMat = bowMat;
  } else {
    sword = new THREE.Group(); sword.position.set(0, -0.26, 0.0); sword.rotation.x = 0.25; RA.el.add(sword);
    const bs = new THREE.Shape();
    bs.moveTo(-0.04, 0); bs.lineTo(0.04, 0); bs.lineTo(0.036, 0.62); bs.quadraticCurveTo(0.03, 0.78, 0, 0.92); bs.quadraticCurveTo(-0.03, 0.78, -0.036, 0.62); bs.lineTo(-0.04, 0);
    const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.008, bevelSegments: 2 });
    bg.translate(0, 0, -0.006); bg.rotateX(Math.PI); bg.translate(0, -0.08, 0);
    const blade = new THREE.Mesh(bg, bladeMat); blade.castShadow = true; sword.add(blade);
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.55, 0.03), new THREE.MeshBasicMaterial({ color: W.glow })); fuller.position.y = -0.4; sword.add(fuller);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 8, 20, Math.PI), metal); guard.position.y = -0.072; guard.rotation.z = Math.PI; sword.add(guard);
    const gc = new THREE.Mesh(new THREE.OctahedronGeometry(0.026, 0), gem); gc.position.set(0, -0.075, 0.012); gc.scale.set(1, 1.3, 0.6); sword.add(gc);
    const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.15, 10), grip); gr.position.y = 0.01; sword.add(gr);
    for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 4, 12), metal); w.rotation.x = Math.PI / 2; w.position.y = -0.04 + i * 0.035; sword.add(w); }
    const pm = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), gem); pm.position.y = 0.1; pm.scale.set(1, 1.4, 1); sword.add(pm);
  }
  sword.visible = false;
  return { sword, bladeMat };
}

// ---------- portraits ----------
// Renders a model once on a throwaway renderer and returns data URLs (bust + full body), so UI avatars match the 3D look.
export function renderPortraits(ids) {
  const out = {};
  let r;
  try {
    const cv = document.createElement('canvas');
    r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) { return out; }
  r.setPixelRatio(1); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e8f2ff', '#d8cfb8', 1.2));
  const key = new THREE.DirectionalLight('#fff4e6', 2.2); key.position.set(1.2, 2, 2.4); scene.add(key);
  const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 30);
  for (const id of ids) {
    const m = makeCharacter(id);
    m.root.rotation.y = -0.35;
    scene.add(m.root);
    const res = {};
    // bust
    r.setSize(256, 256, false); cam.aspect = 1; cam.fov = 20; cam.updateProjectionMatrix();
    const hy = m.root.scale.y * 1.56;
    cam.position.set(0.18, hy + 0.02, 1.25); cam.lookAt(0, hy - 0.04, 0);
    m.syncPose?.();
    r.setClearColor(0x000000, 0); r.render(scene, cam); res.bust = r.domElement.toDataURL('image/png');
    // full body, slight contrapposto
    m.L.sh.rotation.z = 0.18; m.R.sh.rotation.z = -0.25; m.R.el.rotation.x = -0.4; m.L.hip.rotation.x = 0.1; m.R.kn.rotation.x = 0.15;
    r.setSize(360, 640, false); cam.aspect = 360 / 640; cam.fov = 26; cam.updateProjectionMatrix();
    cam.position.set(0.5, 1.0, 4.0); cam.lookAt(0, 0.92 * m.root.scale.y, 0);
    m.syncPose?.();
    r.render(scene, cam); res.full = r.domElement.toDataURL('image/png');
    scene.remove(m.root);
    m.root.traverse((o) => { if (o.geometry && !o.userData.trialShared) o.geometry.dispose(); });
    out[id] = res;
  }
  r.dispose(); try { r.forceContextLoss(); } catch (e) { /* ignore */ }
  return out;
}
