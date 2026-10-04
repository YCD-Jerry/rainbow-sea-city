// Item database, inventory model and SVG icons.
import { artItem } from './artifacts.js';
export const RARITY_BG = {
  1: ['#5f6266', '#8e9196'], 2: ['#36705a', '#62a585'], 3: ['#355f8c', '#6a9bcb'],
  4: ['#5f4392', '#a07dd0'], 5: ['#9a561a', '#e3a24c'],
};
export const TABS = [
  { id: 'weapon', name: '武器', icon: 'sword', color: '#e9eef5' },
  { id: 'artifact', name: '遗珍', icon: 'arttab', color: '#e9eef5' },
  { id: 'dev', name: '养成道具', icon: 'gel', color: '#e9eef5' },
  { id: 'food', name: '食物', icon: 'soup', color: '#e9eef5' },
  { id: 'mat', name: '材料', icon: 'flower', color: '#e9eef5' },
  { id: 'precious', name: '贵重道具', icon: 'crystal', color: '#e9eef5' },
];
export const SUB_NAMES = { crit: '暴击率', critDmg: '暴击伤害', hydro: '水属性伤害加成', atkPct: '攻击力' };

export const ITEMS = {
  resin: { name: '虹露', tab: null, rarity: 4, icon: 'resin', color: '#9fdcff', desc: '回廊里的虹光之花只在虹露的浸润下绽放。每分钟恢复 1 点，上限 160。' },
  advexp: { name: '旅程经验', tab: null, rarity: 3, icon: 'exp', color: '#ffe08a', desc: '提升旅程等级。' },
  starlight: { name: '流光', tab: null, rarity: 5, icon: 'starlight', color: '#bfe8ff', desc: '海面上收集来的一缕流光。160 流光可以换一只漂流瓶。' },
  bottle: { name: '漂流瓶', tab: 'precious', rarity: 5, icon: 'bottle', color: '#9fdcff', desc: '装着一封写给大海的信。在「拾光」中投入大海，潮水会带回回应。', effect: '用于「拾光」，每次消耗 1 只。' },
  coin: { name: '虹贝', tab: null, rarity: 3, icon: 'coin', color: '#ffd36b', desc: '海湾里通用的货币，贝壳内侧映着淡淡的彩虹。' },
  // weapons
  sword_breeze: { name: '海风短剑', tab: 'weapon', type: '单手剑', rarity: 3, atk: 120, sub: ['crit', 0.05], icon: 'sword', color: '#bfe6ff',
    desc: '出发时带在身上的短剑，剑身轻，挥起来带着海风的声音。', passive: '顺风：冲刺后 2 秒内，普通攻击造成的伤害提高 12%。' },
  sword_tide: { name: '潮音细剑', tab: 'weapon', type: '单手剑', rarity: 4, atk: 185, sub: ['hydro', 0.24], icon: 'sword', color: '#7fd4ff',
    desc: '剑脊里封着一段潮声。挥动时，剑尖会甩出细小的水珠。', passive: '潮汐：技能命中后，属性伤害提高 16%，持续 6 秒。' },
  sword_coral: { name: '珊瑚长剑', tab: 'weapon', type: '单手剑', rarity: 4, atk: 210, sub: ['critDmg', 0.2], icon: 'sword', color: '#ff9fb4',
    desc: '用浅海珊瑚打磨成的长剑，比看上去更坚硬。', passive: '礁护：生命值高于 70% 时，暴击率提高 8%。' },
  sword_rainbow: { name: '虹光之刃', tab: 'weapon', type: '单手剑', rarity: 5, atk: 320, sub: ['crit', 0.12], icon: 'sword', color: '#ffe9a8',
    desc: '传说彩虹落进海里的地方，长出了这把剑。阳光下能看见七种颜色。', passive: '虹落：绝技后 10 秒内，攻击力提高 24%。' },
  bow_dawn: { name: '晨曦长弓', tab: 'weapon', type: '弓', rarity: 4, atk: 200, sub: ['crit', 0.1], icon: 'bow', color: '#ffe08a',
    desc: '曜从不离身的长弓，弓臂里嵌着一缕清晨的光。', passive: '折光：「虹折」产生的七色箭伤害提高 20%。' },
  sword_iron: { name: '铁鳞剑', tab: 'weapon', type: '单手剑', rarity: 3, atk: 112, sub: ['atkPct', 0.09], icon: 'sword', color: '#d6dde6',
    desc: '海湾铁匠铺最常见的单手剑，剑格上刻着一片鱼鳞。', passive: '坚韧：生命值高于 50% 时，攻击力提高 8%。' },
  bow_reed: { name: '芦苇短弓', tab: 'weapon', type: '弓', rarity: 3, atk: 105, sub: ['crit', 0.05], icon: 'bow', color: '#e8dcb0',
    desc: '用海边芦苇杆和鱼胶做成的短弓，轻得几乎没有分量。', passive: '轻弦：普通攻击伤害提高 10%。' },
  bow_lake: { name: '镜湖长弓', tab: 'weapon', type: '弓', rarity: 4, atk: 196, sub: ['atkPct', 0.18], icon: 'bow', color: '#bff7ee',
    desc: '弓臂里封着一片镜湖的水面，拉开时能看见倒影。', passive: '倒影：「折返」的光箭伤害提高 24%。' },
  bow_sun: { name: '曜日长弓', tab: 'weapon', type: '弓', rarity: 5, atk: 312, sub: ['critDmg', 0.4], icon: 'bow', color: '#ffd36a',
    desc: '传说中把落日拉回天空的那张弓。', passive: '日冕：光束与光箭造成的伤害提高 16%。' },
  // development items
  gel1: { name: '凝胶碎片', tab: 'dev', rarity: 1, icon: 'gel', color: '#ffb37a', desc: '史莱姆留下的软凝胶，捏起来有点弹。', use: '角色与武器突破材料。' },
  gel2: { name: '透亮凝胶', tab: 'dev', rarity: 2, icon: 'gel', color: '#8fe0ff', desc: '更透明的凝胶，阳光能穿过它。', use: '角色与武器突破材料。' },
  gel3: { name: '虹彩凝核', tab: 'dev', rarity: 3, icon: 'gel', color: '#d9a8ff', desc: '凝胶最深处的核，会随着视角变换颜色。', use: '角色与武器突破材料。' },
  core: { name: '潮蚀岩芯', tab: 'dev', rarity: 4, icon: 'core', color: '#6fe7ff', desc: '礁岩守卫胸口的发光岩芯，被海水打磨了很多年。', use: '高级突破材料。' },
  // food
  berry: { name: '虹莓', tab: 'food', rarity: 1, icon: 'berry', color: '#ff5f7e', heal: { flat: 300 }, desc: '海崖灌木上的小莓果，酸里带甜。', effect: '恢复 300 点生命值。' },
  riceball: { name: '海盐饭团', tab: 'food', rarity: 2, icon: 'riceball', color: '#ffffff', heal: { pct: 0.2, flat: 400 }, desc: '用海盐捏紧的饭团，适合赶路时吃。', effect: '恢复 20% 生命值上限，并额外恢复 400 点生命值。' },
  skewer: { name: '炭烤鱼串', tab: 'food', rarity: 2, icon: 'skewer', color: '#ffb35a', buff: { atk: 0.15, dur: 300 }, desc: '外皮微焦的鱼串，吃完浑身是劲。', effect: '300 秒内攻击力提高 15%。' },
  soup: { name: '珊瑚鲜汤', tab: 'food', rarity: 3, icon: 'soup', color: '#ff9f80', heal: { pct: 0.35, flat: 500 }, regen: { pct: 0.03, dur: 10 }, desc: '慢火熬出的鲜汤，喝一口就暖和起来。', effect: '恢复 35% 生命值上限并额外恢复 500 点，之后 10 秒内每秒恢复 3%。' },
  soda: { name: '薄荷汽水', tab: 'food', rarity: 3, icon: 'soda', color: '#7ff0d0', buff: { stam: 0.25, dur: 300 }, desc: '冰凉的汽水，气泡一直冒到喉咙。', effect: '300 秒内冲刺、攀爬、游泳与滑翔消耗的体力降低 25%。' },
  // materials
  flower: { name: '晴空花', tab: 'mat', rarity: 1, icon: 'flower', color: '#7fc4ff', desc: '只在晴天开放的蓝色小花。', use: '可用于烹饪与合成。' },
  shell: { name: '海晶贝', tab: 'mat', rarity: 1, icon: 'shell', color: '#ffc4d6', desc: '沙滩上的小贝壳，内壁像晶体一样反光。', use: '可用于合成与装饰。' },
  bell: { name: '虹铃花', tab: 'mat', rarity: 3, icon: 'bell', color: '#ffb3e6', desc: '花瓣是七种颜色的小铃铛花。织光者喜欢把它们种成整齐的方阵。', use: '稀有的观赏植物。' },
  scrap: { name: '无人机残骸', tab: 'mat', rarity: 2, icon: 'scrap', color: '#c9d1da', desc: '被光箭击落的送货无人机，螺旋桨还在微微转动。虹湾回收站按件收购。', use: '可在之后的版本中用于合成与兑换。' },
  ore: { name: '白铁矿', tab: 'mat', rarity: 1, icon: 'ore', color: '#d8e2ea', desc: '岩壁上常见的矿石，用来锻造武器。', use: '锻造材料。' },
  crystalore: { name: '虹铁晶', tab: 'mat', rarity: 2, icon: 'ore', color: '#a8f0ff', desc: '偶尔从白铁矿里敲出来的晶体。', use: '高级锻造材料。' },
  // precious
  rainbow: { name: '虹晶', tab: 'precious', rarity: 4, icon: 'crystal', color: '#ffffff', desc: '散落在海湾高处的彩虹结晶。', effect: '带到「虹之像」献上，每 4 枚使体力上限提高 25 点。全海湾共 12 枚。' },
  journal: { name: '旅行手记', tab: 'precious', rarity: 4, icon: 'book', color: '#f2d7a0', desc: '你的旅行手记。第一页写着：「光穿过水，会变成彩虹。让澜先立起水幕，再让曜把箭射过去。」' },
};

export const WEAPON_DEFAULT = 'sword_breeze';

export class Inventory {
  constructor() { this.counts = {}; this.weapons = []; this.artifacts = []; this.equipped = 0; this.nextUid = 1; this.fresh = new Set(); }
  addArtifact(a) { a.uid = this.nextUid++; a.owner = null; this.artifacts.push(a); this.fresh.add('a' + a.uid); return a; }
  artifact(uid) { return this.artifacts.find((a) => a.uid === uid) || null; }
  removeArtifact(uid) { const i = this.artifacts.findIndex((a) => a.uid === uid); if (i >= 0) this.artifacts.splice(i, 1); }
  equippedArts(owner) { return this.artifacts.filter((a) => a.owner === owner); }
  add(id, n = 1) {
    const it = ITEMS[id]; if (!it || n <= 0) return;
    if (it.tab === 'weapon') {
      let last = null;
      for (let i = 0; i < n; i++) { const w = { uid: this.nextUid++, id, owner: null }; this.weapons.push(w); this.fresh.add('w' + w.uid); last = w; }
      return last;
    } else { this.counts[id] = (this.counts[id] || 0) + n; this.fresh.add(id); }
  }
  count(id) { return this.counts[id] || 0; }
  remove(id, n = 1) { const c = this.count(id); if (c < n) return false; this.counts[id] = c - n; if (!this.counts[id]) delete this.counts[id]; return true; }
  weaponItem() {
    const w = this.weapons.find((x) => x.uid === this.equipped) || this.weapons[0];
    return ITEMS[w ? w.id : WEAPON_DEFAULT];
  }
  weaponOf(owner) { return this.weapons.find((w) => w.owner === owner) || null; }
  entries(tab) {
    if (tab === 'artifact') {
      return this.artifacts.map((a) => ({ key: 'a' + a.uid, id: 'art', uid: a.uid, count: 1, item: artItem(a), art: a }))
        .sort((x, y) => y.art.rarity - x.art.rarity || y.art.level - x.art.level || x.uid - y.uid);
    }
    if (tab === 'weapon') {
      return this.weapons.map((w) => ({ key: 'w' + w.uid, id: w.id, uid: w.uid, owner: w.owner || null, count: 1, item: ITEMS[w.id] }))
        .sort((a, b) => (!!b.owner) - (!!a.owner) || b.item.rarity - a.item.rarity || a.uid - b.uid);
    }
    const order = Object.keys(ITEMS);
    return Object.entries(this.counts).filter(([id, c]) => c > 0 && ITEMS[id] && ITEMS[id].tab === tab)
      .map(([id, c]) => ({ key: id, id, count: c, item: ITEMS[id] }))
      .sort((a, b) => b.item.rarity - a.item.rarity || order.indexOf(a.id) - order.indexOf(b.id));
  }
  total(tab) { return this.entries(tab).length; }
  toJSON() { return { counts: this.counts, weapons: this.weapons, artifacts: this.artifacts, equipped: this.equipped, nextUid: this.nextUid }; }
  static from(o) {
    const inv = new Inventory();
    if (o && typeof o === 'object') {
      inv.counts = o.counts || {}; inv.weapons = Array.isArray(o.weapons) ? o.weapons.filter((w) => ITEMS[w.id]) : [];
      inv.artifacts = Array.isArray(o.artifacts) ? o.artifacts.filter((a) => a && a.set && a.slot && a.main) : [];
      inv.equipped = o.equipped || 0; inv.nextUid = Math.max(o.nextUid || 1, ...inv.weapons.map((w) => w.uid + 1), ...inv.artifacts.map((a) => a.uid + 1), 1);
    }
    return inv;
  }
}

// ---------- icons ----------
let gid = 0;
export function iconSVG(item, extra = '') {
  if (item.svg) return item.svg(extra);
  const c = item.color || '#ffffff';
  const id = 'g' + (gid++);
  const grad = (a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
  const S = (inner, defs = '') => `<svg viewBox="0 0 64 64" aria-hidden="true" ${extra}>${defs}${inner}</svg>`;
  switch (item.icon) {
    case 'sword': return S(`
      <path d="M46 6 L58 6 L58 18 L28 46 L18 36 Z" fill="url(#${id})" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M50 10 L24 38" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.6"/>
      <path d="M12 34 L30 52" stroke="#f3cf7a" stroke-width="5" stroke-linecap="round"/>
      <path d="M20 44 L9 55" stroke="#5b3b2a" stroke-width="5" stroke-linecap="round"/>
      <circle cx="8" cy="56" r="3.4" fill="#f3cf7a"/>`, grad('#ffffff', c));
    case 'bow': return S(`
      <path d="M18 6 C46 14 52 44 22 58" stroke="url(#${id})" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M18 6 L22 58" stroke="#ffffff" stroke-width="1.5"/>
      <path d="M8 34 L52 30" stroke="#f3cf7a" stroke-width="2.5"/><path d="M52 30 L44 26 L45 34 Z" fill="#fff"/>`, grad('#fff6d6', c));
    case 'gel': return S(`
      <path d="M32 10 C42 22 52 30 52 41 C52 52 43 58 32 58 C21 58 12 52 12 41 C12 30 22 22 32 10 Z" fill="url(#${id})" stroke="#fff" stroke-opacity=".8" stroke-width="1.5"/>
      <ellipse cx="24" cy="38" rx="5" ry="8" fill="#fff" opacity=".55" transform="rotate(-20 24 38)"/>`, grad('#ffffff', c));
    case 'core': return S(`
      <path d="M32 6 L54 18 L54 46 L32 58 L10 46 L10 18 Z" fill="#6b7680" stroke="#c9d3db" stroke-width="2"/>
      <path d="M32 18 L44 25 L44 39 L32 46 L20 39 L20 25 Z" fill="url(#${id})"/>
      <circle cx="32" cy="32" r="6" fill="#fff" opacity=".85"/>`, grad('#ffffff', c));
    case 'berry': return S(`
      <path d="M30 12 C34 6 44 6 46 12 C40 12 36 14 32 18 Z" fill="#6fbf4a"/>
      <circle cx="24" cy="36" r="11" fill="url(#${id})"/><circle cx="40" cy="34" r="11" fill="url(#${id})"/><circle cx="32" cy="48" r="11" fill="url(#${id})"/>
      <circle cx="21" cy="32" r="3" fill="#fff" opacity=".7"/><circle cx="37" cy="30" r="3" fill="#fff" opacity=".7"/><circle cx="29" cy="44" r="3" fill="#fff" opacity=".7"/>`, grad('#ffb3c4', c));
    case 'riceball': return S(`
      <path d="M32 8 C42 8 56 40 54 48 C52 56 12 56 10 48 C8 40 22 8 32 8 Z" fill="#fbfbf6" stroke="#d9d6c8" stroke-width="1.5"/>
      <rect x="20" y="38" width="24" height="18" rx="3" fill="#2d4a3a"/>
      <circle cx="30" cy="24" r="1.6" fill="#e8b7a0"/><circle cx="36" cy="28" r="1.4" fill="#e8b7a0"/>`);
    case 'skewer': return S(`
      <path d="M8 56 L56 8" stroke="#c9a26b" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="26" cy="38" rx="11" ry="7" fill="url(#${id})" transform="rotate(-45 26 38)"/>
      <ellipse cx="40" cy="24" rx="11" ry="7" fill="url(#${id})" transform="rotate(-45 40 24)"/>
      <path d="M20 40 L30 30 M34 26 L44 16" stroke="#7a3e1c" stroke-width="2" opacity=".6"/>`, grad('#ffd59a', c));
    case 'soup': return S(`
      <path d="M22 10 C18 16 26 18 22 24 M32 8 C28 14 36 16 32 22 M42 10 C38 16 46 18 42 24" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M8 30 L56 30 C56 46 46 56 32 56 C18 56 8 46 8 30 Z" fill="#f4f1ea" stroke="#d2cbbb" stroke-width="1.5"/>
      <ellipse cx="32" cy="30" rx="24" ry="6" fill="url(#${id})"/>`, grad('#ffd0b8', c));
    case 'soda': return S(`
      <rect x="24" y="6" width="16" height="6" rx="2" fill="#4aa58c"/>
      <path d="M26 12 L38 12 L40 20 C46 24 46 28 46 32 L46 52 C46 56 44 58 40 58 L24 58 C20 58 18 56 18 52 L18 32 C18 28 18 24 24 20 Z" fill="url(#${id})" stroke="#fff" stroke-opacity=".8" stroke-width="1.5"/>
      <circle cx="28" cy="40" r="2" fill="#fff" opacity=".8"/><circle cx="35" cy="48" r="1.6" fill="#fff" opacity=".8"/><circle cx="36" cy="34" r="1.3" fill="#fff" opacity=".8"/>`, grad('#e6fff7', c));
    case 'bell': return S(`
      <path d="M32 30 V58" stroke="#5fa834" stroke-width="3"/><path d="M32 46 C24 40 18 42 16 48 C24 50 28 48 32 46 Z" fill="#6fbf4a"/>
      ${['#ff5d6c', '#ffb347', '#ffd84a', '#5fdc7a', '#4fd2ff', '#5b7bff', '#b06bff'].map((c, i) => { const a = -Math.PI / 2 + (i - 3) * 0.42; return `<ellipse cx="${(32 + Math.cos(a) * 13).toFixed(1)}" cy="${(24 + Math.sin(a) * 13).toFixed(1)}" rx="5" ry="8" fill="${c}" transform="rotate(${(a * 180 / Math.PI + 90).toFixed(0)} ${(32 + Math.cos(a) * 13).toFixed(1)} ${(24 + Math.sin(a) * 13).toFixed(1)})"/>`; }).join('')}
      <circle cx="32" cy="26" r="5" fill="#fff6c8"/>`);
    case 'scrap': return S(`
      <rect x="18" y="26" width="28" height="12" rx="4" fill="url(#${id})" stroke="#fff" stroke-width="1.5" transform="rotate(-12 32 32)"/>
      <path d="M14 20 L24 28 M50 18 L40 27 M12 46 L23 38" stroke="#7a8592" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="12" cy="18" rx="8" ry="2.4" fill="#4a5366" transform="rotate(-20 12 18)"/><ellipse cx="52" cy="16" rx="8" ry="2.4" fill="#4a5366" transform="rotate(15 52 16)"/>
      <path d="M30 40 L28 50 L34 46 L33 56" stroke="#ffb347" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="40" cy="30" r="2.4" fill="#ff8a6a"/>`, grad('#ffffff', c));
    case 'flower': return S(`
      <path d="M32 36 C32 46 30 52 26 58" stroke="#5aa84a" stroke-width="3" fill="none"/>
      ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="32" cy="18" rx="7" ry="11" fill="url(#${id})" transform="rotate(${a} 32 30)"/>`).join('')}
      <circle cx="32" cy="30" r="5" fill="#ffe680"/>`, grad('#e8f6ff', c));
    case 'shell': return S(`
      <path d="M32 8 C50 10 58 30 54 46 L10 46 C6 30 14 10 32 8 Z" fill="url(#${id})" stroke="#fff" stroke-opacity=".8" stroke-width="1.5"/>
      ${[-16, -8, 0, 8, 16].map((dx) => `<path d="M32 50 L${32 + dx * 1.3} 14" stroke="#fff" stroke-opacity=".55" stroke-width="1.6"/>`).join('')}
      <path d="M24 46 L40 46 L36 56 L28 56 Z" fill="url(#${id})"/>`, grad('#fff4f8', c));
    case 'ore': return S(`
      <path d="M10 44 L20 20 L36 12 L52 24 L56 44 L40 56 L20 54 Z" fill="#8f979e" stroke="#c4ccd2" stroke-width="1.5"/>
      <path d="M24 38 L30 22 L38 30 L34 46 Z" fill="url(#${id})"/><path d="M40 40 L46 30 L50 42 Z" fill="url(#${id})"/>`, grad('#ffffff', c));
    case 'crystal': return S(`
      <defs><linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ad5"/><stop offset=".3" stop-color="#ffe27a"/><stop offset=".55" stop-color="#8ff0b0"/><stop offset=".8" stop-color="#7fc8ff"/><stop offset="1" stop-color="#c5a3ff"/></linearGradient></defs>
      <path d="M32 4 L50 26 L32 60 L14 26 Z" fill="url(#${id}r)" stroke="#fff" stroke-width="2"/>
      <path d="M14 26 L50 26 M32 4 L32 60" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/>`);
    case 'book': return S(`
      <rect x="12" y="8" width="38" height="48" rx="4" fill="#5b7fb0"/><rect x="16" y="8" width="34" height="48" rx="3" fill="url(#${id})"/>
      <path d="M22 20 L44 20 M22 28 L44 28 M22 36 L38 36" stroke="#6b5a3a" stroke-width="2" opacity=".6"/>`, grad('#fff6df', c));
    case 'arttab': return S(`
      <path d="M20 6 Q32 20 44 6" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M32 18 C46 20 54 34 50 46 C46 56 18 56 14 46 C10 34 18 20 32 18 Z" fill="url(#${id})" stroke="#fff" stroke-width="1.6"/>
      ${[-12, -6, 0, 6, 12].map((dx) => `<path d="M32 52 L${32 + dx} 24" stroke="#fff" stroke-opacity=".75" stroke-width="1.6"/>`).join('')}`, grad('#ffffff', '#f3d27a'));
    case 'resin': return S(`
      <defs><linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#9fdcff"/><stop offset=".7" stop-color="#c3a6ff"/><stop offset="1" stop-color="#ff9ad5"/></linearGradient></defs>
      <path d="M32 6 C40 20 50 30 50 41 C50 52 42 59 32 59 C22 59 14 52 14 41 C14 30 24 20 32 6 Z" fill="url(#${id}r)" stroke="#fff" stroke-width="2"/>
      <ellipse cx="25" cy="40" rx="4.5" ry="8" fill="#fff" opacity=".6" transform="rotate(-18 25 40)"/>`);
    case 'exp': return S(`
      <path d="M32 6 L38 26 L58 32 L38 38 L32 58 L26 38 L6 32 L26 26 Z" fill="url(#${id})" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="32" cy="32" r="5" fill="#fff"/>`, grad('#fff6d6', c));
    case 'starlight': return S(`
      <path d="M32 4 L37 26 L60 32 L37 38 L32 60 L27 38 L4 32 L27 26 Z" fill="url(#${id})" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="32" cy="32" r="6" fill="#ffffff"/><circle cx="48" cy="14" r="3" fill="#fff"/><circle cx="14" cy="48" r="2.4" fill="#fff"/>`, grad('#ffffff', c));
    case 'bottle': return S(`
      <rect x="26" y="4" width="12" height="8" rx="2" fill="#c49a6c"/>
      <path d="M27 12 H37 V20 C46 24 50 32 50 40 C50 52 42 58 32 58 C22 58 14 52 14 40 C14 32 18 24 27 20 Z" fill="url(#${id})" stroke="#fff" stroke-width="1.6" opacity=".95"/>
      <rect x="23" y="34" width="18" height="12" rx="2" fill="#fff6dc" transform="rotate(-12 32 40)"/><path d="M25 38 H39 M25 42 H35" stroke="#c49a6c" stroke-width="1.4" transform="rotate(-12 32 40)"/>`, grad('#e8fbff', c));
    case 'coin': return S(`
      <circle cx="32" cy="32" r="22" fill="url(#${id})" stroke="#fff3c4" stroke-width="2"/>
      <path d="M32 18 C40 19 44 28 42 36 L22 36 C20 28 24 19 32 18 Z" fill="#fff" opacity=".75"/>`, grad('#fff0b8', c));
    default: return S(`<circle cx="32" cy="32" r="20" fill="${c}"/>`);
  }
}
