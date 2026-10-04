// Процедурный звук через Web Audio API
let ctx = null;
export const Settings = {
  master: 0.7, music: 0.5, sfx: 0.8, pixelScale: 3, cameraShake: 0.7, particles: 0.8,
  load() { try { const s = JSON.parse(localStorage.getItem('emberfall.settings') || '{}'); Object.assign(this, s); } catch {} },
  save() { try { localStorage.setItem('emberfall.settings', JSON.stringify({master:this.master,music:this.music,sfx:this.sfx,pixelScale:this.pixelScale,cameraShake:this.cameraShake,particles:this.particles})); } catch {} }
};
Settings.load();

function ensure() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  }
  return ctx;
}

function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null) {
  const c = ensure(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol * Settings.sfx * Settings.master, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.2, filterFreq = 1200) {
  const c = ensure(); if (!c) return;
  const t = c.currentTime;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol * Settings.sfx * Settings.master, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start(t); src.stop(t + dur);
}

export const Sfx = {
  unlock() { ensure()?.resume?.(); },
  jump() { tone(340, 0.12, 'square', 0.12, 520); },
  hit() { noise(0.07, 0.15, 2000); tone(180, 0.06, 'square', 0.1, 120); },
  breakBlock() { noise(0.13, 0.22, 1600); },
  place() { tone(280, 0.07, 'square', 0.1, 380); },
  pickup() { tone(720, 0.07, 'sine', 0.12, 1100); },
  hitEnemy() { noise(0.06, 0.18, 2400); tone(220, 0.06, 'sawtooth', 0.1, 140); },
  enemyDie() { tone(300, 0.18, 'sawtooth', 0.16, 80); noise(0.15, 0.15, 800); },
  hurt() { tone(140, 0.2, 'sawtooth', 0.25, 70); },
  craft() { tone(440, 0.08, 'square', 0.14); setTimeout(()=>tone(660, 0.1, 'square', 0.14), 80); },
  bossWarn() { tone(90, 0.4, 'sawtooth', 0.3, 50); noise(0.4, 0.2, 400); },
  levelUp() { tone(523,0.09,'square',0.15); setTimeout(()=>tone(659,0.09,'square',0.15),90); setTimeout(()=>tone(784,0.14,'square',0.15),180); },
  bow() { tone(500, 0.08, 'sine', 0.12, 200); },
  magic() { tone(700, 0.15, 'sine', 0.14, 1400); },
};

export function sfx(name) { (Sfx[name] || (()=>{}))(); }
