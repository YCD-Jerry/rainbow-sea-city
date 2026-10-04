import * as THREE from 'three';
import { SKY_COLORS } from './sky.js';

// 昼夜 — game time in minutes since day 1, 00:00. One real second is one game minute (a day lasts 24 minutes).
// The sun rises in the east (+x), crosses the north (-z) at noon and sets in the west; the moon is opposite.
// Time only moves forward; skipTo() fast-forwards to any minute within the next 48 hours.

const C = (h) => new THREE.Color(h);
// keyframes by hour of day
const KEYS = [
  { h: 0, z: '#050a24', m: '#0c1a44', hz: '#1f3a6e', hy: '#2c4a7a', lc: '#a8c0ff', li: 0.42, hs: '#3a4a80', hg: '#1a1a28', hi: 0.42, env: 0.1, fog: '#18244a', exp: 0.95, night: 1, cloud: '#3a4870', mtn: '#2a3a66', day: 0.08 },
  { h: 4.4, z: '#050a24', m: '#0c1a44', hz: '#1f3a6e', hy: '#2c4a7a', lc: '#a8c0ff', li: 0.42, hs: '#3a4a80', hg: '#1a1a28', hi: 0.42, env: 0.1, fog: '#18244a', exp: 0.95, night: 1, cloud: '#3a4870', mtn: '#2a3a66', day: 0.08 },
  { h: 5.3, z: '#13235c', m: '#33428a', hz: '#b07a98', hy: '#d29a98', lc: '#c0b8ff', li: 0.45, hs: '#6070a8', hg: '#3a3040', hi: 0.5, env: 0.18, fog: '#6a6088', exp: 0.95, night: 0.55, cloud: '#9a8aa8', mtn: '#6a6a98', day: 0.3 },
  { h: 6.2, z: '#2a4fa8', m: '#6f86c8', hz: '#ffb98a', hy: '#ffd9b0', lc: '#ffb070', li: 1.15, hs: '#a8b8e0', hg: '#a08a70', hi: 0.72, env: 0.42, fog: '#e8c8b0', exp: 1.0, night: 0.12, cloud: '#ffd6c0', mtn: '#c8b8d0', day: 0.65 },
  { h: 7.6, z: '#1653d6', m: '#3b8ff0', hz: '#a9dcff', hy: '#e6f5ff', lc: '#fff4e2', li: 2.1, hs: '#d4ecff', hg: '#d8cfae', hi: 1.05, env: 0.7, fog: '#d3ebfc', exp: 1.0, night: 0, cloud: '#ffffff', mtn: '#ffffff', day: 1 },
  { h: 16.4, z: '#1653d6', m: '#3b8ff0', hz: '#a9dcff', hy: '#e6f5ff', lc: '#fff4e2', li: 2.1, hs: '#d4ecff', hg: '#d8cfae', hi: 1.05, env: 0.7, fog: '#d3ebfc', exp: 1.0, night: 0, cloud: '#ffffff', mtn: '#ffffff', day: 1 },
  { h: 17.8, z: '#2c3f96', m: '#8a6fb8', hz: '#ff9a6a', hy: '#ffc28a', lc: '#ff9850', li: 1.2, hs: '#b0a0d0', hg: '#a07a60', hi: 0.68, env: 0.4, fog: '#f0b890', exp: 1.0, night: 0.1, cloud: '#ffc0a0', mtn: '#d8a8b0', day: 0.62 },
  { h: 18.9, z: '#1a2462', m: '#4a3c86', hz: '#c86a7a', hy: '#d88a80', lc: '#c8a8ff', li: 0.5, hs: '#6a68a8', hg: '#3a2c38', hi: 0.48, env: 0.2, fog: '#6a4a70', exp: 0.97, night: 0.5, cloud: '#8a6a90', mtn: '#7a6a98', day: 0.3 },
  { h: 20.2, z: '#070e30', m: '#14205a', hz: '#2c3c7a', hy: '#3a4a86', lc: '#a8c0ff', li: 0.42, hs: '#3e4e88', hg: '#1c1c2c', hi: 0.42, env: 0.1, fog: '#1c2850', exp: 0.95, night: 0.92, cloud: '#3e4c78', mtn: '#2e3e6a', day: 0.1 },
  { h: 24, z: '#050a24', m: '#0c1a44', hz: '#1f3a6e', hy: '#2c4a7a', lc: '#a8c0ff', li: 0.42, hs: '#3a4a80', hg: '#1a1a28', hi: 0.42, env: 0.1, fog: '#18244a', exp: 0.95, night: 1, cloud: '#3a4870', mtn: '#2a3a66', day: 0.08 },
];
for (const k of KEYS) for (const f of ['z', 'm', 'hz', 'hy', 'lc', 'hs', 'hg', 'fog', 'cloud', 'mtn']) k[f] = C(k[f]);

export const MAX_SKIP = 48 * 60;
export const fmtTime = (t) => { const d = Math.floor(t / 1440) + 1, m = Math.floor(t % 1440), hh = Math.floor(m / 60), mm = m % 60; return { day: d, hh, mm, text: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` }; };

export class DayNight {
  constructor(o) {
    Object.assign(this, o);   // { scene, sky, sun, hemi, water, renderer, cumulus, mountains, sunDir, nightMats, save }
    this.time = typeof o.save.time === 'number' ? o.save.time : 8 * 60;  // a new journey starts at 08:00
    this.anim = null;
    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.moonDir = new THREE.Vector3();
    this.p = {};
    this._c = new THREE.Color();
    this.apply();
  }
  get hour() { return (this.time % 1440) / 60; }
  update(dt) {
    if (this.anim) {
      const a = this.anim; a.t += dt; const k = Math.min(1, a.t / a.dur), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.time = a.from + (a.to - a.from) * e;
      if (k >= 1) { this.time = a.to; const r = a.done; this.anim = null; if (r) r(); }
    } else this.time += dt;   // 1 game minute per real second
    this.save.time = this.time;
    this.apply();
  }
  // fast-forward to `to` (absolute minutes) — never backwards, at most 48 hours ahead
  skipTo(to, done) {
    to = Math.round(to);
    if (to <= this.time || to - this.time > MAX_SKIP + 0.5) return false;
    this.anim = { from: this.time, to, t: 0, dur: Math.min(4, 1.4 + (to - this.time) / MAX_SKIP * 2.6), done };
    return true;
  }
  sample(h) {
    let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1], k = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h)));
    return [a, b, k * k * (3 - 2 * k)];
  }
  apply() {
    const h = this.hour, [a, b, k] = this.sample(h), L = (f) => a[f] + (b[f] - a[f]) * k, LC = (f, out) => out.copy(a[f]).lerp(b[f], k);
    // sun & moon
    const th = Math.PI * (h - 6) / 12, el = THREE.MathUtils.degToRad(62) * Math.sin(Math.PI * 2 * (h - 6) / 24) + THREE.MathUtils.degToRad(4);
    this.sunDir.set(Math.cos(th) * Math.cos(el), Math.sin(el), -Math.sin(th) * Math.cos(el)).normalize();
    this.moonDir.copy(this.sunDir).negate(); this.moonDir.y = Math.max(this.moonDir.y, -0.2); this.moonDir.normalize();
    // the shading light follows whichever of the two is up, never grazing the horizon
    const src = this.sunDir.y > 0 ? this.sunDir : this.moonDir;
    // fade the key light out as the source nears the horizon so the hand-over sun -> moon never pops the shadows
    const up = Math.min(1, Math.max(0, src.y / 0.12)), lightK = 0.12 + 0.88 * up * up * (3 - 2 * up);
    this.lightDir.copy(src); this.lightDir.y = Math.max(this.lightDir.y, 0.32); this.lightDir.normalize();
    // sky colours (shared with the water's sky reflection)
    LC('z', SKY_COLORS.zenith); LC('m', SKY_COLORS.mid); LC('hz', SKY_COLORS.horizon); LC('hy', SKY_COLORS.haze);
    const night = L('night'), day = L('day');
    const su = this.sky.material.uniforms;
    su.uMoon.value.copy(this.moonDir); su.uNight.value = night; LC('cloud', su.uCloud.value);
    // lights
    LC('lc', this.sun.color); this.sun.intensity = L('li') * lightK;
    LC('hs', this.hemi.color); LC('hg', this.hemi.groundColor); this.hemi.intensity = L('hi');
    this.scene.environmentIntensity = L('env');
    LC('fog', this.scene.fog.color);
    this.renderer.toneMappingExposure = L('exp');
    if (this.water) this.water.material.uniforms.uDay.value = day;
    if (this.cumulus) { LC('cloud', this._c); for (const s of this.cumulus.children) if (s.material) s.material.color.copy(this._c); }
    if (this.mountains) LC('mtn', this.mountains.material.color);
    // the city lights up after dusk
    const glow = Math.max(0, Math.min(1, (night - 0.15) / 0.6));
    for (const m of this.nightMats || []) { m.emissiveIntensity = m.userData.nightI * glow; }
    for (const m of this.nightFx || []) { m.opacity = m.userData.nightO * glow; const v = glow > 0.01; if (m.userData.mesh) for (const o of m.userData.mesh) o.visible = v; }
    this.p = { night, day, glow };
  }
}
