export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function valueNoise1D(rng, len, scale) {
  const pts = Math.ceil(len / scale) + 3;
  const arr = new Float32Array(pts);
  for (let i = 0; i < pts; i++) arr[i] = rng();
  return (x) => {
    const p = x / scale;
    const i = Math.floor(p);
    const t = p - i;
    const a = arr[i] ?? 0, b = arr[i + 1] ?? a;
    const s = t * t * (3 - 2 * t);
    return a + (b - a) * s;
  };
}

export function valueNoise2D(rng, w, h, scale) {
  const gw = Math.ceil(w / scale) + 3, gh = Math.ceil(h / scale) + 3;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  return (x, y) => {
    const px = x / scale, py = y / scale;
    const ix = Math.floor(px), iy = Math.floor(py);
    const tx = px - ix, ty = py - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const g00 = g[iy * gw + ix] ?? 0;
    const g10 = g[iy * gw + ix + 1] ?? g00;
    const g01 = g[(iy + 1) * gw + ix] ?? g00;
    const g11 = g[(iy + 1) * gw + ix + 1] ?? g01;
    const a = g00 + (g10 - g00) * sx;
    const b = g01 + (g11 - g01) * sx;
    return a + (b - a) * sy;
  };
}
