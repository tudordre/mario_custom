/**
 * Simple synthesized SFX via Web Audio API (no external files).
 */
export class Sfx {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
  }

  _ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /** Classic coin / pickup blip
   * @param {number} [delay]
   */
  playCoin(delay = 0) {
    const ctx = this._ensure();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(988, now); // B5
    osc.frequency.setValueAtTime(1319, now + 0.06); // E6

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Short original “fell in pit” tune (~3 seconds).
   */
  playPitFall() {
    const ctx = this._ensure();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Descending chiptune motif (Hz), ~3s total
    const melody = [
      { f: 523.25, t: 0.0, d: 0.22 },   // C5
      { f: 493.88, t: 0.24, d: 0.22 },  // B4
      { f: 440.0, t: 0.48, d: 0.22 },   // A4
      { f: 392.0, t: 0.72, d: 0.28 },   // G4
      { f: 349.23, t: 1.05, d: 0.22 },  // F4
      { f: 329.63, t: 1.3, d: 0.22 },   // E4
      { f: 293.66, t: 1.55, d: 0.28 },  // D4
      { f: 261.63, t: 1.9, d: 0.35 },   // C4
      { f: 196.0, t: 2.35, d: 0.55 },   // G3 — hold
    ];

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28, now);
    master.gain.linearRampToValueAtTime(0.22, now + 2.0);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
    master.connect(ctx.destination);

    for (const note of melody) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = note.f;

      const start = now + note.t;
      const end = start + note.d;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.9, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(end + 0.02);
    }

    // Soft bass drone under the fall
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'triangle';
    bass.frequency.setValueAtTime(98, now);
    bass.frequency.linearRampToValueAtTime(55, now + 2.8);
    bassGain.gain.setValueAtTime(0.0001, now);
    bassGain.gain.exponentialRampToValueAtTime(0.35, now + 0.15);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
    bass.connect(bassGain);
    bassGain.connect(master);
    bass.start(now);
    bass.stop(now + 3.05);
  }

  /** Power-up grow (orange animal) */
  playGrow() {
    const ctx = this._ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [392, 523, 659, 784];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = f;
      const t = now + i * 0.07;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  /** Shrink after green hit */
  playShrink() {
    const ctx = this._ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  /** Stomp green animal */
  playStomp() {
    const ctx = this._ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Brick smash from below */
  playBrickBreak() {
    const ctx = this._ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);

    const noise = ctx.createOscillator();
    const ng = ctx.createGain();
    noise.type = 'sawtooth';
    noise.frequency.value = 80;
    ng.gain.setValueAtTime(0.08, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    noise.connect(ng);
    ng.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.12);
  }

  /** Fireball shot */
  playFireball() {
    const ctx = this._ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Rocket launch */
  playRocket() {
    const ctx = this._ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.42);

    const whoosh = ctx.createOscillator();
    const wg = ctx.createGain();
    whoosh.type = 'triangle';
    whoosh.frequency.setValueAtTime(400, now);
    whoosh.frequency.exponentialRampToValueAtTime(900, now + 0.2);
    wg.gain.setValueAtTime(0.08, now);
    wg.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    whoosh.connect(wg);
    wg.connect(ctx.destination);
    whoosh.start(now);
    whoosh.stop(now + 0.26);
  }
}
