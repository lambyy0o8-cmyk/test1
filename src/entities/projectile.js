export class Projectile {
  constructor(o) {
    Object.assign(this, { x:0, y:0, vx:0, vy:0, damage:5, fromEnemy:false, life:3, color:'#fff', size:0.3, gravity:0 }, o);
    this.dead = false;
  }
  update(dt, world, player, enemies, game) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // collide with world
    if (world.isSolid(this.x, this.y)) { this.dead = true; return; }
    // collide with entities
    if (this.fromEnemy) {
      if (!player.dead && Math.abs(this.x - (player.x+player.w/2)) < (player.w/2+0.3) && Math.abs(this.y - (player.y+player.h/2)) < (player.h/2+0.3)) {
        player.takeDamage(this.damage, world);
        this.dead = true;
      }
    } else {
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.abs(this.x - (e.x+e.w/2)) < (e.w/2+0.3) && Math.abs(this.y - (e.y+e.h/2)) < (e.h/2+0.3)) {
          e.takeDamage(this.damage, Math.sign(this.vx)*2, -2, game);
          game.spawnHitNumber(this.x, this.y, Math.round(this.damage));
          this.dead = true;
          return;
        }
      }
    }
  }
}
