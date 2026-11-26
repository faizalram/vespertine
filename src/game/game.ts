import { Rng } from '../core/rng';
import { Scheduler, wait, type Task } from '../core/scheduler';
import { BULLET_TYPES } from './bulletTypes';
import { FIELD_H, FIELD_W, SPAWN_GRACE, TAU } from './constants';
import { C } from './palette';
import { BF_GRAZED, BulletPool, FxPool, ShotPool, type BulletSpawn, type BurstEvent } from './pools';
import { S } from './sprites';

/** One tick of player intent, already merged from keyboard, gamepad and touch. */
export interface InputFrame {
  /** Digital direction (-1..1 per axis). */
  mx: number;
  my: number;
  /** Relative touch/mouse-drag movement in field units this tick. */
  tx: number;
  ty: number;
  shoot: boolean;
  focus: boolean;
  bomb: boolean;
  skill: boolean;
}

export const EMPTY_INPUT: InputFrame = { mx: 0, my: 0, tx: 0, ty: 0, shoot: false, focus: false, bomb: false, skill: false };

export type GameEvent =
  | 'graze' | 'shot' | 'death' | 'bomb' | 'declare' | 'phaseEnd'
  | 'gameover' | 'vigil' | 'bossHit' | 'cycle';

/** A boss phase: either a regular attack (name null) or a named Elegy. */
export interface PhaseDef {
  elegy: string | null;
  hp: number;
  /** Seconds. */
  time: number;
  /** Boss cannot be damaged; survive until the timer ends. */
  survival?: boolean;
  run: (g: Game) => Task;
}

/** Sayo Kagari's tuning (spec §3.1). */
export const SAYO = {
  speed: 4.0,
  focusSpeed: 2.0,
  hitR: 2.5,
  grazeR: 16,
  bombs: 3,
  deathbombFrames: 8,
  vigilFrames: 300,
  vigilRadius: 56,
  vigilRecharge: 1 / 1200,
  bombInvuln: 270,
} as const;

const EMITTERS_WIDE: ReadonlyArray<readonly [number, number]> = [[-26, 6], [26, 6], [-15, -14], [15, -14]];
const EMITTERS_FOCUS: ReadonlyArray<readonly [number, number]> = [[-12, -12], [12, -12], [-5, -22], [5, -22]];

export class Player {
  x = FIELD_W / 2;
  y = FIELD_H - 48;
  lives = 3;
  bombs: number = SAYO.bombs;
  power = 4;
  invuln = 120;
  /** Frames left in the deathbomb window; -1 when not hit. */
  deathTimer = -1;
  focus = false;
  focusBlend = 0;
  stillFrames = 0;
  vigilMeter = 1;
  shotTimer = 0;
  moving = false;
  readonly emitters: Array<[number, number]> = [[0, 0], [0, 0], [0, 0], [0, 0]];

  get patience(): number {
    return 1 + (Math.min(this.stillFrames, 120) / 120) * 0.2;
  }
}

export class Boss {
  x = FIELD_W / 2;
  y = -60;
  hp = 0;
  maxHp = 1;
  phase = -1;
  timer = 0;
  maxTimer = 1;
  vulnerable = false;
  present = false;
  elegy: string | null = null;
  survival = false;
  readonly hitR = 30;
  readonly name = 'Training Effigy';
}

export interface BombState {
  active: boolean;
  t: number;
  r: number;
}

export interface VigilState {
  active: boolean;
  t: number;
  x: number;
  y: number;
}

export class Game {
  readonly rng: Rng;
  frame = 0;
  readonly bullets = new BulletPool(4096);
  readonly shots = new ShotPool(512);
  readonly fx = new FxPool(3072);
  readonly sched = new Scheduler();
  readonly player = new Player();
  readonly boss = new Boss();
  readonly bomb: BombState = { active: false, t: 0, r: 0 };
  readonly vigil: VigilState = { active: false, t: 0, x: 0, y: 0 };
  readonly events: GameEvent[] = [];
  score = 0;
  graze = 0;
  over = false;
  cycle = 0;
  flash = 0;
  shake = 0;
  private phases: readonly PhaseDef[];
  private burstHandlers = new Map<number, (g: Game, e: BurstEvent) => void>();

  constructor(phases: readonly PhaseDef[], seed = 20261126, startPhase = 0) {
    this.rng = new Rng(seed);
    this.phases = phases;
    this.sched.add(this.bossIntro(startPhase));
  }

  onBurst(kind: number, fn: (g: Game, e: BurstEvent) => void): void {
    this.burstHandlers.set(kind, fn);
  }

  // ───────────────────────────────── tick ─────────────────────────────────

  tick(inp: InputFrame): void {
    this.events.length = 0;
    if (this.over) {
      this.fx.update();
      return;
    }
    this.frame++;
    this.updatePlayer(inp);
    this.sched.tick();
    this.updateBoss();
    const v = this.vigil;
    if (v.active) this.bullets.update(v.x, v.y, SAYO.vigilRadius, 0.5);
    else this.bullets.update();
    for (const e of this.bullets.bursts) this.burstHandlers.get(e.kind)?.(this, e);
    this.updateShots();
    this.updateBomb();
    this.collidePlayer();
    this.fx.update();
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.04);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.3);
  }

  // ──────────────────────────────── player ────────────────────────────────

  private updatePlayer(inp: InputFrame): void {
    const p = this.player;
    if (p.invuln > 0) p.invuln--;

    if (p.deathTimer >= 0) {
      if (inp.bomb && p.bombs > 0) {
        p.deathTimer = -1;
        this.startBomb();
      } else if (p.deathTimer-- === 0) {
        this.killPlayer();
        return;
      }
      return; // frozen while the deathbomb window is open
    }

    p.focus = inp.focus;
    p.focusBlend += ((p.focus ? 1 : 0) - p.focusBlend) * 0.25;

    const speed = p.focus ? SAYO.focusSpeed : SAYO.speed;
    let dx = inp.mx;
    let dy = inp.my;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    dx *= speed;
    dy *= speed;
    // Relative drag moves 1:1 (scaled down while focused for precision), capped to avoid teleporting.
    const touchScale = p.focus ? 0.6 : 1;
    let tx = inp.tx * touchScale;
    let ty = inp.ty * touchScale;
    const tl = Math.hypot(tx, ty);
    const cap = 14;
    if (tl > cap) {
      tx = (tx / tl) * cap;
      ty = (ty / tl) * cap;
    }
    dx += tx;
    dy += ty;
    p.moving = Math.abs(dx) + Math.abs(dy) > 0.05;
    p.x = Math.min(FIELD_W - 8, Math.max(8, p.x + dx));
    p.y = Math.min(FIELD_H - 16, Math.max(16, p.y + dy));
    p.stillFrames = p.focus && !p.moving ? p.stillFrames + 1 : 0;

    for (let i = 0; i < 4; i++) {
      const w = EMITTERS_WIDE[i];
      const f = EMITTERS_FOCUS[i];
      const b = p.focusBlend;
      const bob = Math.sin(this.frame * 0.08 + i * 1.7) * 1.5;
      p.emitters[i][0] = p.x + w[0] + (f[0] - w[0]) * b;
      p.emitters[i][1] = p.y + w[1] + (f[1] - w[1]) * b + bob;
    }

    if (inp.bomb && p.bombs > 0 && !this.bomb.active) this.startBomb();

    if (inp.skill && p.vigilMeter >= 1 && !this.vigil.active) {
      p.vigilMeter = 0;
      Object.assign(this.vigil, { active: true, t: 0, x: p.x, y: p.y });
      this.events.push('vigil');
    }
    if (this.vigil.active) {
      if (++this.vigil.t >= SAYO.vigilFrames) this.vigil.active = false;
    } else if (p.vigilMeter < 1) {
      p.vigilMeter = Math.min(1, p.vigilMeter + SAYO.vigilRecharge);
    }

    if (inp.shoot) this.fireSayo();
  }

  private fireSayo(): void {
    const p = this.player;
    const t = p.shotTimer++;
    if (t % 6 === 0) this.events.push('shot');
    if (p.focus) {
      // Wick Lance: steady narrow beam; grows stronger while standing still (Patient Flame).
      const dmg = 2.2 * p.patience;
      if (t % 2 === 0) {
        this.shots.spawn(p.x - 4, p.y - 12, 0, -14, dmg, S.lance);
        this.shots.spawn(p.x + 4, p.y - 12, 0, -14, dmg, S.lance);
      }
      if (t % 4 === 0) {
        for (const [ex, ey] of p.emitters) this.shots.spawn(ex, ey - 6, 0, -13, 0.8 * p.patience, S.lance);
      }
    } else {
      // Will-o'-Wisps: main needles plus gently homing wisps from each emitter.
      if (t % 4 === 0) {
        this.shots.spawn(p.x - 6, p.y - 10, 0, -12, 2.0, S.lance);
        this.shots.spawn(p.x + 6, p.y - 10, 0, -12, 2.0, S.lance);
      }
      if (t % 8 === 0) {
        for (let i = 0; i < 4; i++) {
          const [ex, ey] = p.emitters[i];
          const spread = (i % 2 === 0 ? -1 : 1) * (i < 2 ? 0.45 : 0.18);
          const a = -Math.PI / 2 + spread;
          this.shots.spawn(ex, ey, Math.cos(a) * 7, Math.sin(a) * 7, 2.6, S.wisp, 1);
        }
      }
    }
  }

  private startBomb(): void {
    const p = this.player;
    p.bombs--;
    p.invuln = Math.max(p.invuln, SAYO.bombInvuln);
    Object.assign(this.bomb, { active: true, t: 0, r: 0 });
    this.flash = 0.6;
    this.shake = 6;
    this.events.push('bomb');
  }

  private updateBomb(): void {
    const b = this.bomb;
    if (!b.active) return;
    b.t++;
    const k = Math.min(1, b.t / 100);
    b.r = (1 - (1 - k) * (1 - k)) * 380;
    const p = this.player;
    const r2 = b.r * b.r;
    const bl = this.bullets;
    for (let i = 0; i < bl.n; i++) {
      const dx = bl.x[i] - p.x;
      const dy = bl.y[i] - p.y;
      if (dx * dx + dy * dy < r2) {
        this.cancelFx(i);
        this.score += 50;
        bl.remove(i);
        i--;
      }
    }
    const boss = this.boss;
    if (boss.vulnerable && b.t < 140 && Math.hypot(boss.x - p.x, boss.y - p.y) < b.r + boss.hitR) {
      boss.hp -= 3.5;
    }
    if (b.t >= 160) b.active = false;
  }

  private collidePlayer(): void {
    const p = this.player;
    if (p.deathTimer >= 0) return;
    const bl = this.bullets;
    const px = p.x;
    const py = p.y;
    for (let i = 0; i < bl.n; i++) {
      if (bl.age[i] < SPAWN_GRACE) continue;
      const dx = bl.x[i] - px;
      const dy = bl.y[i] - py;
      const d2 = dx * dx + dy * dy;
      const r = BULLET_TYPES[bl.type[i]].hitR;
      const gr = SAYO.grazeR + r;
      if (d2 > gr * gr) continue;
      const hr = SAYO.hitR + r;
      if (d2 < hr * hr && p.invuln === 0) {
        p.deathTimer = SAYO.deathbombFrames;
        return;
      }
      if (!(bl.flags[i] & BF_GRAZED)) {
        bl.flags[i] |= BF_GRAZED;
        this.graze++;
        this.score += 200;
        const a = this.rng.range(0, TAU);
        this.fx.spawn(px, py, Math.cos(a) * 2.5, Math.sin(a) * 2.5, 14, S.spark, C.white, 0.45, 0.1, 0.9);
        this.events.push('graze');
      }
    }
  }

  private killPlayer(): void {
    const p = this.player;
    p.lives--;
    this.events.push('death');
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU;
      this.fx.spawn(p.x, p.y, Math.cos(a) * 6, Math.sin(a) * 6, 40, S.spark, C.amber, 1.4, 0.2);
    }
    this.cancelAllBullets();
    this.shake = 10;
    if (p.lives < 0) {
      p.lives = 0;
      this.over = true;
      this.events.push('gameover');
      return;
    }
    p.invuln = 180;
    p.bombs = Math.max(p.bombs, SAYO.bombs);
    p.x = FIELD_W / 2;
    p.y = FIELD_H - 48;
  }

  // ──────────────────────────────── shots ─────────────────────────────────

  private updateShots(): void {
    const s = this.shots;
    const boss = this.boss;
    const target = boss.present && boss.y > 0;
    for (let i = 0; i < s.n; i++) {
      s.age[i]++;
      if (s.homing[i] && target) {
        const want = Math.atan2(boss.y - s.y[i], boss.x - s.x[i]);
        const cur = Math.atan2(s.vy[i], s.vx[i]);
        let d = want - cur;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const turn = Math.max(-0.12, Math.min(0.12, d));
        const sp = Math.min(9, Math.hypot(s.vx[i], s.vy[i]) + 0.15);
        s.vx[i] = Math.cos(cur + turn) * sp;
        s.vy[i] = Math.sin(cur + turn) * sp;
      }
      s.x[i] += s.vx[i];
      s.y[i] += s.vy[i];
      const x = s.x[i];
      const y = s.y[i];
      if (target) {
        const dx = x - boss.x;
        const dy = y - boss.y;
        if (dx * dx + dy * dy < boss.hitR * boss.hitR) {
          if (boss.vulnerable) {
            boss.hp -= s.dmg[i];
            this.score += 10;
            if (s.age[i] % 3 === 0) this.events.push('bossHit');
          }
          if ((this.frame + i) % 3 === 0) {
            this.fx.spawn(x, y + 4, this.rng.range(-1.5, 1.5), this.rng.range(-3, -1), 10, S.spark, C.amber, 0.5, 0.1, 0.8);
          }
          s.remove(i);
          i--;
          continue;
        }
      }
      if (y < -24 || y > FIELD_H + 24 || x < -24 || x > FIELD_W + 24) {
        s.remove(i);
        i--;
      }
    }
  }

  // ───────────────────────────────── boss ─────────────────────────────────

  private *bossIntro(startPhase: number): Task {
    const b = this.boss;
    b.present = true;
    yield* this.moveBoss(FIELD_W / 2, 110, 90);
    this.startPhase(startPhase);
  }

  /** Debug: skip straight to a phase. */
  jumpTo(i: number): void {
    if (i < 0 || i >= this.phases.length) return;
    this.cancelAllBullets();
    this.boss.present = true;
    this.boss.x = FIELD_W / 2;
    this.boss.y = 110;
    this.startPhase(i);
  }

  private startPhase(i: number): void {
    const def = this.phases[i];
    const b = this.boss;
    this.sched.clear();
    b.phase = i;
    b.hp = b.maxHp = def.hp;
    b.timer = b.maxTimer = def.time * 60;
    b.elegy = def.elegy;
    b.survival = !!def.survival;
    b.vulnerable = !def.survival;
    if (def.elegy) this.events.push('declare');
    this.sched.add(def.run(this));
  }

  private updateBoss(): void {
    const b = this.boss;
    if (!b.present || b.phase < 0 || !b.vulnerable && !b.survival) return;
    b.timer--;
    if (b.hp <= 0 || b.timer <= 0) this.endPhase();
  }

  private endPhase(): void {
    const b = this.boss;
    b.vulnerable = false;
    b.survival = false;
    b.elegy = null;
    this.cancelAllBullets();
    this.score += 100000;
    this.events.push('phaseEnd');
    this.sched.clear();
    let next = b.phase + 1;
    if (next >= this.phases.length) {
      next = 0;
      this.cycle++;
      this.events.push('cycle');
    }
    this.sched.add(this.phaseGap(next));
  }

  private *phaseGap(next: number): Task {
    yield* this.moveBoss(FIELD_W / 2, 110, 60);
    yield* wait(20);
    this.startPhase(next);
  }

  /** Eased movement; yields until done. */
  *moveBoss(tx: number, ty: number, frames: number): Task {
    const b = this.boss;
    const sx = b.x;
    const sy = b.y;
    for (let f = 1; f <= frames; f++) {
      const k = f / frames;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      b.x = sx + (tx - sx) * e;
      b.y = sy + (ty - sy) * e;
      yield;
    }
  }

  /** Background task: drift to a random nearby spot every few seconds. */
  *wander(every = 200, frames = 70): Task {
    for (;;) {
      yield* wait(every);
      const b = this.boss;
      const tx = Math.max(96, Math.min(FIELD_W - 96, b.x + this.rng.range(40, 90) * this.rng.sign()));
      const ty = this.rng.range(80, 140);
      yield* this.moveBoss(tx, ty, frames);
    }
  }

  // ───────────────────────────── bullet helpers ───────────────────────────

  spawn(b: BulletSpawn): void {
    this.bullets.spawn(b);
  }

  ring(x: number, y: number, count: number, speed: number, offset: number, type: number, color: number, extra: Partial<BulletSpawn> = {}): void {
    for (let k = 0; k < count; k++) {
      this.bullets.spawn({ ...extra, x, y, speed, angle: offset + (k / count) * TAU, type, color });
    }
  }

  fan(x: number, y: number, count: number, spread: number, speed: number, center: number, type: number, color: number, extra: Partial<BulletSpawn> = {}): void {
    for (let k = 0; k < count; k++) {
      const a = count === 1 ? center : center + (k / (count - 1) - 0.5) * spread * (count - 1);
      this.bullets.spawn({ ...extra, x, y, speed, angle: a, type, color });
    }
  }

  aimAt(x: number, y: number): number {
    return Math.atan2(this.player.y - y, this.player.x - x);
  }

  private cancelFx(i: number): void {
    const bl = this.bullets;
    this.fx.spawn(bl.x[i], bl.y[i], 0, -0.6, 18, S.spark, bl.color[i], 0.7, 0.15, 0.8);
  }

  cancelAllBullets(): void {
    const bl = this.bullets;
    for (let i = 0; i < bl.n; i++) this.cancelFx(i);
    bl.clear();
  }
}
