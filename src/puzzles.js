import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rawH0, addPad, reserved, coastX } from './terrain.js';
import { CITY } from './city.js';
import { sealRing } from './loot.js';

// 织光谜题 — seven open-world puzzles left by the light-weavers, each hiding a chest.
//   flowers  四隅之花   pick four 虹铃花 growing at the corners of a square (hidden, no hint)
//   magic    九数碑     3×3 number tablets, two fixed; strike to change; solve the magic square
//   tiles    光砖阵     step on a tile to flip it and its neighbours; light them all
//   lamps    虹之序     light seven coloured lamps in rainbow order
//   statues  众像归心   strike four statues to turn them until all face the rainbow
//   motes    追光       collect the light motes from the station stairs to the cliff deck in time
//   sprite   光灵       follow a light sprite to its shrine
//   seal     七符封印   seven runes on a wheel are letters joined to their mirror images; their colours, read in letter order, open the seal

export const PZ = { sites: {} };
const OFF = (o, z) => coastX(z) + o;
const RAINBOW = ['#ff5d6c', '#ff9f43', '#ffd84a', '#5fdc7a', '#4fd2ff', '#5b7bff', '#b06bff'];
const RB_NAME = ['赤', '橙', '黄', '绿', '青', '蓝', '紫'];

// ---------------------------------------------------------------- plan (before the terrain mesh)
export function planPuzzles() {
  const keep = (CITY.plan && CITY.plan.keep) || [];
  const free = (x, z, R) => {
    for (let k = 0; k <= 12; k++) {
      const a = k / 12 * Math.PI * 2, px = k ? x + Math.cos(a) * R : x, pz = k ? z + Math.sin(a) * R : z;
      if (reserved(px, pz, 2)) return false;
    }
    if (keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + R)) return false;
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI * 2, h = rawH0(x + Math.cos(a) * R * (k ? 1 : 0), z + Math.sin(a) * R * (k ? 1 : 0)); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return lo > 2.2 && hi - lo < Math.max(3.5, R * 0.55);
  };
  const find = (x0, z0, R) => {
    for (let r = 0; r <= 48; r += 3) for (let a = 0; a < Math.PI * 2; a += r ? 3 / r : 7) {
      const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
      if (free(x, z, R)) return { x, z, R };
    }
    return null;
  };
  const site = (id, x0, z0, R, flat = true) => {
    const s = find(x0, z0, R); if (!s) return null;
    let sum = 0, n = 0; for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI * 2; sum += rawH0(s.x + Math.cos(a) * R * 0.6 * (k ? 1 : 0), s.z + Math.sin(a) * R * 0.6 * (k ? 1 : 0)); n++; }
    s.y = sum / n;
    if (flat) addPad({ type: 'circle', x: s.x, z: s.z, r: R, y: s.y, blend: 6, margin: -1 });
    keep.push([s.x, s.z, R + 2]);
    PZ.sites[id] = s;
    return s;
  };
  site('magic', OFF(140, 58), 58, 11);
  site('tiles', OFF(112, -80), -80, 7);
  site('lamps', OFF(185, -72), -72, 9);
  site('statues', OFF(150, 122), 122, 8);
  site('flowers', OFF(132, -8), -8, 5, false);
  site('shrine', OFF(150, 55), 55, 3.5);
  site('seal', 400, 40, 25);           // the great seal: on the open highland east of the city
  return PZ.sites;
}

// ---------------------------------------------------------------- shared helpers
// numbers as the light-weavers wrote them: a dot is one, a bar is five (2 = ··, 7 = ·· over a bar)
function digitTex(n, gold) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  // a dark inlaid panel so the glowing marks read in full daylight
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); };
  g.fillStyle = gold ? '#3a2e1c' : '#1f2a36'; rr(2, 2, 124, 124, 14); g.fill();
  g.strokeStyle = gold ? 'rgba(255,214,130,0.7)' : 'rgba(140,225,255,0.45)'; g.lineWidth = 3; rr(6, 6, 116, 116, 11); g.stroke();
  const col = gold ? '#ffe2a0' : '#d8fbff';
  g.shadowColor = gold ? 'rgba(255,200,90,0.9)' : 'rgba(110,230,255,0.9)'; g.shadowBlur = 10;
  g.fillStyle = col;
  const bars = Math.floor(n / 5), dots = n % 5;
  const rows = bars + (dots ? 1 : 0), rowH = 30, top = 64 - rows * rowH / 2;
  let y = top;
  if (dots) {
    const sp = 25, x0 = 64 - (dots - 1) * sp / 2;
    for (let i = 0; i < dots; i++) { g.beginPath(); g.arc(x0 + i * sp, y + rowH / 2, 10, 0, Math.PI * 2); g.fill(); }
    y += rowH;
  }
  for (let i = 0; i < bars; i++) { const w = 96, h = 16; rr(64 - w / 2, y + (rowH - h) / 2, w, h, 7); g.fill(); y += rowH; }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const easeOut = (k) => 1 - (1 - k) ** 3;

export function buildPuzzles(ctx) {
  const { scene, colliders, combat, world, fx, g: ground, save, ach, banner, toast, notice, player, city, dent, heroYaw, spawn, addTablet, timerUI } = ctx;
  // puzzle pieces block movement but are never climbable
  const C = { add: (c) => colliders.add({ noClimb: true, ...c }) };
  save.puzzles = save.puzzles || {};
  const SP = save.puzzles;
  const S = PZ.sites;
  const STD = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const M = {
    stone: STD({ color: '#efe6d2', roughness: 0.8 }),
    stoneDark: STD({ color: '#cfc4ad', roughness: 0.85 }),
    gold: STD({ color: '#e9c46a', roughness: 0.3, metalness: 0.7, emissive: '#5a3c08', emissiveIntensity: 0.3 }),
    crystalOff: STD({ color: '#9fb4c0', roughness: 0.3, metalness: 0.1, emissive: '#1a2a33', emissiveIntensity: 0.4 }),
  };
  const rb = (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.05, h / 2.05, d / 2.05));
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const out = { list: [], picks: [], update: [] };
  // pentagonal stone floor with a gold ring: the light-weavers' signature under every puzzle
  const floor = (s, r) => {
    const grp = new THREE.Group(); grp.position.set(s.x, ground(s.x, s.z), s.z); scene.add(grp);
    mesh(new THREE.CylinderGeometry(r, r + 0.3, 0.5, 40), M.stone, grp, 0, -0.18, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.4, 0.06, 6, 64), M.gold); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; grp.add(ring);
    C.add({ type: 'cyl', x: s.x, z: s.z, r, top: grp.position.y + 0.07, bottom: grp.position.y - 1 });
    return grp;
  };
  // every puzzle hides a chest that appears when solved
  const solved = (id) => !!(SP[id] && SP[id].solved);
  function hiddenChest(id, tier, x, z, rot) {
    const ch = world.addChest('pz_' + id, tier, x, z, rot, { hidden: true });
    if (solved(id) && !ch.opened) { ch.hidden = false; ch.g.visible = true; if (ch.col) ch.col.off = false; }
    return ch;
  }
  function solve(id, ch, title) {
    if (solved(id)) return;
    SP[id] = { ...(SP[id] || {}), solved: true };
    if (ch && !ch.opened) { world.revealHidden(ch); fx.sparks(ch.pos.clone().setY(ch.pos.y + 1), '#ffe9a8', 30, 6, 0.6, 0.9, 4); fx.ring(ch.pos.clone().setY(ch.pos.y + 0.1), 3, '#ffe9a8', 0.7, 1.3); }
    banner(title, '宝箱出现了');
    ach.bump('pz_' + id); ach.add('puzzles', id);
    ctx.writeSave();
  }
  // a breakable-style target the player strikes (melee or arrow)
  const target = (pos, r, cy, onHit, group) => { const t = { pos, r, cy, hits: 0, need: Infinity, broken: false, onHit, last: 0, group }; combat.breakables.push(t); return t; };

  // =============================================================== 1. 四隅之花 (hidden)
  if (S.flowers) {
    const s = S.flowers, half = 3.2, rot = 0.4;
    const st = SP.flowers = SP.flowers || { picked: [] };
    const ch = hiddenChest('flowers', 'exquisite', s.x, s.z, rot + Math.PI);
    const petal = new THREE.SphereGeometry(0.14, 10, 8); petal.scale(0.6, 1.0, 0.6); petal.translate(0, 0.08, 0);
    const stemG = new THREE.CylinderGeometry(0.02, 0.025, 0.55, 5);
    const flowers = [];
    for (let k = 0; k < 4; k++) {
      const a = rot + Math.PI / 4 + k * Math.PI / 2, d = half * Math.SQRT2, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d, y = ground(x, z);
      const grp = new THREE.Group(); grp.position.set(x, y, z); scene.add(grp);
      const stem = new THREE.Mesh(stemG, STD({ color: '#4f9a3a' })); stem.position.y = 0.27; grp.add(stem);
      const head = new THREE.Group(); head.position.y = 0.6; grp.add(head);
      for (let i = 0; i < 5; i++) { const pm = new THREE.Mesh(petal, STD({ color: '#ffffff', emissive: RAINBOW[(i + k) % 7], emissiveIntensity: 0.9, roughness: 0.3 })); const pa = i / 5 * Math.PI * 2; pm.position.set(Math.cos(pa) * 0.07, 0, Math.sin(pa) * 0.07); pm.rotation.set(Math.sin(pa) * 0.6, 0, -Math.cos(pa) * 0.6); head.add(pm); }
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff6c8' })); bell.position.y = -0.02; head.add(bell);
      const f = { grp, head, k, pos: grp.position, picked: st.picked.includes(k) };
      grp.visible = !f.picked;
      flowers.push(f);
    }
    out.picks.push((P) => flowers.filter((f) => !f.picked && Math.hypot(f.pos.x - P.x, f.pos.z - P.z) < 2 && Math.abs(f.pos.y - P.y) < 2).map((f) => ({
      name: '虹铃花', dist: Math.hypot(f.pos.x - P.x, f.pos.z - P.z), item: { name: '虹铃花', icon: 'flower', color: '#ffb3e6', rarity: 3 },
      pick() {
        f.picked = true; f.grp.visible = false; st.picked.push(f.k);
        fx.sparks(f.pos.clone().setY(f.pos.y + 0.6), RAINBOW[f.k * 2], 10, 3, 0.3, 0.5, 2);
        ctx.gain([['bell', 1]]);
        if (st.picked.length >= 4) solve('flowers', ch, '四隅之花');
        else ctx.writeSave();
      },
    })));
    out.update.push((t) => { for (const f of flowers) if (!f.picked) { f.head.rotation.y = t * 0.6 + f.k; f.head.position.y = 0.6 + Math.sin(t * 2 + f.k) * 0.03; } });
    out.list.push({ id: 'flowers', name: '四隅之花', pos: new THREE.Vector3(s.x, ground(s.x, s.z), s.z) });
  }

  // =============================================================== 2. 九数碑 (magic square)
  if (S.magic) {
    const s = S.magic, base = floor(s, 10.4), y0 = base.position.y, rot = -Math.PI / 2;  // tablets face west, toward the town
    base.rotation.y = rot;
    // fixed cells: top-left 2 and top-middle 7 -> the only solution is 2 7 6 / 9 5 1 / 4 3 8
    const FIX = { 0: 2, 1: 7 };
    const SOL = [2, 7, 6, 9, 5, 1, 4, 3, 8];
    const start = [2, 7, 3, 1, 9, 5, 8, 6, 4];
    const vals = solved('magic') ? SOL.slice() : start.slice();
    const texN = [null], texG = [null];
    for (let n = 1; n <= 9; n++) { texN.push(digitTex(n, false)); texG.push(digitTex(n, true)); }
    const ch = hiddenChest('magic', 'precious', s.x + 6.6 * Math.sin(rot), s.z + 6.6 * Math.cos(rot), rot);
    const tabs = [];
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3), col = i % 3;
      const lx = (col - 1) * 3.6, lz = 3.0 - row * 3.6, th = 1.6 + row * 0.6;   // back rows are taller tablets, so every number stays readable
      const c = Math.cos(rot), sn = Math.sin(rot), x = s.x + lx * c + lz * sn, z = s.z - lx * sn + lz * c;
      const grp = new THREE.Group(); grp.position.set(x, y0, z); grp.rotation.y = rot + Math.PI; scene.add(grp);
      const fixed = FIX[i] !== undefined;
      mesh(rb(1.15, th, 0.3, 0.08), M.stone, grp, 0, th / 2 + 0.05, 0);
      mesh(new THREE.BoxGeometry(1.3, 0.12, 0.42), fixed ? M.gold : M.stoneDark, grp, 0, th + 0.1, 0);
      mesh(new THREE.BoxGeometry(1.35, 0.2, 0.55), M.stoneDark, grp, 0, 0.1, 0);
      if (fixed) for (const sx of [-0.62, 0.62]) mesh(new THREE.BoxGeometry(0.06, th - 0.1, 0.34), M.gold, grp, sx, th / 2 + 0.05, 0);
      const fm = new THREE.MeshBasicMaterial({ map: (fixed ? texG : texN)[vals[i]] });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), fm); face.position.set(0, th - 0.65, -0.16); face.rotation.y = Math.PI; grp.add(face);
      C.add({ type: 'cyl', x, z, r: 0.62, top: y0 + th + 0.16, bottom: y0 - 1 });
      const tb = { i, grp, fm, fixed, flash: 0 };
      if (!fixed) target(grp.position, 0.75, th - 0.6, () => {
        if (solved('magic')) return;
        vals[i] = vals[i] % 9 + 1; fm.map = texN[vals[i]]; tb.flash = 1;
        fx.sparks(grp.position.clone().setY(grp.position.y + 1), '#bff4ff', 6, 2.5, 0.2, 0.3, 1);
        if (check()) { tabs.forEach((t) => { t.fm.map = texG[vals[t.i]]; t.flash = 1.5; }); solve('magic', ch, '九数归一'); }
      }, 'magic');
      tabs.push(tb);
    }
    if (solved('magic')) tabs.forEach((t) => { t.fm.map = texG[vals[t.i]]; });
    const check = () => {
      if (new Set(vals).size !== 9) return false;
      const L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
      return L.every((l) => vals[l[0]] + vals[l[1]] + vals[l[2]] === 15);
    };
    out.update.push((t, dt) => { for (const tb of tabs) if (tb.flash > 0) { tb.flash = Math.max(0, tb.flash - dt * 2.5); tb.grp.scale.setScalar(1 + tb.flash * 0.05); } });
    { const c = Math.cos(rot), sn = Math.sin(rot), lz = 8.6, lx = 4.2; addTablet(s.x + lx * c + lz * sn, s.z - lx * sn + lz * c, rot + Math.PI, '石碑：「九碑各记一数，自一至九，无一相同。横、竖、斜，三数之和皆同。镀金之碑不可改。」——碑上的点与横，是织光者的记数方式。攻击数碑，它记下的数会改变。', 'magic'); }
    out.list.push({ id: 'magic', name: '九数碑', pos: new THREE.Vector3(s.x, y0, s.z), debug: { vals, SOL, tabs, hit: (i) => combat.breakables.find((b) => b.pos === tabs[i].grp.position).onHit() } });
  }

  // =============================================================== 3. 光砖阵 (lights out)
  if (S.tiles) {
    const s = S.tiles, base = floor(s, 6.8), y0 = base.position.y, rot = 0.25, N = 3, size = 2.05, PITCH = 3.1;   // tile size / centre-to-centre spacing
    const ch = hiddenChest('tiles', 'exquisite', s.x + Math.cos(rot) * 0, s.z - 5.2, rot);
    const onM = STD({ color: '#ffffff', emissive: '#7fe3ff', emissiveIntensity: 1.3, roughness: 0.2 });
    const offM = STD({ color: '#5d6f7d', emissive: '#0d1a22', emissiveIntensity: 0.3, roughness: 0.4 });
    // start from all-lit and press a few tiles: always solvable
    let lit = Array(9).fill(true);
    const press = (i, arr) => { const r = Math.floor(i / N), c = i % N; for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N) arr[rr * N + cc] = !arr[rr * N + cc]; } };
    const scramble = () => { lit = Array(9).fill(true); for (const i of [0, 4, 8, 5]) press(i, lit); };
    if (!solved('tiles')) scramble();
    const tiles = [];
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(i / N), c = i % N, lx = (c - 1) * PITCH, lz = (r - 1) * PITCH;
      const x = s.x + lx * Math.cos(rot) + lz * Math.sin(rot), z = s.z - lx * Math.sin(rot) + lz * Math.cos(rot);
      const grp = new THREE.Group(); grp.position.set(x, y0, z); grp.rotation.y = rot; scene.add(grp);
      mesh(rb(size - 0.12, 0.22, size - 0.12, 0.05), M.stone, grp, 0, 0.08, 0);
      const inlay = new THREE.Mesh(new THREE.BoxGeometry(size * 0.55, 0.06, size * 0.55), lit[i] ? onM : offM); inlay.position.y = 0.2; inlay.rotation.y = Math.PI / 4; grp.add(inlay);
      tiles.push({ i, grp, inlay, x, z });
    }
    const paint = () => tiles.forEach((t) => { t.inlay.material = lit[t.i] || solved('tiles') ? onM : offM; });
    paint();
    let on = -1;
    out.update.push(() => {
      if (solved('tiles')) return;
      const P = player.pos; let cur = -1;
      if (Math.abs(P.y - y0) < 1.2) for (const t of tiles) { const dx = P.x - t.x, dz = P.z - t.z, lx = dx * Math.cos(rot) - dz * Math.sin(rot), lz = dx * Math.sin(rot) + dz * Math.cos(rot); if (Math.abs(lx) < size / 2 - 0.15 && Math.abs(lz) < size / 2 - 0.15) cur = t.i; }
      if (cur !== on) {
        on = cur;
        if (cur >= 0) {
          press(cur, lit); paint();
          fx.ring(new THREE.Vector3(tiles[cur].x, y0 + 0.25, tiles[cur].z), 1.2, '#9ee8ff', 0.35, 1.1);
          if (lit.every(Boolean)) { paint(); solve('tiles', ch, '满盘皆亮'); }
        }
      }
    });
    // reset pedestal
    const rx = s.x + 5.2 * Math.cos(rot) + 0, rz = s.z - 5.2 * Math.sin(rot);
    const ped = new THREE.Group(); ped.position.set(rx, y0, rz); scene.add(ped);
    mesh(rb(0.7, 1.0, 0.7, 0.08), M.stone, ped, 0, 0.5, 0); mesh(new THREE.OctahedronGeometry(0.22, 0), onM, ped, 0, 1.25, 0);
    C.add({ type: 'cyl', x: rx, z: rz, r: 0.45, top: y0 + 1.0, bottom: y0 - 1 });
    out.picks.push((P) => (!solved('tiles') && Math.hypot(rx - P.x, rz - P.z) < 2.2 ? [{ name: '重置光砖', dist: 0.5, item: { name: '重置', icon: 'crystal', color: '#7fe3ff', rarity: 3 }, pick() { scramble(); paint(); fx.sparks(ped.position.clone().setY(y0 + 1.3), '#9ee8ff', 10, 3, 0.3, 0.4, 2); } }] : []));
    addTablet(s.x - 5.0 * Math.cos(rot), s.z + 5.0 * Math.sin(rot), rot + Math.PI / 2, '石碑：「踏上一块光砖，它和前后左右的光砖都会翻转。让九块光砖同时亮起。」——旁边的晶石台可以重置光砖。', 'tiles');
    out.list.push({ id: 'tiles', name: '光砖阵', pos: new THREE.Vector3(s.x, y0, s.z), debug: { tiles, lit, press: (i) => { press(i, lit); paint(); if (lit.every(Boolean)) solve('tiles', ch, '满盘皆亮'); } } });
  }

  // =============================================================== 4. 虹之序 (rainbow order)
  if (S.lamps) {
    const s = S.lamps, base = floor(s, 8.6), y0 = base.position.y;
    const ch = hiddenChest('lamps', 'precious', s.x, s.z, 0);
    const order = [3, 0, 5, 2, 6, 1, 4];      // colour index at each position around the circle (shuffled)
    let next = solved('lamps') ? 7 : 0;
    const lamps = [];
    for (let p = 0; p < 7; p++) {
      const ci = order[p], a = p / 7 * Math.PI * 2 + 0.3, x = s.x + Math.cos(a) * 6.4, z = s.z + Math.sin(a) * 6.4;
      const grp = new THREE.Group(); grp.position.set(x, y0, z); scene.add(grp);
      mesh(rb(0.8, 0.3, 0.8, 0.06), M.stoneDark, grp, 0, 0.15, 0);
      mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.8, 10), M.stone, grp, 0, 1.15, 0);
      mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20), M.gold, grp, 0, 2.15, 0).rotation.x = Math.PI / 2;
      const col = new THREE.Color(RAINBOW[ci]);
      const om = STD({ color: col.clone().lerp(new THREE.Color('#ffffff'), 0.3), emissive: col, emissiveIntensity: 0.12, roughness: 0.25, transparent: true, opacity: 0.85 });
      const orb = mesh(new THREE.IcosahedronGeometry(0.36, 1), om, grp, 0, 2.5, 0);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: combat.orbTex, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(2.4); glow.position.y = 2.5; grp.add(glow);
      C.add({ type: 'cyl', x, z, r: 0.42, top: y0 + 2.2, bottom: y0 - 1 });
      const L = { p, ci, grp, om, orb, glow, lit: next > ci };
      lamps.push(L);
      target(grp.position, 0.6, 2.4, () => {
        if (solved('lamps') || L.lit) return;
        if (ci === next) {
          L.lit = true; next++;
          fx.sparks(grp.position.clone().setY(y0 + 2.5), RAINBOW[ci], 14, 3, 0.3, 0.5, 2);
          if (next >= 7) solve('lamps', ch, '虹之序');
        } else {
          for (const o of lamps) o.lit = false; next = 0;
          fx.sparks(grp.position.clone().setY(y0 + 2.5), '#8a8f99', 16, 2.5, 0.4, 0.6, 1);
          toast('光灯全部熄灭了……顺序好像不对');
        }
      }, 'lamps');
    }
    out.update.push((t) => { for (const L of lamps) { const on = L.lit || solved('lamps'); L.om.emissiveIntensity += ((on ? 1.6 : 0.12) - L.om.emissiveIntensity) * 0.15; L.glow.material.opacity += ((on ? 0.8 : 0) - L.glow.material.opacity) * 0.15; L.orb.rotation.y = t * 0.8 + L.p; } });
    addTablet(s.x - 9.6, s.z + 1.2, -Math.PI / 2, '石碑：「七盏光灯，依虹之序而燃：自外而内，赤橙黄绿青蓝紫。错一盏，则尽灭。」——攻击光灯可以点亮它。', 'lamps');
    out.list.push({ id: 'lamps', name: '虹之序', pos: new THREE.Vector3(s.x, y0, s.z), debug: { lamps, hit: (ci) => combat.breakables.find((b) => b.pos === lamps.find((l) => l.ci === ci).grp.position).onHit() } });
  }

  // =============================================================== 5. 众像归心 (rotating statues)
  if (S.statues) {
    const s = S.statues, base = floor(s, 7.6), y0 = base.position.y;
    const ch = hiddenChest('statues', 'exquisite', s.x, s.z, heroYaw);
    const want = heroYaw + Math.PI;             // local +z pointing across the bay at the rainbow
    const start = solved('statues') ? [0, 0, 0, 0] : [1, 2, 3, 1];
    const sts = [];
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, x = s.x + Math.cos(a) * 4.6, z = s.z + Math.sin(a) * 4.6;
      const ped = new THREE.Group(); ped.position.set(x, y0, z); scene.add(ped);
      mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.6, 8), M.stoneDark, ped, 0, 0.3, 0);
      const ind = STD({ color: '#ffffff', emissive: '#ffb347', emissiveIntensity: 0.3 });
      mesh(new THREE.OctahedronGeometry(0.16, 0), ind, ped, 0, 0.72, 0.86).scale.set(1, 1.4, 1);
      const fig = new THREE.Group(); fig.position.y = 0.6; ped.add(fig);
      mesh(new THREE.CylinderGeometry(0.28, 0.62, 1.7, 14), M.stoneDark, fig, 0, 0.85, 0);
      mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 20), M.gold, fig, 0, 0.35, 0).rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.5, 12), M.stone, fig, 0, 1.95, 0);
      mesh(new THREE.SphereGeometry(0.22, 14, 10), M.stone, fig, 0, 2.38, 0);
      mesh(new THREE.ConeGeometry(0.34, 0.6, 12, 1, true), M.stone, fig, 0, 2.48, -0.06);
      for (const sx of [-1, 1]) { const arm = mesh(new THREE.CapsuleGeometry(0.08, 0.55, 4, 8), M.stone, fig, sx * 0.24, 1.75, 0.22); arm.rotation.x = -1.0; }
      mesh(new THREE.IcosahedronGeometry(0.24, 1), STD({ color: '#ffffff', emissive: '#7fe3ff', emissiveIntensity: 1.5 }), fig, 0, 1.6, 0.55);
      const st = { k, ped, fig, ind, q: start[k], ang: want + start[k] * Math.PI / 2 };
      fig.rotation.y = st.ang;
      C.add({ type: 'cyl', x, z, r: 0.8, top: y0 + 3.0, bottom: y0 - 1 });
      target(ped.position, 0.8, 1.6, () => {
        if (solved('statues') || st.turning) return;
        st.q = (st.q + 1) % 4; st.turning = { from: st.ang, to: st.ang + Math.PI / 2, t: 0 }; st.ang += Math.PI / 2;
        fx.sparks(ped.position.clone().setY(y0 + 1.5), '#efe6d2', 8, 2.5, 0.3, 0.4, 1);
      }, 'statues');
      sts.push(st);
    }
    out.update.push((t, dt) => {
      for (const st of sts) {
        if (st.turning) { st.turning.t += dt / 0.5; const k = Math.min(1, st.turning.t); st.fig.rotation.y = st.turning.from + (st.turning.to - st.turning.from) * easeOut(k); if (k >= 1) { st.turning = null; if (!solved('statues') && sts.every((x) => x.q === 0 && !x.turning)) solve('statues', ch, '众像归心'); } }
        st.ind.emissiveIntensity = st.q === 0 ? 1.4 : 0.25;
        st.ind.emissive.set(st.q === 0 ? '#7fe3ff' : '#ffb347');
      }
    });
    addTablet(s.x + Math.sin(want) * 8.2, s.z + Math.cos(want) * 8.2, want + Math.PI, '石碑：「织光者终其一生，都望着那道彩虹。」——攻击石像，它会转动。', 'statues');
    out.list.push({ id: 'statues', name: '众像归心', pos: new THREE.Vector3(s.x, y0, s.z), debug: { sts, hit: (k) => combat.breakables.find((b) => b.pos === sts[k].ped.position).onHit() } });
  }

  // =============================================================== 6. 追光 (timed light motes through the station)
  if (city && city.stations && city.stations[0] && city.stations[0].stair) {
    const st0 = city.stations[0], { S: top, F: foot } = st0.stair;
    const deck = new THREE.Vector3(spawn.x + 2, ground(spawn.x, spawn.z), spawn.z - 3);
    const plat = new THREE.Vector3(st0.x, st0.y, st0.z);
    const pts = [];
    for (const f of [0.3, 0.62, 0.92]) pts.push(foot.clone().lerp(top, f).add(new THREE.Vector3(0, 1.1, 0)));
    pts.push(top.clone().lerp(plat, 0.5).add(new THREE.Vector3(0, 1.1, 0)));
    // the glide: from the platform edge toward the deck, sinking about 0.22 m per metre
    const edge = plat.clone(); const toDeck = deck.clone().sub(plat).setY(0); const Ld = toDeck.length(); toDeck.normalize();
    for (const f of [0.3, 0.55, 0.8]) { const d = Ld * f; const p = edge.clone().addScaledVector(toDeck, d); p.y = Math.max(ground(p.x, p.z) + 1.3, plat.y + 1.0 - d * 0.2); pts.push(p); }
    pts.push(deck.clone().add(new THREE.Vector3(0, 1.1, 0)));
    const ch = hiddenChest('motes', 'exquisite', deck.x + 2.6, deck.z + 1.6, heroYaw);
    // the start stele stands beside the foot of the stairs, on the side away from the boulevard
    const ux = foot.x - top.x, uz = foot.z - top.z, ul = Math.hypot(ux, uz) || 1, px = -uz / ul, pz = ux / ul;
    const road = CITY.plan && CITY.plan.blvd ? CITY.plan.blvd.pts : [];
    const roadD = (x, z) => road.reduce((m, q) => Math.min(m, Math.hypot(q[0] - x, q[1] - z)), Infinity);
    const c1 = [foot.x + px * 2.6 + ux / ul * 0.6, foot.z + pz * 2.6 + uz / ul * 0.6], c2 = [foot.x - px * 2.6 + ux / ul * 0.6, foot.z - pz * 2.6 + uz / ul * 0.6];
    const [sx, sz] = roadD(...c1) > roadD(...c2) ? c1 : c2;
    const stele = new THREE.Group(); stele.position.set(sx, ground(sx, sz), sz); scene.add(stele);
    mesh(rb(0.9, 1.3, 0.9, 0.1), M.stone, stele, 0, 0.65, 0);
    mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 24), M.gold, stele, 0, 1.36, 0).rotation.x = Math.PI / 2;
    const sm = STD({ color: '#ffffff', emissive: '#ffe9a8', emissiveIntensity: 1.2 });
    const scry = mesh(new THREE.OctahedronGeometry(0.3, 0), sm, stele, 0, 1.75, 0);
    C.add({ type: 'cyl', x: sx, z: sz, r: 0.55, top: stele.position.y + 1.3, bottom: stele.position.y - 1 });
    const moteMat = new THREE.SpriteMaterial({ map: combat.orbTex, color: '#ffe9a8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const motes = pts.map((p) => { const m = new THREE.Sprite(moteMat); m.scale.setScalar(1.3); m.position.copy(p); m.visible = false; scene.add(m); const r = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: '#fff3c4' })); r.position.copy(p); r.visible = false; scene.add(r); return { m, r, p, got: false }; });
    let run = null;
    const LIMIT = 45;
    const begin = () => {
      run = { t: LIMIT, n: 0 }; for (const o of motes) { o.got = false; o.m.visible = true; o.r.visible = true; }
      toast('在 45 秒内收集所有流光——楼梯、站台，然后滑翔回观景台', 5);
    };
    // P quits; the restart prompt teleports back to the stele and starts a fresh run straight away
    out.challenge = () => (run ? { name: '追光', quit: () => end(false, true), restart: () => { player.teleport(sx + 1.2, stele.position.y + 0.3, sz + 1.2); begin(); } } : null);
    const end = (ok, quiet) => {
      for (const o of motes) { o.m.visible = false; o.r.visible = false; }
      timerUI(null); run = null;
      if (ok) solve('motes', ch, '追光'); else if (!quiet) notice('挑战失败', '流光散去了。回到流光台可以再试一次');
    };
    const pickIdx = out.picks.length;
    out.picks.push((P) => (!run && !solved('motes') && Math.hypot(sx - P.x, sz - P.z) < 2.4 ? [{ name: '开始挑战：追光', dist: 0.4, item: { name: '追光', icon: 'starlight', color: '#ffe9a8', rarity: 4 }, pick() { begin(); } }] : []));
    out.update.push((t, dt) => {
      scry.rotation.y = t; sm.emissiveIntensity = solved('motes') ? 0.4 : 1 + Math.sin(t * 3) * 0.4;
      if (!run) return;
      run.t -= dt; timerUI('追光', run.t);
      const P = player.pos;
      for (const o of motes) {
        if (o.got) continue;
        o.r.rotation.y = t * 2; o.m.scale.setScalar(1.2 + Math.sin(t * 5) * 0.12);
        if (P.distanceTo(o.p.clone().setY(o.p.y - 0.9)) < 1.9) { o.got = true; o.m.visible = false; o.r.visible = false; run.n++; fx.sparks(o.p, '#ffe9a8', 10, 3, 0.3, 0.4, 2); toast(`流光 ${run.n} / ${motes.length}`, 1.2); }
      }
      if (run.n >= motes.length) end(true);
      else if (run.t <= 0 || player.dead) end(false);
    });
    addTablet(sx + (sx - foot.x) * 0.5, sz + (sz - foot.z) * 0.5, Math.atan2(foot.x - sx, foot.z - sz), '流光台：「海崖站的流光会沿着楼梯、站台一路洒向观景台。在时限内把它们全部收集起来吧。」', 'motes');
    out.list.push({ id: 'motes', name: '追光', pos: stele.position.clone(), debug: { motes, start: () => out.picks[pickIdx](stele.position)[0].pick() } });
  }

  // =============================================================== 7. 光灵 (light sprite)
  if (S.shrine && dent) {
    const s = S.shrine, sy = ground(s.x, s.z);
    const ch = hiddenChest('sprite', 'exquisite', s.x + 2.2, s.z + 1.2, 0);
    // shrine: a small stone lantern with an empty crystal cradle
    const sh = new THREE.Group(); sh.position.set(s.x, sy, s.z); scene.add(sh);
    mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.4, 8), M.stoneDark, sh, 0, 0.2, 0);
    mesh(rb(0.8, 1.6, 0.8, 0.1), M.stone, sh, 0, 1.2, 0);
    mesh(new THREE.ConeGeometry(0.9, 0.7, 4), M.stone, sh, 0, 2.55, 0).rotation.y = Math.PI / 4;
    mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20), M.gold, sh, 0, 2.05, 0).rotation.x = Math.PI / 2;
    C.add({ type: 'cyl', x: s.x, z: s.z, r: 0.75, top: sy + 2.9, bottom: sy - 1 });
    // path: from the far side of the heritage plaza up the hill to the shrine
    const a0 = new THREE.Vector3(dent.pos.x + 15, 0, dent.pos.z + 6);
    const way = [];
    for (let k = 0; k <= 5; k++) {
      const f = k / 5, x = a0.x + (s.x - a0.x) * f + Math.sin(f * Math.PI * 2) * 4, z = a0.z + (s.z - a0.z) * f + Math.sin(f * Math.PI) * 5;
      way.push(new THREE.Vector3(x, ground(x, z) + 1.6, z));
    }
    way[5].set(s.x, sy + 2.1, s.z);
    const spm = new THREE.SpriteMaterial({ map: combat.orbTex, color: '#bff4ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Group(); const core = new THREE.Sprite(spm); core.scale.setScalar(1.1); sprite.add(core);
    const tail = []; for (let i = 0; i < 6; i++) { const t2 = new THREE.Sprite(spm); t2.scale.setScalar(0.5 - i * 0.06); scene.add(t2); tail.push(t2); }
    scene.add(sprite);
    const sp = { i: 0, pos: way[0].clone(), moving: false, done: solved('sprite'), hist: [] };
    if (sp.done) { sprite.visible = false; tail.forEach((t2) => { t2.visible = false; }); }
    const cradle = STD({ color: '#ffffff', emissive: '#7fe3ff', emissiveIntensity: sp.done ? 1.4 : 0.1 });
    mesh(new THREE.OctahedronGeometry(0.26, 0), cradle, sh, 0, 2.1, 0);
    out.update.push((t, dt) => {
      if (sp.done) return;
      const P = player.pos;
      if (!sp.moving && sp.i < way.length - 1 && P.distanceTo(sp.pos) < 4.2) { sp.moving = true; sp.i++; }
      if (sp.moving) {
        const tg = way[sp.i], d = tg.clone().sub(sp.pos), L = d.length();
        if (L < 0.15) { sp.moving = false; if (sp.i === way.length - 1) { sp.done = true; cradle.emissiveIntensity = 1.4; sprite.visible = false; tail.forEach((t2) => { t2.visible = false; }); solve('sprite', ch, '光灵归龛'); } }
        else sp.pos.addScaledVector(d, Math.min(1, 6.5 * dt / L));
      }
      sprite.position.copy(sp.pos).add(new THREE.Vector3(0, Math.sin(t * 3) * 0.15, 0));
      sp.hist.unshift(sprite.position.clone()); if (sp.hist.length > 30) sp.hist.pop();
      tail.forEach((t2, i) => { const h = sp.hist[Math.min(sp.hist.length - 1, (i + 1) * 4)]; if (h) t2.position.copy(h); });
      core.material.opacity = 0.8 + Math.sin(t * 6) * 0.2;
    });
    out.list.push({ id: 'sprite', name: '光灵', pos: way[0].clone(), debug: { sp, way } });
  }

  // =============================================================== 8. 七符封印 (the great seal on the eastern highland)
  // Seven coloured sectors on a stone wheel, each carrying a rune. Every rune is a letter A–G joined to its own mirror image
  // (the player is never told). Reading the colours in the letters' order gives the code for the seven crystal buttons.
  if (S.seal) {
    const s = S.seal, y0 = ground(s.x, s.z);
    const st = SP.seal = SP.seal || {};
    if (!Array.isArray(st.colors) || st.colors.length !== 7) {      // colours are dealt to the letters once per journey
      const p = [0, 1, 2, 3, 4, 5, 6]; for (let i = 6; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
      st.colors = p;
    }
    const COL = st.colors;                                   // COL[letter] = rainbow colour index (letter 0 = A)
    const WHEEL = [6, 5, 0, 4, 1, 3, 2];                     // clockwise from the north: G F A E B D C
    const step = Math.PI * 2 / 7, off = 1.5 * Math.PI - 5 * step - step / 2;          // a sector boundary points due west
    const dirOf = (phi) => [Math.sin(phi), -Math.cos(phi)];                          // phi: clockwise from north
    const at = (phi, r) => { const [dx, dz] = dirOf(phi); return [s.x + dx * r, s.z + dz * r]; };
    // ---- rune textures
    const GLYPH = {
      A: [['l', -0.62, -0.86, 0.62, 0.86], ['l', 0.62, -0.86, -0.62, 0.86], ['l', -0.42, 0.56, 0.42, 0.56], ['l', -0.42, -0.56, 0.42, -0.56]],
      B: [['l', 0, -0.9, 0, 0.9], ['e', 0, -0.45, 0.56, 0.45], ['e', 0, 0.45, 0.7, 0.45]],
      C: [['e', 0, 0, 0.82, 0.82]],
      D: [['e', 0, 0, 0.82, 0.82], ['l', 0, -0.82, 0, 0.82]],
      E: [['l', 0, -0.86, 0, 0.86], ['l', -0.72, -0.86, 0.72, -0.86], ['l', -0.54, 0, 0.54, 0], ['l', -0.72, 0.86, 0.72, 0.86]],
      F: [['p', [[-0.68, 0.9], [-0.68, -0.86], [0.68, -0.86], [0.68, 0.9]]], ['l', -0.68, -0.02, 0.68, -0.02]],
      G: [['e', 0, 0, 0.82, 0.82], ['l', -0.44, 0.08, 0.44, 0.08], ['l', 0, 0.08, 0, 0.82]],
    };
    const glyphTex = (L) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
      const X = (v) => 128 + v * 96;
      g.strokeStyle = '#ffffff'; g.lineWidth = 17; g.lineCap = 'round'; g.lineJoin = 'round';
      g.shadowColor = 'rgba(255,255,255,0.85)'; g.shadowBlur = 16;
      for (const sh of GLYPH[L]) {
        g.beginPath();
        if (sh[0] === 'l') { g.moveTo(X(sh[1]), X(sh[2])); g.lineTo(X(sh[3]), X(sh[4])); }
        else if (sh[0] === 'e') g.ellipse(X(sh[1]), X(sh[2]), sh[3] * 96, sh[4] * 96, 0, 0, Math.PI * 2);
        else sh[1].forEach(([x, y], i) => (i ? g.lineTo(X(x), X(y)) : g.moveTo(X(x), X(y))));
        g.stroke();
      }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    };
    const LETTERS = 'ABCDEFG';
    const tex = [...LETTERS].map(glyphTex);
    // ---- the wheel
    const base = floor(s, 18.2);
    const sectorGeo = (r0, r1, a0, a1, depth) => {
      const sh = new THREE.Shape(); sh.absarc(0, 0, r1, a0, a1, false); sh.absarc(0, 0, r0, a1, a0, true);
      const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 20 }); geo.rotateX(-Math.PI / 2); return geo;
    };
    const flatRing = (r, w, y) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, w, 6, 96), M.gold); m.rotation.x = Math.PI / 2; m.position.y = y; base.add(m); };
    flatRing(8.35, 0.09, 0.14); flatRing(16.35, 0.09, 0.14); flatRing(5.6, 0.05, 0.1);
    const sectors = [];
    for (let k = 0; k < 7; k++) {
      const L = WHEEL[k], ci = COL[L], col = new THREE.Color(RAINBOW[ci]);
      const phi = off + k * step, th = Math.PI / 2 - phi;
      const mat = STD({ color: col.clone().lerp(new THREE.Color('#ffffff'), 0.18), emissive: col, emissiveIntensity: 0.32, roughness: 0.55 });
      const sec = new THREE.Mesh(sectorGeo(8.45, 16.25, th - step / 2 + 0.012, th + step / 2 - 0.012, 0.07), mat);
      sec.position.y = 0.06; sec.receiveShadow = true; base.add(sec);
      // gold divider on the boundary after this sector
      const pb = phi + step / 2, div = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 7.9), M.gold);
      const [ddx, ddz] = dirOf(pb); div.position.set(ddx * 12.35, 0.13, ddz * 12.35); div.rotation.y = Math.atan2(ddx, ddz); base.add(div);
      // the rune laid into the floor, its top pointing outward
      const holder = new THREE.Group(); const [cx, cz] = dirOf(phi); holder.position.set(cx * 12.35, 0.15, cz * 12.35); holder.rotation.y = -phi; base.add(holder);
      const fm = new THREE.MeshBasicMaterial({ map: tex[L], color: '#fffaf0', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const rune = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), fm); rune.rotation.x = -Math.PI / 2; holder.add(rune);
      // a standing stone on the rim repeats the rune, glowing in the sector's colour
      const [sx, sz] = at(phi, 17.35);
      const stone = new THREE.Group(); stone.position.set(sx, y0, sz); stone.rotation.y = -phi; scene.add(stone);
      mesh(rb(1.7, 3.0, 0.5, 0.1), M.stone, stone, 0, 1.6, 0);
      mesh(new THREE.BoxGeometry(1.95, 0.22, 0.75), M.stoneDark, stone, 0, 0.11, 0);
      mesh(new THREE.BoxGeometry(1.9, 0.12, 0.62), M.gold, stone, 0, 3.16, 0);
      const sm = new THREE.MeshBasicMaterial({ map: tex[L], color: col.clone().lerp(new THREE.Color('#ffffff'), 0.25), transparent: true, depthWrite: false });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), sm); face.position.set(0, 1.85, 0.26); stone.add(face);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), sm); back.position.set(0, 1.85, -0.26); back.rotation.y = Math.PI; stone.add(back);
      const gem = mesh(new THREE.OctahedronGeometry(0.26, 0), STD({ color: '#ffffff', emissive: col, emissiveIntensity: 1.3, roughness: 0.2 }), stone, 0, 3.75, 0);
      C.add({ type: 'cyl', x: sx, z: sz, r: 0.95, top: y0 + 3.25, bottom: y0 - 1 });
      sectors.push({ k, L, ci, phi, mat, gem });
    }
    // ---- the central dais and the great seal
    const dais = new THREE.Group(); dais.position.set(s.x, y0, s.z); scene.add(dais);
    mesh(new THREE.CylinderGeometry(4.8, 5.15, 0.42, 56), M.stoneDark, dais, 0, 0.24, 0);
    { const m = new THREE.Mesh(new THREE.TorusGeometry(4.55, 0.07, 6, 80), M.gold); m.rotation.x = Math.PI / 2; m.position.y = 0.46; dais.add(m); }
    C.add({ type: 'cyl', x: s.x, z: s.z, r: 5.1, top: y0 + 0.45, bottom: y0 - 1 });
    const dy = y0 + 0.45;
    const ch = world.addChest('pz_seal', 'luxurious', s.x, s.z, -Math.PI / 2, { hidden: true, y: dy });
    if (solved('seal') && !ch.opened) { ch.hidden = false; ch.g.visible = true; if (ch.col) ch.col.off = false; }
    const seal = new THREE.Group(); seal.position.set(s.x, dy, s.z); scene.add(seal);
    const rings = [sealRing(3.5, 4.35, 44), sealRing(2.55, 3.15, 30), sealRing(1.45, 1.85, 18)];
    rings[0].position.y = 0.12; rings[1].position.y = 1.7; rings[2].position.y = 5.2;
    rings.forEach((r) => seal.add(r));
    // a tube of light: brighter at its silhouette and its foot, fading upward
    const pillarM = new THREE.ShaderMaterial({
      uniforms: { uC: { value: new THREE.Color('#ff6a80') }, uA: { value: 1 } },
      vertexShader: 'varying vec2 vUv; varying float vEdge; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vec3 n = normalize(mat3(modelMatrix) * normal); vec3 v = normalize(cameraPosition - wp.xyz); vEdge = 1.0 - abs(dot(n, v)); gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; varying float vEdge; void main(){ float f = pow(1.0 - vUv.y, 1.6); float e = 0.12 + 0.88 * pow(vEdge, 2.5); float foot = smoothstep(0.12, 0.0, vUv.y) * 0.5; gl_FragColor = vec4(uC * 1.3, clamp((f * e + foot) * uA * 0.75, 0.0, 1.0)); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 18, 48, 1, true), pillarM); pillar.position.y = 9; seal.add(pillar);
    const coreM = STD({ color: '#3a1030', emissive: '#ff3050', emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.3, flatShading: true });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), coreM); core.position.y = 2.9; seal.add(core);
    const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: combat.orbTex, color: '#ff4060', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); coreGlow.scale.setScalar(4.2); coreGlow.position.y = 2.9; seal.add(coreGlow);
    // seven input sockets in an arch above the core, read left to right from the console
    const ARCH = 3.4, slotPos = (i) => { const a = Math.PI * (5 / 6) - i * (Math.PI * 2 / 3) / 6; return new THREE.Vector3(0, 2.9 + Math.sin(a) * ARCH, Math.cos(a) * ARCH); };
    const slots = [];
    for (let i = 0; i < 7; i++) {
      const om = STD({ color: '#d8dce6', emissive: '#ffffff', emissiveIntensity: 0.05, roughness: 0.15, transparent: true, opacity: 0.55 });
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), om); orb.position.copy(slotPos(i)); seal.add(orb);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: combat.orbTex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(1.9); orb.add(gl);
      slots.push({ orb, om, gl, ci: -1 });
    }
    const blocker = C.add({ type: 'cyl', x: s.x, z: s.z, r: 4.3, top: y0 + 9, bottom: y0 - 1 });
    if (solved('seal')) { seal.visible = false; blocker.off = true; for (const sc of sectors) sc.mat.emissiveIntensity = 0.55; }
    // ---- the console: seven crystal buttons in rainbow order on an arc west of the wheel (赤 on the left as you face the seal)
    { const cf = new THREE.Mesh(sectorGeo(17.9, 23.9, Math.PI / 2 - (1.5 * Math.PI) - 0.46, Math.PI / 2 - (1.5 * Math.PI) + 0.46, 0.3), M.stone); cf.position.set(s.x, y0 - 0.24, s.z); cf.receiveShadow = true; scene.add(cf); }
    const btns = [];
    for (let ci = 0; ci < 7; ci++) {
      const phi = 1.5 * Math.PI + 0.36 - ci * 0.12, [bx, bz] = at(phi, 21);
      const grp = new THREE.Group(); grp.position.set(bx, y0, bz); grp.rotation.y = Math.PI - phi; scene.add(grp);
      mesh(rb(0.95, 0.24, 0.95, 0.06), M.stoneDark, grp, 0, 0.12, 0);
      mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.95, 12), M.stone, grp, 0, 0.7, 0);
      mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.14, 14), M.gold, grp, 0, 1.22, 0);
      const col = new THREE.Color(RAINBOW[ci]);
      const bm = STD({ color: col.clone().lerp(new THREE.Color('#ffffff'), 0.3), emissive: col, emissiveIntensity: 0.55, roughness: 0.2 });
      const cap = mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.16, 7), bm, grp, 0, 1.36, 0);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: combat.orbTex, color: col, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(1.6); gl.position.y = 1.5; grp.add(gl);
      C.add({ type: 'cyl', x: bx, z: bz, r: 0.5, top: y0 + 1.44, bottom: y0 - 1 });
      const B = { ci, grp, cap, bm, gl, push: 0, pos: grp.position };
      btns.push(B);
      target(grp.position, 0.6, 1.3, () => press(ci), 'seal');
    }
    // ---- logic
    const input = [];
    let anim = null;
    const motes = [];
    const moteM = (ci) => new THREE.SpriteMaterial({ map: combat.orbTex, color: RAINBOW[ci], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const code = () => [0, 1, 2, 3, 4, 5, 6].map((L) => COL[L]);
    function press(ci) {
      if (solved('seal') || anim || input.length >= 7) return false;
      const B = btns[ci]; B.push = 1;
      fx.sparks(B.pos.clone().setY(y0 + 1.5), RAINBOW[ci], 10, 2.5, 0.25, 0.4, 2);
      const i = input.length; input.push(ci);
      // a spark of that colour flies from the button to its socket above the seal
      const sp = new THREE.Sprite(moteM(ci)); sp.scale.setScalar(0.9); scene.add(sp);
      motes.push({ sp, from: B.pos.clone().setY(y0 + 1.5), to: seal.position.clone().add(slotPos(i)), t: 0, slot: i, ci });
      return true;
    }
    function settle() {
      const ok = input.every((c, i) => c === code()[i]);
      if (ok) { anim = { kind: 'win', t: 0 }; st.fails = 0; }
      else {
        anim = { kind: 'fail', t: 0 }; st.fails = (st.fails || 0) + 1;
        toast(st.fails >= 5 ? '封印纹丝不动。……那些符文，会不会只画了一半？' : '封印纹丝不动……七色的顺序不对');
        ctx.writeSave();
      }
    }
    function fill(i, ci) {
      const S2 = slots[i], col = new THREE.Color(RAINBOW[ci]); S2.ci = ci;
      S2.om.color.copy(col).lerp(new THREE.Color('#ffffff'), 0.35); S2.om.emissive.copy(col); S2.om.emissiveIntensity = 1.4; S2.om.opacity = 0.95;
      S2.gl.material.color.copy(col); S2.gl.material.opacity = 0.85;
      fx.ring(seal.position.clone().add(slotPos(i)), 0.9, RAINBOW[ci], 0.35, 1.6);
    }
    function clearSlots() { for (const S2 of slots) { S2.ci = -1; S2.om.color.set('#d8dce6'); S2.om.emissive.set('#ffffff'); S2.om.emissiveIntensity = 0.05; S2.om.opacity = 0.55; S2.gl.material.opacity = 0; } }
    out.picks.push((P) => {
      if (solved('seal') || anim) return [];
      const r = [];
      for (const B of btns) { const d = Math.hypot(B.pos.x - P.x, B.pos.z - P.z); if (d < 1.9 && Math.abs(B.pos.y - P.y) < 2) r.push({ name: `按下${RB_NAME[B.ci]}色晶钮`, dist: d, item: { name: RB_NAME[B.ci] + '色晶钮', icon: 'crystal', color: RAINBOW[B.ci], rarity: 4 }, pick() { press(B.ci); } }); }
      return r;
    });
    out.update.push((t, dt) => {
      for (const B of btns) { B.push = Math.max(0, B.push - dt * 3); B.cap.position.y = 1.36 - Math.sin(B.push * Math.PI) * 0.09; B.bm.emissiveIntensity = 0.55 + B.push * 1.4; B.gl.material.opacity = 0.25 + B.push * 0.6; }
      for (let j = motes.length - 1; j >= 0; j--) {
        const m = motes[j]; m.t += dt / 0.7; const k = Math.min(1, m.t), e = 1 - (1 - k) ** 2;
        m.sp.position.lerpVectors(m.from, m.to, e); m.sp.position.y += Math.sin(k * Math.PI) * 4;
        if (k >= 1) { scene.remove(m.sp); m.sp.material.dispose(); motes.splice(j, 1); fill(m.slot, m.ci); if (input.length === 7 && !motes.length && !anim) anim = { kind: 'wait', t: 0 }; }
      }
      if (solved('seal') && !anim) return;
      rings[0].rotation.y = t * 0.25; rings[1].rotation.y = -t * 0.4; rings[2].rotation.y = t * 0.7;
      core.rotation.set(t * 0.35, t * 0.5, 0); core.position.y = 2.9 + Math.sin(t * 1.4) * 0.12; coreGlow.position.y = core.position.y;
      if (!(anim && anim.kind === 'win')) pillarM.uniforms.uA.value = 0.85 + Math.sin(t * 1.7) * 0.15;
      for (const sc of sectors) sc.gem.rotation.y = t * 0.8 + sc.k;
      if (!anim) return;
      anim.t += dt;
      if (anim.kind === 'wait' && anim.t > 0.45) { anim = null; settle(); }
      else if (anim.kind === 'fail') {
        const k = Math.min(1, anim.t / 1.3);
        for (const S2 of slots) { S2.om.emissiveIntensity = 1.4 * (1 - k) + Math.sin(anim.t * 30) * 0.3 * (1 - k); S2.gl.material.opacity = 0.85 * (1 - k); }
        coreM.emissiveIntensity = 0.9 + Math.sin(k * Math.PI) * 1.6; coreGlow.scale.setScalar(4.2 + Math.sin(k * Math.PI) * 2);
        if (k >= 1) { anim = null; input.length = 0; clearSlots(); coreM.emissiveIntensity = 0.9; coreGlow.scale.setScalar(4.2); }
      } else if (anim.kind === 'win') {
        const T = anim.t;
        if (T < 1.1) {                     // the seven lights gather into the core, which turns white
          const k = easeOut(T / 1.1);
          slots.forEach((S2, i) => { S2.orb.position.lerpVectors(slotPos(i), core.position, k); S2.orb.scale.setScalar(1 - k * 0.6); });
          coreM.emissive.lerp(new THREE.Color('#ffffff'), 0.06); coreM.emissiveIntensity = 0.9 + k * 2.5; coreGlow.material.color.lerp(new THREE.Color('#ffffff'), 0.06); coreGlow.scale.setScalar(4.2 + k * 3);
        } else {
          if (!anim.burst) {
            anim.burst = true; core.visible = false; slots.forEach((S2) => { S2.orb.visible = false; });
            const c = seal.position.clone().setY(dy + 2.9);
            for (let ci = 0; ci < 7; ci++) fx.sparks(c, RAINBOW[ci], 14, 9, 0.5, 1.1, 4);
            fx.ring(seal.position.clone().setY(dy + 0.2), 6, '#ffe9a8', 1.2, 2.4);
          }
          const k = Math.min(1, (T - 1.1) / 1.6);
          rings.forEach((r, i) => { r.scale.setScalar(1 + k * (1.4 + i * 0.5)); r.userData.mat.uniforms.uA.value = 1 - k; });
          pillarM.uniforms.uA.value = 1 - k; pillar.scale.set(1 - k * 0.8, 1, 1 - k * 0.8);
          coreGlow.material.opacity = 0.8 * (1 - k); coreGlow.scale.setScalar(7.2 + k * 6);
          if (k >= 1) {
            anim = null; seal.visible = false; blocker.off = true;
            for (const sc of sectors) sc.mat.emissiveIntensity = 0.55;
            solve('seal', ch, '七符封印');
          }
        }
      }
    });
    addTablet(...at(1.5 * Math.PI + 0.62, 22.6), Math.PI - (1.5 * Math.PI + 0.62), '石碑：「七色各守一符。每一枚符都只写了一半，另一半是它在镜中的倒影。循符之序，依次按下七色，大封自解。」——晶钮可以按下（F），也可以攻击它。', 'seal');
    out.list.push({ id: 'seal', name: '七符封印', pos: new THREE.Vector3(s.x, y0, s.z), debug: { COL, WHEEL, code, press, input, btns, sectors, seal, blocker, ch, state: () => (anim ? anim.kind : null), fails: () => st.fails || 0 } });
  }

  return {
    challenge: () => (out.challenge ? out.challenge() : null),
    list: out.list,
    picks(P) { const r = []; for (const f of out.picks) r.push(...f(P)); return r; },
    update(t, dt) { for (const f of out.update) f(t, dt); },
  };
}
