// 主线 · 序章「彩虹下的来客」
// The rainbow over the bay is an ancient light machine; the new town borrows its light. Today it starts to fade.
// Lines: { s: speaker id | 'you' | 'radio' | null (narration), t: text, choice?: [a, b], then?: [[lines], [lines]] }

const VIOLET = 6, RED = 0;

export const SPEAKERS = { you: '你', radio: '广播', lan: '澜', yao: '曜', po: '珀', ting: '汀', ai: '霭' };

export const INTRO_CARDS = [
  '海湾上空的这道彩虹，三百年没有散过。',
  '城里的灯、列车和高塔，都在借它的光。',
  '没有人记得，是谁把它挂在了那里。',
  '直到今天——',
];

const WAKE = [
  { s: null, t: '你在海崖的木台上醒来。衣服还是湿的，嘴里有海水的咸味。' },
  { s: 'lan', t: '醒了？先别急着起来。我在礁石那边把你捞上来的——你抱着一只漂流瓶，怎么叫都不撒手。' },
  { s: 'you', choice: ['……这是哪里？', '瓶子呢？'], then: [
    [{ s: 'lan', t: '虹海之城，海崖观景台。看你的样子，不是本地人吧。' }],
    [{ s: 'lan', t: '碎了。里面什么都没有……只有一点光，一下子就散了。' }],
  ] },
  { s: 'yao', t: '澜！你刚才看到天上没有？' },
  { s: 'lan', t: '看到了。彩虹闪了一下。' },
  { s: 'yao', t: '不止闪了一下。你数数——最里面那道紫色，没了。灯塔的读数一直在往下掉。' },
  { s: 'yao', t: '三百年来，它从来没有这样过。' },
  { s: null, t: '你抬起头。彩虹最里侧的那一道，只剩一层灰白的影子。而你的视野边缘，有什么东西在发亮——是不远处的一块石碑。' },
  { s: 'yao', t: '你在看什么？那边只是一块旧石碑，研究所的人天天去拓印。' },
];

const TABLET = [
  { s: null, t: '你的手刚碰到石碑，眼前就浮现出一道道细细的光线——从晶石出发，一直延伸到不远处那只被琥珀封住的宝箱。' },
  { s: 'lan', t: '……你看得见？光走的路？' },
  { s: 'yao', t: '碑上是织光者的字。「光穿过晶石，会汇聚成一束」——研究所念了几十年，从没人真的做到过。' },
];
const TABLET_TRY = [
  { s: 'yao', t: '我的箭就是光。你说往哪儿射，我就往哪儿射。' },
  { s: null, t: '切换到曜，站到晶石的另一侧，按住攻击把箭拉满，让光箭穿过晶石射向宝箱。' },
];
const TABLET_ALREADY = [
  { s: 'yao', t: '等等，那只宝箱的琥珀……已经碎了？是你之前打开的？' },
  { s: 'lan', t: '看来你昏迷之前就来过这儿。' },
];
const LOCK = [
  { s: 'yao', t: '碎了！琥珀真的碎了！' },
  { s: 'lan', t: '珀要是知道这件事，今晚一定睡不着。她守着那些古迹好多年了。' },
];
const TO_SITE = [
  { s: 'yao', t: '灯塔说，彩虹的光是从「回廊」那边流出来的。要是哪里坏了，应该就在那里。' },
  { s: 'lan', t: '回廊遗址在大道东边，研究所把它围起来了。走吧，外乡人——你好像比我们都懂这些。' },
];
const SITE = [
  { s: 'radio', t: '「虹湾遗址研究所提示：第一回廊仍处于运转状态，非持证人员请勿越过围栏。」' },
  { s: 'lan', t: '……围栏都没锁。研究所的人呢？' },
  { s: 'yao', t: '彩虹出事，他们大概都去集光塔了。你看那些塔顶——平时一直有光往下流，今天断断续续的。' },
  { s: null, t: '你走近那道石门。门里本来暗着的光，随着你的脚步一点一点亮了起来。' },
  { s: 'yao', t: '门在回应你。' },
];
const UNLOCK = [
  { s: 'lan', t: '里面是古人修的光的通道。听说有东西在里面守着。' },
  { s: 'yao', t: '那就打进去。' },
];
const CLEAR = [
  { s: null, t: '最后一个敌人倒下时，回廊深处传来一声很轻的回响，像是有一根弦重新绷紧了。' },
  { s: 'yao', t: '灯塔的读数……在回升！快出去看看！' },
];
const OUT = [
  { s: 'lan', t: '紫色……回来了。' },
  { s: 'yao', t: '是你做到的。回廊里那些东西，是在替彩虹「修路」吧？' },
  { s: 'you', choice: ['我连自己是谁都不记得。', '还有别的回廊吗？'], then: [
    [{ s: 'lan', t: '没关系。会看光的人，在这座城里总有地方去。' }],
    [{ s: 'yao', t: '研究所的地图上标了七座。七种颜色，七座回廊……' }],
  ] },
  { s: null, t: '话音未落，彩虹最外侧的那道红，轻轻暗了一下。' },
  { s: 'yao', t: '等等——你们看最外面那道红……' },
];

export function createStory(api) {
  const S = () => api.save.story;
  let busy = false;
  const queue = [];
  const objective = (step) => {
    const st = S(); if (!st) return api.setObjective(null);
    const O = {
      1: { title: '序章 · 彩虹下的来客', text: '调查发光的石碑', target: () => api.pos.tablet },
      2: { title: '序章 · 彩虹下的来客', text: '用「聚光」打开琥珀光锁', hint: '切换到曜，隔着晶石蓄力射箭', target: () => api.pos.lock() },
      3: { title: '序章 · 彩虹下的来客', text: '前往回廊遗址', target: () => api.pos.front },
      4: { title: '序章 · 彩虹下的来客', text: '解锁沉虹回廊', target: () => api.pos.gate },
      5: { title: '序章 · 彩虹下的来客', text: '进入回廊，完成一次挑战', target: () => (api.inDomain() ? null : api.pos.gate) },
      6: { title: '序章 · 彩虹下的来客', text: '离开回廊，看看天空', target: () => null },
      7: { title: '第一章 · 赤色退潮', text: '制作中，敬请期待', target: () => null, done: true },
    }[step];
    api.setObjective(O || null);
  };
  const go = (step) => { S().step = step; objective(step); api.writeSave(); };
  const setBand = (i, v) => { S().bands[i] = v; api.setBands(S().bands); };

  async function run(fn) {
    busy = true;
    try { await fn(); } finally { busy = false; }
    if (queue.length) { const [ev, data] = queue.shift(); emit(ev, data); }
  }

  function emit(ev, data) {
    const st = S(); if (!st) return false;
    if (busy) { queue.push([ev, data]); return true; }
    if (ev === 'tablet' && st.step === 1 && data === 'lock') {
      api.tabletGlow(false);
      run(async () => {
        await api.dialog(TABLET);
        if (api.lockOpen()) { await api.dialog([...TABLET_ALREADY, ...TO_SITE]); go(3); }
        else { await api.dialog(TABLET_TRY); api.guide(true); go(2); }
      });
      return true;
    }
    if (ev === 'lightlock' && st.step <= 2) {
      api.tabletGlow(false);
      run(async () => { api.guide(false); await api.dialog([...LOCK, ...TO_SITE]); go(3); });
      return false;
    }
    if (ev === 'domainUnlocked' && st.step >= 3 && st.step <= 4) {
      run(async () => { if (st.step === 3) await api.dialog(SITE); await api.dialog(UNLOCK); go(5); });
      return false;
    }
    if (ev === 'domainClear' && st.step >= 3 && st.step <= 5) {
      run(async () => { setBand(VIOLET, 1); await api.dialog(CLEAR); go(6); });
      return false;
    }
    if (ev === 'leftDomain' && st.step === 6) {
      run(async () => {
        await api.wait(1.4);
        await api.lookAtRainbow();
        await api.dialog(OUT.slice(0, 3));
        api.setFlick(1);
        setBand(RED, 0.55);
        await api.dialog(OUT.slice(3));
        api.setFlick(0.25);
        await api.chapterCard('序章「彩虹下的来客」', '完', '第一章「赤色退潮」 制作中');
        api.endShot();
        st.done = true; go(7);
        if (api.onDone) api.onDone();
      });
      return false;
    }
    return false;
  }

  return {
    get busy() { return busy; },
    get step() { return S() ? S().step : 0; },
    emit,
    // called once the player presses 开始探索
    start() {
      const st = S();
      if (!st) {
        run(async () => {
          await api.intro(() => { api.setBands([1, 1, 1, 1, 1, 1, 0]); api.setFlick(0.6); });
          api.save.story = { step: 1, bands: [1, 1, 1, 1, 1, 1, 0] };
          api.setFlick(0.18);
          api.writeSave();
          await api.dialog(WAKE);
          api.tabletGlow(true);
          objective(1);
          if (api.onWake) api.onWake();
        });
        return;
      }
      api.setBands(st.bands);
      api.setFlick(st.step >= 7 ? 0.25 : st.bands[VIOLET] < 1 ? 0.18 : 0);
      if (st.step === 1) api.tabletGlow(true);
      if (st.step === 2) api.guide(true);
      objective(st.step);
      if (st.step === 6 && !api.inDomain()) emit('leftDomain');
    },
    // per frame: arrival checks
    update() {
      const st = S(); if (!st || busy) return;
      if (st.step === 2 && api.lockOpen()) emit('lightlock');
      if (st.step === 3 && !api.inDomain() && api.player().distanceTo(api.pos.gate) < 15) {
        run(async () => {
          await api.dialog(SITE);
          if (api.domainUnlocked()) { await api.dialog(UNLOCK); go(5); } else go(4);
        });
      }
      if (st.step === 4 && api.domainUnlocked()) emit('domainUnlocked');
    },
  };
}
