import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { H, buildTerrain, buildHeightTexture, coastX, FALL_Z, ISLANDS, GC, slope, waterSurface, reserved } from './terrain.js';
import { makeSky, makeCumulus, makeMountains } from './sky.js';
import { makeWater, Mirror } from './water.js';
import { Colliders } from './colliders.js';
import { makeMaterials, buildStructures, updateTrains, waypoint, makeStatue, planStructures, bridge as viaduct, makeTrain } from './structures.js';
import { planCity, buildCity, updateCity } from './city.js';
import { makeCollectorBeams, buildHeritage, makeGuide } from './lore.js';
import { createStory, SPEAKERS, INTRO_CARDS } from './story.js';
import { planPuzzles, buildPuzzles, PZ } from './puzzles.js';
import { DayNight, fmtTime, MAX_SKIP } from './daynight.js';
import { Achievements, ACH, ACH_CATS, ACH_ICON } from './achievements.js';
import { buildNature } from './nature.js';
import { nearFade } from './nearfade.js';
import { Blobs } from './geo.js';
import { Player, CHARS, CHAR_IDS } from './player.js';
import { FX } from './fx.js';
import { Combat } from './combat.js';
import { WorldItems } from './loot.js';
import { UI, avatarSVG , artDetailHTML } from './ui.js';
import { Inventory, ITEMS, iconSVG, RARITY_BG } from './items.js';
import { artStats, makeArtifact, upgradeArtifact, upgradeCost, salvageValue, SETS, MAX_LV, artifactSVG } from './artifacts.js';
import { buildEntrance, buildArena, ARENA } from './domain.js';
import { makeBridge } from './media.js';
import { BANNERS, PULL_COST, newGachaState, pullOnce, GachaScene } from './gacha.js';
import { renderPortraits } from './charmodel.js';
import { setPortraits, portrait } from './ui.js';
import { WorldMap, MAP_ICONS } from './map.js';
import { rng } from './noise.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('rainbow-sea:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rainbow-sea:' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const COMPANION = ['今天想去哪里？', '听说光穿过水幕会变成彩虹，要试试吗？', '针塔岛上的宝箱好像特别华丽……', '累了就去虹之像旁边歇一会儿吧。', '左上角的小地图会显示附近的魔物。'];

async function boot(saved = {}) {
  let quality = store.get('quality', isTouch ? 'mid' : 'high');
  const setProgress = (p, label) => {
    $('golabel').textContent = `正在生成世界 ${Math.round(p * 100)}%`;
    $('loadbar').style.transform = `scaleX(${p})`;
    if (label) $('loadlabel').textContent = label;
  };

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
  const prFor = (q) => Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.5 : q === 'mid' ? 1.25 : 1);
  renderer.setPixelRatio(prFor(quality));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  $('stage').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#d3ebfc', 0.00015);
  const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.3, 12000);

  const spawn = { x: coastX(40) + 11, z: 40 };
  const heroYaw = 0.21;
  const fwd = new THREE.Vector3(-Math.sin(heroYaw), 0, -Math.cos(heroYaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const sunH = fwd.clone().multiplyScalar(Math.cos(0.66)).addScaledVector(right, Math.sin(0.66)).normalize();
  const sunDir = new THREE.Vector3(sunH.x * Math.cos(0.56), Math.sin(0.56), sunH.z * Math.cos(0.56)).normalize();
  const rbDir = new THREE.Vector3(fwd.x, -0.29, fwd.z).normalize();
  const keyDir = new THREE.Vector3().addScaledVector(fwd, -0.55).addScaledVector(right, -0.45).add(new THREE.Vector3(0, 0.95, 0)).normalize();

  const timeU = { value: 0 };
  setProgress(0.05, '天空与光');
  await tick();

  const sky = makeSky(sunDir, rbDir);
  scene.add(sky);
  {
    const pm = new THREE.PMREMGenerator(renderer);
    const es = new THREE.Scene(); const s2 = makeSky(sunDir, rbDir); es.add(s2);
    s2.material.uniforms.uTime.value = 3;
    scene.environment = pm.fromScene(es, 0.02, 0.1, 1000).texture;
    scene.environmentIntensity = 0.7;
    pm.dispose();
  }
  const hemi = new THREE.HemisphereLight('#d4ecff', '#d8cfae', 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e2', 2.1);
  sun.castShadow = true;
  const shadowSize = quality === 'high' ? 2048 : 1024;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const sc = sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 420;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  const mountains = makeMountains(GC);
  scene.add(mountains);
  const cumulus = makeCumulus(GC, heroYaw);
  scene.add(cumulus);

  setProgress(0.15, '地形与海床');
  await tick();
  // grade building lots, plazas and road beds first so every structure meets the ground
  const cityPlan = planCity(spawn);
  planPuzzles();
  planStructures();
  scene.add(buildTerrain(timeU, quality));
  setProgress(0.3, '海水');
  await tick();
  const heightTex = buildHeightTexture(quality === 'low' ? 384 : 512);
  const water = makeWater(heightTex, sunDir, scene.fog);
  scene.add(water);
  const mirror = new Mirror(quality === 'high' ? 0.5 : 0.35);

  setProgress(0.45, '尖塔与单轨桥');
  await tick();
  const colliders = new Colliders(16);
  const mats = makeMaterials();
  const foliage = new Blobs(new THREE.IcosahedronGeometry(1, 2));
  const ctx = { colliders, mats, foliage, timeU, quality, spawn, tips: [] };
  const st = buildStructures(scene, ctx);
  setProgress(0.52, '海湾新城');
  await tick();
  const city = buildCity(scene, { ...ctx, bridge: viaduct, makeTrain }, spawn);
  const beams = makeCollectorBeams(scene, ctx.tips, rbDir);
  st.trains.push(...city.trains);

  setProgress(0.58, '树林、花与礁石');
  await tick();
  const nat = buildNature(scene, ctx);
  const folMesh = foliage.build(scene, nearFade(new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0.6, 2.2));

  setProgress(0.72, '神像、魔物与宝箱');
  await tick();

  const g = (x, z) => Math.max(H(x, z), colliders.support(x, z, 999));
  const gLow = (x, z) => Math.max(H(x, z), colliders.support(x, z, H(x, z) + 4));
  const clearSpot = (x0, z0, rad = 4.5) => {
    for (let r = 0; r <= 24; r += 2) for (let a = 0; a < Math.PI * 2; a += r ? 0.5 : 7) {
      const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r, h = H(x, z);
      if (h < 1.5 || slope(x, z).m > 0.35) continue;
      let ok = true;
      for (let k = 0; k < 8 && ok; k++) { const b = k / 8 * Math.PI * 2; if (colliders.support(x + Math.cos(b) * rad, z + Math.sin(b) * rad, 999, 0.5) > h - 3) ok = false; }
      if (ok && colliders.support(x, z, 999, rad) <= h - 3) return [x, z];
    }
    return [x0, z0];
  };

  // ---------- statues (heal + revive + offering) & waypoints ----------
  const statues = [];
  for (const [name, x0, z0, rot] of [['海崖之像', cityPlan.spots.statue[0], cityPlan.spots.statue[1], -1.2], ['中央之像', -64, -214, 1.4]]) {
    const [x, z] = clearSpot(x0, z0);
    const s = makeStatue(scene, mats, colliders, x, H(x, z) - 0.15, z, rot);
    s.name = name; s.inside = false;
    statues.push(s);
  }
  const curvePt = st.trains[0].curve.getPointAt(0.2);
  const WP = [
    { id: 'cliff', name: '海崖观景台', note: '出发点，正对彩虹与海湾', x: spawn.x, z: spawn.z, yaw: heroYaw, marker: [spawn.x + 2.9, spawn.z - 5.7] },
    { id: 'central', name: '中央尖塔岛', note: '白色风帆塔群与螺旋坡道', x: -20, z: -200, yaw: 1.2, marker: [-17, -203] },
    { id: 'tower', name: '绿塔之巅', note: '全岛最高可站立处，适合滑翔', x: -34, z: -205, yaw: -0.6, top: true, marker: null },
    { id: 'bridge', name: '单轨桥', note: '列车往返于海面之上', x: curvePt.x, z: curvePt.z, y: curvePt.y + 0.2, yaw: 2.6 },
    { id: 'station', name: '尖塔车站', note: '环形站台环绕百米尖塔', x: ISLANDS[1].x + 8, z: ISLANDS[1].z + 9, y: 12.0, yaw: 2.4 },
    { id: 'fall', name: '瀑布之顶', note: '溪流从这里落入海中。光箭穿过瀑布会折射成彩虹', x: coastX(FALL_Z) + 12, z: FALL_Z + 6.5, yaw: Math.PI / 2, marker: [coastX(FALL_Z) + 8, FALL_Z + 10] },
    ...city.stations.slice(1).map((sn) => ({ id: 'st_' + sn.name, name: sn.name, note: '虹湾环线的单轨车站。楼梯下来就是穹顶花园和新城北区', x: sn.foot[0], z: sn.foot[2], yaw: sn.foot[3] + Math.PI })),
    ...(PZ.sites.seal ? [{ id: 'seal', name: '七符台', note: '东方高地上的巨大石环，中央封着什么东西', x: PZ.sites.seal.x - 27.5, z: PZ.sites.seal.z + 2, yaw: -Math.PI / 2, marker: [PZ.sites.seal.x - 29, PZ.sites.seal.z + 5.5] }] : []),
    { id: 'needle', name: '远方针塔', note: '海湾深处的最高建筑，华丽宝箱由守卫看守', x: ISLANDS[2].x + 4, z: ISLANDS[2].z - 19, yaw: 0.3, marker: [ISLANDS[2].x + 7, ISLANDS[2].z - 21] },
  ];
  statues.forEach((s, i) => WP.push({ id: 'statue' + i, name: s.name, note: '虹之像：靠近可为全队恢复生命、复苏倒下的角色，并能献上虹晶', x: s.pos.x + Math.sin(s.group.rotation.y) * 6, z: s.pos.z + Math.cos(s.group.rotation.y) * 6, yaw: s.group.rotation.y, statue: s }));
  const markers = [];
  for (const w of WP) {
    if (w.marker) { const [mx, mz] = w.marker; const mk = waypoint(scene, mats, mx, gLow(mx, mz), mz, colliders); mk.wp = w; markers.push(mk); }
  }
  const wpPos = (w) => new THREE.Vector3(w.x, w.y !== undefined ? w.y : (w.top ? g(w.x, w.z) : gLow(w.x, w.z)), w.z);

  // ---------- save ----------
  const save = store.get('save', null) || {};
  save.chests = save.chests || {}; save.nodes = save.nodes || {}; save.crystals = save.crystals || [];
  save.offered = save.offered || 0; save.camps = save.camps || {}; save.exp = save.exp || 0;
  const ach = new Achievements(save, (a) => { if (!ach.quiet) achPopup(a); if (typeof writeSave === 'function') try { writeSave(); } catch (e) { /* during boot */ } });
  let inv;
  if (save.inv) inv = Inventory.from(save.inv);
  else {
    inv = new Inventory();
    inv.add('sword_breeze', 1); inv.equipped = inv.weapons[0].uid;
    inv.add('berry', 5); inv.add('riceball', 2); inv.add('journal', 1);
  }
  if (!inv.weapons.length) { inv.add('sword_breeze', 1); inv.equipped = inv.weapons[0].uid; }
  // weapons belong to characters; migrate the old single "equipped" sword to 澜
  if (!inv.weapons.some((w) => w.owner)) { const w = inv.weapons.find((x) => x.uid === inv.equipped) || inv.weapons.find((x) => ITEMS[x.id].type === '单手剑'); if (w) w.owner = 'lan'; }
  save.owned = Array.isArray(save.owned) && save.owned.length ? save.owned.filter((id) => CHARS[id]) : ['lan', 'yao'];
  save.cons = save.cons || {};
  const ensureWeapon = (id) => {
    if (inv.weaponOf(id)) return;
    const kitType = CHARS[id].kit === 'bow' ? '弓' : '单手剑';
    const free = inv.weapons.find((w) => !w.owner && ITEMS[w.id].type === kitType);
    if (free) { free.owner = id; return; }
    const w = inv.add(id === 'yao' ? 'bow_dawn' : kitType === '弓' ? 'bow_reed' : 'sword_iron', 1); w.owner = id; inv.fresh.delete('w' + w.uid);
  };
  for (const id of save.owned) ensureWeapon(id);
  if (!save.gachaInit) { inv.add('starlight', 1600); inv.add('bottle', 10); save.gachaInit = 1; }
  save.gacha = save.gacha && save.gacha.pity ? save.gacha : newGachaState();
  inv.fresh.clear();

  // ---------- party ----------
  const partyIds = (Array.isArray(save.partyIds) ? save.partyIds : ['lan', 'yao']).filter((id) => save.owned.includes(id));
  const player = new Player(colliders, { ...spawn, facing: heroYaw + Math.PI }, partyIds.length ? partyIds : ['lan']);
  const syncModels = () => { for (const m of Object.values(player.roster)) if (!m.model.root.parent) scene.add(m.model.root); };
  const applyWeapons = () => {
    for (const m of Object.values(player.roster)) {
      const w = inv.weaponOf(m.def.id);
      player.setWeapon(ITEMS[w ? w.id : m.def.kit === 'bow' ? 'bow_dawn' : 'sword_breeze'], m);
      m.cons = save.cons[m.def.id] || 0;
    }
  };
  syncModels(); applyWeapons();
  player.stamBonus = Math.floor(save.offered / 4) * 25; player.stam = player.maxStam;
  const restore = (m, st) => { if (m && st) { m.hp = Math.max(1, Math.min(m.maxHp, st.hp ?? m.maxHp)); m.energy = st.energy || 0; } };
  if (save.roster && typeof save.roster === 'object') { for (const [id, st] of Object.entries(save.roster)) if (player.roster[id]) restore(player.roster[id], st); }
  else if (Array.isArray(save.party)) save.party.forEach((st, i) => restore(player.party[i], st));
  if (saved.player) player.teleport(saved.player.x, saved.player.y + 0.5, saved.player.z);
  else player.pos.y = g(spawn.x, spawn.z);
  player.mode = 'air';
  player.update(0.016, { x: 0, y: 0 }, heroYaw);
  let writeSave = () => {
    save.inv = inv.toJSON();
    save.partyIds = player.party.map((m) => m.def.id);
    save.roster = Object.fromEntries(Object.values(player.roster).map((m) => [m.def.id, { hp: m.dead ? 0 : Math.round(m.hp), energy: m.energy }]));
    store.set('save', save);
  };
  const addExp = (n) => { save.exp += n; };

  // ---------- combat, loot ----------
  const fx = new FX(scene, camera, $('fxlayer'));
  const groundAt = (x, z, maxY) => Math.max(H(x, z), colliders.support(x, z, maxY));
  const world = new WorldItems(scene, { ground: groundAt, save, colliders });
  const combat = new Combat({
    scene, fx, player, colliders, barsEl: $('ebars'),
    // enemies never stand on trees: trunks are walls for them, not steps (a warden used to climb a tree staircase)
    ground: groundAt,
    enemyGround: (x, z, maxY) => Math.max(H(x, z), colliders.support(x, z, maxY, 0.25, 'tree')),
    blocked: (x, z, feet, step) => !!colliders.blocker(x, z, feet, step, 0.35, 'tree') || (H(x, z) > feet + step && slope(x, z).m > 1.0),
    water: (x, z) => groundAt(x, z, 999) < -0.5,
    onDrop: (loot, pos) => { for (const [id, n] of loot) world.drop(id, n, pos); },
    onCampClear: (camp) => {
      if (camp.domain) { domainWaveClear(camp); return; }
      if (!save.camps[camp.id]) { save.camps[camp.id] = 1; addExp(60); }
      const ch = chestByCamp[camp.id];
      if (ch && !ch.opened && ch.seal) world.unseal(ch);
    },
    onEvent: (type, data) => {
      if (type === 'kill') { if (data.isWarden) ach.bump('wardens'); else ach.bump('slimes'); if (data.revealT > 0) ach.bump('revealKill'); }
      if (type === 'focus') ach.bump('focus');
      if (type === 'kill' && data.camp && data.camp.domain) { D.kills++; return; }
      if (type === 'bridge') { raiseBridge(); return; }
      if (type === 'kill') addExp(data.isWarden ? 40 : 8);
    },
  });
  combat.onArrowHit = (a) => { if (a.kind === 'reflect') ach.bump('reflectHit'); };
  const hints = {};
  // the waterfall is a permanent water curtain: light arrows that cross it refract
  { const xc = coastX(FALL_Z); const f = combat.addBoxCurtain([xc - 2, xc + 9, FALL_Z - 4.5, FALL_Z + 4.5, -0.5, 16]); f.bridge = true; }
  let hitstop = 0;
  player.findTarget = (pos, dx, dz, r, cone) => combat.nearestTarget(pos, dx, dz, r, cone);
  player.onShoot = (o) => {
    combat.spawnArrow(o);
    if (o.full) fx.sparks(o.from, '#ffe37a', 8, 3, 0.3, 0.35, 1);
  };
  player.onRain = ({ center, r, dur }) => { combat.addRain(center, r, dur); fx.shake = Math.max(fx.shake, 0.25); };
  // 绫「牵丝」：冲刺中标记敌人，结束时收紧爆炸
  player.scanEnemies = (pos, r) => combat.enemiesNear(pos, r);
  player.onLifeMark = (e) => { fx.ring(new THREE.Vector3(e.pos.x, e.pos.y + 0.1, e.pos.z), 1.8, '#8fe3ff', 0.4, 1.0); fx.label(e.center.clone().add(new THREE.Vector3(0, 1.1, 0)), '缠丝', 'mirror'); };
  player.onLifeBlast = ({ marks, to }) => {
    if (marks.length) {
      combat.lifeBlast(marks, to);
      player.gainEnergy(Math.min(9, marks.length * 3));
      fx.shake = Math.max(fx.shake, 0.35);
    }
    fx.ring(to, 2.6, '#8fe3ff', 0.5, 1.3);
  };
  player.onNet = ({ center, r, dur }) => { combat.addNet(center, r, dur); fx.shake = Math.max(fx.shake, 0.3); };
  // 岚「回旋刃」「卷浪龙」
  player.onBoomerang = (o) => combat.addBoomerang(o);
  player.onTornado = (o) => { combat.addTornado(o); fx.shake = Math.max(fx.shake, 0.4); };
  // 翎「千羽坠」：落下追踪敌人的光羽
  player.onFeathers = ({ center, char }) => {
    const targets = combat.enemies.filter((e) => e.alive && e.pos.distanceTo(center) < 26).sort((x, y) => x.pos.distanceTo(center) - y.pos.distanceTo(center)).slice(0, 8);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, from = new THREE.Vector3(center.x + Math.sin(a) * 1.4, center.y + 3.2, center.z + Math.cos(a) * 1.4);
      const dir = new THREE.Vector3(Math.sin(a) * 0.5, 0.7, Math.cos(a) * 0.5).normalize();
      combat.spawnArrow({ from, dir, speed: 30, mult: 0.4, kind: 'prism', color: '#9ff5df', char, canRefract: false, target: targets.length ? targets[i % targets.length] : null, turn: 9, life: 2.6 });
    }
    fx.ring(center, 7, '#9ff5df', 0.8, 1.2);
  };
  player.canHover = () => !D.inside && !puzzles.challenge();
  player.onAttack = (d) => {
    const def = CHARS[d.char] || CHARS.lan, elc = def.elColor;
    const slashCol = d.element === 'water' ? '#5fc8ff' : d.char === 'po' ? '#ffd9a0' : d.char === 'ai' ? '#e2d8ff' : d.element === 'wind' ? '#aef5e2' : '#d7f1ff';
    const sPos = new THREE.Vector3(player.pos.x, player.pos.y + 1.05, player.pos.z);
    if (d.kind === 'na' || d.kind === 'ca') fx.slash(sPos, player.facing, d.slash, slashCol);
    if (d.kind === 'skill') {
      fx.slash(sPos, player.facing, 'big', elc);
      fx.sparks(new THREE.Vector3(d.x, player.pos.y + 0.8, d.z), elc, 18, 7, 0.45, 0.6, 4);
    }
    if (d.kind === 'burst') {
      fx.ring(player.pos, 9, elc, 0.9, 1.3); fx.ring(player.pos, 6, '#ffe17a', 0.7, 1.6); fx.ring(player.pos, 4, '#ff9ad5', 0.6, 2);
      fx.sparks(sPos, '#ffffff', 24, 10, 0.35, 0.8, 6);
      fx.shake = Math.max(fx.shake, 0.8);
    }
    if (d.medium) placeMedium(d);
    if (d.kind === 'plunge') { fx.ring(new THREE.Vector3(d.x, d.y - 0.4, d.z), d.r, '#e6f6ff', 0.45, 1.2); fx.sparks(new THREE.Vector3(d.x, d.y, d.z), '#ffffff', 12, 6, 0.4, 0.5, 3); fx.shake = Math.max(fx.shake, 0.45); }
    const n = combat.hit(d);
    if (n > 0) {
      hitstop = d.heavy ? 0.075 : 0.045;
      if (d.kind === 'skill') combat.spawnParticles(new THREE.Vector3(d.x, player.pos.y + 1, d.z), d.element === 'water' ? 'water' : null, 3, 5);
      if (d.heavy) fx.shake = Math.max(fx.shake, 0.25);
    }
    return n;
  };

  // 光媒 created by skills: 潮帘 (澜) / 聚晶 (珀) / 蜃雾 (霭); 海镜 (汀) is placed by the bow skill below
  function placeMedium(d) {
    const gy = groundAt(d.x, d.z, player.pos.y + 2);
    if (d.medium === 'curtain') combat.addCurtain(d.x, gy, d.z, d.kind === 'burst' ? 8 : 3.6, d.kind === 'burst' ? 10 : 8);
    else if (d.medium === 'crystal') {
      if (d.kind === 'burst') {
        for (let i = 0; i < 4; i++) { const a = player.facing + Math.PI / 4 + i * Math.PI / 2, x = player.pos.x + Math.sin(a) * 3.4, z = player.pos.z + Math.cos(a) * 3.4; combat.addCrystal(x, groundAt(x, z, player.pos.y + 2), z, 10, { char: 'po' }); }
      } else {
        const mine = combat.fields.filter((f) => f.type === 'crystal' && !f.natural && f.t < f.dur);
        if (mine.length >= 2) mine[0].dur = mine[0].t + 0.3;
        combat.addCrystal(d.x, gy, d.z, 12, { char: 'po' });
      }
    } else if (d.medium === 'mist') {
      if (d.kind === 'burst') {
        const f = combat.addMist(player.pos.x, groundAt(player.pos.x, player.pos.z, player.pos.y + 2), player.pos.z, 9, 10);
        combat.revealMist(f, 'ai');
        // 海市：24 米内所有敌人显影
        for (const e of combat.enemies) if (e.alive && Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < 24) e.revealT = 10;
        fx.ring(player.pos, 24, '#c9b8ff', 0.8, 1.4);
      } else { fx.ring(new THREE.Vector3(d.x, gy + 0.1, d.z), 5, '#c9b8ff', 0.6, 1.2); combat.addMist(d.x, gy, d.z, 5, 9); }
    }
  }
  player.onMirrorSkill = ({ from, facing, target }) => {
    const dist = target ? Math.max(3, Math.min(7, Math.hypot(target.pos.x - player.pos.x, target.pos.z - player.pos.z) * 0.55)) : 5.5;
    const fs = Math.sin(facing), fc = Math.cos(facing);
    const x = player.pos.x + fs * dist, z = player.pos.z + fc * dist, gy = groundAt(x, z, player.pos.y + 2);
    const f = combat.addMirror(x, gy, z, -fs, -fc, 10);
    const to = new THREE.Vector3(f.x, f.y, f.z);
    setTimeout(() => combat.spawnArrow({ from, dir: to.sub(from).normalize(), mult: 1.4, kind: 'skill', speed: 70, color: '#bff7ee', char: 'ting' }), 120);
  };
  player.onMirrorBurst = ({ center, from }) => {
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, x = center.x + Math.sin(a) * 5, z = center.z + Math.cos(a) * 5;
      const f = combat.addMirror(x, groundAt(x, z, center.y + 3), z, -Math.sin(a), -Math.cos(a), 8);
      setTimeout(() => { const to = new THREE.Vector3(f.x, f.y, f.z); combat.spawnArrow({ from: player.bowOrigin(), dir: to.sub(player.bowOrigin()).normalize(), mult: 0.9, kind: 'burst', speed: 75, color: '#bff7ee', char: 'ting' }); }, 150 + i * 110);
    }
    fx.ring(center, 5.5, '#bff7ee', 0.8, 1.2);
  };

  const R = rng(4242);
  const chestByCamp = {};
  const CAMPS = [
    { id: 'meadow', name: '草地史莱姆', x: 102, z: 2, list: [{ kind: 'slime', el: 'pyro', level: 6 }, { kind: 'slime', el: 'pyro', level: 6, size: 0.85 }, { kind: 'slime', el: 'dendro', level: 7 }], chest: ['exquisite', 104, -6, 0.3] },
    { id: 'beach', name: '沙滩史莱姆', x: -18, z: -226, list: [{ kind: 'slime', el: 'electro', level: 10 }, { kind: 'slime', el: 'electro', level: 10, size: 0.85 }, { kind: 'slime', el: 'pyro', level: 11 }, { kind: 'slime', el: 'hydro', level: 10 }], chest: ['exquisite', -22, -233, 2.6, [['sword_tide', 1]]] },
    { id: 'spire', name: '尖塔岛史莱姆', x: 92, z: -312, list: [{ kind: 'slime', el: 'dendro', level: 12 }, { kind: 'slime', el: 'dendro', level: 12, size: 1.15 }, { kind: 'slime', el: 'electro', level: 12 }], chest: ['exquisite', 86, -309, 1.2] },
    { id: 'warden', name: '礁岩守卫', x: 158, z: -168, list: [{ kind: 'warden', level: 18 }], chest: ['precious', 164, -175, 0.8, [['sword_coral', 1]]] },
    { id: 'needle', name: '针塔守卫', x: 30, z: -662, list: [{ kind: 'warden', level: 20 }, { kind: 'slime', el: 'pyro', level: 18, dx: -5, dz: 4 }, { kind: 'slime', el: 'electro', level: 18, dx: 5, dz: 4 }], chest: ['luxurious', 38, -669, 0, [['sword_rainbow', 1]]] },
  ];
  const campObjs = [];
  for (const c of CAMPS) {
    campObjs.push(combat.addCamp(c));
    const [tier, x, z, rot, extra] = c.chest;
    const ch = world.addChest('camp-' + c.id, tier, x, z, rot, { sealed: true });
    ch.extra = extra; chestByCamp[c.id] = ch;
  }
  world.addChest('spawn', 'common', spawn.x - 4, spawn.z - 3, 1.2);
  world.addChest('towertop', 'precious', -31.5, -205, -1.2, { y: g(-31.5, -205) });
  world.addChest('falltop', 'common', coastX(FALL_Z) + 16, FALL_Z - 6, 1.6);
  world.addChest('islet1', 'common', -150, -110, 0.4);
  world.addChest('station', 'exquisite', ISLANDS[1].x - 12, ISLANDS[1].z - 3, 1.6, { y: 11.9 });
  world.addChest('hill', 'exquisite', coastX(-30) + 168, -26, -1.2);
  const okSpot = (x, z, minH = 1.5) => { const h = H(x, z); return h > minH && slope(x, z).m < 0.6 && colliders.support(x, z, 999, 1.2) < h + 0.5 && !reserved(x, z, 1.2); };
  let k = 0;
  const scatter = (type, n, area, minH) => {
    let made = 0, tries = 0;
    while (made < n && tries < n * 60) {
      tries++;
      const [x, z] = area();
      if (!okSpot(x, z, minH)) continue;
      world.addNode(type, x, z, { key: type[0] + (k++) });
      made++;
    }
  };
  const around = (cx, cz, r) => () => { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r; return [cx + Math.cos(a) * d, cz + Math.sin(a) * d]; };
  scatter('berry', 10, around(spawn.x + 28, spawn.z - 25, 70), 2);
  scatter('berry', 6, around(ISLANDS[0].x, ISLANDS[0].z, 50), 1.6);
  scatter('berry', 3, around(ISLANDS[1].x, ISLANDS[1].z, 28), 1.6);
  scatter('berry', 3, around(ISLANDS[6].x, ISLANDS[6].z, 36), 1.6);
  scatter('flower', 18, around(spawn.x + 30, spawn.z - 30, 80), 2);
  scatter('flower', 6, () => { const z = -140 + R() * 120; return [coastX(z) + 6 + R() * 14, z]; }, 3);
  scatter('flower', 4, around(ISLANDS[0].x, ISLANDS[0].z, 50), 1.6);
  {
    let made = 0, tries = 0;
    const isl = [ISLANDS[0], ISLANDS[1], ISLANDS[2], ISLANDS[3], ISLANDS[5], ISLANDS[6]];
    while (made < 32 && tries < 4000) {
      tries++;
      let x, z;
      if (R() < 0.35) { z = -120 + R() * 260; x = coastX(z) - 2 + R() * 6; }
      else { const I = isl[Math.floor(R() * isl.length)]; const a = R() * Math.PI * 2; const r = I.r - 2 + R() * 6; x = I.x + Math.cos(a) * r; z = I.z + Math.sin(a) * r; }
      const h = H(x, z);
      if (h < 0.05 || h > 0.9 || colliders.support(x, z, 999, 0.6) > h + 0.3) continue;
      world.addNode('shell', x, z, { key: 's' + (k++) }); made++;
    }
  }
  {
    const oreSpots = [];
    for (let i = 0; i < 6; i++) { const z = FALL_Z - 30 + i * 12 + R() * 6; oreSpots.push([coastX(z) + 2.5 + R() * 2, z]); }
    oreSpots.push([ISLANDS[5].x + 8, ISLANDS[5].z - 6], [ISLANDS[5].x - 9, ISLANDS[5].z + 4], [ISLANDS[6].x + 20, ISLANDS[6].z - 18], [ISLANDS[6].x - 18, ISLANDS[6].z + 22], [ISLANDS[3].x + 6, ISLANDS[3].z]);
    for (const [x, z] of oreSpots) {
      if (H(x, z) < 0.3) continue;
      const n = world.addNode('ore', x, z, { key: 'o' + (k++) });
      combat.breakables.push(n.breakable);
    }
  }
  world.onChange = () => {};
  let crystalSpots = [];
  {
    const S = ISLANDS[1], Nd = ISLANDS[2];
    const dz0 = -122, dx0 = coastX(dz0) + 26, dy0 = H(dx0, dz0) - 0.5;
    const wx0 = dx0 + 28, wz0 = dz0 + 22;
    const C = [
      ['c1', spawn.x + 7.5, H(spawn.x + 7.5, spawn.z + 3.5) + 6.4, spawn.z + 3.5],
      ['c2', -6, g(-6, -193) + 1.4, -193],
      ['c3', -54, 3.6 + 44 + 1.4, -193],
      ['c4', -18.75, 3.6 + 26 + 5 + 1.3, -199],
      ['c5', S.x + 3, 11.9 + 1.2, S.z + 12],
      ['c6', Nd.x, g(Nd.x, Nd.z) + 1.3, Nd.z],
      ['c7', coastX(FALL_Z) - 3, Math.max(0.4, H(coastX(FALL_Z) - 3, FALL_Z + 4)) + 1.6, FALL_Z + 4],
      ['c8', dx0, dy0 + 11 + 1.3, dz0],
      ['c9', city.terrace ? city.terrace.x : wx0, city.terrace ? city.terrace.top + 1.3 : g(wx0, wz0) + 1.3, city.terrace ? city.terrace.z : wz0],
      ['c10', -8, 3.6 - 0.9 + 12 + 1.3, -160],
      ['c11', -8, H(-8, -55) + 1.3, -55],
      ['c12', coastX(-30) + 170, H(coastX(-30) + 170, -30) + 1.4, -30],
    ];
    for (const [key, x, y, z] of C) world.addCrystal(key, x, y, z);
    crystalSpots = C;
  }

  // ---------- 光路 in the open world ----------
  const tablets = [];
  const tabletStone = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.8 });
  const tabletGold = new THREE.MeshStandardMaterial({ color: '#e9c46a', roughness: 0.3, metalness: 0.7, emissive: '#5a3c08', emissiveIntensity: 0.3 });
  const addTablet = (x, z, rot, text, id) => {
    const y = g(x, z);
    const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = rot; scene.add(grp);
    const slab = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.35, 0.24, 2, 0.06), tabletStone); slab.position.y = 0.66; slab.castShadow = true; grp.add(slab);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.3), tabletGold); cap.position.y = 1.36; grp.add(cap);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 0.5), tabletStone); foot.position.y = 0.06; grp.add(foot);
    const gm = new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.75 });
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.72), gm); glyph.position.set(0, 0.76, 0.125); grp.add(glyph);
    const glyph2 = glyph.clone(); glyph2.position.z = -0.125; glyph2.rotation.y = Math.PI; grp.add(glyph2);
    colliders.add({ type: 'cyl', x, z, r: 0.5, top: y + 1.4, bottom: y - 1, noClimb: true });
    const t = { pos: new THREE.Vector3(x, y, z), text, id: id || 't' + tablets.length, gm, glow: false };
    tablets.push(t);
    return t;
  };
  let lockRef = null, lockTablet = null, guide = null;
  // 1) 光锁: a natural 聚晶 beside a chest caged in amber; only a focused beam breaks the cage
  {
    const [cx, cz] = clearSpot(spawn.x + 14, spawn.z + 20, 2.5);
    combat.addCrystal(cx, g(cx, cz), cz, Infinity, { natural: true });
    const [lx, lz] = clearSpot(cx + 12, cz + 6, 2.5);
    const lock = world.addChest('lightlock', 'precious', lx, lz, Math.atan2(cx - lx, cz - lz), { lightLock: true });
    lockRef = lock;
    if (!lock.opened) combat.lightTargets.push({ x: lx, y: lock.pos.y + 0.7, z: lz, r: 1.4, h: 1.8, need: 'beam', onLight() { if (world.unlockLight(lock)) { this.done = true; fx.sparks(lock.pos.clone().setY(lock.pos.y + 1), '#ffd38a', 30, 7, 0.5, 0.8, 4); banner('光锁解开了'); ach.bump('lightlock'); if (story) story.emit('lightlock'); } } });
    lockTablet = addTablet(cx - 2.2, cz - 2.2, 0.6, '石碑：「光穿过晶石，会汇聚成一束，足以熔开琥珀。」——让弓手的箭穿过晶石，对准被琥珀封住的宝箱。', 'lock');
    {
      const cy = g(cx, cz) + 1.2, from = new THREE.Vector3(cx, cy, cz), to = new THREE.Vector3(lx, lock.pos.y + 0.7, lz);
      const dir = to.clone().sub(from).setY(0).normalize(), sx = cx - dir.x * 5, sz = cz - dir.z * 5;
      guide = makeGuide(scene, from, to, new THREE.Vector3(sx, g(sx, sz), sz));
    }
  }
  // 2) 蜃楼宝箱: a mist bank on the islet hides a chest that only light can reveal
  {
    const I = ISLANDS[4];
    const mist = combat.addMist(I.x, Math.max(0.2, H(I.x, I.z)), I.z, 7.5, Infinity, { natural: true });
    const hid = world.addChest('mirage', 'exquisite', I.x + 2.5, I.z - 2, 2.2, { hidden: true });
    mist.onLit = () => { if (world.revealHidden(hid)) { ach.bump('mirage'); fx.sparks(hid.pos.clone().setY(hid.pos.y + 1), '#e2d8ff', 26, 5, 0.5, 0.8, 3); banner('蜃楼散去', '雾里藏着一只宝箱'); } };
    addTablet(I.x - 3.5, I.z + 3.5, 2.4, '石碑：「蜃雾里藏着看不见的东西。让光照进去。」');
  }
  // 3) 虹桥: a fully drawn arrow through the waterfall raises a walkable rainbow to that islet
  const bridge = { mesh: null, cols: [], t: 0 };
  const xcF = coastX(FALL_Z);
  addTablet(xcF + 10, FALL_Z + 9, -1.2, '石碑：「满弦之光穿过瀑布，水雾会在海上架起虹桥。」');
  function raiseBridge() {
    ach.bump('bridge');
    if (bridge.mesh) { bridge.t = Math.min(bridge.t, 2); return; }
    const A = new THREE.Vector3(xcF + 5, g(xcF + 5, FALL_Z + 7) + 0.02, FALL_Z + 7);
    const I = ISLANDS[4], B = new THREE.Vector3(I.x + 3, Math.max(0.3, H(I.x + 3, I.z)) + 0.02, I.z);
    const N = 160, top = Math.max(A.y, B.y) + 16, pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = A.clone().lerp(B, t);
      p.y = A.y + (B.y - A.y) * t + (top - Math.max(A.y, B.y)) * 4 * t * (1 - t) + Math.min(A.y, B.y) * 0;
      pts.push(p);
    }
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[i + 1];
      bridge.cols.push(colliders.add({ type: 'seg', ax: a.x, az: a.z, ay: a.y, bx: b.x, bz: b.z, by: b.y, w: 1.25, thick: 0.6 }));
    }
    bridge.mesh = makeBridge(pts, 2.6); scene.add(bridge.mesh);
    bridge.t = 0;
    banner('虹桥', '彩虹会在 25 秒后消散');
  }
  function updateBridge(dt) {
    if (!bridge.mesh) return;
    bridge.t += dt;
    const u = bridge.mesh.material.uniforms; u.uTime.value = time;
    u.uA.value = Math.min(1, bridge.t / 0.8) * Math.min(1, (25 - bridge.t) / 3);
    if (bridge.t >= 25) {
      scene.remove(bridge.mesh); bridge.mesh.geometry.dispose(); bridge.mesh.material.dispose(); bridge.mesh = null;
      for (const c of bridge.cols) c.off = true; bridge.cols = [];
    }
  }

  // ---------- 回廊 entrance (open world) + arena (far away, hidden until entered) ----------
  const dent = (() => { const [x, z] = clearSpot(150, 25, 7); return buildEntrance(scene, colliders, x, H(x, z), z, -Math.PI / 2); })();
  const arena = buildArena(scene, colliders);
  const heritage = buildHeritage(scene, colliders, dent);
  const tUI = (label, t) => {
    const el = $('dtimer');
    if (label === null) { el.hidden = !D.inside || D.state !== 'fight'; el.querySelector('span').textContent = '剩余时间'; return; }
    el.hidden = false; el.querySelector('span').textContent = label;
    const v = Math.max(0, Math.ceil(t)); $('dt-t').textContent = `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; el.classList.toggle('low', v <= 10);
  };
  const puzzles = buildPuzzles({ scene, colliders, combat, world, fx, g, save, ach, banner: (a, b) => banner(a, b), toast: (a, b) => toast(a, b), notice: (a, b) => notice(a, b), player, city, dent, heroYaw, spawn, addTablet, timerUI: tUI, writeSave: () => writeSave(), gain: (l) => gain(l) });
  for (const a of ACH) if (a.key === 'tablets') a.goal = tablets.length;
  // drones can be shot down with light arrows; they crash, leave scrap and come back later
  const drones = [...city.drones, ...(heritage.drone ? [heritage.drone] : [])].map((d) => {
    const rec = { d, lt: null, vy: 0, respawn: 0 };
    rec.lt = { x: 0, y: -999, z: 0, r: 1.1, h: 1.0, need: 'any', onLight() { if (d.down) return; d.down = true; this.done = true; rec.vy = 2; rec.spin = (Math.random() - 0.5) * 8; fx.sparks(d.g.position.clone(), '#ffd36a', 14, 5, 0.3, 0.5, 2); } };
    combat.lightTargets.push(rec.lt);
    return rec;
  });
  function updateDrones(dt) {
    for (const r of drones) {
      const { d, lt } = r, p = d.g.position;
      if (!d.down) { lt.x = p.x; lt.y = p.y; lt.z = p.z; continue; }
      if (r.respawn > 0) { r.respawn -= dt; if (r.respawn <= 0) { d.down = false; lt.done = false; d.g.visible = true; d.g.rotation.set(0, 0, 0); } continue; }
      r.vy -= 16 * dt; p.y += r.vy * dt; d.g.rotation.x += r.spin * dt; d.g.rotation.z += r.spin * 0.7 * dt;
      if (Math.random() < dt * 14) fx.sparks(p.clone(), '#8a8f99', 1, 1, 0.2, 0.6, 1);
      const gy = g(p.x, p.z);
      if (p.y <= gy + 0.3) {
        fx.sparks(p.clone().setY(gy + 0.4), '#ffb347', 16, 4, 0.3, 0.5, 3); fx.ring(p.clone().setY(gy + 0.05), 1.6, '#ffd36a', 0.4, 1.2);
        world.drop('scrap', 1, new THREE.Vector3(p.x, gy, p.z));
        d.g.visible = false; r.respawn = 60;
      }
    }
  }

  // keep props clear of grass, flowers and low bushes (those were scattered before the props existed)
  {
    const zones = [];
    for (const ch of world.chests) zones.push([ch.pos.x, ch.pos.z, ch.tier === 'luxurious' ? 2.0 : 1.25, ch.pos.y]);
    for (const s of statues) zones.push([s.pos.x, s.pos.z, 3.9, s.pos.y]);
    for (const w of WP) if (w.marker) zones.push([w.marker[0], w.marker[1], 1.5, gLow(w.marker[0], w.marker[1])]);
    for (const t of tablets) zones.push([t.pos.x, t.pos.z, 0.8, t.pos.y]);
    zones.push([dent.pos.x, dent.pos.z, 12.4, dent.pos.y - 0.5]);
    const prune = (mesh, lowOnly) => {
      if (!mesh) return 0;
      const a = mesh.instanceMatrix.array, c = mesh.instanceColor ? mesh.instanceColor.array : null, n = mesh.userData.n ?? mesh.count;
      let w = 0;
      for (let i = 0; i < n; i++) {
        const x = a[i * 16 + 12], y = a[i * 16 + 13], z = a[i * 16 + 14];
        let hit = false;
        for (const [zx, zz, zr, zy] of zones) if ((x - zx) ** 2 + (z - zz) ** 2 < zr * zr && (!lowOnly || y < zy + 2.2)) { hit = true; break; }
        if (hit) continue;
        if (w !== i) { for (let k = 0; k < 16; k++) a[w * 16 + k] = a[i * 16 + k]; if (c) for (let k = 0; k < 3; k++) c[w * 3 + k] = c[i * 3 + k]; }
        w++;
      }
      const cut = n - w;
      mesh.count = w; if (mesh.userData.n !== undefined) mesh.userData.n = w;
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      return cut;
    };
    const cut = [prune(nat.grass, false), prune(nat.flowers, false), prune(folMesh, true)];
    if (/debug/.test(location.search)) console.log('vegetation pruned', cut.join(','));
  }
  arena.root.visible = false;

  // ---------- map ----------
  setProgress(0.86, '绘制地图');
  await tick();
  const wmap = new WorldMap({
    heights: heightTex.userData.heights, res: heightTex.userData.res, colliders,
    labels: [
      { name: '虹之海湾', x: 20, z: -110, big: true }, { name: '海崖', x: spawn.x + 40, z: spawn.z + 20 },
      { name: '中央尖塔岛', x: -40, z: -262 }, { name: '尖塔车站', x: 95, z: -390 }, { name: '针塔岛', x: 40, z: -700 },
      { name: '西屿', x: -330, z: -625 }, { name: '远方城', x: coastX(-900) + 40, z: -980 }, { name: '瀑布', x: coastX(FALL_Z) + 30, z: FALL_Z - 18 },
      { name: '海湾新城', x: coastX(-60) + 95, z: -95 },
    ],
    roads: cityPlan.roads, paths: cityPlan.paths,
  });
  for (const w of WP) wmap.pois.push({ type: w.statue ? 'statue' : 'wp', x: w.statue ? w.statue.pos.x : w.x, z: w.statue ? w.statue.pos.z : w.z, name: w.name, note: w.note, wp: w });
  CAMPS.forEach((c, i) => {
    const camp = campObjs[i];
    const desc = c.list.map((s) => s.kind === 'warden' ? `礁岩守卫 Lv.${s.level}` : `史莱姆 Lv.${s.level}`).join('、');
    wmap.pois.push({ type: 'camp', x: c.x, z: c.z, name: c.name, note: desc, camp, done: () => camp.cleared || !!save.chests['camp-' + c.id] });
  });
  for (const [key, x, , z] of crystalSpots) {
    wmap.pois.push({ type: 'crystal', x, z, name: '虹晶', note: '漂浮在空中的七彩结晶。带到虹之像献上，每 4 枚提升 25 点体力上限。', hidden: () => save.crystals.includes(key) });
  }

  // ---------- portraits from the 3D models ----------
  setProgress(0.9, '绘制角色立绘');
  await tick();
  setPortraits(renderPortraits(CHAR_IDS));

  // ---------- UI ----------
  const ui = new UI({
    inv, player, isTouch,
    onUse: (id) => useItem(id),
    onEquip: (uid, who) => {
      const w = inv.weapons.find((x) => x.uid === uid); if (!w || !CHARS[who]) return;
      const old = inv.weaponOf(who);
      if (old && old !== w) old.owner = w.owner || null;
      w.owner = who; applyWeapons(); writeSave();
    },
    onPick: (i) => doPick(i),
    onRespawn: () => respawn(),
    onBagToggle: (open) => { if (open) setOverlay('bag'); else if (overlay === 'bag') setOverlay(null); },
  });
  ui.onSwitch = (i) => { if (player.switchTo(i)) afterSwitch(); };
  ui.getOwned = () => save.owned;
  ui.onModels = () => { syncModels(); applyWeapons(); refreshArt && refreshArt(); };
  ui.onPartyToggle = (id) => {
    const ids = player.party.map((m) => m.def.id);
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < 4 ? [...ids, id] : ids;
    if (!next.length) return;
    player.setParty(next); syncModels(); applyWeapons(); refreshArt();
    ui.buildParty(); ui.renderChars(); writeSave();
  };

  // ---------- 遗珍 ----------
  function refreshArt() {
    for (const m of Object.values(player.roster)) {
      const before = m.maxHp, ratio = before > 0 ? m.hp / before : 1;
      m.art = artStats(inv.equippedArts(m.def.id));
      if (!m.dead) m.hp = Math.max(1, Math.min(m.maxHp, Math.round(ratio * m.maxHp)));
    }
  }
  refreshArt();
  ui.onArt = (act, uid, who) => {
    const a = inv.artifact(uid); if (!a) return;
    if (act === 'equip') {
      const old = inv.artifacts.find((x) => x.owner === who && x.slot === a.slot);
      if (old && old !== a) old.owner = a.owner || null;
      a.owner = who;
      if (inv.equippedArts(who).length >= 5) ach.max('art5', 1);
    }
    if (act === 'unequip') a.owner = null;
    if (act === 'up') {
      const cost = upgradeCost(a);
      if (a.level >= MAX_LV[a.rarity]) return;
      if (inv.count('coin') < cost) { notice('虹贝不足', `还差 ${(cost - inv.count('coin')).toLocaleString('zh-CN')} 虹贝 · 开宝箱、击败敌人、回廊挑战和分解遗珍都能获得`); return; }
      inv.remove('coin', cost); ui.lastUp = upgradeArtifact(a); ui.lastUpUid = a.uid;
    }
    if (act === 'salvage') {
      const v = salvageValue(a);
      askConfirm('分解遗珍', `分解「${SETS[a.set].pieces[a.slot]}」+${a.level}，获得 ${v} 虹贝。`, () => {
        inv.removeArtifact(a.uid); inv.add('coin', v); inv.fresh.delete('coin'); ui.sel = null;
        refreshArt(); writeSave(); ui.openBag(); ui.tab = 'artifact'; ui.renderBag();
      }, () => { ui.openBag(); ui.tab = 'artifact'; ui.renderBag(); });
      return;
    }
    refreshArt(); writeSave(); ui.renderBag();
  };
  ui.onOpenArts = () => { setOverlay(null); ui.tab = 'artifact'; ui.sel = null; ui.openBag(); };

  // ---------- confirm dialog ----------
  let confirmCbs = null;
  function askConfirm(title, msg, onYes, onNo) {
    confirmCbs = { onYes, onNo };
    $('cf-title').textContent = title; $('cf-msg').textContent = msg;
    setOverlay('confirm');
  }
  $('cf-yes').addEventListener('click', () => { const c = confirmCbs; confirmCbs = null; setOverlay(null); if (c && c.onYes) c.onYes(); if (!overlay) lock(); });
  $('cf-no').addEventListener('click', () => { const c = confirmCbs; confirmCbs = null; setOverlay(null); if (c && c.onNo) c.onNo(); if (!overlay) lock(); });

  // ---------- banner ----------
  let bannerT = 0;
  function banner(title, sub = '') {
    const el = $('banner'); $('bn-t').textContent = title; $('bn-s').textContent = sub;
    el.hidden = false; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); bannerT = 2.8;
  }

  // ---------- 虹露 (resin) ----------
  save.resin = save.resin && typeof save.resin.v === 'number' ? save.resin : { v: 160, t: Date.now() };
  const RESIN_MAX = 160, RESIN_COST = 20, RESIN_MS = 60000;
  const resinNow = () => {
    const r = save.resin, now = Date.now();
    if (r.v >= RESIN_MAX) { r.t = now; return r.v; }
    const gain = Math.floor((now - r.t) / RESIN_MS);
    if (gain > 0) { r.v = Math.min(RESIN_MAX, r.v + gain); r.t += gain * RESIN_MS; }
    return r.v;
  };
  const spendResin = (n) => { const v = resinNow(); if (v < n) return false; if (v >= RESIN_MAX) save.resin.t = Date.now(); save.resin.v = v - n; return true; };

  // ---------- 回廊 ----------
  save.domain = save.domain || { unlocked: false, clears: 0 };
  const sl = (el, level, a, r = 7.5, size = 1) => ({ kind: 'slime', el, level, size, dx: Math.cos(a) * r, dz: Math.sin(a) * r });
  const wd = (level, dx = 0, dz = -8) => ({ kind: 'warden', level, dx, dz });
  const N = -Math.PI / 2; // spawn side faces the player (who starts at +z)
  const DISORDER = '虹脉之石周围会涌出一圈不会消散的水幕。让曜的箭穿过它，折射成七色箭。';
  const DLEVELS = [
    { name: '第一重', ar: 1, rec: 15, time: 180, hpMul: 1, disorder: [DISORDER],
      waves: [[sl('pyro', 14, N - 0.7), sl('hydro', 14, N), sl('electro', 14, N + 0.7)], [sl('dendro', 15, N - 1), sl('pyro', 15, N - 0.35, 8, 1.2), sl('electro', 15, N + 0.35), sl('hydro', 15, N + 1)]],
      coin: 1200, exp: 80, arts: 1, extra: 0.35, weights: [[3, 45], [4, 50], [5, 5]] },
    { name: '第二重', ar: 3, rec: 25, time: 200, hpMul: 1, disorder: [DISORDER],
      waves: [[sl('pyro', 22, N - 0.9), sl('electro', 22, N - 0.3), sl('dendro', 22, N + 0.3), sl('hydro', 22, N + 0.9)], [wd(22), sl('pyro', 22, N - 1.2, 9), sl('electro', 22, N + 1.2, 9)]],
      coin: 1800, exp: 120, arts: 2, extra: 0.3, weights: [[3, 20], [4, 60], [5, 20]] },
    { name: '第三重', ar: 6, rec: 35, time: 240, hpMul: 1.3, disorder: [DISORDER, '敌人的生命值提高 30%。'],
      waves: [[sl('pyro', 30, N - 1.2), sl('electro', 30, N - 0.6), sl('dendro', 30, N), sl('hydro', 30, N + 0.6), sl('pyro', 30, N + 1.2)], [wd(30)], [wd(30, -4, -9), sl('electro', 30, N - 1.3, 9, 1.2), sl('dendro', 30, N + 1.3, 9, 1.2), sl('hydro', 30, N, 11)]],
      coin: 2600, exp: 160, arts: 2, extra: 0.5, weights: [[4, 55], [5, 45]] },
  ];
  const DNAME = '沉虹回廊';
  const D = { inside: false, li: 0, state: 'idle', timer: 0, camp: null, wave: 0, kills: 0, total: 0, curtain: null, hidden: [], nextWaveT: 0, startT: 0, sel: 0, flowerT: 0 };
  const domainWP = { id: 'domain', name: DNAME, note: '回廊入口。可在此进入回廊挑战，获取遗珍。', x: dent.front.x, z: dent.front.z, yaw: dent.yaw };
  dent.uni.uOn.value = save.domain.unlocked ? 1 : 0;
  wmap.pois.push({
    type: 'domain', x: dent.pos.x, z: dent.pos.z, name: DNAME,
    get note() { return save.domain.unlocked ? '回廊 · 产出「折光旅人」「潮音守望」遗珍。可直接传送到入口。' : '尚未解锁。前往回廊入口，按 F 解锁后即可传送。'; },
    get wp() { return save.domain.unlocked ? domainWP : null; },
    locked: () => !save.domain.unlocked,
  });
  const domainIcon = { svg: (extra) => MAP_ICONS.domain.replace('<svg', '<svg ' + extra) };
  const arLv = () => 1 + Math.floor(Math.sqrt(save.exp / 25));

  function renderDomainPanel() {
    const L = DLEVELS[D.sel], ar = arLv();
    $('dp-levels').innerHTML = DLEVELS.map((l, i) => {
      const locked = ar < l.ar;
      return `<button type="button" class="dp-lv${i === D.sel ? ' on' : ''}${locked ? ' locked' : ''}" data-i="${i}"><b>${l.name}</b><span>${locked ? `旅程等级 ${l.ar} 解锁` : `推荐等级 ${l.rec}`}</span></button>`;
    }).join('');
    const locked = ar < L.ar;
    const rw = [
      ...['prism', 'tide'].map((set) => ({ item: { name: SETS[set].name, rarity: L.weights[L.weights.length - 1][0], svg: (x) => artifactSVG({ set, slot: 'flower' }, x) }, label: SETS[set].name })),
      { item: ITEMS.advexp, label: `旅程经验 ×${L.exp}` }, { item: ITEMS.coin, label: `虹贝 ×${L.coin}` },
    ];
    const stars = L.weights.map((w) => w[0]);
    $('dp-card').innerHTML = `
      <header><h3>${L.name}</h3><span class="dp-rec">推荐等级 ${L.rec}</span></header>
      <section><h4>挑战目标</h4><p>在 ${L.time} 秒内击败所有敌人（共 ${L.waves.length} 波）</p></section>
      <section><h4>回廊异象</h4>${L.disorder.map((d) => `<p class="dp-dis">${d}</p>`).join('')}</section>
      <section><h4>可能获得</h4><div class="dp-rw">${rw.map((r) => `<div class="rw-card" title="${r.label}"><span class="c-art" style="background:linear-gradient(160deg, ${RARITY_BG[r.item.rarity][0]}, ${RARITY_BG[r.item.rarity][1]})">${iconSVG(r.item)}</span><span class="c-n">${r.label}</span></div>`).join('')}</div>
        <p class="dp-note">遗珍稀有度：${stars.map((s) => s + '★').join(' / ')}</p></section>
      <footer><span class="dp-resin">${iconSVG(ITEMS.resin)}<b>${resinNow()}</b>/${RESIN_MAX}<button type="button" class="plus" data-edit="resin" aria-label="修改虹露">+</button> <em>领取奖励消耗 ${RESIN_COST}</em></span>
        <button type="button" class="bd-btn" id="dp-go"${locked ? ' disabled' : ''}><i></i>${locked ? `旅程等级 ${L.ar} 解锁` : '开始挑战'}</button></footer>`;
  }
  $('dp-levels').addEventListener('click', (e) => { const b = e.target.closest('.dp-lv'); if (b) { D.sel = +b.dataset.i; renderDomainPanel(); } });
  $('dp-card').addEventListener('click', (e) => { if (e.target.closest('#dp-go')) enterDomain(D.sel); });
  $('dp-close').addEventListener('click', () => closeOverlay(true));

  function setDomainGoal() {
    const L = DLEVELS[D.li];
    $('dh-name').textContent = `${DNAME} · ${L.name}`;
    const g = D.state === 'ready' ? '启动虹脉之石' : D.state === 'fight' ? `击败所有敌人 ${D.kills}/${D.total}` : D.state === 'done' ? '领取虹光之花的奖励' : '挑战已完成';
    $('dh-goal').textContent = g;
    $('dh-goal').parentElement.classList.toggle('done', D.state === 'done' || D.state === 'claimed');
  }
  function hideWorld(on) {
    if (on) {
      const keep = new Set([arena.root, sky, water, cumulus, ...player.party.map((m) => m.model.root)]);
      D.hidden = scene.children.filter((o) => o.visible && !keep.has(o) && !o.isLight);
      for (const o of D.hidden) o.visible = false;
    } else { for (const o of D.hidden) o.visible = true; D.hidden = []; }
    arena.root.visible = on;
  }
  function clearDomainEnemies() {
    for (const c of combat.camps.filter((c) => c.domain)) { for (const e of c.enemies) { e.alive = false; e.removed = true; } }
    combat.camps = combat.camps.filter((c) => !c.domain);
    if (D.curtain) { D.curtain.dur = Math.min(D.curtain.dur, D.curtain.t + 0.6); D.curtain = null; }
    D.camp = null;
  }
  function resetArena() {
    clearDomainEnemies();
    D.state = 'ready'; D.kills = 0; D.wave = 0; D.nextWaveT = 0;
    D.total = DLEVELS[D.li].waves.reduce((n, w) => n + w.length, 0);
    D.timer = DLEVELS[D.li].time;
    arena.flower.visible = false; arena.orbMat.emissive.set('#7fd8ff');
    player.respawn(arena.start.x, arena.start.y + 0.3, arena.start.z);
    player.facing = arena.startYaw + Math.PI; cam.yaw = arena.startYaw; cam.pitch = 0.2;
    cam.target.copy(player.pos).add(new THREE.Vector3(0, 1.45, 0));
    $('dtimer').hidden = true;
    setDomainGoal();
  }
  function enterDomain(li) {
    D.li = li;
    const fl = $('flash'); fl.classList.add('on');
    closeOverlay(true);
    setTimeout(() => {
      hideWorld(true);
      D.inside = true; D.safe = null; document.body.classList.add('in-domain');
      $('dhud').hidden = false;
      resetArena();
      fl.classList.remove('on');
      banner(DNAME, DLEVELS[li].name);
    }, 320);
  }
  function leaveDomain(target = domainWP) {
    const fl = $('flash'); fl.classList.add('on');
    setOverlay(null);
    setTimeout(() => {
      clearDomainEnemies();
      hideWorld(false);
      D.inside = false; D.state = 'idle'; document.body.classList.remove('in-domain');
      $('dhud').hidden = true; $('dtimer').hidden = true;
      arena.flower.visible = false;
      const p = wpPos(target);
      if (player.party.some((m) => m.dead)) player.respawn(p.x, p.y + 0.3, p.z); else player.teleport(p.x, p.y + 0.3, p.z);
      player.facing = target.yaw + Math.PI; cam.yaw = target.yaw; cam.pitch = 0.15;
      cam.target.copy(player.pos).add(new THREE.Vector3(0, 1.45, 0));
      fl.classList.remove('on');
      lock(); writeSave();
      story.emit('leftDomain');
    }, 320);
  }
  function startChallenge() {
    if (D.state !== 'ready') return;
    D.state = 'fight'; D.startT = performance.now();
    D.curtain = combat.addCurtain(arena.center.x, arena.center.y, arena.center.z, 3.4, 1e9);
    arena.orbMat.emissive.set('#ff8a6a');
    fx.ring(arena.center.clone().setY(arena.center.y + 0.1), 12, '#bfe8ff', 1.0, 1.4);
    $('dtimer').hidden = false;
    spawnWave(0);
    banner('挑战开始');
    setDomainGoal();
  }
  function spawnWave(i) {
    const L = DLEVELS[D.li];
    D.wave = i;
    const camp = combat.addCamp({ id: 'domain', name: DNAME, x: arena.center.x, z: arena.center.z, list: L.waves[i], noRespawn: true, noLoot: true, domain: true });
    for (const e of camp.enemies) {
      e.maxHp = Math.round(e.maxHp * L.hpMul); e.hp = e.maxHp; e.hpShown = e.hp;
      e.home.set(arena.center.x, e.pos.y, arena.center.z);
      e.aggro = true; e.state = 'chase';
      e.bounds = { x: arena.center.x, z: arena.center.z, r: ARENA.r - 1.4, y: arena.center.y }; e.stallT = 0;
      fx.ring(e.pos.clone().setY(e.pos.y + 0.05), e.isWarden ? 3 : 1.6, '#c39bff', 0.6, 1.2);
      fx.sparks(e.pos.clone().setY(e.pos.y + 1), '#e6d6ff', 12, 5, 0.4, 0.6, 2);
    }
    D.camp = camp;
  }
  function domainWaveClear(camp) {
    combat.camps = combat.camps.filter((c) => c !== camp);
    if (D.state !== 'fight') return;
    if (D.wave + 1 < DLEVELS[D.li].waves.length) D.nextWaveT = 1.6;
    else completeChallenge();
  }
  function completeChallenge() {
    D.state = 'done';
    ach.bump('domains');
    setTimeout(() => story.emit('domainClear'), 1600);
    if (D.curtain) { D.curtain.dur = D.curtain.t + 0.8; D.curtain = null; }
    arena.orbMat.emissive.set('#ffe27a');
    arena.flower.visible = true; D.flowerT = 0;
    $('dtimer').hidden = true;
    const secs = Math.round((performance.now() - D.startT) / 1000);
    banner('挑战完成', `用时 ${Math.floor(secs / 60)} 分 ${secs % 60} 秒`);
    setDomainGoal();
  }
  function failChallenge(reason) {
    if (D.state === 'fail') return;
    D.state = 'fail';
    clearDomainEnemies();
    $('dtimer').hidden = true;
    $('df-why').textContent = reason;
    setOverlay('dfail');
  }
  const rollRarity = (w) => { const t = w.reduce((s, x) => s + x[1], 0); let r = Math.random() * t; for (const [k, v] of w) { r -= v; if (r <= 0) return k; } return w[0][0]; };
  function claimReward() {
    if (D.state !== 'done') return;
    if (!spendResin(RESIN_COST)) { notice('虹露不足', `领取奖励需要 ${RESIN_COST} 虹露 · 虹露会随时间自动恢复`); return; }
    const L = DLEVELS[D.li];
    const got = [];
    const n = L.arts + (Math.random() < L.extra ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = inv.addArtifact(makeArtifact(Math.random() < 0.5 ? 'prism' : 'tide', rollRarity(L.weights)));
      got.push({ item: { name: SETS[a.set].pieces[a.slot], rarity: a.rarity, svg: (x) => artifactSVG(a, x) }, n: '+0', uid: a.uid });
    }
    const coin = Math.round(L.coin * (0.9 + Math.random() * 0.2));
    inv.add('coin', coin); addExp(L.exp);
    got.sort((a, b) => b.item.rarity - a.item.rarity);
    got.push({ item: ITEMS.advexp, n: L.exp }, { item: ITEMS.coin, n: coin });
    save.domain.clears = (save.domain.clears || 0) + 1;
    save.domain.first = save.domain.first || {};
    if (!save.domain.first[D.li]) { save.domain.first[D.li] = 1; inv.add('starlight', 40); got.push({ item: ITEMS.starlight, n: 40 }); }
    D.state = 'claimed'; arena.flower.visible = false;
    fx.sparks(arena.center.clone().setY(arena.center.y + 2.5), '#ffffff', 30, 6, 0.6, 1, 4);
    writeSave();
    rwGot = got;
    $('rw-detail').hidden = true;
    $('rw-items').innerHTML = got.map((g, i) => `<button type="button" class="rw-card" data-i="${i}" aria-label="查看${g.item.name}"><span class="c-art" style="background:linear-gradient(160deg, ${RARITY_BG[g.item.rarity][0]}, ${RARITY_BG[g.item.rarity][1]})">${iconSVG(g.item)}<span class="c-st">${'★'.repeat(g.item.rarity)}</span></span><span class="c-n">${g.n}</span></button>`).join('');
    $('rw-sub').textContent = `${DNAME} · ${L.name}`;
    $('rw-resin').innerHTML = `${iconSVG(ITEMS.resin)}虹露 ${resinNow()}/${RESIN_MAX}`;
    setTimeout(() => { if (D.state === 'claimed') setOverlay('dreward'); }, 500);
    setDomainGoal();
  }
  // tap a reward to inspect it (artifacts show main stat, sub stats and set bonuses)
  let rwGot = [];
  $('rw-items').addEventListener('click', (e) => {
    const b = e.target.closest('.rw-card'); if (!b) return;
    const g = rwGot[+b.dataset.i]; if (!g) return;
    const a = g.uid && inv.artifact(g.uid);
    $('rw-dbody').innerHTML = a ? artDetailHTML(a, player) : `<div class="bd-head" style="background:linear-gradient(135deg, ${RARITY_BG[g.item.rarity][0]}, ${RARITY_BG[g.item.rarity][1]})"><div class="bd-ht"><h3>${g.item.name}</h3><p>获得数量 ${g.n}</p><span class="bd-st">${'★'.repeat(g.item.rarity)}</span></div><div class="bd-icon">${iconSVG(g.item)}</div></div><div class="bd-body"><p class="bd-desc">${g.item.desc || ''}</p></div>`;
    $('rw-detail').hidden = false; $('rw-dclose').focus();
  });
  $('rw-dclose').addEventListener('click', () => { $('rw-detail').hidden = true; });
  $('rw-detail').addEventListener('click', (e) => { if (e.target.id === 'rw-detail') $('rw-detail').hidden = true; });
  $('rw-again').addEventListener('click', () => { setOverlay(null); resetArena(); lock(); });
  $('rw-leave').addEventListener('click', () => leaveDomain());
  $('df-retry').addEventListener('click', () => { setOverlay(null); deathShown = false; resetArena(); lock(); });
  $('df-leave').addEventListener('click', () => leaveDomain());
  $('dh-leave').addEventListener('click', () => {
    if (D.state === 'fight') askConfirm('离开回廊', '挑战正在进行中，现在离开不会获得奖励。', () => leaveDomain());
    else if (D.state === 'done') askConfirm('离开回廊', '还没有领取虹光之花的奖励，确定离开吗？', () => leaveDomain());
    else leaveDomain();
  });
  function domainPicks() {
    const P = player.pos;
    if (!D.inside) {
      if (Math.hypot(P.x - dent.pos.x, P.z - dent.pos.z) < 6 && Math.abs(P.y - dent.pos.y) < 4) return [{ domain: 'gate', name: save.domain.unlocked ? DNAME : `解锁 ${DNAME}`, item: domainIcon, dist: 0 }];
      return [];
    }
    const dc = Math.hypot(P.x - arena.center.x, P.z - arena.center.z);
    if (D.state === 'ready' && dc < 3.6) return [{ domain: 'start', name: '启动虹脉之石', item: domainIcon, dist: 0 }];
    if (D.state === 'done' && dc < 3.6) return [{ domain: 'claim', name: `领取奖励（消耗虹露 ${RESIN_COST}）`, item: ITEMS.resin, dist: 0 }];
    if (D.state !== 'fight' && Math.hypot(P.x - arena.exitPos.x, P.z - arena.exitPos.z) < 4.5) return [{ domain: 'leave', name: '离开回廊', item: domainIcon, dist: 0 }];
    return [];
  }
  function domainInteract(kind) {
    if (kind === 'gate') {
      if (!save.domain.unlocked) {
        askConfirm('解锁回廊', `是否解锁「${DNAME}」？解锁后，回廊入口会成为新的传送点。`, () => {
          save.domain.unlocked = true; writeSave(); story.emit('domainUnlocked');
          D.unlockAnim = 0.001;
          fx.sparks(dent.gatePos.clone().setY(dent.gatePos.y + 3), '#ffffff', 30, 6, 0.6, 1, 4);
          fx.ring(dent.pos.clone(), 5, '#bfe8ff', 0.8, 1.4);
          banner('回廊已解锁', `${DNAME} · 已激活传送点`);
        });
      } else { D.sel = Math.max(0, DLEVELS.findLastIndex((l) => arLv() >= l.ar)); renderDomainPanel(); setOverlay('domain'); }
    }
    if (kind === 'start') startChallenge();
    if (kind === 'claim') claimReward();
    if (kind === 'leave') leaveDomain();
  }
  function updateDomain(dt) {
    dent.uni.uTime.value = time; arena.gateUni.uTime.value = time;
    dent.gem.rotation.y += dt * 1.2; dent.gem.position.y = 4.4 + 1.8 + 1.2 + Math.sin(time * 2) * 0.1;
    if (D.unlockAnim) { D.unlockAnim += dt; dent.uni.uOn.value = Math.min(1, D.unlockAnim / 1.2); if (D.unlockAnim > 1.2) D.unlockAnim = 0; }
    if (!D.inside) return;
    for (const [i, c] of arena.crystals.entries()) { c.rotation.y += dt * 0.8; c.position.y = arena.center.y + 10.4 + Math.sin(time * 1.5 + i) * 0.25; }
    arena.orb.position.y = arena.center.y + 1.9 + Math.sin(time * 2.2) * 0.12;
    if (arena.flower.visible) { D.flowerT += dt; const k = Math.min(1, D.flowerT / 0.8); arena.flower.scale.setScalar(0.2 + 0.8 * (1 - (1 - k) ** 3)); arena.petals.rotation.y += dt * 0.6; }
    // the player can never leave the platform: remember a safe spot, return there if anything goes wrong
    const pr = Math.hypot(player.pos.x - arena.center.x, player.pos.z - arena.center.z);
    if (player.mode === 'ground' && pr < ARENA.r - 1 && Math.abs(player.pos.y - arena.center.y) < 1.5) D.safe = player.pos.clone();
    if (!Number.isFinite(player.pos.x + player.pos.y + player.pos.z) || player.pos.y < arena.center.y - 4 || player.pos.y > arena.center.y + 16 || pr > ARENA.r + 0.5) {
      const s = D.safe || arena.start;
      player.teleport(s.x, s.y + 0.3, s.z); player.mode = 'ground';
      fx.ring(player.pos.clone().setY(s.y + 0.05), 1.6, '#bfe8ff', 0.6, 1.2);
    }
    if (D.failT > 0) { D.failT -= dt; if (D.failT <= 0) failChallenge('队伍全员倒下'); }
    if (D.state === 'fight') {
      D.timer -= dt;
      if (D.nextWaveT > 0) { D.nextWaveT -= dt; if (D.nextWaveT <= 0) spawnWave(D.wave + 1); }
      // stall guard: an enemy the player cannot reach for a while is brought back into the fight
      if (D.camp) for (const e of D.camp.enemies) {
        if (!e.alive) continue;
        const far = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) > 26 || Math.abs(e.pos.y - player.pos.y) > 3.5;
        e.stallT = far ? (e.stallT || 0) + dt : 0;
        if (e.stallT > 6) { e.stallT = 0; e.recover(combat.W, 'stall'); }
      }
      const t = Math.max(0, Math.ceil(D.timer));
      const txt = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      if ($('dt-t').textContent !== txt) { $('dt-t').textContent = txt; $('dtimer').classList.toggle('low', t <= 30); }
      setDomainGoal();
      if (D.timer <= 0) failChallenge('挑战时间耗尽');
    }
  }

  function useItem(id) {
    const it = ITEMS[id]; if (!it || it.tab !== 'food' || inv.count(id) <= 0) return;
    if (player.dead || player.c.dead) { toast('角色已倒下，无法使用'); return; }
    if (it.heal && !it.regen && !it.buff && player.hp >= player.maxHp) { toast('生命值已满'); return; }
    inv.remove(id, 1);
    if (it.heal) player.heal((it.heal.pct || 0) * player.maxHp + (it.heal.flat || 0));
    if (it.regen) player.regen = { left: it.regen.dur, pct: it.regen.pct };
    if (it.buff) {
      if (it.buff.atk) player.buffs.atk = { until: player.time + it.buff.dur, v: it.buff.atk };
      if (it.buff.stam) player.buffs.stam = { until: player.time + it.buff.dur, v: it.buff.stam };
    }
    writeSave();
  }
  function gain(list) {
    for (const [id, n] of list) {
      inv.add(id, n); ui.feed(id, n);
      if (id === 'scrap') ach.bump('drone', n);
    }
    writeSave();
  }
  let pickHold = 0;
  function doPick(i) {
    const entry = ui.pickList[i ?? ui.pickSel];
    if (!entry) return;
    if (entry.offer) { offerCrystals(); ui.pickKey = ''; return; }
    if (entry.domain) { domainInteract(entry.domain); ui.pickKey = ''; return; }
    if (entry.tablet) { ui.pickKey = ''; ach.add('tablets', entry.tablet.id); if (story.emit('tablet', entry.tablet.id)) { entry.tablet.glow = false; return; } toast(entry.tablet.text, 5); return; }
    if (entry.pick) { ui.pickKey = ''; entry.pick(); return; }
    if (entry.locked === 'light') { notice('琥珀光锁', '需要「聚光」光束：切换到弓手曜，站到晶石的另一侧，让光箭穿过晶石射向宝箱', 4.5); return; }
    const res = world.interact(entry);
    if (res === 'sealed') return;
    if (res && res.length) {
      gain(res);
      if (entry.chest) { ach.bump('chests'); if (entry.chest === 'luxurious') ach.bump('chestLux'); fx.sparks(entry.ref.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#ffe9a8', 20, 5, 0.5, 0.8, 4); addExp({ common: 20, exquisite: 40, precious: 60, luxurious: 100 }[entry.chest] || 20); }
    }
    ui.pickKey = '';
  }
  function offerCrystals() {
    const n = inv.count('rainbow'); if (!n) return;
    inv.remove('rainbow', n);
    save.offered += n; ach.bump('offer');
    const before = player.stamBonus;
    player.stamBonus = Math.floor(save.offered / 4) * 25; player.stam = player.maxStam;
    const near = statues.find((s) => s.inside);
    if (near) { fx.sparks(near.orb.getWorldPosition(new THREE.Vector3()), '#ffffff', 30, 6, 0.6, 1, 4); }
    if (player.stamBonus > before) toast(`体力上限提升至 ${player.maxStam}`);
    else toast(`再献上 ${4 - (save.offered % 4)} 枚虹晶，体力上限提升`);
    writeSave();
  }
  function onCrystal(key, pos) {
    if (!save.crystals.includes(key)) save.crystals.push(key);
    ach.max('crystals', save.crystals.length);
    inv.add('rainbow', 1); ui.feed('rainbow', 1); addExp(30);
    fx.sparks(pos, '#ffffff', 20, 5, 0.5, 0.9, 3); fx.ring(pos.clone().setY(player.pos.y), 2.5, '#ffd6f2', 0.6);
    writeSave();
  }
  function afterSwitch() {
    const m = player.c;
    fx.sparks(player.pos.clone().setY(player.pos.y + 1), m.def.elColor, 14, 4, 0.35, 0.5, 2);
    fx.ring(player.pos, 1.6, m.def.elColor, 0.4, 1.4);
  }
  function respawn() {
    let best = statues[0], bd = Infinity;
    for (const s of statues) { const d = s.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = s; } }
    const w = WP.find((x) => x.statue === best);
    const p = wpPos(w);
    player.respawn(p.x, p.y + 0.3, p.z);
    player.facing = w.yaw + Math.PI; cam.yaw = w.yaw; cam.pitch = 0.15;
    cam.target.copy(player.pos).add(new THREE.Vector3(0, 1.45, 0));
    ui.showDeath(false); deathShown = false; setOverlay(null);
    writeSave();
  }

  // ---------- post ----------
  let composer = null;
  const buildComposer = () => {
    if (composer) { composer.dispose(); composer = null; }
    if (quality === 'low') return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 0 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    // One stray NaN / Infinity pixel (a half-float overflow, a 0/0 in some shader) gets smeared by the bloom blur into a big
    // black block with stair-stepped edges. Scrub the frame before bloom sees it: NaN -> black dot, Infinity / huge -> a bright cap.
    composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        bool bad(vec3 v){ return v.r != v.r || v.g != v.g || v.b != v.b || abs(v.r) > 6.0e4 || abs(v.g) > 6.0e4 || abs(v.b) > 6.0e4; }
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          if (bad(c)) {   // fill from finite pixels a few texels away (a small NaN patch then disappears instead of leaving a dot)
            vec2 px = 1.0 / vec2(textureSize(tDiffuse, 0)); vec3 acc = vec3(0.0); float n = 0.0;
            for (int i = 0; i < 16; i++) {
              float a = float(i) * 0.3927, r = (i < 8 ? 6.0 : 14.0);
              vec3 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * px).rgb;
              if (!bad(s)) { acc += s; n += 1.0; }
            }
            c = n > 0.0 ? acc / n : vec3(0.0);
          }
          gl_FragColor = vec4(clamp(c, 0.0, 48.0), 1.0);
        }`,
    }));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.26, 0.5, 1.1));
    composer.addPass(new OutputPass());
  };
  buildComposer();

  // ---------- camera ----------
  const cam = { yaw: saved.yaw ?? heroYaw, pitch: saved.pitch ?? 0.1, dist: 6, distT: 6, target: player.pos.clone().add(new THREE.Vector3(0, 1.45, 0)), side: 0, fov: 56 };
  cam.target.copy(player.pos).add(new THREE.Vector3(0, 1.45, 0));
  const solidAt = (x, y, z) => {
    if (H(x, z) + 0.3 > y) return true;
    for (const c of colliders.near(x, z)) { if (c.tag === 'rail' || c.tag === 'prop' || (c.tag === 'tree' && c.type !== 'cyl')) continue; const s = colliders.span(c, x, z, 0.25); if (s && y < s[0] + 0.2 && y > s[1] - 0.2) return true; }
    return false;
  };
  const camRight = new THREE.Vector3(), aimTmp = new THREE.Vector3();
  let dbgCam = null; // debug: { p: [x,y,z], t: [x,y,z], fov }
  let cineCam = null, camTween = null, cineFrame = null;
  const updateCamera = (dt) => {
    if (dbgCam) { camera.position.set(...dbgCam.p); camera.lookAt(...dbgCam.t); if (dbgCam.fov && camera.fov !== dbgCam.fov) { camera.fov = dbgCam.fov; camera.updateProjectionMatrix(); } return; }
    if (cineCam) { camera.position.copy(cineCam.p); camera.lookAt(cineCam.t); if (camera.fov !== cineCam.fov) { camera.fov = cineCam.fov; camera.updateProjectionMatrix(); } return; }
    if (camTween) {
      const k = Math.min(1, (performance.now() - camTween.t0) / 1000 / camTween.dur), e = k * k * (3 - 2 * k);
      let dy = camTween.yaw - camTween.y0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      cam.yaw = camTween.y0 + dy * e; cam.pitch = camTween.p0 + (camTween.pitch - camTween.p0) * e;
      if (k >= 1) { const r = camTween.resolve; camTween = null; r(); }
    }
    const aiming = player.aiming;
    const want = player.pos.clone().add(new THREE.Vector3(0, player.mode === 'swim' ? 0.9 : aiming ? 1.6 : 1.45, 0));
    cam.target.lerp(want, Math.min(1, dt * (aiming ? 20 : 10)));
    const dT = aiming ? 2.6 : cam.distT;
    cam.dist += (dT - cam.dist) * Math.min(1, dt * 8);
    cam.side += ((aiming ? 0.75 : 0) - cam.side) * Math.min(1, dt * 10);
    const baseFov = window.innerWidth / window.innerHeight < 0.9 ? 68 : 56;
    const fovT = aiming ? baseFov - 10 : baseFov;
    if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix(); }
    const cp = Math.cos(cam.pitch);
    const off = new THREE.Vector3(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
    camRight.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    const pivot = cam.target.clone().addScaledVector(camRight, cam.side);
    // camera collision: probe the boom (centre + both sides of the near plane), pull in at once, ease back out
    let d = cam.dist;
    for (let i = 1; i <= 24; i++) {
      const t = d * i / 24, x = pivot.x + off.x * t, y = pivot.y + off.y * t, z = pivot.z + off.z * t;
      if (solidAt(x, y, z) || solidAt(x + camRight.x * 0.3, y, z + camRight.z * 0.3) || solidAt(x - camRight.x * 0.3, y, z - camRight.z * 0.3) || solidAt(x, y - 0.25, z)) { d = Math.max(0.8, t - 0.45); break; }
    }
    cam.cd = cam.cd === undefined || d < cam.cd ? d : cam.cd + (d - cam.cd) * Math.min(1, dt * 3);
    d = Math.min(d, cam.cd);
    camera.position.copy(pivot).addScaledVector(off, d);
    // steep ground right behind the player: slide the camera in rather than popping it over the slope
    for (let k = 0; k < 8 && d > 0.8 && camera.position.y < H(camera.position.x, camera.position.z) + 0.35; k++) { d = Math.max(0.8, d - 0.4); camera.position.copy(pivot).addScaledVector(off, d); }
    const floor = Math.max(H(camera.position.x, camera.position.z) + 0.35, 0.3);
    if (camera.position.y < floor) camera.position.y = floor;
    camera.lookAt(pivot);
    if (fx.shake > 0 && !reduceMotion) {
      const s = fx.shake * fx.shake * 0.25;
      camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s;
    }
    // aim ray from the screen centre
    if (aiming) {
      camera.getWorldDirection(aimTmp);
      let hit = null;
      const o = camera.position;
      for (let t = 2; t < 140; t += 0.8) {
        const x = o.x + aimTmp.x * t, y = o.y + aimTmp.y * t, z = o.z + aimTmp.z * t;
        for (const e of combat.enemies) { if (e.alive && Math.hypot(e.pos.x - x, e.pos.z - z) < e.radius && y > e.pos.y && y < e.pos.y + e.height) { hit = new THREE.Vector3(x, y, z); break; } }
        if (hit) break;
        if (solidAt(x, y, z) || y < -1) { hit = new THREE.Vector3(x, y, z); break; }
      }
      if (!hit) hit = o.clone().addScaledVector(aimTmp, 140);
      player.aimDir.copy(hit).sub(player.bowOrigin()).normalize();
      player.aimFacing = cam.yaw + Math.PI;
      player.aimPitch = -cam.pitch * 0.9;
    }
  };

  // ---------- 昼夜与时间 ----------
  mats.glass.emissive = new THREE.Color('#3a78c8'); mats.glass.emissiveIntensity = 0; mats.glass.userData.nightI = 0.35;
  const dayNight = new DayNight({ scene, sky, sun, hemi, water, renderer, cumulus, mountains, sunDir, nightMats: [...city.nightMats, mats.glass], nightFx: city.nightFx, save });
  const clockEl = $('clock');
  let clockT = 0;
  function updateClock(dt) {
    clockT -= dt; if (clockT > 0) return; clockT = 0.25;
    const f = fmtTime(dayNight.time), h = dayNight.hour, isDay = h >= 6 && h < 18.5;
    clockEl.innerHTML = `<i class="${isDay ? 'sun' : 'moon'}"></i>${f.text}`;
  }
  // time panel: jump to any minute within the next 48 hours (never backwards)
  let tpTarget = 0;
  const DAYS = ['今天', '明天', '后天'];
  function tpRender() {
    const now = dayNight.time, f0 = fmtTime(now), ft = fmtTime(tpTarget), dd = ft.day - f0.day;
    $('tp-now').textContent = `第 ${f0.day} 天 · ${f0.text}`;
    const diff = Math.round(tpTarget - now), hh = Math.floor(diff / 60), mm = diff % 60;
    $('tp-to').textContent = `${DAYS[dd] || ''} ${ft.text}`;
    $('tp-diff').textContent = diff > 0 ? `${hh ? hh + ' 小时 ' : ''}${mm} 分钟后` : '';
    $('tp-slider').value = diff;
    document.querySelectorAll('#tp-days button').forEach((b) => b.classList.toggle('on', +b.dataset.d === dd));
    if (document.activeElement !== $('tp-hh')) $('tp-hh').value = String(ft.hh).padStart(2, '0');
    if (document.activeElement !== $('tp-mm')) $('tp-mm').value = String(ft.mm).padStart(2, '0');
    // dial: 24 h ring, now and target hands
    const ang = (t) => ((t % 1440) / 1440) * 360;
    $('tp-hand-now').setAttribute('transform', `rotate(${ang(now)} 100 100)`);
    $('tp-hand-to').setAttribute('transform', `rotate(${ang(tpTarget)} 100 100)`);
    const a0 = ang(now) * Math.PI / 180, a1 = a0 + Math.min(diff, 1439.9) / 1440 * Math.PI * 2, R = 78;
    const P = (a) => `${(100 + Math.sin(a) * R).toFixed(2)} ${(100 - Math.cos(a) * R).toFixed(2)}`;
    // two half-arcs (never a degenerate near-closed single arc, which browsers draw around a shifted centre)
    const sw = Math.min(diff, 1440) / 1440 * Math.PI * 2;
    $('tp-arc').setAttribute('d', diff > 0 ? `M ${P(a0)} A ${R} ${R} 0 0 1 ${P(a0 + sw / 2)} A ${R} ${R} 0 0 1 ${P(a0 + sw)}` : '');
    $('tp-plus').textContent = diff >= 1440 ? `+${Math.floor(diff / 1440)} 天` : '';
    $('tp-go').disabled = diff <= 0;
  }
  const tpSet = (t) => { tpTarget = Math.min(dayNight.time + MAX_SKIP, Math.max(Math.floor(dayNight.time) + 1, Math.round(t))); tpRender(); };
  const nextAt = (hhmm) => { const day0 = Math.floor(dayNight.time / 1440) * 1440; let t = day0 + hhmm; while (t <= dayNight.time) t += 1440; return t; };
  function openTime() { tpTarget = nextAt(6 * 60); if (tpTarget - dayNight.time > MAX_SKIP) tpTarget = dayNight.time + 60; setOverlay('timep'); tpRender(); }
  $('tp-slider').addEventListener('input', (e) => tpSet(dayNight.time + +e.target.value));
  $('tp-fine').addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) tpSet(tpTarget + +b.dataset.m); });
  $('tp-quick').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) tpSet(nextAt(+b.dataset.q)); });
  $('tp-days').addEventListener('click', (e) => { const b = e.target.closest('[data-d]'); if (!b) return; const ft = fmtTime(tpTarget); tpSet((fmtTime(dayNight.time).day - 1 + +b.dataset.d) * 1440 + ft.hh * 60 + ft.mm); });
  const tpTyped = () => { const hh = Math.min(23, Math.max(0, +$('tp-hh').value || 0)), mm = Math.min(59, Math.max(0, +$('tp-mm').value || 0)); const ft = fmtTime(tpTarget); const t = (ft.day - 1) * 1440 + hh * 60 + mm; if (t <= dayNight.time || t > dayNight.time + MAX_SKIP) { $('tp-err').textContent = '只能前往未来 48 小时以内的时间'; return; } $('tp-err').textContent = ''; tpSet(t); };
  for (const id of ['tp-hh', 'tp-mm']) { $(id).addEventListener('change', tpTyped); $(id).addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') tpTyped(); }); }
  $('tp-close').addEventListener('click', () => closeOverlay(true));
  $('tp-go').addEventListener('click', () => {
    const to = tpTarget;
    setOverlay('timeskip');
    const f = fmtTime(to); $('ts-to').textContent = `第 ${f.day} 天 · ${f.text}`;
    dayNight.skipTo(to, () => { setTimeout(() => { if (overlay === 'timeskip') { setOverlay(null); lock(); } writeSave(); }, 350); });
  });

  // ---------- 主线: dialogue, quest tracker, cinematics ----------
  let beamPow = 1, skyFlick = 0;
  const setBands = (b) => { sky.material.uniforms.uBand.value = b.slice(); beamPow = 0.45 + 0.55 * Math.min(...b); };
  const setFlick = (v) => { skyFlick = v; };

  // dialogue box
  let dlg = null;
  const dlgEl = $('dialog');
  function dialog(lines) {
    return new Promise((resolve) => {
      const open = () => {
        dlg = { lines: lines.slice(), i: -1, resolve, typing: false, shown: 0, full: '', choosing: false };
        document.body.classList.add('talking');
        setOverlay('dialog');
        dlgNext();
      };
      // never open on top of another panel (reward screen, map…): wait until it closes
      if (overlay && overlay !== 'dialog') { const iv = setInterval(() => { if (!overlay) { clearInterval(iv); open(); } }, 250); } else open();
    });
  }
  function dlgShow(line) {
    const who = line.s, name = who ? SPEAKERS[who] || who : '';
    dlgEl.classList.toggle('narr', !who); dlgEl.classList.toggle('radio', who === 'radio');
    $('dlg-name').classList.toggle('hide', !who);
    $('dlg-who').textContent = name;
    const img = who && CHARS[who] ? portrait(who, 'bust') : null;
    $('dlg-av').innerHTML = img ? `<img src="${img}" alt="">` : '';
    $('dlg-choices').innerHTML = '';
    if (line.choice) {
      dlg.choosing = true; dlgEl.classList.add('choosing'); $('dlg-text').textContent = '';
      $('dlg-choices').innerHTML = line.choice.map((c, i) => `<button type="button" data-i="${i}">${c}</button>`).join('');
      return;
    }
    dlg.full = line.t; dlg.shown = 0; dlg.typing = true; dlgEl.classList.add('typing');
    $('dlg-text').textContent = '';
  }
  function dlgNext() {
    if (!dlg) return;
    dlg.i++;
    if (dlg.i >= dlg.lines.length) { const r = dlg.resolve; dlg = null; dlgEl.classList.remove('typing', 'choosing', 'narr', 'radio'); document.body.classList.remove('talking'); setOverlay(null); lock(); r(); return; }
    dlgShow(dlg.lines[dlg.i]);
  }
  function dlgAdvance() {
    if (!dlg || dlg.choosing) return;
    if (dlg.typing) { dlg.shown = dlg.full.length; $('dlg-text').textContent = dlg.full; dlg.typing = false; dlgEl.classList.remove('typing'); return; }
    dlgNext();
  }
  function dlgChoose(i) {
    if (!dlg || !dlg.choosing) return;
    const line = dlg.lines[dlg.i]; if (!line.choice[i]) return;
    dlg.choosing = false; dlgEl.classList.remove('choosing');
    const then = (line.then && line.then[i]) || [];
    dlg.lines.splice(dlg.i + 1, 0, { s: 'you', t: line.choice[i] }, ...then);
    dlgNext();
  }
  dlgEl.addEventListener('click', (e) => {
    const c = e.target.closest('#dlg-choices button'); if (c) { dlgChoose(+c.dataset.i); return; }
    if (e.target.closest('#dlg-skip')) { while (dlg) { if (dlg.choosing) dlgChoose(0); else { dlg.typing = false; dlgNext(); } } return; }
    dlgAdvance();
  });
  function dlgTick(dt) {
    if (!dlg || !dlg.typing) return;
    dlg.shown = Math.min(dlg.full.length, dlg.shown + dt * 34);
    $('dlg-text').textContent = dlg.full.slice(0, Math.floor(dlg.shown));
    if (dlg.shown >= dlg.full.length) { dlg.typing = false; dlgEl.classList.remove('typing'); }
  }

  // opening cinematic: over the bay, the rainbow flickers and its violet fades
  let cineSkip = () => {};
  function intro(onFade) {
    return new Promise((resolve) => {
      document.body.classList.add('cine');
      setOverlay('cine'); $('cine').classList.remove('out');
      // the story begins on the cliff deck, wherever an older save left the party
      if (!D.inside) { player.teleport(spawn.x, g(spawn.x, spawn.z) + 0.3, spawn.z); player.facing = heroYaw + Math.PI; }
      const T = 16.5, P0 = new THREE.Vector3(10, 46, -60), T0 = new THREE.Vector3(-60, 34, -320);
      const P1 = new THREE.Vector3(spawn.x + 4, 22, spawn.z - 12), T1 = new THREE.Vector3(-30, 24, -240);
      const P2 = new THREE.Vector3(spawn.x + Math.sin(heroYaw) * 6, player.pos.y + 2.6, spawn.z + Math.cos(heroYaw) * 6), T2 = player.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
      cineCam = { p: P0.clone(), t: T0.clone(), fov: 50 };
      let t = 0, card = -1, faded = false, done = false;
      const cards = [[0.8, 3.6], [4.6, 3.6], [8.4, 3.4], [12.0, 2.6]];
      const text = $('cine-text');
      const finish = () => {
        if (done) return; done = true;
        if (!faded) { faded = true; onFade(); }
        $('flash').classList.add('on');
        setTimeout(() => {
          cineCam = null; cineFrame = null; text.classList.remove('on');
          cam.yaw = heroYaw; cam.pitch = 0.1; cam.target.copy(player.pos).add(new THREE.Vector3(0, 1.45, 0));
          $('cine').classList.add('out'); document.body.classList.remove('cine');
          setTimeout(() => { $('flash').classList.remove('on'); }, 200);
          setTimeout(() => { if (overlay === 'cine') setOverlay(null); resolve(); }, 900);
        }, 260);
      };
      cineSkip = finish;
      cineFrame = (dt) => {
        if (done) return;
        t += dt;
        const k1 = Math.min(1, t / 11), e1 = k1 * k1 * (3 - 2 * k1), k2 = Math.max(0, Math.min(1, (t - 11) / 5)), e2 = k2 * k2 * (3 - 2 * k2);
        cineCam.p.copy(P0).lerp(P1, e1).lerp(P2, e2); cineCam.t.copy(T0).lerp(T1, e1).lerp(T2, e2);
        let c = -1; for (let i = 0; i < cards.length; i++) if (t >= cards[i][0] && t < cards[i][0] + cards[i][1]) c = i;
        if (c !== card) { card = c; if (c >= 0) { text.textContent = INTRO_CARDS[c]; text.classList.add('on'); } else text.classList.remove('on'); }
        if (t > 11.2 && t < 13.2) skyFlick = 1;
        if (t > 12.4 && !faded) { faded = true; onFade(); }
        if (t >= T) finish();
      };
    });
  }
  $('cine-skip').addEventListener('click', () => cineSkip());

  // chapter card
  let chapterDone = () => {};
  function chapterCard(title, sub, next) {
    return new Promise((resolve) => {
      $('chc-k').textContent = '主线'; $('chc-t').textContent = title; $('chc-s').textContent = sub; $('chc-n').textContent = next;
      setOverlay('chapter');
      const t0 = performance.now();
      chapterDone = () => { if (performance.now() - t0 < 1200) return; chapterDone = () => {}; setOverlay(null); lock(); resolve(); };
    });
  }
  $('chapter').addEventListener('click', () => chapterDone());

  // quest tracker + on-screen marker + map marker
  let quest = null;
  const qEl = $('quest'), qm = $('qmark');
  function setObjective(o) {
    const prev = quest && quest.text;
    quest = o;
    qEl.hidden = !o;
    if (!o) { qm.hidden = true; return; }
    $('q-title').textContent = o.title; $('q-text').textContent = o.text; $('q-hint').textContent = o.hint || '';
    qEl.classList.toggle('done', !!o.done);
    if (prev !== o.text) { qEl.classList.remove('flash'); void qEl.offsetWidth; qEl.classList.add('flash'); }
  }
  const questTarget = () => (quest && quest.target ? quest.target() : null);
  qEl.addEventListener('click', () => { if (!overlay) setOverlay('map'); });
  const qv = new THREE.Vector3();
  function updateQuest(dt) {
    dlgTick(dt);
    const tg = questTarget();
    if (!tg || overlay || D.inside) { qm.hidden = true; $('q-dist').textContent = ''; return; }
    const d = Math.hypot(tg.x - player.pos.x, tg.z - player.pos.z);
    $('q-dist').textContent = `${Math.round(d)} m`;
    if (d < 3) { qm.hidden = true; return; }
    qv.copy(tg); qv.y += 2.6;
    const W = window.innerWidth, Hh = window.innerHeight, m = 40;
    qv.project(camera);
    let x = (qv.x * 0.5 + 0.5) * W, y = (-qv.y * 0.5 + 0.5) * Hh;
    const behind = qv.z > 1, off = behind || x < m || x > W - m || y < m || y > Hh - m;
    if (behind) { x = qv.x > 0 ? m : W - m; y = Hh * 0.5; }
    x = Math.min(W - m, Math.max(m, x)); y = Math.min(Hh - m, Math.max(m + 20, y));
    qm.hidden = false; qm.classList.toggle('edge', off);
    qm.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
    $('qm-d').textContent = `${Math.round(d)} m`;
  }
  wmap.pois.push({ type: 'quest', get x() { const t = questTarget(); return t ? t.x : 0; }, get z() { const t = questTarget(); return t ? t.z : 0; }, name: '主线任务', get note() { return quest ? `${quest.title} · ${quest.text}` : ''; }, hidden: () => !questTarget() });

  const story = createStory({
    save, writeSave, dialog, intro, chapterCard, setObjective, setBands, setFlick,
    onDone: () => ach.max('prologue', 1),
    onWake: () => toast(isTouch ? '左手移动 · 右手转视角 · 点头像换人' : '左键攻击 · E 技能 · Q 绝技 · 1–4 切换角色 · F 交互', 6),
    wait: (s) => new Promise((r) => setTimeout(r, s * 1000)),
    pos: { tablet: lockTablet.pos, lock: () => lockRef.pos, gate: dent.pos, front: dent.front },
    lockOpen: () => !!(lockRef.opened || lockRef.cageT || !lockRef.cage),
    domainUnlocked: () => !!save.domain.unlocked,
    inDomain: () => D.inside,
    player: () => player.pos,
    guide: (on) => { if (guide) guide.set(on); },
    tabletGlow: (on) => { lockTablet.glow = on; },
    // ending shot: cut to the cliff deck, looking across the bay at the rainbow
    lookAtRainbow: () => new Promise((resolve) => {
      const fl = $('flash'); fl.classList.add('on'); document.body.classList.add('cine');
      setTimeout(() => {
        const p0 = new THREE.Vector3(spawn.x - 3, cityPlan.deckY + 2.2, spawn.z + 5), t0 = new THREE.Vector3(-40, 34, -230);
        cineCam = { p: p0.clone(), t: t0.clone(), fov: 52 };
        let t = 0; cineFrame = (dt) => { t += dt; cineCam.p.copy(p0).add(new THREE.Vector3(-t * 0.25, t * 0.08, -t * 0.3)); };
        fl.classList.remove('on'); setTimeout(resolve, 900);
      }, 300);
    }),
    endShot: () => { const fl = $('flash'); fl.classList.add('on'); setTimeout(() => { cineCam = null; cineFrame = null; document.body.classList.remove('cine'); fl.classList.remove('on'); }, 300); },
  });

  // ---------- 成就: popup, panel, world checks ----------
  const achQ = []; let achBusy = false;
  function achPopup(a) { achQ.push(a); if (!achBusy) achNext(); }
  function achNext() {
    const a = achQ.shift(); if (!a) { achBusy = false; return; }
    achBusy = true;
    const el = $('achpop');
    $('ap-name').textContent = a.name; $('ap-desc').textContent = a.desc; $('ap-rw').textContent = `流光 ×${a.reward}`;
    el.hidden = false; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    setTimeout(() => { el.classList.remove('on'); setTimeout(() => { el.hidden = true; achNext(); }, 450); }, 3600);
  }
  let achCat = 'wonder';
  const SL = iconSVG(ITEMS.starlight);
  function renderAchv() {
    const [d, n] = ach.stats();
    $('av-sum').innerHTML = `<b>${d}</b> / ${n}<span>完成度 ${Math.round(d / n * 100)}%</span>`;
    $('av-cats').innerHTML = ACH_CATS.map((c) => { const [cd, cn] = ach.stats(c.id); const unc = ACH.some((a) => a.cat === c.id && ach.s.done[a.id] && !ach.s.claimed[a.id]); return `<button type="button" class="av-cat${c.id === achCat ? ' sel' : ''}${unc ? ' dot' : ''}" data-c="${c.id}"><b>${c.name}</b><span>${cd} / ${cn}</span><i style="--p:${(cd / cn * 100).toFixed(0)}%"></i></button>`; }).join('');
    const list = ACH.filter((a) => a.cat === achCat).sort((x, y) => (+!!ach.s.claimed[x.id] - +!!ach.s.claimed[y.id]) || (+!ach.s.done[x.id] - +!ach.s.done[y.id]));
    $('av-list').innerHTML = `<p class="av-cdesc">${ACH_CATS.find((c) => c.id === achCat).desc}</p>` + list.map((a) => {
      const done = ach.isDone(a.id), claimed = !!ach.s.claimed[a.id], hide = a.hidden && !done;
      const goal = a.goal || 1, pr = Math.min(goal, ach.prog(a.key));
      const bar = goal > 1 && !done ? `<span class="av-bar"><i style="width:${(pr / goal * 100).toFixed(0)}%"></i></span><em>${pr} / ${goal}</em>` : '';
      const when = done ? `<em class="av-when">${new Date(ach.s.done[a.id]).toLocaleDateString('zh-CN')}</em>` : '';
      const btn = claimed ? '<span class="av-st ok">已领取</span>' : done ? `<button type="button" class="av-claim" data-id="${a.id}">领取</button>` : '<span class="av-st">未达成</span>';
      return `<div class="av-item${done ? ' done' : ''}${hide ? ' hid' : ''}"><span class="av-ic">${ACH_ICON}</span><div class="av-tx"><b>${hide ? '隐藏成就' : a.name}</b><p>${hide ? '？？？——继续探索，或许会有意外的发现。' : a.desc}</p>${bar}${when}</div><span class="av-rw">${SL}<small>×${a.reward}</small></span>${btn}</div>`;
    }).join('');
    $('av-claimall').disabled = !ach.claimable().length;
  }
  const claimAch = (ids) => { let sum = 0; for (const id of ids) sum += ach.claim(id); if (sum) { inv.add('starlight', sum); ui.feed('starlight', sum); writeSave(); } renderAchv(); };
  $('av-cats').addEventListener('click', (e) => { const b = e.target.closest('.av-cat'); if (b) { achCat = b.dataset.c; renderAchv(); } });
  $('av-list').addEventListener('click', (e) => { const b = e.target.closest('.av-claim'); if (b) claimAch([b.dataset.id]); });
  $('av-claimall').addEventListener('click', () => claimAch(ach.claimable().map((a) => a.id)));
  $('av-close').addEventListener('click', () => closeOverlay(true));
  // places and moments in the world
  const railPts = city.rail ? city.rail.curve.getSpacedPoints(Math.ceil(city.rail.L / 3)) : [];
  let achT = 0, carT = 0;
  function achWorld(dt) {
    if (city.carStopped) { carT += dt; city.carStopped = 0; if (carT > 1.2) ach.max('carStop', 1); } else carT = 0;
    achT -= dt; if (achT > 0) return; achT = 0.5;
    const P = player.pos;
    if (P.y > 48 && Math.hypot(P.x + 34, P.z + 205) < 10) ach.max('peak', 1);
    if (player.mode === 'ground' && P.y > g(P.x, P.z) - 0.1) for (const q of railPts) if (Math.abs(q.x - P.x) < 3 && Math.abs(q.z - P.z) < 3 && Math.abs(q.y - P.y) < 1.5) { ach.max('railWalk', 1); break; }
  }

  // ---------- P: give up the current challenge, then offer a 3-second shortcut back to its start ----------
  let restartP = null;
  function offerRestart(title, go) {
    const el = $('restartp');
    clearTimeout(offerRestart.t);
    $('rp-t').textContent = title;
    el.hidden = false; el.classList.remove('run'); void el.offsetWidth; el.classList.add('run');
    restartP = { go: () => { el.hidden = true; restartP = null; clearTimeout(offerRestart.t); const fl = $('flash'); fl.classList.add('on'); setTimeout(() => { go(); fl.classList.remove('on'); }, 260); } };
    offerRestart.t = setTimeout(() => { el.hidden = true; restartP = null; }, 3000);
  }
  $('rp-go').addEventListener('click', () => restartP && restartP.go());
  $('dt-quit').addEventListener('click', (e) => { e.stopPropagation(); quitChallenge(); });
  function quitChallenge() {
    if (D.inside && D.state === 'fight') {
      clearDomainEnemies();
      D.state = 'ready'; D.kills = 0; D.wave = 0; D.nextWaveT = 0; D.timer = DLEVELS[D.li].time;
      arena.orbMat.emissive.set('#7fd8ff'); $('dtimer').hidden = true; setDomainGoal();
      toast('已结束挑战');
      offerRestart('传送回虹脉之石，重新开始挑战？', () => {
        player.respawn(arena.center.x, arena.center.y + 0.3, arena.center.z + 2.6);
        player.facing = Math.PI; cam.yaw = 0; cam.pitch = 0.2; cam.target.copy(player.pos).add(new THREE.Vector3(0, 1.45, 0));
        setTimeout(() => { if (D.inside && D.state === 'ready' && !player.dead) startChallenge(); }, 900);
      });
      return true;
    }
    const c = puzzles.challenge();
    if (c) { c.quit(); toast('已结束挑战'); offerRestart(`传送回「${c.name}」的起点，重新开始？`, c.restart); return true; }
    return false;
  }

  // ---------- number editing (test mode): click a + beside any count ----------
  let numEdit = null;
  function editNumber(title, value, onSet) {
    numEdit = onSet;
    $('ne-t').textContent = title; const inp = $('ne-v'); inp.value = value;
    $('numedit').hidden = false; setTimeout(() => { inp.focus(); inp.select(); }, 30);
  }
  const neClose = (ok) => {
    if (ok && numEdit) { const v = Math.max(0, Math.min(9999999, Math.floor(+$('ne-v').value || 0))); numEdit(v); writeSave(); }
    numEdit = null; $('numedit').hidden = true;
  };
  $('ne-ok').addEventListener('click', () => neClose(true));
  $('ne-no').addEventListener('click', () => neClose(false));
  $('ne-v').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') neClose(true); if (e.key === 'Escape') neClose(false); });
  const setCount = (id, v) => { const c = inv.count(id); if (v > c) inv.add(id, v - c); else if (v < c) inv.remove(id, c - v); inv.fresh.delete(id); };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const id = b.dataset.edit;
    if (id === 'resin') { editNumber('虹露', resinNow(), (v) => { save.resin = { v, t: Date.now() }; if (overlay === 'domain') renderDomainPanel(); }); return; }
    const it = ITEMS[id]; if (!it) return;
    editNumber(it.name, inv.count(id), (v) => { setCount(id, v); ui.renderBag(); if (overlay === 'gacha') renderGacha(); });
  }, true);

  // ---------- start over: wipe the save and reload ----------
  function resetAll() {
    askConfirm('重新开始', '清除所有存档（角色、物品、宝箱、成就、剧情进度），回到最开始的状态。此操作不能撤销。', () => {
      started = false;
      try { for (const k of Object.keys(localStorage)) if (k.startsWith('rainbow-sea:') && k !== 'rainbow-sea:quality') localStorage.removeItem(k); } catch (e) { /* ignore */ }
      writeSave = () => {};
      location.reload();
    }, () => setOverlay('menu'));
  }

  // ---------- overlays & pointer lock ----------
  let overlay = null; // 'bag' | 'map' | 'menu' | 'chars' | 'help' | 'death'
  let started = false, deathShown = false;
  const canvas = renderer.domElement;
  let suppressMenu = false, lockFailed = false, menuAt = 0, softLock = false, lockErrs = 0;
  // soft = a re-lock attempt that has no fresh click behind it (e.g. releasing Alt): the browser may refuse it, and that must not
  // count as "pointer lock is unavailable" - the next real click simply tries again.
  const lock = (soft = false) => {
    if (isTouch || lockFailed || document.pointerLockElement === canvas) return;
    softLock = soft;
    try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* drag still works */ }
  };
  const unlock = () => { if (document.pointerLockElement) { suppressMenu = true; document.exitPointerLock(); } };
  const PANEL_EL = { timep: 'timep', timeskip: 'timeskip', achv: 'achv', domain: 'dpanel', confirm: 'confirm', dreward: 'dreward', dfail: 'dfail', gacha: 'gacha', gachaPlay: 'gacha-play', dialog: 'dialog', cine: 'cine', chapter: 'chapter' };
  function setOverlay(name) {
    const prev = overlay;
    if (PANEL_EL[prev] && prev !== name) $(PANEL_EL[prev]).hidden = true;
    if (PANEL_EL[name]) $(PANEL_EL[name]).hidden = false;
    overlay = name;
    if (prev === 'map' && name !== 'map') $('map').hidden = true;
    if (prev === 'menu' && name !== 'menu') $('menu').hidden = true;
    if (prev === 'chars' && name !== 'chars') $('chars').hidden = true;
    if (prev === 'help' && name !== 'help') $('help').hidden = true;
    if (prev === 'bag' && name !== 'bag' && ui.bagOpen) { ui.bagOpen = false; $('bag').hidden = true; }
    if (name) unlock();
    if (name === 'map') openMap();
    if (name === 'menu') { openMenu(); menuAt = performance.now(); }
    if (name === 'chars') { ui.charSel = player.c.def.id; ui.renderChars(); $('chars').hidden = false; }
    if (name === 'help') $('help').hidden = false;
    if (name === 'gacha') renderGacha();
    if (name === 'achv') renderAchv();
    document.body.classList.toggle('overlay', !!name);
  }
  const closeOverlay = (relock) => { if (overlay === 'death') return; setOverlay(null); if (relock) lock(); };
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (locked) lockErrs = 0;
    $('lockhint').hidden = locked || !started || !!overlay || isTouch;
    if (!locked && started && !overlay && !suppressMenu && !isTouch) setOverlay('menu');
    suppressMenu = false;
  });
  document.addEventListener('pointerlockerror', () => {
    $('lockhint').hidden = isTouch || !started || !!overlay;
    if (softLock) return;                       // refused without a click: just wait for the next click
    if (++lockErrs >= 3) lockFailed = true;     // only give up (drag-to-look mode) after repeated refusals to real clicks
  });

  // map overlay
  const mapCv = $('mapcv'), mapIcons = $('mapicons');
  function openMap() {
    $('map').hidden = false;
    const vp = D.inside ? dent.pos : player.pos;
    wmap.view.cx = vp.x; wmap.view.cz = vp.z; wmap.view.z = Math.min(window.innerWidth, window.innerHeight) / 260;
    wmap.selected = null; $('mapcard').hidden = true;
    const total = world.chests.length;
    const opened = world.chests.filter((c) => c.opened).length;
    $('mapprog').textContent = `虹晶 ${save.crystals.length}/12 · 宝箱 ${opened}/${total} · 营地 ${Object.keys(save.camps).length}/${CAMPS.length}`;
  }
  function selectPoi(i) {
    const p = wmap.pois[i]; wmap.selected = i;
    const card = $('mapcard');
    let status = '';
    if (p.type === 'camp') status = `<p class="mc-st ${p.done() ? 'done' : ''}">${p.done() ? '已清理' : '魔物出没'}</p>`;
    card.innerHTML = `<div class="mc-ic ${p.type}"></div><h3>${p.name}</h3><p>${p.note}</p>${status}${p.wp ? '<button type="button" class="bd-btn" id="mc-tp">传送</button>' : ''}`;
    card.hidden = false;
    const b = $('mc-tp'); if (b) b.addEventListener('click', () => { teleportTo(p.wp); });
  }
  mapIcons.addEventListener('click', (e) => { const b = e.target.closest('.micon'); if (b) selectPoi(+b.dataset.i); });
  {
    const ptrs = new Map(); let pinch = 0, moved = 0;
    mapCv.addEventListener('pointerdown', (e) => { mapCv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    mapCv.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (ptrs.size === 1) { wmap.view.cx -= dx / wmap.view.z; wmap.view.cz -= dy / wmap.view.z; wmap.clamp(); }
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) wmap.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch, mapCv.clientWidth, mapCv.clientHeight); pinch = d; }
    });
    const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; if (moved < 5 && ptrs.size === 0) { wmap.selected = null; $('mapcard').hidden = true; } };
    mapCv.addEventListener('pointerup', up); mapCv.addEventListener('pointercancel', up);
    mapCv.addEventListener('wheel', (e) => { e.preventDefault(); wmap.zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1 / 1.15 : 1.15, mapCv.clientWidth, mapCv.clientHeight); }, { passive: false });
    $('map-zin').addEventListener('click', () => wmap.zoomAt(mapCv.clientWidth / 2, mapCv.clientHeight / 2, 1.3, mapCv.clientWidth, mapCv.clientHeight));
    $('map-zout').addEventListener('click', () => wmap.zoomAt(mapCv.clientWidth / 2, mapCv.clientHeight / 2, 1 / 1.3, mapCv.clientWidth, mapCv.clientHeight));
    $('map-me').addEventListener('click', () => { wmap.view.cx = player.pos.x; wmap.view.cz = player.pos.z; });
    $('map-close').addEventListener('click', () => closeOverlay(true));
  }

  // pause menu
  const arLevel = () => { const lv = 1 + Math.floor(Math.sqrt(save.exp / 25)); const cur = 25 * (lv - 1) ** 2, nxt = 25 * lv ** 2; return [lv, (save.exp - cur) / (nxt - cur)]; };
  function openMenu() {
    const m = player.c.def;
    const [lv, f] = arLevel();
    $('mn-av').innerHTML = avatarSVG(m, 120);
    $('mn-lv').textContent = `旅程等级 ${lv}`;
    $('mn-exp').style.transform = `scaleX(${f.toFixed(3)})`;
    $('mn-talk').textContent = '阿虹：「' + COMPANION[Math.floor(Math.random() * COMPANION.length)] + '」';
    const opened = world.chests.filter((c) => c.opened).length;
    $('mn-stats').innerHTML = `<div><b>${save.crystals.length}<small>/12</small></b><span>虹晶</span></div><div><b>${opened}<small>/${world.chests.length}</small></b><span>宝箱</span></div><div><b>${Object.keys(save.camps).length}<small>/${CAMPS.length}</small></b><span>营地</span></div><div><b>${player.maxStam}</b><span>体力上限</span></div>`;
    $('mn-q').textContent = '画质：' + { high: '高', mid: '中', low: '低' }[quality];
    $('menu').hidden = false;
  }
  $('menu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]'); if (!b) { if (e.target.id === 'menu') closeOverlay(true); return; }
    const a = b.dataset.m;
    if (a === 'resume') closeOverlay(true);
    if (a === 'bag') { setOverlay(null); ui.openBag(); }
    if (a === 'chars') setOverlay('chars');
    if (a === 'map') setOverlay('map');
    if (a === 'help') setOverlay('help');
    if (a === 'gacha') setOverlay('gacha');
    if (a === 'achv') setOverlay('achv');
    if (a === 'reset') resetAll();
    if (a === 'time') openTime();
    if (a === 'quality') { setQ(quality === 'high' ? 'mid' : quality === 'mid' ? 'low' : 'high'); $('mn-q').textContent = '画质：' + { high: '高', mid: '中', low: '低' }[quality]; }
  });
  $('chars-close').addEventListener('click', () => closeOverlay(true));
  $('help-close').addEventListener('click', () => closeOverlay(true));
  $('btn-menu').addEventListener('click', () => setOverlay('menu'));
  $('btn-bag').addEventListener('click', () => { if (!player.dead) ui.toggleBag(); });
  $('btn-map').addEventListener('click', () => setOverlay('map'));
  $('btn-chars').addEventListener('click', () => setOverlay('chars'));
  $('btn-gacha').addEventListener('click', () => setOverlay('gacha'));
  $('maplegend').innerHTML = [['wp', '航标'], ['statue', '虹之像'], ['domain', '回廊'], ['camp', '魔物营地'], ['crystal', '虹晶']].map(([k, n]) => `<span><i class="lg">${MAP_ICONS[k]}</i>${n}</span>`).join('');
  $('minimap').addEventListener('click', () => setOverlay('map'));

  // ---------- 拾光 ----------
  const gscene = new GachaScene();
  let gBanner = 0, gPlay = null;
  const isChar = (id) => !!CHARS[id];
  const nameOf = (id) => isChar(id) ? CHARS[id].name : ITEMS[id].name;
  const rarityOf = (id) => isChar(id) ? CHARS[id].rarity : ITEMS[id].rarity;
  const ico = (id) => iconSVG(ITEMS[id]);
  function renderGacha() {
    const B = BANNERS[gBanner];
    $('gc-tabs').innerHTML = BANNERS.map((b, i) => `<button type="button" class="gc-tab${i === gBanner ? ' on' : ''}" data-i="${i}" style="--c1:${b.color[0]};--c2:${b.color[1]}"><img src="${portrait(b.feat5, 'bust') || ''}" alt=""><span>${b.name}</span></button>`).join('');
    $('gc-star').innerHTML = `${ico('starlight')}${inv.count('starlight')}<button type="button" class="plus" data-edit="starlight" aria-label="修改流光数量">+</button>`;
    $('gc-bottle').innerHTML = `${ico('bottle')}${save.freePulls ? '∞' : inv.count('bottle')}<button type="button" class="plus" data-edit="bottle" aria-label="修改漂流瓶数量">+</button>`;
    $('gc-free').classList.toggle('on', !!save.freePulls);
    const f5 = CHARS[B.feat5];
    const feats = [B.feat5, ...B.feat4].map((id) => `<div class="gc-fc"><img src="${portrait(id, 'bust') || ''}" alt=""><b>${CHARS[id].name}</b><i>${'★'.repeat(CHARS[id].rarity)} · ${CHARS[id].element}</i></div>`).join('');
    const bn = $('gc-banner'); bn.style.setProperty('--c1', B.color[0]); bn.style.setProperty('--c2', B.color[1]);
    bn.innerHTML = `<div class="gc-text"><span class="gc-kick">${B.kicker}</span><h2>${B.name}</h2><p>${B.blurb}</p><p>${f5.title} · ${f5.role}</p><div class="gc-feat">${feats}</div></div>
      <div class="gc-art"><img src="${portrait(B.feat5, 'full') || ''}" alt="${f5.name}"><span class="gc-name">${f5.name}</span><span class="gc-stars">${'★'.repeat(f5.rarity)}</span></div>`;
    $('gc-1c').innerHTML = `${ico('bottle')}× 1`; $('gc-10c').innerHTML = `${ico('bottle')}× 10`;
    const st = save.gacha, left = 90 - (st.pity[B.kind] || 0);
    $('gc-pity').textContent = `再拾光 ${left} 次内必定获得五星${B.kind === 'limited' ? (st.guar ? ' · 下一个五星必定是「' + f5.name + '」' : '') : ''} · 每 10 次至少一个四星`;
  }
  $('gc-tabs').addEventListener('click', (e) => { const b = e.target.closest('.gc-tab'); if (b) { gBanner = +b.dataset.i; renderGacha(); } });
  $('gc-close').addEventListener('click', () => closeOverlay(true));
  $('gc-free').addEventListener('click', () => { save.freePulls = !save.freePulls; writeSave(); renderGacha(); toast(save.freePulls ? '无限拾光：已开启（测试用）' : '无限拾光：已关闭'); });
  const gModal = (title, html) => { $('gc-mt').textContent = title; $('gc-mb').innerHTML = html; $('gc-modal').hidden = false; };
  $('gc-mclose').addEventListener('click', () => { $('gc-modal').hidden = true; });
  $('gc-info').addEventListener('click', () => {
    const B = BANNERS[gBanner];
    const list = (ids) => ids.map((id) => nameOf(id)).join('、');
    gModal('详情', `<h4>概率</h4><p>五星基础概率 0.6%，从第 74 次起每次提高 6%，90 次内必定获得五星。四星 5.1%，每 10 次内至少获得一个四星或以上。</p>
      ${B.kind === 'limited' ? `<p>获得五星时有 50% 的概率是「${CHARS[B.feat5].name}」；如果不是，下一个五星必定是「${CHARS[B.feat5].name}」。获得四星时有 50% 的概率是「${list(B.feat4)}」之一。</p>` : ''}
      <h4>五星</h4><p>${list(B.pool5)}</p><h4>四星</h4><p>${list(B.pool4)}</p><h4>三星</h4><p>${list(B.pool3)}</p>
      <h4>重复获得角色</h4><p>每次重复获得会为角色刻下一道「潮痕」，每道使生命值与攻击力提高 4%，最多 6 道；之后再次获得会转化为流光（五星 40，四星 10）。</p>`);
  });
  $('gc-hist').addEventListener('click', () => {
    const h = save.gacha.history;
    gModal('记录', h.length ? `<table>${h.map((x) => `<tr><td class="r${x.rarity}">${nameOf(x.id)}</td><td>${'★'.repeat(x.rarity)}</td><td>${BANNERS.find((b) => b.id === x.banner)?.name || ''}</td><td>${new Date(x.t).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>`).join('')}</table>` : '<p>还没有拾光记录。</p>');
  });
  function doPull(n) {
    const B = BANNERS[gBanner];
    if (save.freePulls) inv.add('bottle', Math.max(0, n - inv.count('bottle')));
    const have = inv.count('bottle');
    if (have < n) {
      const lack = n - have, cost = lack * PULL_COST;
      if (inv.count('starlight') < cost) { notice('漂流瓶不足', `还差 ${lack} 只 · 补足需要 ${cost} 流光，当前 ${inv.count('starlight')}`); return; }
      askConfirm('兑换漂流瓶', `使用 ${cost} 流光兑换 ${lack} 只漂流瓶？`, () => { inv.remove('starlight', cost); inv.add('bottle', lack); inv.fresh.delete('bottle'); setOverlay('gacha'); doPull(n); }, () => setOverlay('gacha'));
      return;
    }
    inv.remove('bottle', n);
    const res = [];
    for (let i = 0; i < n; i++) {
      const r = pullOnce(save.gacha, B, isChar);
      if (isChar(r.id)) {
        if (!save.owned.includes(r.id)) { save.owned.push(r.id); ensureWeapon(r.id); r.tag = '新角色'; }
        else if ((save.cons[r.id] || 0) < 6) { save.cons[r.id] = (save.cons[r.id] || 0) + 1; r.tag = `潮痕 ${save.cons[r.id]}`; }
        else { const v = r.rarity === 5 ? 40 : 10; inv.add('starlight', v); r.tag = `流光 +${v}`; }
      } else { inv.add(r.id, 1); r.tag = null; }
      res.push(r);
    }
    inv.fresh.delete('starlight');
    ach.bump('pulls', n); if (n >= 10) ach.bump('pull10'); if (res.some((r) => r.rarity === 5)) ach.bump('gold');
    applyWeapons(); writeSave();
    gPlay = { res, i: -1, phase: 'anim' };
    setOverlay('gachaPlay');
    $('gp-reveal').hidden = true; $('gp-summary').hidden = true; $('gp-skip').hidden = false;
    gscene.setSize(window.innerWidth, window.innerHeight);
    gscene.play(res, () => { gPlay.phase = 'reveal'; gachaAdvance(); });
  }
  $('gc-1').addEventListener('click', () => doPull(1));
  $('gc-10').addEventListener('click', () => doPull(10));
  const RV_BG = { 3: ['#5aa2e6', '#14284c'], 4: ['#b98cf0', '#2c1650'], 5: ['#ffd27a', '#6a3a10'] };
  function gachaAdvance() {
    if (!gPlay) return;
    if (gPlay.phase === 'anim') { gscene.skip(); return; }
    if (gPlay.phase === 'reveal') {
      const order = gPlay.order || (gPlay.order = gPlay.res.map((r, k) => k).sort((a, b) => gPlay.res[a].rarity - gPlay.res[b].rarity || a - b));
      gPlay.i++;
      // with ten results, 3-star items skip straight to the summary
      while (gPlay.res.length > 1 && gPlay.i < order.length && gPlay.res[order[gPlay.i]].rarity === 3) gPlay.i++;
      if (gPlay.i >= order.length) { gPlay.phase = 'summary'; showSummary(); return; }
      const r = gPlay.res[order[gPlay.i]], [c1, c2] = RV_BG[r.rarity];
      const isC = isChar(r.id), d = isC ? CHARS[r.id] : ITEMS[r.id];
      $('gp-skip').hidden = false;
      $('gp-reveal').hidden = false;
      $('gp-reveal').innerHTML = `<div class="rv" style="--c1:${c1};--c2:${c2}"><div class="rv-text">${r.tag ? `<span class="rv-tag">${r.tag}</span>` : ''}<h2>${d.name}</h2><span class="rv-st">${'★'.repeat(r.rarity)}</span><p>${isC ? `${d.element} · ${d.title}` : d.type}</p><p>${isC ? d.role : d.passive || ''}</p></div>
        <div class="rv-art">${isC ? `<img src="${portrait(r.id, 'full') || ''}" alt="">` : iconSVG(d)}</div></div><span class="rv-hint">点击继续</span>`;
      return;
    }
    if (gPlay.phase === 'summary') { gPlay = null; $('gp-reveal').hidden = true; $('gp-summary').hidden = true; setOverlay('gacha'); }
  }
  function showSummary() {
    $('gp-reveal').hidden = true; $('gp-skip').hidden = true;
    const list = gPlay.res.slice().sort((a, b) => b.rarity - a.rarity);
    $('gp-summary').hidden = false;
    $('gp-summary').innerHTML = `<div class="sm"><div class="sm-row">${list.map((r, k) => { const [c1, c2] = RV_BG[r.rarity]; return `<div class="sm-card" style="--c1:${c1};--c2:${c2};animation-delay:${k * 0.05}s">${isChar(r.id) ? `<img src="${portrait(r.id, 'full') || ''}" alt="">` : iconSVG(ITEMS[r.id])}${r.tag ? `<i>${r.tag}</i>` : ''}<b>${'★'.repeat(r.rarity)}</b></div>`; }).join('')}</div><span class="rv-hint" style="position:static;transform:none">点击返回</span></div>`;
  }
  $('gacha-play').addEventListener('click', (e) => { if (e.target.closest('#gp-skip')) { if (gPlay && gPlay.phase === 'anim') gscene.skip(); else if (gPlay && gPlay.phase === 'reveal') { gPlay.phase = 'summary'; showSummary(); } return; } gachaAdvance(); });

  // ---------- input ----------
  const inp = { x: 0, y: 0, sprint: false, jump: false, jumpHeld: false, skillHeld: false, attack: false, attackHeld: false, skill: false, burst: false, dash: false };
  const keys = new Set();
  let sprintHeld = false, touchE = false, touchJ = false;
  const recompute = () => {
    if (joy.active) return;
    inp.x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    inp.y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    inp.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || sprintHeld;
  };
  const attackDown = () => { if (overlay) return; inp.attack = true; inp.attackHeld = true; };
  let aimHint = false;
  const aimKey = () => {
    if (overlay) return;
    const r = player.toggleAim();
    if (r === 'on' && !aimHint) { aimHint = true; toast(isTouch ? '瞄准中：点「射击」放箭，按住蓄力；再点「瞄准」退出' : '瞄准中：左键放箭，按住蓄满一圈射出满弦光箭；再按 R 退出', 4); }
    if (!r && player.kit !== 'bow') toast('只有弓箭角色可以瞄准');
  };
  const attackUp = () => { inp.attackHeld = false; };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'AltLeft' || e.code === 'AltRight') { e.preventDefault(); if (started && !overlay) { unlock(); $('lockhint').hidden = isTouch; } return; }
    if (e.target && e.target.tagName === 'INPUT') return;   // typing a number in an edit box
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') && e.code === 'Space') e.preventDefault();
    if (!started) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); startGame(); } return; }
    if (overlay === 'death') return;
    if (overlay === 'dreward' || overlay === 'dfail') return;
    if (overlay === 'gachaPlay') { gachaAdvance(); return; }
    if (overlay === 'timeskip') return;
    if (overlay === 'dialog') { if (['KeyF', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); if (!e.repeat) dlgAdvance(); } else if (/^Digit[1-4]$/.test(e.code)) dlgChoose(+e.code.slice(5) - 1); return; }
    if (overlay === 'cine') { if (e.code === 'Escape') cineSkip(); return; }
    if (overlay === 'chapter') { if (['KeyF', 'Space', 'Enter', 'Escape'].includes(e.code)) chapterDone(); return; }
    if (e.code === 'Escape' && overlay === 'confirm') { $('cf-no').click(); return; }
    if (e.code === 'Escape') { if (overlay === 'menu' && performance.now() - menuAt < 400) return; if (overlay) closeOverlay(false); else setOverlay('menu'); return; }
    if (e.code === 'KeyB') { if (overlay === 'bag') { ui.closeBag(); lock(); } else if (!overlay && !player.dead) ui.openBag(); return; }
    if (e.code === 'KeyM') { if (overlay === 'map') closeOverlay(true); else if (!overlay) setOverlay('map'); return; }
    if (e.code === 'KeyH') { if (overlay === 'gacha') closeOverlay(true); else if (!overlay && !D.inside) setOverlay('gacha'); return; }
    if (e.code === 'KeyP' && !overlay) { quitChallenge(); return; }
    if ((e.code === 'KeyT' || e.code === 'Enter') && restartP && !overlay) { restartP.go(); return; }
    if (e.code === 'KeyT') { if (overlay === 'timep') closeOverlay(true); else if (!overlay && !D.inside) openTime(); return; }
    if (e.code === 'KeyC') { if (overlay === 'chars') closeOverlay(true); else if (!overlay) setOverlay('chars'); return; }
    if (overlay) return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) inp.jump = true; }
    if (!e.repeat) {
      if (e.code === 'KeyE') inp.skill = true;
      if (e.code === 'KeyQ') inp.burst = true;
      if (e.code === 'KeyJ') attackDown();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inp.dash = true;
      if (e.code === 'KeyR') aimKey();
      if (e.code === 'KeyX') player.letGo();
      if (e.code === 'KeyF') { doPick(); pickHold = 0.25; }
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') { const i = +e.code.slice(5) - 1; if (player.switchTo(i)) afterSwitch(); else if (player.party[i] && player.party[i].dead) toast(`${player.party[i].def.name} 已倒下，去虹之像复苏`); }
    }
    keys.add(e.code); recompute();
  });
  window.addEventListener('keyup', (e) => {
    if ((e.code === 'AltLeft' || e.code === 'AltRight') && started && !overlay) { e.preventDefault(); lock(true); }
    keys.delete(e.code); if (e.code === 'KeyJ') attackUp(); recompute();
  });
  window.addEventListener('blur', () => { keys.clear(); attackUp(); recompute(); });

  let drag = null;
  const look = (dx, dy, k = 1) => {
    const s = player.aiming ? 0.55 : 1;
    cam.yaw -= dx * 0.0045 * k * s;
    cam.pitch = Math.min(1.2, Math.max(-0.75, cam.pitch + dy * 0.0036 * k * s));
  };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || overlay) return;
    if (document.pointerLockElement === canvas) {
      if (e.button === 0) attackDown();
      if (e.button === 2) inp.dash = true;
      return;
    }
    if (e.button === 2) { inp.dash = true; return; }
    // a click while the mouse is free (after Alt) takes the pointer back right away, on the press itself
    if (e.button === 0 && started && !isTouch && !lockFailed) { drag = null; lock(); return; }
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || overlay) return;
    if (document.pointerLockElement === canvas) { look(e.movementX, e.movementY); return; }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); look(dx, dy); }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return;
    if (document.pointerLockElement === canvas) { drag = null; if (e.button === 0) attackUp(); return; }
    if (drag && drag.moved < 5 && started && !isTouch && e.button === 0 && !overlay) {
      if (lockFailed) { attackDown(); setTimeout(attackUp, 60); } else lock();
    }
    drag = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (ui.pickList.length > 1 && ui.cyclePick(e.deltaY > 0 ? 1 : -1)) return;
    cam.distT = Math.min(18, Math.max(2.2, cam.distT * (1 + e.deltaY * 0.0012)));
  }, { passive: false });

  const joy = { active: false, id: null, ox: 0, oy: 0 };
  const lookTouch = new Map();
  const joyEl = $('joy'), knob = $('knob');
  const onTouchStart = (e) => {
    if (!started || overlay) return;
    for (const t of e.changedTouches) {
      if (t.target.closest && t.target.closest('.hud-btn, .tbtn, #topbar, #pickups, .skill, #party, #minimap')) continue;
      // stick: touching on / near its resting spot grabs it there; touching anywhere else in the lower-left zone makes it
      // float up under the thumb (like Genshin's mobile stick), so the left thumb never has to hunt for a fixed circle
      const jr = joyEl.getBoundingClientRect(), half = jr.width / 2, jcx = jr.left + half, jcy = jr.top + half;
      const zoneX = window.innerWidth * 0.42, zoneY = window.innerHeight * 0.22;
      const near = Math.hypot(t.clientX - jcx, t.clientY - jcy) < jr.width * 1.1;
      if (!joy.active && (near || (t.clientX < zoneX && t.clientY > zoneY))) {
        let cx = jcx, cy = jcy;
        if (!near) {
          cx = Math.max(half + 6, Math.min(zoneX, t.clientX)); cy = Math.max(zoneY + half, Math.min(window.innerHeight - half - 6, t.clientY));
          joyEl.style.left = (cx - half) + 'px'; joyEl.style.top = (cy - half) + 'px'; joyEl.style.bottom = 'auto';
        }
        joy.active = true; joy.id = t.identifier; joy.ox = cx; joy.oy = cy; joy.mx = jr.width * 0.42; joyEl.classList.add('on');
        let dx = t.clientX - cx, dy = t.clientY - cy; const l = Math.hypot(dx, dy), mx = joy.mx;
        if (l > mx) { dx *= mx / l; dy *= mx / l; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`; inp.x = dx / mx; inp.y = -dy / mx;
      } else lookTouch.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  };
  const onTouchMove = (e) => {
    for (const t of e.changedTouches) {
      if (joy.active && t.identifier === joy.id) {
        let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy; const l = Math.hypot(dx, dy), mx = joy.mx || 50;
        if (l > mx) { dx *= mx / l; dy *= mx / l; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        inp.x = dx / mx; inp.y = -dy / mx;
        e.preventDefault();
      } else if (lookTouch.has(t.identifier)) {
        const p = lookTouch.get(t.identifier); look(t.clientX - p.x, t.clientY - p.y, 1.25); p.x = t.clientX; p.y = t.clientY; e.preventDefault();
      }
    }
  };
  const onTouchEnd = (e) => {
    for (const t of e.changedTouches) {
      if (joy.active && t.identifier === joy.id) { joy.active = false; inp.x = 0; inp.y = 0; knob.style.transform = ''; joyEl.classList.remove('on'); joyEl.style.left = joyEl.style.top = joyEl.style.bottom = ''; }
      lookTouch.delete(t.identifier);
    }
  };
  const stage = $('stage');
  stage.addEventListener('touchstart', onTouchStart, { passive: true });
  stage.addEventListener('touchmove', onTouchMove, { passive: false });
  stage.addEventListener('touchend', onTouchEnd); stage.addEventListener('touchcancel', onTouchEnd);
  const btn = (id, down, up) => {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); down(); el.classList.add('on'); });
    const u = () => { el.classList.remove('on'); if (up) up(); };
    el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('pointerleave', u);
  };
  btn('tjump', () => { inp.jump = true; touchJ = true; }, () => { touchJ = false; });
  btn('taim', () => aimKey());
  btn('tdrop', () => player.letGo());
  btn('tsprint', () => { inp.dash = true; sprintHeld = true; inp.sprint = true; }, () => { sprintHeld = false; inp.sprint = false; recompute(); });
  btn('tatk', attackDown, attackUp);
  btn('sk-e', () => { if (!overlay) { inp.skill = true; touchE = true; } }, () => { touchE = false; });
  btn('sk-q', () => { if (!overlay) inp.burst = true; });
  if (isTouch) document.body.classList.add('touch');

  const QN = { high: '高', mid: '中', low: '低' };
  const setQ = (q) => {
    quality = q; store.set('quality', q);
    renderer.setPixelRatio(prFor(q));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mirror.scale = q === 'high' ? 0.5 : 0.35;
    resize();
    buildComposer();
    if (nat.grass) nat.grass.count = Math.floor(nat.grass.userData.n * (q === 'high' ? 1 : q === 'mid' ? 0.65 : 0.35));
  };

  let toastT = 0;
  function flashEl(id) { const el = $(id); if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  // centred notice above every panel (shortages, blocked actions) — the HUD toast sits under overlays
  let noticeTimer = 0;
  function notice(msg, sub = '', sec = 2.2) {
    const el = $('notice'); $('nt-t').textContent = msg; $('nt-s').textContent = sub;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => el.classList.remove('show'), sec * 1000);
  }
  function toast(msg, sec = 3.2) { if (msg && overlay) { notice(msg); return; } const el = $('toast'); el.textContent = msg; el.classList.toggle('show', !!msg); toastT = msg ? sec : 0; }

  function teleportTo(w) {
    if (player.dead) return;
    if (D.inside) { leaveDomain(w); return; }
    const fl = $('flash'); fl.classList.add('on');
    closeOverlay(true);
    setTimeout(() => {
      const p = wpPos(w);
      player.teleport(p.x, p.y + 0.3, p.z);
      player.facing = w.yaw + Math.PI;
      cam.yaw = w.yaw; cam.pitch = 0.15;
      cam.target.copy(player.pos).add(new THREE.Vector3(0, 1.45, 0));
      fl.classList.remove('on');
    }, 260);
  }

  // ---------- portrait hint (phones): the game is built for landscape ----------
  const rotEl = $('rotate'); let rotDismissed = false;
  const isPortrait = () => isTouch && window.innerHeight > window.innerWidth * 1.05;
  const syncRotate = () => { rotEl.hidden = !(isPortrait() && !rotDismissed); };
  // fullscreen + orientation lock: only some browsers / embeds allow it, so failure is normal and silent
  const tryLandscape = async () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      await screen.orientation.lock('landscape'); return true;
    } catch (e) { return false; }
  };
  $('rt-auto').addEventListener('click', async () => {
    if (await tryLandscape()) syncRotate();
    else $('rt-msg').textContent = '这个页面不允许自动横屏。请打开手机的「自动旋转」，再把手机横过来；也可以点下面的按钮，竖屏继续玩。';
  });
  $('rt-stay').addEventListener('click', () => { rotDismissed = true; syncRotate(); });
  window.addEventListener('resize', syncRotate); window.addEventListener('orientationchange', syncRotate); syncRotate();

  function startGame() {
    if (started || !ready) return;
    started = true;
    if (isPortrait()) tryLandscape();
    document.body.classList.add('playing');
    $('start').classList.add('gone');
    setTimeout(() => { $('start').hidden = true; }, 900);
    hints.glide = false;
    if (save.story) { toast(isTouch ? '左手移动 · 右手转视角 · 点头像换人' : '单击画面开始 · 左键攻击 · E 技能 · Q 绝技 · 1–4 切换角色', 5); lock(); }
    story.start();
  }
  $('go').addEventListener('click', startGame);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (w / h < 0.9 && cam.distT < 7.5) cam.distT = 7.5;
    const pr = renderer.getPixelRatio();
    mirror.setSize(w * pr, h * pr);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
  }
  window.addEventListener('resize', resize);
  resize();

  window.claude?.hot?.snapshot?.(() => ({ player: { x: player.pos.x, y: player.pos.y, z: player.pos.z }, yaw: cam.yaw, pitch: cam.pitch, started }));

  ach.quiet = true;
  ach.max('crystals', save.crystals.length);
  ach.max('chests', world.chests.filter((c) => c.opened).length);
  ach.max('domains', (save.domain && save.domain.clears) || 0);
  if (save.story && save.story.done) ach.max('prologue', 1);
  for (const [id, v] of Object.entries(save.puzzles || {})) if (v && v.solved) { ach.max('pz_' + id, 1); ach.add('puzzles', id); }
  if (inv.count('scrap')) ach.max('drone', inv.count('scrap'));
  ach.quiet = false;
  setProgress(1, '');
  let ready = true;
  $('go').disabled = false; $('golabel').textContent = '开始探索'; $('loadlabel').textContent = '';
  $('start').classList.add('ready');
  if (saved.started) startGame();
  if (/debug/.test(location.search)) window.__dbg = { getComposer: () => composer, dayNight, openTime, quitChallenge, tick: (n, dt = 0.05) => { for (let i = 0; i < n; i++) { puzzles.update(time + i * dt, dt); updateDrones(dt); } }, ach, puzzles, drones, ACH, story, skipCine: () => cineSkip(), dlgAdvance, dlgChoose, chapterDone: () => chapterDone(), dlgState: () => dlg, lockRef, guide, beams, overlayName: () => overlay, renderer, camera, notice, setCam: (c) => { dbgCam = c; }, H, colliders, scene, cityPlan, city, gscene, syncModels, applyWeapons, player, cam, inp, teleportTo, WP, combat, world, inv, ui, fx, setOverlay, wmap, statues, D, enterDomain, startChallenge, claimReward, leaveDomain, domainInteract, dent, arena, save, refreshArt, domainWP, wpPos };

  const perf = { elapsed: 0, sum: 0, n: 0 };
  const miniCv = $('minimap-cv');
  let time = 0, last = performance.now(), saveT = 0, deathT = 0, miniT = 0, hudT = 0;
  const lp = new THREE.Vector3();
  const sunOffset = keyDir.clone().multiplyScalar(180);
  const hideInMirror = [water, sky, cumulus];
  if (nat.grass) hideInMirror.push(nat.grass);
  const project = (p) => fx.project(p);
  const carPos = new THREE.Vector3(), carDir = new THREE.Vector3();

  // footsteps in shallow water throw droplets and leave ripples; landing in water splashes
  const wfx = { t: 0, sign: 0, prev: 'ground' };
  function waterFx(dt) {
    const P = player.pos, ws = waterSurface(P.x, P.z);
    const mode = player.mode, prev = wfx.prev; wfx.prev = mode;
    if (ws === null) return;
    const surf = new THREE.Vector3(P.x, ws, P.z), hs = Math.hypot(player.vel.x, player.vel.z), d = ws - P.y;
    if (prev === 'air' && ((mode === 'ground' && d > 0.03) || mode === 'swim')) { fx.splash(surf, 22, 1.4); fx.ripple(surf, 2.4, 1.2); fx.ripple(surf, 1.4, 0.9); return; }
    if (mode === 'swim') {
      wfx.t -= dt;
      if (wfx.t <= 0) { wfx.t = hs > 1 ? 0.32 : 1.1; fx.ripple(surf, hs > 1 ? 1.7 : 1.1, 1.2, 0.8); if (hs > 1) fx.splash(surf, 4, 0.55); }
      return;
    }
    if (mode !== 'ground' || d <= 0.03) return;
    const sgn = Math.sin(player.phase) >= 0 ? 1 : -1;
    if (hs > 1 && sgn !== wfx.sign) {
      wfx.sign = sgn;
      const side = sgn * 0.11, f = player.facing;
      const foot = surf.clone().add(new THREE.Vector3(Math.cos(f) * side, 0, -Math.sin(f) * side));
      fx.splash(foot, Math.round(4 + d * 12 + hs * 0.8), 0.55 + hs * 0.07);
      fx.ripple(foot, 0.6 + hs * 0.06, 0.8);
    }
    wfx.t -= dt;
    if (wfx.t <= 0) { wfx.t = hs > 1 ? 0.35 : 1.3; fx.ripple(surf, hs > 1 ? 1.0 : 0.75, 1.0, hs > 1 ? 0.7 : 0.45); }
  }

  function frame(now) {
    // rAF timestamps can lag performance.now() after a long boot frame: never feed a negative step to the simulation
    const rawDt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = Math.max(last, now);
    let dt = rawDt;
    if (hitstop > 0) { hitstop -= rawDt; dt = rawDt * 0.1; }
    time += rawDt; timeU.value = time;
    sky.material.uniforms.uTime.value = time;
    water.material.uniforms.uTime.value = time;
    const paused = !!overlay || !rotEl.hidden;   // the portrait hint also pauses the world
    if (started && (!paused || overlay === 'timeskip')) { dayNight.update(rawDt); if (overlay === 'timeskip') { const f = fmtTime(dayNight.time); $('ts-now').textContent = f.text; } }
    if (started) updateClock(rawDt);
    if (overlay === 'gachaPlay' && gPlay && gPlay.phase === 'anim') {
      gscene.update(rawDt);
      gscene.render(renderer);
      $('gp-flash').style.opacity = gscene.flash();
      requestAnimationFrame(frame);
      return;
    }
    $('gp-flash').style.opacity = 0;

    if (started && !paused) {
      inp.jumpHeld = keys.has('Space') || touchJ; inp.skillHeld = keys.has('KeyE') || touchE;
      player.update(dt, inp, cam.yaw);
      if (player.hover && Math.random() < 0.5) fx.sparks(new THREE.Vector3(player.pos.x, player.pos.y + 0.1, player.pos.z), '#aef5e2', 1, 2.2, 0.35, 0.5, 0.5);
      if (player.act && player.act.type === 'lifeline') fx.sparks(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z), '#bfeeff', 2, 1.5, 0.3, 0.4, 0.5);
      // open-world void guard: never lose the player below the world
      if (!D.inside && (!Number.isFinite(player.pos.x + player.pos.y + player.pos.z) || player.pos.y < -40)) { const s = player.safe; player.teleport(s.x, s.y + 0.3, s.z); }
      waterFx(dt);
      for (const e of combat.enemies) {
        if (!e.alive) continue;
        const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z, d = Math.hypot(dx, dz), min = e.radius + 0.4;
        if (d < min && d > 0.001 && Math.abs(player.pos.y - e.pos.y) < e.height) {
          const nx = player.pos.x + dx / d * (min - d), nz = player.pos.z + dz / d * (min - d);
          const ok = (x, z) => !colliders.blocker(x, z, player.pos.y, 0.6) && groundAt(x, z, player.pos.y + 0.6) > player.pos.y - 1.2 && (!D.inside || Math.hypot(x - arena.center.x, z - arena.center.z) < ARENA.r - 1);
          if (ok(nx, nz)) { player.pos.x = nx; player.pos.z = nz; }
          else if (ok(nx, player.pos.z)) player.pos.x = nx;
          else if (ok(player.pos.x, nz)) player.pos.z = nz;
        }
      }
      // monorail cars push the player aside
      for (const tr of st.trains) for (const car of tr.cars) {
        car.getWorldDirection(carDir); carPos.copy(car.position);
        const rx = player.pos.x - carPos.x, rz = player.pos.z - carPos.z;
        const along = rx * carDir.x + rz * carDir.z;
        if (Math.abs(along) > 5.2 || player.pos.y > carPos.y + 1.6 || player.pos.y < carPos.y - 3) continue;
        const px = rx - carDir.x * along, pz = rz - carDir.z * along, pd = Math.hypot(px, pz);
        if (pd < 1.9) { const push = (1.9 - pd) / (pd || 1); player.pos.x += px * push; player.pos.z += pz * push; }
      }
      for (const c of city.cars) {
        if (c.x === undefined || Math.abs(player.pos.y - c.y - 1) > 2.2) continue;
        const rx = player.pos.x - c.x, rz = player.pos.z - c.z, al = rx * c.fx + rz * c.fz, lx = rx * -c.fz + rz * c.fx;
        if (Math.abs(al) < 2.6 && Math.abs(lx) < 1.35) { const push = (1.35 - Math.abs(lx)) * Math.sign(lx || 1); player.pos.x += -c.fz * push; player.pos.z += c.fx * push; }
      }
      combat.update(dt);
      let picks = world.update(dt, player.pos, onCrystal);
      picks = [...domainPicks(), ...puzzles.picks(player.pos), ...picks];
      for (const tb of tablets) if (Math.hypot(player.pos.x - tb.pos.x, player.pos.z - tb.pos.z) < 2.4 && Math.abs(player.pos.y - tb.pos.y) < 2) picks.unshift({ tablet: tb, name: '石碑', item: ITEMS.journal, dist: 0 });
      // statues: heal & revive nearby, offer crystals
      for (const s of statues) {
        const d = Math.hypot(player.pos.x - s.pos.x, player.pos.z - s.pos.z);
        const inside = d < 7 && Math.abs(player.pos.y - s.pos.y) < 5;
        if (inside && !player.dead) {
          player.healAll(0.35 * dt, true);
        }
        s.inside = inside;
        if (inside && inv.count('rainbow') > 0) picks = [{ offer: true, name: '献上虹晶', count: inv.count('rainbow'), item: ITEMS.rainbow, dist: 0 }, ...picks];
      }
      ui.setPickups(player.dead ? [] : picks);
      if (keys.has('KeyF') && picks.length) { pickHold -= rawDt; if (pickHold <= 0) { pickHold = 0.14; doPick(); } }
      for (const ev of player.events) {
        const type = Array.isArray(ev) ? ev[0] : ev;
        if (type === 'jump' && !hints.glide) { hints.glide = true; setTimeout(() => toast(isTouch ? '在空中再点一次跳跃，展开滑翔翼' : '在空中再按一次空格，展开滑翔翼'), 250); }
        if (type === 'hurt') { const el = $('hurtflash'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); fx.number(player.pos.clone().setY(player.pos.y + 1.8), ev[1], { color: '#ff6b6b', small: true }); fx.shake = Math.max(fx.shake, 0.3); }
        if (type === 'heal') fx.number(player.pos.clone().setY(player.pos.y + 1.8), '+' + ev[1], { color: '#8cf08c', small: true });
        if (type === 'memberDown') toast(`${ev[1]} 倒下了，已切换角色`);
        if (type === 'dead') { if (D.inside) D.failT = 1.4; else deathT = 1.4; }
        if (type === 'drown') {
          const loss = Math.round(player.maxHp * 0.15);
          player.hp = Math.max(1, player.hp - loss);
          player.teleport(player.safe.x, player.safe.y + 0.3, player.safe.z); player.stam = player.maxStam;
        }
        if (type === 'fall') ach.bump('fall');
        if (type === 'drown') ach.bump('drown');
        if (type === 'tired' || type === 'noStam') flashEl('stam');
        if (type === 'burstNotReady' && player.energy < player.energyMax) flashEl('sk-q');
        if (type === 'switch') hints.switched = true;
        if (type === 'hover' && !hints.hover) { hints.hover = true; toast(isTouch ? '悬停中：按住跳跃上升，按住冲刺加速，再点技能结束' : '悬停中：按住空格上升，按住 Shift 加速，再按 E 结束', 5); }
        if (type === 'lifeline' && !hints.life) { hints.life = true; toast(isTouch ? '轻点冲出一小段；按住技能键持续冲刺，再点一次提前结束' : '轻按 E 冲出一小段；按住 E 持续冲刺（最长 3 秒），再按 E 提前结束', 5); }
        if (type === 'noFly') toast('这里无法悬停');
      }
      player.events.length = 0;
      if (player.dead && deathT > 0) { deathT -= rawDt; if (deathT <= 0 && !deathShown) { deathShown = true; ui.showDeath(true); setOverlay('death'); } }
    } else if (!started) {
      player.animate(dt, false);
      if (!reduceMotion) cam.yaw = (saved.yaw ?? heroYaw) + Math.sin(time * 0.12) * 0.12;
    }
    inp.jump = false; inp.attack = false; inp.skill = false; inp.burst = false; inp.dash = false;
    updateDomain(paused ? 0 : dt);
    beams.update(time, beamPow, skyFlick);
    for (const a of heritage.animate) a(time);
    if (guide) guide.update(time);
    if (lockTablet) { const on = lockTablet.glow; lockTablet.gm.color.set(on ? '#ffe7a0' : '#7fe3ff'); lockTablet.gm.opacity = on ? 0.6 + Math.sin(time * 4) * 0.35 : 0.75; }
    { const su = sky.material.uniforms; su.uFlick.value += (skyFlick - su.uFlick.value) * Math.min(1, rawDt * 3); }
    if (started && !paused) { story.update(); puzzles.update(time, dt); updateDrones(dt); achWorld(rawDt); }
    { const bc = document.body.classList; const b1 = player.kit === 'bow', b2 = player.mode === 'climb', b3 = !!player.aimLock; if (bc.contains('bowchar') !== b1) bc.toggle('bowchar', b1); if (bc.contains('climbing') !== b2) bc.toggle('climbing', b2); if (bc.contains('aimlock') !== b3) bc.toggle('aimlock', b3); }
    if (started) updateQuest(rawDt);
    if (!paused) updateBridge(dt);
    if (bannerT > 0) { bannerT -= rawDt; if (bannerT <= 0) $('banner').classList.remove('on'); }
    updateCamera(rawDt);
    if (!paused) { updateTrains(st.trains, dt); updateCity(city, dt, time, player); }
    fx.update(paused ? 0 : rawDt);
    combat.updateBars(camera, project);
    for (const m of markers) { m.crystal.rotation.y += rawDt * 1.2; m.crystal.position.y = 2.95 + Math.sin(time * 2 + m.group.position.x) * 0.08; }
    for (const s of statues) { s.rings[0].rotation.z += rawDt * 0.6; s.rings[1].rotation.z -= rawDt * 0.4; s.orbMat.emissive.setHSL((time * 0.08) % 1, 0.8, 0.62); }
    for (const f of nat.animate) f(time);

    sky.position.copy(camera.position);
    water.position.set(Math.round(camera.position.x / 50) * 50, 0, Math.round(camera.position.z / 50) * 50);
    lp.copy(player.pos);
    const texel = 120 / shadowSize;
    lp.x = Math.round(lp.x / texel) * texel; lp.z = Math.round(lp.z / texel) * texel;
    sun.target.position.copy(lp); sun.position.copy(lp).addScaledVector(dayNight.lightDir, 180);
    sun.target.updateMatrixWorld();

    const wu = water.material.uniforms;
    if (quality !== 'low' && overlay !== 'map') {
      camera.updateMatrixWorld();
      const ok = mirror.render(renderer, scene, camera, hideInMirror);
      wu.uUseRefl.value = ok ? 1 : 0;
      wu.uRefl.value = mirror.rt.texture;
      wu.uTexMat.value.copy(mirror.texMat);
    } else wu.uUseRefl.value = 0;

    if (overlay !== 'map') {
      if (cineFrame) cineFrame(rawDt);
      renderer.shadowMap.needsUpdate = true;
      if (composer) composer.render(); else renderer.render(scene, camera);
    }

    if (started) {
      ui.hud(player, project);
      miniT -= rawDt;
      if (miniT <= 0) {
        miniT = 1 / 30;
        const en = combat.enemies.filter((e) => e.alive && Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < 70).map((e) => ({ x: e.pos.x, z: e.pos.z, elite: e.isWarden }));
        wmap.drawMini(miniCv, player.pos.x, player.pos.z, player.facing, cam.yaw, { enemies: en, noPois: D.inside });
      }
      if (overlay === 'map') wmap.render(mapCv, mapIcons, player, cam.yaw);
    }
    if (toastT > 0) { toastT -= rawDt; if (toastT <= 0) $('toast').classList.remove('show'); }
    saveT += rawDt; if (started && saveT > 5) { saveT = 0; writeSave(); }
    if (started && !paused && perf.elapsed < 32) {
      perf.elapsed += rawDt; perf.sum += rawDt; perf.n++;
      if (perf.sum > 4) {
        const avg = perf.sum / perf.n; perf.sum = 0; perf.n = 0;
        if (avg > 0.042 && quality !== 'low') { setQ(quality === 'high' ? 'mid' : 'low'); toast('画面较卡，已自动降低画质（Esc 菜单里可调回）'); }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function start(data) {
  boot(data || {}).catch((err) => {
    console.error(err);
    const el = document.getElementById('golabel');
    el.textContent = '无法启动 3D 场景';
    document.getElementById('loadlabel').textContent = '你的浏览器可能未开启 WebGL2 或硬件加速。请换用最新版 Chrome / Edge / Safari 打开。';
  });
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
