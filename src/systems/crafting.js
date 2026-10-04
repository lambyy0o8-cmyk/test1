import { RECIPES } from '../recipes.js';
import { getItem } from '../items.js';

export class CraftingSystem {
  constructor() { this.recipes = RECIPES; }

  availableRecipes(player, station) {
    // Show recipes craftable at the current station (or without station)
    return this.recipes.filter(r => {
      if (!r.station) return true;
      if (r.station === station) return true;
      return false;
    });
  }

  canCraft(player, recipe) {
    for (const m of recipe.in) {
      if (player.inventory.count(m.id) < m.n) return false;
    }
    return true;
  }

  craft(player, recipe) {
    if (!this.canCraft(player, recipe)) return false;
    for (const m of recipe.in) player.inventory.remove(m.id, m.n);
    player.inventory.add(recipe.out.id, recipe.out.n);
    return true;
  }
}
