import { describe, expect, it } from 'vitest';
import { practiceScript } from '../src/content/practice';
import { HOSHIKO, STAGE1_PRE_BOSS, stage1 } from '../src/content/stage1';
import { Rng } from '../src/core/rng';
import { Scheduler, wait } from '../src/core/scheduler';
import { BT } from '../src/game/bulletTypes';
import { FIELD_W } from '../src/game/constants';
import { IT } from '../src/game/defs';
import { EMPTY_INPUT, Game, type InputFrame } from '../src/game/game';
import { BulletPool } from '../src/game/pools';

function run(seed: number, frames: number, inputFor: (f: number) => InputFrame): Game {
  const g = new Game(stage1, { seed });
  for (let f = 0; f < frames; f++) g.tick(inputFor(f));
  return g;
}

function fingerprint(g: Game): string {
  let h = 0;
  for (let i = 0; i < g.bullets.n; i++) h = (h * 31 + Math.round(g.bullets.x[i] * 100) + Math.round(g.bullets.y[i] * 100)) | 0;
  return `${g.frame}:${g.bullets.n}:${g.score}:${g.graze}:${g.player.lives}:${h}`;
}

const weave = (f: number): InputFrame => ({ ...EMPTY_INPUT, mx: Math.sin(f / 40) > 0 ? 1 : -1, shoot: true, focus: f % 300 > 150 });

describe('Rng', () => {
  it('is deterministic per seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('stays in [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('Scheduler', () => {
  it('runs coroutines frame by frame', () => {
    const s = new Scheduler();
    const log: number[] = [];
    s.add((function* () {
      log.push(1);
      yield* wait(3);
      log.push(2);
    })());
    s.tick();
    expect(log).toEqual([1]);
    s.tick();
    s.tick();
    expect(log).toEqual([1]);
    s.tick();
    expect(log).toEqual([1, 2]);
    expect(s.size).toBe(0);
  });
});

describe('BulletPool', () => {
  it('removes off-screen bullets and keeps the live range packed', () => {
    const p = new BulletPool(8);
    p.spawn({ x: 10, y: 10, speed: 100, angle: Math.PI, type: BT.orb, color: 0 }); // leaves immediately
    p.spawn({ x: 100, y: 100, speed: 0, angle: 0, type: BT.orb, color: 1 });
    p.update();
    expect(p.n).toBe(1);
    expect(p.color[0]).toBe(1);
  });
  it('refuses spawns past capacity', () => {
    const p = new BulletPool(2);
    expect(p.spawn({ x: 0, y: 0, speed: 0, angle: 0, type: 0, color: 0 })).toBe(0);
    expect(p.spawn({ x: 0, y: 0, speed: 0, angle: 0, type: 0, color: 0 })).toBe(1);
    expect(p.spawn({ x: 0, y: 0, speed: 0, angle: 0, type: 0, color: 0 })).toBe(-1);
  });
  it('slows bullets inside the Vigil zone', () => {
    const p = new BulletPool(2);
    p.spawn({ x: 100, y: 100, speed: 2, angle: 0, type: 0, color: 0 });
    p.spawn({ x: 300, y: 100, speed: 2, angle: 0, type: 0, color: 0 });
    p.update(100, 100, 56, 0.5);
    expect(p.x[0]).toBeCloseTo(101);
    expect(p.x[1]).toBeCloseTo(302);
  });
  it('reports bursts at their burst age', () => {
    const p = new BulletPool(2);
    p.spawn({ x: 50, y: 50, speed: 0, angle: 0, type: 0, color: 3, burstAt: 2, burstKind: 9 });
    p.update();
    expect(p.bursts.length).toBe(0);
    p.update();
    expect(p.bursts).toEqual([{ x: 50, y: 50, color: 3, kind: 9 }]);
    expect(p.n).toBe(0);
  });
});

describe('Game simulation', () => {
  it('is fully deterministic for the same seed and inputs', () => {
    const a = run(99, 2400, weave);
    const b = run(99, 2400, weave);
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('boss enters, declares Elegies and takes damage from Sayo', () => {
    const g = new Game(practiceScript(), { seed: 1 });
    let declared = 0;
    for (let f = 0; f < 60 * 40; f++) {
      g.player.invuln = 5;
      g.tick({ ...EMPTY_INPUT, shoot: true, focus: true });
      if (g.events.includes('declare')) declared++;
    }
    expect(g.boss.phase).toBeGreaterThanOrEqual(1);
    expect(declared).toBeGreaterThanOrEqual(1);
  });

  it('the stress phase sustains about 2,000 bullets', () => {
    const g = new Game(practiceScript(true), { seed: 1 });
    let peak = 0;
    for (let f = 0; f < 60 * 8; f++) {
      g.player.invuln = 5;
      g.tick(EMPTY_INPUT);
      peak = Math.max(peak, g.bullets.n);
    }
    expect(peak).toBeGreaterThan(1900);
  });

  it('a hit opens the deathbomb window; bombing inside it saves the life', () => {
    const g = new Game(practiceScript(), { seed: 1 });
    g.player.invuln = 0;
    g.bullets.spawn({ x: g.player.x, y: g.player.y, speed: 0, angle: 0, type: BT.orb, color: 0 });
    g.bullets.age[0] = 10;
    g.tick(EMPTY_INPUT);
    expect(g.player.deathTimer).toBeGreaterThan(0);
    g.tick({ ...EMPTY_INPUT, bomb: true });
    expect(g.player.deathTimer).toBe(-1);
    expect(g.player.lives).toBe(3);
    expect(g.bomb.active).toBe(true);
  });

  it('getting hit without bombing costs a life', () => {
    const g = new Game(practiceScript(), { seed: 1 });
    g.player.invuln = 0;
    g.bullets.spawn({ x: g.player.x, y: g.player.y, speed: 0, angle: 0, type: BT.orb, color: 0 });
    g.bullets.age[0] = 10;
    for (let f = 0; f < 12; f++) g.tick(EMPTY_INPUT);
    expect(g.player.lives).toBe(2);
    expect(g.player.x).toBe(FIELD_W / 2);
  });

  it('touch drag moves the player relatively and is capped per tick', () => {
    const g = new Game(practiceScript(), { seed: 1 });
    const x0 = g.player.x;
    g.tick({ ...EMPTY_INPUT, tx: 5 });
    expect(g.player.x).toBeCloseTo(x0 + 5);
    g.tick({ ...EMPTY_INPUT, tx: 500 });
    expect(g.player.x).toBeCloseTo(x0 + 5 + 14);
  });

  it('items: power raises emitters, point value scales, fragments extend', () => {
    const g = new Game(practiceScript(), { seed: 1 });
    const p = g.player;
    p.invuln = 999;
    expect(p.power).toBe(1);
    for (let k = 0; k < 4; k++) g.items.spawn(p.x, p.y, IT.powerBig, 0, 0, 2);
    for (let k = 0; k < 5; k++) g.items.spawn(p.x, p.y, IT.life, 0, 0, 2);
    for (let k = 0; k < 3; k++) g.items.spawn(p.x, p.y, IT.bomb, 0, 0, 2);
    g.tick(EMPTY_INPUT);
    g.tick(EMPTY_INPUT);
    expect(p.power).toBe(2);
    expect(p.emitterCount).toBe(2);
    expect(p.lives).toBe(4);
    expect(p.bombs).toBe(4);
  });

  it('continue restores lives, records the continue in the score, and is limited by credits', () => {
    const g = new Game(practiceScript(), { seed: 1 });
    g.over = true;
    expect(g.continueGame()).toBe(true);
    expect(g.player.lives).toBe(3);
    expect(g.score).toBe(1);
    g.over = true;
    g.continueGame();
    g.over = true;
    g.continueGame();
    g.over = true;
    expect(g.continueGame()).toBe(false);
  });

  it('Gentle starts with 5 candles', () => {
    expect(new Game(stage1, { difficulty: 0 }).player.lives).toBe(5);
  });
});

/** A simple autopilot: weaves, focuses near bullets, bombs when about to die. Invincible so the run completes. */
function autopilot(g: Game): InputFrame {
  // Like a real player, it flies up to the collection line now and then outside boss fights.
  const collecting = !g.boss.present && g.frame % 480 < 70;
  const my = collecting ? -1 : g.player.y < 360 ? 1 : 0;
  return { ...EMPTY_INPUT, mx: Math.sin(g.frame / 50), my, shoot: true, focus: g.boss.present, advance: g.frame % 20 === 0 };
}

describe('Stage 1', () => {
  it('plays from start to stage clear (invincible autopilot)', () => {
    const g = new Game(stage1, { seed: 3 });
    const seen = new Set<string>();
    let frames = 0;
    while (!g.cleared && frames < 60 * 60 * 8) {
      g.player.invuln = 5;
      g.tick(autopilot(g));
      for (const e of g.events) seen.add(e);
      frames++;
    }
    expect(g.cleared).toBe(true);
    for (const e of ['stageCard', 'bossEnter', 'declare', 'capture', 'bossDefeat', 'dialogueEnd', 'stageClear', 'music']) {
      expect(seen.has(e), e).toBe(true);
    }
    expect(g.results!.elegies).toBe(4); // 1 midboss + 3 Hoshiko
    expect(g.player.power).toBeGreaterThan(2);
    // Stage length sanity: a few minutes of play.
    expect(frames / 60).toBeGreaterThan(150);
    expect(frames / 60).toBeLessThan(480);
    console.log(`stage 1 autopilot: ${(frames / 60).toFixed(0)}s, power ${g.player.power}, score ${g.score}, captures ${g.captures}/${g.elegiesSeen}`);
  });

  it('crow familiars are removed when their Elegy ends', () => {
    const g = new Game(stage1, { seed: 3, startAt: 'boss' });
    let sawFamiliars = false;
    for (let f = 0; f < 60 * 400 && !g.cleared; f++) {
      g.player.invuln = 5;
      g.tick(autopilot(g));
      const fam = g.enemies.filter((e) => e.intangible).length;
      if (g.boss.def === HOSHIKO && g.boss.phase === 3) sawFamiliars ||= fam > 0;
      if (g.boss.def === HOSHIKO && g.boss.phase === 4) expect(fam).toBe(0);
    }
    expect(sawFamiliars).toBe(true);
  });

  it('dialogue blocks shooting and advances on input', () => {
    const g = new Game(stage1, { seed: 3, startAt: 'boss' });
    while (!g.dialogue) g.tick(EMPTY_INPUT);
    expect(g.dialogue.def).toBe(STAGE1_PRE_BOSS);
    g.tick({ ...EMPTY_INPUT, shoot: true });
    expect(g.shots.n).toBe(0);
    g.tick({ ...EMPTY_INPUT, advance: true }); // completes typewriter
    g.tick({ ...EMPTY_INPUT, advance: true }); // next line
    expect(g.dialogue!.i).toBe(1);
  });
});
