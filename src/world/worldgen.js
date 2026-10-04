import { makeRng, valueNoise1D, valueNoise2D } from '../core/prng.js';
import { BLOCK_ID } from '../blocks.js';

export function generateWorld(w, h, seed, onProgress = () => {}) {
  const rng = makeRng(seed);
  const tiles = new Uint8Array(w * h);
  const surfaceH = new Int16Array(w);

  onProgress('Terrain', 0.05);
  const n1 = valueNoise1D(rng, w, 130);
  const n2 = valueNoise1D(rng, w, 45);
  const n3 = valueNoise1D(rng, w, 15);
  const baseY = Math.floor(h * 0.32);

  onProgress('Biomes', 0.15);
  const bTemp = valueNoise1D(rng, w, 220);
  const bHum  = valueNoise1D(rng, w, 260);
  const biomes = new Uint8Array(w);
  for (let x = 0; x < w; x++) {
    const t = bTemp(x), hu = bHum(x);
    let b = 0;
    if (t > 0.68 && hu < 0.45) b = 1;         // desert
    else if (t < 0.32) b = 2;                  // snow
    else if (hu > 0.72) b = 3;                 // jungle
    else if (t > 0.48 && hu > 0.5) b = 4;      // corruption
    biomes[x] = b;
  }

  for (let x = 0; x < w; x++) {
    const nv = n1(x)*0.6 + n2(x)*0.3 + n3(x)*0.1;
    surfaceH[x] = Math.floor(baseY + (nv - 0.5) * 70);
    if (surfaceH[x] < 10) surfaceH[x] = 10;
    if (surfaceH[x] > baseY + 40) surfaceH[x] = baseY + 40;
  }

  onProgress('Terrain', 0.25);
  const bId = {0:BLOCK_ID.grass, 1:BLOCK_ID.sand, 2:BLOCK_ID.snow, 3:BLOCK_ID.grass, 4:BLOCK_ID.grass};
  const dirtDepth = 5;
  for (let x = 0; x < w; x++) {
    const sh = surfaceH[x];
    const biome = biomes[x];
    for (let y = sh; y < h; y++) {
      let id;
      if (y === sh) id = bId[biome];
      else if (y < sh + dirtDepth) id = biome===1?BLOCK_ID.sand:biome===2?BLOCK_ID.snow:BLOCK_ID.dirt;
      else id = BLOCK_ID.stone;
      tiles[y*w+x] = id;
    }
  }

  onProgress('Caves', 0.4);
  const caveN = valueNoise2D(rng, w, h, 30);
  const caveN2 = valueNoise2D(rng, w, h, 13);
  for (let x = 0; x < w; x++) {
    const sh = surfaceH[x];
    for (let y = sh + 6; y < h - 3; y++) {
      const depth = (y - sh) / Math.max(1, h - sh);
      const v = caveN(x,y)*0.6 + caveN2(x,y)*0.4;
      const threshold = 0.74 - depth * 0.28;
      if (v > threshold) tiles[y*w+x] = BLOCK_ID.air;
    }
  }

  // big cavern rooms
  const roomCount = Math.floor(w * h / 40000);
  for (let i = 0; i < roomCount; i++) {
    const cx = Math.floor(rng()*w);
    const sh = surfaceH[cx];
    const cy = Math.floor(sh + 30 + rng() * (h - sh - 50));
    const rad = 6 + Math.floor(rng()*10);
    for (let y = cy-rad; y <= cy+rad; y++) {
      if (y < 0 || y >= h) continue;
      for (let x = cx-rad; x <= cx+rad; x++) {
        if (x < 0 || x >= w) continue;
        const dx = x-cx, dy = y-cy;
        if (dx*dx + dy*dy < rad*rad) tiles[y*w+x] = BLOCK_ID.air;
      }
    }
  }

  onProgress('Resources', 0.6);
  // ore veins
  const ores = [
    { id:BLOCK_ID.copperOre,  min:8,  max:h-1, count: Math.floor(w*0.4), size:[2,4] },
    { id:BLOCK_ID.ironOre,    min:20, max:h-1, count: Math.floor(w*0.3), size:[2,4] },
    { id:BLOCK_ID.goldOre,    min:60, max:h-1, count: Math.floor(w*0.15), size:[2,3] },
    { id:BLOCK_ID.crystalOre, min:90, max:h-1, count: Math.floor(w*0.1),  size:[1,3] },
    { id:BLOCK_ID.obsidian,   min:120,max:h-1, count: Math.floor(w*0.06), size:[2,4] },
  ];
  for (const o of ores) {
    for (let i = 0; i < o.count; i++) {
      const x = Math.floor(rng()*w);
      const sh = surfaceH[x];
      const ymin = Math.max(sh + o.min, 0);
      const ymax = Math.min(o.max, h-1);
      if (ymin >= ymax) continue;
      const y = Math.floor(ymin + rng()*(ymax-ymin));
      const sz = o.size[0] + Math.floor(rng()*(o.size[1]-o.size[0]+1));
      for (let j = 0; j < sz; j++) {
        const ox = x + Math.floor((rng()-0.5)*4);
        const oy = y + Math.floor((rng()-0.5)*4);
        if (ox>=0 && ox<w && oy>=0 && oy<h && tiles[oy*w+ox] === BLOCK_ID.stone) tiles[oy*w+ox] = o.id;
      }
    }
  }

  onProgress('Underworld', 0.7);
  // lava at bottom
  const lavaStart = h - 20;
  for (let x = 0; x < w; x++) {
    for (let y = lavaStart; y < h; y++) {
      if (tiles[y*w+x] === BLOCK_ID.air) tiles[y*w+x] = BLOCK_ID.lava;
      else if (y >= h - 3) tiles[y*w+x] = BLOCK_ID.obsidian;
    }
  }
  // bedrock bottom row
  for (let x = 0; x < w; x++) tiles[(h-1)*w+x] = BLOCK_ID.bedrock;

  onProgress('Trees', 0.8);
  // trees
  for (let x = 3; x < w-3; x++) {
    const sh = surfaceH[x];
    const biome = biomes[x];
    if (biome !== 0 && biome !== 3 && biome !== 4) continue;
    if (tiles[sh*w+x] !== BLOCK_ID.grass) continue;
    if (rng() < 0.12) {
      const treeH = 4 + Math.floor(rng()*4);
      for (let i = 1; i <= treeH; i++) {
        if (sh - i >= 0) tiles[(sh-i)*w+x] = BLOCK_ID.wood;
      }
      const topY = sh - treeH;
      const leafR = 2;
      for (let dy = -leafR; dy <= leafR; dy++) {
        for (let dx = -leafR; dx <= leafR; dx++) {
          if (dx*dx+dy*dy > leafR*leafR+1) continue;
          const lx = x+dx, ly = topY+dy;
          if (lx>=0 && lx<w && ly>=0 && ly<h && tiles[ly*w+lx]===BLOCK_ID.air) tiles[ly*w+lx]=BLOCK_ID.leaves;
        }
      }
    }
  }

  onProgress('Complete', 1.0);
  return { tiles, w, h, surfaceH, biomes, seed };
}
