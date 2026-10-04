export const RARITY = {
  common:{name:'Common',color:'#e2e8f0',cls:'rar-common'},
  uncommon:{name:'Uncommon',color:'#68d391',cls:'rar-uncommon'},
  rare:{name:'Rare',color:'#63b3ed',cls:'rar-rare'},
  epic:{name:'Epic',color:'#b794f4',cls:'rar-epic'},
  legendary:{name:'Legendary',color:'#f6ad55',cls:'rar-legendary'},
  mythic:{name:'Mythic',color:'#fc8181',cls:'rar-mythic'},
};

const I = (name, type, extra={}) => ({ name, type, stack: extra.stack ?? (type==='BLOCK'||type==='MATERIAL'?999:1), color:'#888', ...extra });

export const ITEMS = {
  // blocks/materials
  dirt:        { name:'Dirt', type:'BLOCK', stack:999, color:'#6b4423', block:'dirt' },
  stone:       { name:'Stone', type:'BLOCK', stack:999, color:'#6e6e78', block:'stone' },
  sand:        { name:'Sand', type:'BLOCK', stack:999, color:'#e2c290', block:'sand' },
  snow:        { name:'Snow', type:'BLOCK', stack:999, color:'#e8f0ff', block:'snow' },
  ice:         { name:'Ice', type:'BLOCK', stack:999, color:'#a8d8f0', block:'ice' },
  wood:        { name:'Wood', type:'MATERIAL', stack:999, color:'#7a4b22' },
  ash:         { name:'Ash', type:'BLOCK', stack:999, color:'#4a4048', block:'ash' },
  copperOre:   { name:'Copper Ore', type:'MATERIAL', stack:999, color:'#c97a4a' },
  ironOre:     { name:'Iron Ore', type:'MATERIAL', stack:999, color:'#c8c8d0' },
  goldOre:     { name:'Gold Ore', type:'MATERIAL', stack:999, color:'#f0c860' },
  crystalOre:  { name:'Crystal Shard', type:'MATERIAL', stack:999, color:'#b28cf0' },
  obsidian:    { name:'Obsidian', type:'BLOCK', stack:999, color:'#1a1020', block:'obsidian' },
  copperBar:   { name:'Copper Bar', type:'MATERIAL', stack:999, color:'#e08a4a', rarity:'uncommon' },
  ironBar:     { name:'Iron Bar', type:'MATERIAL', stack:999, color:'#d8d8e0', rarity:'uncommon' },
  goldBar:     { name:'Gold Bar', type:'MATERIAL', stack:999, color:'#ffd870', rarity:'rare' },
  gel:         { name:'Gel', type:'MATERIAL', stack:999, color:'#6ac0e8' },
  bone:        { name:'Bone', type:'MATERIAL', stack:999, color:'#e8e0c8' },
  shadowShard: { name:'Shadow Shard', type:'MATERIAL', stack:999, color:'#7a3ac8', rarity:'rare' },
  demonHorn:   { name:'Demon Horn', type:'MATERIAL', stack:999, color:'#c83a2a', rarity:'epic' },
  bossCore:    { name:'Guardian Core', type:'MATERIAL', stack:999, color:'#f0a030', rarity:'epic' },
  titanHeart:  { name:'Titan Heart', type:'MATERIAL', stack:999, color:'#8a5aff', rarity:'legendary' },
  infernalSigil:{name:'Infernal Sigil', type:'MATERIAL', stack:999, color:'#ff4a2a', rarity:'mythic' },

  torch:       { name:'Torch', type:'BLOCK', stack:99, color:'#ffb84a', block:'torch', desc:'A warm light source.' },
  workbench:   { name:'Workbench', type:'BLOCK', stack:9, color:'#a06a30', block:'workbench', desc:'Enables basic crafting nearby.' },
  furnace:     { name:'Furnace', type:'BLOCK', stack:9, color:'#ff6a2a', block:'furnace', desc:'Smelts ores into bars.' },
  chest:       { name:'Chest', type:'BLOCK', stack:9, color:'#d4a058', block:'chest', desc:'Stores your items.' },

  woodPickaxe:  { name:'Wood Pickaxe', type:'TOOL', stack:1, color:'#a06a30', tool:'pickaxe', power:1, useTime:22, desc:'Weak but usable.' },
  stonePickaxe: { name:'Stone Pickaxe', type:'TOOL', stack:1, color:'#8a8a94', tool:'pickaxe', power:2, useTime:18, rarity:'uncommon' },
  ironPickaxe:  { name:'Iron Pickaxe', type:'TOOL', stack:1, color:'#d8d8e0', tool:'pickaxe', power:3, useTime:14, rarity:'uncommon' },
  goldPickaxe:  { name:'Gold Pickaxe', type:'TOOL', stack:1, color:'#ffd870', tool:'pickaxe', power:4, useTime:12, rarity:'rare' },
  woodAxe:      { name:'Wood Axe', type:'TOOL', stack:1, color:'#a06a30', tool:'axe', power:1, useTime:22 },
  ironAxe:      { name:'Iron Axe', type:'TOOL', stack:1, color:'#d8d8e0', tool:'axe', power:3, useTime:16, rarity:'uncommon' },
  woodShovel:   { name:'Wood Shovel', type:'TOOL', stack:1, color:'#a06a30', tool:'shovel', power:1, useTime:20 },

  woodSword:    { name:'Wood Sword', type:'WEAPON', stack:1, color:'#c08850', damage:6, useTime:22, knockback:3, reach:34, desc:'Better than fists.' },
  copperSword:  { name:'Copper Sword', type:'WEAPON', stack:1, color:'#e08a4a', damage:11, useTime:20, knockback:4, reach:38, rarity:'uncommon' },
  ironSword:    { name:'Iron Sword', type:'WEAPON', stack:1, color:'#e8e8f0', damage:18, useTime:18, knockback:5, reach:42, rarity:'uncommon', desc:'Reliable sword forged from iron.' },
  goldSword:    { name:'Gold Sword', type:'WEAPON', stack:1, color:'#ffd870', damage:26, useTime:16, knockback:5, reach:44, rarity:'rare' },
  crystalBlade: { name:'Crystal Blade', type:'WEAPON', stack:1, color:'#b28cf0', damage:38, useTime:14, knockback:6, reach:50, rarity:'epic', desc:'Hums with arcane energy.' },
  titanCleaver: { name:'Titan Cleaver', type:'WEAPON', stack:1, color:'#8a5aff', damage:60, useTime:18, knockback:10, reach:58, rarity:'legendary' },
  infernalEdge: { name:'Infernal Edge', type:'WEAPON', stack:1, color:'#ff4a2a', damage:95, useTime:12, knockback:12, reach:64, rarity:'mythic', desc:'Forged in the heart of the world.' },

  woodenBow:    { name:'Wooden Bow', type:'WEAPON', stack:1, color:'#a06a30', damage:10, useTime:28, projectile:'arrow', rarity:'uncommon' },
  magicStaff:   { name:'Magic Staff', type:'WEAPON', stack:1, color:'#b28cf0', damage:22, useTime:26, manaCost:12, projectile:'magic', rarity:'rare' },

  healthPotion: { name:'Health Potion', type:'CONSUMABLE', stack:30, color:'#fc8181', heal:35, useTime:30, rarity:'uncommon', desc:'Restores 35 HP.' },
  manaPotion:   { name:'Mana Potion', type:'CONSUMABLE', stack:30, color:'#63b3ed', mana:40, useTime:30, rarity:'uncommon', desc:'Restores 40 Mana.' },

  speedBoots:   { name:'Speed Boots', type:'ACCESSORY', stack:1, color:'#68d391', bonus:{speed:1.3}, rarity:'rare', desc:'+30% movement speed.' },
  healthRing:   { name:'Health Ring', type:'ACCESSORY', stack:1, color:'#fc8181', bonus:{maxHp:30}, rarity:'rare', desc:'+30 Max HP.' },
  miningGloves: { name:'Mining Gloves', type:'ACCESSORY', stack:1, color:'#f6ad55', bonus:{mine:1.4}, rarity:'rare', desc:'+40% mining speed.' },
};

export const ITEM_LIST = Object.entries(ITEMS).map(([k,v])=>({id:k, ...v}));
export function getItem(id) { return ITEMS[id] || null; }
