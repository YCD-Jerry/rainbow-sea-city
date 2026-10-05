import * as THREE from 'three';
import { MMDLoader } from 'three/addons/loaders/MMDLoader.js';
import { MMDParser } from 'three/addons/libs/mmdparser.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

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
  const set = (name, control) => bones.get(name)?.quaternion.copy(control.quaternion);
  const z = new THREE.Vector3(0, 0, 1);
  const arms = ['左', '右'].map((side, i) => {
    const arm = bones.get(side + '腕'), elbow = bones.get(side + 'ひじ');
    // PMX has intervening twist bones: use absolute bind positions for the arm axis.
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    arm.getWorldPosition(a); elbow.getWorldPosition(b); const delta = b.sub(a);
    const angle = -Math.atan2(delta.x, -delta.y);
    return { side, control: i ? model.R : model.L, rest: new THREE.Quaternion().setFromAxisAngle(z, angle) };
  });
  const grip = new THREE.Group(); model.root.add(grip); grip.add(model.sword);
  model.sword.position.set(0, -0.005, 0);
  const wrist = bones.get('右手首'), pos = new THREE.Vector3(), q = new THREE.Quaternion(), rootQ = new THREE.Quaternion();
  model.syncPose = () => {
    set('上半身', model.torso); set('頭', model.head);
    for (const { side, control, rest } of arms) {
      bones.get(side + '腕').quaternion.copy(control.sh.quaternion).multiply(rest);
      bones.get(side + 'ひじ').quaternion.copy(rest).invert().multiply(control.el.quaternion).multiply(rest);
      set(side + '足', control.hip); set(side + 'ひざ', control.kn);
    }
    model.root.updateMatrixWorld(true); mesh.skeleton.update();
    wrist.getWorldPosition(pos); model.root.worldToLocal(pos); grip.position.copy(pos);
    model.root.getWorldQuaternion(rootQ); wrist.getWorldQuaternion(q);
    grip.quaternion.copy(rootQ.invert()).multiply(q).multiply(arms[1].rest.clone().invert());
    grip.updateMatrixWorld(true);
  };
  model.update = () => model.syncPose();
  model.root.userData.modelTrial = 'diluc'; model.trialMesh = mesh;
  model.syncPose();
  return model;
}
