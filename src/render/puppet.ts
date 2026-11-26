import type { CharId } from '../game/defs';
import type { HeadKind, Rig } from './puppetArt';
import type { SpriteBatch } from './spriteBatch';

/**
 * Brings a heroine's puppet to life. Every moving part rides a damped spring,
 * so hair, sleeves, skirts and props trail behind her movement and settle with
 * a little overshoot. On top of that: breathing, blinking, reactions to what
 * happens in play, and an idle habit of her own.
 */

export class Spring {
  x = 0;
  v = 0;
  constructor(public k: number, public d: number) {}

  step(target: number, dt: number): number {
    const a = (target - this.x) * this.k - this.v * this.d;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

export interface PuppetInput {
  /** Horizontal / vertical movement this tick, in field units. */
  vx: number;
  vy: number;
  focus: boolean;
  hurt: boolean;
  invulnerable: boolean;
}

export type Reaction = 'cast' | 'skill' | 'flinch' | 'hurt' | 'joy' | 'soft';

const REACTION_TIME: Record<Reaction, number> = { cast: 0.85, skill: 0.45, flinch: 0.25, hurt: 0.9, joy: 1.3, soft: 1.1 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class Puppet {
  readonly hair = new Spring(55, 7);
  readonly hem = new Spring(90, 9);
  readonly acc = new Spring(170, 5);
  readonly prop = new Spring(26, 1.6);
  readonly back = new Spring(40, 8);
  readonly head = new Spring(90, 10);
  readonly armL = new Spring(70, 10);
  readonly armR = new Spring(70, 10);
  readonly root = new Spring(60, 11);
  private t = 0;
  private blinkUntil = 0;
  private nextBlink = 2;
  private reaction: Reaction | null = null;
  private reactionT = 0;
  private quirkUntil = 0;
  private nextQuirk = 6;
  private quirkTilt = 0;
  private hop = 0;
  private focus = false;
  private hurt = false;
  private speed = 0;
  /** World position of the glowing part after the last draw (Sayo's lantern). */
  readonly glowAt = { x: 0, y: 0, on: false };

  constructor(readonly char: CharId) {}

  react(r: Reaction): void {
    // Hurt and joy override lesser reactions; a flinch never interrupts anything bigger.
    if (r === 'flinch' && this.reaction && this.reaction !== 'flinch') {
      this.head.v += (Math.random() < 0.5 ? -1 : 1) * 2;
      return;
    }
    this.reaction = r;
    this.reactionT = 0;
    switch (r) {
      case 'flinch':
        this.head.v += (Math.random() < 0.5 ? -1 : 1) * 3;
        this.acc.v += 4;
        break;
      case 'hurt':
        this.head.v += 6;
        this.hair.v -= 6;
        this.prop.v += 5;
        this.acc.v += 10;
        break;
      case 'cast':
        this.hair.v += 4;
        this.hem.v += 3;
        this.acc.v += 8;
        break;
      case 'joy':
        this.hop = 1;
        this.acc.v += 12;
        this.prop.v += 3;
        break;
      case 'skill':
        this.acc.v += 6;
        this.prop.v += 2.5;
        break;
      case 'soft':
        this.head.v -= 1.5;
        break;
    }
  }

  update(dt: number, inp: PuppetInput): void {
    this.t += dt;
    const t = this.t;
    this.focus = inp.focus;
    this.hurt = inp.hurt;
    // Teleports (Rewind, respawn) would yank every spring: clamp what the springs see.
    const vx = clamp(inp.vx, -6, 6);
    const vy = clamp(inp.vy, -6, 6);
    this.speed += (Math.hypot(vx, vy) - this.speed) * Math.min(1, dt * 8);

    if (this.reaction) {
      this.reactionT += dt;
      if (this.reactionT > REACTION_TIME[this.reaction]) this.reaction = null;
    }
    if (this.hop > 0) this.hop = Math.max(0, this.hop - dt * 2.4);

    // ── Idle habits: each heroine has her own small, recurring gesture.
    if (t > this.nextQuirk && !this.reaction) {
      this.nextQuirk = t + 7 + Math.random() * 6;
      this.quirkUntil = t + 1.2;
      switch (this.char) {
        case 'sayo': // she checks her lantern, which swings
          this.prop.v += (Math.random() < 0.5 ? -1 : 1) * 3.5;
          this.quirkTilt = 0.12;
          break;
        case 'ilse': // the cowlick springs up; the compass wobbles
          this.acc.v += 16;
          this.back.v += 2.5;
          this.quirkTilt = -0.06;
          break;
        case 'tessel': // a doll's curious head tilt
          this.quirkTilt = 0.3;
          this.acc.v += 6;
          break;
        case 'wren': // eyes closed for a moment: a silent prayer; the bell sways
          this.quirkTilt = 0.08;
          this.prop.v += 2.5;
          break;
      }
    }
    const quirking = t < this.quirkUntil;

    // ── Blinking.
    if (t > this.nextBlink) {
      this.blinkUntil = t + 0.12;
      this.nextBlink = t + 2.2 + Math.random() * 3.2;
      if (Math.random() < 0.15) this.nextBlink = t + 0.28; // a double blink now and then
    }

    // ── Secondary motion.
    const bank = clamp(vx / 4, -1, 1);
    const flutter = Math.min(1, this.speed / 3);
    this.root.step(bank * 0.12, dt);
    this.hair.step(clamp(vx * 0.09, -0.6, 0.6) + Math.sin(t * 1.4) * 0.05 + vy * 0.02, dt);
    this.hem.step(clamp(vx * 0.07, -0.45, 0.45) + Math.sin(t * 2.2) * 0.03 + Math.sin(t * 11) * 0.035 * flutter, dt);
    this.acc.step(clamp(vx * 0.12, -0.6, 0.6) + Math.sin(t * 3) * 0.05, dt);
    this.prop.step(clamp(vx * 0.16, -1, 1), dt);
    this.back.step(-bank * 0.25 + Math.sin(t * 1.6) * 0.05 - vy * 0.04, dt);
    const tilt = -bank * 0.1 + (quirking ? this.quirkTilt * Math.sin(Math.min(1, (this.quirkUntil - t) / 1.2) * Math.PI) : 0);
    this.head.step(tilt + Math.sin(t * 0.9) * 0.03, dt);

    // Arms: idle sway, trailing when moving, gathered in when focused, raised for Litanies.
    let l = 0.14 + Math.sin(t * 1.8) * 0.05 + vx * 0.05;
    let r = -0.14 - Math.sin(t * 1.8 + 0.6) * 0.05 + vx * 0.05;
    if (this.focus) {
      l = -0.3;
      r = 0.3;
    }
    if (this.reaction === 'cast') {
      const k = Math.sin(Math.min(1, this.reactionT / REACTION_TIME.cast) * Math.PI);
      l += 2.2 * k;
      r -= 2.2 * k;
    } else if (this.reaction === 'skill') {
      r -= 1.5 * Math.sin(Math.min(1, this.reactionT / REACTION_TIME.skill) * Math.PI);
    } else if (this.reaction === 'joy') {
      const k = Math.sin(Math.min(1, this.reactionT / REACTION_TIME.joy) * Math.PI);
      l += 0.9 * k;
      r -= 0.9 * k;
    }
    this.armL.step(l, dt);
    this.armR.step(r, dt);
  }

  private headKind(): HeadKind {
    if (this.hurt || this.reaction === 'hurt') return 'hurt';
    if (this.reaction === 'joy') return 'happy';
    if (this.reaction === 'soft') return 'closed';
    if (this.char === 'wren' && this.t < this.quirkUntil) return 'closed';
    if (this.t < this.blinkUntil) return 'closed';
    if (this.focus || this.reaction === 'cast' || this.reaction === 'skill') return 'half';
    return 'open';
  }

  /**
   * Draw the puppet at (x, y). A tint and alpha draw it as an afterimage or ghost.
   * Computes each part's joint and angle from its parent, then places the sprite
   * so it rotates about that joint.
   */
  draw(batch: SpriteBatch, rig: Rig, x: number, y: number, alpha = 1, tint: readonly [number, number, number] = [1, 1, 1], scale = 1): void {
    const t = this.t;
    const breath = Math.sin(t * 2.4);
    const hopY = -Math.sin((1 - this.hop) * Math.PI) * 5 * (this.hop > 0 ? 1 : 0);
    const shakeX = this.reaction === 'hurt' ? Math.sin(t * 70) * 1.2 * (1 - this.reactionT / REACTION_TIME.hurt) : 0;
    const rootA = this.root.x;
    const sx = scale * (1 - Math.abs(rootA) * 0.25);
    const sy = scale * (1 + breath * 0.012 + Math.abs(rootA) * 0.12);
    const n = rig.parts.length;
    const jx = new Float32Array(n);
    const jy = new Float32Array(n);
    const ang = new Float32Array(n);
    // Joints are resolved parents-first; rigs list hair before its head, so do two passes.
    const done = new Uint8Array(n);
    const resolve = (i: number): void => {
      if (done[i]) return;
      const p = rig.parts[i];
      let px = x + shakeX;
      let py = y + hopY;
      let pa = rootA;
      if (p.parent >= 0) {
        resolve(p.parent);
        px = jx[p.parent];
        py = jy[p.parent];
        pa = ang[p.parent];
      }
      const c = Math.cos(pa);
      const s = Math.sin(pa);
      const ax = p.attach[0] * sx;
      const ay = p.attach[1] * sy;
      jx[i] = px + ax * c - ay * s;
      jy[i] = py + ax * s + ay * c;
      ang[i] = pa * p.inherit + this.driveAngle(p.drive);
      done[i] = 1;
    };
    for (let i = 0; i < n; i++) resolve(i);

    const head = this.headKind();
    this.glowAt.on = false;
    for (let i = 0; i < n; i++) {
      const p = rig.parts[i];
      const a = ang[i];
      const c = Math.cos(a);
      const s = Math.sin(a);
      const pvx = p.pivot[0] * sx;
      const pvy = p.pivot[1] * sy;
      const cx = jx[i] - (pvx * c - pvy * s);
      const cy = jy[i] - (pvx * s + pvy * c);
      const sprite = p.heads ? p.heads[head] : p.sprite;
      batch.push(sprite, cx, cy, a, sx, tint[0], tint[1], tint[2], alpha, 0, 0, sy / sx);
      if (rig.glow && rig.glow.part === i) {
        const o = rig.glow.offset;
        this.glowAt.x = cx + o[0] * c - o[1] * s;
        this.glowAt.y = cy + o[0] * s + o[1] * c;
        this.glowAt.on = true;
      }
    }
  }

  private driveAngle(d: string): number {
    switch (d) {
      case 'head':
        return this.head.x;
      case 'hair':
        return this.hair.x;
      case 'hem':
        return this.hem.x;
      case 'armL':
        return this.armL.x;
      case 'armR':
        return this.armR.x;
      case 'prop':
        return this.prop.x;
      case 'acc':
        return this.acc.x;
      case 'back':
        return this.back.x;
      default:
        return 0;
    }
  }
}
