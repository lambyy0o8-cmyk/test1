import { getItem, RARITY } from '../items.js';
import { drawItemIcon } from './render.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.hpBar = document.querySelector('#hpBar>div');
    this.hpText = document.getElementById('hpText');
    this.mpBar = document.querySelector('#mpBar>div');
    this.mpText = document.getElementById('mpText');
    this.hotbar = document.getElementById('hotbar');
    this.info = document.getElementById('info');
    this.tooltip = document.getElementById('tooltip');
    this.toast = document.getElementById('toast');
    this.debug = document.getElementById('debug');
    this.bossBar = document.getElementById('bossBar');
    this.bossBarFill = document.querySelector('#bossBar .bbar>div');
    this.bossBarName = document.querySelector('#bossBar .bname');
    this.invScreen = document.getElementById('invScreen');
    this.invGrid = document.getElementById('invGrid');
    this.craftScreen = document.getElementById('craftScreen');
    this.craftList = document.getElementById('craftList');
    this.craftDetail = document.getElementById('craftDetail');
    this.btnCraft = document.getElementById('btnCraft');
    this.chestScreen = document.getElementById('chestScreen');
    this.chestGrid = document.getElementById('chestGrid');
    this.chestInvGrid = document.getElementById('chestInvGrid');
    this.settingsScreen = document.getElementById('settingsScreen');
    this.death = document.getElementById('death');
    this.victory = document.getElementById('victory');
    this.pause = document.getElementById('pause');
    this.menu = document.getElementById('menu');
    this.selectedRecipe = null;
    this.craftingStationNear = null;
    this.invHolding = null;
    this.buildHotbar();
    this.buildInventory();
  }

  buildHotbar() {
    this.hotbar.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML = `<span class="num">${(i+1)%10}</span><canvas width="32" height="32"></canvas><span class="count"></span>`;
      el.addEventListener('click', () => { this.game.player.selectedSlot = i; this.refreshHotbar(); });
      el.addEventListener('mouseenter', (e) => this.showItemTooltip(this.game.player.inventory.slots[i], e));
      el.addEventListener('mouseleave', () => this.hideTooltip());
      this.hotbar.appendChild(el);
    }
  }

  buildInventory() {
    this.invGrid.innerHTML = '';
    for (let i = 0; i < 40; i++) {
      const el = document.createElement('div');
      el.className = 'invSlot';
      el.dataset.idx = i;
      el.innerHTML = `<canvas width="32" height="32"></canvas><span class="count"></span>`;
      el.addEventListener('mousedown', (e) => { e.preventDefault(); this.onInvClick(i, e.button); });
      el.addEventListener('mouseenter', (e) => this.showItemTooltip(this.game.player.inventory.slots[i], e));
      el.addEventListener('mouseleave', () => this.hideTooltip());
      this.invGrid.appendChild(el);
    }
  }

  onInvClick(i, button) {
    const inv = this.game.player.inventory;
    if (button === 2) {
      // right click: split / place one
      if (this.invHolding) {
        // place one in this slot
        const s = inv.slots[i];
        if (!s) { inv.slots[i] = { id: this.invHolding.id, count: 1 }; this.invHolding.count--; if (this.invHolding.count <= 0) this.invHolding = null; }
        else if (s.id === this.invHolding.id) { s.count++; this.invHolding.count--; if (this.invHolding.count <= 0) this.invHolding = null; }
      } else {
        const s = inv.slots[i];
        if (s && s.count > 1) {
          const half = Math.floor(s.count / 2);
          this.invHolding = { id: s.id, count: half };
          s.count -= half;
        } else if (s) {
          this.invHolding = { ...s };
          inv.slots[i] = null;
        }
      }
    } else {
      if (this.invHolding) {
        const s = inv.slots[i];
        if (!s) { inv.slots[i] = this.invHolding; this.invHolding = null; }
        else if (s.id === this.invHolding.id && s.count + this.invHolding.count <= (getItem(s.id)?.stack || 1)) {
          s.count += this.invHolding.count; this.invHolding = null;
        } else {
          const t = inv.slots[i]; inv.slots[i] = this.invHolding; this.invHolding = t;
        }
      } else {
        const s = inv.slots[i];
        if (s) { this.invHolding = s; inv.slots[i] = null; }
      }
    }
    this.refreshAll();
  }

  refreshAll() { this.refreshHotbar(); this.refreshInventory(); }

  refreshHotbar() {
    const inv = this.game.player.inventory;
    const slots = this.hotbar.children;
    for (let i = 0; i < 10; i++) {
      const el = slots[i];
      el.classList.toggle('selected', i === this.game.player.selectedSlot);
      const s = inv.slots[i];
      const canvas = el.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 32, 32);
      if (s) drawItemIcon(ctx, s.id, 0, 0, 32);
      const count = el.querySelector('.count');
      count.textContent = s && s.count > 1 ? s.count : '';
    }
  }

  refreshInventory() {
    const inv = this.game.player.inventory;
    for (let i = 0; i < 40; i++) {
      const el = this.invGrid.children[i];
      const s = inv.slots[i];
      const canvas = el.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 32, 32);
      if (s) drawItemIcon(ctx, s.id, 0, 0, 32);
      el.querySelector('.count').textContent = s && s.count > 1 ? s.count : '';
    }
  }

  refreshHUD() {
    const p = this.game.player;
    const hp = Math.max(0, Math.round(p.hp));
    this.hpBar.style.width = (p.hp / p.maxHp * 100) + '%';
    this.hpText.textContent = `${hp} / ${p.maxHp}`;
    this.mpBar.style.width = (p.mp / p.maxMp * 100) + '%';
    this.mpText.textContent = `${Math.round(p.mp)} / ${p.maxMp}`;

    const w = this.game.world;
    if (w) {
      const timeStr = this.game.timeString();
      const biome = w.biomeName(w.getBiome(p.x));
      const depth = w.depthLayer(p.y);
      this.info.innerHTML = `<b>${timeStr}</b><br>${biome} · ${depth}<br>${this.game.weatherState || 'Clear'}`;
    }
  }

  showItemTooltip(item, e) {
    if (!item) { this.hideTooltip(); return; }
    const def = getItem(item.id);
    if (!def) return;
    const rar = RARITY[def.rarity || 'common'];
    let html = `<div class="title ${rar.cls}">${def.name}</div>`;
    if (def.damage) html += `<div class="stat">Damage: ${def.damage}</div>`;
    if (def.tool) html += `<div class="stat">${def.tool[0].toUpperCase()+def.tool.slice(1)} Power: ${def.power}</div>`;
    if (def.heal) html += `<div class="stat">Heals ${def.heal} HP</div>`;
    if (def.mana) html += `<div class="stat">Restores ${def.mana} Mana</div>`;
    if (def.manaCost) html += `<div class="stat">Mana Cost: ${def.manaCost}</div>`;
    if (def.bonus) html += `<div class="stat">${Object.entries(def.bonus).map(([k,v])=>`${k}: ${v}`).join(', ')}</div>`;
    if (def.desc) html += `<div class="desc">${def.desc}</div>`;
    html += `<div class="stat" style="margin-top:6px;color:${rar.color}">${rar.name}</div>`;
    this.tooltip.innerHTML = html;
    this.tooltip.classList.remove('hidden');
    const rect = this.tooltip.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - 14;
    if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 14;
    this.tooltip.style.left = x + 'px';
    this.tooltip.style.top = y + 'px';
  }
  hideTooltip() { this.tooltip.classList.add('hidden'); }

  showToast(msg) {
    const el = document.createElement('div');
    el.className = 'toastMsg';
    el.textContent = msg;
    this.toast.appendChild(el);
    setTimeout(() => el.remove(), 2100);
  }

  showBossBar(name, hp, maxHp) {
    this.bossBar.classList.remove('hidden');
    this.bossBarName.textContent = name;
    this.bossBarFill.style.width = (hp/maxHp*100) + '%';
  }
  hideBossBar() { this.bossBar.classList.add('hidden'); }

  openCrafting(station) {
    this.craftingStationNear = station;
    this.craftScreen.classList.remove('hidden');
    this.refreshCraftList();
  }
  closeCrafting() { this.craftScreen.classList.add('hidden'); this.selectedRecipe = null; }

  refreshCraftList() {
    const list = this.game.crafting.availableRecipes(this.game.player, this.craftingStationNear);
    this.craftList.innerHTML = '';
    list.forEach((r, i) => {
      const row = document.createElement('div');
      const can = this.game.crafting.canCraft(this.game.player, r);
      row.className = 'recipeRow' + (can ? '' : ' missing');
      const out = getItem(r.out.id);
      row.innerHTML = `<b>${out?.name || r.out.id}</b> ×${r.out.n} ${r.station ? `<span style="color:#a0aec0;font-size:10px"> [${r.station}]</span>` : ''}`;
      row.addEventListener('click', () => { this.selectedRecipe = r; this.refreshCraftDetail(); document.querySelectorAll('.recipeRow').forEach(x=>x.classList.remove('sel')); row.classList.add('sel'); });
      this.craftList.appendChild(row);
    });
  }

  refreshCraftDetail() {
    const r = this.selectedRecipe;
    if (!r) { this.craftDetail.textContent = 'Select a recipe'; this.btnCraft.disabled = true; return; }
    const out = getItem(r.out.id);
    const can = this.game.crafting.canCraft(this.game.player, r);
    let html = `<div style="color:${RARITY[out?.rarity||'common'].color};font-weight:bold">${out?.name || r.out.id} ×${r.out.n}</div>`;
    html += '<div style="margin-top:8px"><b>Requires:</b></div>';
    for (const m of r.in) {
      const md = getItem(m.id);
      const have = this.game.player.inventory.count(m.id);
      const ok = have >= m.n;
      html += `<div style="color:${ok?'#68d391':'#fc8181'}">· ${md?.name || m.id} ${have}/${m.n}</div>`;
    }
    if (r.station) html += `<div style="margin-top:8px;color:#a0aec0;font-size:11px">Station: ${r.station}</div>`;
    this.craftDetail.innerHTML = html;
    this.btnCraft.disabled = !can;
  }

  doCraft() {
    const r = this.selectedRecipe;
    if (!r) return;
    if (this.game.crafting.craft(this.game.player, r)) {
      this.game.sfx('craft');
      this.showToast(`Crafted ${getItem(r.out.id)?.name} ×${r.out.n}`);
      this.refreshAll();
      this.refreshCraftList();
      this.refreshCraftDetail();
    }
  }

  openChest(chest) {
    this.currentChest = chest;
    this.chestScreen.classList.remove('hidden');
    this.refreshChest();
  }
  closeChest() { this.chestScreen.classList.add('hidden'); this.currentChest = null; }

  refreshChest() {
    if (!this.currentChest) return;
    this.chestGrid.innerHTML = '';
    for (let i = 0; i < 20; i++) {
      const s = this.currentChest[i];
      const el = document.createElement('div'); el.className = 'invSlot';
      el.innerHTML = `<canvas width="32" height="32"></canvas><span class="count"></span>`;
      if (s) drawItemIcon(el.querySelector('canvas').getContext('2d'), s.id, 0, 0, 32);
      el.querySelector('.count').textContent = s && s.count > 1 ? s.count : '';
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (this.invHolding) {
          if (!this.currentChest[i]) { this.currentChest[i] = this.invHolding; this.invHolding = null; }
          else if (this.currentChest[i].id === this.invHolding.id) { this.currentChest[i].count += this.invHolding.count; this.invHolding = null; }
          else { const t = this.currentChest[i]; this.currentChest[i] = this.invHolding; this.invHolding = t; }
        } else if (this.currentChest[i]) { this.invHolding = this.currentChest[i]; this.currentChest[i] = null; }
        this.refreshChest(); this.refreshAll();
      });
      this.chestGrid.appendChild(el);
    }
    this.chestInvGrid.innerHTML = '';
    for (let i = 0; i < 40; i++) {
      const s = this.game.player.inventory.slots[i];
      const el = document.createElement('div'); el.className = 'invSlot';
      el.innerHTML = `<canvas width="32" height="32"></canvas><span class="count"></span>`;
      if (s) drawItemIcon(el.querySelector('canvas').getContext('2d'), s.id, 0, 0, 32);
      el.querySelector('.count').textContent = s && s.count > 1 ? s.count : '';
      el.addEventListener('mousedown', (e) => { e.preventDefault(); this.onInvClick(i, e.button); this.refreshChest(); });
      this.chestInvGrid.appendChild(el);
    }
  }

  toggleDebug() { this.debug.classList.toggle('hidden'); }
  updateDebug(info) { this.debug.textContent = info; }
}
