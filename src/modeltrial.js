import * as THREE from 'three';
import { MMDLoader } from 'three/addons/loaders/MMDLoader.js';
import { MMDParser } from 'three/addons/libs/mmdparser.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { MMDAnimationHelper } from 'three/addons/animation/MMDAnimationHelper.js';

// Temporary appearance trial. Copyright miHoYo; model editing 神帝宇.
// The author's package permits modification/noncommercial use and forbids redistribution.
// Fetch the original distribution directly: never bundle or mirror its model/textures.
export const TRIAL_SOURCE = 'https://static.biligame.com/caster_custom_assets/ys/gczj/diluke.zip';
export const trial = { state: 'off', credit: '迪卢克外观试玩 · 模型版权 miHoYo · 模型编辑 神帝宇' };
let prototype;

async function unzip(buffer) {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer);
  let end = buffer.byteLength - 22;
  for (; end >= Math.max(0, buffer.byteLength - 65557); end--) if (view.getUint32(end, true) === 0x06054b50) break;
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50) throw new Error('Invalid model archive');
  const files = new Map();
  let at = view.getUint32(end + 16, true);
  for (let n = view.getUint16(end + 10, true); n > 0; n--) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('Invalid archive entry');
    const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true), unpacked = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true), extraLen = view.getUint16(at + 30, true), commentLen = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = new TextDecoder(flags & 2048 ? 'utf-8' : 'gb18030').decode(bytes.subarray(at + 46, at + 46 + nameLen)).replaceAll('\\', '/');
    at += 46 + nameLen + extraLen + commentLen;
    if (!/\.(pmx|png)$/i.test(name)) continue;
    if (unpacked > 32 * 1024 * 1024 || flags & 1) throw new Error('Unsupported model archive');
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const packed = bytes.slice(start, start + size);
    const result = method === 0 ? packed.buffer : method === 8
      ? await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()
      : null;
    if (!result || result.byteLength !== unpacked) throw new Error('Model extraction failed');
    files.set(name, result);
  }
  return files;
}

export async function prepareModelTrial() {
  if (new URLSearchParams(location.search).get('model') === 'original') return;
  trial.state = 'loading';
  const controller = new AbortController(), urls = [];
  let pending;
  const timeout = new Promise((_, reject) => {
    pending = setTimeout(() => { controller.abort(); reject(new Error('Model download timed out')); }, 25000);
  });
  try {
    const load = async () => {
      const response = await fetch(TRIAL_SOURCE, { signal: controller.signal });
      if (!response.ok) throw new Error('Model source unavailable');
      const files = await unzip(await response.arrayBuffer());
      if (controller.signal.aborted) throw new Error('Model load cancelled');
      const entry = [...files.keys()].find(name => /\.pmx$/i.test(name));
      if (!entry) throw new Error('Missing model');
      const folder = entry.slice(0, entry.lastIndexOf('/') + 1);
      const data = new MMDParser.Parser().parsePmx(files.get(entry), true);
      const textures = new Map();
      for (const name of data.textures) {
        const key = name.replaceAll('\\', '/');
        const file = files.get(folder + key);
        if (!file) throw new Error('Missing model texture');
        const url = URL.createObjectURL(new Blob([file], { type: 'image/png' }));
        urls.push(url); textures.set(key, url);
      }
      const manager = new THREE.LoadingManager();
      manager.setURLModifier(url => url.startsWith('data:') ? url : textures.get(decodeURIComponent(url).replaceAll('\\', '/')) || url);
      let mesh;
      await new Promise((resolve, reject) => {
        manager.onLoad = resolve;
        manager.onError = () => reject(new Error('Model texture failed'));
        mesh = new MMDLoader(manager).meshBuilder.build(data, '', undefined, reject);
      });
      mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox;
      const required = ['上半身', '頭', '左腕', '右腕', '左ひじ', '右ひじ', '右手首', '左足', '右足', '左ひざ', '右ひざ'];
      if (controller.signal.aborted || !(bounds.max.y > bounds.min.y) || !Number.isFinite(bounds.max.y - bounds.min.y)
          || required.some(name => !mesh.skeleton.bones.some(b => b.name === name))) throw new Error('Unsupported trial skeleton');
      mesh.userData.trialShared = true;
      mesh.frustumCulled = false; // The bind-pose bounds do not cover all animated poses.
      mesh.castShadow = true;
      return mesh;
    };
    prototype = await Promise.race([load(), timeout]);
    trial.state = 'ready';
  } catch (e) {
    trial.state = 'fallback';
    console.info('外观试玩未加载，使用原创模型。', e.message);
  } finally {
    clearTimeout(pending);
    for (const url of urls) URL.revokeObjectURL(url);
  }
}

// Reuse the game's pose controls, weapon and glider; only the rendered body changes.
export function applyModelTrial(model, id) {
  if (id !== 'lan' || !prototype) return model;
  const keep = new Set();
  model.sword.traverse(o => keep.add(o)); model.glider.traverse(o => keep.add(o));
  const remove = [];
  model.root.traverse(o => { if (o.isMesh && !keep.has(o)) remove.push(o); });
  for (const o of remove) { o.removeFromParent(); o.geometry.dispose(); }
  const mesh = clone(prototype), box = mesh.geometry.boundingBox;
  const scale = 1.8 / (box.max.y - box.min.y);
  mesh.scale.setScalar(scale);
  mesh.position.y = -0.9 - box.min.y * scale;
  model.pose.add(mesh);
  const bones = new Map(mesh.skeleton.bones.map(b => [b.name, b]));
  // PMX deformation legs (足D/ひざD/足首D) inherit rotations through grants,
  // rather than being descendants of the animated control legs.
  const grants = mesh.geometry.userData.MMD.grants;
  const grantSolver = new MMDAnimationHelper().createGrantSolver(mesh);
  const grantRest = grants.map(g => mesh.skeleton.bones[g.index].quaternion.clone());
  const set = (name, control) => bones.get(name)?.quaternion.copy(control.quaternion);
  const z = new THREE.Vector3(0, 0, 1);
  const baseY = mesh.position.y;
  const legs = ['左', '右'].map(side => {
    const hip = bones.get(side + '足'), knee = bones.get(side + 'ひざ'), ankle = bones.get(side + '足首');
    const h = new THREE.Vector3(), k = new THREE.Vector3(), a = new THREE.Vector3();
    hip.getWorldPosition(h); knee.getWorldPosition(k); ankle.getWorldPosition(a);
    return { side, hip, knee, ankle, h, a, upper: h.distanceTo(k), lower: k.distanceTo(a),
      upperAngle: Math.atan2(h.z - k.z, h.y - k.y), lowerAngle: Math.atan2(k.z - a.z, k.y - a.y) };
  });
  const armEuler = new THREE.Euler(), armQ = new THREE.Quaternion();
  let lastMotion, lastDelta = 1;
  const smoothBones = ['上半身', '左腕', '右腕', '左ひじ', '右ひじ', '右手首'].map(name => ({ bone: bones.get(name), previous: new THREE.Quaternion() }));
  const targetQ = new THREE.Quaternion();
  const arms = ['左', '右'].map((side, i) => {
    const arm = bones.get(side + '腕'), elbow = bones.get(side + 'ひじ');
    // PMX has intervening twist bones: use absolute bind positions for the arm axis.
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    arm.getWorldPosition(a); elbow.getWorldPosition(b); const delta = b.sub(a);
    const angle = -Math.atan2(delta.x, -delta.y);
    return { side, control: i ? model.R : model.L, rest: new THREE.Quaternion().setFromAxisAngle(z, angle) };
  });
  const grip = new THREE.Group(); model.root.add(grip); grip.add(model.sword);
  model.sword.position.set(0, -0.045, -0.008);
  // A closed fist grips across the palm. The old weapon axis ran along the fingers.
  model.sword.rotation.x = -Math.PI / 2;
  const wrist = bones.get('右手首'), pos = new THREE.Vector3(), q = new THREE.Quaternion(), rootQ = new THREE.Quaternion();
  model.syncPose = (motion = lastMotion) => {
    lastMotion = motion;
    for (const item of smoothBones) item.previous.copy(item.bone.quaternion);
    grants.forEach((g, i) => mesh.skeleton.bones[g.index].quaternion.copy(grantRest[i]));
    set('上半身', model.torso); set('頭', model.head);
    const walking = motion?.mode === 'ground' && !motion.action && !motion.dead;
    const amount = walking ? Math.min(1, motion.speed / 3) : 0;
    const run = walking ? THREE.MathUtils.clamp((motion.speed - 6.5) / 3, 0, 1) : 0;
    // Running contact occupies a quarter cycle. During contact the foot travels
    // backward at the same speed as the body advances (Player phase rate = speed * 1.55).
    const stride = amount * Math.PI / (4 * 1.55);
    const footTargets = legs.map((leg, i) => {
      const u = ((motion?.phase || 0) / (Math.PI * 2) + i * 0.5) % 1;
      const swing = THREE.MathUtils.clamp((u - 0.25) / 0.75, 0, 1);
      const eased = swing * swing * (3 - 2 * swing);
      return { z: walking ? stride * (u < 0.25 ? 1 - 8 * u : -1 + 2 * eased) : 0,
        lift: walking && u >= 0.25 ? amount * (0.14 + run * 0.08) * Math.sin(Math.PI * swing) ** 2 : 0 };
    });
    const hipHeight = Math.min(...legs.map((leg, i) => {
      const dz = leg.a.z - leg.h.z + footTargets[i].z;
      const length = (leg.upper + leg.lower) * 0.995;
      return leg.a.y + footTargets[i].lift + Math.sqrt(Math.max(0.01, length * length - dz * dz));
    }));
    const crouch = walking ? amount * (legs[0].h.y - hipHeight + model.pose.position.y - 0.9) : 0;
    mesh.position.y = baseY - crouch;
    const attack = motion?.action?.type === 'na' ? motion.action : null;
    const k = attack ? THREE.MathUtils.clamp(attack.t / attack.dur, 0, 1) : 0;
    const e = k * k * (3 - 2 * k), mix = THREE.MathUtils.lerp;
    if (attack && attack.step < 2) {
      armEuler.copy(model.torso.rotation);
      armEuler.y = mix(attack.step ? 0.55 : -0.55, attack.step ? -0.55 : 0.55, e);
      bones.get('上半身').quaternion.setFromEuler(armEuler);
    }
    for (const { side, control, rest } of arms) {
      armEuler.copy(control.sh.rotation);
      if (walking) armEuler.x = (side === '左' ? 1 : -1) * footTargets[0].z / Math.max(stride, 0.001) * amount * (0.36 + run * 0.16);
      if (attack) {
        if (side === '左') { armEuler.x = -0.25; armEuler.z = 0.2; }
        else if (attack.step < 2) { armEuler.x = mix(-0.95, -0.65, e); armEuler.z = mix(attack.step ? 0.45 : -0.4, attack.step ? -0.4 : 0.45, e); }
        else if (attack.step === 2) { armEuler.x = mix(0.05, -2.3, e); armEuler.z = -0.12; }
        else if (attack.step === 3) { armEuler.x = mix(-2.4, -0.5, e); armEuler.z = -0.2; }
        else { armEuler.x = -0.8; armEuler.z = -0.9; }
      }
      bones.get(side + '腕').quaternion.setFromEuler(armEuler).multiply(rest);
      armEuler.copy(control.el.rotation);
      if (walking) armEuler.x = -0.25 - run * 0.35;
      if (attack) armEuler.x = side === '左' ? -0.65 : attack.step < 2 ? mix(-0.75, -0.35, e) : -0.4;
      armQ.setFromEuler(armEuler);
      bones.get(side + 'ひじ').quaternion.copy(rest).invert().multiply(armQ).multiply(rest);
      set(side + '足', control.hip); set(side + 'ひざ', control.kn);
      // Keep the boot aligned with the ground instead of inheriting every knee bend.
      const ankle = bones.get(side + '足首');
      if (ankle) { ankle.rotation.x = -(control.hip.rotation.x + control.kn.rotation.x) * 0.65; ankle.rotation.z = 0; }
    }
    // Two-bone leg solve: the supporting boot stays on the floor while the
    // other rises through the swing phase. Also plant both boots during sword attacks.
    if (motion?.mode === 'ground' && !motion.dead) for (let i = 0; i < legs.length; i++) {
      const leg = legs[i], lift = footTargets[i].lift;
      const dz = leg.a.z - leg.h.z + (walking ? footTargets[i].z : -Math.sin((i ? model.R : model.L).hip.rotation.x) * 0.45);
      const dy = leg.h.y - leg.a.y + model.pose.position.y - 0.9 - crouch - lift;
      const d = THREE.MathUtils.clamp(Math.hypot(dy, dz), 0.02, (leg.upper + leg.lower) * 0.99999);
      const knee = Math.acos(THREE.MathUtils.clamp((d * d - leg.upper * leg.upper - leg.lower * leg.lower) / (2 * leg.upper * leg.lower), -1, 1));
      const hip = Math.atan2(-dz, dy) - Math.atan2(leg.lower * Math.sin(knee), leg.upper + leg.lower * Math.cos(knee));
      leg.hip.rotation.x = hip - leg.upperAngle;
      leg.hip.rotation.z = (i ? -1 : 1) * (motion.action ? 0.09 : 0.025);
      leg.knee.rotation.x = knee + leg.upperAngle - leg.lowerAngle;
      leg.ankle.rotation.x = -leg.hip.rotation.x - leg.knee.rotation.x;
      leg.ankle.rotation.z = -leg.hip.rotation.z;
    }
    // Retarget wrist flexion/pronation as well as the elbow; otherwise the sword
    // points along the forearm and the imported hand appears to wave at it.
    armEuler.set(motion?.holdingWeapon ? 0.55 : 0, 0, 0);
    if (attack) {
      armEuler.x = attack.step === 3 ? 0.9 : 0.25;
      armEuler.y = attack.step < 2 || attack.step === 4 ? 1.25 : 0.15;
    } else if (motion?.action && motion.holdingWeapon) armEuler.y = 0.7;
    armQ.setFromEuler(armEuler);
    wrist.quaternion.copy(arms[1].rest).invert().multiply(armQ).multiply(arms[1].rest);
    // The distributed model has an open hand; close its actual finger bones around the grip.
    for (const side of ['左', '右']) {
      const holding = side === '右' && motion?.holdingWeapon;
      const sign = side === '右' ? 1 : -1;
      for (const finger of ['人指', '中指', '薬指', '小指']) for (const [j, number] of ['１', '２', '３'].entries()) {
        const bone = bones.get(side + finger + number);
        if (bone) bone.rotation.z = sign * (holding ? [0.75, 1.05, 0.85][j] : [0.12, 0.18, 0.12][j]);
      }
      const thumb = bones.get(side + '親指１');
      if (thumb) thumb.rotation.z = sign * (holding ? 0.45 : 0.1);
    }
    const blend = Math.min(1, Math.max(0, lastDelta) * 30);
    for (const item of smoothBones) {
      targetQ.copy(item.bone.quaternion);
      item.bone.quaternion.copy(item.previous).slerp(targetQ, blend);
    }
    grantSolver.update();
    model.root.updateMatrixWorld(true); mesh.skeleton.update();
    wrist.getWorldPosition(pos); model.root.worldToLocal(pos); grip.position.copy(pos);
    model.root.getWorldQuaternion(rootQ); wrist.getWorldQuaternion(q);
    grip.quaternion.copy(rootQ.invert()).multiply(q).multiply(arms[1].rest.clone().invert());
    grip.updateMatrixWorld(true);
  };
  model.update = (dt, t, flow, hipL, hipR, motion) => { lastDelta = dt; model.syncPose(motion); };
  model.root.userData.modelTrial = 'diluc'; model.trialMesh = mesh;
  model.syncPose();
  return model;
}
