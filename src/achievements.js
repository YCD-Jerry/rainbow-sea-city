// 成就 — original categories and achievements. Progress keys are bumped by game events;
// an achievement unlocks when its key reaches the goal (or when unlocked directly), and its 流光 is claimed in the panel.

export const ACH_CATS = [
  { id: 'wonder', name: '海湾奇闻', desc: '这座城市总有些意想不到的事。' },
  { id: 'puzzle', name: '织光谜题', desc: '织光者留下的机关，还在等人来解。' },
  { id: 'travel', name: '行路千里', desc: '走遍海湾的每一个角落。' },
  { id: 'combat', name: '刀光与弦', desc: '战斗中的技巧与成长。' },
  { id: 'domain', name: '回廊行者', desc: '在回廊中磨炼，带回遗珍。' },
  { id: 'gacha', name: '拾光记', desc: '漂流瓶带回来的缘分。' },
  { id: 'story', name: '彩虹往事', desc: '关于那道彩虹的故事。' },
];

// key: progress counter; goal: target (default 1); hidden: name/desc concealed until unlocked
export const ACH = [
  // 海湾奇闻
  { id: 'drone1', cat: 'wonder', name: '天降零件', desc: '用光箭击落一架无人机。', key: 'drone', hidden: true, reward: 10 },
  { id: 'drone10', cat: 'wonder', name: '虹湾回收站', desc: '收集 10 份无人机残骸。', key: 'drone', goal: 10, reward: 20 },
  { id: 'car', cat: 'wonder', name: '请走人行道', desc: '站在悬浮车前面，让它停下来等你。', key: 'carStop', hidden: true, reward: 5 },
  { id: 'fall', cat: 'wonder', name: '地心引力', desc: '从高处摔下来。滑翔翼不是装饰品。', key: 'fall', hidden: true, reward: 5 },
  { id: 'drown', cat: 'wonder', name: '海水是咸的', desc: '游泳时耗尽体力。', key: 'drown', hidden: true, reward: 5 },
  { id: 'rail', cat: 'wonder', name: '轨道漫步', desc: '走上虹湾环线的高架轨道。列车来了记得让一让。', key: 'railWalk', hidden: true, reward: 10 },
  { id: 'peak', cat: 'wonder', name: '一城尽收', desc: '登上绿塔之巅。', key: 'peak', reward: 5 },
  { id: 'tablets', cat: 'wonder', name: '拓碑人', desc: '读完海湾里所有织光者石碑。', key: 'tablets', goal: 4, reward: 10 },
  // 织光谜题
  { id: 'flowers', cat: 'puzzle', name: '四隅之花', desc: '摘下四朵呈方阵生长的虹铃花。', key: 'pz_flowers', hidden: true, reward: 10 },
  { id: 'magic', cat: 'puzzle', name: '九数归一', desc: '让九座数碑的横、竖、斜之和全部相等。', key: 'pz_magic', reward: 10 },
  { id: 'tiles', cat: 'puzzle', name: '满盘皆亮', desc: '点亮光砖阵中的每一块光砖。', key: 'pz_tiles', reward: 10 },
  { id: 'lamps', cat: 'puzzle', name: '虹之序', desc: '按彩虹的顺序点亮七盏光灯。', key: 'pz_lamps', reward: 10 },
  { id: 'statues', cat: 'puzzle', name: '众像归心', desc: '让四尊织光者石像同时面向彩虹。', key: 'pz_statues', reward: 10 },
  { id: 'motes', cat: 'puzzle', name: '追光者', desc: '在时限内收集海崖站的全部流光。', key: 'pz_motes', reward: 10 },
  { id: 'sprite', cat: 'puzzle', name: '引路的光', desc: '跟随光灵回到它的光龛。', key: 'pz_sprite', reward: 10 },
  { id: 'pz3', cat: 'puzzle', name: '解谜学徒', desc: '解开 3 个织光谜题。', key: 'puzzles', goal: 3, reward: 10 },
  { id: 'pz7', cat: 'puzzle', name: '织光学者', desc: '解开 7 个织光谜题。', key: 'puzzles', goal: 7, reward: 20 },
  { id: 'seal', cat: 'puzzle', name: '镜中之字', desc: '解开东方高地上的七符封印。', key: 'pz_seal', hidden: true, reward: 30 },
  { id: 'pz8', cat: 'puzzle', name: '织光传人', desc: '解开全部 8 个织光谜题。', key: 'puzzles', goal: 8, reward: 30 },
  { id: 'lock', cat: 'puzzle', name: '熔开琥珀', desc: '用「聚光」光束打开琥珀光锁。', key: 'lightlock', reward: 5 },
  { id: 'mirage', cat: 'puzzle', name: '蜃楼散去', desc: '用光照亮蜃雾，找到藏在里面的宝箱。', key: 'mirage', reward: 5 },
  { id: 'bridge', cat: 'puzzle', name: '虹桥', desc: '让光箭穿过瀑布，架起一座彩虹桥。', key: 'bridge', reward: 10 },
  // 行路千里
  { id: 'chest10', cat: 'travel', name: '开箱人', desc: '打开 10 个宝箱。', key: 'chests', goal: 10, reward: 5 },
  { id: 'chest25', cat: 'travel', name: '寻宝人', desc: '打开 25 个宝箱。', key: 'chests', goal: 25, reward: 10 },
  { id: 'lux', cat: 'travel', name: '华丽的发现', desc: '打开一个华丽的宝箱。', key: 'chestLux', reward: 10 },
  { id: 'crystal4', cat: 'travel', name: '拾晶', desc: '收集 4 枚虹晶。', key: 'crystals', goal: 4, reward: 5 },
  { id: 'crystal12', cat: 'travel', name: '虹晶收藏家', desc: '收集海湾全部 12 枚虹晶。', key: 'crystals', goal: 12, reward: 20 },
  { id: 'offer', cat: 'travel', name: '借来的光，还给你', desc: '向虹之像献上虹晶。', key: 'offer', reward: 5 },
  // 刀光与弦
  { id: 'slime30', cat: 'combat', name: '凝胶清扫队', desc: '击败 30 只史莱姆。', key: 'slimes', goal: 30, reward: 10 },
  { id: 'warden', cat: 'combat', name: '礁岩倒下了', desc: '击败一名礁岩守卫。', key: 'wardens', reward: 10 },
  { id: 'reveal', cat: 'combat', name: '无处遁形', desc: '击败一名处于「显影」状态的敌人。', key: 'revealKill', reward: 5 },
  { id: 'reflect', cat: 'combat', name: '镜中一箭', desc: '用「折返」的光箭命中敌人。', key: 'reflectHit', reward: 5 },
  { id: 'focus', cat: 'combat', name: '一束光', desc: '射出第一道「聚光」光束。', key: 'focus', reward: 5 },
  // 回廊行者
  { id: 'dom1', cat: 'domain', name: '初入回廊', desc: '完成一次回廊挑战。', key: 'domains', reward: 5 },
  { id: 'dom10', cat: 'domain', name: '回廊常客', desc: '完成 10 次回廊挑战。', key: 'domains', goal: 10, reward: 20 },
  { id: 'art5', cat: 'domain', name: '满身遗珍', desc: '为一名角色装备 5 件遗珍。', key: 'art5', reward: 10 },
  // 拾光记
  { id: 'pull1', cat: 'gacha', name: '第一只漂流瓶', desc: '进行一次拾光。', key: 'pulls', reward: 5 },
  { id: 'pull10', cat: 'gacha', name: '潮水十次', desc: '一次投出十只漂流瓶。', key: 'pull10', reward: 5 },
  { id: 'gold', cat: 'gacha', name: '金色的回应', desc: '在拾光中获得五星。', key: 'gold', reward: 10 },
  // 彩虹往事
  { id: 'prologue', cat: 'story', name: '彩虹下的来客', desc: '完成序章。', key: 'prologue', reward: 20 },
];

export class Achievements {
  constructor(save, onUnlock) {
    save.ach = save.ach || {};
    this.s = save.ach; this.s.prog = this.s.prog || {}; this.s.done = this.s.done || {}; this.s.claimed = this.s.claimed || {}; this.s.sets = this.s.sets || {};
    this.onUnlock = onUnlock;
    this.byKey = {};
    for (const a of ACH) (this.byKey[a.key] = this.byKey[a.key] || []).push(a);
  }
  prog(key) { return this.s.prog[key] || 0; }
  bump(key, n = 1) { this.s.prog[key] = this.prog(key) + n; this.check(key); }
  max(key, v) { if (v > this.prog(key)) { this.s.prog[key] = v; this.check(key); } }
  // distinct ids (tablets read, puzzles solved) count once
  add(key, id) { const set = this.s.sets[key] = this.s.sets[key] || []; if (set.includes(id)) return false; set.push(id); this.s.prog[key] = set.length; this.check(key); return true; }
  check(key) {
    for (const a of this.byKey[key] || []) if (!this.s.done[a.id] && this.prog(key) >= (a.goal || 1)) { this.s.done[a.id] = Date.now(); this.onUnlock(a); }
  }
  isDone(id) { return !!this.s.done[id]; }
  claim(id) { const a = ACH.find((x) => x.id === id); if (!a || !this.s.done[id] || this.s.claimed[id]) return 0; this.s.claimed[id] = true; return a.reward; }
  claimable() { return ACH.filter((a) => this.s.done[a.id] && !this.s.claimed[a.id]); }
  stats(cat) { const list = ACH.filter((a) => !cat || a.cat === cat); return [list.filter((a) => this.s.done[a.id]).length, list.length]; }
}

export const ACH_ICON = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 L29.5 9.5 L38 8.5 L37.6 17 L44 23 L37.6 29 L38 37.5 L29.5 36.5 L24 43 L18.5 36.5 L10 37.5 L10.4 29 L4 23 L10.4 17 L10 8.5 L18.5 9.5 Z" fill="#f5d78a" stroke="#fff6dc" stroke-width="1.5"/><circle cx="24" cy="23" r="9" fill="#c99a3a"/><path d="M19.5 23 L23 26.5 L29 19.5" fill="none" stroke="#fff6dc" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
