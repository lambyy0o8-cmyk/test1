// Крафт-рецепты. station: null = в любом месте, 'workbench'/'furnace' = у станции
export const RECIPES = [
  // basics — anywhere
  { out:{ id:'torch', n:3 },    in:[{ id:'wood', n:1 }, {id:'gel', n:1}],                  station:null },
  { out:{ id:'workbench', n:1 },in:[{ id:'wood', n:10 }],                                  station:null },
  // workbench
  { out:{ id:'furnace', n:1 },  in:[{ id:'stone', n:20 }, {id:'wood', n:4}],               station:'workbench' },
  { out:{ id:'chest', n:1 },    in:[{ id:'wood', n:8 }],                                   station:'workbench' },
  { out:{ id:'woodPickaxe', n:1 }, in:[{ id:'wood', n:8 }],                                station:'workbench' },
  { out:{ id:'woodAxe', n:1 },  in:[{ id:'wood', n:6 }],                                   station:'workbench' },
  { out:{ id:'woodShovel', n:1 },in:[{ id:'wood', n:5 }],                                   station:'workbench' },
  { out:{ id:'woodSword', n:1 },in:[{ id:'wood', n:7 }],                                   station:'workbench' },
  { out:{ id:'woodenBow', n:1 },in:[{ id:'wood', n:12 }],                                  station:'workbench' },
  { out:{ id:'stonePickaxe', n:1 }, in:[{ id:'stone', n:10 }, {id:'wood', n:3}],           station:'workbench' },
  { out:{ id:'copperSword', n:1 }, in:[{ id:'copperBar', n:6 }, {id:'wood', n:2}],          station:'workbench' },
  { out:{ id:'ironSword', n:1 },  in:[{ id:'ironBar', n:10 }, {id:'wood', n:3}],            station:'workbench' },
  { out:{ id:'ironPickaxe', n:1 },in:[{ id:'ironBar', n:12 }, {id:'wood', n:4}],            station:'workbench' },
  { out:{ id:'ironAxe', n:1 },   in:[{ id:'ironBar', n:8 }, {id:'wood', n:3}],             station:'workbench' },
  { out:{ id:'goldSword', n:1 }, in:[{ id:'goldBar', n:12 }, {id:'ironBar', n:4}],          station:'workbench' },
  { out:{ id:'goldPickaxe', n:1 },in:[{ id:'goldBar', n:14 }, {id:'ironBar', n:4}],         station:'workbench' },
  { out:{ id:'magicStaff', n:1 },in:[{ id:'crystalOre', n:8 }, {id:'goldBar', n:4}],        station:'workbench' },
  { out:{ id:'crystalBlade', n:1 }, in:[{ id:'crystalOre', n:12 }, {id:'goldBar', n:6}],    station:'workbench' },
  { out:{ id:'healthPotion', n:1 }, in:[{ id:'gel', n:4 }, {id:'bone', n:2}],               station:'workbench' },
  { out:{ id:'manaPotion', n:1 },   in:[{ id:'crystalOre', n:2 }, {id:'gel', n:2}],        station:'workbench' },
  { out:{ id:'speedBoots', n:1 },   in:[{ id:'ironBar', n:8 }, {id:'gel', n:6}],           station:'workbench' },
  { out:{ id:'healthRing', n:1 },   in:[{ id:'goldBar', n:6 }, {id:'crystalOre', n:4}],    station:'workbench' },
  { out:{ id:'miningGloves', n:1 }, in:[{ id:'ironBar', n:6 }, {id:'gel', n:4}],            station:'workbench' },
  { out:{ id:'titanCleaver', n:1 }, in:[{ id:'titanHeart', n:1 }, {id:'ironBar', n:20}],    station:'workbench' },
  { out:{ id:'infernalEdge', n:1 }, in:[{ id:'infernalSigil', n:1 }, {id:'obsidian', n:20},{id:'crystalOre', n:10}], station:'workbench' },

  // furnace — smelting
  { out:{ id:'copperBar', n:1 }, in:[{ id:'copperOre', n:3 }], station:'furnace' },
  { out:{ id:'ironBar', n:1 },   in:[{ id:'ironOre', n:3 }],   station:'furnace' },
  { out:{ id:'goldBar', n:1 },   in:[{ id:'goldOre', n:4 }],   station:'furnace' },
  { out:{ id:'crystalOre', n:2 },in:[{ id:'crystalOre', n:1 }], station:'furnace' },
];
