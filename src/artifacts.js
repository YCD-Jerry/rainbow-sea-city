// 遗珍: five slots, main stat + up to four substats, two original sets that feed the 虹折 mechanic.
export const SLOTS = [
  { id: 'flower', name: '贝坠' }, { id: 'plume', name: '帆徽' }, { id: 'sands', name: '星盘' },
  { id: 'goblet', name: '晶瓶' }, { id: 'circlet', name: '戒环' },
];
export const SLOT_NAME = Object.fromEntries(SLOTS.map((s) => [s.id, s.name]));
export const STAT_NAMES = { hp: '生命值', atk: '攻击力', hpPct: '生命值', atkPct: '攻击力', er: '充能效率', cr: '暴击率', cd: '暴击伤害', elem: '属性伤害加成', heal: '治疗加成' };
const PCT = new Set(['hpPct', 'atkPct', 'er', 'cr', 'cd', 'elem', 'heal']);
export const fmtStat = (k, v) => PCT.has(k) ? (v * 100).toFixed(1) + '%' : String(Math.round(v));

export const SETS = {
  prism: {
    name: '折光旅人', color: '#ffd36a', color2: '#ff8fc7',
    two: '攻击力提高 18%。',
    four: '装备者触发的「虹折」七色箭伤害提高 40%；装备者触发的「虹愈」回复量翻倍。',
    desc: '一位追着彩虹走遍海湾的旅人留下的随身物。',
    pieces: { flower: '旅人的贝坠', plume: '旅人的帆徽', sands: '旅人的星盘', goblet: '旅人的晶瓶', circlet: '旅人的戒环' },
  },
  tide: {
    name: '潮音守望', color: '#6fd0ff', color2: '#3a7bd5',
    two: '属性伤害加成提高 15%。',
    four: '技能与绝技造成的伤害提高 25%。',
    desc: '灯塔守望人在潮声里度过一生，这些物件替他记住了每一次涨落。',
    pieces: { flower: '守望者的贝坠', plume: '守望者的帆徽', sands: '守望者的星盘', goblet: '守望者的晶瓶', circlet: '守望者的戒环' },
  },
};

const MAIN_POOL = {
  flower: [['hp', 1]], plume: [['atk', 1]],
  sands: [['atkPct', 4], ['hpPct', 4], ['er', 3]],
  goblet: [['atkPct', 4], ['hpPct', 4], ['elem', 4]],
  circlet: [['cr', 3], ['cd', 3], ['atkPct', 3], ['hpPct', 3], ['heal', 2]],
};
// 5★ main stat at +0 and at +20; lower rarities scale down
const MAIN = { hp: [717, 4780], atk: [47, 311], atkPct: [0.07, 0.466], hpPct: [0.07, 0.466], er: [0.078, 0.518], cr: [0.047, 0.311], cd: [0.093, 0.622], elem: [0.07, 0.466], heal: [0.054, 0.359] };
const R_MAIN = { 3: [0.6, 0.42], 4: [0.9, 0.75], 5: [1, 1] };
export const MAX_LV = { 3: 12, 4: 16, 5: 20 };
const SUB = { hp: 299, atk: 19, hpPct: 0.058, atkPct: 0.058, er: 0.065, cr: 0.039, cd: 0.078 };
const SUB_W = [['hp', 6], ['atk', 6], ['hpPct', 4], ['atkPct', 4], ['er', 4], ['cr', 3], ['cd', 3]];
const R_SUB = { 3: 0.6, 4: 0.8, 5: 1 };

const wpick = (list, rnd = Math.random) => { const t = list.reduce((s, x) => s + x[1], 0); let r = rnd() * t; for (const [k, w] of list) { r -= w; if (r <= 0) return k; } return list[0][0]; };
const roll = (k, rarity) => SUB[k] * R_SUB[rarity] * [0.7, 0.8, 0.9, 1][Math.floor(Math.random() * 4)];

export function mainValue(a) {
  const [s, e] = MAIN[a.main], [rs, re] = R_MAIN[a.rarity];
  const lo = s * rs, hi = e * re;
  return lo + (hi - lo) * (a.level / MAX_LV[a.rarity]);
}

function addSub(a) {
  const taken = new Set([a.main, ...a.subs.map((s) => s[0])]);
  const k = wpick(SUB_W.filter(([x]) => !taken.has(x)));
  a.subs.push([k, roll(k, a.rarity)]);
}

export function makeArtifact(set, rarity, slot) {
  slot = slot || SLOTS[Math.floor(Math.random() * 5)].id;
  const a = { set, slot, rarity, level: 0, main: wpick(MAIN_POOL[slot]), subs: [] };
  const n = rarity === 5 ? (Math.random() < 0.25 ? 4 : 3) : rarity === 4 ? (Math.random() < 0.25 ? 3 : 2) : (Math.random() < 0.3 ? 2 : 1);
  for (let i = 0; i < n; i++) addSub(a);
  return a;
}

// +4 levels: a new substat while fewer than four, otherwise one existing substat rolls again
export function upgradeArtifact(a) {
  if (a.level >= MAX_LV[a.rarity]) return null;
  a.level = Math.min(MAX_LV[a.rarity], a.level + 4);
  if (a.subs.length < 4) { addSub(a); return a.subs[a.subs.length - 1][0]; }
  const s = a.subs[Math.floor(Math.random() * a.subs.length)];
  s[1] += roll(s[0], a.rarity);
  return s[0];
}
export const upgradeCost = (a) => Math.round({ 3: 300, 4: 700, 5: 1200 }[a.rarity] * (1 + a.level / 8));
export const salvageValue = (a) => ({ 3: 150, 4: 420, 5: 900 }[a.rarity] + a.level * 60 * (a.rarity - 2));

export function artName(a) { return SETS[a.set].pieces[a.slot]; }

// Sum a list of equipped artifacts into one stat bag, then fold in set bonuses.
export function artStats(list) {
  const s = { hp: 0, atk: 0, hpPct: 0, atkPct: 0, er: 0, cr: 0, cd: 0, elem: 0, heal: 0, prism: 0, healMul: 1, sb: 0, sets: {} };
  for (const a of list) {
    if (!a) continue;
    s[a.main] += mainValue(a);
    for (const [k, v] of a.subs) s[k] += v;
    s.sets[a.set] = (s.sets[a.set] || 0) + 1;
  }
  const n = (id) => s.sets[id] || 0;
  if (n('prism') >= 2) s.atkPct += 0.18;
  if (n('prism') >= 4) { s.prism += 0.4; s.healMul = 2; }
  if (n('tide') >= 2) s.elem += 0.15;
  if (n('tide') >= 4) s.sb += 0.25;
  return s;
}

// one SVG per slot shape, tinted with the set colours
let aid = 0;
export function artifactSVG(a, extra = '') {
  const S = SETS[a.set], id = 'ar' + (aid++);
  const defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="${S.color}"/><stop offset="1" stop-color="${S.color2}"/></linearGradient></defs>`;
  const f = `fill="url(#${id})" stroke="#fff" stroke-opacity=".85" stroke-width="1.6" stroke-linejoin="round"`;
  let body = '';
  if (a.slot === 'flower') body = `<path d="M20 6 Q32 20 44 6" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M32 18 C46 20 54 34 50 46 C46 56 18 56 14 46 C10 34 18 20 32 18 Z" ${f}/>${[-12, -6, 0, 6, 12].map((dx) => `<path d="M32 52 L${32 + dx} 24" stroke="#fff" stroke-opacity=".7" stroke-width="1.6"/>`).join('')}<circle cx="32" cy="17" r="3" fill="#fff"/>`;
  else if (a.slot === 'plume') body = `<path d="M32 6 L52 14 V32 C52 46 42 54 32 58 C22 54 12 46 12 32 V14 Z" ${f}/><path d="M32 16 V46 M32 18 C40 24 42 34 40 42 L32 42 Z" fill="#fff" opacity=".8"/><path d="M22 46 H44" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
  else if (a.slot === 'sands') body = `<circle cx="32" cy="32" r="24" ${f}/><circle cx="32" cy="32" r="16" fill="none" stroke="#fff" stroke-width="1.6" stroke-opacity=".8"/><path d="M32 12 L35 29 L52 32 L35 35 L32 52 L29 35 L12 32 L29 29 Z" fill="#fff"/><circle cx="32" cy="32" r="3" fill="${S.color2}"/>`;
  else if (a.slot === 'goblet') body = `<rect x="25" y="5" width="14" height="7" rx="2" fill="#fff"/><path d="M27 12 H37 V20 C46 24 50 32 50 40 C50 52 42 58 32 58 C22 58 14 52 14 40 C14 32 18 24 27 20 Z" ${f}/><path d="M18 40 C24 36 40 44 46 40" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/><circle cx="25" cy="34" r="3" fill="#fff" opacity=".7"/>`;
  else body = `<circle cx="32" cy="38" r="18" fill="none" stroke="url(#${id})" stroke-width="7"/><circle cx="32" cy="38" r="18" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/><path d="M32 6 L42 16 L32 26 L22 16 Z" ${f}/><path d="M22 16 H42" stroke="#fff" stroke-width="1.2"/>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true" ${extra}>${defs}${body}</svg>`;
}

// item-like wrapper so the bag grid / detail can render artifacts like other items
export function artItem(a) {
  return { name: artName(a), rarity: a.rarity, tab: 'artifact', type: SLOT_NAME[a.slot], art: a, color: SETS[a.set].color, svg: (extra) => artifactSVG(a, extra), desc: SETS[a.set].desc };
}
