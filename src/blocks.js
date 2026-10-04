// Реестр блоков
export const BLOCKS = {
  air:        { id:0,  name:'Air',          solid:false, transparent:true,  hardness:0,   light:0 },
  dirt:       { id:1,  name:'Dirt',         solid:true,  hardness:0.4, tool:'shovel', drop:'dirt',   colors:['#6b4423','#5a3819','#7a5230'] },
  grass:      { id:2,  name:'Grass',        solid:true,  hardness:0.4, tool:'shovel', drop:'dirt',   colors:['#4a8b3a','#3a7a2a','#5a9a48'] },
  stone:      { id:3,  name:'Stone',        solid:true,  hardness:0.8, tool:'pickaxe',drop:'stone',  colors:['#6e6e78','#585862','#7a7a84'] },
  sand:       { id:4,  name:'Sand',         solid:true,  hardness:0.35,tool:'shovel', drop:'sand',   colors:['#e2c290','#cfae76','#efd0a0'] },
  wood:       { id:5,  name:'Wood',         solid:true,  hardness:0.6, tool:'axe',    drop:'wood',   colors:['#7a4b22','#5e3818','#8a5a30'] },
  leaves:     { id:6,  name:'Leaves',       solid:false, transparent:true, hardness:0.2, tool:'axe', colors:['#3f8b32','#357a2a','#4a9b40'] },
  snow:       { id:7,  name:'Snow',         solid:true,  hardness:0.3, tool:'shovel', drop:'snow',   colors:['#e8f0ff','#d0dced','#ffffff'] },
  ice:        { id:8,  name:'Ice',          solid:true,  hardness:0.6, tool:'pickaxe',drop:'ice',    colors:['#a8d8f0','#84bde0','#c0e4f8'] },
  copperOre:  { id:9,  name:'Copper Ore',   solid:true,  hardness:1.2, tool:'pickaxe',drop:'copperOre', colors:['#6e6e78','#c97a4a','#7a7a84'] },
  ironOre:    { id:10, name:'Iron Ore',     solid:true,  hardness:1.6, tool:'pickaxe',drop:'ironOre',   colors:['#6e6e78','#c8c8d0','#7a7a84'] },
  goldOre:    { id:11, name:'Gold Ore',     solid:true,  hardness:2.0, tool:'pickaxe',drop:'goldOre',   colors:['#6e6e78','#f0c860','#7a7a84'] },
  crystalOre: { id:12, name:'Crystal Ore',  solid:true,  hardness:2.4, tool:'pickaxe',drop:'crystalOre',light:5, colors:['#5a5a78','#b28cf0','#7a7a94'] },
  obsidian:   { id:13, name:'Obsidian',     solid:true,  hardness:3.0, tool:'pickaxe',drop:'obsidian', colors:['#1a1020','#2a1a30','#0f0a18'] },
  lava:       { id:14, name:'Lava',         solid:false, transparent:true, hardness:999, light:12, damage:8, colors:['#ff5a1a','#c83810','#ff8040'] },
  ash:        { id:15, name:'Ash',          solid:true,  hardness:0.5, tool:'shovel', drop:'ash',    colors:['#4a4048','#3a3038','#5a5058'] },
  torch:      { id:16, name:'Torch',        solid:false, transparent:true, hardness:0.1, light:14, isTorch:true, drop:'torch', colors:['#7a4b22','#ffb84a','#ff8020'] },
  workbench:  { id:17, name:'Workbench',    solid:false, transparent:true, hardness:0.6, tool:'axe', drop:'workbench', station:'workbench', colors:['#7a4b22','#a06a30','#8a5a28'] },
  furnace:    { id:18, name:'Furnace',      solid:true,  hardness:1.5, tool:'pickaxe', drop:'furnace', station:'furnace', light:6, colors:['#6e6e78','#ff6a2a','#4a4a52'] },
  chest:      { id:19, name:'Chest',        solid:false, transparent:true, hardness:0.5, tool:'axe', drop:'chest', isChest:true, colors:['#7a4b22','#d4a058','#5e3818'] },
  bedrock:    { id:20, name:'Bedrock',      solid:true,  hardness:9999, colors:['#181820','#282830','#0f0f18'] },
};

export const BLOCK_BY_ID = {};
for (const k in BLOCKS) BLOCK_BY_ID[BLOCKS[k].id] = BLOCKS[k];
export const BLOCK_ID = {};
for (const k in BLOCKS) BLOCK_ID[k] = BLOCKS[k].id;

export function getBlockColor(id, variant = 0) {
  const b = BLOCK_BY_ID[id];
  if (!b || !b.colors) return '#000';
  return b.colors[variant % b.colors.length];
}
