import { BLOCK_ID } from '../blocks.js';
import { Inventory } from '../systems/inventory.js';
import { sfx } from '../core/audio.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.w = 0.7; this.h = 1.8; // tiles
    this.grounded = false;
    this.facing = 1;
    this.hp = 100; this.maxHp = 100;
    this.mp = 100; this.maxMp = 100;
    this.mpRegen = 6;
    this.invuln = 0;
    this.attackCd = 0;
    this.useCd = 0;
    this.selectedSlot = 0;
    this.inventory = new Inventory(40);
    this.accessories = [null, null, null]; // 3 acc slots
    this.speedMul = 1;
    this.mineMul = 1;
    this.dead = false;
    this.spawnX = x; this.spawnY = y;
    this.animTime = 0;
    this.swordSwing = 0;
    // starting kit
    this.inventory.add('woodPickaxe', 1);
    this.inventory.add('woodSword', 1);
    this.inventory.add('torch', 20);
    this.inventory.add('wood', 30);
  }

  applyAccessoryBonuses() {
    this.speedMul = 1; this.mineMul = 1;
    let bonusHp = 0;
    for (const a of this.accessories) {
      if (!a) continue;
      const def = require_item(a.id);
      if (!def || !def.bonus) continue;
      if (def.bonus.speed) this.speedMul *= def.bonus.speed;
      if (def.bonus.mine) this.mineMul *= def.bonus.mine;
      if (def.bonus.maxHp) bonusHp += def.bonus.maxHp;
    }
    const newMax = 100 + bonusHp;
    if (newMax !== this.maxHp) {
      const ratio = this.hp / this.maxHp;
      this.maxHp = newMax;
      this.hp = Math.min(this.maxHp, Math.round(this.maxHp * ratio));
    }
  }

  update(dt, input, world) {
    if (this.dead) return;
    this.animTime += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.useCd > 0) this.useCd -= dt;
    if (this.swordSwing > 0) this.swordSwing -= dt;
    this.mp = Math.min(this.maxMp, this.mp + this.mpRegen * dt);

    const speed = 6.5 * this.speedMul;
    const acc = 55;
    const fric = this.grounded ? 32 : 8;

    let moveX = 0;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) moveX -= 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) moveX += 1;
    if (moveX !== 0) this.facing = moveX;

    const targetVx = moveX * speed;
    if (moveX !== 0) {
      this.vx += Math.sign(targetVx - this.vx) * acc * dt;
      if (Math.abs(this.vx) > speed) this.vx = targetVx;
    } else {
      if (Math.abs(this.vx) > fric * dt) this.vx -= Math.sign(this.vx) * fric * dt;
      else this.vx = 0;
    }

    // jump
    if ((input.wasPressed('Space') || input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) && this.grounded) {
      this.vy = -11.5;
      this.grounded = false;
      sfx('jump');
    }

    // gravity
    this.vy += 32 * dt;
    if (this.vy > 28) this.vy = 28;

    this.moveAndCollide(dt, world);

    // void / lava damage
    const inTile = world.getBlock(this.x + this.w/2, this.y + this.h/2);
    if (inTile && inTile.damage) {
      this.takeDamage(inTile.damage * dt * 3, world);
    }
  }

  moveAndCollide(dt, world) {
    // X axis
    let nx = this.x + this.vx * dt;
    if (this.collides(nx, this.y, world)) {
      // step small
      const s = Math.sign(this.vx) * 0.01;
      while (!this.collides(nx, this.y, world) && Math.abs(nx - this.x) < 0.5) nx += s;
      this.vx = 0;
    } else this.x = nx;

    // Y axis
    let ny = this.y + this.vy * dt;
    if (this.collides(this.x, ny, world)) {
      if (this.vy > 0) { this.grounded = true; }
      this.vy = 0;
    } else {
      this.y = ny;
      if (this.vy < 0) this.grounded = false;
      else if (this.vy > 0.05) this.grounded = false;
    }
    // clamp
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.w > world.w) { this.x = world.w - this.w; this.vx = 0; }
    if (this.y + this.h > world.h) { this.y = world.h - this.h; this.vy = 0; this.grounded = true; }
  }

  collides(px, py, world) {
    const x0 = Math.floor(px), x1 = Math.floor(px + this.w - 0.001);
    const y0 = Math.floor(py), y1 = Math.floor(py + this.h - 0.001);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (world.isSolid(x, y)) return true;
      }
    }
    return false;
  }

  takeDamage(amount, world) {
    if (this.invuln > 0 || this.dead) return;
    this.hp -= amount;
    this.invuln = 0.7;
    sfx('hurt');
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
  addMana(n) { this.mp = Math.min(this.maxMp, this.mp + n); }

  get selectedItem() { return this.inventory.slots[this.selectedSlot]; }
  get selectedDef() { const s = this.selectedItem; return s ? require_item(s.id) : null; }

  serialize() {
    return {
      x: this.x, y: this.y, hp: this.hp, maxHp: this.maxHp, mp: this.mp, maxMp: this.maxMp,
      inventory: this.inventory.serialize(),
      accessories: this.accessories.map(a => a ? {id:a.id} : null),
      selectedSlot: this.selectedSlot,
      spawnX: this.spawnX, spawnY: this.spawnY,
    };
  }
  static deserialize(d) {
    const p = new Player(d.x, d.y);
    p.hp = d.hp; p.maxHp = d.maxHp; p.mp = d.mp; p.maxMp = d.maxMp;
    p.inventory = Inventory.deserialize(d.inventory);
    p.accessories = (d.accessories || [null,null,null]).map(a => a ? {id:a.id} : null);
    p.selectedSlot = d.selectedSlot || 0;
    p.spawnX = d.spawnX ?? d.x; p.spawnY = d.spawnY ?? d.y;
    p.applyAccessoryBonuses();
    return p;
  }
}

// small helper to avoid circular import
import { getItem } from '../items.js';
function require_item(id) { return getItem(id); }
