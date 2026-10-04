import * as THREE from 'three';

// 拾光: write a wish, put it in a bottle, and the tide answers.
// Rates follow the common "soft pity" model: 5★ 0.6% base, rising from the 74th pull, guaranteed by the 90th;
// a 4★ or better at least every 10 pulls; on the limited banner a lost 50/50 guarantees the featured 5★ next time.

export const BANNERS = [
  {
    id: 'silk', kind: 'limited', name: '牵丝引光', kicker: '限定拾光', feat5: 'silk', feat4: ['gale', 'ting', 'lan'],
    blurb: '「一根丝线，牵住所有逃不掉的目标。」限时提升五星角色「绫」的出现概率。',
    pool5: ['silk', 'feather', 'po', 'ai'], pool4: ['gale', 'ting', 'lan', 'yao', 'sword_tide', 'sword_coral', 'bow_dawn', 'bow_lake'],
    pool3: ['sword_breeze', 'sword_iron', 'bow_reed'], color: ['#5fd0ff', '#14305e'],
  },
  {
    id: 'feather', kind: 'limited', name: '御风而行', kicker: '限定拾光', feat5: 'feather', feat4: ['gale', 'yao', 'lan'],
    blurb: '「风托着我，天空就是我的路。」限时提升五星角色「翎」的出现概率。',
    pool5: ['feather', 'silk', 'po', 'ai'], pool4: ['gale', 'ting', 'lan', 'yao', 'sword_tide', 'sword_coral', 'bow_dawn', 'bow_lake'],
    pool3: ['sword_breeze', 'sword_iron', 'bow_reed'], color: ['#7fe6c8', '#12504a'],
  },
  {
    id: 'amber', kind: 'limited', name: '琥珀晶辉', kicker: '限定拾光', feat5: 'po', feat4: ['ting', 'lan'],
    blurb: '「光落进琥珀，就再也不会熄灭。」限时提升五星角色「珀」的出现概率。',
    pool5: ['po', 'ai', 'silk', 'feather'], pool4: ['ting', 'lan', 'yao', 'gale', 'sword_tide', 'sword_coral', 'bow_dawn', 'bow_lake'],
    pool3: ['sword_breeze', 'sword_iron', 'bow_reed'], color: ['#ffb347', '#7a3a10'],
  },
  {
    id: 'bay', kind: 'standard', name: '海湾拾光', kicker: '常驻拾光', feat5: 'ai', feat4: [],
    blurb: '常驻拾光。可能获得五星角色「霭」「绫」「翎」与五星武器「虹光之刃」「曜日长弓」。',
    pool5: ['ai', 'silk', 'feather', 'sword_rainbow', 'bow_sun'], pool4: ['ting', 'lan', 'yao', 'gale', 'sword_tide', 'sword_coral', 'bow_dawn', 'bow_lake'],
    pool3: ['sword_breeze', 'sword_iron', 'bow_reed'], color: ['#b9a6ff', '#2c2160'],
  },
];
export const PULL_COST = 160;

export function newGachaState() { return { pity: { limited: 0, standard: 0 }, pity4: { limited: 0, standard: 0 }, guar: false, guar4: false, history: [], total: 0 }; }

const pick = (a) => a[Math.floor(Math.random() * a.length)];
// one pull; mutates state, returns { id, rarity }
export function pullOnce(st, banner, isChar) {
  const k = banner.kind;
  st.pity[k] = (st.pity[k] || 0) + 1; st.pity4[k] = (st.pity4[k] || 0) + 1;
  const n5 = st.pity[k];
  const p5 = n5 >= 90 ? 1 : n5 >= 74 ? 0.006 + (n5 - 73) * 0.06 : 0.006;
  let rarity = 3;
  const r = Math.random();
  if (r < p5) rarity = 5;
  else if (st.pity4[k] >= 10 || r < p5 + 0.051) rarity = 4;
  let id;
  if (rarity === 5) {
    st.pity[k] = 0; st.pity4[k] = 0;
    if (k === 'limited') {
      if (st.guar || Math.random() < 0.5) { id = banner.feat5; st.guar = false; }
      else { id = pick(banner.pool5.filter((x) => x !== banner.feat5)); st.guar = true; }
    } else id = pick(banner.pool5);
  } else if (rarity === 4) {
    st.pity4[k] = 0;
    if (k === 'limited' && banner.feat4.length && (st.guar4 || Math.random() < 0.5)) { id = pick(banner.feat4); st.guar4 = false; }
    else { id = pick(banner.pool4); if (k === 'limited') st.guar4 = !banner.feat4.includes(id); }
  } else id = pick(banner.pool3);
  st.total++;
  st.history.unshift({ id, rarity, banner: banner.id, t: Date.now(), char: isChar(id) });
  if (st.history.length > 60) st.history.length = 60;
  return { id, rarity };
}

// ---------- the drift-bottle animation ----------
const RCOL = { 3: new THREE.Color('#7fc8ff'), 4: new THREE.Color('#c58cff'), 5: new THREE.Color('#ffd36a') };

function skyMat() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { uT: { value: 0 }, uGold: { value: 0 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; uniform float uGold; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){
        float y = vD.y;
        vec3 top = vec3(0.03, 0.05, 0.16), mid = vec3(0.16, 0.12, 0.36), hor = mix(vec3(0.55, 0.32, 0.45), vec3(0.95, 0.68, 0.38), uGold);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, y)); c = mix(c, top, smoothstep(0.18, 0.7, y));
        // stars
        vec3 q = floor(vD * 260.0); float s = step(0.9975, h(q)) * smoothstep(0.05, 0.3, y);
        c += vec3(s) * (0.6 + 0.4 * sin(uT * 3.0 + h(q + 1.0) * 30.0));
        // rainbow arc for a 5-star answer
        float ang = acos(clamp(dot(normalize(vD), normalize(vec3(0.0, -0.35, -1.0))), -1.0, 1.0));
        float band = (ang - 0.62) / 0.09;
        if (band > 0.0 && band < 1.0 && y > -0.02) {
          vec3 rb = clamp(abs(mod(band * 0.85 * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          c += rb * 0.55 * uGold * smoothstep(0.0, 0.2, band) * smoothstep(1.0, 0.8, band);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
function seaMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uPath: { value: new THREE.Color('#9fc8ff') }, uGlow: { value: 0 } },
    vertexShader: 'varying vec3 vW; uniform float uT; void main(){ vec3 p = position; p.z += sin(p.x * 0.15 + uT) * 0.15 + sin(p.y * 0.22 + uT * 1.3) * 0.12; vec4 w = modelMatrix * vec4(p,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uT; uniform vec3 uPath; uniform float uGlow; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
      void main(){
        float d = -vW.z;
        vec3 deep = vec3(0.02, 0.05, 0.14), near = vec3(0.05, 0.12, 0.25);
        vec3 c = mix(near, deep, smoothstep(5.0, 80.0, d));
        float w = n(vec2(vW.x * 0.6, vW.z * 1.6 + uT * 0.6)) * n(vec2(vW.x * 1.7 - uT * 0.3, vW.z * 3.1));
        float path = exp(-pow(vW.x / (1.5 + d * 0.12), 2.0));
        c += uPath * path * smoothstep(0.18, 0.45, w) * (0.6 + uGlow * 1.4);
        c += vec3(0.6, 0.7, 1.0) * smoothstep(0.42, 0.6, w) * 0.15;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
let glowTex = null;
function glow() {
  if (glowTex) return glowTex;
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  glowTex = new THREE.CanvasTexture(cv); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
function bottleGeo() {
  const pts = [[0, 0], [0.16, 0], [0.2, 0.04], [0.21, 0.3], [0.19, 0.38], [0.09, 0.46], [0.07, 0.56], [0.075, 0.6], [0, 0.6]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 20);
}

export class GachaScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(48, 1, 0.1, 400);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMat()); this.scene.add(this.sky);
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: '#fff6dc', transparent: true, depthWrite: false })); moon.position.set(0, 26, -160); moon.scale.setScalar(26); this.scene.add(moon);
    const moonCore = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshBasicMaterial({ color: '#fffaf0' })); moonCore.position.set(0, 26, -161); this.scene.add(moonCore);
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 220, 80, 40), seaMat()); this.sea.rotation.x = -Math.PI / 2; this.sea.position.z = -112; this.scene.add(this.sea);
    // moonlit beach: a gentle slope rising out of the water
    const sg = new THREE.PlaneGeometry(120, 14, 60, 14); sg.rotateX(-Math.PI / 2);
    const sp = sg.attributes.position; for (let i = 0; i < sp.count; i++) { const z = sp.getZ(i); sp.setY(i, Math.max(-0.3, (z + 7) * 0.06) + Math.sin(sp.getX(i) * 0.4) * 0.03); }
    sg.computeVertexNormals();
    const sand = new THREE.Mesh(sg, new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `varying vec3 vW; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){ vec3 c = mix(vec3(0.07, 0.07, 0.14), vec3(0.15, 0.13, 0.24), smoothstep(-6.0, 4.0, vW.z)); c += (h(floor(vW.xz * 40.0)) - 0.5) * 0.04; c += vec3(0.25, 0.3, 0.5) * smoothstep(-5.0, -6.6, vW.z) * 0.6; gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
        }`,
    }));
    sand.position.set(0, 0, 3); this.scene.add(sand);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(120, 0.5), new THREE.MeshBasicMaterial({ color: '#b8c8ff', transparent: true, opacity: 0.5, depthWrite: false })); foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.03, -3.6); this.scene.add(foam); this.foam = foam;
    // lighthouse on the left headland with a sweeping beam
    const lh = new THREE.Group(); lh.position.set(-26, 0, -48); this.scene.add(lh);
    lh.add(new THREE.Mesh(new THREE.CylinderGeometry(4, 9, 6, 16), new THREE.MeshBasicMaterial({ color: '#141628' })));
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 12, 12), new THREE.MeshBasicMaterial({ color: '#1e2238' })); tower.position.y = 9; lh.add(tower);
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: '#fff2c4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); lamp.position.y = 15.5; lamp.scale.setScalar(5); lh.add(lamp);
    const bgeo = new THREE.ConeGeometry(6, 70, 24, 1, true); bgeo.translate(0, -35, 0); bgeo.rotateX(-Math.PI / 2);
    this.beam = new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ color: '#fff2c4', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.beam.position.y = 15.5; lh.add(this.beam);
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3, 80, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.pillar.position.set(0, 40, -40); this.scene.add(this.pillar);
    this.bottles = []; this.t = 0; this.active = false;
    this.bgeo = bottleGeo();
  }
  play(results, onDone) {
    for (const b of this.bottles) this.scene.remove(b.g);
    this.bottles = [];
    this.results = results; this.onDone = onDone; this.t = 0; this.active = true; this.finished = false;
    const best = Math.max(...results.map((r) => r.rarity));
    this.best = best;
    const n = results.length;
    results.forEach((r, i) => {
      const g = new THREE.Group();
      const col = RCOL[r.rarity];
      const glass = new THREE.Mesh(this.bgeo, new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color('#ffffff'), 0.55), transparent: true, opacity: 0.55, depthWrite: false }));
      g.add(glass);
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.09, 10), new THREE.MeshBasicMaterial({ color: '#8a6a4a' })); cork.position.y = 0.63; g.add(cork);
      const note = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.24), new THREE.MeshBasicMaterial({ color: '#fff6dc', side: THREE.DoubleSide })); note.position.y = 0.2; note.rotation.z = 0.2; g.add(note);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })); halo.position.y = 0.25; halo.scale.setScalar(r.rarity === 5 ? 2.2 : 1.6); g.add(halo);
      const spread = n === 1 ? 0 : (i - (n - 1) / 2) * 0.95;
      const lane = { x0: spread * 6, x1: spread, z0: -70 - Math.random() * 10, z1: -3.6 + Math.abs(spread) * 0.1, delay: i * 0.08 + Math.random() * 0.1, ph: Math.random() * 6 };
      g.position.set(lane.x0, -1, lane.z0);
      g.rotation.z = 1.2;
      this.scene.add(g);
      this.bottles.push({ g, lane, halo, r });
    });
    this.sky.material.uniforms.uGold.value = 0;
    this.sea.material.uniforms.uPath.value.copy(RCOL[Math.min(best, 4) === 3 ? 3 : best]);
  }
  setSize(w, h) { this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  skip() { if (this.active && !this.finished) this.t = Math.max(this.t, 4.1); }
  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t, best = this.best;
    this.sky.material.uniforms.uT.value = t; this.sea.material.uniforms.uT.value = t;
    // lighthouse beam sweeps, then settles on the bottles' lane
    const settle = Math.min(1, t / 1.4);
    this.beam.rotation.y = (1 - settle) * Math.sin(t * 2.2) * 0.9 + settle * 0.42 - 0.2;
    this.beam.material.opacity = 0.1 + settle * 0.08;
    const gold = best === 5 ? Math.min(1, Math.max(0, (t - 1.2) / 1.0)) : 0;
    this.sky.material.uniforms.uGold.value = gold;
    this.pillar.material.opacity = best === 5 ? gold * 0.35 * (1 - Math.max(0, t - 3.5)) : best === 4 ? Math.min(0.18, Math.max(0, (t - 1.4) * 0.2)) : 0;
    this.pillar.material.color.set(best === 5 ? '#ffd36a' : '#c58cff');
    this.sea.material.uniforms.uGlow.value = Math.min(1, Math.max(0, t - 0.8));
    this.foam.material.opacity = 0.35 + Math.sin(t * 2) * 0.15;
    for (const b of this.bottles) {
      const L = b.lane, k = Math.min(1, Math.max(0, (t - 0.9 - L.delay) / 2.4)), e = 1 - (1 - k) ** 3;
      b.g.position.x = L.x0 + (L.x1 - L.x0) * e;
      b.g.position.z = L.z0 + (L.z1 - L.z0) * e;
      b.g.position.y = (k < 0.05 ? -1 + k * 20 : 0) + Math.sin(t * 2.4 + L.ph) * 0.08 * (1 - e * 0.5) + (k >= 1 ? Math.min(0.25, (t - 3.3 - L.delay) * 0.4) : 0);
      b.g.rotation.z = 1.2 * (1 - e) + Math.sin(t * 1.8 + L.ph) * 0.12 * (1 - e);
      b.g.rotation.y = t * 0.6 + L.ph;
      b.halo.material.opacity = 0.5 + 0.4 * Math.sin(t * 5 + L.ph) * 0.5 + (t > 3.6 ? Math.min(1, (t - 3.6) * 2) : 0);
      b.halo.scale.setScalar((b.r.rarity === 5 ? 2.2 : 1.6) * (1 + Math.max(0, t - 3.7) * 3));
    }
    // camera: wide → push in on the shore
    const c = Math.min(1, Math.max(0, (t - 2.6) / 1.4)), ce = c * c * (3 - 2 * c);
    this.cam.position.set(0, 2.2 - ce * 1.2, 6 - ce * 5.2);
    this.cam.lookAt(0, 1.2 - ce * 0.9, -20 + ce * 16);
    if (t > 4.2 && !this.finished) { this.finished = true; this.active = false; if (this.onDone) this.onDone(); }
  }
  flash() { return this.t > 3.7 ? Math.min(1, (this.t - 3.7) * 2.5) : 0; }
  render(renderer) { renderer.render(this.scene, this.cam); }
}
