import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original fruit models: all nodes of a type share one complete mesh geometry and material.
const models = new Map();
export const FRUIT_REGROW_SECONDS = 300;
export const isTreeFruit = (type) => type === 'apple' || type === 'orange';

function coloredPart(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  // Decoration samples a neutral normal-map texel, so peel bumps stay on the fruit body.
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 / 64, 0.5 / 64);
  const c = new THREE.Color(color), colors = [];
  for (let i = 0; i < g.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

function leafPart(y, size = 1) {
  const p = [0, y, 0, 0.052 * size, y + 0.027 * size, 0.021 * size,
    0.11 * size, y + 0.014 * size, 0.032 * size, 0.049 * size, y - 0.002 * size, 0.043 * size,
    0.047 * size, y + 0.002 * size, -0.007 * size];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  // A folded, closed leaf catches light on both sides without doubling the body's material.
  g.setIndex([0, 1, 4, 1, 2, 4, 0, 3, 1, 1, 3, 2, 0, 4, 3, 4, 2, 3]);
  g.computeVertexNormals();
  return coloredPart(g, '#578e3c');
}

function peelNormal() {
  const N = 64, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    const a = x / N * Math.PI * 2, b = y / N * Math.PI * 2;
    data[i] = Math.round(128 + 28 * Math.cos(a * 13 + Math.sin(b * 11)));
    data[i + 1] = Math.round(128 + 28 * Math.sin(b * 17 + Math.sin(a * 9)));
    data[i + 2] = 250; data[i + 3] = 255;
  }
  data[0] = data[1] = 128; data[2] = 255;
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

function fruitModel(type) {
  if (models.has(type)) return models.get(type);
  const apple = type === 'apple', radius = apple ? 0.2 : 0.19;
  const body = new THREE.SphereGeometry(radius, 18, 12), pos = body.attributes.position;
  const colors = [], dark = new THREE.Color(apple ? '#c83c48' : '#ef921f'), light = new THREE.Color(apple ? '#f07156' : '#ffc15a');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ny = y / radius;
    const a = Math.atan2(z, x), r = Math.hypot(x, z);
    const lobes = 1 + (apple ? 0.043 : 0.009) * Math.cos(a * (apple ? 5 : 9)) * (1 - ny * ny);
    const shoulder = apple ? 1 + 0.045 * ny : 1;
    const dent = ny > 0 ? (apple ? 0.043 : 0.021) * Math.exp(-((r / (apple ? 0.075 : 0.052)) ** 2)) : 0;
    pos.setXYZ(i, x * lobes * shoulder, y * (apple ? 0.94 : 0.87) - dent, z * lobes * shoulder);
    const c = dark.clone().lerp(light, THREE.MathUtils.clamp(0.32 + ny * 0.2 + Math.sin(a + 0.6) * 0.22, 0, 1));
    colors.push(c.r, c.g, c.b);
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); body.computeVertexNormals();
  const parts = [body.toNonIndexed()];
  const stem = new THREE.CylinderGeometry(apple ? 0.009 : 0.012, 0.014, apple ? 0.074 : 0.046, 6);
  stem.rotateZ(-0.12); stem.translate(0, apple ? 0.181 : 0.17, 0);
  parts.push(coloredPart(stem, '#72513a'), leafPart(apple ? 0.195 : 0.174, apple ? 1 : 0.84));
  if (!apple) {
    for (let k = 0; k < 5; k++) {
      const petal = new THREE.ConeGeometry(0.023, 0.067, 3);
      petal.rotateZ(Math.PI / 2 + 0.24); petal.translate(0.031, 0.158, 0); petal.rotateY(k / 5 * Math.PI * 2);
      parts.push(coloredPart(petal, '#577b38'));
    }
  }
  const geometry = mergeGeometries(parts, false); geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: apple ? 0.42 : 0.73 });
  if (!apple) { material.normalMap = peelNormal(); material.normalScale.set(0.2, 0.2); }
  const model = { geometry, material }; models.set(type, model);
  return model;
}

export function createFruitMesh(type) {
  if (!isTreeFruit(type)) throw new Error('Unknown tree fruit type');
  const { geometry, material } = fruitModel(type);
  const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
