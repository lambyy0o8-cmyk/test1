import { BLOCK_ID, BLOCK_BY_ID } from '../blocks.js';
import { generateWorld } from './worldgen.js';

const TILE = 16; // logical tile size

export class World {
  constructor(data) {
    Object.assign(this, data);
    this.tileSize = TILE;
    this.chunkChanges = {}; // keyed by "x,y" => true (for save later)
    this.chests = {}; // keyed by "x,y" => item array
    this.lights = new Map(); // keyed "x,y" => level (dirty computed lights)
    this.dirtyLight = true;
  }

  static generate(w, h, seed, onProgress) {
    const data = generateWorld(w, h, seed, onProgress);
    const world = new World(data);
    // find safe spawn: first surface column near center
    const cx = Math.floor(w / 2);
    let best = cx;
    for (let dx = 0; dx < 100; dx++) {
      if (world.getTile(cx+dx, world.surfaceH[cx+dx]-1) === 0 && world.getTile(cx+dx, world.surfaceH[cx+dx]-2) === 0) { best = cx+dx; break; }
      if (world.getTile(cx-dx, world.surfaceH[cx-dx]-1) === 0 && world.getTile(cx-dx, world.surfaceH[cx-dx]-2) === 0) { best = cx-dx; break; }
    }
    world.spawnX = best;
    world.spawnY = world.surfaceH[best] - 2;
    world.time = 0.25; // fraction of day [0..1), 0.25=morning, 0.5=noon, 0.75=evening, 0=midnight
    return world;
  }

  inBounds(x, y) { return x >= 0 && x < this.w && y >= 0 && y < this.h; }
  getTile(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.inBounds(x, y)) return x < 0 || x >= this.w ? BLOCK_ID.bedrock : 0;
    return this.tiles[y * this.w + x];
  }
  setTile(x, y, id) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.inBounds(x, y)) return false;
    this.tiles[y * this.w + x] = id;
    this.chunkChanges[x+','+y] = id;
    this.dirtyLight = true;
    return true;
  }
  getBlock(x, y) { return BLOCK_BY_ID[this.getTile(x,y)] || BLOCK_BY_ID[0]; }
  isSolid(x, y) { return this.getBlock(x,y).solid; }
  isTransparent(x, y) { return this.getBlock(x,y).transparent !== false; }

  // Get light at tile: 0..15. Very simple approximation: skylight + local lights
  getLight(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.inBounds(x, y)) return 0;
    // above-ground = day brightness (skylight)
    let skyLight = 0;
    if (y <= this.surfaceH[x]) skyLight = 15;
    else {
      // approximate: skylight blocked by depth, but caves near surface leak
      const d = y - this.surfaceH[x];
      skyLight = Math.max(0, 15 - d);
    }
    // day/night factor
    const dn = this.dayFactor();
    skyLight *= dn;
    // local lights: check nearby torch blocks (max radius 6)
    let best = skyLight;
    const R = 5;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const bx = x+dx, by = y+dy;
        if (!this.inBounds(bx, by)) continue;
        const b = BLOCK_BY_ID[this.tiles[by*this.w+bx]];
        if (b && b.light > 0) {
          const dist = Math.hypot(dx, dy);
          const lv = Math.max(0, b.light - dist);
          if (lv > best) best = lv;
        }
      }
    }
    return Math.min(15, best);
  }

  dayFactor() {
    // time: 0..1. 0=midnight, 0.25=morning, 0.5=noon, 0.75=evening
    const t = this.time % 1;
    if (t < 0.2) return 0.15;
    if (t < 0.28) return 0.15 + (t-0.2)/0.08 * 0.85;
    if (t < 0.7) return 1.0;
    if (t < 0.78) return 1.0 - (t-0.7)/0.08 * 0.85;
    return 0.15;
  }
  isNight() {
    const t = this.time % 1;
    return t < 0.22 || t > 0.78;
  }
  getBiome(x) {
    x = Math.floor(x);
    if (x < 0) x = 0; if (x >= this.w) x = this.w-1;
    return this.biomes[x];
  }
  biomeName(b) {
    return ['Forest','Desert','Snow','Jungle','Corruption'][b] || 'Unknown';
  }
  depthLayer(y) {
    if (y < this.h * 0.35) return 'Surface';
    if (y < this.h * 0.55) return 'Underground';
    if (y < this.h * 0.75) return 'Caverns';
    if (y < this.h * 0.92) return 'Deep Caverns';
    return 'Underworld';
  }
}
