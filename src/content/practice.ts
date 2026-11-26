import { wait, type Task } from '../core/scheduler';
import { BT } from '../game/bulletTypes';
import { TAU } from '../game/constants';
import type { BossDef, PhaseDef } from '../game/defs';
import type { Game } from '../game/game';
import { S } from '../game/sprites';
import { C } from '../game/palette';

/**
 * M0 test boss: the Training Effigy. Four patterns that exercise the bullet
 * engine (aimed fans, spirals, curving bullets, bursting bullets) plus a
 * survival stress test that keeps ~1,800 bullets on screen.
 */

const BURST_LANTERN = 1;

export function registerPracticeBursts(g: Game): void {
  g.onBurst(BURST_LANTERN, (game, e) => {
    const off = game.rng.range(0, TAU);
    game.ring(e.x, e.y, 18, 1.2, off, BT.small, C.amber, { accel: 0.02, target: 2.4 });
    game.ring(e.x, e.y, 9, 0.8, off + TAU / 36, BT.orb, C.gold, { accel: 0.015, target: 1.8 });
  });
}

function* opening(g: Game): Task {
  g.patternSched.add(g.wander(220));
  let k = 0;
  for (;;) {
    const b = g.boss;
    const a = g.aimAt(b.x, b.y);
    for (let w = 0; w < 3; w++) g.fan(b.x, b.y, 5, 0.2, 3.0 + w * 0.55, a, BT.rice, C.azure);
    yield* wait(24);
    g.ring(b.x, b.y, 24, 1.9, k * 0.13, BT.orb, C.violet);
    g.ring(b.x, b.y, 24, 1.5, k * 0.13 + TAU / 48, BT.small, C.rose);
    yield* wait(36);
    k++;
  }
}

function* grainNeverSown(g: Game): Task {
  let a = 0;
  let t = 0;
  for (;;) {
    const b = g.boss;
    for (let arm = 0; arm < 5; arm++) {
      const ang = a + (arm / 5) * TAU;
      g.spawn({ x: b.x, y: b.y, speed: 2.7, angle: ang, type: BT.rice, color: C.gold });
      g.spawn({ x: b.x, y: b.y, speed: 2.1, angle: ang + 0.09, type: BT.rice, color: C.amber });
    }
    a += 0.19 + Math.sin(t * 0.012) * 0.09;
    t += 3;
    if (t % 120 === 0) {
      g.ring(b.x, b.y, 16, 1.3, g.rng.range(0, TAU), BT.big, C.crimson);
    }
    yield* wait(3);
  }
}

function* crowsForgotHome(g: Game): Task {
  g.patternSched.add(g.wander(180, 60));
  let k = 0;
  for (;;) {
    const b = g.boss;
    const dir = k % 2 === 0 ? 1 : -1;
    const off = g.rng.range(0, TAU);
    for (let i = 0; i < 20; i++) {
      g.spawn({
        x: b.x, y: b.y, speed: 3.4, angle: off + (i / 20) * TAU,
        type: BT.petal, color: dir > 0 ? C.violet : C.indigo,
        accel: -0.04, target: 1.3, angVel: 0.011 * dir,
      });
    }
    if (k % 3 === 2) {
      const a = g.aimAt(b.x, b.y);
      g.fan(b.x, b.y, 7, 0.12, 4.2, a, BT.needle, C.white);
    }
    k++;
    yield* wait(22);
  }
}

function* lanternsOnStillWater(g: Game): Task {
  g.patternSched.add(g.wander(240, 80));
  let k = 0;
  for (;;) {
    const b = g.boss;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i - 2) * 0.42 + Math.sin(k * 0.7) * 0.2;
      g.spawn({
        x: b.x, y: b.y, speed: 2.6, angle: a, type: BT.big, color: C.amber,
        accel: -0.035, target: 0.3, burstAt: 75 + i * 4, burstKind: BURST_LANTERN,
      });
    }
    yield* wait(50);
    const a = g.aimAt(b.x, b.y);
    g.fan(b.x, b.y, 3, 0.25, 3.6, a, BT.paper, C.teal);
    yield* wait(40);
    k++;
  }
}

function* tenThousandUnremembered(g: Game): Task {
  let k = 0;
  for (;;) {
    const b = g.boss;
    const off = k * 0.071;
    g.ring(b.x, b.y, 44, 1.3, off, k % 2 ? BT.small : BT.orb, k % 4 < 2 ? C.white : C.violet);
    if (k % 6 === 0) g.ring(b.x, b.y, 20, 2.2, -off * 1.7, BT.rice, C.teal);
    k++;
    yield* wait(5);
  }
}

export const PRACTICE_PHASES: readonly PhaseDef[] = [
  { id: 'effigy.opening', elegy: null, hp: 2200, time: 30, run: opening },
  { id: 'effigy.grain', elegy: 'Practice Elegy “Grain That Was Never Sown”', hp: 3200, time: 40, run: grainNeverSown },
  { id: 'effigy.crows', elegy: 'Practice Elegy “Crows Who Forgot the Way Home”', hp: 3200, time: 40, run: crowsForgotHome },
  { id: 'effigy.lanterns', elegy: 'Practice Elegy “Lanterns on Still Water”', hp: 3400, time: 40, run: lanternsOnStillWater },
  { id: 'effigy.stress', elegy: 'Stress Test “Ten Thousand Unremembered”', hp: 1, time: 25, survival: true, run: tenThousandUnremembered },
];

export const STRESS_PHASE_INDEX = 4;

export const TRAINING_EFFIGY: BossDef = {
  id: 'effigy',
  name: 'Training Effigy',
  title: 'A Scarecrow Stuffed With Practice',
  sprite: S.effigy,
  hitR: 30,
  phases: PRACTICE_PHASES,
};

/** Practice script: the effigy forever. With `stressOnly`, just the stress test, repeated. */
export function practiceScript(stressOnly = false) {
  return function* (g: Game): Task {
    registerPracticeBursts(g);
    g.setMusic('stage1');
    const def = stressOnly ? { ...TRAINING_EFFIGY, phases: [PRACTICE_PHASES[STRESS_PHASE_INDEX]] } : TRAINING_EFFIGY;
    for (;;) {
      yield* g.runBoss(def);
      yield* wait(60);
    }
  };
}
