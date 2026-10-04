export class Drop {
  constructor(x, y, itemId, count = 1) {
    this.x = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = -3 - Math.random() * 2;
    this.id = itemId; this.count = count;
    this.w = 0.4; this.h = 0.4;
    this.age = 0;
    this.pickupDelay = 0.4;
    this.dead = false;
    this.bob = Math.random() * Math.PI * 2;
  }
  update(dt, world, player) {
    this.age += dt;
    if (this.pickupDelay > 0) this.pickupDelay -= dt;
    this.vy += 24 * dt;
    if (this.vy > 18) this.vy = 18;

    // simple collide with world
    let nx = this.x + this.vx * dt;
    if (world.isSolid(nx, this.y)) { this.vx = -this.vx * 0.3; nx = this.x; }
    this.x = nx;
    let ny = this.y + this.vy * dt;
    if (world.isSolid(this.x, ny + this.h)) { this.vy = 0; this.grounded = true; ny = Math.floor(ny + this.h) - this.h - 0.001; }
    this.y = ny;
    if (this.grounded) this.vx *= 0.85;

    // pickup
    if (player && !player.dead && this.pickupDelay <= 0) {
      const dx = (player.x + player.w/2) - (this.x + this.w/2);
      const dy = (player.y + player.h/2) - (this.y + this.h/2);
      const d2 = dx*dx + dy*dy;
      if (d2 < 4) {
        // magnet
        const d = Math.sqrt(d2) || 1;
        this.x += dx/d * 8 * dt;
        this.y += dy/d * 8 * dt;
      }
      if (d2 < 0.6) {
        const got = player.inventory.add(this.id, this.count);
        if (got > 0) { this.count -= got; this.dead = true; }
      }
    }
  }
}
