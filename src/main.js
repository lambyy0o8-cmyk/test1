import { Input } from './core/input.js';
import { Sfx, Settings } from './core/audio.js';
import { BLOCK_ID, BLOCK_BY_ID } from './blocks.js';
import { World } from './world/world.js';
import { Player } from './entities/player.js';
import { Enemy } from './entities/enemy.js';
import { Drop } from './entities/drop.js';
import { Projectile } from './entities/projectile.js';
import { getItem } from './items.js';
import { drawBackground, drawWorld, drawPlayer, drawEnemy, drawDrop, drawProjectile } from './systems/render.js';
import { UI } from './systems/ui.js';
import { CraftingSystem } from './systems/crafting.js';
import { SaveSystem } from './systems/save.js';
import { hashStr } from './core/prng.js';

const TS = 16; // tile size in "world px"

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input(canvas);
    this.crafting = new CraftingSystem();
    this.ui = null; // after world loads
    this.running = false;
    this.paused = false;
    this.state = 'menu';
    this.defeatedBosses = new Set();
    this.enemies = [];
    this.drops = [];
    this.projectiles = [];
    this.particles = [];
    this.hitNumbers = [];
    this.camera = { x: 0, y: 0, targetX: 0, targetY: 0, shake: 0 };
    this.lastTime = 0;
    this.acc = 0;
    this.fps = 60; this._fpsAcc = 0; this._fpsFrames = 0;
    this.weatherState = 'Clear';
    this.timeSecs = 0; // real seconds for day cycle (default 600 = 10 min full day)
    this.dayLength = 600;
    this.worldName = 'World';
    this.craftingStationNear = null;
    this.currentChest = null;
    this.boss = null;
    this.bossIntroTimer = 0;
    this.pendingGeneration = null;

    this.bindUI();
  }

  bindUI() {
    document.getElementById('btnNewWorld').addEventListener('click', () => {
      document.getElementById('menu').classList.add('hidden');
      document.getElementById('newWorld').classList.remove('hidden');
    });
    document.getElementById('btnCancelNew').addEventListener('click', () => {
      document.getElementById('newWorld').classList.add('hidden');
      document.getElementById('menu').classList.remove('hidden');
    });
    document.getElementById('btnCreate').addEventListener('click', () => this.createNewWorld());
    document.getElementById('btnPlay').addEventListener('click', () => this.loadOrPlay());
    document.getElementById('btnLoad').addEventListener('click', () => this.loadOrPlay());
    document.getElementById('btnSettings').addEventListener('click', () => { document.getElementById('settingsScreen').classList.remove('hidden'); document.getElementById('menu').classList.add('hidden'); });
    document.getElementById('btnSettingsClose').addEventListener('click', () => {
      document.getElementById('settingsScreen').classList.add('hidden');
      if (this.state === 'menu') document.getElementById('menu').classList.remove('hidden');
    });
    document.getElementById('btnResume').addEventListener('click', () => this.togglePause(false));
    document.getElementById('btnPauseSettings').addEventListener('click', () => document.getElementById('settingsScreen').classList.remove('hidden'));
    document.getElementById('btnSaveExit').addEventListener('click', () => { SaveSystem.save(this); location.reload(); });
    document.getElementById('btnRespawn').addEventListener('click', () => this.respawn());
    document.getElementById('btnVictoryOk').addEventListener('click', () => document.getElementById('victory').classList.add('hidden'));
    document.getElementById('btnCraft').addEventListener('click', () => this.ui.doCraft());

    // settings sliders
    const bind = (id, key, scale=1) => {
      const el = document.getElementById(id);
      el.value = (Settings[key] ?? 0.5) * (scale===100?100:1);
      el.addEventListener('input', () => { Settings[key] = parseFloat(el.value) / (scale===100?100:1); Settings.save(); this.applySettings(); });
    };
    bind('sMaster','master',100); bind('sMusic','music',100); bind('sSfx','sfx',100);
    bind('sPixel','pixelScale',1); bind('sShake','cameraShake',100); bind('sParticles','particles',100);
    this.applySettings();
  }

  applySettings() {
    document.getElementById('sMaster').value = Settings.master * 100;
    document.getElementById('sMusic').value = Settings.music * 100;
    document.getElementById('sSfx').value = Settings.sfx * 100;
    document.getElementById('sPixel').value = Settings.pixelScale;
    document.getElementById('sShake').value = Settings.cameraShake * 100;
    document.getElementById('sParticles').value = Settings.particles * 100;
  }

  sfx(name) { Sfx[name]?.(); }

  async createNewWorld() {
    const name = document.getElementById('wName').value || 'World';
    let seedStr = document.getElementById('wSeed').value.trim();
    if (!seedStr) seedStr = String(Math.floor(Math.random() * 1e9));
    const seed = hashStr(seedStr);
    const size = document.getElementById('wSize').value;
    const dims = { small:[512,256], medium:[1024,384], large:[2048,512] }[size];
    this.worldName = name;
    document.getElementById('newWorld').classList.add('hidden');
    document.getElementById('genScreen').classList.remove('hidden');
    document.getElementById('genBar').style.width = '0%';
    document.getElementById('genStep').textContent = 'Terrain';
    await new Promise(r => setTimeout(r, 50));

    const onProgress = (step, p) => {
      document.getElementById('genStep').textContent = step;
      document.getElementById('genBar').style.width = (p*100) + '%';
    };
    const world = World.generate(dims[0], dims[1], seed, onProgress);
    await new Promise(r => setTimeout(r, 80));
    document.getElementById('genScreen').classList.add('hidden');
    this.startGame(world);
  }

  loadOrPlay() {
    const data = SaveSystem.load();
    if (!data) {
      // start a quick new world
      document.getElementById('menu').classList.add('hidden');
      document.getElementById('newWorld').classList.remove('hidden');
      return;
    }
    // regenerate from seed then apply changes
    const world = World.generate(data.w, data.h, data.seed, () => {});
    world.time = data.time ?? 0.25;
    // apply changes
    for (const [x, y, v] of (data.changes || [])) {
      if (world.inBounds(x, y)) world.tiles[y*world.w + x] = v;
      world.chunkChanges[x+','+y] = v;
    }
    this.worldName = data.name;
    this.defeatedBosses = new Set(data.defeatedBosses || []);
    this.weatherState = data.weather || 'Clear';
    this.startGame(world, data.player);
  }

  startGame(world, playerData) {
    this.world = world;
    if (playerData) this.player = Player.deserialize(playerData);
    else this.player = new Player(world.spawnX, world.spawnY);
    this.player.spawnX = world.spawnX; this.player.spawnY = world.spawnY;
    this.ui = new UI(this);
    this.running = true;
    this.state = 'playing';
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('btnPlay').disabled = false;
    document.getElementById('btnLoad').disabled = !SaveSystem.has();
    // initial camera snap
    this.camera.x = this.player.x * TS - this.canvas.width / 2;
    this.camera.y = this.player.y * TS - this.canvas.height / 2;
    // spawn a few enemies to test
    this.spawnEnemy('slime', this.player.x + 8, this.player.y - 2);
    requestAnimationFrame((t) => this.loop(t));
  }

  timeString() {
    const t = this.world.time % 1;
    const hours = Math.floor(t * 24);
    const mins = Math.floor((t * 24 - hours) * 60);
    return `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
  }

  loop(t) {
    if (!this.running) return;
    const dtRaw = (t - this.lastTime) / 1000;
    this.lastTime = t;
    const dt = Math.min(0.05, dtRaw);

    // fps
    this._fpsAcc += dtRaw; this._fpsFrames++;
    if (this._fpsAcc >= 0.5) { this.fps = this._fpsFrames / this._fpsAcc; this._fpsAcc = 0; this._fpsFrames = 0; }

    if (!this.paused && this.state === 'playing') this.update(dt);
    this.render();

    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    const { player, world, input } = this;

    // time progression
    world.time = (world.time + dt / this.dayLength) % 1;
    this.timeSecs += dt;

    // hud keys
    if (input.wasPressed('Digit1')) player.selectedSlot = 0;
    if (input.wasPressed('Digit2')) player.selectedSlot = 1;
    if (input.wasPressed('Digit3')) player.selectedSlot = 2;
    if (input.wasPressed('Digit4')) player.selectedSlot = 3;
    if (input.wasPressed('Digit5')) player.selectedSlot = 4;
    if (input.wasPressed('Digit6')) player.selectedSlot = 5;
    if (input.wasPressed('Digit7')) player.selectedSlot = 6;
    if (input.wasPressed('Digit8')) player.selectedSlot = 7;
    if (input.wasPressed('Digit9')) player.selectedSlot = 8;
    if (input.wasPressed('Digit0')) player.selectedSlot = 9;
    if (input.wheel) { player.selectedSlot = (player.selectedSlot + input.wheel + 10) % 10; }

    // toggle inventory
    if (input.wasPressed('KeyE')) {
      if (this.ui.invScreen.classList.contains('hidden')) this.ui.invScreen.classList.remove('hidden');
      else this.ui.invScreen.classList.add('hidden');
    }
    if (input.wasPressed('Escape')) {
      if (this.ui.invScreen.classList.contains('hidden')) this.togglePause(true);
      else this.ui.invScreen.classList.add('hidden');
    }
    // debug
    if (input.wasPressed('F3')) this.ui.toggleDebug();

    if (this.paused) return;

    // update player
    player.update(dt, input, world);

    // get mouse in world coords
    const mx = input.mouse.x + this.camera.x;
    const my = input.mouse.y + this.camera.y;
    const tileX = Math.floor(mx / TS);
    const tileY = Math.floor(my / TS);
    input.mouse.wx = mx; input.mouse.wy = my;
    input.mouse.tileX = tileX; input.mouse.tileY = tileY;

    // mining (LMB) and placing (RMB)
    const reach = 6;
    const pr = Math.hypot(player.x + player.w/2 - (tileX+0.5), player.y + player.h/2 - (tileY+0.5));

    if (input.mouse.left && this.state === 'playing') {
      const sel = player.selectedDef;
      if (pr <= reach) {
        if (sel?.type === 'WEAPON') this.doAttack(tileX, tileY);
        else this.doMine(tileX, tileY, dt);
      }
    } else { this.miningTile = null; this.miningProgress = 0; }

    if (input.mouse.right && pr <= 8) this.doPlace(tileX, tileY);

    // interact (open chest, station, npc) — key F or right-click on chest
    if (input.wasPressed('KeyF')) {
      const b = world.getBlock(tileX, tileY);
      if (b && b.isChest) this.openChestAt(tileX, tileY);
      else if (b && b.station) this.ui.openCrafting(b.station);
    }
    // right click on block: place item OR open station
    if (input.mouse.rightPressed) {
      const b = world.getBlock(tileX, tileY);
      if (b && b.isChest) { this.openChestAt(tileX, tileY); input.mouse.rightPressed = false; }
      else if (b && b.station) { this.ui.openCrafting(b.station); input.mouse.rightPressed = false; }
    }

    // update enemies
    for (const e of this.enemies) e.update(dt, world, player, this);
    this.enemies = this.enemies.filter(e => !e.dead && Math.abs(e.x - player.x) < 200);

    // despawn far / update drops
    for (const d of this.drops) d.update(dt, world, player);
    this.drops = this.drops.filter(d => !d.dead);

    // projectiles
    for (const p of this.projectiles) p.update(dt, world, player, this.enemies, this);
    this.projectiles = this.projectiles.filter(p => !p.dead);

    // particles
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.gravity ?? 20) * dt; }
    this.particles = this.particles.filter(p => p.life > 0);

    // hit numbers
    for (const h of this.hitNumbers) { h.life -= dt; h.y -= 24 * dt; }
    this.hitNumbers = this.hitNumbers.filter(h => h.life > 0);

    // camera
    const targetCX = player.x * TS - this.canvas.width / 2 + player.w * TS / 2;
    const targetCY = player.y * TS - this.canvas.height / 2 + player.h * TS / 2;
    this.camera.x += (targetCX - this.camera.x) * Math.min(1, 8 * dt);
    this.camera.y += (targetCY - this.camera.y) * Math.min(1, 8 * dt);
    // clamp
    this.camera.x = Math.max(0, Math.min(world.w * TS - this.canvas.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(world.h * TS - this.canvas.height, this.camera.y));
    if (this.camera.shake > 0) this.camera.shake -= dt * 4;

    // ambient enemy spawn
    this.ambientSpawnTimer = (this.ambientSpawnTimer || 0) + dt;
    if (this.ambientSpawnTimer > 4) {
      this.ambientSpawnTimer = 0;
      this.ambientSpawn();
    }

    // weather random change
    if (Math.random() < dt * 0.01) this.weatherState = Math.random() < 0.3 ? 'Rain' : 'Clear';

    // player death
    if (player.dead && this.state !== 'dead') {
      this.state = 'dead';
      document.getElementById('death').classList.remove('hidden');
    }

    // boss bar update
    if (this.boss && !this.boss.dead) this.ui.showBossBar(this.boss.name, this.boss.hp, this.boss.maxHp);
    else if (this.boss && this.boss.dead) { this.ui.hideBossBar(); this.boss = null; }

    // HUD
    this.ui.refreshHUD();
    this.ui.refreshHotbar();

    // debug info
    if (!this.ui.debug.classList.contains('hidden')) {
      this.ui.updateDebug(`FPS: ${this.fps.toFixed(0)}\nEntities: ${this.enemies.length} + ${this.drops.length}\nPlayer: ${player.x.toFixed(1)}, ${player.y.toFixed(1)}\nBiome: ${world.biomeName(world.getBiome(player.x))}\nTime: ${this.timeString()}\nSeed: ${world.seed}\nParticles: ${this.particles.length}\nProjectiles: ${this.projectiles.length}`);
    }
  }

  doAttack(tx, ty) {
    const p = this.player;
    if (p.attackCd > 0) return;
    const sel = p.selectedDef;
    if (!sel) return;
    p.attackCd = (sel.useTime || 20) / 60;
    p.swordSwing = 0.25;

    if (sel.projectile) {
      // ranged
      if (sel.manaCost && p.mp < sel.manaCost) return;
      if (sel.manaCost) p.mp -= sel.manaCost;
      const dx = tx + 0.5 - (p.x + p.w/2);
      const dy = ty + 0.5 - (p.y + p.h/2);
      const d = Math.hypot(dx, dy) || 1;
      const speed = sel.projectile === 'magic' ? 14 : 16;
      this.spawnProjectile({
        x: p.x + p.w/2, y: p.y + p.h/2,
        vx: dx/d*speed, vy: dy/d*speed,
        damage: sel.damage, fromEnemy: false, life: 2,
        color: sel.projectile === 'magic' ? '#b28cf0' : '#c8b090', size: 0.4,
        gravity: sel.projectile === 'arrow' ? 8 : 0,
      });
      this.sfx(sel.projectile === 'magic' ? 'magic' : 'bow');
      return;
    }

    // melee: check enemies within reach arc
    const px = p.x + p.w/2, py = p.y + p.h/2;
    const ex = tx + 0.5, ey = ty + 0.5;
    const dir = Math.sign(ex - px) || p.facing;
    let hitAny = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ddx = (e.x + e.w/2) - px;
      const ddy = (e.y + e.h/2) - py;
      const d = Math.hypot(ddx, ddy);
      if (d < sel.reach / TS + 1) {
        if (Math.sign(ddx) === dir || Math.abs(ddx) < 0.6) {
          const kb = sel.knockback || 3;
          e.takeDamage(sel.damage, dir * kb, -kb * 0.5, this);
          this.spawnHitNumber(e.x + e.w/2, e.y, sel.damage);
          this.spawnParticles(e.x + e.w/2, e.y + e.h/2, 6, '#fff8d0');
          this.camera.shake = Math.min(1, this.camera.shake + 0.15) * Settings.cameraShake;
          this.sfx('hitEnemy');
          hitAny = true;
        }
      }
    }
    if (!hitAny) this.sfx('hit');
  }

  doMine(tx, ty, dt) {
    const b = this.world.getBlock(tx, ty);
    if (!b || !b.id || b.id === 0 || b.hardness >= 9999) { this.miningTile = null; return; }
    const p = this.player;
    const key = tx + ',' + ty;
    if (this.miningTile !== key) { this.miningTile = key; this.miningProgress = 0; }
    const sel = p.selectedDef;
    const toolMul = sel?.tool === b.tool ? (1 + (sel.power || 1) * 0.4) : 0.35;
    const speed = (1 / b.hardness) * toolMul * p.mineMul * 2.5;
    this.miningProgress += speed * dt;

    // spawn mining particles
    if (Math.random() < 0.5) this.spawnParticles(tx + 0.5, ty + 0.5, 1, b.colors?.[1] || '#888');
    this.sfx('hit');
    if (this.miningProgress >= 1) {
      // break
      const dropId = b.drop;
      this.world.setTile(tx, ty, 0);
      if (dropId) this.spawnDrop(tx + 0.5, ty + 0.5, dropId, 1);
      this.spawnParticles(tx + 0.5, ty + 0.5, 10, b.colors?.[0] || '#888');
      this.sfx('breakBlock');
      this.miningTile = null; this.miningProgress = 0;
    }
  }

  doPlace(tx, ty) {
    const p = this.player;
    const s = p.selectedItem;
    if (!s) return;
    const def = getItem(s.id);
    if (!def || def.type !== 'BLOCK') return;
    if (this.world.getTile(tx, ty) !== 0) return;
    // avoid placing on self
    if (tx >= p.x - 0.2 && tx < p.x + p.w + 0.2 && ty >= p.y - 0.2 && ty < p.y + p.h + 0.2) return;
    // must have at least one neighbor
    let hasNeighbor = false;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      if (this.world.getTile(tx+dx, ty+dy) !== 0) { hasNeighbor = true; break; }
    }
    if (!hasNeighbor) return;
    // place
    const bId = BLOCK_ID[def.block];
    if (bId === undefined) return;
    this.world.setTile(tx, ty, bId);
    p.inventory.remove(s.id, 1);
    this.sfx('place');
    this.ui.refreshHotbar();
    // if chest, initialize
    if (def.block === 'chest') this.world.chests[tx+','+ty] = new Array(20).fill(null);
  }

  openChestAt(tx, ty) {
    const key = tx + ',' + ty;
    if (!this.world.chests[key]) this.world.chests[key] = new Array(20).fill(null);
    this.ui.openChest(this.world.chests[key]);
  }

  spawnDrop(x, y, id, count) { this.drops.push(new Drop(x, y, id, count)); }
  spawnEnemy(kind, x, y) {
    const e = new Enemy(kind, x, y);
    this.enemies.push(e);
    if (e.isBoss) { this.boss = e; this.camera.shake = 1; this.sfx('bossWarn'); this.ui.showBossBar(e.name, e.hp, e.maxHp); }
    return e;
  }
  spawnProjectile(o) { this.projectiles.push(new Projectile(o)); }
  spawnHitNumber(x, y, n) { this.hitNumbers.push({ x, y, n, life: 0.9 }); }
  spawnParticles(x, y, n, color) {
    const real = Math.floor(n * Settings.particles);
    for (let i = 0; i < real; i++) {
      this.particles.push({
        x, y, vx: (Math.random()-0.5)*4, vy: -Math.random()*4,
        life: 0.5 + Math.random()*0.5, color, size: 1 + Math.random()*2, gravity: 20,
      });
    }
  }

  ambientSpawn() {
    const p = this.player;
    const w = this.world;
    const night = w.isNight();
    const biome = w.getBiome(p.x);
    const roll = Math.random();
    // far off-screen
    const dir = Math.random() < 0.5 ? -1 : 1;
    const sx = p.x + dir * (25 + Math.random() * 15);
    if (sx < 2 || sx > w.w - 2) return;
    const sy = w.surfaceH[Math.floor(sx)] - 2;
    if (this.enemies.length > 30) return;

    // biome spawn tables
    let pool = ['slime'];
    if (biome === 1) pool = ['slime','skeleton'];
    else if (biome === 2) pool = ['slime','bat'];
    else if (biome === 3) pool = ['slime','bat','demon'];
    else if (biome === 4) pool = ['zombie','skeleton','demon'];
    if (night) pool = pool.concat(['zombie','skeleton','demon']);

    // surface only during valid
    if (p.y < w.h * 0.5) {
      if (roll < (night ? 0.9 : 0.35)) {
        const kind = pool[Math.floor(Math.random()*pool.length)];
        this.spawnEnemy(kind, sx, sy);
      }
    } else {
      // underground: spawn in caves
      const kind = ['bat','skeleton','demon'][Math.floor(Math.random()*3)];
      this.spawnEnemy(kind, sx, p.y + (Math.random()-0.5)*10);
    }
  }

  onEnemyKilled(e) { /* could add score */ }

  onInfernalDefeated() {
    this.defeatedBosses.add('infernal');
    document.getElementById('victory').classList.remove('hidden');
  }

  respawn() {
    document.getElementById('death').classList.add('hidden');
    this.player.dead = false;
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this.player.x = this.world.spawnX;
    this.player.y = this.world.spawnY;
    this.player.vx = 0; this.player.vy = 0;
    this.player.invuln = 2;
    this.state = 'playing';
    this.enemies = [];
    this.projectiles = [];
    this.boss = null;
    this.ui.hideBossBar();
  }

  togglePause(on) {
    this.paused = on;
    document.getElementById('pause').classList.toggle('hidden', !on);
  }

  render() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // shake offset
    let sx = 0, sy = 0;
    if (this.camera.shake > 0) {
      const s = this.camera.shake * 8 * Settings.cameraShake;
      sx = (Math.random()-0.5) * s; sy = (Math.random()-0.5) * s;
    }

    const camera = { x: this.camera.x + sx, y: this.camera.y + sy };

    if (this.world) {
      drawBackground(ctx, camera, this.world, W, H);
      drawWorld(ctx, camera, this.world, W, H, TS);

      // drops
      const t = performance.now() / 1000;
      for (const d of this.drops) drawDrop(ctx, d, camera, TS, t);

      // enemies
      for (const e of this.enemies) drawEnemy(ctx, e, camera, TS);

      // player
      drawPlayer(ctx, this.player, camera, TS);

      // projectiles
      for (const p of this.projectiles) drawProjectile(ctx, p, camera, TS);

      // particles
      for (const p of this.particles) {
        ctx.fillStyle = p.color;
        const alpha = Math.min(1, p.life * 2);
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x*TS - camera.x - p.size/2, p.y*TS - camera.y - p.size/2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // hit numbers
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      for (const h of this.hitNumbers) {
        ctx.fillStyle = '#ffd070';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(h.n, h.x*TS - camera.x, h.y*TS - camera.y);
        ctx.fillText(h.n, h.x*TS - camera.x, h.y*TS - camera.y);
      }

      // tile cursor
      const inT = this.input.mouse.tileX, inTy = this.input.mouse.tileY;
      if (inT !== undefined) {
        const sel = this.player.selectedDef;
        const px = inT * TS - camera.x;
        const py = inTy * TS - camera.y;
        ctx.strokeStyle = (sel?.type === 'WEAPON') ? '#ff8080' : '#80ff80';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, TS, TS);
      }
    } else {
      // main menu bg animation
      drawMenuBackground(ctx, W, H, performance.now()/1000);
    }

    ctx.restore();
  }
}

function drawMenuBackground(ctx, W, H, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b1020');
  g.addColorStop(1, '#2a1f3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    const x = ((i * 97 + t * 20) % (W + 40)) - 20;
    const y = (i * 53) % (H * 0.7) + 30 + Math.sin(t + i) * 5;
    ctx.fillStyle = `rgba(255, 220, 150, ${0.3 + 0.3 * Math.sin(t * 2 + i)})`;
    ctx.fillRect(x, y, 2, 2);
  }
}

// canvas resize
const canvas = document.getElementById('game');
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// unlock audio on first click
window.addEventListener('pointerdown', () => Sfx.unlock(), { once: true });

const game = new Game(canvas);
window.game = game;
