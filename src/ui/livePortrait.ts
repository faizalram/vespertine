import type { Speaker } from '../game/defs';
import { paintPortrait, type BlinkState } from './portraits';

/**
 * A portrait that is alive: it breathes, sways a little, blinks on its own
 * schedule, moves its lips while its line is being typed, and gives a small
 * start when its expression changes. Repaints only when the face changes;
 * breathing and sway are cheap CSS transforms.
 */
export class LivePortrait {
  private static readonly all = new Set<LivePortrait>();

  private who: Speaker | null = null;
  private expr = 'neutral';
  private speaking = false;
  private talk = false;
  private nextBlink = 0;
  private blinkStart = -1;
  private doubleBlink = false;
  private nextFlap = 0;
  private changedAt = -9999;
  private painted = '';
  private readonly phase = Math.random() * 10;
  /** Mirror horizontally (right-hand dialogue portrait). */
  flip = false;
  /** Pushed back and darkened while the other side speaks. */
  dim = false;
  /** Breathing amplitude multiplier (cards breathe less than dialogue portraits). */
  breath = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.style.transformOrigin = '50% 100%';
    LivePortrait.all.add(this);
  }

  static updateAll(now: number): void {
    for (const p of LivePortrait.all) p.update(now);
  }

  destroy(): void {
    LivePortrait.all.delete(this);
  }

  show(who: Speaker, expr: string): void {
    if (who !== this.who || expr !== this.expr) {
      if (who === this.who) this.changedAt = performance.now();
      this.who = who;
      this.expr = expr;
      // Changing expression often comes with a blink.
      if (Math.random() < 0.4) this.nextBlink = performance.now() + 60;
    }
  }

  setSpeaking(on: boolean): void {
    this.speaking = on;
  }

  update(now: number): void {
    if (!this.who) return;
    // ── Blink scheduling: every 2–5.5 s, sometimes twice.
    if (this.nextBlink === 0) this.nextBlink = now + 1200 + Math.random() * 3000;
    if (this.blinkStart < 0 && now >= this.nextBlink) {
      this.blinkStart = now;
      this.doubleBlink = Math.random() < 0.18;
    }
    let blink: BlinkState = 0;
    if (this.blinkStart >= 0) {
      const t = now - this.blinkStart;
      const total = this.doubleBlink ? 380 : 170;
      const local = this.doubleBlink && t > 190 ? t - 190 : t;
      blink = local < 45 ? 1 : local < 120 ? 2 : local < 170 ? 1 : 0;
      if (t >= total) {
        this.blinkStart = -1;
        this.nextBlink = now + 2000 + Math.random() * 3500;
      }
    }
    // ── Lips: flap irregularly while the line is being typed.
    let talk = false;
    if (this.speaking) {
      if (now >= this.nextFlap) {
        this.talk = !this.talk;
        this.nextFlap = now + (this.talk ? 70 + Math.random() * 70 : 50 + Math.random() * 90);
      }
      talk = this.talk;
    } else this.talk = false;

    const key = `${this.who}|${this.expr}|${blink}|${talk}`;
    if (key !== this.painted) {
      paintPortrait(this.canvas, this.who, this.expr, blink, talk);
      this.painted = key;
    }

    // ── Body: breathing, a slow sway, and a start on expression change.
    const s = now / 1000 + this.phase;
    const b = Math.sin(s * 1.9) * this.breath;
    const since = (now - this.changedAt) / 1000;
    const pop = since < 0.45 ? Math.sin(since * 22) * Math.exp(-since * 9) * 0.035 : 0;
    const talkBob = this.speaking ? Math.sin(s * 9) * 0.004 : 0;
    const sx = (1 + b * 0.004 + pop) * (this.flip ? -1 : 1);
    const sy = 1 + b * 0.009 + pop + talkBob;
    const rot = Math.sin(s * 0.7) * 0.5 * this.breath + (since < 0.45 ? Math.sin(since * 18) * Math.exp(-since * 8) * 1.2 : 0);
    const dimY = this.dim ? 4 : 0;
    this.canvas.style.transform = `translateY(${dimY - b * 0.4}%) scale(${sx.toFixed(4)}, ${sy.toFixed(4)}) rotate(${rot.toFixed(3)}deg)`;
  }
}
