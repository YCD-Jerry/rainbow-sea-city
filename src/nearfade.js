import * as THREE from 'three';

// Screen-door fade for surfaces very close to the camera (leaves, trunks, rocks, bushes, grass).
// Instead of the view filling up with a wall of leaves when the camera slips into a canopy,
// those fragments dissolve with a stable dither pattern — the usual trick in open-world games.
const CHUNK = `
#ifdef NEAR_FADE
{
  float nfZ = 1.0 / gl_FragCoord.w;
  float nfK = clamp((nfZ - NEAR_FADE_A) / (NEAR_FADE_B - NEAR_FADE_A), 0.0, 1.0);
  float nfN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (nfN > nfK) discard;
}
#endif
`;
let patched = false;
export function nearFade(mat, a = 0.5, b = 1.7) {
  if (!mat) return mat;
  if (!patched) { THREE.ShaderChunk.clipping_planes_fragment = CHUNK + THREE.ShaderChunk.clipping_planes_fragment; patched = true; }
  mat.defines = { ...(mat.defines || {}), NEAR_FADE: '', NEAR_FADE_A: a.toFixed(2), NEAR_FADE_B: b.toFixed(2) };
  mat.needsUpdate = true;
  return mat;
}
