import * as THREE from 'three';
import { ITEMS, RARITY_BG } from './items.js';
import { buildChestModel } from './chests.js';
import { bake } from './charmodel.js';
import { createFruitMesh, isTreeFruit, FRUIT_REGROW_SECONDS } from './fruit.js';

const CHEST = {
  common: { name: '普通的宝箱', body: '#b98a55', trim: '#d9d2c2', glow: '#ffffff' },
  exquisite: { name: '精致的宝箱', body: '#7d5a3a', trim: '#e7c46e', glow: '#ffe7a8' },
  precious: { name: '珍贵的宝箱', body: '#3e5f8a', trim: '#f0d07a', glow: '#bfe2ff' },
  luxurious: { name: '华丽的宝箱', body: '#5a3e86', trim: '#ffd77a', glow: '#ffd77a' },
};
const CHEST_LOOT = {
  common: () => [['starlight', 2], ['coin', 120 + rnd(80)], pick([['berry', 3], ['riceball', 1], ['flower', 2]]), ['gel1', 1 + rnd(2)]],
  exquisite: () => [['starlight', 5], ['coin', 260 + rnd(140)], pick([['riceball', 2], ['soup', 1], ['skewer', 1]]), ['gel2', 1 + rnd(2)], ['crystalore', 1]],
  precious: () => [['starlight', 10], ['coin', 600 + rnd(200)], ['soup', 1], ['soda', 1], ['gel3', 1]],
  luxurious: () => [['starlight', 20], ['coin', 1200 + rnd(300)], ['soup', 2], ['soda', 1], ['core', 1]],
};
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

function beamMat(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uColor; varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * (1.0 - vUv.y) * 0.55; gl_FragColor = vec4(uColor * 1.4, a); }',
  });
}

// Challenge seal: two flat rune rings (red) that counter-rotate around a sealed chest.
const SEAL_VS = 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const SEAL_FS = `uniform float uA; uniform float uN; uniform float uR0; uniform float uR1; uniform vec3 uC; varying vec3 vP;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main(){
  float r = length(vP.xy); float t = (r - uR0) / (uR1 - uR0);
  float ang = atan(vP.y, vP.x) / 6.2831853 + 0.5;
  float rim = smoothstep(0.16, 0.02, t) + smoothstep(0.84, 0.98, t);
  float cell = floor(ang * uN); vec2 f = vec2(fract(ang * uN), (t - 0.26) / 0.48);
  float g = 0.0;
  if (f.y > 0.0 && f.y < 1.0 && f.x > 0.16 && f.x < 0.84) {
    vec2 q = vec2((f.x - 0.16) / 0.68, f.y) * 3.0; vec2 gi = floor(q); vec2 gf = fract(q);
    float on = step(0.42, h(gi + cell * 7.13));
    float dir = step(0.5, h(gi.yx + cell * 3.71));
    g = on * mix(smoothstep(0.34, 0.16, abs(gf.y - 0.5)), smoothstep(0.34, 0.16, abs(gf.x - 0.5)), dir);
  }
  float dot_ = smoothstep(0.08, 0.0, abs(fract(ang * uN) - 0.0)) * step(0.3, t) * step(t, 0.7);
  float a = clamp(rim * 0.95 + g * 0.95 + dot_ * 0.6 + 0.05, 0.0, 1.0) * uA;
  vec3 col = mix(uC, vec3(1.0, 0.45, 0.32), g * 0.35);
  gl_FragColor = vec4(col * (1.0 + rim * 0.35), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function sealRing(r0, r1, n) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 1 }, uN: { value: n }, uR0: { value: r0 }, uR1: { value: r1 }, uC: { value: new THREE.Color('#ff1a14') } },
    vertexShader: SEAL_VS, fragmentShader: SEAL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 72, 1), mat); m.rotation.x = -Math.PI / 2;
  const holder = new THREE.Group(); holder.add(m); holder.userData.mat = mat;
  return holder;
}
function makeSeal() {
  const seal = new THREE.Group();
  const lower = sealRing(1.35, 1.75, 30); lower.position.y = 0.22;
  const upper = sealRing(0.95, 1.22, 20); upper.position.y = 0.9;
  // faint red glow disc under the chest
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.75, 48), new THREE.MeshBasicMaterial({ color: '#ff1a14', transparent: true, opacity: 0.07, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04;
  seal.add(lower, upper, disc);
  seal.userData = { lower, upper, disc, mats: [lower.userData.mat, upper.userData.mat] };
  return seal;
}


export class WorldItems {
  constructor(scene, { ground, save, colliders }) {
    this.scene = scene; this.ground = ground; this.save = save; this.colliders = colliders;
    this.drops = []; this.nodes = []; this.chests = []; this.crystals = []; this.time = 0;
    this.gemGeo = new THREE.OctahedronGeometry(0.2, 0);
    this.beamGeo = new THREE.CylinderGeometry(0.05, 0.12, 2.6, 8, 1, true); this.beamGeo.translate(0, 1.3, 0);
    this.rainbowMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff9ad5', emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.2 });
  }

  // ---------- dropped items ----------
  drop(id, count, pos) {
    const it = ITEMS[id]; if (!it) return;
    const g = new THREE.Group();
    const col = new THREE.Color(it.color);
    const gem = new THREE.Mesh(this.gemGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.3 }));
    gem.position.y = 0.45; g.add(gem);
    const beam = new THREE.Mesh(this.beamGeo, beamMat(RARITY_BG[it.rarity][1]));
    g.add(beam);
    const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.6;
    const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r;
    g.position.set(x, this.ground(x, z, pos.y + 2), z);
    this.scene.add(g);
    this.drops.push({ kind: 'drop', id, count, g, gem, t: 0, name: it.name, item: it });
  }

  // ---------- gathering nodes ----------
  addNode(type, x, z, opts = {}) {
    const y = opts.y ?? this.ground(x, z, 999);
    const hangingFruit = isTreeFruit(type);
    const key = opts.key ?? (hangingFruit ? `fruit:${type}:${x}:${y}:${z}` : undefined);
    if (hangingFruit) {
      const existing = this.nodes.find((n) => n.hangingFruit && n.key === key);
      if (existing) return existing;
    }
    const g = new THREE.Group(); g.position.set(x, y, z);
    const node = { kind: 'node', type, g, pos: g.position, key, regrow: 0 };
    if (hangingFruit) {
      const mesh = createFruitMesh(type);
      mesh.rotation.y = Math.sin(x * 1.7 + z * 0.8) * Math.PI;
      g.add(mesh); node.vis = mesh; node.item = type; node.n = () => 1; node.name = ITEMS[type].name;
      node.hangingFruit = true;
    } else if (type === 'berry') {
      const leaf = new THREE.MeshLambertMaterial({ color: '#5fa834' });
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), leaf); b.position.set(Math.cos(i * 2.1) * 0.35, 0.45, Math.sin(i * 2.1) * 0.35); b.scale.set(1, 0.8, 1); b.castShadow = true; g.add(b); }
      const fruit = new THREE.Group(); const fm = new THREE.MeshStandardMaterial({ color: '#ff3f6c', emissive: '#a0102c', emissiveIntensity: 0.4, roughness: 0.3 });
      for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fm); const a = i * 0.7; f.position.set(Math.cos(a) * 0.62, 0.35 + (i % 3) * 0.2, Math.sin(a) * 0.62); fruit.add(f); }
      g.add(fruit); node.vis = fruit; node.item = 'berry'; node.n = () => 2 + rnd(2); node.name = '虹莓';
    } else if (type === 'flower') {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 5), new THREE.MeshLambertMaterial({ color: '#4f9a3a' })); stem.position.y = 0.25;
      const head = new THREE.Group(); head.position.y = 0.52;
      const pm = new THREE.MeshStandardMaterial({ color: '#8fd0ff', emissive: '#3a8fe0', emissiveIntensity: 0.6, roughness: 0.4 });
      for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), pm); const a = i / 5 * Math.PI * 2; p.position.set(Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09); p.scale.set(1, 0.3, 0.6); p.rotation.y = -a; head.add(p); }
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe680' })); head.add(c);
      const vis = new THREE.Group(); vis.add(stem, head); g.add(vis); node.vis = vis; node.item = 'flower'; node.n = () => 1; node.name = '晴空花';
    } else if (type === 'shell') {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffd1df', emissive: '#ff9ab8', emissiveIntensity: 0.25, roughness: 0.3 }));
      m.scale.set(1.2, 0.5, 1); m.position.y = 0.02; m.rotation.y = Math.random() * 6;
      g.add(m); node.vis = m; node.item = 'shell'; node.n = () => 1; node.name = '海晶贝';
    } else if (type === 'ore') {
      const vis = new THREE.Group();
      const om = new THREE.MeshStandardMaterial({ color: '#e6eef5', emissive: '#6fb8d8', emissiveIntensity: 0.25, roughness: 0.25, metalness: 0.4 });
      for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), om); const a = i * 1.3; c.position.set(Math.cos(a) * 0.35, 0.3 + (i % 2) * 0.15, Math.sin(a) * 0.35); c.scale.set(0.7, 1.6 + (i % 3) * 0.3, 0.7); c.rotation.set(Math.cos(a) * 0.4, a, Math.sin(a) * 0.4); c.castShadow = true; vis.add(c); }
      g.add(vis); node.vis = vis; node.breakable = { pos: g.position, r: 0.9, hits: 0, need: 3, broken: false };
      node.breakable.onBreak = () => {
        node.vis.visible = false; node.regrow = 300;
        this.drop('ore', 2 + rnd(2), g.position);
        if (Math.random() < 0.3) this.drop('crystalore', 1, g.position);
        if (this.onChange) this.onChange();
      };
    }
    bake(g); // a bush of 12 parts becomes 2 draw calls
    this.scene.add(g);
    const saved = this.save.nodes && this.save.nodes[key];
    if (hangingFruit) {
      // The saved timestamp is authoritative: pausing or slow rendering cannot shorten the cooldown.
      const now = Date.now(), latest = now + FRUIT_REGROW_SECONDS * 1000;
      node.readyAt = Number.isSafeInteger(saved) && saved > 0 ? saved : 0;
      if (node.readyAt > latest) { node.readyAt = latest; this.save.nodes[key] = latest; }
      node.regrow = Math.max(0, (node.readyAt - now) / 1000); node.vis.visible = node.regrow === 0;
    } else if (saved && saved > Date.now()) { node.vis.visible = false; node.regrow = (saved - Date.now()) / 1000; if (node.breakable) node.breakable.broken = true; }
    this.nodes.push(node);
    return node;
  }

  // ---------- chests ----------
  // is a chest-sized spot free of tree trunks, canopies and boulders?
  spotClear(x, z, r, y0) {
    const C = this.colliders; if (!C) return true;
    for (let k = 0; k <= 8; k++) {
      const a = k / 8 * Math.PI * 2, sx = k ? x + Math.cos(a) * r : x, sz = k ? z + Math.sin(a) * r : z;
      for (const c of C.near(sx, sz)) {
        if (c.tag !== 'tree' && c.tag !== 'rock') continue;
        const s = C.span(c, sx, sz, 0.05);
        if (s && s[1] < y0 + 1.7 && s[0] > y0 - 0.1) return false;
      }
    }
    return true;
  }
  addChest(key, tier, x, z, rotY = 0, { sealed = false, y, lightLock = false, hidden = false } = {}) {
    const T = CHEST[tier];
    if (y === undefined) {
      const r0 = tier === 'luxurious' ? 1.6 : 1.0, h0 = this.ground(x, z, -1e9);
      if (!this.spotClear(x, z, r0, h0)) {
        search: for (let rr = 0.8; rr <= 6; rr += 0.8) for (let a = 0; a < Math.PI * 2; a += 0.45) {
          const nx = x + Math.cos(a) * rr, nz = z + Math.sin(a) * rr, nh = this.ground(nx, nz, -1e9);
          if (Math.abs(nh - h0) < 1.2 && nh > -0.2 && this.spotClear(nx, nz, r0, nh)) { x = nx; z = nz; break search; }
        }
      }
    }
    const gy = y ?? this.ground(x, z, this.ground(x, z, -1e9) + 1.5);
    const g = new THREE.Group(); g.position.set(x, gy, z); g.rotation.y = rotY;
    const { hinge, glow, deco, r: colR, h: colH } = buildChestModel(tier, g);
    let seal = null;
    if (sealed) {
      seal = makeSeal(); seal.rotation.y = -rotY; g.add(seal); if (tier === 'luxurious') seal.scale.setScalar(1.3);
    }
    this.scene.add(g);
    const ch = { kind: 'chest', key, tier, g, pos: g.position, hinge, glow, deco, seal, opened: false, open: 0, name: T.name };
    if (lightLock) {
      // amber crystal cage: only a focused beam of light (聚光) can break it
      const cage = new THREE.Group(); g.add(cage);
      const cm = new THREE.MeshStandardMaterial({ color: '#ffd38a', emissive: '#ff9a2a', emissiveIntensity: 0.4, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false });
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), cm); m.position.set(Math.cos(a) * 0.95, 0.5 + (i % 2) * 0.25, Math.sin(a) * 0.95); m.scale.set(0.7, 2.6, 0.7); m.rotation.set(Math.sin(a) * 0.3, a, -Math.cos(a) * 0.3); cage.add(m); }
      ch.cage = cage;
    }
    if (hidden) { ch.hidden = true; g.visible = false; }
    if (this.colliders) ch.col = this.colliders.add({ type: 'cyl', x, z, r: colR, top: gy + colH, bottom: gy - 0.6, tag: 'chest' });
    if (this.save.chests && this.save.chests[key]) { ch.opened = true; ch.open = 1; hinge.rotation.x = -1.9; if (seal) { g.remove(seal); ch.seal = null; } if (ch.cage) { g.remove(ch.cage); ch.cage = null; } ch.hidden = false; ch.gone = true; g.visible = false; if (ch.col) ch.col.off = true; }
    this.chests.push(ch);
    return ch;
  }
  unlockLight(ch) { if (!ch || !ch.cage || ch.cageT) return false; ch.cageT = 0.001; return true; }
  revealHidden(ch) { if (!ch || !ch.hidden || ch.revealT || ch.opened) return false; ch.g.visible = true; ch.revealT = 0.001; return true; }
  unseal(ch) {
    if (!ch || !ch.seal) return;
    ch.unsealT = 0.001;
  }

  // ---------- rainbow crystals ----------
  addCrystal(key, x, y, z) {
    if (this.save.crystals && this.save.crystals.includes(key)) return;
    const g = new THREE.Group(); g.position.set(x, y, z);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), this.rainbowMat); m.scale.set(1, 1.5, 1); g.add(m);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
    g.add(halo);
    this.scene.add(g);
    this.crystals.push({ key, g, m, halo, pos: g.position });
  }

  // returns interactables within reach, sorted by distance
  update(dt, P, onCrystal) {
    this.pickPlayer = P;
    this.time += dt;
    const out = [];
    const hue = (this.time * 0.15) % 1;
    this.rainbowMat.emissive.setHSL(hue, 0.85, 0.6);
    for (let i = this.crystals.length - 1; i >= 0; i--) {
      const c = this.crystals[i];
      c.m.rotation.y += dt * 1.6; c.halo.rotation.x = Math.PI / 2 + Math.sin(this.time * 1.3) * 0.3; c.halo.rotation.y += dt;
      c.g.position.y += Math.sin(this.time * 2 + i) * 0.003;
      const dx = c.pos.x - P.x, dy = c.pos.y - (P.y + 0.9), dz = c.pos.z - P.z;
      if (dx * dx + dy * dy + dz * dz < 1.7 * 1.7) { this.scene.remove(c.g); this.crystals.splice(i, 1); onCrystal(c.key, c.pos.clone()); }
    }
    for (const d of this.drops) {
      d.t += dt; d.gem.rotation.y += dt * 2; d.gem.position.y = 0.45 + Math.sin(d.t * 3) * 0.08;
      const dist = Math.hypot(d.g.position.x - P.x, d.g.position.z - P.z);
      if (dist < 2.4 && Math.abs(d.g.position.y - P.y) < 2.2) out.push({ ref: d, dist, name: d.name, count: d.count, item: d.item });
    }
    for (const n of this.nodes) {
      if (n.hangingFruit) {
        n.regrow = Math.max(0, (n.readyAt - Date.now()) / 1000); n.vis.visible = n.regrow === 0;
        if (n.regrow > 0) continue;
      } else if (n.regrow > 0) { n.regrow -= dt; if (n.regrow <= 0) { n.vis.visible = true; if (n.breakable) { n.breakable.broken = false; n.breakable.hits = 0; } } continue; }
      if (n.breakable) continue;
      const dist = Math.hypot(n.pos.x - P.x, n.pos.z - P.z);
      const dy = n.pos.y - (P.y + (n.hangingFruit ? 1.1 : 0));
      if (dist < 2.0 && Math.abs(dy) < (n.hangingFruit ? 1.9 : 2)) out.push({ ref: n, dist, name: n.name, item: ITEMS[n.item] });
    }
    for (const ch of this.chests) {
      if (ch.deco && ch.g.visible && !ch.opened) ch.deco(this.time);
      if (ch.unsealT) {
        ch.unsealT += dt; const k = Math.min(1, ch.unsealT / 1.1);
        if (ch.seal) {
          const u = ch.seal.userData, e = 1 - (1 - k) ** 2;
          u.lower.scale.setScalar(1 + e * 0.9); u.upper.scale.setScalar(1 + e * 0.5); u.upper.position.y = 0.9 + e * 1.4;
          for (const m of u.mats) m.uniforms.uA.value = 1 - k; u.disc.material.opacity = 0.07 * (1 - k);
          if (k >= 1) { ch.g.remove(ch.seal); ch.seal = null; ch.unsealT = 0; }
        }
      }
      if (ch.cage && !ch.cageT && Math.hypot(ch.pos.x - P.x, ch.pos.z - P.z) < 3 && Math.abs(ch.pos.y - P.y) < 2) out.push({ ref: ch, dist: Math.hypot(ch.pos.x - P.x, ch.pos.z - P.z), name: '琥珀光锁', item: null, chest: ch.tier, locked: 'light' });
      if (ch.cage) { ch.cage.rotation.y += dt * 0.3; if (ch.cageT) { ch.cageT += dt; ch.cage.scale.setScalar(1 + ch.cageT * 1.5); ch.cage.children.forEach((m) => { m.material.opacity = Math.max(0, 0.55 - ch.cageT); }); if (ch.cageT > 0.6) { ch.g.remove(ch.cage); ch.cage = null; } } continue; }
      if (ch.hidden) { if (ch.revealT) { ch.revealT += dt; const k = Math.min(1, ch.revealT / 0.8); ch.g.scale.setScalar(0.3 + 0.7 * k); if (k >= 1) { ch.hidden = false; ch.revealT = 0; } } continue; }
      if (ch.seal && ch.g.visible) {
        const u = ch.seal.userData, sp = ch.unsealT ? 4 : 1;
        u.lower.rotation.y += dt * 0.45 * sp; u.upper.rotation.y -= dt * 0.8 * sp;
        if (!ch.unsealT) { const p = 0.85 + Math.sin(this.time * 2.4) * 0.15; u.mats[0].uniforms.uA.value = p; u.mats[1].uniforms.uA.value = p; }
        continue;
      }
      if (ch.opened) {
        if (ch.open < 1) { ch.open = Math.min(1, ch.open + dt * 2); ch.hinge.rotation.x = -1.9 * (1 - (1 - ch.open) ** 3); ch.glow.intensity = 3 * (1 - ch.open * 0.5); }
        if (!ch.gone) { ch.fade = (ch.fade || 0) + dt; if (ch.fade > 4.4) { const k = Math.min(1, (ch.fade - 4.4) / 0.6); ch.g.scale.setScalar(Math.max(0.001, 1 - k * k * (3 - 2 * k))); if (ch.col) ch.col.off = true; if (k >= 1) { ch.gone = true; ch.g.visible = false; } } }
        continue;
      }
      const dist = Math.hypot(ch.pos.x - P.x, ch.pos.z - P.z);
      if (dist < 2.3 && Math.abs(ch.pos.y - P.y) < 2) out.push({ ref: ch, dist, name: ch.name, item: null, chest: ch.tier });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }

  // performs the interaction, returns [[id, n], ...] to add to inventory (or null)
  interact(entry) {
    const r = entry.ref;
    if (r.kind === 'drop') {
      const i = this.drops.indexOf(r); if (i < 0) return null;
      this.drops.splice(i, 1); this.scene.remove(r.g);
      return [[r.id, r.count]];
    }
    if (r.kind === 'node') {
      if (r.hangingFruit) {
        const now = Date.now(), P = this.pickPlayer;
        if (!this.nodes.includes(r) || !r.vis.visible || r.readyAt > now) return null;
        if (!P || !(Math.hypot(r.pos.x - P.x, r.pos.z - P.z) < 2.0 && Math.abs(r.pos.y - (P.y + 1.1)) < 1.9)) return null;
        r.vis.visible = false; r.regrow = FRUIT_REGROW_SECONDS; r.readyAt = now + FRUIT_REGROW_SECONDS * 1000;
        this.save.nodes = this.save.nodes || {}; this.save.nodes[r.key] = r.readyAt;
        return [[r.item, 1]];
      }
      r.vis.visible = false; r.regrow = r.type === 'shell' ? 240 : 300;
      if (r.key) { this.save.nodes = this.save.nodes || {}; this.save.nodes[r.key] = Date.now() + r.regrow * 1000; }
      return [[r.item, r.n()]];
    }
    if (r.kind === 'chest') {
      if (r.seal) return 'sealed';
      r.opened = true; r.name = '';
      this.save.chests = this.save.chests || {}; this.save.chests[r.key] = 1;
      const loot = CHEST_LOOT[r.tier]();
      if (r.extra) loot.push(...r.extra);
      return loot;
    }
    return null;
  }
}
