import * as THREE from 'three';
import { H, slope, waterSurface } from './terrain.js';
import { ITEMS } from './items.js';
import { makeCharacter } from './charmodel.js';

const STEP = 0.55;
const SWIM_Y = -1.25;
const G = 26;

// Five-hit sword string (multipliers of ATK).
export const NA = [
  { dur: 0.36, hitAt: 0.45, mult: 0.48, r: 2.7, half: 1.15, shape: 'sector', slash: 'h' },
  { dur: 0.36, hitAt: 0.45, mult: 0.46, r: 2.7, half: 1.15, shape: 'sector', slash: 'hr' },
  { dur: 0.42, hitAt: 0.45, mult: 0.59, r: 2.8, half: 0.9, shape: 'sector', slash: 'up' },
  { dur: 0.46, hitAt: 0.5, mult: 0.64, r: 3.0, half: 0.9, shape: 'sector', slash: 'down' },
  { dur: 0.62, hitAt: 0.5, mult: 0.78, r: 3.3, half: Math.PI, shape: 'circle', slash: 'spin' },
];
const SHOT = [0.42, 0.42, 0.55, 0.62];

// Five attributes: 光 is the light source; 水 / 晶 / 镜 / 雾 each create one 光媒 (a medium that transforms light).
// Bows always fire light. 潮帘 splits it, 聚晶 focuses it, 海镜 turns it back, 蜃雾 lets it reveal what hides inside.
export const CHARS = {
  lan: {
    id: 'lan', name: '澜', title: '逐浪的剑士', rarity: 4, element: '水', elKey: 'water', elColor: '#4fc3ff', kit: 'sword', baseAtk: 230, maxHp: 3200, energy: 60,
    role: '光媒 · 潮帘', skillMedium: 'curtain',
    skills: [
      ['普通攻击 · 逐浪剑', '最多五段剑击。长按进行旋身重击，消耗 20 点体力。在空中攻击会发动下劈。'],
      ['技能 · 涟刃', '向前突进斩击，造成 240% 攻击力的伤害，并在命中处立起持续 8 秒的「潮帘」。光穿过潮帘会散成七色追踪箭。冷却 8 秒。'],
      ['绝技 · 虹潮', '掀起潮浪，造成 460% 攻击力的范围伤害，立起大范围潮帘，并恢复全队 15% 生命值。之后 10 秒内普通攻击伤害提高 20%。需要 60 点能量。'],
    ],
  },
  yao: {
    id: 'yao', name: '曜', title: '追光的弓手', rarity: 4, element: '光', elKey: 'light', elColor: '#ffcf5a', kit: 'bow', baseAtk: 215, maxHp: 2800, energy: 60,
    role: '光源',
    skills: [
      ['普通攻击 · 晨弦', '最多四段连射，会自动瞄准附近的敌人。长按进入瞄准，蓄满后射出造成 130% 攻击力伤害的曜光箭。所有箭矢都是光。'],
      ['技能 · 曜光箭', '向后跃起并射出光爆箭，造成 220% 攻击力的范围伤害，使敌人致盲 1.5 秒，并在落点留下持续 6 秒的「光柱」。冷却 9 秒。'],
      ['绝技 · 日轮箭雨', '在目标区域降下持续 5 秒的光箭雨，每支箭造成 55% 攻击力的范围伤害。需要 60 点能量。'],
    ],
  },
  po: {
    id: 'po', name: '珀', title: '琥珀的守晶人', rarity: 5, element: '晶', elKey: 'crystal', elColor: '#ffb347', kit: 'sword', baseAtk: 268, maxHp: 3500, energy: 70,
    role: '光媒 · 聚晶', skillMedium: 'crystal',
    skills: [
      ['普通攻击 · 琢光', '最多五段剑击。剑击命中聚晶时会将其击碎，造成 180% 攻击力的晶属性范围伤害。'],
      ['技能 · 聚晶', '挥剑立起一块持续 12 秒的「聚晶」，造成 200% 攻击力的晶属性伤害，最多同时存在 2 块。光箭穿过聚晶会汇聚成一道贯穿光束，伤害为原来的 2.4 倍。冷却 7 秒。'],
      ['绝技 · 琥珀晶阵', '造成 420% 攻击力的范围伤害，并在周围立起 4 块聚晶，持续 10 秒。需要 70 点能量。'],
    ],
  },
  ting: {
    id: 'ting', name: '汀', title: '镜湖的射手', rarity: 4, element: '镜', elKey: 'mirror', elColor: '#9fe8e0', kit: 'bow', baseAtk: 225, maxHp: 2900, energy: 60,
    role: '光源 · 海镜', skillMedium: 'mirror',
    skills: [
      ['普通攻击 · 镜弦', '最多四段连射，长按瞄准，蓄满射出 130% 攻击力的光箭。所有箭矢都是光。'],
      ['技能 · 海镜', '在前方立起一面持续 10 秒的「海镜」，并朝镜面射出一支光箭。光打在海镜上会折返，追踪最近的敌人，伤害提高 60%。冷却 8 秒。'],
      ['绝技 · 镜海', '在目标区域周围立起 6 面海镜，持续 8 秒，并射出 6 支光箭在镜间折返。需要 60 点能量。'],
    ],
  },
  ai: {
    id: 'ai', name: '霭', title: '蜃楼的旅人', rarity: 5, element: '雾', elKey: 'mist', elColor: '#b9a6ff', kit: 'sword', baseAtk: 262, maxHp: 3300, energy: 70,
    role: '光媒 · 蜃雾', skillMedium: 'mist',
    skills: [
      ['普通攻击 · 雾刃', '最多五段剑击。长按进行旋身重击，消耗 20 点体力。'],
      ['技能 · 蜃雾', '向远处投出雾珠，落地时造成 220% 攻击力的雾属性伤害，并展开持续 9 秒的「蜃雾」。光穿过蜃雾时，雾中的敌人会「显影」6 秒：受到的伤害提高 30%。冷却 9 秒。'],
      ['绝技 · 海市', '展开大范围蜃雾，造成 240% 攻击力的范围伤害，并让周围 24 米内的所有敌人立即「显影」10 秒。需要 70 点能量。'],
    ],
  },
  silk: {
    id: 'silk', name: '绫', title: '牵丝的弓手', rarity: 5, element: '水', elKey: 'water', elColor: '#5fd0ff', kit: 'bow', baseAtk: 230, maxHp: 4300, energy: 70, skillCD: 10,
    role: '光源 · 生命值流',
    skills: [
      ['普通攻击 · 丝弦', '最多四段连射，长按瞄准，蓄满射出 130% 攻击力的光箭。所有箭矢都是光。'],
      ['技能 · 牵丝', '放出丝线，让自己高速冲刺，沿途缠住并标记敌人。轻按冲出一小段；按住最长持续 3 秒，期间可以控制方向，再按一次 E 提前结束。冲刺中不会被打断。冲刺结束时丝线收紧爆炸，对被标记的敌人造成 38% 最大生命值的水属性伤害；每个被标记的敌人为她恢复 3 点能量（最多 9 点）。冷却 10 秒，从冲刺结束时开始计算。'],
      ['绝技 · 千丝成幕', '在目标区域撑开一张持续 8 秒的丝网：网内敌人行动减缓 40%；丝网每 2 秒收紧一次，把敌人拉向中心，并造成 14% 最大生命值的伤害。需要 70 点能量。'],
    ],
  },
  feather: {
    id: 'feather', name: '翎', title: '悬空的御风者', rarity: 5, element: '风', elKey: 'wind', elColor: '#7fe6c8', kit: 'sword', baseAtk: 262, maxHp: 3300, energy: 70, skillCD: 6,
    role: '悬空 · 御风',
    skills: [
      ['普通攻击 · 羽刃', '最多五段剑击。长按进行旋身重击，消耗 20 点体力。悬停时，普通攻击变为伤害更高、范围更大的「空斩」，并且不能下劈。'],
      ['技能 · 御风', '唤来风，托着自己悬停在空中，获得 100 点飞行值。悬停会持续消耗飞行值；按住空格上升、按住 Shift 加速会额外消耗。飞行值用完，或再按一次 E，悬停结束。冷却 6 秒，从施放时开始计算。'],
      ['绝技 · 千羽坠', '风聚成羽，在周围造成 140% 攻击力的范围伤害，并落下 8 支追踪敌人的光羽，每支造成 40% 攻击力的伤害。需要 70 点能量。'],
    ],
  },
  gale: {
    id: 'gale', name: '岚', title: '逐风的剑客', rarity: 4, element: '风', elKey: 'wind', elColor: '#8fe9d4', kit: 'sword', baseAtk: 228, maxHp: 3100, energy: 60, skillCD: 7,
    role: '聚怪 · 卷浪',
    skills: [
      ['普通攻击 · 疾风剑', '最多五段剑击。长按进行旋身重击，消耗 20 点体力。在空中攻击会发动下劈。'],
      ['技能 · 回旋刃', '掷出一枚风刃，飞出去再飞回来，往返各造成 110% 攻击力的风属性伤害。冷却 7 秒。'],
      ['绝技 · 卷浪龙', '召唤一道向前移动的龙卷风，把周围的小怪和物体卷向自己，每 0.5 秒造成 50% 攻击力的风属性伤害，共 9 次。光箭穿过龙卷风会被卷成螺旋，伤害提高 50% 并追踪敌人。需要 60 点能量。'],
    ],
  },
};
export const CHAR_IDS = Object.keys(CHARS);

const lerpA = (a, b, t) => a + (b - a) * t;
const ease = (k) => k * k * (3 - 2 * k);

const EMPTY_ART = { hp: 0, atk: 0, hpPct: 0, atkPct: 0, er: 0, cr: 0, cd: 0, elem: 0, heal: 0, prism: 0, healMul: 1, sb: 0, sets: {} };
class Member {
  get maxHp() { return Math.round(this.def.maxHp * (1 + this.art.hpPct + this.cons * 0.04) + this.art.hp); }
  constructor(def) {
    this.def = def; this.art = EMPTY_ART; this.cons = 0; this.hp = def.maxHp;
    this.energy = 0; this.energyMax = def.energy || 60; this.skillCD = 0; this.burstCD = 0; this.infuse = 0; this.dead = false;
    this.weapon = def.kit === 'bow' ? ITEMS.bow_dawn : ITEMS.sword_breeze;
    this.model = makeCharacter(def.id);
    this.model.root.visible = false;
  }
}

export class Player {
  constructor(colliders, spawn, partyIds = ['lan', 'yao']) {
    this.col = colliders;
    this.roster = {};
    this.party = []; this.ci = 0;
    this.setParty(partyIds);
    this.pos = new THREE.Vector3(spawn.x, H(spawn.x, spawn.z) + 0.1, spawn.z);
    this.vel = new THREE.Vector3();
    this.mode = 'air';
    this.facing = spawn.facing || 0;
    this.phase = 0;
    this.wall = new THREE.Vector2(0, 1);
    this.gliderT = 0;
    this.airTime = 0;
    this.events = [];
    this.baseStam = 200; this.stamBonus = 0; this.stam = 200; this.stamIdle = 9; this.exhausted = false;
    this.act = null; this.combo = 0; this.comboT = 0; this.holdStart = null; this.chargedFired = false;
    this.iframes = 0; this.dashCD = 0; this.sprintOK = false; this.weaponShowT = 0; this.switchCD = 0;
    this.aiming = false; this.aimT = 0; this.aimDir = new THREE.Vector3(0, 0, 1); this.aimFacing = 0; this.aimPitch = 0;
    this.aimLock = false; this.charging = false; // R: stay in aim mode, click to shoot, hold to charge
    this.buffs = {}; this.regen = null; this.deadT = 0;
    this.onAttack = () => 0; this.onShoot = () => {}; this.onRain = () => {}; this.findTarget = () => null; this.onMirrorSkill = () => {}; this.onMirrorBurst = () => {};
    this.hover = null; this.life = null;
    this.onLifeMark = () => {}; this.onLifeBlast = () => {}; this.onNet = () => {}; this.onBoomerang = () => {}; this.onTornado = () => {}; this.onFeathers = () => {};
    this.scanEnemies = () => []; this.canHover = () => true;
    this.time = 0; this.lastDash = -9; this.lastBurst = -99; this.lastSkillHit = -99;
    this.safe = this.pos.clone(); this.safeT = 0;
  }
  member(id) { if (!this.roster[id]) this.roster[id] = new Member(CHARS[id]); return this.roster[id]; }
  // swap the active party (1-4 characters); the current character stays on the field if still in it
  setParty(ids) {
    const cur = this.party[this.ci] ? this.party[this.ci].def.id : null;
    this.party = ids.filter((id) => CHARS[id]).slice(0, 4).map((id) => this.member(id));
    if (!this.party.length) this.party = [this.member('lan')];
    let ci = this.party.findIndex((m) => m.def.id === cur);
    if (ci < 0 || this.party[ci].dead) ci = Math.max(0, this.party.findIndex((m) => !m.dead));
    this.ci = ci;
    for (const m of Object.values(this.roster)) m.model.root.visible = false;
    const c = this.party[this.ci];
    c.model.root.visible = true;
    if (this.pos) { c.model.root.position.copy(this.pos); c.model.root.rotation.y = this.facing; }
    return this.party;
  }
  // ---- active member accessors
  get c() { return this.party[this.ci]; }
  get model() { return this.c.model; }
  get kit() { return this.c.def.kit; }
  get hp() { return this.c.hp; } set hp(v) { this.c.hp = v; }
  get maxHp() { return this.c.maxHp; }
  get energy() { return this.c.energy; } set energy(v) { this.c.energy = v; }
  get energyMax() { return this.c.energyMax; }
  get skillCD() { return this.c.skillCD; } set skillCD(v) { this.c.skillCD = v; }
  get burstCD() { return this.c.burstCD; } set burstCD(v) { this.c.burstCD = v; }
  get infuse() { return this.c.infuse; } set infuse(v) { this.c.infuse = v; }
  get weapon() { return this.c.weapon; }
  get dead() { return this.party.every((m) => m.dead); }
  get maxStam() { return this.baseStam + this.stamBonus; }
  ground(x, z, maxY) { return Math.max(H(x, z), this.col.support(x, z, maxY)); }
  heightAboveGround() { return this.pos.y - this.ground(this.pos.x, this.pos.z, this.pos.y + 0.1); }

  setWeapon(item, m = this.party[0]) {
    if (!m || !item) return;
    m.weapon = item;
    if (m.def.kit === 'sword') {
      m.model.bladeMat.color.set(item.color).lerp(new THREE.Color('#ffffff'), 0.45);
      m.model.bladeMat.emissive.set(item.color);
    }
  }
  statsFor(mem) {
    const w = mem.weapon, t = this.time;
    let atkPct = 0, critRate = 0.05, critDmg = 0.5, hydroBonus = 0, naBonus = 0, elemBonus = 0;
    if (this.buffs.atk && this.buffs.atk.until > t) atkPct += this.buffs.atk.v;
    if (w.sub) { const [k, v] = w.sub; if (k === 'crit') critRate += v; else if (k === 'critDmg') critDmg += v; else if (k === 'hydro') hydroBonus += v; else if (k === 'atkPct') atkPct += v; }
    if (w === ITEMS.sword_breeze && t - this.lastDash < 2) naBonus += 0.12;
    if (w === ITEMS.sword_tide && t - this.lastSkillHit < 6) elemBonus += 0.16;
    if (w === ITEMS.sword_coral && mem.hp / mem.maxHp > 0.7) critRate += 0.08;
    if (w === ITEMS.sword_rainbow && t - this.lastBurst < 10) atkPct += 0.24;
    if (mem.infuse > 0) naBonus += 0.2;
    const A = mem.art;
    atkPct += A.atkPct + mem.cons * 0.04; critRate += A.cr; critDmg += A.cd; elemBonus += A.elem;
    return { atk: Math.round((mem.def.baseAtk + w.atk) * (1 + atkPct) + A.atk), critRate, critDmg, hydroBonus, naBonus, elemBonus, maxHp: mem.maxHp, prismBonus: A.prism, sbBonus: A.sb, er: A.er, heal: A.heal, healMul: A.healMul };
  }
  stats() { return this.statsFor(this.c); }
  useStam(a) {
    const k = this.buffs.stam && this.buffs.stam.until > this.time ? 1 - this.buffs.stam.v : 1;
    this.stam -= a * k; this.stamIdle = 0;
    if (this.stam <= 0) { this.stam = 0; this.exhausted = true; }
  }
  gainEnergy(v) {
    this.party.forEach((m, i) => {
      const was = m.energy;
      m.energy = Math.min(m.energyMax, m.energy + (i === this.ci ? v : v * 0.6) * (1 + m.art.er));
      if (i === this.ci && was < m.energyMax && m.energy >= m.energyMax) this.events.push('burstReady');
    });
  }
  heal(v) { if (this.c.dead) return; v *= 1 + this.c.art.heal; this.hp = Math.min(this.maxHp, this.hp + v); this.events.push(['heal', Math.round(v)]); }
  healAll(pct, revive = false) {
    let any = false;
    for (const m of this.party) {
      if (m.dead && !revive) continue;
      if (m.dead) { m.dead = false; m.hp = 1; }
      if (m.hp < m.maxHp) any = true;
      m.hp = Math.min(m.maxHp, m.hp + m.maxHp * pct);
    }
    return any;
  }

  switchTo(i) {
    const m = this.party[i];
    if (i === this.ci || !m) return false;
    if (m.dead) { this.events.push(['switchDead', m.def.name]); return false; }
    if (this.switchCD > 0) return false;
    if (this.mode === 'climb' || this.mode === 'glide') return false;
    if (this.act && (this.act.type === 'burst' || this.act.type === 'bburst')) return false;
    this.doSwitch(i);
    return true;
  }
  doSwitch(i) {
    const old = this.c.model;
    old.root.visible = false;
    this.ci = i;
    const nm = this.c.model;
    nm.root.visible = true;
    nm.root.position.copy(this.pos); nm.root.rotation.y = this.facing;
    nm.pose.rotation.set(0, 0, 0);
    if (this.act && this.act.type !== 'plunge') this.act = null;
    this.aiming = false; this.combo = 0; this.switchCD = 1.0; this.weaponShowT = 0; this.hover = null;
    this.events.push(['switch', i]);
  }

  hurt(dmg, fx, fz, heavy) {
    if (this.dead || this.iframes > 0) return false;
    this.hp -= dmg;
    this.events.push(['hurt', dmg]);
    const dx = this.pos.x - fx, dz = this.pos.z - fz, l = Math.hypot(dx, dz) || 1;
    if (this.mode === 'climb' || this.mode === 'glide') this.mode = 'air';
    this.aiming = false;
    if (this.act && this.act.type === 'lifeline') { /* 牵丝：冲刺中不会被打断 */ }
    else if (heavy) {
      this.vel.set(dx / l * 8, this.mode === 'swim' ? 0 : 5.5, dz / l * 8);
      if (this.mode === 'ground') { this.mode = 'air'; this.airTime = 0.2; }
      this.act = { type: 'hurt', t: 0, dur: 0.55, lock: true, vx: dx / l * 6, vz: dz / l * 6 };
    } else if (!this.act || (this.act.type !== 'burst' && this.act.type !== 'bburst')) {
      this.act = { type: 'hurt', t: 0, dur: 0.22, lock: true, vx: dx / l * 3, vz: dz / l * 3 };
    }
    this.combo = 0;
    if (this.hp <= 0) {
      this.hp = 0; this.c.dead = true;
      const next = this.party.findIndex((m) => !m.dead);
      if (next >= 0) {
        this.events.push(['memberDown', this.c.def.name]);
        this.doSwitch(next); this.switchCD = 0; this.iframes = 1.2;
      } else { this.deadT = 0; this.act = null; this.events.push('dead'); }
    }
    return true;
  }
  respawn(x, y, z) {
    for (const m of this.party) { m.dead = false; m.hp = m.maxHp; }
    this.stam = this.maxStam; this.exhausted = false; this.act = null;
    this.teleport(x, y, z);
  }
  teleport(x, y, z) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.mode = 'air'; this.act = null; this.aiming = false;
  }

  blockedAt(x, z, feet) {
    const b = this.col.blocker(x, z, feet, STEP);
    if (b) {
      const c = this.col.center(b.c);
      let dir;
      if (c) dir = new THREE.Vector2(c[0] - x, c[1] - z).normalize();
      return { dir, top: b.top, terrain: false, noClimb: !!b.c.noClimb };
    }
    const h = H(x, z);
    if (h > feet + STEP) {
      const s = slope(x, z);
      if (s.m > 1.1) return { dir: new THREE.Vector2(s.gx, s.gz).normalize(), top: h, terrain: true };
    }
    return null;
  }

  faceTarget(dirX, dirZ, range, cone) {
    const tg = this.findTarget(this.pos, dirX, dirZ, range, cone);
    if (tg) { this.facing = Math.atan2(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z); return tg; }
    if (dirX || dirZ) this.facing = Math.atan2(dirX, dirZ);
    return null;
  }

  startNA(wx, wz) {
    const chain = (this.act && this.act.type === 'na') || this.comboT > 0;
    const step = chain ? this.combo % 5 : 0;
    const D = NA[step];
    const tg = this.faceTarget(wx, wz, 6.5);
    let lunge = 2.4;
    if (tg) { const d = Math.hypot(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z) - tg.radius - 0.9; lunge = Math.max(0, Math.min(10, d / (D.dur * 0.45))); }
    this.act = { type: 'na', step, t: 0, dur: D.dur, hitAt: D.hitAt, lock: true, hit: false, queued: false, lunge, vx: 0, vz: 0 };
    this.combo = step + 1; this.comboT = 0;
    this.weaponShowT = 5;
  }
  startShot(wx, wz) {
    const chain = (this.act && this.act.type === 'shot') || this.comboT > 0;
    const step = chain ? this.combo % 4 : 0;
    const tg = this.faceTarget(wx, wz, 26, 1.2);
    this.act = { type: 'shot', step, t: 0, dur: 0.34, lock: true, fired: false, queued: false, target: tg, vx: 0, vz: 0 };
    this.combo = step + 1; this.comboT = 0; this.weaponShowT = 5;
  }
  bowOrigin() {
    const fs = Math.sin(this.facing), fc = Math.cos(this.facing);
    return new THREE.Vector3(this.pos.x + fs * 0.45, this.pos.y + 1.38, this.pos.z + fc * 0.45);
  }
  dirTo(tg, from) {
    if (tg) return new THREE.Vector3(tg.pos.x, tg.pos.y + tg.height * 0.5, tg.pos.z).sub(from).normalize();
    return new THREE.Vector3(Math.sin(this.facing), -0.03, Math.cos(this.facing)).normalize();
  }

  // R — enter / leave aim mode (bow characters, on the ground)
  toggleAim() {
    if (this.aimLock) { this.aimLock = false; this.aiming = false; this.charging = false; this.aimT = 0; return 'off'; }
    if (this.dead || this.kit !== 'bow' || this.mode !== 'ground') return false;
    const a = this.act; if (a && a.lock && !['shot', 'release', 'land', 'dash'].includes(a.type)) return false;
    this.aimLock = true; this.aiming = true; this.aimT = 0; this.charging = false; this.act = null; this.combo = 0; this.weaponShowT = 5;
    this.events.push('aimStart');
    return 'on';
  }
  // X — let go of the wall and drop
  letGo() {
    if (this.mode !== 'climb') return false;
    const w = this.wall;
    this.mode = 'air'; this.airTime = 0.35; this.climbing = false;
    this.vel.set(-w.x * 1.8, -1, -w.y * 1.8);
    this.noClimbT = 0.6;  // don't grab the same wall again on the way down
    return true;
  }

  handleActions(dt, inp, wx, wz, moving) {
    const mode = this.mode;
    let a = this.act;
    const bow = this.kit === 'bow';
    const busy = a && (a.type === 'burst' || a.type === 'bburst' || a.type === 'hurt' || a.type === 'plunge');
    if (inp.dash && mode === 'ground' && this.dashCD <= 0 && !this.exhausted && !busy) {
      const d = moving ? Math.atan2(wx, wz) : this.facing;
      this.act = { type: 'dash', t: 0, dur: 0.3, lock: true, dir: d, vx: 0, vz: 0 };
      this.facing = d; this.iframes = 0.28; this.dashCD = 0.45; this.useStam(18); this.lastDash = this.time;
      this.combo = 0; this.sprintOK = true; this.aiming = false; this.events.push('dash');
      a = this.act;
    }
    if (inp.skill && this.hover) { this.hover = null; inp.skill = false; this.events.push('hoverEnd'); }
    else if (inp.skill && a && a.type === 'lifeline') { a.end = true; inp.skill = false; }
    if (inp.skill && (mode === 'ground' || mode === 'air') && !busy) {
      const cid = this.c.def.id;
      if (cid === 'feather' && this.skillCD <= 0) {
        if (!this.canHover()) this.events.push('noFly');
        else {
          this.aiming = false; this.hover = { pts: 100, t: 0 }; this.skillCD = this.c.def.skillCD;
          if (mode === 'ground') { this.mode = 'air'; this.vel.y = 9; this.airTime = 0; } else this.vel.y = Math.max(this.vel.y, 3);
          this.act = null; this.combo = 0; this.weaponShowT = 5; this.iframes = 0.2;
          this.events.push('skill'); this.events.push('hover');
          a = null;
        }
      } else if (cid === 'silk' && this.skillCD <= 0) {
        this.aiming = false;
        this.faceTarget(wx, wz, 14, 1.0);
        this.act = { type: 'lifeline', t: 0, dur: 0.34, lock: true, dir: this.facing, speed: 22, hold: false, end: false, vx: 0, vz: 0 };
        this.life = { marks: new Set(), from: this.pos.clone(), member: this.c };
        this.iframes = 0.2; this.weaponShowT = 5; this.combo = 0;
        this.events.push('skill'); this.events.push('lifeline');
        a = this.act;
      } else if (this.skillCD <= 0) {
        this.aiming = false;
        if (bow) {
          const tg = this.faceTarget(wx, wz, 26, 1.4);
          const fs = Math.sin(this.facing), fc = Math.cos(this.facing);
          this.act = { type: 'bskill', t: 0, dur: 0.6, lock: true, fired: false, target: tg, vx: -fs * 6.5, vz: -fc * 6.5 };
          if (mode === 'ground') { this.mode = 'air'; this.vel.y = 5.5; this.airTime = 0; }
          this.skillCD = this.c.def.id === 'ting' ? 8 : 9;
        } else {
          this.faceTarget(wx, wz, 9);
          this.act = { type: 'skill', t: 0, dur: 0.62, lock: true, hit: false, dir: this.facing, vx: 0, vz: 0 };
          this.skillCD = this.c.def.skillCD || { po: 7, ai: 9 }[this.c.def.id] || 8;
        }
        this.iframes = 0.35; this.weaponShowT = 5; this.combo = 0;
        this.events.push('skill');
        a = this.act;
      } else this.events.push('skillCD');
    }
    if (inp.burst && (mode === 'ground' || mode === 'air') && !busy) {
      if (this.energy >= this.energyMax && this.burstCD <= 0) {
        this.aiming = false;
        const tg = this.faceTarget(wx, wz, bow ? 24 : 10);
        this.act = bow ? { type: 'bburst', t: 0, dur: 0.95, lock: true, fired: false, target: tg, vx: 0, vz: 0 }
          : { type: 'burst', t: 0, dur: 1.25, lock: true, hit: false, vx: 0, vz: 0 };
        this.energy = 0; this.burstCD = 15; this.iframes = 1.3; this.weaponShowT = 8; this.combo = 0;
        this.events.push('burst');
        a = this.act;
      } else this.events.push('burstNotReady');
    }
    if (inp.attack) {
      this.holdStart = this.time; this.chargedFired = false;
      if (this.hover) {
        if (!a || (a.type === 'hna' && a.t / a.dur > 0.6)) {
          this.faceTarget(wx, wz, 9);
          this.act = { type: 'hna', t: 0, dur: 0.34, lock: false, hit: false, vx: 0, vz: 0 }; this.weaponShowT = 5; a = this.act;
        }
      } else if ((mode === 'glide' || mode === 'air') && this.heightAboveGround() > 2.2 && !(a && (a.type === 'plunge' || a.type === 'bskill'))) {
        this.mode = 'air'; this.aiming = false;
        this.act = { type: 'plunge', t: 0, dur: 99, lock: true, startY: this.pos.y, vx: 0, vz: 0 };
        this.vel.set(0, -10, 0); this.weaponShowT = 5;
        a = this.act;
      } else if (mode === 'ground') {
        if (bow) {
          if (this.aimLock) { /* aimed shots are handled in the aim block below */ }
          else if (a && a.type === 'shot') { if (a.t / a.dur > 0.3) a.queued = true; }
          else if (!a || a.type === 'land' || a.type === 'dash' || a.type === 'release') { this.startShot(wx, wz); a = this.act; }
        } else if (a && a.type === 'na') { if (a.t / a.dur > 0.25) a.queued = true; }
        else if (!a || a.type === 'land' || a.type === 'dash' || (a.type === 'ca' && a.t / a.dur > 0.85)) { this.startNA(wx, wz); a = this.act; }
      }
    }
    // hold: sword -> charged spin, bow -> aim mode
    const held = inp.attackHeld && mode === 'ground' && this.holdStart !== null;
    if (this.aimLock && (!bow || !this.aiming || mode !== 'ground' || this.dead)) { this.aimLock = false; this.charging = false; this.aiming = false; this.aimT = 0; }
    if (bow && this.aimLock) {
      this.weaponShowT = 5; this.facing = this.aimFacing;
      const releasing = a && a.type === 'release';
      if (inp.attack) { if (releasing) this.aimQueued = true; else { this.charging = true; this.aimT = 0; } }
      if (this.aimQueued && !releasing) { this.aimQueued = false; this.charging = true; this.aimT = 0; }
      if (this.charging) {
        this.aimT += dt;
        if (!inp.attackHeld) {
          const full = this.aimT >= 1.0;
          this.onShoot({ from: this.bowOrigin(), dir: this.aimDir.clone(), mult: full ? 1.3 : 0.62, kind: full ? 'aim' : 'na', speed: full ? 90 : 72, full, color: full ? '#ffe37a' : '#fff4d6', char: this.c.def.id });
          this.charging = false; this.aimT = 0;
          this.act = { type: 'release', t: 0, dur: 0.22, lock: true, vx: 0, vz: 0 };
          a = this.act;
        }
      }
    } else if (bow) {
      if (held && !this.aiming && this.time - this.holdStart > 0.26 && (!a || a.type === 'shot')) {
        this.aiming = true; this.aimT = 0; this.act = null; this.combo = 0; this.weaponShowT = 5; a = null;
        this.events.push('aimStart');
      }
      if (this.aiming) {
        this.aimT += dt; this.weaponShowT = 5;
        this.facing = this.aimFacing;
        if (mode !== 'ground') this.aiming = false;
        else if (!inp.attackHeld) {
          const full = this.aimT >= 1.0;
          const from = this.bowOrigin();
          const dir = this.aimDir.clone();
          this.onShoot({ from, dir, mult: full ? 1.3 : 0.62, kind: full ? 'aim' : 'na', speed: full ? 90 : 72, full, color: full ? '#ffe37a' : '#fff4d6', char: this.c.def.id });
          this.aiming = false;
          this.act = { type: 'release', t: 0, dur: 0.26, lock: true, vx: 0, vz: 0 };
          a = this.act;
        }
      }
    } else if (held && !this.chargedFired && this.time - this.holdStart > 0.42 && (!a || a.type === 'na')) {
      this.chargedFired = true;
      if (this.stam >= 20 && !this.exhausted) {
        this.useStam(20);
        this.faceTarget(wx, wz, 6);
        this.act = { type: 'ca', t: 0, dur: 0.66, lock: true, hits: [0.22, 0.44], done: 0, vx: 0, vz: 0 };
        this.weaponShowT = 5; this.combo = 0;
        a = this.act;
      } else this.events.push('noStam');
    }
    if (!inp.attackHeld) this.holdStart = null;
    if (!a) return;
    a.t += dt;
    const fs = Math.sin(this.facing), fc = Math.cos(this.facing);
    const el = this.infuse > 0 ? 'water' : 'phys';
    const base = () => ({ x: this.pos.x + fs * 0.6, y: this.pos.y + 1, z: this.pos.z + fc * 0.6, facing: this.facing, char: this.c.def.id });
    switch (a.type) {
      case 'na': {
        const k = a.t / a.dur;
        const lunge = a.lunge * Math.max(0, 1 - k * 2.2);
        a.vx = fs * lunge; a.vz = fc * lunge;
        if (!a.hit && a.t >= a.dur * a.hitAt) {
          a.hit = true;
          const D = NA[a.step];
          this.onAttack({ ...base(), shape: D.shape, r: D.r, half: D.half, mult: D.mult, element: el, kind: 'na', heavy: a.step === 4, slash: D.slash });
        }
        if (a.t >= a.dur) { if (a.queued) this.startNA(wx, wz); else { this.act = null; this.comboT = 0.6; } }
        else if (moving && k > 0.7 && !a.queued) { this.act = null; this.comboT = 0.6; }
        break;
      }
      case 'ca': {
        a.vx = a.vz = 0;
        if (a.done < a.hits.length && a.t >= a.hits[a.done]) {
          a.done++;
          this.onAttack({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z, facing: this.facing, shape: 'circle', r: 3.4, half: Math.PI, mult: 0.62, element: el, kind: 'ca', heavy: true, slash: 'spin', char: this.c.def.id });
        }
        if (a.t >= a.dur) this.act = null;
        break;
      }
      case 'shot': {
        a.vx = a.vz = 0;
        if (!a.fired && a.t >= 0.11) {
          a.fired = true;
          if (a.target && !a.target.alive) a.target = null;
          if (a.target) this.facing = Math.atan2(a.target.pos.x - this.pos.x, a.target.pos.z - this.pos.z);
          const from = this.bowOrigin();
          this.onShoot({ from, dir: this.dirTo(a.target, from), mult: SHOT[a.step], kind: 'na', speed: 70, color: '#fff4d6', char: this.c.def.id });
        }
        if (a.t >= a.dur) { if (a.queued) this.startShot(wx, wz); else { this.act = null; this.comboT = 0.7; } }
        else if (moving && a.t / a.dur > 0.6 && !a.queued) { this.act = null; this.comboT = 0.7; }
        break;
      }
      case 'release': a.vx = a.vz = 0; if (a.t >= a.dur) this.act = null; break;
      case 'dash': a.vx = Math.sin(a.dir) * 15; a.vz = Math.cos(a.dir) * 15; if (a.t >= a.dur) this.act = null; break;
      case 'skill': {
        const sid = this.c.def.id, still = sid === 'gale' || sid === 'ai';
        const sp = !still && a.t < 0.26 ? 14 : 0; a.vx = Math.sin(a.dir) * sp; a.vz = Math.cos(a.dir) * sp;
        if (!a.hit && a.t >= 0.3) {
          a.hit = true;
          if (sid === 'gale') {
            this.onBoomerang({ from: new THREE.Vector3(this.pos.x + fs * 0.8, this.pos.y + 1.1, this.pos.z + fc * 0.8), dir: this.facing, char: sid });
            this.lastSkillHit = this.time;
          } else if (sid === 'ai') {
            const n = this.onAttack({ x: this.pos.x + fs * 7.5, y: this.pos.y + 1, z: this.pos.z + fc * 7.5, facing: this.facing, shape: 'circle', r: 4.3, half: Math.PI, mult: 2.2, element: this.c.def.elKey, kind: 'skill', heavy: true, slash: 'big', char: sid, medium: this.c.def.skillMedium });
            if (n > 0) this.lastSkillHit = this.time;
          } else {
            const n = this.onAttack({ x: this.pos.x + fs * 1.2, y: this.pos.y + 1, z: this.pos.z + fc * 1.2, facing: this.facing, shape: 'circle', r: 4.3, half: Math.PI, mult: 2.4, element: this.c.def.elKey, kind: 'skill', heavy: true, slash: 'big', char: this.c.def.id, medium: this.c.def.skillMedium });
            if (n > 0) this.lastSkillHit = this.time;
          }
        }
        if (a.t >= a.dur) this.act = null;
        break;
      }
      case 'hna': {
        if (!a.hit && a.t >= 0.14) {
          a.hit = true;
          this.onAttack({ ...base(), shape: 'sector', r: 5.2, half: 1.0, mult: 0.95, element: 'wind', kind: 'na', slash: 'h' });
        }
        if (a.t >= a.dur) this.act = null;
        break;
      }
      case 'lifeline': {
        if (!a.hold && a.t >= 0.3 && inp.skillHeld && !a.end) { a.hold = true; a.dur = 3; }
        if (a.hold && moving) {
          let dd = Math.atan2(wx, wz) - a.dir; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
          a.dir += Math.max(-4.5 * dt, Math.min(4.5 * dt, dd));
        }
        this.facing = a.dir; a.vx = Math.sin(a.dir) * a.speed; a.vz = Math.cos(a.dir) * a.speed;
        if (this.life) for (const e of this.scanEnemies(this.pos, 2.1)) if (!this.life.marks.has(e)) { this.life.marks.add(e); this.onLifeMark(e); }
        this.iframes = Math.max(this.iframes, 0.05);
        if (a.end || a.t >= a.dur) this.act = null;
        break;
      }
      case 'burst': {
        a.vx = a.vz = 0;
        if (!a.hit && a.t >= 0.72) {
          a.hit = true;
          const id = this.c.def.id;
          if (id === 'gale') {
            this.onTornado({ x: this.pos.x + fs * 2.2, z: this.pos.z + fc * 2.2, dir: this.facing, char: id });
          } else {
            this.onAttack({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z, facing: this.facing, shape: 'circle', r: id === 'ai' ? 9 : id === 'feather' ? 7 : 8.5, half: Math.PI, mult: id === 'po' ? 4.2 : id === 'ai' ? 2.4 : id === 'feather' ? 1.4 : 4.6, element: this.c.def.elKey, kind: 'burst', heavy: true, slash: 'big', char: id, medium: this.c.def.skillMedium });
            if (id === 'feather') this.onFeathers({ center: this.pos.clone(), char: id });
          }
          this.lastBurst = this.time;
          if (id === 'lan') {
            this.infuse = 10;
            this.healAll(0.15);
            this.events.push(['heal', Math.round(this.maxHp * 0.15)]);
          }
        }
        if (a.t >= a.dur) this.act = null;
        break;
      }
      case 'bskill': {
        a.vx *= 1 - Math.min(1, dt * 3); a.vz *= 1 - Math.min(1, dt * 3);
        if (!a.fired && a.t >= 0.2) {
          a.fired = true;
          if (a.target && !a.target.alive) a.target = null;
          const from = this.bowOrigin();
          let dir;
          if (a.target) dir = this.dirTo(a.target, from);
          else { const g = this.ground(this.pos.x + fs * 16, this.pos.z + fc * 16, this.pos.y + 6); dir = new THREE.Vector3(this.pos.x + fs * 16, g + 0.5, this.pos.z + fc * 16).sub(from).normalize(); }
          if (this.c.def.id === 'ting') this.onMirrorSkill({ from, dir, facing: this.facing, target: a.target });
          else this.onShoot({ from, dir, mult: 2.2, kind: 'skill', speed: 55, explode: 3.6, sun: true, stun: 1.5, color: '#ffd34d', char: this.c.def.id, big: true });
        }
        if (a.t >= a.dur) this.act = null;
        break;
      }
      case 'bburst': {
        a.vx = a.vz = 0;
        if (!a.fired && a.t >= 0.45) {
          a.fired = true;
          const tg = a.target && a.target.alive ? a.target : null;
          const c = tg ? tg.pos.clone() : new THREE.Vector3(this.pos.x + fs * 10, 0, this.pos.z + fc * 10);
          c.y = this.ground(c.x, c.z, (tg ? tg.pos.y : this.pos.y) + 4);
          if (this.c.def.id === 'ting') this.onMirrorBurst({ center: c, from: this.bowOrigin() });
          else if (this.c.def.id === 'silk') this.onNet({ center: c, r: 6.5, dur: 8 });
          else this.onRain({ center: c, r: 6.5, dur: 5 });
          this.lastBurst = this.time;
        }
        if (a.t >= a.dur) this.act = null;
        break;
      }
      case 'plunge': a.vx = a.vz = 0; break;
      case 'land': a.vx = a.vz = 0; if (a.t >= a.dur) this.act = null; break;
      case 'hurt': a.vx *= 1 - Math.min(1, dt * 5); a.vz *= 1 - Math.min(1, dt * 5); if (a.t >= a.dur) this.act = null; break;
    }
  }

  update(dt, inp, camYaw) {
    this.time += dt;
    for (const m of this.party) {
      m.skillCD = Math.max(0, m.skillCD - dt); m.burstCD = Math.max(0, m.burstCD - dt); m.infuse = Math.max(0, m.infuse - dt);
    }
    this.iframes = Math.max(0, this.iframes - dt);
    if (this.noClimbT > 0) this.noClimbT -= dt;
    this.dashCD = Math.max(0, this.dashCD - dt); this.comboT = Math.max(0, this.comboT - dt);
    this.weaponShowT = Math.max(0, this.weaponShowT - dt); this.switchCD = Math.max(0, this.switchCD - dt);
    if (this.comboT <= 0 && !(this.act && (this.act.type === 'na' || this.act.type === 'shot'))) this.combo = 0;
    if (this.regen) { this.regen.left -= dt; if (!this.c.dead) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.regen.pct * dt); if (this.regen.left <= 0) this.regen = null; }
    if (this.dead) { this.deadT += dt; this.animate(dt, false); return; }

    const p = this.pos, v = this.vel;
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let wx = fx * inp.y + rx * inp.x, wz = fz * inp.y + rz * inp.x;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const moving = wl > 0.1;

    this.stamIdle += dt;
    if (this.stamIdle > 1.2 && (this.mode === 'ground' || this.mode === 'air')) {
      this.stam = Math.min(this.maxStam, this.stam + 30 * dt);
      if (this.stam >= 30) this.exhausted = false;
    }

    this.handleActions(dt, inp, wx, wz, moving);
    if (this.life && !(this.act && this.act.type === 'lifeline')) {
      const L = this.life; this.life = null; L.member.skillCD = L.member.def.skillCD;
      this.onLifeBlast({ marks: [...L.marks].filter((e) => e.alive), from: L.from, to: this.pos.clone() });
    }
    if (!inp.sprint) this.sprintOK = false;
    const sprint = inp.sprint && moving && !this.exhausted && !this.aiming && (this.sprintOK || this.mode !== 'ground');

    if (this.mode === 'climb') {
      if (moving) this.useStam((sprint ? 20 : 9) * dt);
      if (this.exhausted) { this.mode = 'air'; this.airTime = 0.3; this.vel.set(-this.wall.x * 1.5, 0, -this.wall.y * 1.5); this.events.push('tired'); }
      else { this.climb(dt, inp, wx, wz, moving, sprint); this.animate(dt, moving); return; }
    }

    const act = this.act;
    const locked = act && act.lock;
    let target = 0, accel = 30;
    if (this.mode !== 'ground') this.waterDepth = 0;
    if (this.mode === 'ground') {
      const ws = waterSurface(p.x, p.z); this.waterDepth = ws === null ? 0 : ws - p.y;
      const wade = this.waterDepth > 0.2;
      if (sprint) this.useStam(15 * dt);
      target = (this.aiming ? 2.4 : sprint ? 10.5 : 6.2) * (wade ? 0.65 : 1); accel = 34;
    } else if (this.mode === 'air') { target = this.hover ? (sprint ? 10.5 : 6.5) : Math.max(6.2, Math.hypot(v.x, v.z)); accel = this.hover ? 14 : 7; }
    else if (this.mode === 'glide') { target = 9.5; accel = 3.2; this.useStam(4 * dt); }
    else if (this.mode === 'swim') { target = sprint ? 6.0 : 3.4; accel = 9; if (moving) this.useStam((sprint ? 14 : 7) * dt); }

    let tx = wx * target, tz = wz * target;
    if (this.mode === 'glide' && !moving) { tx = 0; tz = 0; accel = 7; }   // no direction held: hang under the wing and sink
    if (locked && this.mode !== 'swim') { tx = act.vx || 0; tz = act.vz || 0; accel = 80; }
    const k = Math.min(1, accel * dt / Math.max(0.001, Math.hypot(tx - v.x, tz - v.z)));
    v.x += (tx - v.x) * k; v.z += (tz - v.z) * k;
    if (this.mode === 'air' && !moving && !locked) { v.x *= 1 - 0.6 * dt; v.z *= 1 - 0.6 * dt; }

    if (this.mode === 'ground') {
      if (inp.jump && (!act || ['na', 'dash', 'land', 'shot', 'release'].includes(act.type))) { this.act = null; this.aiming = false; v.y = 9.2; this.mode = 'air'; this.airTime = 0; this.events.push('jump'); }
    } else if (this.mode === 'air') {
      if (this.hover) {
        const hv = this.hover; hv.t += dt;
        let cost = 20, vyT = 0;
        if (inp.jumpHeld) { vyT = 4.6; cost += 20; }
        if (sprint && moving) cost += 20;
        hv.pts -= cost * dt;
        v.y += (vyT - v.y) * Math.min(1, 9 * dt);
        if (hv.pts <= 0) { this.hover = null; this.events.push('hoverEnd'); }
      } else if (act && act.type === 'plunge') v.y = Math.max(-34, v.y - 60 * dt);
      else v.y -= G * dt;
      this.airTime += dt;
      if (inp.jump && this.airTime > 0.12 && !this.hover && !(act && (act.type === 'plunge' || act.type === 'bskill'))) {
        const below = p.y - this.ground(p.x, p.z, p.y + 0.1);
        if (below > 1.6 && !this.exhausted && this.stam > 1) { this.mode = 'glide'; this.act = null; this.events.push('glide'); }
      }
    } else if (this.mode === 'glide') {
      v.y += (-2.1 - v.y) * Math.min(1, 6 * dt);
      if (inp.jump) { this.mode = 'air'; this.airTime = 0.2; }
      if (this.exhausted) { this.mode = 'air'; this.airTime = 0.2; this.events.push('tired'); }
    } else if (this.mode === 'swim') {
      v.y = 0;
      if (this.exhausted) { this.events.push('drown'); this.exhausted = false; }
    }

    const nx = p.x + v.x * dt, nz = p.z + v.z * dt;
    const blk = this.blockedAt(nx, nz, p.y);
    if (!blk) { p.x = nx; p.z = nz; }
    else {
      const intoWall = moving && !locked && !this.aiming && (!blk.dir || (wx * blk.dir.x + wz * blk.dir.y) > 0.2);
      const canClimb = !this.hover && !this.exhausted && this.stam > 5 && !blk.noClimb && !(this.noClimbT > 0) && (blk.terrain || blk.top - p.y > 1.7);
      if (canClimb && intoWall && (this.mode !== 'swim' || blk.top > SWIM_Y + 0.5)) {
        this.mode = 'climb'; this.act = null;
        this.wall.set(blk.dir ? blk.dir.x : wx, blk.dir ? blk.dir.y : wz).normalize();
        v.set(0, 0, 0);
        this.events.push('climb');
        this.animate(dt, moving);
        return;
      }
      if (!this.blockedAt(nx, p.z, p.y)) p.x = nx; else v.x = 0;
      if (!this.blockedAt(p.x, nz, p.y)) p.z = nz; else v.z = 0;
    }

    const vyBefore = v.y;
    if (this.mode === 'air' || this.mode === 'glide') p.y += v.y * dt;
    // ceiling: don't rise into the underside of platforms
    if (v.y > 0) {
      const ceil = this.col.blocker(p.x, p.z, p.y, STEP);
      if (ceil && ceil.c && this.col.span(ceil.c, p.x, p.z, 0.25)) { const s = this.col.span(ceil.c, p.x, p.z, 0.25); if (s[1] > p.y - v.y * dt + 1.0) { p.y = Math.min(p.y, s[1] - 1.75); v.y = 0; } }
    }
    const sup = this.ground(p.x, p.z, Math.max(p.y, p.y - v.y * dt) + STEP);
    if (this.mode === 'swim') {
      if (sup > SWIM_Y + 0.05) { this.mode = 'ground'; p.y = sup; }
      else p.y = SWIM_Y;
    } else if (p.y <= sup) {
      const plunging = act && act.type === 'plunge';
      if (plunging) {
        const fall = act.startY - sup;
        const high = fall > 8;
        this.onAttack({ x: p.x, y: sup + 0.5, z: p.z, facing: this.facing, shape: 'circle', r: high ? 3.8 : 3.0, half: Math.PI, mult: high ? 2.9 : 1.6, element: this.kit === 'bow' ? 'light' : (this.infuse > 0 ? 'water' : 'phys'), kind: 'plunge', heavy: true, slash: 'big', char: this.c.def.id });
        this.act = { type: 'land', t: 0, dur: 0.4, lock: true, vx: 0, vz: 0 };
      } else if (this.mode === 'air' && vyBefore < -24) {
        const frac = Math.min(0.85, (-vyBefore - 24) / 24);
        this.events.push('fall');
        this.hurt(Math.round(this.maxHp * frac), p.x, p.z, false);
      } else if (this.mode !== 'ground' && vyBefore < -14) this.events.push('land');
      p.y = sup; v.y = 0; this.hover = null;
      if (!this.dead) this.mode = 'ground';
    } else if (this.mode === 'ground') {
      if (p.y - sup < 0.7) p.y = sup;
      else { this.mode = 'air'; this.airTime = 0; v.y = 0; }
    }
    if ((this.mode === 'air' || this.mode === 'glide' || this.mode === 'ground') && p.y < SWIM_Y + 0.02 && sup < SWIM_Y) {
      if (this.mode !== 'ground') this.events.push('splash');
      this.mode = 'swim'; p.y = SWIM_Y; v.y = 0; this.aiming = false;
      if (this.act && this.act.type !== 'hurt') this.act = null;
    }
    if (this.mode === 'ground' && H(p.x, p.z) > 0.3) { this.safeT += dt; if (this.safeT > 0.5) { this.safeT = 0; this.safe.copy(p); } }
    const hs = Math.hypot(v.x, v.z);
    if (hs > 0.3 && (moving || this.mode === 'glide') && !locked && !this.aiming) {
      const want = Math.atan2(v.x, v.z);
      let d = want - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * (this.mode === 'ground' ? 14 : 5));
    }
    if (this.hover && this.mode !== 'air') this.hover = null;
    this.animate(dt, moving);
  }

  climb(dt, inp, wx, wz, moving, sprint) {
    const p = this.pos, w = this.wall;
    if (inp.jump) {
      this.mode = 'air'; this.airTime = 0.2;
      this.vel.set(-w.x * 4.5, 7.5, -w.y * 4.5);
      this.facing = Math.atan2(-w.x, -w.y);
      return;
    }
    const along = wx * w.x + wz * w.y;
    if (moving && along < -0.6) { this.mode = 'air'; this.airTime = 0.3; this.vel.set(-w.x * 2, 0, -w.y * 2); return; }
    const speed = sprint ? 6.5 : 3.6;
    const up = moving ? speed : 0;
    const lat = moving ? (wx * -w.y + wz * w.x) : 0;
    const lx = -w.y * lat * 2.2 * dt, lz = w.x * lat * 2.2 * dt;
    if (!this.blockedAt(p.x + lx, p.z + lz, p.y)) { p.x += lx; p.z += lz; }
    p.y += up * dt;
    this.climbing = up > 0;
    const ax = p.x + w.x * 0.45, az = p.z + w.y * 0.45;
    const blk = this.blockedAt(ax, az, p.y);
    if (!blk) {
      const top = this.ground(ax, az, p.y + 1.2);
      if (top > p.y - 1.5) {
        p.x = ax + w.x * 0.3; p.z = az + w.y * 0.3; p.y = Math.max(p.y, top);
        this.mode = 'ground'; this.vel.set(0, 0, 0);
      } else {
        this.mode = 'air'; this.airTime = 0.2; this.vel.set(w.x * 2, 0, w.y * 2);
      }
      return;
    }
    if (blk.dir) w.lerp(blk.dir, Math.min(1, dt * 6)).normalize();
    if (blk.terrain) {
      const cx = p.x + w.x * 0.6 * dt * 3, cz = p.z + w.y * 0.6 * dt * 3;
      if (!this.blockedAt(cx, cz, p.y)) { p.x = cx; p.z = cz; }
    }
    this.facing = Math.atan2(w.x, w.y);
    const sup = this.ground(p.x, p.z, p.y + 0.1);
    if (p.y < sup) p.y = sup;
  }

  animate(dt, moving) {
    const m = this.model, mode = this.mode;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.facing;
    const pose = m.pose, L = m.L, R = m.R;
    let rate = 0;
    if (mode === 'ground') rate = hs * 1.55;
    else if (mode === 'swim') rate = 4.5 + hs;
    else if (mode === 'climb') rate = this.climbing ? 7 : 0;
    this.phase += rate * dt;
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const tgt = { pitch: 0, spin: 0, y: 0.9, sh: [0, 0], shz: [0.08, -0.08], el: [-0.25, -0.25], hip: [0, 0], kn: [0, 0], torsoX: 0, torsoY: 0 };
    const t = this.time;
    if (mode === 'ground') {
      const amt = Math.min(1, hs / 6);
      const run = Math.min(1, Math.max(0, (hs - 6.5) / 4));
      tgt.hip = [s * 0.95 * amt, -s * 0.95 * amt];
      tgt.kn = [Math.max(0, -c) * 1.3 * amt + 0.05, Math.max(0, c) * 1.3 * amt + 0.05];
      tgt.sh = [-s * 0.8 * amt, s * 0.8 * amt];
      tgt.el = [-0.4 - 0.6 * amt, -0.4 - 0.6 * amt];
      tgt.y = 0.9 + Math.abs(c) * 0.06 * amt - 0.03 * amt;
      tgt.torsoX = 0.12 * amt + 0.18 * run;
      if (amt < 0.05) { tgt.y = 0.9 + Math.sin(t * 2) * 0.006; tgt.sh = [Math.sin(t * 2) * 0.03, -Math.sin(t * 2) * 0.03]; }
    } else if (mode === 'air') {
      tgt.hip = [0.55, -0.15]; tgt.kn = [1.0, 0.6]; tgt.sh = [-0.5, -0.3]; tgt.shz = [0.6, -0.6]; tgt.el = [-0.5, -0.5];
      if (this.vel.y < -6) { tgt.hip = [0.2, -0.1]; tgt.kn = [0.3, 0.2]; tgt.shz = [1.1, -1.1]; }
      if (this.hover) { tgt.hip = [0.12, -0.08]; tgt.kn = [0.3, 0.22]; tgt.sh = [-0.25, -0.25]; tgt.shz = [0.95, -0.95]; tgt.el = [-0.2, -0.2]; tgt.y = 0.93 + Math.sin(t * 3) * 0.03; }
    } else if (mode === 'glide') {
      tgt.pitch = 0.42; tgt.sh = [-2.9, -2.9]; tgt.shz = [0.25, -0.25]; tgt.el = [-0.15, -0.15];
      tgt.hip = [-0.12 + Math.sin(t * 3) * 0.08, -0.12 - Math.sin(t * 3) * 0.08]; tgt.kn = [0.25, 0.25];
    } else if (mode === 'swim') {
      tgt.pitch = 1.2; tgt.y = 0.95;
      tgt.sh = [-1.6 + Math.sin(this.phase) * 1.6, -1.6 - Math.sin(this.phase) * 1.6]; tgt.shz = [0.3, -0.3]; tgt.el = [-0.3, -0.3];
      tgt.hip = [Math.sin(this.phase * 2) * 0.35, -Math.sin(this.phase * 2) * 0.35]; tgt.kn = [0.3, 0.3];
    } else if (mode === 'climb') {
      tgt.sh = [-2.4 + s * 0.5, -2.4 - s * 0.5]; tgt.shz = [0.35, -0.35]; tgt.el = [-0.8, -0.8];
      tgt.hip = [0.6 + c * 0.5, 0.6 - c * 0.5]; tgt.kn = [1.0 + c * 0.4, 1.0 - c * 0.4]; tgt.torsoX = -0.08;
    }
    const a = this.act;
    let fast = false;
    const bowPose = (draw) => {
      tgt.torsoY = 0.35; tgt.sh[0] = -1.5; tgt.shz[0] = 0.05; tgt.el[0] = -0.05;
      tgt.sh[1] = -1.4; tgt.shz[1] = 0.35; tgt.el[1] = draw ? -1.95 : -0.55;
    };
    if (this.dead) {
      tgt.pitch = -1.4; tgt.y = 0.25; tgt.sh = [-0.3, -0.2]; tgt.shz = [1.2, -1.2]; tgt.hip = [0.1, -0.1]; tgt.kn = [0.2, 0.3]; fast = true;
    } else if (this.aiming) {
      fast = true; bowPose(true);
      tgt.torsoX = Math.max(-0.7, Math.min(0.6, this.aimPitch));
      if (hs > 0.5) { tgt.hip = [s * 0.4, -s * 0.4]; tgt.kn = [Math.max(0, -c) * 0.6, Math.max(0, c) * 0.6]; }
    } else if (a) {
      const k = Math.min(1, a.t / a.dur);
      const e = ease(k);
      fast = true;
      if (a.type === 'na') {
        tgt.hip = [0.35, -0.25]; tgt.kn = [0.3, 0.45]; tgt.y = 0.86;
        tgt.sh[0] = -0.5; tgt.shz[0] = 0.5; tgt.el[0] = -1.2;
        if (a.step === 0) { tgt.torsoY = lerpA(-0.7, 0.8, e); tgt.sh[1] = -1.45; tgt.shz[1] = lerpA(-1.3, 0.5, e); tgt.el[1] = -0.15; }
        else if (a.step === 1) { tgt.torsoY = lerpA(0.8, -0.7, e); tgt.sh[1] = -1.45; tgt.shz[1] = lerpA(0.5, -1.3, e); tgt.el[1] = -0.15; }
        else if (a.step === 2) { tgt.torsoX = -0.15; tgt.sh[1] = lerpA(-0.1, -2.9, e); tgt.shz[1] = -0.2; tgt.el[1] = -0.1; }
        else if (a.step === 3) { tgt.torsoX = lerpA(-0.15, 0.3, e); tgt.sh[1] = lerpA(-2.9, -0.6, e); tgt.shz[1] = -0.15; tgt.el[1] = -0.1; tgt.y = 0.82; }
        else { tgt.spin = e * Math.PI * 2; tgt.sh[1] = -1.35; tgt.shz[1] = -1.35; tgt.el[1] = -0.05; tgt.shz[0] = 1.1; }
      } else if (a.type === 'hna') {
        tgt.torsoY = lerpA(-0.7, 0.8, e); tgt.sh = [-0.5, -1.45]; tgt.shz = [0.5, lerpA(-1.3, 0.5, e)]; tgt.el = [-1.2, -0.15];
      } else if (a.type === 'lifeline') {
        tgt.torsoX = 0.6; tgt.sh = [0.9, -0.7]; tgt.shz = [0.3, -0.3]; tgt.hip = [0.9, -0.7]; tgt.kn = [0.2, 1.0]; tgt.y = 0.82;
      } else if (a.type === 'ca') {
        tgt.spin = e * Math.PI * 4; tgt.sh = [-0.6, -1.4]; tgt.shz = [1.2, -1.4]; tgt.el = [-0.6, -0.05]; tgt.y = 0.84; tgt.hip = [0.4, -0.3]; tgt.kn = [0.5, 0.5];
      } else if (a.type === 'shot') {
        bowPose(a.t < 0.11); tgt.hip = [0.2, -0.2]; tgt.kn = [0.2, 0.3];
      } else if (a.type === 'release') {
        bowPose(false); tgt.sh[1] = -1.1; tgt.shz[1] = 0.6;
      } else if (a.type === 'bskill') {
        bowPose(a.t < 0.2); tgt.torsoX = -0.35; tgt.hip = [0.9, 0.6]; tgt.kn = [1.2, 1.0]; tgt.sh[0] = -1.2; tgt.sh[1] = -1.1;
      } else if (a.type === 'bburst') {
        tgt.torsoX = -0.45; tgt.sh = [-2.85, -2.6]; tgt.shz = [0.1, 0.2]; tgt.el = [-0.05, a.t < 0.45 ? -1.7 : -0.5]; tgt.hip = [0.3, -0.2]; tgt.kn = [0.3, 0.5];
      } else if (a.type === 'skill') {
        tgt.torsoX = 0.4; tgt.sh = [0.5, -1.6]; tgt.shz = [0.4, -0.3]; tgt.el = [-0.4, -0.05]; tgt.hip = [0.8, -0.6]; tgt.kn = [0.3, 0.8]; tgt.y = 0.8;
        if (k > 0.45) { tgt.spin = ease(Math.min(1, (k - 0.45) / 0.4)) * Math.PI * 2; tgt.shz[1] = -1.4; tgt.sh[1] = -1.3; }
      } else if (a.type === 'burst') {
        if (k < 0.55) { const r = ease(k / 0.55); tgt.sh = [-3.0 * r, -3.0 * r]; tgt.shz = [0.1, -0.1]; tgt.el = [-0.1, -0.1]; tgt.torsoX = -0.25 * r; tgt.y = 0.9 + r * 0.05; }
        else { const r = ease(Math.min(1, (k - 0.55) / 0.15)); tgt.sh = [lerpA(-3.0, -0.8, r), lerpA(-3.0, -0.7, r)]; tgt.torsoX = lerpA(-0.25, 0.45, r); tgt.y = 0.9 - 0.2 * r; tgt.hip = [0.6 * r, -0.4 * r]; tgt.kn = [0.6 * r, 0.9 * r]; }
      } else if (a.type === 'plunge') {
        tgt.sh = [-2.9, -2.9]; tgt.shz = [0.2, -0.2]; tgt.el = [-0.2, -0.1]; tgt.hip = [0.9, 0.7]; tgt.kn = [1.3, 1.3]; tgt.torsoX = -0.1;
      } else if (a.type === 'land') {
        tgt.y = 0.66; tgt.torsoX = 0.5; tgt.sh = [0.4, -0.5]; tgt.shz = [0.5, -0.2]; tgt.hip = [1.0, -0.3]; tgt.kn = [1.6, 1.2];
      } else if (a.type === 'dash') {
        tgt.torsoX = 0.4; tgt.sh = [0.7, 0.7]; tgt.shz = [0.3, -0.3]; tgt.hip = [0.6, -0.5]; tgt.kn = [0.4, 0.7];
      } else if (a.type === 'hurt') {
        tgt.torsoX = -0.35; tgt.sh = [-0.4, -0.4]; tgt.shz = [0.7, -0.7]; tgt.hip = [0.3, -0.1]; tgt.kn = [0.4, 0.2];
      }
    }
    const kk = Math.min(1, dt * (fast ? 30 : 14));
    pose.rotation.x = lerpA(pose.rotation.x, tgt.pitch, Math.min(1, dt * (fast ? 14 : 8)));
    pose.rotation.y = tgt.spin ? tgt.spin : lerpA(pose.rotation.y % (Math.PI * 2), 0, kk);
    pose.position.y = lerpA(pose.position.y, tgt.y, kk);
    m.torso.rotation.x = lerpA(m.torso.rotation.x, tgt.torsoX, kk);
    m.torso.rotation.y = lerpA(m.torso.rotation.y, tgt.torsoY, kk);
    [L, R].forEach((lim, i) => {
      lim.sh.rotation.x = lerpA(lim.sh.rotation.x, tgt.sh[i], kk);
      lim.sh.rotation.z = lerpA(lim.sh.rotation.z, tgt.shz[i], kk);
      lim.el.rotation.x = lerpA(lim.el.rotation.x, tgt.el[i], kk);
      lim.hip.rotation.x = lerpA(lim.hip.rotation.x, -tgt.hip[i], kk);
      lim.kn.rotation.x = lerpA(lim.kn.rotation.x, tgt.kn[i], kk);
    });
    if (mode === 'swim') m.root.position.y = this.pos.y + 0.35;
    if (mode === 'climb') m.root.position.addScaledVector(new THREE.Vector3(this.wall.x, 0, this.wall.y), 0.05);
    const flow = Math.min(1, hs / 8) + (mode === 'glide' ? 0.6 : 0);
    m.tail.rotation.x = 0.25 + flow * 0.9 + Math.sin(t * 9) * 0.12 * (0.3 + flow);
    m.tail2.rotation.x = 0.2 + flow * 0.8 + Math.sin(t * 8 + 1) * 0.12 * (0.3 + flow);
    m.pony.rotation.x = 0.05 + flow * 0.45 + Math.sin(t * 6) * 0.05 * (0.4 + flow);
    if (m.update) m.update(dt, t, flow, L.hip.rotation.x, R.hip.rotation.x);
    this.gliderT = lerpA(this.gliderT, mode === 'glide' ? 1 : 0, Math.min(1, dt * 10));
    m.glider.visible = this.gliderT > 0.02;
    m.glider.scale.setScalar(Math.max(0.001, this.gliderT));
    m.glider.rotation.z = Math.sin(t * 1.7) * 0.05;
    const show = !this.dead && (this.weaponShowT > 0 || this.infuse > 0 || this.aiming) && mode !== 'climb' && mode !== 'swim' && mode !== 'glide';
    m.sword.visible = show;
    m.bladeMat.emissiveIntensity = this.infuse > 0 ? 1.6 + Math.sin(t * 10) * 0.3 : 0.35;
    if (m.sword.userData.bowMat) m.sword.userData.bowMat.emissiveIntensity = this.aiming ? (this.aimT >= 1 ? 2.2 : 0.6 + this.aimT) : 0.45;
  }
}
