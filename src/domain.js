import * as THREE from 'three';

// 回廊 geometry: the entrance gate in the open world and the floating arena it leads to.

const PORTAL_VS = `varying vec2 vP; uniform vec2 uC; uniform vec2 uS; void main(){ vP = (position.xy - uC) / uS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const PORTAL_FS = `uniform float uTime; uniform float uOn; varying vec2 vP;
vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
void main(){
  float r = length(vP), a = atan(vP.y, vP.x);
  float sw = sin(a * 3.0 + r * 13.0 - uTime * 2.4) * 0.5 + 0.5;
  vec3 on = mix(hue(fract(a / 6.2831853 + uTime * 0.05 + r * 0.7)), vec3(1.0), 0.35 + 0.5 * (1.0 - smoothstep(0.0, 0.45, r)));
  on *= 0.75 + 0.45 * sw;
  vec3 off = vec3(0.22, 0.28, 0.4) + vec3(0.06, 0.08, 0.12) * sw;
  vec3 col = mix(off, on, uOn);
  gl_FragColor = vec4(col, mix(0.72, 0.9, uOn));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const stoneMat = () => new THREE.MeshStandardMaterial({ color: '#e7e2d6', roughness: 0.75 });
const goldMat = () => new THREE.MeshStandardMaterial({ color: '#e9c46a', roughness: 0.3, metalness: 0.7, emissive: '#5a3c08', emissiveIntensity: 0.3 });

function addCol(colliders, c) { return colliders ? colliders.add(c) : null; }

// a stone gate with a portal. Returns pieces + a uniform to switch it on.
function makeGate(colliders, wx, wy, wz, rotY, { width = 3.6, height = 4.4 } = {}) {
  const g = new THREE.Group(); g.position.set(wx, wy, wz); g.rotation.y = rotY;
  const stone = stoneMat(), gold = goldMat();
  const hw = width / 2;
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.75, height, 0.75), stone); p.position.set(sx * (hw + 0.37), height / 2, 0); p.castShadow = true; g.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.95), gold); cap.position.set(sx * (hw + 0.37), height + 0.05, 0); g.add(cap);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 1), gold); foot.position.set(sx * (hw + 0.37), 0.17, 0); g.add(foot);
    const cs = Math.cos(rotY), sn = Math.sin(rotY), lx = sx * (hw + 0.37);
    addCol(colliders, { type: 'cyl', x: wx + lx * cs, z: wz - lx * sn, r: 0.55, top: wy + height + 2.2, bottom: wy - 1 });
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(hw + 0.37, 0.36, 10, 40, Math.PI), stone); arch.position.y = height; arch.castShadow = true; g.add(arch);
  const archG = new THREE.Mesh(new THREE.TorusGeometry(hw + 0.37, 0.12, 6, 40, Math.PI), gold); archG.position.set(0, height, 0.33); g.add(archG);
  // portal fill: rectangle + half disc
  const sh = new THREE.Shape();
  sh.moveTo(-hw, 0.05); sh.lineTo(hw, 0.05); sh.lineTo(hw, height); sh.absarc(0, height, hw, 0, Math.PI, false); sh.lineTo(-hw, 0.05);
  const uni = { uTime: { value: 0 }, uOn: { value: 0 }, uC: { value: new THREE.Vector2(0, height * 0.62) }, uS: { value: new THREE.Vector2(hw * 1.35, (height + hw) * 0.62) } };
  const portal = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: PORTAL_VS, fragmentShader: PORTAL_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  g.add(portal);
  // floating emblem
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#9fdcff', emissiveIntensity: 0.6, roughness: 0.2 }));
  gem.scale.set(1, 1.5, 1); gem.position.y = height + hw + 1.2; g.add(gem);
  return { group: g, uni, gem };
}

// procedural floor: concentric rune bands, radial tiles, a rainbow inner ring
function floorTexture() {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), c = S / 2;
  g.fillStyle = '#ece6da'; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(150,140,120,0.45)'; g.lineWidth = 2;
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * 250, c + Math.sin(a) * 250); g.lineTo(c + Math.cos(a) * 510, c + Math.sin(a) * 510); g.stroke(); }
  for (const r of [250, 330, 420, 500]) { g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke(); }
  // rune band
  g.fillStyle = 'rgba(120,150,190,0.55)';
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2; g.save(); g.translate(c + Math.cos(a) * 375, c + Math.sin(a) * 375); g.rotate(a + Math.PI / 2);
    const k = (i * 7919) % 5; g.fillRect(-8, -14, 4, 28); if (k > 1) g.fillRect(-8, -14, 16, 4); if (k !== 2) g.fillRect(4, -4, 4, 18); if (k === 4) g.fillRect(-8, 10, 16, 4);
    g.restore();
  }
  // rainbow ring
  const cols = ['#ff7a8a', '#ffb36a', '#ffe27a', '#8cf08c', '#6fd0ff', '#7f9bff', '#c39bff'];
  cols.forEach((col, i) => { g.strokeStyle = col; g.globalAlpha = 0.75; g.lineWidth = 9; g.beginPath(); g.arc(c, c, 200 - i * 9, 0, 7); g.stroke(); });
  g.globalAlpha = 1;
  g.fillStyle = '#f6f2ea'; g.beginPath(); g.arc(c, c, 136, 0, 7); g.fill();
  g.strokeStyle = 'rgba(201,154,58,0.8)'; g.lineWidth = 6; g.beginPath(); g.arc(c, c, 136, 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function buildEntrance(scene, colliders, x, y, z, rotY) {
  const root = new THREE.Group();
  const stone = stoneMat(), gold = goldMat();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.9, 1.2, 48), stone); base.position.set(x, y - 0.1, z); base.receiveShadow = true; base.castShadow = true; root.add(base);
  const step = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.6, 0.6, 48), stone); step.position.set(x, y - 0.55, z); step.receiveShadow = true; root.add(step);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(4.42, 0.08, 6, 64), gold); trim.rotation.x = Math.PI / 2; trim.position.set(x, y + 0.5, z); root.add(trim);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.9, 64), new THREE.MeshBasicMaterial({ color: '#9fdcff', transparent: true, opacity: 0.55 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.52, z); root.add(ring);
  addCol(colliders, { type: 'cyl', x, z, r: 4.6, top: y + 0.5, bottom: y - 3 });
  // gate stands at the back of the platform, facing along rotY
  const bx = x - Math.sin(rotY) * 2.2, bz = z - Math.cos(rotY) * 2.2;
  const gate = makeGate(colliders, bx, y + 0.5, bz, rotY);
  root.add(gate.group);
  scene.add(root);
  return {
    root, uni: gate.uni, gem: gate.gem, ring,
    pos: new THREE.Vector3(x, y + 0.5, z),
    gatePos: new THREE.Vector3(bx, y + 0.5, bz),
    front: new THREE.Vector3(x + Math.sin(rotY) * 7.5, y, z + Math.cos(rotY) * 7.5), yaw: rotY,
  };
}

export const ARENA = { x: 3000, y: 70, z: 0, r: 19 };

export function buildArena(scene, colliders) {
  const A = ARENA, root = new THREE.Group();
  const stone = stoneMat(), gold = goldMat();
  const top = new THREE.Mesh(new THREE.CircleGeometry(A.r + 1, 96), new THREE.MeshStandardMaterial({ map: floorTexture(), color: '#cdc6b6', roughness: 0.85 }));
  top.rotation.x = -Math.PI / 2; top.position.set(A.x, A.y + 0.01, A.z); top.receiveShadow = true; root.add(top);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(A.r + 1, A.r - 4, 6, 72, 1, true), stone); body.position.set(A.x, A.y - 3, A.z); root.add(body);
  const under = new THREE.Mesh(new THREE.ConeGeometry(A.r - 4, 16, 40), stone); under.rotation.x = Math.PI; under.position.set(A.x, A.y - 14, A.z); root.add(under);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(A.r + 1, 0.22, 8, 96), gold); rim.rotation.x = Math.PI / 2; rim.position.set(A.x, A.y + 0.05, A.z); root.add(rim);
  // balustrade
  const post = new THREE.CylinderGeometry(0.18, 0.22, 1.1, 8);
  for (let i = 0; i < 56; i++) {
    const a = i / 56 * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.18) continue; // gap for the gate side (+z)
    const m = new THREE.Mesh(post, stone); m.position.set(A.x + Math.cos(a) * (A.r + 0.4), A.y + 0.55, A.z + Math.sin(a) * (A.r + 0.4)); root.add(m);
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(A.r + 0.4, 0.14, 6, 112), gold); rail.rotation.x = Math.PI / 2; rail.position.set(A.x, A.y + 1.15, A.z); root.add(rail);
  addCol(colliders, { type: 'cyl', x: A.x, z: A.z, r: A.r + 0.6, top: A.y, bottom: A.y - 6 });
  addCol(colliders, { type: 'ring', x: A.x, z: A.z, r0: A.r - 0.2, r1: A.r + 3, top: A.y + 60, bottom: A.y - 8, noClimb: true });
  // floating pillars with rainbow crystals
  const crystals = [];
  const cols = ['#ff7a8a', '#ffb36a', '#ffe27a', '#8cf08c', '#6fd0ff', '#c39bff'];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6, R = A.r + 6;
    const px = A.x + Math.cos(a) * R, pz = A.z + Math.sin(a) * R;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 12, 8), stone); p.position.set(px, A.y + 2, pz); root.add(p);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.4, 8), gold); cap.position.set(px, A.y + 8.2, pz); root.add(cap);
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: cols[i], emissiveIntensity: 1.1, roughness: 0.2 }));
    c.scale.set(1, 1.6, 1); c.position.set(px, A.y + 10.4, pz); root.add(c); crystals.push(c);
  }
  // ley-line stone in the centre
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.35, 1.0, 24), stone); ped.position.set(A.x, A.y + 0.5, A.z); ped.castShadow = true; root.add(ped);
  const pedG = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.07, 6, 40), gold); pedG.rotation.x = Math.PI / 2; pedG.position.set(A.x, A.y + 1.0, A.z); root.add(pedG);
  addCol(colliders, { type: 'cyl', x: A.x, z: A.z, r: 1.25, top: A.y + 1.0, bottom: A.y - 1 });
  const orbMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#7fd8ff', emissiveIntensity: 1.2, roughness: 0.15 });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), orbMat); orb.position.set(A.x, A.y + 1.9, A.z); root.add(orb);
  // reward flower (hidden until the challenge is won)
  const flower = new THREE.Group(); flower.position.set(A.x, A.y + 1.0, A.z); flower.visible = false;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.6, 8), new THREE.MeshStandardMaterial({ color: '#6fbf6a', roughness: 0.6 })); stem.position.y = 0.8; flower.add(stem);
  const petals = new THREE.Group(); petals.position.y = 1.7; flower.add(petals);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const pm = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: ['#ff7a8a', '#ffb36a', '#ffe27a', '#8cf08c', '#6fd0ff', '#7f9bff', '#c39bff'][i], emissiveIntensity: 0.9, roughness: 0.3, side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), pm); p.scale.set(0.5, 0.16, 1); p.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45); p.rotation.y = -a + Math.PI / 2; p.rotation.z = 0.35; petals.add(p);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff6c8' })); core.position.y = 1.75; flower.add(core);
  root.add(flower);
  // exit gate on the +z side, facing the centre
  const gate = makeGate(colliders, A.x, A.y, A.z + A.r + 1.2, Math.PI, { width: 3.4, height: 4.2 });
  gate.uni.uOn.value = 1;
  root.add(gate.group);
  scene.add(root);
  return {
    root, crystals, orb, orbMat, flower, petals, gateUni: gate.uni, gateGem: gate.gem,
    center: new THREE.Vector3(A.x, A.y, A.z),
    start: new THREE.Vector3(A.x, A.y, A.z + 13), startYaw: 0,
    exitPos: new THREE.Vector3(A.x, A.y, A.z + A.r + 0.2),
  };
}
