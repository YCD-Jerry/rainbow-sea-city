import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, M } from './geo.js';

// World pieces that carry the story: the 集光塔 beams that draw light down from the rainbow,
// and the 回廊 gate as a heritage site the new town has fenced off and wired into.

// ---------------------------------------------------------------- collector beams
const BEAM_VS = /* glsl */`
  uniform float uL; varying float vS; varying float vCore;
  void main(){
    vS = position.y / uL;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * normal), v = normalize(cameraPosition - wp.xyz);
    vec3 ax = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
    vec3 vp = v - ax * dot(v, ax), np = n - ax * dot(n, ax);   // compare across the beam, not along it
    float lnp = max(length(np), 1e-4), lvp = max(length(vp), 1e-4);
    vCore = clamp(abs(dot(np / lnp, vp / lvp)), 0.0, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const BEAM_FS = /* glsl */`
  uniform float uTime, uPow, uPh; varying float vS; varying float vCore;
  vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
  void main(){
    float s = clamp(vS, 0.0, 1.0);
    // energy pulses travel down from the sky into the tower
    float pulse = pow(fract(s * 14.0 + uTime * 0.45 + uPh), 5.0);
    float core = pow(vCore, 2.2);
    float a = smoothstep(0.0, 0.015, s) * (1.0 - smoothstep(0.45, 1.0, s)) * (0.55 + 1.2 * pulse) * core;
    vec3 c = mix(vec3(0.9, 0.98, 1.0), mix(vec3(1.0), hue(fract(s * 2.2 + 0.55 + uPh)), 0.55), smoothstep(0.0, 0.35, s));
    gl_FragColor = vec4(c * a * uPow * 0.75, 1.0);
  }`;

export function makeCollectorBeams(scene, tips, rbDir) {
  const rb = rbDir.clone().normalize(), up = new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(rb, up).normalize(), v = new THREE.Vector3().crossVectors(u, rb).normalize();
  const A = THREE.MathUtils.degToRad(35.5);
  const arc = (th) => rb.clone().multiplyScalar(Math.cos(A)).add(u.clone().multiplyScalar(Math.sin(A) * Math.cos(th))).add(v.clone().multiplyScalar(Math.sin(A) * Math.sin(th)));
  // sample the visible part of the arc once
  const samples = [];
  for (let i = 0; i <= 240; i++) { const th = i / 240 * Math.PI * 2, d = arc(th); if (d.y > 0.06) samples.push(d); }
  const L = 1700, uni = [];
  const group = new THREE.Group(); group.name = 'collector-beams';
  const ref = new THREE.Vector3(70, 0, 40); // the bay as seen from the cliff
  tips.forEach((t, i) => {
    // pick the arc point whose azimuth best matches the tower's bearing from the bay, so the beams fan into the arc
    const az = Math.atan2(t.x - ref.x, t.z - ref.z);
    let best = samples[0], bd = Infinity;
    for (const d of samples) { let dd = Math.atan2(d.x, d.z) - az; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); const w = Math.abs(dd) - d.y * 0.15; if (w < bd) { bd = w; best = d; } }
    const geo = new THREE.CylinderGeometry(38, 1.6, L, 16, 24, true); geo.translate(0, L / 2, 0);
    const un = { uL: { value: L }, uTime: { value: 0 }, uPow: { value: 1 }, uPh: { value: i * 0.37 } };
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: un, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    m.position.set(t.x, t.y, t.z);
    m.quaternion.setFromUnitVectors(up, best);
    m.frustumCulled = false; m.renderOrder = 3;
    group.add(m); uni.push(un);
  });
  scene.add(group);
  return {
    group,
    update(time, power, flick) {
      uni.forEach((un, i) => {
        un.uTime.value = time;
        const f = flick > 0 ? 1 - flick * (0.5 + 0.5 * Math.sin(time * (31 + i * 3)) * Math.sin(time * 11 + i)) : 1;
        un.uPow.value = power * Math.max(0.1, f);
      });
    },
  };
}

// ---------------------------------------------------------------- heritage site around the 回廊 gate
function canvasTex(w, h, paint) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function signTex(lines, w, h, bg) {
  return canvasTex(w, h, (g, W, Hh) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [t, size, col, y, weight = 700] of lines) { g.font = `${weight} ${size}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`; g.fillStyle = col; g.fillText(t, W / 2, y * Hh); }
  });
}
function flagstoneTex() {
  const t = canvasTex(512, 512, (g, W) => {
    g.fillStyle = '#d9cfb9'; g.fillRect(0, 0, W, W);
    // concentric courses of warm flagstones around the gate
    const c = W / 2;
    for (let r = 20; r < W * 0.72; r += 34) {
      const n = Math.max(6, Math.round(r / 14));
      for (let k = 0; k < n; k++) {
        const a0 = (k + (r / 34) * 0.5) / n * Math.PI * 2, a1 = a0 + Math.PI * 2 / n;
        const v = 208 + Math.random() * 20;
        g.fillStyle = `rgb(${v},${v - 6},${v - 22})`;
        g.beginPath(); g.arc(c, c, r + 31, a0 + 0.012, a1 - 0.012); g.arc(c, c, r + 2, a1 - 0.012, a0 + 0.012, true); g.closePath(); g.fill();
      }
    }
    g.strokeStyle = 'rgba(201,154,58,0.7)'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, 54, 0, 7); g.stroke();
  });
  return t;
}

export function buildHeritage(scene, colliders, dent) {
  const { x, z } = dent.pos, y = dent.pos.y - 0.5, rot = dent.yaw;   // y = ground level around the platform
  const F = (lx = 0, ly = 0, lz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z).multiply(M(lx, ly, lz, rx, ry, rz, sx, sy, sz));
  const W = (lx, lz) => { const c = Math.cos(rot), s = Math.sin(rot); return [x + lx * c + lz * s, z - lx * s + lz * c]; };
  const STD = (o) => new THREE.MeshStandardMaterial({ roughness: 0.55, ...o });
  const mats = {
    white: STD({ color: '#f5f7f9', roughness: 0.35 }),
    glass: STD({ color: '#e4f8ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.9 }),
    dark: STD({ color: '#2c3442', roughness: 0.45, metalness: 0.4 }),
    steel: STD({ color: '#c9d1da', roughness: 0.3, metalness: 0.7 }),
    cable: STD({ color: '#30353f', roughness: 0.7 }),
    orange: STD({ color: '#ff9b4a', roughness: 0.5 }),
    stone: STD({ map: flagstoneTex(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    gold: STD({ color: '#e9c46a', roughness: 0.3, metalness: 0.7, emissive: '#5a3c08', emissiveIntensity: 0.3 }),
    crystal: STD({ color: '#ffffff', emissive: '#7fe3ff', emissiveIntensity: 1.3, roughness: 0.1, transparent: true, opacity: 0.92 }),
    solar: STD({ color: '#23407a', roughness: 0.25, metalness: 0.5 }),
    led: new THREE.MeshBasicMaterial({ color: '#9ee8ff' }),
    warm: new THREE.MeshBasicMaterial({ color: '#fff1c8' }),
  };
  const b = new Batch();
  const rbox = (w, h, d, r = 0.1) => new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2.05, h / 2.05, d / 2.05));
  const box = (lx, lz, w, d, ry, bottom, top, tag) => { const [cx, cz] = W(lx, lz); colliders.add({ type: 'box', x: cx, z: cz, hw: w / 2, hd: d / 2, rot: rot + ry, bottom: y + bottom, top: y + top, tag }); };
  const cyl = (lx, lz, r, top, tag) => { const [cx, cz] = W(lx, lz); colliders.add({ type: 'cyl', x: cx, z: cz, r, top: y + top, bottom: y - 1, tag }); };
  const out = { animate: [] };

  // flagstone plaza: the ancient layer, warm stone with a gold ring
  b.add(new THREE.CylinderGeometry(11.8, 12.1, 0.9, 64), mats.stone, F(0, -0.25, 0));
  colliders.add({ type: 'cyl', x, z, r: 11.8, top: y + 0.2, bottom: y - 1 });

  // crystal veins on the gate pillars (ancient material language: warm white stone, gold, crystal)
  const gate = dent.gatePos, gl = [(gate.x - x) * Math.cos(rot) - (gate.z - z) * Math.sin(rot), (gate.x - x) * Math.sin(rot) + (gate.z - z) * Math.cos(rot)];
  for (const sx of [-1, 1]) {
    for (const fz of [-0.39, 0.39]) {
      b.add(new THREE.BoxGeometry(0.07, 3.4, 0.04), mats.crystal, F(gl[0] + sx * 2.17 - 0.12, 0.5 + 2.3, gl[1] + fz));
      b.add(new THREE.BoxGeometry(0.07, 2.2, 0.04), mats.crystal, F(gl[0] + sx * 2.17 + 0.14, 0.5 + 1.9, gl[1] + fz));
    }
    b.add(new THREE.OctahedronGeometry(0.32, 0), mats.crystal, F(gl[0] + sx * 2.17, 0.5 + 4.4 + 0.75, gl[1], 0, 0.4, 0, 0.8, 1.6, 0.8));
  }
  // prisms set into the platform rim; the town's cables are clamped onto three of them
  const prisms = [];
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + Math.PI / 8, px = Math.cos(a) * 5.0, pz = Math.sin(a) * 5.0;
    b.add(new THREE.OctahedronGeometry(0.3, 0), mats.crystal, F(px, 0.55, pz, 0, a, 0, 0.8, 1.5, 0.8));
    prisms.push([px, pz]);
  }

  // protective glass canopy on three slim columns (the new layer, hovering over the old)
  {
    const R = 6.5, Hc = 9.6, Rs = 25, th = 0.284, rr = Rs * Math.sin(th);
    const cap = new THREE.SphereGeometry(Rs, 64, 6, 0, Math.PI * 2, 0, th); cap.translate(0, -Rs * Math.cos(th), 0);
    b.add(cap, mats.glass, F(0, Hc + 0.9, 0));
    b.add(new THREE.TorusGeometry(rr, 0.18, 8, 64), mats.white, F(0, Hc + 0.9, 0, Math.PI / 2, 0, 0));
    b.add(new THREE.TorusGeometry(rr, 0.05, 6, 64), mats.led, F(0, Hc + 0.72, 0, Math.PI / 2, 0, 0));
    for (let k = 0; k < 6; k++) b.add(new THREE.CylinderGeometry(0.06, 0.06, rr * 2, 6), mats.white, F(0, Hc + 0.95 + 0.6, 0, Math.PI / 2, k / 6 * Math.PI, 0));
    for (let k = 0; k < 3; k++) {
      const a = Math.PI / 2 + Math.PI / 3 + k * Math.PI * 2 / 3, cx = Math.cos(a) * R, cz = Math.sin(a) * R;
      b.add(new THREE.CylinderGeometry(0.16, 0.26, Hc + 0.9, 12), mats.white, F(cx, (Hc + 0.9) / 2, cz));
      b.add(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 14), mats.steel, F(cx, 0.3, cz));
      cyl(cx, cz, 0.35, Hc + 0.9, 'prop');
    }
  }

  // fence: low glass panels on white posts, open toward the road (+z)
  {
    const R = 11.0, gap = 0.42, n = 28;
    for (let k = 0; k < n; k++) {
      const a0 = Math.PI / 2 + gap + k / n * (Math.PI * 2 - 2 * gap), a1 = Math.PI / 2 + gap + (k + 1) / n * (Math.PI * 2 - 2 * gap);
      const ax = Math.cos(a0) * R, az = Math.sin(a0) * R, bx = Math.cos(a1) * R, bz = Math.sin(a1) * R;
      const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
      b.add(new THREE.BoxGeometry(0.05, 0.9, len), mats.glass, F((ax + bx) / 2, 0.75, (az + bz) / 2, 0, ry, 0));
      b.add(rbox(0.1, 0.07, len + 0.05, 0.03), mats.white, F((ax + bx) / 2, 1.22, (az + bz) / 2, 0, ry, 0));
      b.add(rbox(0.14, 1.25, 0.14, 0.04), mats.white, F(ax, 0.62, az));
      box((ax + bx) / 2, (az + bz) / 2, 0.25, len, ry, -0.5, 1.25, 'rail');
    }
    for (const s of [-1, 1]) { const a = Math.PI / 2 + s * gap; b.add(rbox(0.3, 1.6, 0.3, 0.06), mats.white, F(Math.cos(a) * R, 0.8, Math.sin(a) * R)); b.add(new THREE.BoxGeometry(0.06, 0.04, 0.32), mats.led, F(Math.cos(a) * R, 1.62, Math.sin(a) * R)); }
  }

  // information board at the entrance
  {
    const lx = -4.2, lz = 12.6, br = 0.12;
    b.add(rbox(2.9, 1.7, 0.14, 0.06), mats.white, F(lx, 1.55, lz, 0, br, 0));
    for (const e of [-1.2, 1.2]) b.add(rbox(0.12, 0.8, 0.12, 0.04), mats.white, F(lx + e * Math.cos(br), 0.4, lz - e * Math.sin(br)));
    const tex = signTex([
      ['织光者遗址 · 第一回廊', 50, '#f5e2b8', 0.17],
      ['虹湾市一级文物保护单位', 26, '#bfe8ff', 0.33, 500],
      ['三百年前，移民在此发现仍在运转的石门。', 24, '#e8edf3', 0.52, 400],
      ['回廊是古人引导光的通道，海湾上空的彩虹', 24, '#e8edf3', 0.64, 400],
      ['由此处与其余六座回廊共同维持。', 24, '#e8edf3', 0.76, 400],
      ['非持证人员请勿越过围栏 —— 虹湾遗址研究所', 20, '#9aa6b6', 0.91, 400],
    ], 640, 380, 'rgba(32,44,66,0.96)');
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.6), new THREE.MeshBasicMaterial({ map: tex }));
    const [px, pz] = W(lx + Math.sin(br) * 0.08, lz + Math.cos(br) * 0.08); p.position.set(px, y + 1.55, pz); p.rotation.y = rot + br; scene.add(p);
    box(lx, lz, 3, 0.4, br, -0.5, 2.4, 'prop');
  }

  // research cabin (modern prefab with a solar roof) on the left of the gate
  {
    const ca = Math.PI * 200 / 180, cx = Math.cos(ca) * 7.6, cz = Math.sin(ca) * 7.6, ry = Math.atan2(-cx, -cz), cw = 4.4, ch = 2.8, cd = 2.8;
    const G = (lx = 0, ly = 0, lz = 0, rx = 0, rry = 0, rz = 0) => F(cx, 0, cz, 0, ry, 0).multiply(M(lx, ly, lz, rx, rry, rz));
    b.add(rbox(cw + 0.4, 0.3, cd + 0.4, 0.08), mats.steel, G(0, 0.25, 0));
    b.add(rbox(cw, ch, cd, 0.18), mats.white, G(0, 0.4 + ch / 2, 0));
    b.add(new THREE.BoxGeometry(cw * 0.62, 1.1, 0.05), mats.dark, G(-0.6, 1.95, cd / 2 + 0.01));
    b.add(new THREE.BoxGeometry(cw * 0.6, 0.06, 0.06), mats.led, G(-0.6, 1.35, cd / 2 + 0.04));
    b.add(rbox(0.95, 2.1, 0.08, 0.03), mats.orange, G(cw / 2 - 0.8, 1.45, cd / 2 + 0.03));
    for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(1.25, 0.05, 1.5), mats.solar, G(-cw / 2 + 0.8 + i * 1.35, 0.4 + ch + 0.35, 0, -0.18, 0, 0));
    b.add(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), mats.steel, G(cw / 2 - 0.4, 0.4 + ch + 0.8, -cd / 2 + 0.4));
    const dish = new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, 0.9); b.add(dish, mats.white, G(cw / 2 - 0.4, 0.4 + ch + 1.6, -cd / 2 + 0.4, -0.9, 0, 0));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.47), new THREE.MeshBasicMaterial({ map: signTex([['虹湾遗址研究所 · 第一回廊工作站', 34, '#26334a', 0.55]], 640, 108, '#ffffff') }));
    const m = G(0, 0.4 + ch - 0.42, cd / 2 + 0.03); sign.applyMatrix4(m); scene.add(sign);
    const [wx, wz] = W(cx, cz); colliders.add({ type: 'box', x: wx, z: wz, hw: cw / 2 + 0.2, hd: cd / 2 + 0.2, rot: rot + ry, top: y + 0.4 + ch + 0.5, bottom: y - 1 });
    // crates and a cable reel by the door
    const [dx, dz] = [cx + Math.cos(ry) * (cw / 2 + 0.9), cz - Math.sin(ry) * (cw / 2 + 0.9)];
    b.add(rbox(1.0, 0.7, 0.7, 0.06), mats.orange, F(dx, 0.5, dz, 0, ry + 0.2, 0)); b.add(rbox(0.8, 0.5, 0.6, 0.05), mats.steel, F(dx + 0.1, 1.1, dz + 0.05, 0, ry - 0.1, 0));
    box(dx, dz, 1.1, 0.9, ry, -0.5, 1.35, 'prop');
    const reel = new THREE.CylinderGeometry(0.55, 0.55, 0.6, 18); reel.rotateZ(Math.PI / 2);
    b.add(reel, mats.dark, F(dx - Math.sin(ry) * 1.3, 0.75, dz - Math.cos(ry) * 1.3, 0, ry, 0));
    out.cabin = W(cx, cz);
    // city cables from the cabin, across the flagstones, clamped onto prisms in the platform rim
    for (const k of [3, 4, 5]) {
      const [px, pz] = prisms[k], a = Math.atan2(pz, px), ex = Math.cos(a) * 5.55, ez = Math.sin(a) * 5.55;
      const s0 = new THREE.Vector3(cx + Math.sin(ry) * (cd / 2 + 0.1) + Math.cos(ry) * (k - 4) * 0.7, 0.3, cz + Math.cos(ry) * (cd / 2 + 0.1) - Math.sin(ry) * (k - 4) * 0.7), mid = new THREE.Vector3((cx + ex) / 2 + 0.6, 0.27, (cz + ez) / 2 + (k - 4) * 1.2), e0 = new THREE.Vector3(ex, 0.3, ez), e1 = new THREE.Vector3(px * 1.04, 0.55, pz * 1.04);
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([s0, mid, e0, e1]), 30, 0.07, 6);
      b.add(tube, mats.cable, F());
      b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10), mats.orange, F(px * 1.04, 0.55, pz * 1.04, 0, 0, Math.PI / 2));
    }
  }

  // survey tripod and two floodlights aimed at the gate
  {
    const tx = 5.2, tz = 7.8;
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; b.add(new THREE.CylinderGeometry(0.03, 0.04, 1.6, 5), mats.dark, F(tx + Math.cos(a) * 0.32, 0.75, tz + Math.sin(a) * 0.32, Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22)); }
    b.add(rbox(0.36, 0.26, 0.3, 0.05), mats.orange, F(tx, 1.62, tz));
    b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10), mats.dark, F(tx, 1.62, tz - 0.22, Math.PI / 2, 0, 0));
    cyl(tx, tz, 0.4, 1.8, 'prop');
    for (const [fx2, fz2] of [[7.6, -5.9], [-5.4, -7.9]]) {
      b.add(new THREE.CylinderGeometry(0.08, 0.12, 4.2, 8), mats.white, F(fx2, 2.1, fz2));
      const a = Math.atan2(-fx2, -fz2);
      b.add(rbox(0.9, 0.5, 0.25, 0.06), mats.dark, F(fx2, 4.25, fz2, -0.35, a, 0));
      b.add(new THREE.BoxGeometry(0.75, 0.36, 0.02), mats.warm, F(fx2 + Math.sin(a) * 0.14, 4.25 - 0.04, fz2 + Math.cos(a) * 0.14, -0.35, a, 0));
      cyl(fx2, fz2, 0.2, 4.4, 'prop');
    }
  }
  for (const m of b.build(scene)) if (m.material.transparent) { m.receiveShadow = false; m.castShadow = false; }

  // a survey drone circles the gate
  {
    const g = new THREE.Group(), db = new Batch();
    db.add(rbox(0.6, 0.18, 0.6, 0.06), mats.white);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) db.add(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 12), mats.dark, M(sx * 0.42, 0.12, sz * 0.42));
    db.add(new THREE.SphereGeometry(0.12, 10, 8), mats.dark, M(0, -0.14, 0.18));
    db.build(g); scene.add(g);
    const rec = { g, down: false };
    out.drone = rec;
    out.animate.push((t) => { if (rec.down) return; const a = t * 0.35; g.position.set(x + Math.cos(a) * 6.5, y + 8 + Math.sin(t * 1.3) * 0.4, z + Math.sin(a) * 6.5); g.rotation.y = -a; });
  }
  return out;
}

// ---------------------------------------------------------------- the light path only the newcomer can see
const GUIDE_FS = /* glsl */`
  uniform float uTime, uA; varying vec2 vUv;
  void main(){
    float dash = smoothstep(0.35, 0.5, fract(vUv.y * 18.0 - uTime * 1.6));
    float core = 1.0 - abs(vUv.x * 2.0 - 1.0);
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * (0.35 + 0.65 * dash) * core * uA, 1.0);
  }`;
export function makeGuide(scene, from, to, standAt) {
  const g = new THREE.Group(); g.visible = false;
  const len = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(0.07, 0.07, len, 8, 1, true); geo.translate(0, len / 2, 0);
  const un = { uTime: { value: 0 }, uA: { value: 1 } };
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const beam = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: un, vertexShader: vs, fragmentShader: GUIDE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.copy(from); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  g.add(beam);
  // where to stand: a soft golden ring on the ground behind the crystal
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40), new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.copy(standAt).add(new THREE.Vector3(0, 0.08, 0)); g.add(ring);
  scene.add(g);
  return { group: g, set(on) { g.visible = on; }, update(t) { if (!g.visible) return; un.uTime.value = t; un.uA.value = 0.75 + Math.sin(t * 3) * 0.25; ring.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08); } };
}
