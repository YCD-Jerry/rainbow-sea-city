import { ITEMS, TABS, RARITY_BG, SUB_NAMES, iconSVG } from './items.js';
import { SLOTS, SLOT_NAME, SETS, STAT_NAMES, fmtStat, mainValue, MAX_LV, upgradeCost, salvageValue, artifactSVG } from './artifacts.js';

// portraits are rendered from the 3D models at load time; until then a simple badge stands in
const PORTRAITS = {};
export function setPortraits(map) { Object.assign(PORTRAITS, map); }
export function portrait(id, kind = 'bust') { return PORTRAITS[id] ? PORTRAITS[id][kind] : null; }
export function avatarSVG(def, size = 64) {
  const src = PORTRAITS[def.id] && PORTRAITS[def.id].bust;
  if (src) return `<img src="${src}" width="${size}" height="${size}" alt="" draggable="false" style="display:block;width:100%;height:100%;object-fit:cover;background:radial-gradient(circle at 50% 35%, #ffffff, ${def.elColor})">`;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="${def.elColor}"/><text x="32" y="42" text-anchor="middle" font-size="28" fill="#fff" font-weight="700">${def.name}</text></svg>`;
}
// artifact detail card (bag + domain rewards share it)
export function artDetailHTML(a, p, up = null) {
  const [c0, c1] = RARITY_BG[a.rarity], S = SETS[a.set];
  const owner = a.owner ? p.member(a.owner) : null;
  const cnt = owner ? owner.art.sets[a.set] || 0 : 0;
  const subs = a.subs.map(([k, v]) => `<li class="${k === up ? 'up' : ''}">${STAT_NAMES[k]}+${fmtStat(k, v)}</li>`).join('');
  return `<div class="bd-head" style="background:linear-gradient(135deg, ${c0}, ${c1})"><div class="bd-ht"><h3>${S.pieces[a.slot]}</h3><p>${SLOT_NAME[a.slot]}</p>
      <p class="bd-main"><span>${STAT_NAMES[a.main]}</span><b>${fmtStat(a.main, mainValue(a))}</b></p><span class="bd-st">${stars(a.rarity)}</span></div><div class="bd-icon">${artifactSVG(a)}</div></div>
    <div class="bd-body"><p class="bd-lvl"><b>+${a.level}</b><span>上限 +${MAX_LV[a.rarity]}</span></p>
      <ul class="bd-subs">${subs}</ul>
      <div class="bd-set"><b>${S.name}：</b><p class="${cnt >= 2 ? 'on' : ''}">2件：${S.two}</p><p class="${cnt >= 4 ? 'on' : ''}">4件：${S.four}</p></div>
      <p class="bd-desc">${S.desc}</p>
      ${owner ? `<p class="bd-have">${owner.def.name} 已装备</p>` : ''}</div>`;
}
const SKILL_ICONS = {
  sword: [
    '<svg viewBox="0 0 64 64"><path d="M10 40 C18 22 34 16 52 20 C40 24 32 32 30 44 C26 38 18 36 10 40 Z" fill="#dff6ff"/><path d="M14 50 C26 40 40 38 54 42" stroke="#9fe6ff" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
    '<svg viewBox="0 0 64 64"><path d="M8 44 A24 24 0 0 1 56 44" stroke="#ff9ad5" stroke-width="4" fill="none"/><path d="M14 44 A18 18 0 0 1 50 44" stroke="#ffe27a" stroke-width="4" fill="none"/><path d="M20 44 A12 12 0 0 1 44 44" stroke="#7fe0ff" stroke-width="4" fill="none"/><path d="M6 50 C16 44 24 56 32 50 C40 44 48 56 58 50" stroke="#ffffff" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>',
  ],
  bow: [
    '<svg viewBox="0 0 64 64"><circle cx="40" cy="24" r="10" fill="#ffe27a"/><path d="M40 8 V14 M40 34 V40 M24 24 H30 M50 24 H56" stroke="#fff4c4" stroke-width="3" stroke-linecap="round"/><path d="M10 54 L36 28" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><path d="M36 28 L28 30 L34 36 Z" fill="#ffffff"/></svg>',
    '<svg viewBox="0 0 64 64"><circle cx="32" cy="16" r="10" fill="#ffe27a"/>' + [14, 24, 34, 44, 54].map((x, i) => `<path d="M${x} ${28 + (i % 2) * 6} L${x - 3} ${50 + (i % 2) * 6}" stroke="#fff4c4" stroke-width="3" stroke-linecap="round"/>`).join('') + '</svg>',
  ],
};

const $ = (id) => document.getElementById(id);
const stars = (n) => '★'.repeat(n);
const pct = (v) => (v * 100).toFixed(1) + '%';

export class UI {
  constructor({ inv, player, onUse, onEquip, onPick, onRespawn, onBagToggle, isTouch }) {
    Object.assign(this, { inv, player, onUse, onEquip, onPick, onRespawn, onBagToggle, isTouch });
    this.tab = 'food'; this.sel = null; this.bagOpen = false;
    this.pickList = []; this.pickSel = 0; this.pickKey = '';
    this.hpShown = 1; this.lastHud = {};
    // tabs
    const nav = $('bag-tabs');
    nav.innerHTML = TABS.map((t) => `<button type="button" class="btab" data-tab="${t.id}" aria-label="${t.name}" title="${t.name}">${iconSVG(t)}<span>${t.name}</span></button>`).join('');
    nav.addEventListener('click', (e) => { const b = e.target.closest('.btab'); if (b) { this.tab = b.dataset.tab; this.sel = null; this.renderBag(); } });
    $('bag-grid').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) { this.sel = c.dataset.key; this.inv.fresh.delete(this.sel); this.renderBag(); } });
    $('bag-close').addEventListener('click', () => this.closeBag());
    $('bag-act').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const ent = this.currentEntry(); if (!ent) return;
      if (b.dataset.act === 'use') this.onUse(ent.id);
      if (b.dataset.act === 'equip') this.onEquip(ent.uid, b.dataset.who);
      if (b.dataset.act.startsWith('art-') && this.onArt) { this.onArt(b.dataset.act.slice(4), ent.uid, b.dataset.who); return; }
      this.renderBag();
    });
    $('pickups').addEventListener('click', (e) => { const r = e.target.closest('.pk'); if (r) this.onPick(+r.dataset.i); });
    $('respawn').addEventListener('click', () => this.onRespawn());
    this.buildParty();
    $('party').addEventListener('click', (e) => { const b = e.target.closest('.pm'); if (b && this.onSwitch) this.onSwitch(+b.dataset.i); });
    this.charSel = 'lan';
    $('ch-list').addEventListener('click', (e) => { const b = e.target.closest('.chc'); if (b) { this.charSel = b.dataset.id; this.renderChars(); } });
    $('ch-detail').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act, i = this.player.party.findIndex((m) => m.def.id === this.charSel);
      if (act === 'field' && this.onSwitch && i >= 0) { this.onSwitch(i); this.renderChars(); }
      if (act === 'arts' && this.onOpenArts) this.onOpenArts();
      if ((act === 'join' || act === 'leave') && this.onPartyToggle) this.onPartyToggle(this.charSel);
    });
    $('bag-coinicon').innerHTML = iconSVG(ITEMS.coin);
  }

  buildParty() {
    const p = this.player;
    $('party').innerHTML = p.party.map((m, i) => `<button type="button" class="pm" data-i="${i}" style="--el:${m.def.elColor}" aria-label="切换到${m.def.name}">
      <span class="pm-txt"><b>${m.def.name}</b><i class="pm-hp"><em></em></i></span><span class="pm-ptr" aria-hidden="true"></span><span class="pm-av">${avatarSVG(m.def, 46)}</span><span class="pm-k">${i + 1}</span></button>`).join('');
    this.partyRows = [...document.querySelectorAll('#party .pm')];
    this.lastHud.ci = -1;
  }

  // ---------- HUD ----------
  hud(p, project) {
    const S = p.stats();
    const hpF = p.hp / p.maxHp;
    this.hpShown += (hpF - this.hpShown) * 0.08;
    if (Math.abs(this.hpShown - hpF) < 0.002) this.hpShown = hpF;
    $('hpfill').style.transform = `scaleX(${hpF})`;
    $('hpdelay').style.transform = `scaleX(${Math.max(hpF, this.hpShown)})`;
    $('hpbar').classList.toggle('low', hpF < 0.3);
    const ht = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    if (this.lastHud.ht !== ht) { $('hptext').textContent = ht; this.lastHud.ht = ht; }
    // stamina wheel next to the character
    const st = $('stam');
    const sf = p.hover ? Math.max(0, p.hover.pts) / 100 : p.stam / p.maxStam;
    const showStam = !!p.hover || sf < 0.999 || p.mode === 'climb' || p.mode === 'glide' || p.mode === 'swim';
    if (showStam && !p.dead) {
      const s = project(p.pos.clone().setY(p.pos.y + 1.4));
      if (s) {
        st.hidden = false;
        st.style.transform = `translate(${(s[0] + 46).toFixed(0)}px, ${(s[1] - 30).toFixed(0)}px)`;
        const C = 2 * Math.PI * 15;
        $('stamarc').style.strokeDashoffset = (C * (1 - sf)).toFixed(1);
        st.dataset.state = p.exhausted ? 'out' : sf < 0.25 ? 'low' : 'ok';
      } else st.hidden = true;
    } else st.hidden = true;
    // skills
    const eCD = p.skillCD, qCD = p.burstCD;
    const ek = eCD > 0 ? eCD.toFixed(1) : '';
    if (this.lastHud.ek !== ek) { $('sk-e-cd').textContent = ek; $('sk-e').classList.toggle('cd', eCD > 0); this.lastHud.ek = ek; }
    $('sk-e').style.setProperty('--cd', (eCD / (p.c.def.skillCD || (p.kit === 'bow' ? 9 : 8)) * 360).toFixed(0) + 'deg');
    const en = Math.min(1, p.energy / p.energyMax);
    const enk = en.toFixed(3);
    if (this.lastHud.en !== enk) { $('sk-q').style.setProperty('--enf', enk); this.lastHud.en = enk; }
    const ready = en >= 1 && qCD <= 0;
    $('sk-q').classList.toggle('ready', ready);
    const qk = qCD > 0 ? qCD.toFixed(1) : '';
    if (this.lastHud.qk !== qk) { $('sk-q-cd').textContent = qk; this.lastHud.qk = qk; }
    // party
    p.party.forEach((m, i) => {
      const row = this.partyRows[i]; if (!row) return;
      row.classList.toggle('on', i === p.ci); row.classList.toggle('dead', m.dead);
      row.querySelector('.pm-hp em').style.transform = `scaleX(${m.hp / m.maxHp})`;
      row.classList.toggle('qready', i !== p.ci && m.energy >= m.energyMax && m.burstCD <= 0);
    });
    if (this.lastHud.ci !== p.ci) {
      this.lastHud.ci = p.ci;
      const ic = SKILL_ICONS[p.kit];
      $('sk-e').querySelector('svg').outerHTML = ic[0];
      $('sk-q').querySelector('svg').outerHTML = ic[1];
      $('hpname').textContent = 'Lv. 20';
      $('sk-q').style.setProperty('--el', p.c.def.elColor);
      $('sk-e').style.setProperty('--el', p.c.def.elColor);
      $('sk-e').setAttribute('aria-label', '技能 ' + p.c.def.skills[1][0].split('·')[1].trim());
      $('sk-q').setAttribute('aria-label', '绝技 ' + p.c.def.skills[2][0].split('·')[1].trim());
      $('tatk').textContent = p.kit === 'bow' ? '射击' : '攻击';
    }
    const ch = $('crosshair');
    if (p.aiming) {
      ch.hidden = false;
      const k = Math.min(1, p.aimT / 1.0);
      ch.style.setProperty('--k', (k * 360).toFixed(0) + 'deg');
      ch.classList.toggle('full', k >= 1);
    } else if (!ch.hidden) ch.hidden = true;
    // buffs
    const chips = [];
    if (p.infuse > 0) chips.push(['虹潮 · 普攻 +20%', p.infuse]);
    if (p.buffs.atk && p.buffs.atk.until > p.time) chips.push(['攻击力 +15%', p.buffs.atk.until - p.time]);
    if (p.buffs.stam && p.buffs.stam.until > p.time) chips.push(['体力消耗 −25%', p.buffs.stam.until - p.time]);
    if (p.regen) chips.push(['持续恢复', p.regen.left]);
    const bk = chips.map((c) => c[0] + Math.ceil(c[1])).join('|');
    if (this.lastHud.bk !== bk) {
      this.lastHud.bk = bk;
      $('buffs').innerHTML = chips.map(([n, s]) => `<span>${n}<em>${Math.ceil(s)}s</em></span>`).join('');
    }
    return S;
  }

  setPickups(list) {
    const key = list.map((x) => x.name + (x.count || '')).join('|');
    if (this.pickSel >= list.length) this.pickSel = 0;
    this.pickList = list;
    const fullKey = key + '#' + this.pickSel;
    if (fullKey === this.pickKey) return;
    this.pickKey = fullKey;
    const el = $('pickups');
    if (!list.length) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = list.slice(0, 5).map((x, i) => {
      const ic = x.item ? iconSVG(x.item) : `<svg viewBox="0 0 64 64"><rect x="10" y="22" width="44" height="30" rx="4" fill="#c9974f"/><path d="M10 26 Q32 6 54 26" fill="#a87a3c"/><rect x="28" y="30" width="8" height="10" rx="2" fill="#f3d27a"/></svg>`;
      const sel = i === this.pickSel;
      return `<button type="button" class="pk${sel ? ' sel' : ''}" data-i="${i}"><kbd class="${sel ? '' : 'ghost'}">F</kbd><span class="pk-pill"><span class="pk-ic">${ic}</span><span class="pk-n">${x.name}</span>${x.count > 1 ? `<em>×${x.count}</em>` : ''}</span></button>`;
    }).join('');
  }
  cyclePick(d) { if (this.pickList.length > 1) { this.pickSel = (this.pickSel + d + this.pickList.length) % this.pickList.length; this.pickKey = ''; this.setPickups(this.pickList); return true; } return false; }

  feed(id, n) {
    const it = ITEMS[id]; if (!it) return;
    const el = document.createElement('div');
    el.className = 'feed r' + it.rarity;
    el.innerHTML = `<span class="f-ic">${iconSVG(it)}</span><span>${it.name}</span><em>×${n}</em>`;
    const box = $('feed');
    box.appendChild(el);
    while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3200);
  }

  showDeath(on) { $('death').hidden = !on; }

  // ---------- characters ----------
  renderChars() {
    const p = this.player, inv = this.inv;
    const owned = this.getOwned ? this.getOwned() : p.party.map((m) => m.def.id);
    if (!owned.includes(this.charSel)) this.charSel = p.c.def.id;
    const slot = (id) => p.party.findIndex((m) => m.def.id === id);
    $('ch-list').innerHTML = owned.map((id) => {
      const m = p.member(id), k = slot(id);
      return `<button type="button" class="chc${id === this.charSel ? ' sel' : ''}${m.dead ? ' dead' : ''} r${m.def.rarity}" data-id="${id}">
      <span class="chc-av">${avatarSVG(m.def, 64)}</span><span><b>${m.def.name}</b><em>${'★'.repeat(m.def.rarity)} · ${m.def.role}</em><i style="--c:${m.def.elColor}">${m.def.element}</i>${k >= 0 ? `<small>队伍 ${k + 1}${k === p.ci ? ' · 出战中' : ''}</small>` : ''}</span></button>`;
    }).join('');
    if (this.onModels) this.onModels();
    const m = p.member(this.charSel), d = m.def, S = p.statsFor(m), w = m.weapon;
    const [sk, sv] = w.sub;
    const k = slot(d.id);
    const btns = [];
    if (k >= 0 && k !== p.ci) btns.push(`<button type="button" class="bd-btn" data-act="field"${m.dead ? ' disabled' : ''}><i></i>切换出战</button>`);
    if (k < 0) btns.push(`<button type="button" class="bd-btn" data-act="join"${p.party.length >= 4 ? ' disabled' : ''}><i></i>${p.party.length >= 4 ? '队伍已满（4 人）' : '加入队伍'}</button>`);
    else if (p.party.length > 1) btns.push(`<button type="button" class="bd-btn" data-act="leave"><i class="x"></i>移出队伍</button>`);
    const cons = m.cons ? ` · 潮痕 ${m.cons}` : '';
    $('ch-detail').innerHTML = `
      <div class="chd-head" style="--c:${d.elColor}"><div class="chd-av">${avatarSVG(d, 120)}</div><div><h3>${d.name}<span>${d.title}</span></h3><p><i style="--c:${d.elColor}">${d.element}</i> ${'★'.repeat(d.rarity)} · 等级 20 / 20${cons} ${m.dead ? '· <b class="down">已倒下</b>' : ''}</p><p class="chd-role">${d.role}</p></div></div>
      <dl class="chd-stats">
        <div><dt>生命值上限</dt><dd>${m.maxHp}</dd></div><div><dt>当前生命值</dt><dd>${Math.ceil(m.hp)}</dd></div>
        <div><dt>攻击力</dt><dd>${S.atk}</dd></div><div><dt>暴击率</dt><dd>${pct(S.critRate)}</dd></div>
        <div><dt>暴击伤害</dt><dd>${pct(S.critDmg)}</dd></div><div><dt>绝技能量</dt><dd>${Math.floor(m.energy)} / ${m.energyMax}</dd></div>
        <div><dt>充能效率</dt><dd>${pct(1 + S.er)}</dd></div><div><dt>属性伤害加成</dt><dd>${pct(S.elemBonus + (d.elKey === 'water' ? S.hydroBonus : 0))}</dd></div>
      </dl>
      <div class="chd-weapon"><span class="chd-wi">${iconSVG(w)}</span><div><b>${w.name}</b><em>${'★'.repeat(w.rarity)} · 基础攻击力 ${w.atk} · ${SUB_NAMES[sk]} ${pct(sv)}</em><p>${w.passive}</p></div></div>
      ${artBlock(m)}
      <div class="chd-skills">${d.skills.map(([n, t]) => `<div><b>${n}</b><p>${t}</p></div>`).join('')}</div>
      <div class="chd-prism"><b>光路</b><p>弓手射出的箭都是光。光穿过「潮帘」散成七色追踪箭，穿过「聚晶」汇成贯穿光束，打在「海镜」上折返追击，照进「蜃雾」会让雾中的敌人显影。光束还能继续穿过下一种光媒。</p></div>
      ${btns.length ? `<div class="chd-actions">${btns.join('')}</div>` : ''}`;
    function artBlock(m) {
      const arts = SLOTS.map((sl) => { const a = inv.equippedArts(m.def.id).find((x) => x.slot === sl.id); return a ? `<span class="chd-art" style="background:linear-gradient(160deg, ${RARITY_BG[a.rarity][0]}, ${RARITY_BG[a.rarity][1]})" title="${SETS[a.set].pieces[a.slot]} +${a.level}">${artifactSVG(a)}<em>+${a.level}</em></span>` : `<span class="chd-art empty" title="${sl.name}">${sl.name.slice(0, 1)}</span>`; }).join('');
      const sets = Object.entries(m.art.sets).filter(([, n]) => n >= 2).map(([id, n]) => `<p><b>${SETS[id].name}</b> 2件：${SETS[id].two}${n >= 4 ? `<br>4件：${SETS[id].four}` : ''}</p>`).join('');
      return `<div class="chd-arts"><div class="chd-arthead"><b>遗珍</b><button type="button" class="bd-btn sub" data-act="arts">更换</button></div><div class="chd-artrow">${arts}</div>${sets || '<p class="chd-noset">同一套装装备 2 件、4 件时会激活套装效果。</p>'}</div>`;
    }
  }

  // ---------- bag ----------
  openBag() { this.bagOpen = true; $('bag').hidden = false; this.renderBag(); this.onBagToggle(true); }
  closeBag() { if (!this.bagOpen) return; this.bagOpen = false; $('bag').hidden = true; this.onBagToggle(false); }
  toggleBag() { this.bagOpen ? this.closeBag() : this.openBag(); }
  currentEntry() {
    const list = this.inv.entries(this.tab);
    return list.find((e) => e.key === this.sel) || list[0] || null;
  }
  renderBag() {
    if (!this.bagOpen) return;
    const inv = this.inv, p = this.player;
    document.querySelectorAll('.btab').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    const tabInfo = TABS.find((t) => t.id === this.tab);
    $('bag-tabname').textContent = tabInfo.name;
    $('bag-coin').innerHTML = `${inv.count('coin').toLocaleString('zh-CN')}<button type="button" class="plus" data-edit="coin" aria-label="修改虹贝">+</button>`;
    const list = inv.entries(this.tab);
    const cur = this.currentEntry();
    if (cur) this.sel = cur.key;
    $('bag-grid').innerHTML = list.map((e) => {
      const [a, b] = RARITY_BG[e.item.rarity];
      const wOwner = this.tab === 'weapon' && e.owner ? p.member(e.owner) : null;
      const eq = false;
      const owner = e.art && e.art.owner ? p.party.find((m) => m.def.id === e.art.owner) : null;
      const tag = eq ? '<i class="c-eq">已装备</i>' : (owner || wOwner) ? `<i class="c-eq c-who">${(owner || wOwner).def.name}</i>` : '';
      const lv = e.art ? `<i class="c-lv">+${e.art.level}</i>` : '';
      return `<button type="button" class="card${e.key === this.sel ? ' sel' : ''}" data-key="${e.key}" aria-label="${e.item.name}">
        <span class="c-art" style="background:linear-gradient(160deg, ${a}, ${b})">${iconSVG(e.item)}${tag}${lv}${inv.fresh.has(e.key) ? '<i class="c-new"></i>' : ''}<span class="c-st">${stars(e.item.rarity)}</span></span>
        <span class="c-n">${this.tab === 'weapon' ? 'Lv.20' : e.art ? SLOT_NAME[e.art.slot] : e.count}</span></button>`;
    }).join('');
    $('bag-empty').hidden = list.length > 0;
    $('bag-empty').textContent = this.tab === 'artifact' ? '还没有遗珍。完成「沉虹回廊」的挑战即可获得。' : '这一页还是空的。打倒魔物、开宝箱或采集都能获得物品。';
    const cap = this.tab === 'weapon' || this.tab === 'artifact' ? 2000 : 9999;
    $('bag-cap').textContent = `${list.length} / ${cap}`;
    const S = p.stats();
    $('bag-stats').innerHTML = `<span>生命值 <b>${Math.ceil(p.hp)}/${p.maxHp}</b></span><span>攻击力 <b>${S.atk}</b></span><span>暴击率 <b>${pct(S.critRate)}</b></span><span>暴击伤害 <b>${pct(S.critDmg)}</b></span><span>体力上限 <b>${p.maxStam}</b></span>`;
    const d = $('bag-detail');
    $('bag-act').innerHTML = '';
    if (!cur) { d.innerHTML = `<div class="bd-none">${this.tab === 'artifact' ? '还没有遗珍。解锁海崖东边的「沉虹回廊」，挑战后领取虹光之花的奖励即可获得。' : '这一页还是空的。打倒魔物、开宝箱或采集都能获得物品。'}</div>`; return; }
    if (cur.art) { this.renderArtDetail(cur.art); return; }
    const it = cur.item;
    const [a, b] = RARITY_BG[it.rarity];
    let body = '';
    if (it.tab === 'weapon') {
      const [sk, sv] = it.sub;
      body += `<dl class="bd-stats"><div><dt>基础攻击力</dt><dd>${it.atk}</dd></div><div><dt>${SUB_NAMES[sk]}</dt><dd>${pct(sv)}</dd></div></dl>`;
      body += `<p class="bd-passive">${it.passive}</p>`;
    }
    if (it.effect) body += `<p class="bd-effect">${it.effect}</p>`;
    if (it.use) body += `<p class="bd-effect">${it.use}</p>`;
    body += `<p class="bd-desc">${it.desc}</p>`;
    if (it.tab !== 'weapon') body += `<p class="bd-have">持有数量 <b>${cur.count}</b><button type="button" class="plus" data-edit="${cur.id}" aria-label="修改数量">+</button></p>`;
    let actions = '';
    if (it.tab === 'food') actions = `<button type="button" data-act="use" class="bd-btn"><i></i>使用</button>`;
    if (it.tab === 'weapon') {
      const kit = it.type === '弓' ? 'bow' : 'sword';
      const owned = (this.getOwned ? this.getOwned() : []).map((id) => p.member(id)).filter((m) => m.def.kit === kit);
      actions = owned.map((m) => cur.owner === m.def.id
        ? `<button type="button" class="bd-btn sub" disabled><i></i>${m.def.name} 装备中</button>`
        : `<button type="button" data-act="equip" data-who="${m.def.id}" class="bd-btn sub"><i></i>装备给${m.def.name}</button>`).join('') || `<button type="button" class="bd-btn sub" disabled>没有能使用${it.type}的角色</button>`;
    }
    d.innerHTML = `<div class="bd-head" style="background:linear-gradient(135deg, ${a}, ${b})"><div class="bd-ht"><h3>${it.name}</h3><p>${it.type || TABS.find((t) => t.id === it.tab).name}</p><span class="bd-st">${stars(it.rarity)}</span></div><div class="bd-icon">${iconSVG(it)}</div></div>
      <div class="bd-body">${body}</div>`;
    $('bag-act').innerHTML = actions;
  }

  renderArtDetail(a) {
    const p = this.player, inv = this.inv;
    $('bag-detail').innerHTML = artDetailHTML(a, p, this.lastUpUid === a.uid ? this.lastUp : null);
    const who = p.party.map((m) => m);
    if (a.owner && !who.some((m) => m.def.id === a.owner)) who.push(p.member(a.owner));
    const btns = who.map((m) => a.owner === m.def.id
      ? `<button type="button" class="bd-btn sub" data-act="art-unequip"><i class="x"></i>从${m.def.name}卸下</button>`
      : `<button type="button" class="bd-btn sub" data-act="art-equip" data-who="${m.def.id}"><i></i>装备给${m.def.name}</button>`);
    if (a.level < MAX_LV[a.rarity]) { const c = upgradeCost(a), short = inv.count('coin') < c; btns.push(`<button type="button" class="bd-btn sub" data-act="art-up"><i></i>强化 +4 · <span class="${short ? 'lack' : ''}">${c.toLocaleString('zh-CN')}</span> 虹贝</button>`); }
    btns.push(`<button type="button" class="bd-btn sub ghost" data-act="art-salvage">分解 · ${salvageValue(a)} 虹贝</button>`);
    $('bag-act').innerHTML = btns.join('');
  }
}
