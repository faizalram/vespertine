/**
 * Placeholder audio (spec §8.4): every sound is synthesised with WebAudio, no files.
 * `playTrack` is the seam where a real soundtrack can be slotted in later.
 */

export type Sfx =
  | 'shot' | 'graze' | 'death' | 'bomb' | 'declare' | 'phaseEnd' | 'vigil' | 'bossHit' | 'select'
  | 'enemyHit' | 'enemyDie' | 'item' | 'extend' | 'bombGet' | 'capture' | 'captureFail' | 'bossDefeat' | 'talk'
  | 'pin' | 'rewind' | 'bell' | 'dollCrack';

const MIN_GAP: Record<Sfx, number> = {
  shot: 0.07, graze: 0.035, death: 0.3, bomb: 0.3, declare: 0.3, phaseEnd: 0.3, vigil: 0.2, bossHit: 0.09, select: 0.05,
  enemyHit: 0.08, enemyDie: 0.05, item: 0.04, extend: 0.5, bombGet: 0.5, capture: 0.5, captureFail: 0.5, bossDefeat: 1, talk: 0.05,
  pin: 0.1, rewind: 0.3, bell: 0.3, dollCrack: 0.2,
};

interface Song {
  bpm: number;
  chords: number[][];
  arp: boolean;
  /** Bass on every eighth instead of every quarter. */
  drive: boolean;
  lead: boolean;
}

const SONGS: Record<string, Song> = {
  title: { bpm: 60, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], arp: false, drive: false, lead: false },
  stage1: { bpm: 92, chords: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]], arp: true, drive: false, lead: true },
  boss1: { bpm: 126, chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], arp: true, drive: true, lead: true },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private last: Partial<Record<Sfx, number>> = {};
  private music: ProceduralMusic | null = null;
  musicVolume = 0.5;
  sfxVolume = 0.7;
  muted = false;

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.applyVolumes();
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfxBus.gain.value = this.sfxVolume * 0.6;
    this.musicBus.gain.value = this.musicVolume * 0.35;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolumes();
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  private currentTrack = '';

  playTrack(name: string): void {
    if (!this.ctx || name === this.currentTrack) return;
    const song = SONGS[name];
    if (!song) return;
    this.currentTrack = name;
    this.music?.stop();
    this.music = new ProceduralMusic(this.ctx, this.musicBus, song);
    this.music.start();
  }

  stopMusic(): void {
    this.music?.stop();
    this.music = null;
    this.currentTrack = '';
  }

  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    const prev = this.last[name] ?? -1;
    if (now - prev < MIN_GAP[name]) return;
    this.last[name] = now;
    switch (name) {
      case 'shot':
        this.noiseHit(now, 0.035, 4500, 0.05, 'highpass');
        break;
      case 'graze':
        this.tone(now, 'sine', 2400, 2200, 0.04, 0.06);
        break;
      case 'bossHit':
        this.noiseHit(now, 0.03, 1400, 0.05, 'bandpass');
        break;
      case 'death':
        this.tone(now, 'sawtooth', 600, 60, 0.6, 0.18);
        this.noiseHit(now, 0.5, 900, 0.25, 'lowpass');
        break;
      case 'bomb':
        this.tone(now, 'sine', 120, 40, 1.2, 0.4);
        this.bell(now, 523.25, 0.18, 2.2);
        this.bell(now + 0.08, 783.99, 0.12, 2.2);
        break;
      case 'declare':
        this.bell(now, 392, 0.22, 3.2);
        this.bell(now + 0.02, 587.33, 0.1, 2.6);
        break;
      case 'phaseEnd':
        this.bell(now, 659.25, 0.16, 1.6);
        this.bell(now + 0.12, 880, 0.12, 1.8);
        this.bell(now + 0.24, 1318.5, 0.08, 2.0);
        break;
      case 'vigil':
        this.bell(now, 440, 0.12, 2.4);
        this.tone(now, 'triangle', 220, 220, 1.2, 0.08);
        break;
      case 'select':
        this.tone(now, 'triangle', 880, 990, 0.08, 0.1);
        break;
      case 'pin':
        // A nib striking paper.
        this.noiseHit(now, 0.05, 5000, 0.12, 'highpass');
        this.tone(now, 'triangle', 1200, 900, 0.08, 0.08);
        break;
      case 'rewind':
        // A music box wound backwards.
        for (let k = 0; k < 6; k++) this.tone(now + k * 0.04, 'sine', 1760 - k * 160, 1700 - k * 160, 0.12, 0.06);
        break;
      case 'bell':
        this.bell(now, 261.63, 0.3, 4);
        this.bell(now + 0.01, 392, 0.12, 3);
        break;
      case 'dollCrack':
        this.noiseHit(now, 0.08, 3500, 0.15, 'bandpass');
        this.tone(now, 'square', 900, 300, 0.08, 0.04);
        break;
      case 'talk':
        this.tone(now, 'triangle', 660, 640, 0.05, 0.05);
        break;
      case 'enemyHit':
        this.noiseHit(now, 0.025, 2200, 0.035, 'bandpass');
        break;
      case 'enemyDie':
        // A soft paper tear.
        this.noiseHit(now, 0.12, 3000, 0.12, 'bandpass');
        this.tone(now, 'triangle', 520, 260, 0.12, 0.06);
        break;
      case 'item':
        this.tone(now, 'sine', 1500, 1700, 0.05, 0.035);
        break;
      case 'extend':
        this.bell(now, 523.25, 0.14, 1.4);
        this.bell(now + 0.1, 659.25, 0.14, 1.4);
        this.bell(now + 0.2, 1046.5, 0.12, 1.8);
        break;
      case 'bombGet':
        this.bell(now, 783.99, 0.12, 1.2);
        this.bell(now + 0.1, 1174.7, 0.1, 1.4);
        break;
      case 'capture':
        this.bell(now, 587.33, 0.16, 2.2);
        this.bell(now + 0.15, 880, 0.14, 2.4);
        this.bell(now + 0.3, 1174.7, 0.12, 2.8);
        break;
      case 'captureFail':
        this.bell(now, 311.13, 0.12, 1.8);
        break;
      case 'bossDefeat':
        this.tone(now, 'sine', 160, 30, 1.6, 0.4);
        this.noiseHit(now, 1.2, 700, 0.25, 'lowpass');
        this.bell(now + 0.3, 392, 0.16, 3.5);
        break;
    }
  }

  private env(t: number, peak: number, dur: number): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.sfxBus);
    return g;
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    o.connect(this.env(t, vol, dur));
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseHit(t: number, dur: number, freq: number, vol: number, type: BiquadFilterType): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    src.connect(f);
    f.connect(this.env(t, vol, dur));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** Inharmonic partials with long decay: a temple bell. */
  private bell(t: number, f: number, vol: number, dur: number): void {
    for (const [ratio, amp] of [[1, 1], [2.76, 0.45], [5.4, 0.25], [8.93, 0.12]] as const) {
      this.tone(t, 'sine', f * ratio, f * ratio * 0.998, dur / Math.sqrt(ratio), vol * amp);
    }
  }
}

/**
 * Minor-key loop: pad + bass + arpeggio, scheduled ahead with a lookahead timer.
 * Progression Am – F – Dm – E (i – VI – iv – V): gloomy with a pull back home.
 */
class ProceduralMusic {
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private readonly out: GainNode;

  constructor(private readonly ctx: AudioContext, bus: GainNode, private readonly song: Song) {
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    this.out.connect(lp);
    lp.connect(bus);
  }

  start(): void {
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.3);
  }

  private static hz(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private schedule(): void {
    const sixteenth = 60 / this.song.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 128;
    }
  }

  private playStep(step: number, t: number, sixteenth: number): void {
    const bar = Math.floor(step / 16) % 8;
    const song = this.song;
    const chord = song.chords[Math.floor(bar / 2) % song.chords.length];
    const inBar = step % 16;
    if (inBar === 0 && bar % 2 === 0) {
      for (const n of chord) this.voice('sawtooth', ProceduralMusic.hz(n), t, sixteenth * 32, 0.035, 0.6, 7);
    }
    const bassEvery = song.drive ? 2 : 4;
    if (inBar % bassEvery === 0) {
      const oct = song.drive && inBar % 4 === 2 ? 12 : 0;
      this.voice('triangle', ProceduralMusic.hz(chord[0] - 24 + oct), t, sixteenth * (bassEvery - 0.5), 0.16, 0.01, 0);
    }
    if (song.arp) {
      const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
      const note = chord[pattern[inBar % 8]] + (inBar >= 8 ? 12 : 0);
      if (inBar % 2 === 0) this.voice('triangle', ProceduralMusic.hz(note + 12), t, sixteenth * 2.5, 0.06, 0.005, 0);
      // Sparse melody tone on the last bar of each phrase.
      if (song.lead && bar % 2 === 1 && (inBar === 6 || inBar === 12)) {
        this.voice('sine', ProceduralMusic.hz(chord[2] + 24), t, sixteenth * 6, 0.05, 0.02, 0);
      }
    }
  }

  private voice(type: OscillatorType, f: number, t: number, dur: number, vol: number, attack: number, detune: number): void {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.out);
    const oscs = detune ? [-detune, detune] : [0];
    for (const d of oscs) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}
