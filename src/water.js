import * as THREE from 'three';
import { NOISE_GLSL } from './noise.js';
import { HB } from './terrain.js';
import { SKY_COLORS } from './sky.js';

export function makeWater(heightTex, sunDir, fog) {
  const uniforms = {
    uTime: { value: 0 }, uSun: { value: sunDir },
    uHeight: { value: heightTex }, uHB: { value: new THREE.Vector4(HB.x0, HB.z0, HB.size, HB.size) },
    uRefl: { value: null }, uUseRefl: { value: 0 }, uTexMat: { value: new THREE.Matrix4() },
    uShallow: { value: new THREE.Color('#8ff5e4') }, uMid: { value: new THREE.Color('#14c4e0') },
    uDeep: { value: new THREE.Color('#0a63d0') },
    uSkyH: { value: SKY_COLORS.horizon }, uSkyZ: { value: SKY_COLORS.mid },
    uFogColor: { value: fog.color }, uFogDensity: { value: fog.density }, uDay: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthWrite: true,
    vertexShader: /* glsl */`
      uniform mat4 uTexMat;
      varying vec3 vWorld; varying vec4 vRefl;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz; vRefl = uTexMat * w;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uUseRefl, uFogDensity, uDay; uniform vec3 uSun, uShallow, uMid, uDeep, uSkyH, uSkyZ, uFogColor;
      uniform sampler2D uHeight, uRefl; uniform vec4 uHB;
      varying vec3 vWorld; varying vec4 vRefl;
      ${NOISE_GLSL}
      float seabed(vec2 p){
        vec2 uv = (p - uHB.xy) / uHB.zw;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -30.0;
        return texture2D(uHeight, uv).r;
      }
      float wh(vec2 p, float t){
        return 0.50*vnoise(p*0.32 + t*vec2(0.30, 0.21))
             + 0.30*vnoise(p*0.77 - t*vec2(0.26, -0.37))
             + 0.16*vnoise(p*1.85 + t*vec2(-0.62, 0.41))
             + 0.08*vnoise(p*4.20 + t*vec2(0.93, 0.71));
      }
      void main(){
        vec3 toCam = cameraPosition - vWorld; float dist = length(toCam); vec3 V = toCam / dist;
        float t = uTime;
        float depth = max(-seabed(vWorld.xz), 0.0);
        float fade = 1.0 / (1.0 + dist * 0.01);
        vec2 p = vWorld.xz;
        float e = 0.12;
        float h0 = wh(p, t);
        vec2 g = vec2(wh(p + vec2(e, 0.0), t) - h0, wh(p + vec2(0.0, e), t) - h0) / e;
        // long swell
        g += 0.18 * vec2(cos(dot(p, vec2(0.09, 0.05)) + t*0.9), 0.6*cos(dot(p, vec2(-0.04, 0.11)) + t*1.1));
        vec3 N = normalize(vec3(-g.x * 0.42 * fade, 1.0, -g.y * 0.42 * fade));
        float NdV = clamp(dot(N, V), 0.0, 1.0);
        float fres = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);

        vec3 body = mix(uShallow, uMid, smoothstep(0.4, 5.0, depth));
        body = mix(body, uDeep, smoothstep(5.0, 22.0, depth));
        // brighter crests
        body *= (0.92 + 0.22 * h0) * mix(0.1, 1.0, uDay);

        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 refl = mix(uSkyH, uSkyZ, smoothstep(0.0, 0.45, R.y));
        if (uUseRefl > 0.5 && vRefl.w > 1.0e-3) {
          vec2 ruv = clamp(vRefl.xy / vRefl.w + N.xz * 0.035 * fade, vec2(0.0), vec2(1.0));
          vec4 rc = texture2D(uRefl, ruv);
          if (rc.r == rc.r && rc.g == rc.g && rc.b == rc.b && rc.a == rc.a) refl = mix(refl, min(rc.rgb, vec3(8.0)), clamp(rc.a, 0.0, 1.0));
        }
        vec3 col = mix(body, refl, clamp(fres * 0.9 + 0.04, 0.0, 1.0));

        // sun specular + glitter
        float sp = max(dot(R, uSun), 0.0);
        col += vec3(1.0, 0.97, 0.9) * (pow(sp, 700.0) * 26.0 + pow(sp, 70.0) * 0.5) * smoothstep(-0.02, 0.08, uSun.y);
        float gl1 = vnoise(p * 3.1 + vec2(t * 1.9, t * 1.2)) * vnoise(p * 2.7 - vec2(t * 1.3, t * 2.1));
        float glit = smoothstep(0.56, 0.74, gl1) * (0.05 + pow(sp, 5.0) * 2.4) * (1.0 - smoothstep(25.0, 320.0, dist));
        col += vec3(1.0) * glit * 2.4 * mix(0.15, 1.0, uDay);

        // shallow surface caustic net
        float cz = caustic(p * 0.42, t * 0.9) * (1.0 - smoothstep(0.6, 7.0, depth)) * (1.0 - smoothstep(18.0, 110.0, dist));
        col += vec3(0.88, 1.0, 1.0) * cz * 0.42 * uDay;

        // shoreline foam
        float wave = 0.34 + 0.22 * sin(t * 1.4 + p.x * 0.17 + p.y * 0.11);
        float foamLine = 1.0 - smoothstep(0.0, wave, depth);
        float fn = vnoise(p * 1.3 + t * 0.35);
        float foam = foamLine * smoothstep(0.25, 0.6, fn + foamLine * 0.45);

        col = mix(col, vec3(1.0) * mix(0.3, 1.0, uDay), foam * 0.85);
        float alpha = mix(0.22, 0.97, smoothstep(0.0, 7.5, depth));
        alpha = max(alpha, fres * 0.95);
        alpha = max(alpha, foam * 0.92);
        alpha = clamp(alpha + cz * 0.25 + glit * 0.5, 0.0, 1.0);

        float ff = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
        col = mix(col, uFogColor, ff); alpha = mix(alpha, 1.0, ff);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geo = new THREE.PlaneGeometry(26000, 26000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  mesh.name = 'water';
  return mesh;
}

// Planar mirror for the sea surface (y = 0), following three's Reflector maths.
export class Mirror {
  constructor(scale = 0.5) {
    this.scale = scale;
    this.rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
    this.cam = new THREE.PerspectiveCamera();
    this.texMat = new THREE.Matrix4();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.05);
    this._v = new THREE.Vector3(); this._t = new THREE.Vector3(); this._r = new THREE.Matrix4();
    this._la = new THREE.Vector3(); this._cp = new THREE.Vector3();
  }
  setSize(w, h) { this.rt.setSize(Math.max(2, Math.floor(w * this.scale)), Math.max(2, Math.floor(h * this.scale))); }
  render(renderer, scene, camera, hide) {
    const n = new THREE.Vector3(0, 1, 0);
    const cp = this._cp.setFromMatrixPosition(camera.matrixWorld);
    if (cp.y < 0.05) return false;
    const rp = new THREE.Vector3(cp.x, 0, cp.z);
    const view = this._v.subVectors(rp, cp).reflect(n).negate().add(rp);
    this._r.extractRotation(camera.matrixWorld);
    const la = this._la.set(0, 0, -1).applyMatrix4(this._r).add(cp);
    const target = this._t.subVectors(rp, la).reflect(n).negate().add(rp);
    const vc = this.cam;
    vc.position.copy(view);
    vc.up.set(0, 1, 0).applyMatrix4(this._r).reflect(n);
    vc.lookAt(target);
    vc.far = camera.far; vc.near = camera.near;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);
    vc.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    this.texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.texMat.multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);

    const vis = hide.map((o) => o.visible);
    hide.forEach((o) => (o.visible = false));
    const oldRT = renderer.getRenderTarget();
    const oldClip = renderer.clippingPlanes;
    const oldClear = renderer.getClearAlpha();
    const oldColor = renderer.getClearColor(new THREE.Color());
    renderer.clippingPlanes = [this.plane];
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, vc);
    renderer.setRenderTarget(oldRT);
    renderer.clippingPlanes = oldClip;
    renderer.setClearColor(oldColor, oldClear);
    hide.forEach((o, i) => (o.visible = vis[i]));
    return true;
  }
}

// Waterfall / stream ribbon shader
export function makeFallMaterial(timeU) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: timeU },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv; varying float vSteep;
      attribute float steep;
      void main(){ vUv = uv; vSteep = steep; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; varying vec2 vUv; varying float vSteep;
      ${NOISE_GLSL}
      void main(){
        float speed = mix(0.5, 2.6, vSteep);
        vec2 p = vec2(vUv.x * 9.0, vUv.y * 6.0 + uTime * speed);
        float s = fbm(vec2(p.x, p.y * 0.35));
        float streak = smoothstep(0.35, 0.8, s);
        vec3 deep = pow(vec3(0.35, 0.86, 0.9), vec3(2.2));
        vec3 col = mix(deep, vec3(1.0), clamp(streak * (0.5 + vSteep) , 0.0, 1.0));
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        float a = (0.55 + 0.4 * streak) * edge * mix(0.75, 1.0, vSteep);
        gl_FragColor = vec4(col * 1.05, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
