import { Rng } from '../core/rng';
import { Scheduler, wait, type Task } from '../core/scheduler';
import { BULLET_TYPES } from './bulletTypes';
import { FIELD_H, FIELD_W, SPAWN_GRACE, TAU } from './constants';
import { CHARACTERS, CharState, type CharacterDef } from './characters';
import { IT, type Behavior, type BossDef, type CharId, type DialogueDef, type DifficultyId, type EnemyDef, type StageInfo } from './defs';
import { C } from './palette';
import { BF_GRAZED, BulletPool, FxPool, ItemPool, ShotPool, SK, type BulletSpawn, type BurstEvent } from './pools';
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
  /** Edge: advance dialogue. */
  advance: boolean;
  /** Held: fast-forward dialogue. */
  skip: boolean;
}

export const EMPTY_INPUT: InputFrame = {
  mx: 0, my: 0, tx: 0, ty: 0, shoot: false, focus: false, bomb: false, skill: false, advance: false, skip: false,
};

export type GameEvent =
  | 'graze' | 'shot' | 'death' | 'bomb' | 'declare' | 'phaseEnd' | 'gameover' | 'vigil'
  | 'bossHit' | 'enemyHit' | 'enemyDie' | 'item' | 'extend' | 'bombGet' | 'fullPower'
  | 'capture' | 'captureFail' | 'bossEnter' | 'bossDefeat' | 'bossIntro' | 'music'
  | 'stageCard' | 'stageClear' | 'dialogueLine' | 'dialogueEnd' | 'skill' | 'dollCrack';

/** Point-of-collection line: above it, every item flies to the player (spec §7.3). */
export const POC_Y = FIELD_H * 0.28;
const EXTEND_SCORES = [10_000_000, 25_000_000, 50_000_000, 80_000_000];
const MAX_LIVES = 8;
const MAX_BOMBS = 8;

export class Player {
  x = FIELD_W / 2;
  y = FIELD_H - 48;
  lives = 3;
  bombs = 3;
  power = 1;
  invuln = 120;
  /** Frames left in the deathbomb window; -1 when not hit. */
  deathTimer = -1;
  focus = false;
  focusBlend = 0;
  stillFrames = 0;
  shotTimer = 0;
  moving = false;
  emitterCount = 1;
  readonly emitters: Array<[number, number]> = [[0, 0], [0, 0], [0, 0], [0, 0]];
}

let nextEnemyId = 1;

export class Enemy {
  readonly id = nextEnemyId++;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  hp = 1;
  maxHp = 1;
  r = 10;
  sprite = 0;
  orient = false;
  drops: ReadonlyArray<number> = [];
  score = 100;
  age = 0;
  flash = 0;
  alive = true;
  /** Frames left Charted by Ilse's Survey Ray (+25% damage taken). */
  charted = 0;
  /** Decorative/familiar: ignores shots, bombs and player contact. */
  intangible = false;
  task: Task | null = null;
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
  /** A phase is running (timer ticking). */
  active = false;
  phaseDone = false;
  timedOut = false;
  /** No deaths or bombs during this phase. */
  clean = true;
  elegy: string | null = null;
  survival = false;
  jump = -1;
  def: BossDef | null = null;
  flash = 0;
  /** Beaten, but still on screen for the closing dialogue. */
  defeated = false;
  charted = 0;

  get hitR(): number {
    return this.def?.hitR ?? 30;
  }
}

export interface BombState {
  active: boolean;
  t: number;
  r: number;
  x: number;
  y: number;
}

export interface DialogueState {
  def: DialogueDef;
  i: number;
  age: number;
}

export interface CaptureInfo {
  name: string;
  bonus: number;
  captured: boolean;
}

export interface StageResults {
  stage: number;
  clearBonus: number;
  captures: number;
  elegies: number;
  graze: number;
  score: number;
}

export interface GameOptions {
  seed?: number;
  difficulty?: DifficultyId;
  /** Debug: where the stage script should begin. */
  startAt?: 'start' | 'midboss' | 'boss';
  char?: CharId;
}

/** Dialogue typewriter speed in characters per frame. */
export const DIALOGUE_CPF = 1.2;

export class Game {
  readonly rng: Rng;
  readonly diff: DifficultyId;
  readonly startAt: 'start' | 'midboss' | 'boss';
  frame = 0;
  readonly bullets = new BulletPool(4096);
  readonly shots = new ShotPool(512);
  readonly fx = new FxPool(3072);
  readonly items = new ItemPool(1024);
  readonly enemies: Enemy[] = [];
  readonly stageSched = new Scheduler();
  readonly patternSched = new Scheduler();
  readonly player = new Player();
  readonly boss = new Boss();
  readonly bomb: BombState = { active: false, t: 0, r: 0, x: 0, y: 0 };
  readonly char: CharacterDef;
  readonly cs = new CharState();
  readonly events: GameEvent[] = [];
  score = 0;
  graze = 0;
  over = false;
  cleared = false;
  credits = 3;
  continuesUsed = 0;
  lifeFrags = 0;
  bombFrags = 0;
  captures = 0;
  elegiesSeen = 0;
  flash = 0;
  shake = 0;
  music = '';
  stageInfo: StageInfo | null = null;
  dialogue: DialogueState | null = null;
  lastCapture: CaptureInfo | null = null;
  results: StageResults | null = null;
  private extendIndex = 0;
  private autoCollect = 0;
  private burstHandlers = new Map<number, (g: Game, e: BurstEvent) => void>();

  constructor(script: (g: Game) => Task, opts: GameOptions = {}) {
    this.rng = new Rng(opts.seed ?? 20261126);
    this.diff = opts.difficulty ?? 1;
    this.startAt = opts.startAt ?? 'start';
    this.char = CHARACTERS[opts.char ?? 'sayo'];
    this.player.lives = this.startingLives;
    this.player.bombs = this.char.bombs;
    this.stageSched.add(script(this));
  }

  get startingLives(): number {
    return this.diff === 0 ? 5 : 3;
  }

  /** Pick a value by difficulty: pick(gentle, dusk, midnight, requiem). Missing entries reuse the last. */
  pick<T>(...v: T[]): T {
    return v[Math.min(this.diff, v.length - 1)];
  }

  get pointValue(): number {
    return 10_000 + this.graze * 10;
  }

  onBurst(kind: number, fn: (g: Game, e: BurstEvent) => void): void {
    this.burstHandlers.set(kind, fn);
  }

  // ───────────────────────────────── tick ─────────────────────────────────

  tick(inp: InputFrame): void {
    this.events.length = 0;
    if (this.over || this.cleared) {
      this.fx.update();
      return;
    }
    this.frame++;
    this.updateDialogue(inp);
    this.updatePlayer(inp);
    this.stageSched.tick();
    this.patternSched.tick();
    this.updateEnemies();
    this.updateBoss();
    const z = this.char.slowZone?.(this);
    if (z) this.bullets.update(z[0], z[1], z[2], z[3]);
    else this.bullets.update();
    for (const e of this.bullets.bursts) this.burstHandlers.get(e.kind)?.(this, e);
    this.updateShots();
    this.updateItems();
    this.updateBomb();
    this.collidePlayer();
    this.fx.update();
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.04);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.3);
    if (this.autoCollect > 0) this.autoCollect--;
    while (this.extendIndex < EXTEND_SCORES.length && this.score >= EXTEND_SCORES[this.extendIndex]) {
      this.extendIndex++;
      this.extend();
    }
  }

  // ─────────────────────────────── dialogue ───────────────────────────────

  *runDialogue(def: DialogueDef): Task {
    this.cancelAllBullets();
    this.dialogue = { def, i: 0, age: 0 };
    this.applyLine();
    while (this.dialogue) yield;
  }

  private applyLine(): void {
    const d = this.dialogue!;
    const line = d.def.lines[d.i];
    if (line.music) this.setMusic(line.music);
    if (line.bossIntro) this.events.push('bossIntro');
    this.events.push('dialogueLine');
  }

  private updateDialogue(inp: InputFrame): void {
    const d = this.dialogue;
    if (!d) return;
    d.age++;
    const text = d.def.lines[d.i].text;
    const typed = d.age * DIALOGUE_CPF >= text.length;
    let next = false;
    if (inp.skip) {
      d.age += 4;
      next = typed && d.age % 6 === 0;
    }
    if (inp.advance) {
      if (typed) next = true;
      else d.age = Math.ceil(text.length / DIALOGUE_CPF);
    }
    if (next) {
      d.i++;
      d.age = 0;
      if (d.i >= d.def.lines.length) {
        this.dialogue = null;
        this.events.push('dialogueEnd');
      } else this.applyLine();
    }
  }

  // ─────────────────────────────── stage flow ─────────────────────────────

  setMusic(name: string): void {
    if (this.music === name) return;
    this.music = name;
    this.events.push('music');
  }

  showStageCard(info: StageInfo): void {
    this.stageInfo = info;
    this.setMusic(info.music);
    this.events.push('stageCard');
  }

  *stageClear(stage: number): Task {
    yield* wait(60);
    const clearBonus = stage * 1_000_000 + Math.round(this.player.power * 100) * 1000 + this.graze * 500;
    this.score += clearBonus;
    this.results = {
      stage,
      clearBonus,
      captures: this.captures,
      elegies: this.elegiesSeen,
      graze: this.graze,
      score: this.score,
    };
    this.cleared = true;
    this.events.push('stageClear');
  }

  continueGame(): boolean {
    if (!this.over || this.credits <= 0) return false;
    this.credits--;
    this.continuesUsed++;
    this.over = false;
    // Genre convention: score resets and its last digit records continues used.
    this.score = this.continuesUsed;
    this.extendIndex = 0;
    const p = this.player;
    p.lives = this.startingLives;
    p.bombs = this.char.bombs;
    p.invuln = 180;
    p.deathTimer = -1;
    p.x = FIELD_W / 2;
    p.y = FIELD_H - 48;
    return true;
  }

  // ──────────────────────────────── player ────────────────────────────────

  private updatePlayer(inp: InputFrame): void {
    const p = this.player;
    const ch = this.char;
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

    const speed = p.focus ? ch.focusSpeed : ch.speed;
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

    ch.layoutOptions(this);

    const talking = this.dialogue !== null;
    if (!talking && inp.bomb && p.bombs > 0 && !this.bomb.active) this.startBomb();
    if (!talking && inp.skill && ch.trySkill(this)) this.events.push('skill');
    ch.update(this);

    if (inp.shoot && !talking) {
      const t = p.shotTimer++;
      if (t % 6 === 0) this.events.push('shot');
      ch.fire(this, t);
    }
  }

  private startBomb(): void {
    const p = this.player;
    p.bombs--;
    p.invuln = Math.max(p.invuln, this.char.bombInvuln);
    Object.assign(this.bomb, { active: true, t: 0, r: 0, x: p.x, y: p.y });
    this.boss.clean = false;
    this.autoCollect = 90;
    this.events.push('bomb');
    this.char.bombStart(this);
  }

  private updateBomb(): void {
    if (!this.bomb.active) return;
    this.bomb.t++;
    this.char.bombUpdate(this);
  }

  // ───────────────────────── helpers for characters ─────────────────────────

  /** Cancel bullets in a circle. With `toItem`, half of them become that item (flying to the player). */
  cancelBulletsInRadius(x: number, y: number, r: number, toItem = -1): number {
    const bl = this.bullets;
    const r2 = r * r;
    let n = 0;
    for (let i = 0; i < bl.n; i++) {
      const dx = bl.x[i] - x;
      const dy = bl.y[i] - y;
      if (dx * dx + dy * dy < r2) {
        this.cancelFx(i);
        if (toItem >= 0 && n % 2 === 0) this.items.spawn(bl.x[i], bl.y[i], toItem, 0, 0, 2);
        this.score += 50;
        bl.remove(i);
        i--;
        n++;
      }
    }
    return n;
  }

  /** Damage every enemy and the boss inside a circle (per call, i.e. per frame). */
  damageInRadius(x: number, y: number, r: number, enemyDmg: number, bossDmg: number): void {
    for (const e of this.enemies) {
      if (e.alive && !e.intangible && Math.hypot(e.x - x, e.y - y) < r + e.r) this.damageEnemy(e, enemyDmg);
    }
    const b = this.boss;
    if (b.present && b.vulnerable && Math.hypot(b.x - x, b.y - y) < r + b.hitR) this.damageBoss(bossDmg);
  }

  private collidePlayer(): void {
    const p = this.player;
    const ch = this.char;
    if (p.deathTimer >= 0) return;
    ch.absorbBullets?.(this);
    const bl = this.bullets;
    const px = p.x;
    const py = p.y;
    for (let i = 0; i < bl.n; i++) {
      if (bl.age[i] < SPAWN_GRACE) continue;
      const dx = bl.x[i] - px;
      const dy = bl.y[i] - py;
      const d2 = dx * dx + dy * dy;
      const r = BULLET_TYPES[bl.type[i]].hitR;
      const gr = ch.grazeR + r;
      if (d2 > gr * gr) continue;
      const hr = ch.hitR + r;
      if (d2 < hr * hr && p.invuln === 0) {
        p.deathTimer = ch.deathbombFrames;
        return;
      }
      if (!(bl.flags[i] & BF_GRAZED)) {
        bl.flags[i] |= BF_GRAZED;
        this.graze++;
        this.score += 200;
        const a = this.rng.range(0, TAU);
        this.fx.spawn(px, py, Math.cos(a) * 2.5, Math.sin(a) * 2.5, 14, S.spark, C.white, 0.45, 0.1, 0.9);
        ch.onGraze?.(this);
        this.events.push('graze');
      }
    }
    if (p.invuln > 0) return;
    for (const e of this.enemies) {
      if (!e.alive || e.intangible) continue;
      const rr = e.r * 0.6 + ch.hitR;
      if ((e.x - px) ** 2 + (e.y - py) ** 2 < rr * rr) {
        p.deathTimer = ch.deathbombFrames;
        return;
      }
    }
    const b = this.boss;
    if (b.present && b.y > 0 && !b.defeated) {
      const rr = b.hitR * 0.5 + ch.hitR;
      if ((b.x - px) ** 2 + (b.y - py) ** 2 < rr * rr) p.deathTimer = ch.deathbombFrames;
    }
  }

  private killPlayer(): void {
    const p = this.player;
    p.lives--;
    this.boss.clean = false;
    this.events.push('death');
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU;
      this.fx.spawn(p.x, p.y, Math.cos(a) * 6, Math.sin(a) * 6, 40, S.spark, C.amber, 1.4, 0.2);
    }
    // Lose some power; it scatters upward so it can be partly recovered.
    const lost = Math.min(0.5, p.power - 1);
    p.power = Math.max(1, p.power - 0.5);
    if (lost > 0) {
      this.items.spawn(p.x, p.y, IT.powerBig, this.rng.range(-1.5, 1.5), -4.5);
      for (let k = 0; k < 6; k++) this.items.spawn(p.x, p.y, IT.power, this.rng.range(-3, 3), this.rng.range(-5.5, -3));
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
    p.bombs = Math.max(p.bombs, this.char.bombs);
    p.x = FIELD_W / 2;
    p.y = FIELD_H - 48;
  }

  private extend(): void {
    const p = this.player;
    if (p.lives < MAX_LIVES) p.lives++;
    this.events.push('extend');
  }

  // ──────────────────────────────── enemies ───────────────────────────────

  enemy(def: EnemyDef, x: number, y: number, behavior: Behavior): Enemy {
    const e = new Enemy();
    e.x = x;
    e.y = y;
    e.hp = e.maxHp = def.hp;
    e.r = def.r;
    e.sprite = def.sprite;
    e.orient = !!def.orient;
    e.drops = def.drops;
    e.score = def.score ?? def.hp * 10;
    e.task = behavior(this, e);
    this.enemies.push(e);
    return e;
  }

  private updateEnemies(): void {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.alive) {
        e.age++;
        if (e.flash > 0) e.flash--;
        if (e.charted > 0) e.charted--;
        if (e.task && e.task.next().done) e.task = null;
        e.x += e.vx;
        e.y += e.vy;
        const m = 48;
        if (e.age > 30 && (e.x < -m || e.x > FIELD_W + m || e.y < -m || e.y > FIELD_H + m)) e.alive = false;
      }
      if (!e.alive) {
        list.splice(i, 1);
        i--;
      }
    }
  }

  /** All player damage to enemies goes through here (character multipliers, Charted bonus). */
  damageEnemy(e: Enemy, dmg: number): void {
    if (!e.alive) return;
    const d = dmg * this.char.damageMult(this) * (e.charted > 0 ? 1.25 : 1);
    e.hp -= d;
    e.flash = 3;
    this.char.onDamage?.(this, Math.min(d, Math.max(0, e.hp + d)));
    if (e.hp <= 0) this.killEnemy(e);
  }

  damageBoss(dmg: number): void {
    const b = this.boss;
    if (!b.present || !b.vulnerable) return;
    const d = dmg * this.char.damageMult(this) * (b.charted > 0 ? 1.25 : 1);
    b.hp -= d;
    b.flash = 2;
    this.char.onDamage?.(this, d);
  }

  private killEnemy(e: Enemy): void {
    e.alive = false;
    e.task = null;
    this.score += e.score;
    this.events.push('enemyDie');
    for (let k = 0; k < 10; k++) {
      const a = this.rng.range(0, TAU);
      const s = this.rng.range(1.5, 4);
      this.fx.spawn(e.x, e.y, Math.cos(a) * s, Math.sin(a) * s, 22, S.spark, C.gold, 0.8, 0.1, 0.9);
    }
    this.fx.spawn(e.x, e.y, 0, 0, 16, S.ring, C.amber, 0.05, Math.max(0.25, e.r / 40), 0.7);
    for (const t of e.drops) this.items.spawn(e.x + this.rng.range(-10, 10), e.y + this.rng.range(-6, 6), t, this.rng.range(-0.8, 0.8));
  }

  /** Nearest target for homing shots: enemies or the boss. */
  private nearestTarget(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.intangible || e.y < 0) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    const b = this.boss;
    if (b.present && b.y > 0 && !b.defeated) {
      const d = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (d < bd) best = b;
    }
    return best;
  }

  // ──────────────────────────────── shots ─────────────────────────────────

  private updateShots(): void {
    const s = this.shots;
    const boss = this.boss;
    const bossTarget = boss.present && boss.y > 0 && !boss.defeated;
    for (let i = 0; i < s.n; i++) {
      const age = ++s.age[i];
      const kind = s.kind[i];
      if (kind === SK.homing) {
        const tg = this.nearestTarget(s.x[i], s.y[i]);
        if (tg) {
          const want = Math.atan2(tg.y - s.y[i], tg.x - s.x[i]);
          const cur = Math.atan2(s.vy[i], s.vx[i]);
          let d = want - cur;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          const turn = Math.max(-0.12, Math.min(0.12, d));
          const sp = Math.min(9, Math.hypot(s.vx[i], s.vy[i]) + 0.15);
          s.vx[i] = Math.cos(cur + turn) * sp;
          s.vy[i] = Math.sin(cur + turn) * sp;
        }
      }
      s.x[i] += s.vx[i];
      s.y[i] += s.vy[i];
      const x = s.x[i];
      const y = s.y[i];
      const maxAge = s.maxAge[i];
      if (maxAge > 0 && age > maxAge) {
        s.remove(i);
        i--;
        continue;
      }
      let hit = false;
      const pierce = s.pierce[i] === 1;
      {
        // Oar arcs lose up to 70% of their bite over their short range.
        const dmg = kind === SK.falloff && maxAge > 0 ? s.dmg[i] * (1 - 0.7 * Math.min(1, age / maxAge)) : s.dmg[i];
        for (const e of this.enemies) {
          if (!e.alive || e.intangible || (pierce && s.lastHit[i] === e.id)) continue;
          if ((x - e.x) ** 2 + (y - e.y) ** 2 < e.r * e.r) {
            s.lastHit[i] = e.id;
            if (kind === SK.chart) e.charted = 180;
            this.damageEnemy(e, dmg);
            this.score += 10;
            if (age % 4 === 0) this.events.push('enemyHit');
            hit = true;
            break;
          }
        }
        if (!hit && bossTarget && !(pierce && s.lastHit[i] === 0)) {
          const dx = x - boss.x;
          const dy = y - boss.y;
          if (dx * dx + dy * dy < boss.hitR * boss.hitR) {
            s.lastHit[i] = 0; // id 0 = the boss
            if (boss.vulnerable) {
              if (kind === SK.chart) boss.charted = 180;
              this.damageBoss(dmg);
              this.score += 10;
              if (age % 3 === 0) this.events.push('bossHit');
            }
            hit = true;
          }
        }
      }
      if (hit) {
        if ((this.frame + i) % 3 === 0) {
          this.fx.spawn(x, y + 4, this.rng.range(-1.5, 1.5), this.rng.range(-3, -1), 10, S.spark, C.amber, 0.5, 0.1, 0.8);
        }
        if (!pierce) {
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

  // ──────────────────────────────── items ─────────────────────────────────

  private updateItems(): void {
    const it = this.items;
    const p = this.player;
    const alive = p.deathTimer < 0 && !this.over;
    const pocActive = alive && p.y < POC_Y;
    const all = alive && (pocActive || this.autoCollect > 0);
    for (let i = 0; i < it.n; i++) {
      it.age[i]++;
      if (all && it.homing[i] === 0) it.homing[i] = 2; // 2 = collected via POC / auto (full value)
      const dx = p.x - it.x[i];
      const dy = p.y - it.y[i];
      const d2 = dx * dx + dy * dy;
      if (it.homing[i] && alive) {
        const d = Math.sqrt(d2) || 1;
        const sp = Math.min(d, 9);
        it.x[i] += (dx / d) * sp;
        it.y[i] += (dy / d) * sp;
        if (d < 10) {
          this.collect(it.type[i], it.y[i], it.homing[i] === 2);
          it.remove(i);
          i--;
        }
        continue;
      }
      if (alive && d2 < 40 * 40 && it.age[i] > 10) {
        it.homing[i] = 1;
        continue;
      }
      it.vy[i] = Math.min(2.0, it.vy[i] + 0.06);
      it.vx[i] *= 0.95;
      it.x[i] += it.vx[i];
      it.y[i] += it.vy[i];
      if (it.y[i] > FIELD_H + 16) {
        it.remove(i);
        i--;
      }
    }
  }

  private collect(type: number, y: number, full: boolean): void {
    const p = this.player;
    this.events.push('item');
    switch (type) {
      case IT.power:
      case IT.powerBig: {
        const add = type === IT.power ? 0.05 : 0.25;
        if (p.power >= 4) {
          this.score += type === IT.power ? 1000 : 10000;
        } else {
          p.power = Math.min(4, Math.round((p.power + add) * 100) / 100);
          this.score += 100;
          if (p.power >= 4) this.events.push('fullPower');
        }
        break;
      }
      case IT.point: {
        const k = full ? 1 : 0.4 + 0.6 * Math.max(0, Math.min(1, 1 - (y - POC_Y) / (FIELD_H - POC_Y)));
        this.score += Math.round((this.pointValue * k) / 10) * 10;
        break;
      }
      case IT.life:
        if (++this.lifeFrags >= 5) {
          this.lifeFrags -= 5;
          this.extend();
        }
        break;
      case IT.bomb:
        if (++this.bombFrags >= 3) {
          this.bombFrags -= 3;
          if (p.bombs < MAX_BOMBS) p.bombs++;
          this.events.push('bombGet');
        }
        break;
      case IT.star:
        this.score += 500;
        break;
      case IT.soul:
        this.score += 2000;
        break;
    }
  }

  // ───────────────────────────────── boss ─────────────────────────────────

  /** Runs a whole boss (or midboss) fight; completes when it is defeated or leaves. */
  *runBoss(def: BossDef, pre?: DialogueDef, post?: DialogueDef): Task {
    const b = this.boss;
    b.def = def;
    b.defeated = false;
    b.present = true;
    b.phase = -1;
    b.active = false;
    b.vulnerable = false;
    b.elegy = null;
    b.jump = -1;
    b.x = def.midboss ? FIELD_W * 0.8 : FIELD_W / 2;
    b.y = -60;
    this.events.push('bossEnter');
    yield* this.moveBoss(FIELD_W / 2, 110, 80);
    if (pre) yield* this.runDialogue(pre);
    for (let i = 0; i < def.phases.length; i++) {
      this.startPhase(i);
      while (!b.phaseDone && b.jump < 0) yield;
      if (b.jump >= 0) {
        i = b.jump - 1;
        b.jump = -1;
        this.patternSched.clear();
        this.cancelAllBullets();
        continue;
      }
      this.finishPhase();
      if (i < def.phases.length - 1) {
        yield* wait(30);
        yield* this.moveBoss(FIELD_W / 2, 110, 50);
      }
    }
    b.elegy = null;
    if (def.midboss) {
      yield* this.moveBoss(b.x, -90, 50);
    } else {
      this.events.push('bossDefeat');
      this.shake = 14;
      this.flash = 0.5;
      for (let k = 0; k < 40; k++) {
        const a = this.rng.range(0, TAU);
        const s = this.rng.range(1, 7);
        this.fx.spawn(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s, 50, S.spark, k % 2 ? C.rose : C.gold, 1.6, 0.2);
      }
      this.fx.spawn(b.x, b.y, 0, 0, 40, S.ring, C.white, 0.1, 3, 0.9);
      b.defeated = true;
      yield* wait(90);
      yield* this.moveBoss(FIELD_W / 2, 120, 40);
      if (post) yield* this.runDialogue(post);
      yield* this.moveBoss(b.x, -90, 70);
    }
    b.present = false;
    b.defeated = false;
    b.def = null;
    b.phase = -1;
  }

  /** Debug: skip to a phase of the current boss. */
  jumpTo(i: number): void {
    const b = this.boss;
    if (!b.def || i < 0 || i >= b.def.phases.length) return;
    b.jump = i;
  }

  private startPhase(i: number): void {
    const b = this.boss;
    const def = b.def!.phases[i];
    this.patternSched.clear();
    b.phase = i;
    b.hp = b.maxHp = def.hp;
    b.timer = b.maxTimer = def.time * 60;
    b.elegy = def.elegy;
    b.survival = !!def.survival;
    b.vulnerable = !def.survival;
    b.active = true;
    b.phaseDone = false;
    b.timedOut = false;
    b.clean = true;
    if (def.elegy) {
      this.elegiesSeen++;
      this.events.push('declare');
    }
    this.patternSched.add(def.run(this));
  }

  private updateBoss(): void {
    const b = this.boss;
    if (b.flash > 0) b.flash--;
    if (b.charted > 0) b.charted--;
    if (!b.present || !b.active) return;
    b.timer--;
    if ((b.vulnerable && b.hp <= 0) || b.timer <= 0) {
      b.timedOut = b.timer <= 0 && !b.survival;
      b.phaseDone = true;
      b.active = false;
      b.vulnerable = false;
    }
  }

  private finishPhase(): void {
    const b = this.boss;
    const def = b.def!.phases[b.phase];
    this.patternSched.clear();
    this.cancelBulletsToStars();
    this.autoCollect = 60;
    this.events.push('phaseEnd');
    if (!b.timedOut) {
      for (let k = 0; k < 6; k++) this.items.spawn(b.x + this.rng.range(-30, 30), b.y + this.rng.range(-16, 16), k % 2 ? IT.power : IT.point, this.rng.range(-1, 1));
    }
    const last = b.phase === b.def!.phases.length - 1;
    if (last) {
      this.items.spawn(b.x, b.y, IT.life, 0, -3);
      this.items.spawn(b.x - 20, b.y, IT.powerBig, -0.6, -3);
      this.items.spawn(b.x + 20, b.y, IT.powerBig, 0.6, -3);
    }
    if (def.elegy) {
      const captured = b.clean && !b.timedOut;
      const bonus = captured ? Math.round((def.survival ? 3_000_000 : 2_000_000 + 1_000_000 * (b.timer / b.maxTimer)) / 10_000) * 10_000 * (this.diff + 1) : 0;
      this.lastCapture = { name: def.elegy, bonus, captured };
      if (captured) {
        this.captures++;
        this.score += bonus;
        this.items.spawn(b.x, b.y, IT.bomb, 0, -3);
        this.events.push('capture');
      } else this.events.push('captureFail');
    }
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
      const a = count === 1 ? center : center + (k - (count - 1) / 2) * spread;
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

  /** Phase end: every bullet becomes a small star that flies to the player. */
  private cancelBulletsToStars(): void {
    const bl = this.bullets;
    for (let i = 0; i < bl.n; i++) {
      this.cancelFx(i);
      if (i % 2 === 0) this.items.spawn(bl.x[i], bl.y[i], IT.star, 0, 0, 2);
    }
    bl.clear();
  }
}
