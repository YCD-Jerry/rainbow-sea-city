import * as THREE from 'three';
import { rockGeo } from './nature.js';

export const EL_COLOR = { pyro: '#ff7a33', hydro: '#3fb6ff', electro: '#b77bff', dendro: '#8bd34a', phys: '#ffffff' };
export const EL_NAME = { pyro: '火', hydro: '水', electro: '雷', dendro: '草' };

const ROCKS = [];
const rock = (i) => (ROCKS[i] || (ROCKS[i] = rockGeo(10 + i)));

function slimeModel(el, size) {
  const g = new THREE.Group();
  const col = new THREE.Color(EL_COLOR[el]);
  const mat = new THREE.MeshStandardMaterial({
    color: col.clone().lerp(new THREE.Color('#ffffff'), 0.3), emissive: col, emissiveIntensity: 0.32,
    roughness: 0.16, metalness: 0, transparent: true, opacity: 0.9,
  });
  const inner = new THREE.Group(); g.add(inner);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), mat);
  body.position.y = 0.85; body.scale.set(1, 0.85, 1); body.castShadow = true; inner.add(body);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.9), transparent: true, opacity: 0.5 }));
  core.position.y = 0.8; inner.add(core);
  const eyeM = new THREE.MeshBasicMaterial({ color: '#1a1424' });
  for (const x of [-0.3, 0.3]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), eyeM);
    e.position.set(x, 1.0, 0.86); e.scale.set(0.8, 1.3, 0.5); inner.add(e);
  }
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
  hl.position.set(-0.42, 1.38, 0.5); hl.scale.set(1, 0.6, 0.6); inner.add(hl);
  const acc = new THREE.Group(); acc.position.y = 1.55; inner.add(acc);
  const am = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.1, roughness: 0.4 });
  if (el === 'pyro') {
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 10), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
    f1.position.y = 0.35; acc.add(f1);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 8), new THREE.MeshBasicMaterial({ color: '#fff1a0' }));
    f2.position.set(0.05, 0.3, 0.1); acc.add(f2);
  } else if (el === 'electro') {
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), am);
      s.position.set(Math.cos(i * 2.1) * 0.35, 0.15 + i * 0.05, Math.sin(i * 2.1) * 0.35); s.scale.set(0.6, 1.8, 0.6); acc.add(s);
    }
  } else if (el === 'dendro') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6), new THREE.MeshLambertMaterial({ color: '#4f8a2a' }));
    stem.position.y = 0.1; acc.add(stem);
    for (const s of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshLambertMaterial({ color: '#7fd23e' }));
      leaf.position.set(s * 0.26, 0.32, 0); leaf.scale.set(1.2, 0.25, 0.6); leaf.rotation.z = s * 0.4; acc.add(leaf);
    }
  } else {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), am); d.position.y = 0.12; acc.add(d);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.38, 12), am); c.position.y = 0.38; acc.add(c);
  }
  g.scale.setScalar(size);
  return { group: g, inner, mat, acc };
}

function wardenModel() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, color: '#eef5f8' });
  const glow = new THREE.MeshBasicMaterial({ color: '#7ff3ff' });
  const R = (i, sx, sy, sz, x, y, z, p = g) => { const m = new THREE.Mesh(rock(i), mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
  const body = new THREE.Group(); g.add(body);
  R(0, 1.3, 0.9, 1.0, 0, 1.75, 0, body);
  R(1, 1.9, 1.5, 1.4, 0, 3.25, 0, body);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), glow); core.position.set(0, 3.3, 1.18); body.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 8, 24), glow); ring.position.set(0, 3.3, 1.12); body.add(ring);
  const head = new THREE.Group(); head.position.set(0, 4.55, 0.2); body.add(head);
  R(2, 0.75, 0.6, 0.7, 0, 0, 0, head);
  for (const x of [-0.28, 0.28]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glow); e.position.set(x, 0.05, 0.62); head.add(e); }
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 2.0, 3.9, 0); body.add(sh);
    R(0, 0.7, 0.7, 0.7, 0, 0, 0, sh);
    R(2, 0.55, 1.0, 0.55, 0, -1.0, 0, sh);
    R(1, 0.95, 0.85, 0.95, 0, -2.25, 0.1, sh);
    arms.push(sh);
  }
  const legs = [];
  for (const s of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(s * 0.85, 1.4, 0); g.add(lg); R(2, 0.7, 0.85, 0.7, 0, -0.75, 0, lg); legs.push(lg); }
  return { group: g, body, arms, legs, core, head };
}

let NEXT = 1;
export class Enemy {
  constructor(kind, { el = null, level = 8, x, z, y, size = 1, camp = null }) {
    this.id = NEXT++;
    this.kind = kind; this.innate = el; this.level = level; this.camp = camp;
    this.isWarden = kind === 'warden';
    this.maxHp = this.isWarden ? 6800 + level * 260 : 600 + level * 70;
    this.hp = this.maxHp;
    this.atk = this.isWarden ? 0 : 120 + level * 7;
    this.res = 0.1;
    this.size = size;
    this.radius = this.isWarden ? 1.9 : 0.95 * size;
    this.height = this.isWarden ? 5.2 : 1.75 * size;
    this.pos = new THREE.Vector3(x, y, z); this.home = this.pos.clone();
    this.facing = Math.random() * Math.PI * 2;
    this.state = 'idle'; this.t = 0; this.alive = true; this.aggro = false; this.removed = false;
    this.aura = null; this.auraT = 0; this.ec = 0; this.ecTick = 0; this.applyT = 0; this.hits = 0;
    this.flash = 0; this.stagger = 0; this.stunT = 0; this.kb = new THREE.Vector3(); this.poise = 0;
    this.atkCD = 1 + Math.random(); this.chargeCD = 4; this.hop = Math.random() * 10;
    this.wander = null; this.wanderT = 1 + Math.random() * 2;
    this.lastHurt = -99; this.hpShown = this.hp;
    this.bounds = null; this.chk = Math.random() * 0.5; this.offT = 0; this.recovered = 0;
    const m = this.isWarden ? wardenModel() : slimeModel(el, size);
    this.m = m; this.root = m.group;
    this.root.position.copy(this.pos);
  }
  get center() { return new THREE.Vector3(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z); }

  hurt(heavy, fromX, fromZ, poiseDmg = 0) {
    this.flash = 0.12; this.aggro = true;
    if (this.state === 'idle' || this.state === 'return') this.state = 'chase';
    this.poise += poiseDmg;
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ, l = Math.hypot(dx, dz) || 1;
    if (!this.isWarden) {
      if (this.state !== 'leap') { this.stagger = heavy ? 0.45 : 0.22; this.kb.set(dx / l, 0, dz / l).multiplyScalar(heavy ? 7 : 3.2); if (this.state === 'windup') this.state = 'chase'; }
    } else if (heavy && this.poise > 1600) {
      this.poise = 0; this.stagger = 1.1; this.kb.set(dx / l, 0, dz / l).multiplyScalar(2.5); this.state = 'chase';
      if (this.tele) { this.tele.kill = true; this.tele = null; }
    }
  }

  // ---- staying on solid ground ----
  inBounds(x, z) { const b = this.bounds; return !b || Math.hypot(x - b.x, z - b.z) <= b.r; }
  // can this body stand at (x,z) coming from its current height? (no walls, no water, no cliff drops, inside the arena)
  canStand(x, z, W, feet = this.pos.y) {
    if (!this.inBounds(x, z) || W.water(x, z)) return false;
    const step = this.isWarden ? 1.2 : 0.8, rr = this.radius * 0.7;
    if (W.blocked(x, z, feet, step)) return false;
    // the body has width: keep its rim out of trunks, rocks and walls too (only test the side it moves towards)
    const mx = x - this.pos.x, mz = z - this.pos.z, ml = Math.hypot(mx, mz);
    if (ml > 1e-4) {
      const ux = mx / ml, uz = mz / ml;
      for (const [ax, az] of [[ux, uz], [ux * 0.7 - uz * 0.7, uz * 0.7 + ux * 0.7], [ux * 0.7 + uz * 0.7, uz * 0.7 - ux * 0.7]]) if (W.blocked(x + ax * rr, z + az * rr, feet, step)) return false;
    }
    return W.ground(x, z, feet + 1.2) > feet - 1.6;
  }
  // small corrective shove (crowding) that never pushes through walls or off ledges
  nudge(mx, mz, W) {
    const p = this.pos;
    if (this.canStand(p.x + mx, p.z + mz, W)) { p.x += mx; p.z += mz; return; }
    if (this.canStand(p.x + mx, p.z, W)) p.x += mx; else if (this.canStand(p.x, p.z + mz, W)) p.z += mz;
  }
  // a safe spot to come back to: somewhere open in the arena, or home in the world
  recover(W, why) {
    const b = this.bounds, p = this.pos;
    let x = this.home.x, z = this.home.z, y = this.home.y;
    if (b) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, r = b.r * (0.3 + Math.random() * 0.35);
        x = b.x + Math.cos(a) * r; z = b.z + Math.sin(a) * r; y = W.ground(x, z, b.y + 1.5);
        if (Math.abs(y - b.y) < 1.2 && !W.blocked(x, z, y, 0.8)) break;
      }
    } else y = W.ground(x, z, y + 2);
    p.set(x, y, z); this.kb.set(0, 0, 0); this.stagger = 0;
    if (this.state === 'leap' || this.state === 'charge') this.state = 'chase';
    if (this.tele) { this.tele.kill = true; this.tele = null; }
    this.recovered++; this.offT = 0;
    if (W.fx) { W.fx.ring(p.clone().setY(y + 0.05), this.isWarden ? 3 : 1.6, '#c39bff', 0.6, 1.2); W.fx.sparks(p.clone().setY(y + 1), '#e6d6ff', 12, 5, 0.4, 0.6, 2); }
    if (W.onRecover) W.onRecover(this, why);
  }
  // watchdog: fell through, got shoved out, stuck in water or under the floor -> bring it back
  guard(dt, W) {
    this.chk -= dt; if (this.chk > 0) return; this.chk = 0.4;
    const p = this.pos, b = this.bounds;
    if (!Number.isFinite(p.x + p.y + p.z)) { this.recover(W, 'nan'); return; }
    if (this.state === 'leap') return;
    let off = false;
    if (b) off = Math.hypot(p.x - b.x, p.z - b.z) > b.r + 0.6 || Math.abs(p.y - b.y) > 2.5;
    else {
      const g = W.ground(p.x, p.z, p.y + 1.2);
      off = p.y < g - 1 || p.y > g + 4 || W.water(p.x, p.z) || Math.hypot(p.x - this.home.x, p.z - this.home.z) > 60;
    }
    this.offT = off ? this.offT + 0.4 : 0;
    if (this.offT >= (b ? 0.4 : 1.2)) this.recover(W, 'off');
  }

  // W: { player, ground(x,z,maxY), blocked(x,z,feet,step), water(x,z), fx, hurtPlayer(e, dmg, heavy) }
  update(dt, W) {
    if (this.slowT > 0) { this.slowT -= dt; dt *= 0.6; }
    this.step(dt, W);
    if (this.alive) this.guard(dt, W);
  }
  step(dt, W) {
    const p = this.pos, P = W.player.pos;
    this.flash = Math.max(0, this.flash - dt);
    if (!this.alive) {
      this.t += dt;
      const k = Math.min(1, this.t / 0.7);
      this.root.scale.setScalar((this.isWarden ? 1 : this.size) * (1 - k * 0.6));
      this.root.position.y = p.y - k * 0.6;
      this.root.traverse((o) => { if (o.material && o.material.transparent !== undefined) { o.material.transparent = true; o.material.opacity = Math.min(o.material.opacity, 1 - k); } });
      if (k >= 1) { this.root.visible = false; this.removed = true; }
      return;
    }
    if (this.auraT > 0) { this.auraT -= dt; if (this.auraT <= 0) this.aura = null; }
    this.atkCD -= dt; this.chargeCD -= dt;
    const dx = P.x - p.x, dz = P.z - p.z, d = Math.hypot(dx, dz), dy = P.y - p.y;
    const homeD = Math.hypot(P.x - this.home.x, P.z - this.home.z);
    const toPlayer = Math.atan2(dx, dz);
    if (this.aggro && (homeD > 32 || W.player.dead)) { this.state = 'return'; this.aggro = false; if (this.tele) { this.tele.kill = true; this.tele = null; } }
    if (!this.aggro && this.state !== 'return' && !W.player.dead && d < (this.isWarden ? 15 : 12) && Math.abs(dy) < 7) { this.aggro = true; this.state = 'chase'; }

    if (this.stunT > 0) {
      this.stunT -= dt;
      if (this.tele) { this.tele.kill = true; this.tele = null; }
      if (this.state !== 'leap') { if (this.state !== 'return') this.state = 'chase'; }
      this.settle(dt, W);
      this.animate(dt, 0);
      this.root.rotation.z = Math.sin(this.stunT * 14) * 0.08;
      return;
    }
    this.root.rotation.z = 0;
    if (this.stagger > 0) {
      this.stagger -= dt;
      this.tryMove(this.kb.x * dt, this.kb.z * dt, W);
      this.kb.multiplyScalar(1 - Math.min(1, 6 * dt));
      this.settle(dt, W);
      this.animate(dt, 0);
      return;
    }
    this.t += dt;
    let moving = 0;
    if (this.isWarden) moving = this.wardenAI(dt, W, d, dx, dz, toPlayer);
    else moving = this.slimeAI(dt, W, d, dx, dz, toPlayer);
    if (this.state !== 'leap') this.settle(dt, W);
    this.animate(dt, moving);
  }

  turnTo(a, dt, rate = 8) {
    let df = a - this.facing; df = Math.atan2(Math.sin(df), Math.cos(df));
    this.facing += df * Math.min(1, rate * dt);
  }
  tryMove(mx, mz, W) {
    // long steps (a charge on a slow frame) are walked in small pieces so a body can't hop over a trunk or wall
    const n = Math.max(1, Math.ceil(Math.hypot(mx, mz) / 0.4)); let moved = false;
    for (let i = 0; i < n; i++) {
      const nx = this.pos.x + mx / n, nz = this.pos.z + mz / n;
      if (!this.canStand(nx, nz, W)) return moved;
      this.pos.x = nx; this.pos.z = nz; moved = true;
    }
    return moved;
  }
  settle(dt, W) {
    const g = W.ground(this.pos.x, this.pos.z, this.pos.y + 1.2);
    if (this.bounds && g < this.bounds.y - 1) return; // the guard brings it back instead of dropping into the void
    this.pos.y += (g - this.pos.y) * Math.min(1, dt * 12);
    if (Math.abs(g - this.pos.y) > 3) this.pos.y = g;
  }
  moveToward(tx, tz, speed, dt, W) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, l = Math.hypot(dx, dz);
    if (l < 0.05) return 0;
    const s = Math.min(l, speed * dt);
    this.turnTo(Math.atan2(dx, dz), dt, 6);
    return this.tryMove(dx / l * s, dz / l * s, W) ? 1 : 0;
  }

  slimeAI(dt, W, d, dx, dz, toPlayer) {
    const p = this.pos;
    switch (this.state) {
      case 'idle': {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 2.5 + Math.random() * 3;
          const a = Math.random() * Math.PI * 2, r = Math.random() * 5;
          this.wander = [this.home.x + Math.cos(a) * r, this.home.z + Math.sin(a) * r];
        }
        if (this.wander) return this.moveToward(this.wander[0], this.wander[1], 1.3, dt, W);
        return 0;
      }
      case 'chase': {
        if (d < 4.6 && this.atkCD <= 0) { this.state = 'windup'; this.t = 0; this.target = W.player.pos.clone(); return 0; }
        if (d < 2.2) { this.turnTo(toPlayer, dt); return 0; }
        return this.moveToward(W.player.pos.x, W.player.pos.z, 3.0, dt, W);
      }
      case 'windup': {
        this.turnTo(toPlayer, dt, 10);
        this.target.lerp(W.player.pos, Math.min(1, dt * 4));
        if (this.t > 0.7) {
          this.state = 'leap'; this.t = 0;
          this.from = p.clone();
          const tx = this.target.x - p.x, tz = this.target.z - p.z, l = Math.hypot(tx, tz) || 1;
          const reach = Math.min(l, 5.5);
          this.to = new THREE.Vector3(p.x, p.y, p.z);
          for (const f of [1, 0.75, 0.5, 0.25]) {
            const x = p.x + tx / l * reach * f, z = p.z + tz / l * reach * f, y = W.ground(x, z, p.y + 3);
            if (this.inBounds(x, z) && !W.water(x, z) && y > p.y - 1.6 && y < p.y + 2.6 && !W.blocked(x, z, y, 0.8)) { this.to.set(x, y, z); break; }
          }
        }
        return 0;
      }
      case 'leap': {
        const k = Math.min(1, this.t / 0.55);
        p.x = this.from.x + (this.to.x - this.from.x) * k;
        p.z = this.from.z + (this.to.z - this.from.z) * k;
        p.y = this.from.y + (this.to.y - this.from.y) * k + Math.sin(k * Math.PI) * 2.2;
        if (k >= 1) {
          this.state = 'recover'; this.t = 0; this.atkCD = 1.4 + Math.random() * 0.8;
          W.fx.ring(p, 2.4, EL_COLOR[this.innate], 0.4);
          const hx = W.player.pos.x - p.x, hz = W.player.pos.z - p.z;
          if (Math.hypot(hx, hz) < this.radius + 1.0 && Math.abs(W.player.pos.y - p.y) < 2.2) W.hurtPlayer(this, Math.round(this.atk * (0.9 + Math.random() * 0.2)), false);
        }
        return 0;
      }
      case 'recover': if (this.t > 0.7) { this.state = 'chase'; this.t = 0; } return 0;
      case 'return': {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.5 * dt);
        if (Math.hypot(this.home.x - p.x, this.home.z - p.z) < 1.2) { this.state = 'idle'; this.hp = this.maxHp; this.aura = null; return 0; }
        return this.moveToward(this.home.x, this.home.z, 4.2, dt, W);
      }
    }
    return 0;
  }

  wardenAI(dt, W, d, dx, dz, toPlayer) {
    const p = this.pos;
    switch (this.state) {
      case 'idle': this.turnTo(this.facing + Math.sin(this.t * 0.3) * 0.2, dt, 1); return 0;
      case 'chase': {
        if (d < 5.4 && this.atkCD <= 0) {
          this.state = 'slamWind'; this.t = 0;
          this.facing = toPlayer;
          const c = new THREE.Vector3(p.x + Math.sin(this.facing) * 2.9, p.y, p.z + Math.cos(this.facing) * 2.9);
          this.slamAt = c; this.tele = W.fx.telegraph(c, 3.7, 1.05);
          return 0;
        }
        if (d > 7.5 && d < 18 && this.chargeCD <= 0) {
          this.state = 'chargeWind'; this.t = 0; this.facing = toPlayer;
          this.tele = W.fx.telegraph(p, 1.6, 0.9, this.facing, 14);
          return 0;
        }
        if (d < 3.6) { this.turnTo(toPlayer, dt, 4); return 0; }
        return this.moveToward(W.player.pos.x, W.player.pos.z, 2.5, dt, W);
      }
      case 'slamWind': if (this.t > 1.05) {
        this.state = 'slam'; this.t = 0; this.tele = null;
        W.fx.ring(this.slamAt, 4.2, '#c9f4ff', 0.5); W.fx.sparks(this.slamAt, '#e6fbff', 14, 7, 0.6, 0.6, 4); W.fx.shake = Math.max(W.fx.shake, 0.6);
        const P = W.player.pos;
        if (Math.hypot(P.x - this.slamAt.x, P.z - this.slamAt.z) < 3.9 && Math.abs(P.y - this.slamAt.y) < 2.5) W.hurtPlayer(this, 520 + this.level * 8, true);
        this.atkCD = 2.4;
      } return 0;
      case 'slam': if (this.t > 1.2) { this.state = 'chase'; this.t = 0; } return 0;
      case 'chargeWind': if (this.t > 0.9) { this.state = 'charge'; this.t = 0; this.tele = null; this.chargeHit = false; } return 0;
      case 'charge': {
        const ok = this.tryMove(Math.sin(this.facing) * 13 * dt, Math.cos(this.facing) * 13 * dt, W);
        const P = W.player.pos;
        if (!this.chargeHit && Math.hypot(P.x - p.x, P.z - p.z) < 2.4 && Math.abs(P.y - p.y) < 3) { this.chargeHit = true; W.hurtPlayer(this, 380 + this.level * 6, true); }
        if (this.t > 1.05 || !ok) { this.state = 'slam'; this.t = 0.2; this.chargeCD = 7 + Math.random() * 3; W.fx.shake = Math.max(W.fx.shake, 0.3); }
        return 1.6;
      }
      case 'return': {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3 * dt);
        if (Math.hypot(this.home.x - p.x, this.home.z - p.z) < 1.5) { this.state = 'idle'; this.hp = this.maxHp; return 0; }
        return this.moveToward(this.home.x, this.home.z, 3.5, dt, W);
      }
    }
    return 0;
  }

  animate(dt, moving) {
    const r = this.root, m = this.m;
    r.position.copy(this.pos); r.rotation.y = this.facing;
    const flash = this.flash > 0 ? 1 : 0;
    if (!this.isWarden) {
      this.hop += dt * (moving ? 3.2 : 1.6);
      let sy = 1, sxz = 1, lift = 0;
      if (this.state === 'windup') { const k = Math.min(1, this.t / 0.7); sy = 1 - 0.35 * k; sxz = 1 + 0.2 * k; r.position.x += (Math.random() - 0.5) * 0.06 * k; }
      else if (this.state === 'leap') { sy = 1.2; sxz = 0.88; }
      else if (moving) { const h = Math.abs(Math.sin(this.hop * Math.PI)); lift = h * 0.5; sy = 0.88 + h * 0.22; sxz = 1.08 - h * 0.1; }
      else { const b = Math.sin(this.hop * 2) * 0.04; sy = 1 + b; sxz = 1 - b * 0.5; }
      m.inner.scale.set(sxz, sy, sxz);
      m.inner.position.y = lift;
      m.mat.emissiveIntensity = 0.32 + flash * 1.6 + (this.state === 'windup' ? 0.5 * Math.abs(Math.sin(this.t * 18)) : 0);
      m.acc.rotation.y += dt * 1.5;
    } else {
      const walk = moving ? Math.sin(this.t * 5.5) : 0;
      m.legs[0].rotation.x = walk * 0.5; m.legs[1].rotation.x = -walk * 0.5;
      m.body.position.y = moving ? Math.abs(walk) * 0.12 : Math.sin(this.t * 1.5) * 0.04;
      let arm = walk * 0.3;
      if (this.state === 'slamWind') arm = -2.6 * Math.min(1, this.t / 0.6);
      else if (this.state === 'slam') arm = -2.6 + Math.min(1, this.t / 0.12) * 2.9;
      else if (this.state === 'chargeWind') { arm = 0.9; m.body.rotation.x = 0.35 * Math.min(1, this.t / 0.5); }
      else if (this.state === 'charge') { arm = 1.0; m.body.rotation.x = 0.4; }
      if (this.state !== 'chargeWind' && this.state !== 'charge') m.body.rotation.x *= 0.85;
      m.arms[0].rotation.x = arm; m.arms[1].rotation.x = this.state === 'chase' || this.state === 'idle' ? -arm : arm;
      const glow = 0.6 + 0.4 * Math.sin(this.t * 3) + flash;
      m.core.scale.setScalar(0.9 + glow * 0.15);
    }
  }
}
