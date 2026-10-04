import { BLOCK_BY_ID, BLOCK_ID } from '../blocks.js';
import { getItem } from '../items.js';

const TS = 16;

// Draw a whole tile as a solid color block with simple pixel pattern
export function drawTile(ctx, block, px, py, size, lightLevel, variant) {
  if (!block || !block.colors) return;
  const c = block.colors;
  ctx.fillStyle = c[0];
  ctx.fillRect(px, py, size, size);
  // simple pattern with 2 alternate colors
  const step = size / 4;
  ctx.fillStyle = c[1];
  for (let i = 0; i < 4; i++) {
    const cellX = px + ((i * 2 + variant) % 4) * step;
    const cellY = py + ((i * 3) % 4) * step;
    ctx.fillRect(cellX, cellY, step, step);
  }
  if (c[2]) {
    ctx.fillStyle = c[2];
    const cx = px + ((variant * 3) % 4) * step;
    const cy = py + ((variant * 5) % 4) * step;
    ctx.fillRect(cx, cy, step/2, step/2);
  }
  // light overlay
  if (lightLevel < 12) {
    ctx.fillStyle = `rgba(0,0,10,${(12 - lightLevel) / 12 * 0.85})`;
    ctx.fillRect(px, py, size, size);
  } else if (lightLevel > 12) {
    // slight warm glow for very bright
    ctx.fillStyle = `rgba(255,220,150,${(lightLevel - 12) / 6 * 0.15})`;
    ctx.fillRect(px, py, size, size);
  }
}

export function drawBackground(ctx, camera, world, W, H, time) {
  const dn = world.dayFactor();
  // sky gradient based on time
  const t = world.time % 1;
  // dawn / day / dusk / night blend
  const topColors = [
    [12, 8, 40],     // midnight
    [200, 120, 100], // dawn
    [110, 170, 230], // day
    [240, 130, 90],  // dusk
    [12, 8, 40],     // night
  ];
  const botColors = [
    [40, 20, 60],
    [255, 200, 150],
    [180, 220, 245],
    [255, 160, 100],
    [40, 20, 60],
  ];
  const tt = t < 0.2 ? 0 : t < 0.3 ? 1 : t < 0.7 ? 2 : t < 0.8 ? 3 : 4;
  const blend = (tt === 0 || tt === 4) ? 0 : 0;
  const topC = topColors[tt];
  const botC = botColors[tt];
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `rgb(${topC[0]},${topC[1]},${topC[2]})`);
  grad.addColorStop(1, `rgb(${botC[0]},${botC[1]},${botC[2]})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // stars at night
  if (dn < 0.5) {
    ctx.fillStyle = `rgba(255,255,255,${(0.5-dn)*2})`;
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 937 + world.seed) % (W * 3)) / 3 - camera.x * 0.1;
      const sy = ((i * 421) % (H * 0.5));
      const xx = ((sx % W) + W) % W;
      ctx.fillRect(xx, sy, 1.5, 1.5);
    }
  }

  // distant hills (parallax)
  ctx.fillStyle = 'rgba(20,30,50,0.55)';
  const px = -camera.x * 0.15;
  for (let i = 0; i < 10; i++) {
    const bx = ((px + i * 220) % (W + 400)) - 200;
    ctx.beginPath();
    ctx.moveTo(bx, H * 0.75);
    ctx.lineTo(bx + 110, H * 0.55);
    ctx.lineTo(bx + 220, H * 0.75);
    ctx.fill();
  }
}

export function drawWorld(ctx, camera, world, W, H, tileSize) {
  const ts = tileSize;
  const x0 = Math.max(0, Math.floor(camera.x / ts) - 1);
  const y0 = Math.max(0, Math.floor(camera.y / ts) - 1);
  const x1 = Math.min(world.w - 1, Math.ceil((camera.x + W) / ts));
  const y1 = Math.min(world.h - 1, Math.ceil((camera.y + H) / ts));
  let drawn = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const id = world.getTile(x, y);
      if (!id) continue;
      const b = BLOCK_BY_ID[id];
      if (!b) continue;
      const px = Math.round(x * ts - camera.x);
      const py = Math.round(y * ts - camera.y);
      const light = world.getLight(x, y);
      const variant = (x * 31 + y * 17) % 4;
      drawTile(ctx, b, px, py, ts, light, variant);
      drawn++;
    }
  }
  return drawn;
}

export function drawPlayer(ctx, player, camera, ts) {
  const px = Math.round(player.x * ts - camera.x);
  const py = Math.round(player.y * ts - camera.y);
  const w = Math.round(player.w * ts);
  const h = Math.round(player.h * ts);
  // flash if invuln
  if (player.invuln > 0 && Math.floor(player.invuln * 20) % 2) return;
  // body
  ctx.fillStyle = '#4a7fc8';
  ctx.fillRect(px, py + Math.round(h*0.3), w, Math.round(h*0.7));
  // head
  ctx.fillStyle = '#e8c090';
  ctx.fillRect(px + Math.round(w*0.1), py, Math.round(w*0.8), Math.round(h*0.35));
  // hair/hat
  ctx.fillStyle = '#3a2818';
  ctx.fillRect(px + Math.round(w*0.1), py, Math.round(w*0.8), Math.round(h*0.12));
  // eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(px + Math.round(w*0.28), py + Math.round(h*0.16), 1.5, 2);
  ctx.fillRect(px + Math.round(w*0.62), py + Math.round(h*0.16), 1.5, 2);
  // arms
  ctx.fillStyle = '#e8c090';
  ctx.fillRect(px - 2, py + Math.round(h*0.35), 2, Math.round(h*0.35));
  ctx.fillRect(px + w, py + Math.round(h*0.35), 2, Math.round(h*0.35));
  // sword swing indicator
  if (player.swordSwing > 0) {
    const swing = player.swordSwing;
    const reach = 34;
    ctx.save();
    ctx.translate(px + w/2, py + h/2);
    ctx.rotate((1 - swing) * Math.PI * 1.2 - Math.PI * 0.6);
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(0, -2, reach, 4);
    ctx.restore();
  }
  // name
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('You', px + w/2, py - 4);
}

export function drawEnemy(ctx, e, camera, ts) {
  const px = Math.round(e.x * ts - camera.x);
  const py = Math.round(e.y * ts - camera.y);
  const w = Math.round(e.w * ts);
  const h = Math.round(e.h * ts);
  ctx.fillStyle = e.hurt > 0 ? '#fff' : e.color;
  if (e.kind === 'slime') {
    ctx.fillRect(px, py + Math.round(h*0.3), w, Math.round(h*0.7));
    ctx.fillStyle = e.hurt > 0 ? '#fff' : '#8ad0f0';
    ctx.fillRect(px + Math.round(w*0.2), py + Math.round(h*0.15), Math.round(w*0.6), Math.round(h*0.3));
    // eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(px + w*0.3, py + h*0.45, 2, 2);
    ctx.fillRect(px + w*0.6, py + h*0.45, 2, 2);
  } else if (e.kind === 'bat') {
    ctx.fillRect(px, py, w, h);
    ctx.fillStyle = '#1a0f0a';
    ctx.fillRect(px - 2, py + 2, 3, h-4);
    ctx.fillRect(px + w - 1, py + 2, 3, h-4);
    ctx.fillStyle = '#f00';
    ctx.fillRect(px + 2, py + 2, 2, 2);
    ctx.fillRect(px + w - 4, py + 2, 2, 2);
  } else if (e.isBoss) {
    // boss shape
    ctx.fillStyle = e.hurt > 0 ? '#fff' : e.color;
    ctx.fillRect(px, py, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(px + w*0.25, py + h*0.3, w*0.15, h*0.15);
    ctx.fillRect(px + w*0.6, py + h*0.3, w*0.15, h*0.15);
    ctx.fillStyle = '#f00';
    ctx.fillRect(px + w*0.3, py + h*0.32, w*0.05, h*0.08);
    ctx.fillRect(px + w*0.65, py + h*0.32, w*0.05, h*0.08);
    ctx.fillStyle = '#000';
    ctx.fillRect(px + w*0.3, py + h*0.6, w*0.4, h*0.1);
  } else {
    ctx.fillRect(px, py, w, h);
    // eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(px + w*0.25, py + h*0.15, 2, 3);
    ctx.fillRect(px + w*0.65, py + h*0.15, 2, 3);
  }
  // hp bar (if damaged, non-boss)
  if (!e.isBoss && e.hp < e.maxHp) {
    const bw = w, bh = 2;
    const bxx = px, byy = py - 5;
    ctx.fillStyle = '#000';
    ctx.fillRect(bxx-1, byy-1, bw+2, bh+2);
    ctx.fillStyle = '#e53e3e';
    ctx.fillRect(bxx, byy, bw * (e.hp/e.maxHp), bh);
  }
}

export function drawItemIcon(ctx, itemId, x, y, size) {
  const def = getItem(itemId);
  if (!def) return;
  ctx.fillStyle = def.color || '#888';
  // shape by type
  if (def.type === 'TOOL' || def.type === 'WEAPON') {
    // small diagonal rectangle (stick + head)
    ctx.fillRect(x + size*0.15, y + size*0.55, size*0.7, size*0.15);
    ctx.fillStyle = def.type === 'WEAPON' ? '#e8e8f0' : (def.color);
    ctx.fillRect(x + size*0.5, y + size*0.15, size*0.35, size*0.55);
  } else if (def.type === 'CONSUMABLE') {
    // bottle
    ctx.fillRect(x + size*0.3, y + size*0.3, size*0.4, size*0.6);
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(x + size*0.35, y + size*0.15, size*0.3, size*0.2);
  } else if (def.type === 'BLOCK' || def.type === 'MATERIAL') {
    // square with inner detail
    ctx.fillRect(x + size*0.15, y + size*0.15, size*0.7, size*0.7);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + size*0.15, y + size*0.6, size*0.7, size*0.25);
  } else {
    ctx.fillRect(x + size*0.2, y + size*0.2, size*0.6, size*0.6);
  }
}

export function drawProjectile(ctx, p, camera, ts) {
  const px = Math.round(p.x * ts - camera.x);
  const py = Math.round(p.y * ts - camera.y);
  const r = Math.round(p.size * ts / 2);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(px-1, py-1, r*0.5, 0, Math.PI*2);
  ctx.fill();
}

export function drawDrop(ctx, drop, camera, ts, t) {
  const px = Math.round(drop.x * ts - camera.x);
  const py = Math.round(drop.y * ts - camera.y + Math.sin(t*4 + drop.bob) * 2);
  const size = Math.round(drop.w * ts);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(px-1, py-1, size+2, size+2);
  drawItemIcon(ctx, drop.id, px, py, size);
}
