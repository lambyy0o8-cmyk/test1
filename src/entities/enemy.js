import { sfx } from '../core/audio.js';

export const ENEMY_DEFS = {
  slime:   { name:'Slime',   hp:22,  damage:8,  speed:3.5, w:0.8, h:0.7, color:'#6ac0e8', ai:'bounce',    xp:3,  drops:[{id:'gel',min:1,max:2,p:1.0},{id:'bone',min:1,max:1,p:0.1}] },
  zombie:  { name:'Zombie',  hp:38,  damage:14, speed:2.2, w:0.7, h:1.7, color:'#6a8a5a', ai:'walk',      xp:6,  drops:[{id:'bone',min:1,max:2,p:0.6},{id:'gel',min:1,max:1,p:0.3}] },
  bat:     { name:'Bat',     hp:18,  damage:9,  speed:4.5, w:0.6, h:0.4, color:'#5a4a3a', ai:'fly',       xp:4,  drops:[{id:'bone',min:1,max:1,p:0.4}] },
  skeleton:{ name:'Skeleton',hp:45,  damage:11, speed:1.8, w:0.7, h:1.8, color:'#d8d0b8', ai:'shooter',   xp:9,  drops:[{id:'bone',min:1,max:3,p:1.0},{id:'ironOre',min:1,max:2,p:0.2}] },
  demon:   { name:'Demon',   hp:70,  damage:20, speed:3.8, w:0.9, h:1.8, color:'#c83a2a', ai:'fly',       xp:18, drops:[{id:'demonHorn',min:1,max:1,p:0.5},{id:'shadowShard',min:1,max:2,p:0.3}] },
  titan:   { name:'Underground Titan', hp:900, damage:28, speed:2.5, w:3.6, h:3.6, color:'#8a5aff', ai:'boss_titan', xp:200, boss:true, drops:[] },
  guardian:{ name:'Forest Guardian',   hp:600, damage:20, speed:2.4, w:3.0, h:3.0, color:'#4a8b3a', ai:'boss_guardian', xp:150, boss:true, drops:[] },
  infernal:{ name:'Infernal King',     hp:1600,damage:32, speed:3.0, w:3.4, h:3.4, color:'#ff4a2a', ai:'boss_infernal', xp:500, boss:true, drops:[] },
};

export class Enemy {
  constructor(kind, x, y) {
    const d = ENEMY_DEFS[kind];
    Object.assign(this, d);
    this.kind = kind;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.maxHp = d.hp; this.hp = d.hp;
    this.dead = false;
    this.hurt = 0;
    this.attackCd = 0;
    this.aiTimer = 0;
    this.facing = -1;
    this.onGround = false;
    this.phase = 1;
    this.attackPattern = 0;
    this.isBoss = !!d.boss;
    this.name = d.name;
  }

  update(dt, world, player, game) {
    if (this.dead) return;
    if (this.hurt > 0) this.hurt -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    this.aiTimer += dt;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    switch (this.ai) {
      case 'bounce': this.aiBounce(dt, world, player, dx, dist); break;
      case 'walk':   this.aiWalk(dt, world, player, dx, dist); break;
      case 'fly':    this.aiFly(dt, world, player, dx, dy, dist); break;
      case 'shooter':this.aiShooter(dt, world, player, dx, dy, dist, game); break;
      case 'boss_guardian': this.aiBossGuardian(dt, world, player, dx, dy, dist, game); break;
      case 'boss_titan':    this.aiBossTitan(dt, world, player, dx, dy, dist, game); break;
      case 'boss_infernal': this.aiBossInfernal(dt, world, player, dx, dy, dist, game); break;
    }

    // world collision (except flyers can pass
    if (this.ai !== 'fly' && !this.isBoss) {
      this.moveWithCollision(dt, world);
    } else if (this.isBoss && this.ai !== 'boss_titan') {
      this.moveWithCollision(dt, world);
    } else if (this.ai === 'boss_titan') {
      this.moveWithCollision(dt, world);
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    // contact damage
    if (!player.dead && this.attackCd <= 0 && Math.abs(this.x + this.w/2 - player.x - player.w/2) < (this.w+player.w)/2 && Math.abs(this.y + this.h/2 - player.y - player.h/2) < (this.h+player.h)/2) {
      player.takeDamage(this.damage, world);
      this.attackCd = 0.8;
      // knockback player
      const kb = Math.sign(player.x - this.x) * 8;
      player.vx += kb;
      player.vy = -4;
    }
  }

  aiBounce(dt, world, player, dx, dist) {
    if (this.onGround) {
      this.vx *= 0.9;
      if (this.aiTimer > 0.8 && dist < 30) {
        this.vx = Math.sign(dx) * this.speed * 1.4;
        this.vy = -8;
        this.onGround = false;
        this.aiTimer = 0;
      }
    }
  }
  aiWalk(dt, world, player, dx, dist) {
    if (dist < 40) this.vx = Math.sign(dx) * this.speed;
    else this.vx *= 0.9;
    // small jump if obstacle
    if (this.onGround && Math.abs(this.vx) > 0.2) {
      const ahead = Math.floor(this.x + Math.sign(this.vx) * 1.2);
      const feet = Math.floor(this.y + this.h + 0.2);
      if (world.isSolid(ahead, feet) && !world.isSolid(ahead, feet-1)) {
        this.vy = -8.5;
        this.onGround = false;
      }
    }
  }
  aiFly(dt, world, player, dx, dy, dist) {
    if (dist < 40) {
      const d = dist || 1;
      this.vx = (dx/d) * this.speed;
      this.vy = (dy/d) * this.speed + Math.sin(this.aiTimer*4)*1.5;
    } else { this.vx *= 0.9; this.vy *= 0.9; }
  }
  aiShooter(dt, world, player, dx, dy, dist, game) {
    if (dist < 25) this.vx = -Math.sign(dx) * this.speed;
    else if (dist > 35) this.vx = Math.sign(dx) * this.speed;
    else this.vx *= 0.9;
    if (this.attackCd <= 0 && dist < 40) {
      // spawn arrow
      game.spawnProjectile({
        x: this.x + this.w/2, y: this.y + 0.5,
        vx: dx / (dist||1) * 12, vy: dy / (dist||1) * 12,
        damage: 8, fromEnemy: true, life: 3, color:'#c8b090', size:0.4,
      });
      this.attackCd = 1.8;
    }
  }

  aiBossGuardian(dt, world, player, dx, dy, dist, game) {
    this.phase = this.hp / this.maxHp > 0.66 ? 1 : this.hp / this.maxHp > 0.33 ? 2 : 3;
    const spd = this.speed * (this.phase === 1 ? 1 : this.phase === 2 ? 1.5 : 1.8);
    if (dist < 40) this.vx = Math.sign(dx) * spd;
    if (this.onGround && Math.abs(dx) > 2 && Math.random() < 0.02) { this.vy = -11; this.onGround = false; }
    if (this.phase === 3 && this.attackCd <= 0 && Math.random() < 0.4) {
      // summon slime
      for (let i = 0; i < 2; i++) game.spawnEnemy('slime', this.x + (i?2:-2), this.y);
      this.attackCd = 2.5;
    }
    if (this.attackCd <= 0 && dist < 30 && Math.random() < 0.15) {
      // leap
      this.vx = Math.sign(dx) * 12;
      this.vy = -10;
      this.onGround = false;
      this.attackCd = 2;
    }
  }

  aiBossTitan(dt, world, player, dx, dy, dist, game) {
    this.phase = this.hp / this.maxHp > 0.5 ? 1 : 2;
    this.vx *= 0.95;
    this.vy += 18 * dt;
    if (this.onGround && this.attackCd <= 0) {
      if (this.attackPattern % 2 === 0) {
        // charge
        this.vx = Math.sign(dx) * 14;
        this.attackCd = 2.0;
      } else {
        // barrage of projectiles
        for (let i = 0; i < 8; i++) {
          const ang = -Math.PI + (i/7) * Math.PI;
          game.spawnProjectile({
            x: this.x + this.w/2, y: this.y + this.h/2,
            vx: Math.cos(ang) * 8, vy: Math.sin(ang) * 8 - 2,
            damage: 14, fromEnemy: true, life: 3, color:'#b28cf0', size:0.5, gravity: 6,
          });
        }
        this.attackCd = 2.4;
      }
      this.attackPattern++;
    }
    if (this.onGround && Math.abs(dx) < 30 && Math.random() < 0.03) this.vy = -12;
  }

  aiBossInfernal(dt, world, player, dx, dy, dist, game) {
    const r = this.hp / this.maxHp;
    this.phase = r > 0.7 ? 1 : r > 0.4 ? 2 : 3;
    this.vy += 12 * dt;
    if (this.aiTimer > 3) { this.aiTimer = 0; }
    // fly toward player at mid height
    const targetY = player.y - 4;
    this.vy += (targetY - this.y) * 0.6 * dt * 3;
    const spd = this.speed + (this.phase-1) * 1;
    if (dist < 50) this.vx += Math.sign(dx) * spd * dt * 3;
    this.vx *= 0.94; this.vy *= 0.94;
    if (this.attackCd <= 0) {
      const n = 4 + this.phase * 2;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + this.aiTimer;
        game.spawnProjectile({
          x: this.x + this.w/2, y: this.y + this.h/2,
          vx: Math.cos(ang) * 7, vy: Math.sin(ang) * 7,
          damage: 16, fromEnemy: true, life: 4, color:'#ff4a2a', size:0.6, gravity:0,
        });
      }
      if (this.phase >= 2 && Math.random() < 0.4) game.spawnEnemy('demon', this.x + 2, this.y);
      this.attackCd = 1.6 - this.phase * 0.15;
    }
  }

  moveWithCollision(dt, world) {
    this.vy += 24 * dt;
    if (this.vy > 20) this.vy = 20;
    let nx = this.x + this.vx * dt;
    if (this.collides(nx, this.y, world)) { this.vx = 0; } else this.x = nx;
    let ny = this.y + this.vy * dt;
    if (this.collides(this.x, ny, world)) {
      if (this.vy > 0) this.onGround = true;
      this.vy = 0;
    } else { this.y = ny; if (this.vy < 0) this.onGround = false; }
  }
  collides(px, py, world) {
    const x0 = Math.floor(px), x1 = Math.floor(px + this.w - 0.001);
    const y0 = Math.floor(py), y1 = Math.floor(py + this.h - 0.001);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (world.isSolid(x, y)) return true;
    return false;
  }

  takeDamage(amount, kbx, kby, game) {
    if (this.dead) return;
    this.hp -= amount;
    this.hurt = 0.15;
    this.vx += kbx;
    this.vy += kby;
    if (this.isBoss && Math.abs(this.vx) > 6) this.vx = Math.sign(this.vx) * 6;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.die(game); }
  }

  die(game) {
    sfx('enemyDie');
    if (this.isBoss) {
      // boss loot
      const lootTable = {
        guardian: ['bossCore', 'titanHeart', 'crystalOre', 'goldBar', 'healthPotion'],
        titan: ['titanHeart', 'crystalOre', 'goldBar', 'shadowShard', 'manaPotion'],
        infernal: ['infernalSigil', 'demonHorn', 'titanHeart', 'goldBar', 'healthPotion'],
      }[this.kind] || ['bone'];
      for (const id of lootTable) game.spawnDrop(this.x + Math.random()*this.w, this.y, id, 1 + Math.floor(Math.random()*2));
      if (this.kind === 'infernal') game.onInfernalDefeated && game.onInfernalDefeated();
    } else {
      // drops from loot table
      for (const d of this.drops) {
        if (Math.random() < d.p) {
          const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
          game.spawnDrop(this.x + Math.random()*this.w, this.y + this.h/2, d.id, n);
        }
      }
    }
    game.onEnemyKilled && game.onEnemyKilled(this);
  }
}
