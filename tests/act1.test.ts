import { describe, expect, it } from 'vitest';
import { practiceScript } from '../src/content/practice';
import { RECOLLECTIONS } from '../src/content/recollections';
import { STAGE1_STORY } from '../src/content/stage1';
import { ONDINE, STAGE2_STORY, HOSHIKO_REMATCH } from '../src/content/stage2';
import { SERAPHINE, STAGE3_STORY, INKMOTH_SWARM } from '../src/content/stage3';
import { FINAL_STAGE, storyScript } from '../src/content/story';
import { BT } from '../src/game/bulletTypes';
import { CHAR_IDS, IT } from '../src/game/defs';
import { EMPTY_INPUT, Game, type InputFrame } from '../src/game/game';
import { EXPRESSIONS } from '../src/ui/portraits';

function bot(g: Game): InputFrame {
  const collecting = !g.boss.present && g.frame % 480 < 70;
  return {
    ...EMPTY_INPUT,
    mx: Math.sin(g.frame / 50),
    my: collecting ? -1 : g.player.y < 360 ? 1 : 0,
    shoot: true,
    focus: g.boss.present,
    skill: g.frame % 240 === 0,
    advance: g.frame % 20 === 0,
  };
}

describe('engine additions', () => {
  it('gravity bullets arc up and fall back down', () => {
    const g = new Game(practiceScript(), { seed: 1 });
    g.bullets.spawn({ x: 192, y: 200, speed: 3, angle: -Math.PI / 2, type: BT.coin, color: 0, grav: 0.1 });
    let minY = 999;
    for (let f = 0; f < 80; f++) {
      g.bullets.update();
      minY = Math.min(minY, g.bullets.y[0]);
    }
    expect(minY).toBeLessThan(170);
    expect(g.bullets.y[0]).toBeGreaterThan(200);
  });

  it('lasers warn harmlessly, then kill, then fade', () => {
    const g = new Game(practiceScript(), { seed: 1 });
    const p = g.player;
    p.invuln = 0;
    g.lasers.spawn(-10, p.y, 0, 400, 20, 40, 30, 0, 1);
    for (let f = 0; f < 35; f++) g.tick(EMPTY_INPUT);
    expect(p.deathTimer).toBe(-1); // still warning
    for (let f = 0; f < 10; f++) g.tick(EMPTY_INPUT);
    expect(p.deathTimer).toBeGreaterThanOrEqual(0);
  });

  it('laser warnings are never shorter than 30 frames (fairness rule)', () => {
    const g = new Game(practiceScript(), { seed: 1 });
    g.lasers.spawn(0, 0, 0, 100, 10, 5, 30, 0);
    expect(g.lasers.warn[0]).toBe(30);
  });

  it('killing a Remnant drops its Recollection; collecting it records it and raises point value', () => {
    const g = new Game(practiceScript(), { seed: 1 });
    const pv = g.pointValue;
    const e = g.enemy({ sprite: 0, hp: 1, r: 10, drops: [] }, g.player.x, g.player.y - 30, function* () { for (;;) yield; });
    e.recollection = 12;
    g.damageEnemy(e, 5);
    expect(Array.from(g.items.type.slice(0, g.items.n))).toContain(IT.recollection);
    // The shard floats up for a moment before drifting down to be caught.
    for (let f = 0; f < 200; f++) {
      g.player.invuln = 5;
      g.tick(EMPTY_INPUT);
    }
    expect(g.recollected).toEqual([12]);
    expect(g.pointValue - g.graze * 10).toBe(pv + 500);
  });

  it('player trail remembers where you were', () => {
    const g = new Game(practiceScript(), { seed: 1 });
    const x0 = g.player.x;
    for (let f = 0; f < 60; f++) g.tick({ ...EMPTY_INPUT, mx: 1 });
    expect(g.trailAt(59)[0]).toBeCloseTo(x0 + 4, 0);
    expect(g.trailAt(0)[0]).toBeCloseTo(g.player.x);
  });
});

describe('Act One content', () => {
  it('has 30 recollections, ten per stage, and every Elegy points at one of its own stage', () => {
    expect(RECOLLECTIONS.length).toBe(30);
    for (const s of [1, 2, 3]) expect(RECOLLECTIONS.filter((r) => r.stage === s).length).toBe(10);
    const bosses = [[HOSHIKO_REMATCH, 2], [ONDINE, 2], [INKMOTH_SWARM, 3], [SERAPHINE, 3]] as const;
    for (const [b, stage] of bosses) {
      for (const ph of b.phases) {
        if (ph.elegy) expect(RECOLLECTIONS[ph.recollection!].stage, ph.id).toBe(stage);
      }
    }
  });

  it('every heroine has her own Stage 2 and 3 dialogue using drawable expressions', () => {
    for (const stories of [STAGE1_STORY, STAGE2_STORY, STAGE3_STORY]) {
      for (const id of CHAR_IDS) {
        const st = stories[id];
        expect(st.pre.left).toBe(id);
        expect(st.interlude.lines.length).toBeGreaterThanOrEqual(4);
        for (const d of [st.pre, st.post]) {
          for (const l of d.lines) expect(EXPRESSIONS[l.who], `${d.id}: ${l.who}/${l.expr}`).toContain(l.expr);
        }
      }
    }
  });
});

describe('Act One runs (invincible autopilot)', () => {
  for (const id of CHAR_IDS) {
    it(`${id} plays Stages 1 → 3 with interludes in between`, () => {
      const g = new Game(storyScript, { seed: 11, char: id });
      const cleared: number[] = [];
      const lasersSeen = { n: 0 };
      let f = 0;
      while (f < 60 * 60 * 25) {
        g.player.invuln = 5;
        g.tick(bot(g));
        if (g.lasers.n > 0) lasersSeen.n++;
        if (g.cleared) {
          cleared.push(g.results!.stage);
          if (g.results!.final) break;
          g.nextStage();
        }
        f++;
      }
      expect(cleared).toEqual([1, 2, 3]);
      expect(FINAL_STAGE).toBe(3);
      expect(lasersSeen.n).toBeGreaterThan(0);
      expect(g.recollected.length).toBeGreaterThanOrEqual(4);
      console.log(`${id}: Act One in ${(f / 60 / 60).toFixed(1)} min, captures ${g.captures}/${g.elegiesSeen}, recollections ${g.recollected.length}/30, power ${g.player.power}`);
    });
  }

  it('can start directly at Stage 2 or 3 (debug)', () => {
    for (const startStage of [2, 3]) {
      const g = new Game(storyScript, { seed: 2, startStage, startAt: 'boss' });
      let f = 0;
      while (!g.cleared && f < 60 * 60 * 6) {
        g.player.invuln = 5;
        g.tick(bot(g));
        f++;
      }
      expect(g.results!.stage).toBe(startStage);
    }
  });
});
