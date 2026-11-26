import { FIELD_H, FIELD_W } from './constants';

/**
 * Struct-of-arrays pools. Nothing allocates during gameplay; removal swaps the
 * last live element into the freed slot, so live elements are always [0, n).
 */

export const BF_GRAZED = 1;

export interface BulletSpawn {
  x: number;
  y: number;
  speed: number;
  angle: number;
  type: number;
  color: number;
  /** Per-frame speed change; speed moves toward `target`. */
  accel?: number;
  target?: number;
  /** Per-frame turning (radians). */
  angVel?: number;
  /** If > 0, the bullet is removed at this age and reported as a burst event. */
  burstAt?: number;
  burstKind?: number;
}

export interface BurstEvent {
  x: number;
  y: number;
  color: number;
  kind: number;
}

export class BulletPool {
  readonly cap: number;
  n = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly speed: Float32Array;
  readonly angle: Float32Array;
  readonly accel: Float32Array;
  readonly target: Float32Array;
  readonly angVel: Float32Array;
  readonly type: Uint8Array;
  readonly color: Uint8Array;
  readonly flags: Uint8Array;
  readonly age: Int32Array;
  readonly burstAt: Int32Array;
  readonly burstKind: Uint8Array;
  readonly bursts: BurstEvent[] = [];

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.speed = new Float32Array(cap);
    this.angle = new Float32Array(cap);
    this.accel = new Float32Array(cap);
    this.target = new Float32Array(cap);
    this.angVel = new Float32Array(cap);
    this.type = new Uint8Array(cap);
    this.color = new Uint8Array(cap);
    this.flags = new Uint8Array(cap);
    this.age = new Int32Array(cap);
    this.burstAt = new Int32Array(cap);
    this.burstKind = new Uint8Array(cap);
  }

  spawn(b: BulletSpawn): number {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    this.x[i] = b.x;
    this.y[i] = b.y;
    this.speed[i] = b.speed;
    this.angle[i] = b.angle;
    this.accel[i] = b.accel ?? 0;
    this.target[i] = b.target ?? b.speed;
    this.angVel[i] = b.angVel ?? 0;
    this.type[i] = b.type;
    this.color[i] = b.color;
    this.flags[i] = 0;
    this.age[i] = 0;
    this.burstAt[i] = b.burstAt ?? 0;
    this.burstKind[i] = b.burstKind ?? 0;
    return i;
  }

  remove(i: number): void {
    const j = --this.n;
    if (i === j) return;
    this.x[i] = this.x[j];
    this.y[i] = this.y[j];
    this.speed[i] = this.speed[j];
    this.angle[i] = this.angle[j];
    this.accel[i] = this.accel[j];
    this.target[i] = this.target[j];
    this.angVel[i] = this.angVel[j];
    this.type[i] = this.type[j];
    this.color[i] = this.color[j];
    this.flags[i] = this.flags[j];
    this.age[i] = this.age[j];
    this.burstAt[i] = this.burstAt[j];
    this.burstKind[i] = this.burstKind[j];
  }

  clear(): void {
    this.n = 0;
  }

  /**
   * Advance every bullet one tick. Bullets inside the optional slow zone
   * (Sayo's Vigil) move at `slowFactor` speed.
   */
  update(slowX = 0, slowY = 0, slowR = 0, slowFactor = 1): void {
    const margin = 40;
    const slowR2 = slowR * slowR;
    this.bursts.length = 0;
    for (let i = 0; i < this.n; i++) {
      const age = ++this.age[i];
      const ba = this.burstAt[i];
      if (ba > 0 && age >= ba) {
        this.bursts.push({ x: this.x[i], y: this.y[i], color: this.color[i], kind: this.burstKind[i] });
        this.remove(i);
        i--;
        continue;
      }
      const acc = this.accel[i];
      if (acc !== 0) {
        let s = this.speed[i] + acc;
        const t = this.target[i];
        if ((acc > 0 && s > t) || (acc < 0 && s < t)) s = t;
        this.speed[i] = s;
      }
      const a = (this.angle[i] += this.angVel[i]);
      let v = this.speed[i];
      if (slowR2 > 0) {
        const dx = this.x[i] - slowX;
        const dy = this.y[i] - slowY;
        if (dx * dx + dy * dy < slowR2) v *= slowFactor;
      }
      const x = (this.x[i] += Math.cos(a) * v);
      const y = (this.y[i] += Math.sin(a) * v);
      if (x < -margin || x > FIELD_W + margin || y < -margin || y > FIELD_H + margin) {
        this.remove(i);
        i--;
      }
    }
  }
}

/** Player shots. */
export class ShotPool {
  readonly cap: number;
  n = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly dmg: Float32Array;
  readonly sprite: Uint8Array;
  readonly homing: Uint8Array;
  readonly age: Int32Array;

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.dmg = new Float32Array(cap);
    this.sprite = new Uint8Array(cap);
    this.homing = new Uint8Array(cap);
    this.age = new Int32Array(cap);
  }

  spawn(x: number, y: number, vx: number, vy: number, dmg: number, sprite: number, homing = 0): void {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.dmg[i] = dmg;
    this.sprite[i] = sprite;
    this.homing[i] = homing;
    this.age[i] = 0;
  }

  remove(i: number): void {
    const j = --this.n;
    if (i === j) return;
    this.x[i] = this.x[j];
    this.y[i] = this.y[j];
    this.vx[i] = this.vx[j];
    this.vy[i] = this.vy[j];
    this.dmg[i] = this.dmg[j];
    this.sprite[i] = this.sprite[j];
    this.homing[i] = this.homing[j];
    this.age[i] = this.age[j];
  }

  clear(): void {
    this.n = 0;
  }
}

/** Purely visual particles (sparks, cancelled-bullet flashes). Rendered additively. */
export class FxPool {
  readonly cap: number;
  n = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly life: Float32Array;
  readonly maxLife: Float32Array;
  readonly s0: Float32Array;
  readonly s1: Float32Array;
  readonly a0: Float32Array;
  readonly rot: Float32Array;
  readonly sprite: Uint8Array;
  readonly color: Uint8Array;

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    this.s0 = new Float32Array(cap);
    this.s1 = new Float32Array(cap);
    this.a0 = new Float32Array(cap);
    this.rot = new Float32Array(cap);
    this.sprite = new Uint8Array(cap);
    this.color = new Uint8Array(cap);
  }

  spawn(
    x: number, y: number, vx: number, vy: number, life: number,
    sprite: number, color: number, s0: number, s1: number, a0 = 1, rot = 0,
  ): void {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.sprite[i] = sprite;
    this.color[i] = color;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.a0[i] = a0;
    this.rot[i] = rot;
  }

  update(): void {
    for (let i = 0; i < this.n; i++) {
      if (--this.life[i] <= 0) {
        const j = --this.n;
        if (i !== j) {
          this.x[i] = this.x[j];
          this.y[i] = this.y[j];
          this.vx[i] = this.vx[j];
          this.vy[i] = this.vy[j];
          this.life[i] = this.life[j];
          this.maxLife[i] = this.maxLife[j];
          this.sprite[i] = this.sprite[j];
          this.color[i] = this.color[j];
          this.s0[i] = this.s0[j];
          this.s1[i] = this.s1[j];
          this.a0[i] = this.a0[j];
          this.rot[i] = this.rot[j];
        }
        i--;
        continue;
      }
      this.x[i] += this.vx[i];
      this.y[i] += this.vy[i];
      this.vx[i] *= 0.94;
      this.vy[i] *= 0.94;
    }
  }

  clear(): void {
    this.n = 0;
  }
}

/** Items: power, points, fragments and the small stars that cancelled bullets turn into. */
export class ItemPool {
  readonly cap: number;
  n = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly type: Uint8Array;
  /** 1 = flying toward the player. */
  readonly homing: Uint8Array;
  readonly age: Int32Array;

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.type = new Uint8Array(cap);
    this.homing = new Uint8Array(cap);
    this.age = new Int32Array(cap);
  }

  spawn(x: number, y: number, type: number, vx = 0, vy = -2.4, homing = 0): void {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.type[i] = type;
    this.homing[i] = homing;
    this.age[i] = 0;
  }

  remove(i: number): void {
    const j = --this.n;
    if (i === j) return;
    this.x[i] = this.x[j];
    this.y[i] = this.y[j];
    this.vx[i] = this.vx[j];
    this.vy[i] = this.vy[j];
    this.type[i] = this.type[j];
    this.homing[i] = this.homing[j];
    this.age[i] = this.age[j];
  }

  clear(): void {
    this.n = 0;
  }
}
