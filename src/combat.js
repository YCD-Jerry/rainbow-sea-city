import * as THREE from 'three';
import { Enemy, EL_COLOR } from './enemies.js';
import { NOISE_GLSL } from './noise.js';
import { ITEMS } from './items.js';
import { makeCrystal, makeMirror, makeMist, animateMist, makeBeam, PRISM7 } from './media.js';

const PLAYER_LV = 20;
export const PRISM = ['#ff5a5a', '#ff9f43', '#ffe14d', '#6ee07a', '#4fc3ff', '#5b7cff', '#b47cff'];
const NUM_COLOR = { phys: '#ffffff', water: '#7fd3ff', light: '#ffe08a', crystal: '#ffb347', mirror: '#bff7ee', mist: '#c9b8ff' };
let FIELD_ID = 1;
function defFactor(lvE) { return (PLAYER_LV + 100) / ((PLAYER_LV + 100) + (lvE + 100)); }

function curtainMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform float uA; varying vec2 vUv;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vec2(vUv.x * 40.0, vUv.y * 3.0 + uTime * 1.6);
        float s = fbm(vec2(p.x, p.y * 0.4));
        float streak = smoothstep(0.38, 0.85, s);
        float edge = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
        vec3 c = mix(vec3(0.25, 0.75, 1.0), vec3(0.95, 1.0, 1.0), streak);
        float a = (0.22 + streak * 0.4) * edge * uA;
        gl_FragColor = vec4(c * 1.2, a);
      }`,
  });
}
function sunMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform float uA; varying vec2 vUv;
      void main(){
        float fade = pow(1.0 - vUv.y, 1.6);
        float rays = 0.65 + 0.35 * sin(vUv.x * 62.83 + uTime * 2.0) * sin(vUv.x * 25.1 - uTime);
        gl_FragColor = vec4(vec3(1.0, 0.85, 0.45) * 1.4, fade * rays * 0.55 * uA);
      }`,
  });
}

function netMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform float uA; varying vec2 vUv;
      void main(){
        float a = abs(fract(vUv.x * 28.0) - 0.5), b = abs(fract(vUv.y * 7.0) - 0.5);
        float l = max(smoothstep(0.42, 0.5, a), smoothstep(0.42, 0.5, b));
        float pulse = 0.65 + 0.35 * sin(uTime * 3.0 + vUv.y * 8.0);
        vec3 c = mix(vec3(0.45, 0.85, 1.0), vec3(1.0), l);
        gl_FragColor = vec4(c, (0.07 + l * 0.6 * pulse) * uA);
      }`,
  });
}
function tornadoMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform float uA; varying vec2 vUv;
      void main(){
        float s = sin(vUv.x * 62.83 * 2.0 + vUv.y * 16.0 - uTime * 9.0);
        float s2 = sin(vUv.x * 62.83 * 3.0 - vUv.y * 9.0 - uTime * 6.0);
        float streak = smoothstep(0.2, 0.95, s * 0.6 + s2 * 0.4);
        float edge = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
        vec3 c = mix(vec3(0.35, 0.95, 0.8), vec3(0.95, 1.0, 1.0), streak);
        gl_FragColor = vec4(c, (0.1 + streak * 0.5) * edge * uA);
      }`,
  });
}

export class Combat {
  constructor({ scene, fx, player, barsEl, ground, enemyGround, blocked, water, colliders, onDrop, onCampClear, onEvent }) {
    Object.assign(this, { scene, fx, player, barsEl, ground, enemyGround: enemyGround || ground, blocked, water, colliders, onDrop, onCampClear, onEvent });
    this.enemies = []; this.camps = []; this.particles = []; this.breakables = []; this.arrows = []; this.fields = []; this.booms = []; this.lightTargets = []; this.labelT = {};
    this.time = 0; this.lastRainbowHeal = -9;
    this.W = { player, fx, ground: this.enemyGround, blocked, water, hurtPlayer: (e, dmg, heavy) => this.player.hurt(dmg, e.pos.x, e.pos.z, heavy), onRecover: (e, why) => { if (this.onEvent) this.onEvent('recover', { e, why }); } };
    const dot = (() => {
      const S = 64; const cv = document.createElement('canvas'); cv.width = cv.height = S;
      const g = cv.getContext('2d'); const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    this.orbTex = dot;
    this.shaftGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.9, 5); this.shaftGeo.translate(0, -0.3, 0);
    this.up = new THREE.Vector3(0, 1, 0);
  }

  // ---------- camps ----------
  addCamp(def) {
    const camp = { ...def, enemies: [], cleared: false, clearedAt: 0 };
    this.camps.push(camp);
    this.spawnCamp(camp);
    return camp;
  }
  spawnCamp(camp) {
    camp.enemies = camp.list.map((s, i) => {
      const a = (i / camp.list.length) * Math.PI * 2;
      const r = s.kind === 'warden' ? 0 : 3.5;
      const x = camp.x + (s.dx ?? Math.cos(a) * r), z = camp.z + (s.dz ?? Math.sin(a) * r);
      const e = new Enemy(s.kind, { el: s.el, level: s.level, x, z, y: this.enemyGround(x, z, 999), size: s.size || 1, camp });
      e.pos.y = this.enemyGround(x, z, e.pos.y + 60);
      e.home.copy(e.pos);
      this.scene.add(e.root);
      this.enemies.push(e);
      this.makeBar(e);
      return e;
    });
    camp.cleared = false;
  }
  makeBar(e) {
    const el = document.createElement('div');
    el.className = 'ebar' + (e.isWarden ? ' elite' : '');
    el.innerHTML = `<div class="etop"><span class="elv">Lv.${e.level}</span><span class="ereveal">显影</span><span class="estun">致盲</span></div><div class="etrack"><i class="edelay"></i><i class="efill"></i></div>`;
    el.hidden = true;
    this.barsEl.appendChild(el);
    e.bar = el; e.barFill = el.querySelector('.efill'); e.barDelay = el.querySelector('.edelay'); e.barStun = el.querySelector('.estun'); e.barReveal = el.querySelector('.ereveal');
  }

  nearestTarget(pos, dirX, dirZ, range = 7, cone = 1.9) {
    let best = null, bs = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z, d = Math.hypot(dx, dz);
      if (d > range + e.radius || Math.abs(e.pos.y - pos.y) > 6) continue;
      let ang = 0;
      if (dirX || dirZ) { const c = (dx * dirX + dz * dirZ) / (d || 1); ang = Math.acos(Math.max(-1, Math.min(1, c))); if (ang > cone) continue; }
      const score = d + ang * 2.5;
      if (score < bs) { bs = score; best = e; }
    }
    return best;
  }

  enemiesNear(pos, r) { return this.enemies.filter((e) => e.alive && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < r + e.radius && Math.abs(e.pos.y - pos.y) < 4); }

  memberFor(id) { return this.player.party.find((m) => m.def.id === id) || this.player.c; }

  // melee / area hit. desc: { x, y, z, facing, shape:'sector'|'circle', r, half, mult, element, kind, heavy, char }
  hit(desc) {
    let n = 0;
    const fx = Math.sin(desc.facing || 0), fz = Math.cos(desc.facing || 0);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - desc.x, dz = e.pos.z - desc.z, d = Math.hypot(dx, dz);
      if (d > desc.r + e.radius) continue;
      if (desc.y < e.pos.y - 2.2 || desc.y > e.pos.y + e.height + 1.5) continue;
      if (desc.shape === 'sector' && d > e.radius + 0.4) {
        const c = (dx * fx + dz * fz) / d;
        if (Math.acos(Math.max(-1, Math.min(1, c))) > desc.half) continue;
      }
      this.damage(e, desc);
      n++;
    }
    n += this.hitBreakables(desc.x, desc.y, desc.z, desc.r, desc.heavy);
    if (desc.kind === 'na' || desc.kind === 'ca' || desc.kind === 'plunge') {
      for (const f of this.fields) {
        if (f.type !== 'crystal' || f.natural || f.t >= f.dur - 0.05) continue;
        if (Math.hypot(f.x - desc.x, f.z - desc.z) < desc.r + 0.9 && Math.abs(f.y - desc.y) < 2.5) { this.shatter(f, desc.char); n++; }
      }
    }
    return n;
  }
  hitBreakables(x, y, z, r, heavy) {
    let n = 0;
    const P = this.player.pos, best = new Map();
    for (const b of this.breakables) {
      if (!b.onHit || b.broken || !b.group) continue;
      const d = Math.hypot(b.pos.x - x, b.pos.z - z);
      if (d > r + b.r || Math.abs(b.pos.y - y) > 3) continue;
      const dp = Math.hypot(b.pos.x - P.x, b.pos.z - P.z), cur = best.get(b.group);
      if (!cur || dp < cur[1]) best.set(b.group, [b, dp]);
    }
    for (const b of this.breakables) {
      if (b.group && b.onHit && !(best.get(b.group) && best.get(b.group)[0] === b)) continue;
      if (b.broken) continue;
      const d = Math.hypot(b.pos.x - x, b.pos.z - z);
      if (d > r + b.r || Math.abs(b.pos.y - y) > 3) continue;
      if (b.onHit) { const now = performance.now(); if (now - b.last < 280) continue; b.last = now; b.onHit(heavy); n++; continue; }
      b.hits += heavy ? 2 : 1;
      this.fx.sparks(b.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), '#e8f6ff', 6, 4, 0.25, 0.35, 2);
      if (b.hits >= b.need) { b.broken = true; b.onBreak(); }
      n++;
    }
    return n;
  }

  damage(e, desc) {
    const mem = this.memberFor(desc.char);
    const S = this.player.statsFor(mem);
    const el = desc.element || 'phys';
    const bonus = 1 + (el === 'water' ? S.hydroBonus : 0) + (desc.kind === 'na' || desc.kind === 'ca' || desc.kind === 'aim' ? S.naBonus : 0) + (el !== 'phys' ? S.elemBonus : 0)
      + (desc.kind === 'prism' ? S.prismBonus || 0 : 0) + (desc.kind === 'skill' || desc.kind === 'burst' || desc.kind === 'rain' ? S.sbBonus || 0 : 0);
    const crit = Math.random() < S.critRate;
    let dmg = (desc.hpMult ? S.maxHp * desc.hpMult : S.atk * desc.mult) * bonus * (crit ? 1 + S.critDmg : 1);
    if (e.revealT > 0) dmg *= 1.3;
    dmg *= defFactor(e.level) * (1 - e.res);
    dmg = Math.max(1, Math.round(dmg * (0.95 + Math.random() * 0.1)));
    this.applyHp(e, dmg);
    const c = e.center;
    const color = desc.color && desc.kind === 'prism' ? desc.color : NUM_COLOR[el] || '#ffffff';
    this.fx.number(c, dmg, { color, crit });
    this.fx.sparks(c, el === 'water' ? '#9fe3ff' : el === 'light' ? '#ffe9a8' : color, desc.heavy ? 10 : 5, desc.heavy ? 7 : 5, 0.3, 0.3, 1.5);
    e.hurt(!!desc.heavy, desc.x ?? c.x, desc.z ?? c.z, desc.poise || dmg * (desc.heavy ? 1 : 0.3));
    if (desc.stun) { e.stunT = Math.max(e.stunT || 0, desc.stun); }
    // 虹愈: Lan striking inside a light pillar raises a healing rainbow
    if (desc.char === 'lan' && this.time - this.lastRainbowHeal > 1) {
      for (const f of this.fields) {
        if (f.type !== 'sun') continue;
        if (Math.hypot(e.pos.x - f.x, e.pos.z - f.z) < f.r + e.radius && Math.abs(e.pos.y - f.y0) < 6) {
          this.lastRainbowHeal = this.time;
          const lan = this.memberFor('lan'), hk = 0.04 * lan.art.healMul * (1 + lan.art.heal);
          this.player.healAll(hk);
          this.player.events.push(['heal', Math.round(this.player.maxHp * hk)]);
          for (let i = 0; i < 7; i++) this.fx.sparks(c.clone().add(new THREE.Vector3(0, 0.8 + i * 0.15, 0)), PRISM[i], 2, 3, 0.35, 0.8, 3);
          this.fx.label(c.clone().add(new THREE.Vector3(0, 1.2, 0)), '虹愈', 'heal');
          if (this.onEvent) this.onEvent('rainbowHeal');
          break;
        }
      }
    }
    if (e.hp <= 0) this.kill(e);
  }
  applyHp(e, dmg) { e.hp -= dmg; e.lastHurt = this.time; if (e.hp < 0) e.hp = 0; }

  kill(e) {
    if (!e.alive) return;
    e.alive = false; e.t = 0; e.hp = 0;
    if (e.tele) { e.tele.kill = true; e.tele = null; }
    e.bar.hidden = true;
    const c = e.center;
    this.fx.sparks(c, e.isWarden ? '#bff7ff' : EL_COLOR[e.innate], 16, 6, 0.5, 0.6, 3);
    this.spawnParticles(c, null, e.isWarden ? 3 : 1 + (Math.random() < 0.5 ? 1 : 0), 3);
    const loot = [];
    if (e.isWarden) {
      loot.push(['coin', 520 + Math.floor(Math.random() * 120)], ['core', 1 + (Math.random() < 0.35 ? 1 : 0)], ['gel3', 1]);
      if (Math.random() < 0.45) loot.push(['skewer', 1]);
    } else {
      loot.push(['coin', 50 + Math.floor(Math.random() * 60)]);
      const r = Math.random();
      if (r < 0.06) loot.push(['gel3', 1]); else if (r < 0.32) loot.push(['gel2', 1]); else loot.push(['gel1', 1 + (Math.random() < 0.4 ? 1 : 0)]);
      if (Math.random() < 0.12) loot.push(['riceball', 1]);
    }
    if (!(e.camp && e.camp.noLoot)) this.onDrop(loot, e.pos.clone());
    if (this.onEvent) this.onEvent('kill', e);
    const camp = e.camp;
    if (camp && !camp.cleared && camp.enemies.every((x) => !x.alive)) {
      camp.cleared = true; camp.clearedAt = this.time;
      this.onCampClear(camp);
    }
  }

  spawnParticles(pos, el, count, value) {
    for (let i = 0; i < count; i++) {
      const col = el === 'water' ? '#4fc3ff' : el === 'light' ? '#ffd34d' : '#f4f8ff';
      const mat = new THREE.SpriteMaterial({ map: this.orbTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(mat); s.scale.setScalar(0.55);
      s.position.copy(pos);
      this.scene.add(s);
      const a = Math.random() * Math.PI * 2;
      this.particles.push({ s, t: 0, vel: new THREE.Vector3(Math.cos(a) * 3, 4 + Math.random() * 2, Math.sin(a) * 3), value });
    }
  }

  // ---------- fields: water curtains, light pillars, arrow rain ----------
  addCurtain(x, y0, z, r, dur) {
    const h = r > 6 ? 5 : 3.6;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 64, 1, true), curtainMat());
    mesh.position.set(x, y0 + h / 2 - 0.3, z); mesh.renderOrder = 5;
    this.scene.add(mesh);
    const f = { type: 'water', x, z, y0: y0 - 0.5, r, h: h + 0.5, t: 0, dur, mesh };
    this.fields.push(f);
    this.fx.ring(new THREE.Vector3(x, y0, z), r, '#8fe3ff', 0.6, 1.1);
    return f;
  }
  addBoxCurtain(box) { const f = { type: 'water', box, t: 0, dur: Infinity }; this.fields.push(f); return f; }
  addSun(x, y0, z, r = 3.6, dur = 6) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, 16, 40, 1, true), sunMat());
    mesh.position.set(x, y0 + 8, z); mesh.renderOrder = 5;
    this.scene.add(mesh);
    const f = { type: 'sun', x, z, y0, r, t: 0, dur, mesh };
    this.fields.push(f);
    this.fx.ring(new THREE.Vector3(x, y0, z), r, '#ffd34d', 0.7, 1.1);
    return f;
  }
  addRain(c, r, dur) {
    const f = { type: 'rain', x: c.x, z: c.z, y0: c.y, r, t: 0, dur, next: 0, ringT: 0 };
    this.fields.push(f);
    this.fx.ring(c, r, '#ffe37a', 0.8, 1.05);
    return f;
  }
  // 牵丝：丝线收紧，被标记的敌人按最大生命值受到伤害
  lifeBlast(marks, to) {
    const end = to.clone().add(new THREE.Vector3(0, 1.1, 0));
    for (const e of marks) {
      const c = e.center;
      const obj = makeBeam(c, end, '#8fe3ff', 0.1);
      this.scene.add(obj);
      this.fx.live.push({ obj, mat: obj.material, t: 0, dur: 0.45, uni: 'uT' });
      this.fx.ring(new THREE.Vector3(e.pos.x, e.pos.y + 0.1, e.pos.z), 2.2, '#8fe3ff', 0.5, 1.3);
      this.damage(e, { x: e.pos.x, y: c.y, z: e.pos.z, hpMult: 0.38, mult: 0, element: 'water', kind: 'skill', heavy: true, char: 'silk' });
    }
    return marks.length;
  }
  // ---------- 绫：千丝成幕 / 岚：卷浪龙、回旋刃 ----------
  addNet(c, r, dur) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2), netMat());
    mesh.position.set(c.x, c.y, c.z); mesh.renderOrder = 5; this.scene.add(mesh);
    const f = { type: 'net', x: c.x, z: c.z, y0: c.y, h: r, r, t: 0, dur, mesh, next: 1, char: 'silk' };
    this.fields.push(f);
    this.fx.ring(new THREE.Vector3(c.x, c.y + 0.1, c.z), r, '#9fe8ff', 0.8, 1.1);
    return f;
  }
  addTornado({ x, z, dir, char = 'gale' }) {
    const gy = this.ground(x, z, this.player.pos.y + 2);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 0.8, 9, 40, 1, true), tornadoMat());
    mesh.position.set(x, gy + 4.5, z); mesh.renderOrder = 5; this.scene.add(mesh);
    const f = { type: 'tornado', x, z, y0: gy - 0.5, h: 10, r: 3.3, t: 0, dur: 4.6, mesh, dir, hits: 0, next: 0.5, char, speed: 3.4 };
    this.fields.push(f);
    this.fx.ring(new THREE.Vector3(x, gy + 0.1, z), 4, '#9ff5df', 0.7, 1.2);
    return f;
  }
  addBoomerang({ from, dir, char = 'gale' }) {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.08, 6, 22, Math.PI * 1.25), new THREE.MeshBasicMaterial({ color: '#c9fff1' }));
    blade.rotation.x = Math.PI / 2; g.add(blade);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.orbTex, color: '#8fe9d4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(2.2); g.add(glow);
    g.position.copy(from); this.scene.add(g);
    const b = { g, start: from.clone(), end: null, dir: new THREE.Vector3(Math.sin(dir), 0, Math.cos(dir)), t: 0, out: 0.55, back: 0.6, hitOut: new Set(), hitBack: new Set(), char };
    this.booms.push(b);
    return b;
  }
  updateBooms(dt) {
    const P = this.player.pos;
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i]; b.t += dt;
      const phaseOut = b.t < b.out;
      if (phaseOut) { const k = 1 - Math.pow(1 - b.t / b.out, 2); b.g.position.copy(b.start).addScaledVector(b.dir, 11 * k); b.end = b.g.position.clone(); }
      else {
        const k = Math.min(1, (b.t - b.out) / b.back), to = new THREE.Vector3(P.x, P.y + 1.1, P.z);
        b.g.position.lerpVectors(b.end, to, k * k * (3 - 2 * k));
        if (k >= 1) { this.scene.remove(b.g); b.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); this.booms.splice(i, 1); continue; }
      }
      b.g.rotation.y += dt * 26;
      const set = phaseOut ? b.hitOut : b.hitBack, p = b.g.position;
      for (const e of this.enemies) {
        if (!e.alive || set.has(e)) continue;
        if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 1.9 + e.radius && p.y > e.pos.y - 1.5 && p.y < e.pos.y + e.height + 1.5) {
          set.add(e);
          this.damage(e, { x: p.x, y: p.y, z: p.z, mult: 1.1, element: 'wind', kind: 'skill', heavy: false, char: b.char });
        }
      }
      this.hitBreakables(p.x, p.y, p.z, 1.3, false);
      if (Math.random() < 0.6) this.fx.sparks(p.clone(), '#bdfdf0', 1, 1.5, 0.25, 0.3, 0.5);
    }
  }
  // ---------- 光媒 ----------
  addCrystal(x, y0, z, dur = 12, { natural = false, char = 'po' } = {}) {
    const mesh = makeCrystal(natural); mesh.position.set(x, y0, z); mesh.scale.setScalar(natural ? 1.25 : 0.01);
    this.scene.add(mesh);
    const f = { id: FIELD_ID++, type: 'crystal', x, y: y0 + 1.05 * (natural ? 1.25 : 1), z, y0, r: natural ? 1.15 : 0.95, t: 0, dur, mesh, natural, char };
    this.fields.push(f);
    if (!natural) { this.fx.ring(new THREE.Vector3(x, y0, z), 1.6, '#ffb347', 0.5, 1.4); this.fx.sparks(new THREE.Vector3(x, y0 + 1, z), '#ffd38a', 10, 4, 0.3, 0.5, 3); }
    return f;
  }
  addMirror(x, y0, z, nx, nz, dur = 10, char = 'ting') {
    const mesh = makeMirror(); mesh.position.set(x, y0, z); mesh.rotation.y = Math.atan2(nx, nz); mesh.scale.setScalar(0.01);
    this.scene.add(mesh);
    const n = new THREE.Vector3(nx, 0, nz).normalize();
    const f = { id: FIELD_ID++, type: 'mirror', x, y: y0 + 1.35, z, y0, n, r: 1.15, t: 0, dur, mesh, char };
    this.fields.push(f);
    this.fx.sparks(new THREE.Vector3(x, y0 + 1.3, z), '#bff7ee', 8, 3, 0.3, 0.4, 2);
    return f;
  }
  addMist(x, y0, z, r = 5, dur = 9, { natural = false, char = 'ai' } = {}) {
    const mesh = makeMist(r); mesh.position.set(x, y0, z);
    this.scene.add(mesh);
    const f = { id: FIELD_ID++, type: 'mist', x, z, y0, r, h: 4.5, t: 0, dur, mesh, natural, char };
    this.fields.push(f);
    return f;
  }
  inMist(f, p) { return p.y > f.y0 - 0.5 && p.y < f.y0 + f.h && Math.hypot(p.x - f.x, p.z - f.z) < f.r; }
  revealMist(f, char) {
    let n = 0;
    for (const e of this.enemies) if (e.alive && this.inMist(f, e.pos.clone().setY(e.pos.y + 0.5))) { e.revealT = 6; n++; }
    f.mesh.userData.lit = 1;
    const key = 'mist' + f.id;
    if (!(this.labelT[key] > this.time)) { this.labelT[key] = this.time + 1.2; this.fx.label(new THREE.Vector3(f.x, f.y0 + 2.6, f.z), '显影', 'reveal'); }
    if (f.onLit) f.onLit(char);
    if (this.onEvent) this.onEvent('reveal', { n });
  }
  shatter(f, char) {
    f.dur = Math.min(f.dur, f.t + 0.05);
    const p = new THREE.Vector3(f.x, f.y, f.z);
    this.fx.sparks(p, '#ffc861', 22, 8, 0.4, 0.6, 4); this.fx.ring(new THREE.Vector3(f.x, f.y0 + 0.05, f.z), 3.6, '#ffb347', 0.5, 1.2);
    this.fx.label(p.clone().add(new THREE.Vector3(0, 1, 0)), '碎晶', 'shatter');
    for (const e of this.enemies) {
      if (!e.alive || Math.hypot(e.pos.x - f.x, e.pos.z - f.z) > 3.6 + e.radius || Math.abs(e.pos.y - f.y0) > 3) continue;
      this.damage(e, { x: f.x, y: f.y, z: f.z, mult: 1.8, element: 'crystal', kind: 'shatter', heavy: true, char });
    }
  }
  // segment a→b against a sphere; returns the entry point or null
  segSphere(a, b, c, r) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length(); if (L < 1e-6) return null; d.divideScalar(L);
    const m = new THREE.Vector3().subVectors(a, c), bb = m.dot(d), cc = m.lengthSq() - r * r;
    if (cc > 0 && bb > 0) return null;
    const disc = bb * bb - cc; if (disc < 0) return null;
    const t = Math.max(0, -bb - Math.sqrt(disc)); if (t > L) return null;
    return a.clone().addScaledVector(d, t);
  }
  segDisc(a, b, f) {
    const c = new THREE.Vector3(f.x, f.y, f.z);
    const da = a.clone().sub(c).dot(f.n), db = b.clone().sub(c).dot(f.n);
    if (da * db > 0) return null;
    const t = da / (da - db), p = a.clone().lerp(b, t);
    return p.distanceTo(c) <= f.r ? p : null;
  }
  label(key, pos, text, cls, gap = 0.6) {
    if (this.labelT[key] > this.time) return;
    this.labelT[key] = this.time + gap; this.fx.label(pos, text, cls);
  }
  // 聚光: the arrow is gathered into one piercing beam that keeps the arrow's heading
  focus(a, f) {
    const o = new THREE.Vector3(f.x, f.y, f.z), d = a.vel.clone().normalize();
    // gentle aim assist toward a light lock the beam is roughly pointed at
    for (const lt of this.lightTargets) {
      if (lt.done || lt.need !== 'beam') continue;
      const to = new THREE.Vector3(lt.x, lt.y, lt.z).sub(o), L = to.length();
      if (L > 32) continue;
      const h1 = Math.atan2(d.x, d.z), h2 = Math.atan2(to.x, to.z); let dh = h2 - h1; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      if (Math.abs(dh) < 0.38) { d.copy(to.normalize()); break; }
    }
    f.mesh.userData.halo.material.opacity = 1;
    this.label('focus' + f.id, o.clone().add(new THREE.Vector3(0, 1, 0)), '聚光', 'focus');
    this.beam(o, d, a.mult * 2.4, a.char, 0, new Set([f]), '#ffd58a');
    if (this.onEvent) this.onEvent('focus');
  }
  // 折返: the arrow bounces off the mirror and seeks the nearest enemy
  reflect(a, f, p) {
    const d = a.vel.clone().normalize(); let n = f.n.clone(); if (d.dot(n) > 0) n.negate();
    let r = d.clone().addScaledVector(n, -2 * d.dot(n));
    const tg = this.enemies.filter((e) => e.alive && e.pos.distanceTo(p) < 28).sort((x, y) => x.pos.distanceTo(p) - y.pos.distanceTo(p))[0] || null;
    if (tg) r = tg.center.sub(p).normalize();
    const used = new Set(a.used || []); used.add(f);
    const na = this.spawnArrow({ from: p.clone().addScaledVector(r, 0.3), dir: r, speed: 80, mult: a.mult * 1.6, kind: 'reflect', color: '#bff7ee', char: a.char, target: tg, turn: 9, life: 1.6, full: a.full });
    na.used = used;
    this.fx.sparks(p, '#e8fffb', 8, 4, 0.3, 0.35, 1);
    this.label('mirror' + f.id, p.clone().add(new THREE.Vector3(0, 0.8, 0)), '折返', 'mirror', 0.4);
    if (this.onEvent) this.onEvent('reflect');
  }
  // instant light beam: damages everything along it and keeps interacting with media (depth-limited)
  beam(o, d, mult, char, depth, used, color = '#ffe9a8') {
    const L = 46, step = 0.5;
    let end = L, hit = null;
    for (const f of this.fields) {
      if (used.has(f)) continue;
      let t = null;
      if (f.type === 'crystal') { const p = this.segSphere(o, o.clone().addScaledVector(d, L), new THREE.Vector3(f.x, f.y, f.z), f.r); if (p) t = p.distanceTo(o); }
      else if (f.type === 'mirror') { const p = this.segDisc(o, o.clone().addScaledVector(d, L), f); if (p) t = p.distanceTo(o); }
      else if (f.type === 'water') { const in0 = this.inside(f, o); for (let s2 = step; s2 < L; s2 += step) { if (this.inside(f, o.clone().addScaledVector(d, s2)) !== in0) { t = s2; break; } } }
      if (t !== null && t > 0.3 && t < end) { end = t; hit = f; }
    }
    // terrain / solids stop the beam
    for (let s2 = 1; s2 < end; s2 += step) {
      const q = o.clone().addScaledVector(d, s2);
      if (this.ground(q.x, q.z, q.y + 0.2) > q.y + 0.1) { end = s2; hit = null; break; }
    }
    const to = o.clone().addScaledVector(d, end);
    // mist along the way
    for (const f of this.fields) {
      if (f.type !== 'mist' || used.has(f)) continue;
      for (let s2 = 0; s2 < end; s2 += 1) if (this.inMist(f, o.clone().addScaledVector(d, s2))) { used.add(f); this.revealMist(f, char); break; }
    }
    // enemies along the beam
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const c = e.center, rel = c.clone().sub(o), t = rel.dot(d);
      if (t < 0 || t > end) continue;
      const off = rel.addScaledVector(d, -t);
      if (Math.hypot(off.x, off.z) < e.radius + 0.5 && Math.abs(off.y) < e.height * 0.6 + 0.6) this.damage(e, { x: o.x, y: c.y, z: o.z, mult, element: 'light', kind: 'beam', heavy: true, char });
    }
    for (const lt of this.lightTargets) {
      if (lt.done) continue;
      const rel = new THREE.Vector3(lt.x, lt.y, lt.z).sub(o), t = rel.dot(d);
      if (t < 0 || t > end + lt.r) continue;
      const off = rel.addScaledVector(d, -t);
      if (Math.hypot(off.x, off.z) < lt.r && Math.abs(off.y) < (lt.h || lt.r)) lt.onLight('beam');
    }
    const fxo = { obj: makeBeam(o, to, color, depth ? 0.12 : 0.22) };
    this.scene.add(fxo.obj);
    this.fx.live.push({ obj: fxo.obj, mat: fxo.obj.material, t: 0, dur: 0.45, uni: 'uT' });
    this.fx.sparks(to, color, 5, 3, 0.3, 0.3, 1);
    if (!hit || depth >= 2) return;
    used = new Set(used); used.add(hit);
    if (hit.type === 'water') {
      this.label('prismbeam', to.clone().add(new THREE.Vector3(0, 0.8, 0)), '虹折', 'prism');
      for (let i = 0; i < 7; i++) {
        const dd = d.clone().applyAxisAngle(this.up, (i - 3) * 0.12).normalize();
        this.beam(to.clone().addScaledVector(dd, 0.2), dd, mult * 0.5, char, depth + 1, used, PRISM7[i]);
      }
      if (this.onEvent) this.onEvent('prism');
    } else if (hit.type === 'crystal') {
      this.beam(new THREE.Vector3(hit.x, hit.y, hit.z), d, mult * 1.3, char, depth + 1, used, '#ffd58a');
    } else if (hit.type === 'mirror') {
      let n = hit.n.clone(); if (d.dot(n) > 0) n.negate();
      const r = d.clone().addScaledVector(n, -2 * d.dot(n)).normalize();
      this.label('mirror' + hit.id, to.clone().add(new THREE.Vector3(0, 0.8, 0)), '折返', 'mirror', 0.4);
      this.beam(to.clone().addScaledVector(r, 0.2), r, mult * 1.3, char, depth + 1, used, '#bff7ee');
    }
  }
  inside(f, p) {
    if (f.box) { const b = f.box; return p.x > b[0] && p.x < b[1] && p.z > b[2] && p.z < b[3] && p.y > b[4] && p.y < b[5]; }
    return p.y > f.y0 && p.y < f.y0 + f.h && Math.hypot(p.x - f.x, p.z - f.z) < f.r;
  }

  // ---------- arrows ----------
  spawnArrow(o) {
    const color = new THREE.Color(o.color || '#fff4d6');
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(this.shaftGeo, new THREE.MeshBasicMaterial({ color }));
    g.add(shaft);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.orbTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(o.big ? 1.2 : o.kind === 'prism' ? 0.75 : 0.55); g.add(glow);
    g.position.copy(o.from);
    this.scene.add(g);
    const a = {
      g, pos: g.position, vel: o.dir.clone().normalize().multiplyScalar(o.speed || 70), mult: o.mult, kind: o.kind, color: o.color, char: o.char || 'yao',
      explode: o.explode || 0, sun: !!o.sun, stun: o.stun || 0, canRefract: o.canRefract !== false, target: o.target || null, turn: o.turn || 0,
      life: o.life || 1.6, t: 0, full: !!o.full, heavy: !!o.full || !!o.explode, prismIdx: o.prismIdx,
    };
    g.quaternion.setFromUnitVectors(this.up, a.vel.clone().normalize());
    this.arrows.push(a);
    return a;
  }
  refract(a, p, f = null) {
    if (f && f.bridge && a.full && this.onEvent) this.onEvent('bridge', { p: p.clone(), dir: a.vel.clone().normalize() });
    const targets = this.enemies.filter((e) => e.alive && e.pos.distanceTo(p) < 28).sort((x, y) => x.pos.distanceTo(p) - y.pos.distanceTo(p)).slice(0, 7);
    const base = a.vel.clone().normalize();
    const bonus = this.memberFor(a.char).weapon === ITEMS.bow_dawn ? 1.2 : 1;
    for (let i = 0; i < 7; i++) {
      const ang = (i - 3) * 0.17;
      const d = base.clone().applyAxisAngle(this.up, ang); d.y += 0.18; d.normalize();
      this.spawnArrow({ from: p.clone(), dir: d, speed: 34, mult: a.mult * 0.5 * bonus, kind: 'prism', color: PRISM[i], char: a.char, canRefract: false, target: targets.length ? targets[i % targets.length] : null, turn: 7, life: 2.4, prismIdx: i });
    }
    for (let i = 0; i < 7; i++) this.fx.sparks(p, PRISM[i], 2, 5, 0.4, 0.5, 2);
    this.fx.label(p.clone().add(new THREE.Vector3(0, 0.8, 0)), '虹折', 'prism');
    if (this.onEvent) this.onEvent('prism');
  }
  explodeAt(a, p) {
    const r = a.explode;
    this.fx.ring(new THREE.Vector3(p.x, this.ground(p.x, p.z, p.y + 1) + 0.05, p.z), r, a.sun ? '#ffd34d' : '#ffe9a8', 0.45, 1.2);
    this.fx.sparks(p, '#fff1b8', a.sun ? 16 : 6, a.sun ? 7 : 4, 0.4, 0.45, 3);
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) > r + e.radius || p.y < e.pos.y - 2.5 || p.y > e.pos.y + e.height + 2.5) continue;
      this.damage(e, { x: p.x, y: p.y, z: p.z, mult: a.mult, element: 'light', kind: a.kind, heavy: a.sun, char: a.char, stun: a.stun });
      n++;
    }
    n += this.hitBreakables(p.x, p.y, p.z, r, true);
    if (a.sun) {
      const gy = this.ground(p.x, p.z, p.y + 1);
      this.addSun(p.x, gy, p.z, 3.6, 6);
      if (n > 0) this.spawnParticles(p.clone().setY(gy + 1), 'light', 3, 5);
    }
    return n;
  }
  updateArrows(dt) {
    const next = new THREE.Vector3(), seg = new THREE.Vector3(), tmp = new THREE.Vector3();
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.t += dt;
      let dead = a.t > a.life;
      if (a.target && a.target.alive && a.turn) {
        const want = a.target.center.sub(a.pos).normalize().multiplyScalar(a.vel.length() + dt * 30);
        a.vel.lerp(want, Math.min(1, dt * a.turn * (0.4 + a.t * 2)));
      }
      next.copy(a.pos).addScaledVector(a.vel, dt);
      // refraction through water (curtains / waterfall)
      if (!dead && a.canRefract) {
        for (const f of this.fields) {
          if (a.used && a.used.has(f)) continue;
          if (f.type === 'water') {
            if (this.inside(f, a.pos) !== this.inside(f, next)) { this.refract(a, tmp.copy(a.pos).lerp(next, 0.5).clone(), f); dead = true; break; }
          } else if (f.type === 'crystal') {
            if (this.segSphere(a.pos, next, new THREE.Vector3(f.x, f.y, f.z), f.r)) { this.focus(a, f); dead = true; break; }
          } else if (f.type === 'mirror') {
            const hp = this.segDisc(a.pos, next, f);
            if (hp) { this.reflect(a, f, hp); dead = true; break; }
          } else if (f.type === 'mist') {
            if (!this.inMist(f, a.pos) && this.inMist(f, next)) { (a.used || (a.used = new Set())).add(f); this.revealMist(f, a.char); }
          } else if (f.type === 'tornado') {
            if (!this.inside(f, a.pos) && this.inside(f, next)) {
              (a.used || (a.used = new Set())).add(f);
              a.mult *= 1.5; a.turn = Math.max(a.turn || 0, 8);
              const tg = this.enemies.filter((e) => e.alive && e.pos.distanceTo(next) < 30).sort((x, y) => x.pos.distanceTo(next) - y.pos.distanceTo(next))[0];
              if (tg) a.target = tg;
              this.label('twist' + f.t.toFixed(1), next.clone().add(new THREE.Vector3(0, 0.8, 0)), '旋光', 'focus', 0.5);
              this.fx.sparks(next.clone(), '#bdfdf0', 8, 4, 0.3, 0.4, 1);
            }
          }
        }
      }
      // world light targets hit directly by an arrow
      if (!dead) for (const lt of this.lightTargets) {
        if (lt.done || lt.need === 'beam') continue;
        if (this.segSphere(a.pos, next, new THREE.Vector3(lt.x, lt.y, lt.z), lt.r)) { lt.onLight('arrow'); dead = true; break; }
      }
      // enemies
      if (!dead) {
        seg.subVectors(next, a.pos); const L2 = seg.lengthSq() || 1e-6;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const c = e.center;
          let t = ((c.x - a.pos.x) * seg.x + (c.y - a.pos.y) * seg.y + (c.z - a.pos.z) * seg.z) / L2; t = Math.max(0, Math.min(1, t));
          const px = a.pos.x + seg.x * t, py = a.pos.y + seg.y * t, pz = a.pos.z + seg.z * t;
          if (Math.hypot(px - e.pos.x, pz - e.pos.z) < e.radius + 0.25 && py > e.pos.y - 0.3 && py < e.pos.y + e.height + 0.3) {
            const hp = new THREE.Vector3(px, py, pz);
            if (a.explode) this.explodeAt(a, hp);
            else {
              this.damage(e, { x: a.pos.x, y: py, z: a.pos.z, mult: a.mult, element: 'light', kind: a.kind, heavy: a.heavy, char: a.char, color: a.color });
              if (a.kind !== 'prism' && this.onArrowHit) this.onArrowHit(a, e);
            }
            dead = true; break;
          }
        }
      }
      if (!dead) for (const b of this.breakables) {
        if (!b.onHit || b.broken) continue;
        if (this.segSphere(a.pos, next, tmp.set(b.pos.x, b.pos.y + (b.cy || 0.8), b.pos.z), b.r + 0.15)) { b.last = performance.now(); b.onHit(false, 'arrow'); this.fx.sparks(tmp.clone(), a.color || '#fff4d6', 5, 2, 0.2, 0.25, 1); dead = true; break; }
      }
      if (!dead && this.hitBreakables(next.x, next.y, next.z, 0.4, false) > 0) dead = true;
      // world
      if (!dead) {
        const gy = this.ground(next.x, next.z, next.y + 0.2);
        let solid = gy > next.y;
        if (!solid && this.colliders) {
          for (const c of this.colliders.near(next.x, next.z)) { const s = this.colliders.span(c, next.x, next.z, 0); if (s && next.y < s[0] && next.y > s[1]) { solid = true; break; } }
        }
        if (solid || next.y < -2) {
          if (a.explode) this.explodeAt(a, a.pos.clone());
          else if (next.y > -0.5) this.fx.sparks(a.pos, a.color || '#fff4d6', 3, 2, 0.25, 0.25, 1);
          dead = true;
        }
      }
      if (dead) {
        this.scene.remove(a.g); a.g.children.forEach((o) => o.material && o.material.dispose());
        this.arrows.splice(i, 1);
        continue;
      }
      a.pos.copy(next);
      a.g.quaternion.setFromUnitVectors(this.up, tmp.copy(a.vel).normalize());
    }
  }

  update(dt) {
    this.time += dt;
    for (const e of this.enemies) { if (!e.removed) e.update(dt, this.W); if (e.revealT > 0) e.revealT -= dt; }
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i]; if (!a.alive) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j]; if (!b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), min = a.radius + b.radius;
        if (d < min && d > 0.001 && Math.abs(a.pos.y - b.pos.y) < 1.6) { const push = (min - d) * 0.5; a.nudge(-dx / d * push, -dz / d * push, this.W); b.nudge(dx / d * push, dz / d * push, this.W); }
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.removed) { this.scene.remove(e.root); e.bar.remove(); this.enemies.splice(i, 1); }
    }
    for (const c of this.camps) {
      if (!c.noRespawn && c.cleared && this.time - c.clearedAt > 150 && c.enemies.every((e) => e.removed)) {
        const P = this.player.pos;
        if (Math.hypot(P.x - c.x, P.z - c.z) > 80) this.spawnCamp(c);
      }
    }
    this.updateBooms(dt);
    // fields
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const f = this.fields[i];
      f.t += dt;
      const fade = Math.min(1, f.t / 0.25) * Math.min(1, (f.dur - f.t) / 0.6);
      if (f.mesh && f.mesh.material && f.mesh.material.uniforms) {
        const u = f.mesh.material.uniforms;
        u.uTime.value = this.time;
        u.uA.value = fade;
      } else if (f.type === 'crystal') {
        const k = f.natural ? 1.25 : Math.min(1, f.t / 0.3) * Math.min(1, (f.dur - f.t) / 0.3);
        f.mesh.scale.setScalar(Math.max(0.01, f.natural ? 1.25 : k));
        f.mesh.rotation.y += dt * 0.4;
        const h = f.mesh.userData.halo; h.material.opacity = Math.max(0.45, h.material.opacity - dt * 1.5);
      } else if (f.type === 'mirror') {
        f.mesh.scale.setScalar(Math.max(0.01, Math.min(1, f.t / 0.25) * Math.min(1, (f.dur - f.t) / 0.3)));
        f.mesh.userData.disc.material.uniforms.uTime.value = this.time;
      } else if (f.type === 'mist') {
        animateMist(f.mesh, this.time, f.natural ? 1 : fade);
      }
      if (f.type === 'rain') {
        f.next -= dt; f.ringT -= dt;
        if (f.ringT <= 0) { f.ringT = 1; this.fx.ring(new THREE.Vector3(f.x, f.y0, f.z), f.r, '#ffe37a', 0.9, 1.0); }
        while (f.next <= 0 && f.t < f.dur) {
          f.next += 0.17;
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * f.r;
          const x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
          this.spawnArrow({ from: new THREE.Vector3(x + 1.5, f.y0 + 20, z + 1.5), dir: new THREE.Vector3(-0.075, -1, -0.075), speed: 48, mult: 0.55, kind: 'rain', explode: 1.7, color: '#ffe37a', char: 'yao', life: 1.2 });
        }
      }
      if (f.type === 'net') {
        for (const e of this.enemies) if (e.alive && Math.hypot(e.pos.x - f.x, e.pos.z - f.z) < f.r + e.radius * 0.4 && Math.abs(e.pos.y - f.y0) < 6) e.slowT = 0.3;
        f.next -= dt;
        if (f.next <= 0 && f.t < f.dur - 0.3) {
          f.next += 2;
          this.fx.ring(new THREE.Vector3(f.x, f.y0 + 0.1, f.z), f.r * 0.7, '#cfeeff', 0.55, 0.45);
          for (const e of this.enemies) {
            if (!e.alive || Math.hypot(e.pos.x - f.x, e.pos.z - f.z) > f.r + e.radius * 0.4 || Math.abs(e.pos.y - f.y0) > 6) continue;
            this.damage(e, { x: e.pos.x, y: e.pos.y + 1, z: e.pos.z, hpMult: 0.14, mult: 0, element: 'water', kind: 'burst', heavy: false, char: f.char, poise: 0 });
            const dx = f.x - e.pos.x, dz = f.z - e.pos.z, d = Math.hypot(dx, dz) || 1, step = Math.min(d, 1.4);
            if (!e.isWarden) e.nudge(dx / d * step, dz / d * step, this.W);
          }
        }
      }
      if (f.type === 'tornado') {
        const nx = f.x + Math.sin(f.dir) * f.speed * dt, nz = f.z + Math.cos(f.dir) * f.speed * dt;
        if (!this.blocked(nx, nz, f.y0 + 1.5, 0.8) && !this.water(nx, nz)) { f.x = nx; f.z = nz; }
        const gy = this.ground(f.x, f.z, f.y0 + 3); f.y0 = gy - 0.5; f.mesh.position.set(f.x, gy + 4.5, f.z);
        for (const e of this.enemies) {
          if (!e.alive || e.isWarden) continue;
          const dx = f.x - e.pos.x, dz = f.z - e.pos.z, d = Math.hypot(dx, dz);
          if (d > 7.5 + e.radius || d < 0.4 || Math.abs(e.pos.y - f.y0) > 5) continue;
          const step = Math.min(d, 5.5 * dt);
          e.nudge(dx / d * step, dz / d * step, this.W);
          e.stunT = Math.max(e.stunT || 0, 0.2);
        }
        f.next -= dt;
        if (f.next <= 0 && f.hits < 9) {
          f.next += 0.5; f.hits++;
          this.fx.sparks(new THREE.Vector3(f.x, f.y0 + 1.5, f.z), '#bdfdf0', 6, 5, 0.3, 0.5, 2);
          for (const e of this.enemies) {
            if (!e.alive || Math.hypot(e.pos.x - f.x, e.pos.z - f.z) > f.r + e.radius || Math.abs(e.pos.y - f.y0) > 6) continue;
            this.damage(e, { x: e.pos.x, y: e.pos.y + 1, z: e.pos.z, mult: 0.5, element: 'wind', kind: 'burst', heavy: false, char: f.char, poise: 0 });
          }
          this.hitBreakables(f.x, f.y0 + 1, f.z, f.r, false);
        }
      }
      if (f.t >= f.dur) {
        if (f.mesh) { this.scene.remove(f.mesh); f.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }); }
        this.fields.splice(i, 1);
      }
    }
    this.updateArrows(dt);
    const target = this.player.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.t += dt;
      if (p.t < 0.5) { p.s.position.addScaledVector(p.vel, dt); p.vel.y -= 9 * dt; p.vel.multiplyScalar(1 - 2 * dt); }
      else {
        const to = target.clone().sub(p.s.position); const d = to.length();
        const sp = 6 + (p.t - 0.5) * 30;
        p.s.position.addScaledVector(to.normalize(), Math.min(d, sp * dt));
        if (d < 0.6 || p.t > 6) {
          this.player.gainEnergy(p.value);
          this.scene.remove(p.s); p.s.material.dispose(); this.particles.splice(i, 1);
          continue;
        }
      }
      p.s.scale.setScalar(0.5 + Math.sin(p.t * 14) * 0.08);
    }
  }

  updateBars(camera, fxProject) {
    const P = this.player.pos;
    for (const e of this.enemies) {
      if (!e.alive) { if (!e.bar.hidden) e.bar.hidden = true; continue; }
      const d = Math.hypot(e.pos.x - P.x, e.pos.z - P.z);
      const show = d < 45 && (e.aggro || this.time - e.lastHurt < 5 || d < 20);
      if (!show) { if (!e.bar.hidden) e.bar.hidden = true; continue; }
      const s = fxProject(new THREE.Vector3(e.pos.x, e.pos.y + e.height + (e.isWarden ? 0.6 : 0.5), e.pos.z));
      if (!s) { e.bar.hidden = true; continue; }
      e.bar.hidden = false;
      e.bar.style.transform = `translate(${s[0].toFixed(1)}px, ${s[1].toFixed(1)}px) translate(-50%, -100%)`;
      const f = e.hp / e.maxHp;
      e.barFill.style.transform = `scaleX(${f})`;
      e.hpShown += (e.hp - e.hpShown) * 0.06;
      e.barDelay.style.transform = `scaleX(${Math.max(f, e.hpShown / e.maxHp)})`;
      const st = (e.stunT || 0) > 0;
      if (e.stunShown !== st) { e.stunShown = st; e.barStun.style.visibility = st ? 'visible' : 'hidden'; }
      const rv = (e.revealT || 0) > 0;
      if (e.revealShown !== rv) { e.revealShown = rv; e.barReveal.style.visibility = rv ? 'visible' : 'hidden'; e.bar.classList.toggle('revealed', rv); }
    }
  }
}
