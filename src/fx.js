import * as THREE from 'three';

function dotTexture() {
  const S = 64; const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const arcMat = (color) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(color) }, uT: { value: 0 } },
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 uColor; uniform float uT; varying vec2 vUv;
    void main(){
      float along = vUv.x;               // 0 tail .. 1 head
      float head = smoothstep(0.0, 1.0, along);
      float rad = vUv.y;                 // 0 inner .. 1 outer
      float edge = smoothstep(0.0, 0.35, rad) * (1.0 - smoothstep(0.85, 1.0, rad));
      float sweep = smoothstep(uT * 1.6 - 0.6, uT * 1.6, along);
      float a = head * edge * (1.0 - smoothstep(0.35, 1.0, uT)) * (0.35 + 0.65 * sweep);
      vec3 c = mix(uColor, vec3(1.0), smoothstep(0.55, 1.0, rad) * 0.7);
      gl_FragColor = vec4(c * 1.6, a);
    }`,
});

function arcGeo(r0, r1, theta0, len, seg = 32) {
  // UV.x runs along the arc, UV.y across (inner->outer)
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = theta0 + len * t;
    for (let j = 0; j <= 1; j++) {
      const r = j ? r1 : r0;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      uv.push(t, j);
    }
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const ringMat = (color) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(color) }, uT: { value: 0 }, uFill: { value: 0 } },
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 uColor; uniform float uT; varying vec2 vUv;
    void main(){
      vec2 p = vUv * 2.0 - 1.0; float r = length(p);
      float ring = smoothstep(0.7, 0.93, r) * (1.0 - smoothstep(0.93, 1.0, r));
      float inner = (1.0 - smoothstep(0.0, 0.9, r)) * 0.25;
      float a = (ring + inner) * (1.0 - uT);
      gl_FragColor = vec4(uColor * 1.5, a);
    }`,
});

const teleMat = () => new THREE.ShaderMaterial({
  uniforms: { uFill: { value: 0 }, uShape: { value: 0 } },
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform float uFill; uniform float uShape; varying vec2 vUv;
    void main(){
      vec2 p = vUv * 2.0 - 1.0;
      float r = uShape > 0.5 ? max(abs(p.x), 0.0) : length(p);
      float prog = uShape > 0.5 ? vUv.y : length(p);
      if (uShape < 0.5 && r > 1.0) discard;
      float rim = uShape > 0.5 ? smoothstep(0.85, 1.0, abs(p.x)) : smoothstep(0.88, 1.0, r);
      float fill = step(prog, uFill) * 0.38;
      float a = max(rim * 0.85, fill) + 0.12;
      gl_FragColor = vec4(vec3(1.0, 0.25, 0.2), a);
    }`,
});

const rippleMat = () => new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uA: { value: 1 } },
  transparent: true, depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform float uT; uniform float uA; varying vec2 vUv;
    void main(){
      float r = length(vUv * 2.0 - 1.0);
      float w = 0.08 + 0.06 * uT;
      float ring = smoothstep(1.0 - w * 2.0, 1.0 - w, r) * (1.0 - smoothstep(1.0 - w * 0.4, 1.0, r));
      float ring2 = smoothstep(0.55 - w, 0.62 - w * 0.5, r) * (1.0 - smoothstep(0.62, 0.68, r)) * 0.5;
      float a = (ring + ring2) * (1.0 - uT) * uA * 0.75;
      gl_FragColor = vec4(vec3(0.94, 0.99, 1.0), a);
      #include <colorspace_fragment>
    }`,
});
export class FX {
  constructor(scene, camera, layer) {
    this.scene = scene; this.camera = camera; this.layer = layer;
    this.live = []; this.dot = dotTexture();
    this.v = new THREE.Vector3();
    this.shake = 0;
  }
  project(p) {
    this.v.copy(p).project(this.camera);
    if (this.v.z > 1) return null;
    return [(this.v.x * 0.5 + 0.5) * window.innerWidth, (-this.v.y * 0.5 + 0.5) * window.innerHeight];
  }
  number(pos, text, { color = '#ffffff', crit = false, label = null, labelColor = null, small = false } = {}) {
    const s = this.project(pos); if (!s) return;
    const el = document.createElement('div');
    el.className = 'dmg' + (crit ? ' crit' : '') + (small ? ' small' : '');
    el.style.left = (s[0] + (Math.random() - 0.5) * 40) + 'px';
    el.style.top = (s[1] - 20 + (Math.random() - 0.5) * 16) + 'px';
    el.style.color = color;
    el.innerHTML = (label ? `<b style="color:${labelColor || color}">${label}</b>` : '') + `<span>${text}</span>`;
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
  label(pos, text, cls = '') {
    const s = this.project(pos); if (!s) return;
    const el = document.createElement('div');
    el.className = 'fxlabel ' + cls;
    el.style.left = s[0] + 'px'; el.style.top = (s[1] - 30) + 'px';
    el.textContent = text;
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
  slash(pos, facing, kind, color = '#bfefff') {
    // kind: 'h' horizontal right->left, 'hr' left->right, 'up', 'down', 'spin'
    let len = 2.4, theta0 = -1.2, r0 = 1.0, r1 = 2.8;
    if (kind === 'spin') { len = Math.PI * 2; theta0 = 0; r0 = 1.2; r1 = 3.4; }
    if (kind === 'big') { len = Math.PI * 2; theta0 = 0; r0 = 2.0; r1 = 4.3; }
    const g = arcGeo(r0, r1, theta0, len, kind === 'spin' || kind === 'big' ? 48 : 28);
    const m = new THREE.Mesh(g, arcMat(color));
    const o = new THREE.Object3D();
    o.position.copy(pos); o.rotation.order = 'YXZ'; o.rotation.y = facing;
    if (kind === 'up' || kind === 'down') o.rotation.z = Math.PI / 2;
    // rotate the arc so its middle faces +z (character forward); default sweep is left -> right / top -> bottom
    const inner = new THREE.Object3D();
    inner.rotation.y = (theta0 + len / 2) - Math.PI / 2;
    const mir = new THREE.Object3D();
    if (kind === 'h' || kind === 'up') mir.scale.x = -1;
    inner.add(m); mir.add(inner); o.add(mir); this.scene.add(o);
    this.live.push({ obj: o, mat: m.material, t: 0, dur: kind === 'big' ? 0.5 : 0.3, uni: 'uT' });
  }
  ring(pos, radius, color = '#8fe3ff', dur = 0.5, grow = 1.8) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ringMat(color));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += 0.15;
    m.scale.setScalar(radius * 0.5);
    this.scene.add(m);
    this.live.push({ obj: m, mat: m.material, t: 0, dur, uni: 'uT', grow: radius * grow, base: radius * 0.5 });
  }
  sparks(pos, color = '#ffffff', n = 8, speed = 6, size = 0.35, life = 0.45, up = 2) {
    const mat = new THREE.SpriteMaterial({ map: this.dot, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.position.copy(pos);
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.8;
      const sp = speed * (0.4 + Math.random() * 0.8);
      s.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      this.scene.add(s);
      this.live.push({ obj: s, mat: s.material, t: 0, dur: life * (0.7 + Math.random() * 0.6), vel: new THREE.Vector3(Math.cos(a) * sp * Math.cos(e), up + Math.sin(e) * sp, Math.sin(a) * sp * Math.cos(e)), sprite: true });
    }
  }
  // water droplets: soft white sprites thrown up and pulled down by gravity
  splash(pos, n = 10, power = 1) {
    if (!this.dropMat) this.dropMat = new THREE.SpriteMaterial({ map: this.dot, color: '#f2fbff', transparent: true, depthWrite: false, opacity: 0.9 });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.dropMat.clone());
      s.position.set(pos.x + (Math.random() - 0.5) * 0.35, pos.y + 0.02, pos.z + (Math.random() - 0.5) * 0.35);
      const a = Math.random() * Math.PI * 2, sp = (0.8 + Math.random() * 1.6) * power;
      s.scale.setScalar((0.07 + Math.random() * 0.1) * Math.sqrt(power));
      this.scene.add(s);
      this.live.push({ obj: s, mat: s.material, t: 0, dur: 0.45 + Math.random() * 0.3, vel: new THREE.Vector3(Math.cos(a) * sp, (2.2 + Math.random() * 2.2) * power, Math.sin(a) * sp), sprite: true, grav: 14, floor: pos.y - 0.05 });
    }
  }
  ripple(pos, radius = 0.9, dur = 0.9, alpha = 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rippleMat());
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, pos.y + 0.015, pos.z); m.renderOrder = 6;
    m.material.uniforms.uA.value = alpha;
    m.scale.setScalar(radius * 0.25);
    this.scene.add(m);
    this.live.push({ obj: m, mat: m.material, t: 0, dur, uni: 'uT', grow: radius, base: radius * 0.25 });
  }
  telegraph(pos, radius, dur, facing = 0, line = 0) {
    const geo = line ? new THREE.PlaneGeometry(radius * 2, line) : new THREE.PlaneGeometry(radius * 2, radius * 2);
    if (line) geo.translate(0, line / 2, 0);
    const m = new THREE.Mesh(geo, teleMat());
    m.material.uniforms.uShape.value = line ? 1 : 0;
    const o = new THREE.Object3D(); o.position.copy(pos); o.position.y += 0.12; o.rotation.y = facing;
    m.rotation.x = -Math.PI / 2; o.add(m); this.scene.add(o);
    const item = { obj: o, mat: m.material, t: 0, dur, tele: true };
    this.live.push(item);
    return item;
  }
  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const L = this.live[i]; L.t += dt;
      const k = Math.min(1, L.t / L.dur);
      if (L.uni) L.mat.uniforms[L.uni].value = k;
      if (L.grow) L.obj.scale.setScalar(L.base + (L.grow - L.base) * (1 - (1 - k) * (1 - k)));
      if (L.tele) L.mat.uniforms.uFill.value = k;
      if (L.sprite) {
        L.obj.position.addScaledVector(L.vel, dt); L.vel.y -= (L.grav || 6) * dt; L.vel.multiplyScalar(1 - (L.grav ? 0.6 : 2.5) * dt);
        if (L.floor !== undefined && L.obj.position.y < L.floor) L.kill = true;
        L.mat.opacity = 1 - k;
      }
      if (k >= 1 || L.kill) {
        this.scene.remove(L.obj);
        L.obj.traverse((o) => { if (o.geometry && !o.isSprite) o.geometry.dispose(); });
        L.mat.dispose && L.mat.dispose();
        this.live.splice(i, 1);
      }
    }
    this.shake = Math.min(1.2, Math.max(0, this.shake - Math.max(0, dt) * 2.5));
  }
}
