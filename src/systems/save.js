const KEY = 'emberfall.save.v1';

export const SaveSystem = {
  save(game) {
    try {
      const w = game.world;
      const data = {
        version: 1,
        name: game.worldName || 'World',
        seed: w.seed,
        w: w.w, h: w.h,
        time: w.time,
        // store only delta tiles (changed from generation)
        changes: Object.entries(w.chunkChanges).map(([k, v]) => {
          const [x, y] = k.split(',').map(Number);
          return [x, y, v];
        }),
        surfaceH: Array.from(w.surfaceH),
        biomes: Array.from(w.biomes),
        player: game.player.serialize(),
        defeatedBosses: Array.from(game.defeatedBosses || []),
        weather: game.weatherState,
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { console.error(e); return false; }
  },

  has() { return !!localStorage.getItem(KEY); },

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d.version !== 1) return null;
      return d;
    } catch (e) { console.error('Save corrupted:', e); return null; }
  },

  clear() { localStorage.removeItem(KEY); },
};
