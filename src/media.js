import * as THREE from 'three';

// Visuals for the 光媒 (light media) and the light effects that pass through them.
export const PRISM7 = ['#ff5a5a', '#ff9f43', '#ffe14d', '#6ee07a', '#4fc3ff', '#5b7cff', '#b47cff'];

function softTex() {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let SOFT = null;
const soft = () => SOFT || (SOFT = softTex());

// ---------- 聚晶: a cluster of amber crystals ----------
export function makeCrystal(natural = false) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: natural ? '#fff0c8' : '#ffd38a', emissive: natural ? '#ffb347' : '#ff9a2a', emissiveIntensity: 0.65, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 });
  const parts = [[0, 1.05, 0, 0.42, 2.3, 0], [0.32, 0.55, 0.1, 0.24, 1.8, 0.45], [-0.3, 0.5, -0.05, 0.22, 1.6, -0.5], [0.08, 0.42, -0.3, 0.2, 1.5, -0.3], [-0.1, 0.4, 0.32, 0.18, 1.4, 0.35]];
  for (const [x, y, z, s, sy, rz] of parts) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), mat); m.position.set(x, y, z); m.scale.set(1, sy, 1); m.rotation.z = rz; m.rotation.y = x * 3; m.castShadow = true; g.add(m);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.22, 8), new THREE.MeshStandardMaterial({ color: natural ? '#9a948a' : '#c98f45', roughness: 0.9 }));
  base.position.y = 0.08; base.castShadow = true; base.receiveShadow = true; g.add(base);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: '#ffcf7a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 1.0; halo.scale.setScalar(2.4); g.add(halo);
  g.userData = { mat, halo };
  return g;
}

// ---------- 海镜: a round sea-glass mirror on a stand ----------
const mirrorMat = () => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uA: { value: 1 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false,
  vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
  fragmentShader: `uniform float uTime; uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){
      vec2 p = vUv * 2.0 - 1.0; float r = length(p);
      float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
      vec3 sky = mix(vec3(0.75, 0.93, 1.0), vec3(0.98, 1.0, 1.0), vUv.y);
      float sheen = smoothstep(0.08, 0.0, abs(p.x + p.y * 0.6 - mod(uTime * 0.8, 3.0) + 1.5));
      vec3 col = mix(sky, vec3(0.62, 0.92, 0.9), 0.35 * (1.0 - vUv.y)) + sheen * 0.6 + fres * 0.3;
      gl_FragColor = vec4(col, (0.82 + fres * 0.15) * uA * smoothstep(1.0, 0.96, r));
      #include <colorspace_fragment>
    }`,
});
export function makeMirror() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), mirrorMat()); disc.position.y = 1.35; g.add(disc);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#cfe8ee', roughness: 0.25, metalness: 0.6, emissive: '#3fb8ae', emissiveIntensity: 0.25 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.06, 8, 48), rimMat); rim.position.y = 1.35; rim.castShadow = true; g.add(rim);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8), rimMat); stem.position.y = 0.15; g.add(stem);
  for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), rimMat); o.position.set(s * 1.18, 1.35, 0); g.add(o); }
  g.userData = { disc };
  return g;
}

// ---------- 蜃雾: a drifting lavender fog volume ----------
export function makeMist(r) {
  const g = new THREE.Group();
  const sprites = [];
  const n = Math.round(8 + r * 2.2);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: i % 3 ? '#d9ceff' : '#f2edff', transparent: true, opacity: 0.0, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * 0.85;
    s.position.set(Math.cos(a) * d, 0.6 + Math.random() * 2.4, Math.sin(a) * d);
    const sc = r * (0.55 + Math.random() * 0.45); s.scale.set(sc * 1.4, sc, 1);
    s.userData = { a, d, ph: Math.random() * 6, base: s.position.y, op: 0.22 + Math.random() * 0.12 };
    g.add(s); sprites.push(s);
  }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ map: soft(), color: '#cfc2ff', transparent: true, opacity: 0.0, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.08; g.add(floor);
  g.userData = { sprites, floor, r, lit: 0 };
  return g;
}
export function animateMist(g, t, alpha) {
  const u = g.userData, lit = u.lit;
  for (const s of u.sprites) {
    const d = s.userData;
    s.position.x = Math.cos(d.a + t * 0.05) * d.d; s.position.z = Math.sin(d.a + t * 0.05) * d.d;
    s.position.y = d.base + Math.sin(t * 0.6 + d.ph) * 0.2;
    s.material.opacity = d.op * alpha * (1 + lit * 1.2);
    s.material.color.setHSL(0.72 - lit * 0.1, 0.6, 0.86 + lit * 0.1);
  }
  u.floor.material.opacity = 0.35 * alpha;
  u.lit = Math.max(0, lit - 0.02);
}

// ---------- light beam (聚光 / 光束) ----------
const beamMat = (color) => new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uColor: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform float uT; uniform vec3 uColor; varying vec2 vUv;
    void main(){
      float across = abs(vUv.x - 0.5) * 2.0;
      float core = smoothstep(1.0, 0.0, across);
      float a = core * (1.0 - uT) * smoothstep(0.0, 0.04, vUv.y);
      gl_FragColor = vec4(mix(uColor, vec3(1.0), core * core * 0.7) * 1.8, a);
    }`,
});
export function makeBeam(from, to, color = '#ffe9a8', width = 0.22) {
  const len = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(width, width, len, 10, 1, true); geo.translate(0, len / 2, 0);
  const m = new THREE.Mesh(geo, beamMat(color));
  m.position.copy(from);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  m.renderOrder = 7;
  return m;
}

// ---------- 虹桥: a walkable rainbow arch ----------
const bridgeMat = () => new THREE.ShaderMaterial({
  uniforms: { uA: { value: 0 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform float uA; uniform float uTime; varying vec2 vUv;
    vec3 band(float x){
      vec3 c[7]; c[0]=vec3(1.0,0.35,0.35); c[1]=vec3(1.0,0.62,0.26); c[2]=vec3(1.0,0.88,0.3); c[3]=vec3(0.43,0.88,0.48); c[4]=vec3(0.31,0.76,1.0); c[5]=vec3(0.36,0.49,1.0); c[6]=vec3(0.7,0.49,1.0);
      float f = clamp(x, 0.0, 0.999) * 7.0; int i = int(floor(f)); vec3 a = c[0];
      for (int k = 0; k < 7; k++) if (k == i) a = c[k];
      return a;
    }
    void main(){
      vec3 col = band(vUv.x);
      float shimmer = 0.85 + 0.15 * sin(vUv.y * 120.0 - uTime * 6.0);
      float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
      float ends = smoothstep(0.0, 0.03, vUv.y) * smoothstep(1.0, 0.97, vUv.y);
      gl_FragColor = vec4(col * 1.25 * shimmer, 0.78 * edge * ends * uA);
      #include <colorspace_fragment>
    }`,
});
// pts: array of Vector3 along the walkway centre; returns a ribbon mesh of the given width
export function makeBridge(pts, width = 2.6) {
  const pos = [], uv = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    dir.subVectors(b, a); dir.y = 0; dir.normalize(); side.crossVectors(up, dir).normalize();
    for (const s of [-1, 1]) { const p = pts[i].clone().addScaledVector(side, s * width / 2); pos.push(p.x, p.y + 0.02, p.z); uv.push(s < 0 ? 0 : 1, i / (pts.length - 1)); }
  }
  for (let i = 0; i < pts.length - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, bridgeMat()); m.renderOrder = 6; m.frustumCulled = false;
  return m;
}
