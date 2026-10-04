import * as THREE from 'three';
import { NOISE_GLSL, rng } from './noise.js';

export const SKY_COLORS = {
  zenith: new THREE.Color('#1653d6'),
  mid: new THREE.Color('#3b8ff0'),
  horizon: new THREE.Color('#a9dcff'),
  haze: new THREE.Color('#e6f5ff'),
};

export function makeSky(sunDir, rbDir) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: sunDir }, uRb: { value: rbDir }, uTime: { value: 0 },
      uZenith: { value: SKY_COLORS.zenith }, uMid: { value: SKY_COLORS.mid },
      uHorizon: { value: SKY_COLORS.horizon }, uHaze: { value: SKY_COLORS.haze },
      // story state of the rainbow: band strength from the outer red (0) to the inner violet (6), plus a flicker
      uBand: { value: [1, 1, 1, 1, 1, 1, 1] }, uFlick: { value: 0 },
      // day / night: moon direction, night amount (stars), cloud tint, rainbow glow
      uMoon: { value: new THREE.Vector3(0, -1, 0) }, uNight: { value: 0 }, uCloud: { value: new THREE.Color('#ffffff') }, uRbGlow: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun, uRb, uZenith, uMid, uHorizon, uHaze; uniform float uTime;
      uniform float uBand[7]; uniform float uFlick; uniform vec3 uMoon, uCloud; uniform float uNight, uRbGlow;
      float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float bandAt(float k){ int i = int(clamp(k, 0.0, 6.0)); float v = 1.0; for (int j = 0; j < 7; j++) if (j == i) v = uBand[j]; return v; }
      varying vec3 vDir;
      ${NOISE_GLSL}
      vec3 hsv2rgb(vec3 c){ vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz)*6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 col = mix(uHaze, uHorizon, smoothstep(-0.02, 0.07, y));
        col = mix(col, uMid, smoothstep(0.05, 0.34, y));
        col = mix(col, uZenith, smoothstep(0.28, 0.95, y));
        // sun glow + starburst
        float sd = max(dot(d, uSun), 0.0);
        vec3 a = cross(uSun, vec3(0.0, 1.0, 0.0)); a = a / max(length(a), 1.0e-3); vec3 b = cross(a, uSun);
        vec3 q = d - uSun * dot(d, uSun);
        float ang = atan(dot(q, b) + 1.0e-6, dot(q, a) + 1.0e-6);
        float rays = pow(0.5 + 0.5*cos(ang*8.0 + 0.4), 14.0) + 0.7*pow(0.5 + 0.5*cos(ang*13.0 + 1.3), 22.0);
        vec3 sunC = vec3(1.0, 0.97, 0.88);
        // cirrus streaks & cotton puffs
        if (y > 0.0) {
          vec2 p = d.xz / (y + 0.14);
          float ca = 0.62, sa = 0.78; p = mat2(ca, -sa, sa, ca) * p;
          float t = uTime * 0.006;
          float streak = fbm(vec2(p.x * 0.55, p.y * 4.2) + vec2(t, 0.0));
          float wisp = smoothstep(0.5, 0.86, streak + 0.3 * (fbm(p * 2.2 + t) - 0.5));
          float puff = fbm(p * 6.5 + vec2(0.0, t * 2.0));
          float region = smoothstep(0.42, 0.72, fbm(p * 0.9 - t + 4.0));
          float puffs = smoothstep(0.56, 0.74, puff) * region;
          float cl = max(wisp * 0.82, puffs * 0.92) * smoothstep(0.03, 0.22, y);
          vec3 cloudC = mix(vec3(0.86, 0.92, 1.0), vec3(1.0), smoothstep(0.4, 0.9, puff)) * uCloud;
          col = mix(col, cloudC, cl * mix(1.0, 0.55, uNight));
          col += sunC * cl * pow(sd, 8.0) * 0.6 * smoothstep(-0.1, 0.1, uSun.y);
        }
        // rainbow (pastel, wide)
        float ra = degrees(acos(clamp(dot(d, uRb), -1.0, 1.0)));
        float x = (ra - 31.5) / 8.0;
        float fadeH = smoothstep(-0.01, 0.06, y);
        if (x > -0.2 && x < 1.2) {
          float bandA = smoothstep(0.0, 0.2, x) * smoothstep(1.0, 0.78, x);
          vec3 rc = hsv2rgb(vec3((1.0 - clamp(x, 0.0, 1.0)) * 0.80, 0.72, 1.0));
          rc = pow(mix(rc, vec3(1.0), 0.18), vec3(2.2));
          // which of the seven colours is this? faded colours turn into a thin grey ghost
          float kk = (1.0 - clamp(x, 0.0, 1.0)) * 7.0 - 0.5, k0 = floor(kk), kf = smoothstep(0.25, 0.75, kk - k0);
          float bs = mix(bandAt(k0), bandAt(k0 + 1.0), kf);
          float grey = dot(rc, vec3(0.3, 0.55, 0.15));
          rc = mix(vec3(grey) * 0.9, rc, bs);
          float fl = 1.0 - uFlick * (0.55 + 0.45 * sin(uTime * 37.0) * sin(uTime * 13.0 + 1.7));
          col = mix(col, rc * 1.12 * mix(1.0, 1.6, uNight), bandA * 0.55 * fadeH * mix(0.32, 1.0, bs) * fl * uRbGlow);
        }
        col += vec3(0.035, 0.045, 0.06) * smoothstep(31.5, 22.0, ra) * fadeH;
        float sv = smoothstep(-0.12, 0.04, uSun.y);
        col += sunC * (pow(sd, 5.0) * 0.22 * sv + pow(sd, 60.0) * 0.9 * sv + pow(sd, 1400.0) * 14.0 * smoothstep(-0.02, 0.02, uSun.y));
        col += sunC * rays * pow(sd, 36.0) * 1.6 * sv;
        // night: stars and the moon
        if (uNight > 0.01 && y > -0.02) {
          vec3 q3 = floor(d * 260.0);
          float h = hash3(q3), star = step(0.9965, h) * (0.55 + 0.45 * sin(uTime * (1.5 + h * 4.0) + h * 40.0));
          vec3 f3 = fract(d * 260.0) - 0.5; star *= smoothstep(0.42, 0.0, length(f3));
          col += vec3(0.85, 0.9, 1.0) * star * uNight * smoothstep(0.0, 0.25, y) * 1.4;
          float md = max(dot(d, uMoon), 0.0);
          col += vec3(0.75, 0.82, 1.0) * (pow(md, 3000.0) * 3.0 + pow(md, 120.0) * 0.18 + pow(md, 12.0) * 0.05) * uNight * smoothstep(-0.05, 0.05, uMoon.y);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 32), mat);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  mesh.name = 'sky';
  return mesh;
}

// Painterly cumulus billboards around the horizon.
function cloudTexture(seed) {
  const r = rng(seed);
  const W = 512, Hh = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
  const g = cv.getContext('2d');
  const blobs = [];
  const n = 26 + Math.floor(r() * 10);
  for (let i = 0; i < n; i++) {
    const t = r();
    const x = W * (0.12 + 0.76 * t);
    const hump = Math.sin(t * Math.PI);
    const rad = 26 + 46 * hump * (0.6 + 0.6 * r());
    const y = Hh * 0.78 - rad * (0.3 + 0.9 * r() * hump);
    blobs.push([x, y, rad]);
  }
  for (const [x, y, rad] of blobs) {
    const gr = g.createRadialGradient(x, y - rad * 0.25, rad * 0.1, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.6, 'rgba(250,252,255,0.95)');
    gr.addColorStop(1, 'rgba(240,246,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // soft blue-grey underside
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(0, Hh * 0.45, 0, Hh * 0.85);
  sh.addColorStop(0, 'rgba(190,210,235,0)');
  sh.addColorStop(1, 'rgba(170,195,228,0.75)');
  g.fillStyle = sh; g.fillRect(0, 0, W, Hh);
  // flat-ish bottom fade
  g.globalCompositeOperation = 'destination-out';
  const fb = g.createLinearGradient(0, Hh * 0.76, 0, Hh * 0.86);
  fb.addColorStop(0, 'rgba(0,0,0,0)'); fb.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fb; g.fillRect(0, 0, W, Hh);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeCumulus(center, heroYaw) {
  const group = new THREE.Group();
  const texs = [1, 2, 3, 4, 5].map(cloudTexture);
  const r = rng(99);
  const mats = texs.map((t) => new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  const N = 64;
  for (let i = 0; i < N; i++) {
    // bias clouds toward the hero view (north-west) and the sides
    const ang = heroYaw + (r() - 0.5) * Math.PI * 2;
    const dist = 2300 + r() * 2600;
    const sp = new THREE.Sprite(mats[i % mats.length]);
    const w = 500 + r() * 1200;
    sp.scale.set(w, w * 0.5, 1);
    sp.position.set(center.x - Math.sin(ang) * dist, 45 + r() * r() * 420 + w * 0.26, center.z - Math.cos(ang) * dist);
    sp.renderOrder = 2;
    group.add(sp);
  }
  group.name = 'cumulus';
  return group;
}

// Distant mountain ring on the horizon.
export function makeMountains(center) {
  const SEG = 600, ROWS = 7;
  const r0 = 3000, r1 = 5600;
  const pos = [], col = [], idx = [];
  const lo = new THREE.Color('#c3d9f0'), hi = new THREE.Color('#86a9d6'), c = new THREE.Color();
  const ridge = (t, s) => {
    let v = 0, a = 1, f = 1, n = 0;
    for (let o = 0; o < 5; o++) {
      const x = t * f + s + o * 13.1;
      const k = Math.floor(x), fr = x - k;
      const h0 = Math.sin(k * 127.1 + s) * 43758.5453 % 1, h1 = Math.sin((k + 1) * 127.1 + s) * 43758.5453 % 1;
      const u = fr * fr * (3 - 2 * fr);
      const val = Math.abs(h0) + (Math.abs(h1) - Math.abs(h0)) * u;
      v += a * (1 - Math.abs(val * 2 - 1)); n += a; a *= 0.5; f *= 2.1;
    }
    return v / n;
  };
  for (let j = 0; j <= ROWS; j++) {
    const rt = j / ROWS;
    const rad = r0 + (r1 - r0) * rt;
    for (let i = 0; i <= SEG; i++) {
      const th = i / SEG * Math.PI * 2;
      const m = ridge(i / SEG * 40, 3.0) * 0.75 + ridge(i / SEG * 11, 7.0) * 0.6;
      const dirBoost = 0.55 + 0.45 * Math.cos(th - 0.3); // taller toward the north
      const prof = Math.sin(Math.min(1, rt * 1.25) * Math.PI) ** 0.9;
      let hgt = (40 + 260 * m * m * dirBoost) * prof - (j === 0 ? 40 : 0);
      if (j === ROWS) hgt = -40;
      pos.push(center.x + Math.sin(th) * rad, hgt, center.z - Math.cos(th) * rad);
      c.copy(lo).lerp(hi, Math.min(1, Math.max(0, hgt / 260)));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < SEG; i++) {
    const a = j * (SEG + 1) + i, b = a + 1, cc = a + SEG + 1, d = cc + 1;
    idx.push(a, b, cc, b, d, cc);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // bake soft relief shading so the range reads as distant, hazy silhouettes
  const nr = geo.attributes.normal, cl = geo.attributes.color, L = new THREE.Vector3(-0.3, 0.8, 0.5).normalize();
  for (let i = 0; i < nr.count; i++) {
    const d = Math.max(0, nr.getX(i) * L.x + nr.getY(i) * L.y + nr.getZ(i) * L.z);
    const k = 0.86 + 0.22 * d;
    cl.setXYZ(i, cl.getX(i) * k, cl.getY(i) * k, cl.getZ(i) * k);
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.name = 'mountains';
  return mesh;
}
