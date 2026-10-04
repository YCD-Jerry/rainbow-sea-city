// Simple 2.5D colliders: every solid is a footprint in XZ with a top/bottom
// height that may vary across the footprint. Good enough for walking on
// platforms, bridges and rocks, being blocked by towers, and climbing them.
export class Colliders {
  constructor(cell = 16) { this.cell = cell; this.map = new Map(); this.list = []; this._seen = 0; }
  _key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(c) {
    let minX, maxX, minZ, maxZ;
    if (c.type === 'cyl') { minX = c.x - c.r; maxX = c.x + c.r; minZ = c.z - c.r; maxZ = c.z + c.r; }
    else if (c.type === 'ell') { const r = Math.max(c.rx, c.rz); minX = c.x - r; maxX = c.x + r; minZ = c.z - r; maxZ = c.z + r; }
    else if (c.type === 'seg') {
      minX = Math.min(c.ax, c.bx) - c.w; maxX = Math.max(c.ax, c.bx) + c.w;
      minZ = Math.min(c.az, c.bz) - c.w; maxZ = Math.max(c.az, c.bz) + c.w;
    } else if (c.type === 'ring') { minX = c.x - c.r1; maxX = c.x + c.r1; minZ = c.z - c.r1; maxZ = c.z + c.r1; }
    else if (c.type === 'box') { const r = Math.hypot(c.hw, c.hd); minX = c.x - r; maxX = c.x + r; minZ = c.z - r; maxZ = c.z + r; c.cos = Math.cos(c.rot || 0); c.sin = Math.sin(c.rot || 0); }
    if (c.type === 'ell') { c.cos = Math.cos(c.rot || 0); c.sin = Math.sin(c.rot || 0); }
    const pad = 1;
    const i0 = Math.floor((minX - pad) / this.cell), i1 = Math.floor((maxX + pad) / this.cell);
    const j0 = Math.floor((minZ - pad) / this.cell), j1 = Math.floor((maxZ + pad) / this.cell);
    if (c.tag === 'prop' || c.tag === 'rail' || c.tag === 'chest') c.noClimb = true;
    c._id = this.list.length; c._mark = -1;
    this.list.push(c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this._key(i, j);
      let arr = this.map.get(k); if (!arr) { arr = []; this.map.set(k, arr); }
      arr.push(c);
    }
    return c;
  }
  near(x, z) {
    return this.map.get(this._key(Math.floor(x / this.cell), Math.floor(z / this.cell))) || EMPTY;
  }
  // returns [top, bottom] if (x,z) is inside footprint (expanded by pad), else null
  span(c, x, z, pad) {
    if (c.off) return null;
    if (c.type === 'cyl') {
      const dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz > (c.r + pad) ** 2) return null;
      return [c.top, c.bottom];
    }
    if (c.type === 'ring') {
      const dx = x - c.x, dz = z - c.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > c.r1 + pad || d < c.r0 - pad) return null;
      return [c.top, c.bottom];
    }
    if (c.type === 'box') {
      const dx = x - c.x, dz = z - c.z;
      const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      if (Math.abs(lx) > c.hw + pad || Math.abs(lz) > c.hd + pad) return null;
      return [c.top, c.bottom];
    }
    if (c.type === 'ell') {
      const dx = x - c.x, dz = z - c.z;
      const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      const q = (lx / (c.rx + pad)) ** 2 + (lz / (c.rz + pad)) ** 2;
      if (q >= 1) return null;
      const s = Math.sqrt(1 - q) * c.ry;
      return [c.y + s, c.bottom !== undefined ? c.bottom : c.y - s];
    }
    if (c.type === 'seg') {
      const vx = c.bx - c.ax, vz = c.bz - c.az;
      const L2 = vx * vx + vz * vz;
      let t = L2 > 0 ? ((x - c.ax) * vx + (z - c.az) * vz) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = c.ax + vx * t - x, pz = c.az + vz * t - z;
      if (px * px + pz * pz > (c.w + pad) ** 2) return null;
      const top = c.ay + (c.by - c.ay) * t;
      return [top, top - c.thick];
    }
    return null;
  }
  // highest surface top at (x,z) that is <= maxY
  // skipTag: ignore colliders with this tag (enemies must never use tree trunks as steps)
  support(x, z, maxY, pad = 0.25, skipTag = null) {
    let best = -Infinity;
    for (const c of this.near(x, z)) {
      if (skipTag && c.tag === skipTag) continue;
      const s = this.span(c, x, z, pad);
      if (s && s[0] <= maxY && s[0] > best) best = s[0];
    }
    return best;
  }
  // a collider that blocks a body standing with feet at `feet`
  // solidTag: colliders with this tag block a body whenever its feet are below their top, however low that top is
  blocker(x, z, feet, step, pad = 0.35, solidTag = null) {
    let hit = null, hiTop = -Infinity;
    for (const c of this.near(x, z)) {
      const s = this.span(c, x, z, pad);
      if (!s) continue;
      const solid = solidTag && c.tag === solidTag && s[0] > feet - 0.2 && s[1] < feet + 1.2;
      if ((solid || (s[0] > feet + step && s[1] < feet + 1.2)) && s[0] > hiTop) { hit = c; hiTop = s[0]; }
    }
    return hit ? { c: hit, top: hiTop } : null;
  }
  // tallest top among colliders overlapping body height range
  topAt(x, z, feet, pad = 0.2) {
    let best = -Infinity;
    for (const c of this.near(x, z)) {
      const s = this.span(c, x, z, pad);
      if (s && s[1] < feet + 1.2 && s[0] > best) best = s[0];
    }
    return best;
  }
  // centre direction helper for climbing
  center(c) {
    if (c.type === 'cyl' || c.type === 'ell' || c.type === 'ring' || c.type === 'box') return [c.x, c.z];
    return null;
  }
}
const EMPTY = [];
