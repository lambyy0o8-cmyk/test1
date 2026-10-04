import { getItem } from '../items.js';

export class Inventory {
  constructor(size = 40) {
    this.size = size;
    this.slots = new Array(size).fill(null); // {id, count}
  }
  add(id, count = 1) {
    const def = getItem(id); if (!def) return 0;
    const max = def.stack || 1;
    let left = count;
    // fill existing stacks first
    for (let i = 0; i < this.size && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < max) {
        const take = Math.min(max - s.count, left);
        s.count += take; left -= take;
      }
    }
    // new stacks
    for (let i = 0; i < this.size && left > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(max, left);
        this.slots[i] = { id, count: take };
        left -= take;
      }
    }
    return count - left;
  }
  remove(id, count = 1) {
    let need = count;
    for (let i = this.size - 1; i >= 0 && need > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, need);
        s.count -= take; need -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return count - need;
  }
  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }
  has(id, count = 1) { return this.count(id) >= count; }
  setSlot(i, item) { this.slots[i] = item; }
  swap(i, j) { const t = this.slots[i]; this.slots[i] = this.slots[j]; this.slots[j] = t; }
  serialize() { return this.slots.map(s => s ? {id:s.id, count:s.count} : null); }
  static deserialize(arr) { const inv = new Inventory(arr.length); inv.slots = arr.map(s => s ? {id:s.id, count:s.count} : null); return inv; }
}
