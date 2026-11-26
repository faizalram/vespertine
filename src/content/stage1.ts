import { wait, type Task } from '../core/scheduler';
import { BT } from '../game/bulletTypes';
import { FIELD_H, FIELD_W, TAU } from '../game/constants';
import { IT, type BossDef, type DialogueDef, type EnemyDef, type InterludeDef, type StageInfo } from '../game/defs';
import type { Enemy, Game } from '../game/game';
import { C } from '../game/palette';
import { S } from '../game/sprites';

/**
 * Stage 1 — Fields of Unharvested Names (spec §4.3, §5).
 * Terraced paddies where scarecrows wear the faces of forgotten farmers.
 * Midboss: Crow Matron. Boss: Hoshiko Aze, the Scarecrow Who Stayed.
 */

export const STAGE1_INFO: StageInfo = {
  number: 1,
  title: 'Fields of Unharvested Names',
  poem: ['Somebody planted this.', 'Somebody meant to come back.'],
  music: 'stage1',
};

// ─────────────────────────────── enemies ───────────────────────────────

const CHAFF_P: EnemyDef = { sprite: S.chaff, hp: 10, r: 12, drops: [IT.power] };
const CHAFF_PT: EnemyDef = { sprite: S.chaff, hp: 10, r: 12, drops: [IT.point] };
const CROW: EnemyDef = { sprite: S.crow, hp: 7, r: 11, drops: [IT.point], orient: true };
const LANTERN: EnemyDef = { sprite: S.fieldLantern, hp: 120, r: 18, drops: [IT.powerBig, IT.powerBig, IT.point, IT.point, IT.point, IT.point] };
const FAMILIAR: EnemyDef = { sprite: S.crow, hp: 1, r: 1, drops: [] };

/** Aimed shot helper that respects difficulty. */
function aimed(g: Game, e: Enemy, color: number = C.azure): void {
  const a = g.aimAt(e.x, e.y);
  const n = g.pick(1, 1, 3, 3);
  const sp = g.pick(2.2, 2.8, 3.2, 3.6);
  g.fan(e.x, e.y, n, 0.18, sp, a, BT.rice, color);
}

/** Chaff wisp: drifts on a gentle sine, fires once or twice, keeps going. */
function chaffDrift(vx: number, vy: number, shootAt: number, shots = 1) {
  return function* (g: Game, e: Enemy): Task {
    e.vx = vx;
    e.vy = vy;
    const phase = g.rng.range(0, TAU);
    for (let t = 0; ; t++) {
      e.vx = vx + Math.sin(t * 0.06 + phase) * 0.6;
      if (t >= shootAt && t < shootAt + shots * 30 && (t - shootAt) % 30 === 0 && e.y < FIELD_H * 0.6) {
        if (g.diff > 0 || (t - shootAt) === 0) aimed(g, e);
      }
      yield;
    }
  };
}

/** Crow: enters from a top corner, swoops down in an arc, flicks a fan at the bottom of its swoop. */
function crowSwoop(side: 1 | -1) {
  return function* (g: Game, e: Enemy): Task {
    let ang = side > 0 ? Math.PI * 0.15 : Math.PI * 0.85;
    const turn = -side * 0.018;
    let fired = false;
    for (let t = 0; ; t++) {
      const sp = 3.4;
      e.vx = Math.cos(ang) * sp;
      e.vy = Math.sin(ang) * sp;
      if (t > 20 && t < 90) ang += turn;
      if (!fired && t > 55) {
        fired = true;
        const a = g.aimAt(e.x, e.y);
        g.fan(e.x, e.y, g.pick(2, 3, 5, 5), 0.22, g.pick(2.4, 3.0, 3.4, 3.8), a, BT.needle, C.crimson);
      }
      yield;
    }
  };
}

/** Field lantern: sinks into place, breathes out rings of light, then rises away. */
function lanternHold(stopY: number, holdFrames: number, spiral = false) {
  return function* (g: Game, e: Enemy): Task {
    e.vy = 2.2;
    while (e.y < stopY) {
      e.vy = Math.max(0.4, (stopY - e.y) * 0.05);
      yield;
    }
    e.vy = 0;
    let k = 0;
    for (let t = 0; t < holdFrames; t++) {
      if (spiral) {
        if (t % g.pick(6, 4, 3, 3) === 0) {
          const a = k * 0.37;
          g.ring(e.x, e.y, g.pick(3, 4, 5, 6), 2.1, a, BT.orb, C.amber);
          k++;
        }
      } else if (t % g.pick(50, 40, 32, 28) === 0) {
        const off = g.rng.range(0, TAU);
        g.ring(e.x, e.y, g.pick(12, 18, 24, 28), 1.8, off, BT.orb, C.amber);
        g.ring(e.x, e.y, g.pick(12, 18, 24, 28), 1.3, off + TAU / 48, BT.small, C.gold);
      }
      yield;
    }
    for (;;) {
      e.vy = Math.max(-2.5, e.vy - 0.05);
      yield;
    }
  };
}

/** Straight line with an optional single aimed volley. */
function straight(vx: number, vy: number, shootAt = -1) {
  return function* (g: Game, e: Enemy): Task {
    e.vx = vx;
    e.vy = vy;
    for (let t = 0; ; t++) {
      if (t === shootAt) aimed(g, e, C.violet);
      yield;
    }
  };
}

// ─────────────────────────────── waves ───────────────────────────────

function* waveChaffLines(g: Game): Task {
  for (let side = 0; side < 2; side++) {
    const dir = side === 0 ? 1 : -1;
    for (let i = 0; i < 7; i++) {
      const x = dir > 0 ? 40 + i * 6 : FIELD_W - 40 - i * 6;
      g.enemy(i % 2 ? CHAFF_P : CHAFF_PT, x, -16, chaffDrift(dir * 1.1, 1.6, 50));
      yield* wait(g.pick(14, 10, 9, 8));
    }
    yield* wait(50);
  }
}

function* waveCrows(g: Game, count: number): Task {
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    g.enemy(CROW, side > 0 ? -10 : FIELD_W + 10, g.rng.range(30, 90), crowSwoop(side as 1 | -1));
    yield* wait(g.pick(26, 20, 16, 14));
  }
}

function* waveColumns(g: Game): Task {
  const xs = [64, 320, 128, 256, 192];
  for (let r = 0; r < 4; r++) {
    for (const x of xs) {
      g.enemy(r % 2 ? CHAFF_P : CHAFF_PT, x + g.rng.range(-12, 12), -16, straight(0, 2.0, r === 3 ? 40 : -1));
    }
    yield* wait(g.pick(40, 32, 28, 24));
  }
}

function* waveMurmuration(g: Game): Task {
  // A flock that circles in from above and then scatters.
  const n = 12;
  const cx = FIELD_W / 2;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    g.enemy(CROW, cx + Math.cos(a0) * 80, -60 + Math.sin(a0) * 30, function* (gg, e): Task {
      let a = a0;
      let cy = -20;
      for (let t = 0; t < 150; t++) {
        cy += 1.1;
        a += 0.035;
        const tx = cx + Math.cos(a) * 80;
        const ty = cy + Math.sin(a) * 40;
        e.vx = tx - e.x;
        e.vy = ty - e.y;
        if (t === 110 && i % gg.pick(4, 3, 2, 1) === 0) aimed(gg, e, C.crimson);
        yield;
      }
      const out = a + Math.PI / 2;
      for (;;) {
        e.vx = Math.cos(out) * 3.5;
        e.vy = Math.sin(out) * 3.5 + 1;
        yield;
      }
    });
  }
  yield* wait(180);
}

// ─────────────────────────────── midboss ───────────────────────────────

const BURST_FLOCK = 2;

function* matronWingbeats(g: Game): Task {
  g.patternSched.add(g.wander(150, 60));
  let k = 0;
  for (;;) {
    const b = g.boss;
    const side = k % 2 === 0 ? -1 : 1;
    const wx = b.x + side * 34;
    const base = Math.PI / 2 + side * 0.35;
    g.fan(wx, b.y, g.pick(7, 9, 11, 13), 0.16, 2.4, base, BT.petal, C.indigo);
    g.fan(wx, b.y, g.pick(6, 8, 10, 12), 0.16, 1.8, base + 0.08, BT.petal, C.violet);
    if (k % 2 === 1 && g.diff > 0) g.fan(b.x, b.y, 3, 0.1, 4, g.aimAt(b.x, b.y), BT.needle, C.white);
    k++;
    yield* wait(g.pick(36, 28, 22, 20));
  }
}

function* matronFlock(g: Game): Task {
  let k = 0;
  for (;;) {
    const b = g.boss;
    const n = g.pick(14, 20, 26, 30);
    const off = g.rng.range(0, TAU);
    const dir = k % 2 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      g.spawn({
        x: b.x, y: b.y, speed: 2.6, angle: off + (i / n) * TAU, type: BT.petal, color: C.violet,
        accel: -0.05, target: 0.5, angVel: 0.02 * dir, burstAt: 55, burstKind: BURST_FLOCK,
      });
    }
    k++;
    yield* wait(g.pick(80, 64, 52, 46));
  }
}

export const CROW_MATRON: BossDef = {
  id: 'matron',
  name: 'Crow Matron',
  title: 'Who Counts the Flock Each Evening',
  sprite: S.matron,
  hitR: 34,
  midboss: true,
  phases: [
    { id: 'matron.wings', elegy: null, hp: 900, time: 22, run: matronWingbeats },
    { id: 'matron.flock', elegy: 'Murmur Elegy “A Flock With No Memory of South”', hp: 1300, time: 32, run: matronFlock },
  ],
};

// ─────────────────────────────── Hoshiko ───────────────────────────────

const BURST_SHEAF = 3;

function* hoshikoHarvestSong(g: Game): Task {
  g.patternSched.add(g.wander(200, 70));
  let k = 0;
  for (;;) {
    const b = g.boss;
    const off = k * 0.21;
    g.ring(b.x, b.y, g.pick(16, 22, 28, 32), 2.2, off, BT.rice, C.gold);
    yield* wait(12);
    g.ring(b.x, b.y, g.pick(16, 22, 28, 32), 1.7, off + 0.1, BT.rice, C.amber);
    yield* wait(18);
    if (k % 2 === 1) {
      // Sheaves: big grains that split into fans aimed at you.
      for (let i = 0; i < g.pick(2, 3, 4, 4); i++) {
        g.spawn({ x: b.x, y: b.y, speed: 2.8, angle: Math.PI / 2 + (i - 1.5) * 0.5, type: BT.big, color: C.gold, accel: -0.06, target: 0.2, burstAt: 45, burstKind: BURST_SHEAF });
      }
    }
    k++;
    yield* wait(g.pick(50, 36, 30, 26));
  }
}

function* hoshikoGrain(g: Game): Task {
  let a = 0;
  let t = 0;
  for (;;) {
    const b = g.boss;
    const arms = g.pick(3, 5, 6, 7);
    for (let arm = 0; arm < arms; arm++) {
      const ang = a + (arm / arms) * TAU;
      g.spawn({ x: b.x, y: b.y, speed: 2.6, angle: ang, type: BT.rice, color: C.gold });
      if (g.diff > 0) g.spawn({ x: b.x, y: b.y, speed: 2.0, angle: ang + 0.09, type: BT.rice, color: C.amber });
    }
    a += 0.19 + Math.sin(t * 0.012) * 0.09;
    t += 3;
    if (t % 150 === 0) g.ring(b.x, b.y, g.pick(8, 12, 16, 18), 1.2, g.rng.range(0, TAU), BT.big, C.crimson);
    yield* wait(g.pick(5, 3, 3, 2));
  }
}

function* hoshikoSickles(g: Game): Task {
  g.patternSched.add(g.wander(180, 60));
  let k = 0;
  for (;;) {
    const b = g.boss;
    const dir = k % 2 ? 1 : -1;
    // Curving walls like the sweep of a sickle.
    for (let i = 0; i < g.pick(10, 14, 18, 20); i++) {
      g.spawn({ x: b.x, y: b.y, speed: 1.6 + i * 0.12, angle: Math.PI / 2 - dir * 1.2, type: BT.needle, color: C.ash, angVel: dir * 0.016 });
    }
    yield* wait(20);
    const a = g.aimAt(b.x, b.y);
    g.fan(b.x, b.y, g.pick(3, 5, 7, 7), 0.2, 3.0, a, BT.rice, C.gold);
    k++;
    yield* wait(g.pick(44, 34, 28, 24));
  }
}

function* hoshikoCrows(g: Game): Task {
  // Six crow familiars circle her; their formation decays as the Elegy goes on.
  const n = 6;
  const crows: Enemy[] = [];
  for (let i = 0; i < n; i++) {
    const e = g.enemy(FAMILIAR, g.boss.x, g.boss.y, function* (): Task {
      for (;;) yield;
    });
    e.intangible = true;
    crows.push(e);
  }
  const drift = crows.map(() => g.rng.range(-1, 1));
  try {
    for (let t = 0; ; t++) {
      const b = g.boss;
      const decay = Math.min(1, t / 1500);
      for (let i = 0; i < n; i++) {
        const e = crows[i];
        const a = (i / n) * TAU + t * 0.02 + drift[i] * decay * Math.sin(t * 0.013 + i) * 1.4;
        const r = 54 + decay * 40 * Math.sin(t * 0.02 + i * 2);
        const tx = b.x + Math.cos(a) * r;
        const ty = b.y + Math.sin(a) * r * 0.8;
        e.vx = tx - e.x;
        e.vy = ty - e.y;
        if ((t + i * 7) % g.pick(48, 36, 28, 24) === 0) {
          const out = Math.atan2(e.y - b.y, e.x - b.x);
          g.fan(e.x, e.y, g.pick(2, 3, 3, 4), 0.25, 2.2, out, BT.petal, C.indigo);
        }
      }
      if (t % g.pick(90, 70, 55, 50) === 0) {
        g.fan(b.x, b.y, g.pick(3, 5, 7, 9), 0.13, 3.2, g.aimAt(b.x, b.y), BT.needle, C.crimson);
      }
      yield;
    }
  } finally {
    for (const e of crows) e.alive = false;
  }
}

function* hoshikoStandingGuard(g: Game): Task {
  // Survival: rings close in on the empty middle of the field. She does not move.
  const cx = FIELD_W / 2;
  const cy = FIELD_H * 0.55;
  const R = 300;
  let k = 0;
  for (;;) {
    const count = g.pick(20, 26, 32, 36);
    const gap = g.pick(4, 3, 3, 2);
    const gapAt = Math.floor(((Math.sin(k * 0.45) + 1) / 2) * count);
    const off = k * 0.08;
    for (let i = 0; i < count; i++) {
      if (Math.abs(i - gapAt) < gap) continue;
      const a = off + (i / count) * TAU;
      g.spawn({
        x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, speed: g.pick(1.2, 1.5, 1.7, 1.9),
        angle: a + Math.PI, type: k % 2 ? BT.rice : BT.orb, color: k % 2 ? C.gold : C.amber,
      });
    }
    if (g.diff >= 2 && k % 3 === 0) {
      const b = g.boss;
      g.fan(b.x, b.y, 3, 0.15, 3.2, g.aimAt(b.x, b.y), BT.needle, C.white);
    }
    k++;
    yield* wait(g.pick(70, 56, 48, 42));
  }
}

export const HOSHIKO: BossDef = {
  id: 'hoshiko',
  name: 'Hoshiko Aze',
  title: 'the Scarecrow Who Stayed',
  sprite: S.hoshiko,
  hitR: 30,
  portrait: 'hoshiko',
  phases: [
    { id: 'hoshiko.song', elegy: null, hp: 1700, time: 32, run: hoshikoHarvestSong },
    { id: 'hoshiko.grain', elegy: 'Harvest Elegy “Grain That Was Never Sown”', hp: 2300, time: 42, run: hoshikoGrain },
    { id: 'hoshiko.sickles', elegy: null, hp: 1800, time: 32, run: hoshikoSickles },
    { id: 'hoshiko.crows', elegy: 'Field Elegy “Crows Who Forgot the Way Home”', hp: 2500, time: 45, run: hoshikoCrows },
    { id: 'hoshiko.guard', elegy: 'Scarecrow Elegy “Standing Guard Over Nothing”', hp: 1, time: 30, survival: true, run: hoshikoStandingGuard },
  ],
};

// ─────────────────────────────── dialogue ───────────────────────────────

export const STAGE1_PRE_BOSS: DialogueDef = {
  id: 'sayo.s1.pre',
  left: 'sayo',
  right: 'hoshiko',
  lines: [
    { who: 'sayo', expr: 'tired', text: 'Rice. Miles of it. All of it ripe, none of it cut.' },
    { who: 'hoshiko', expr: 'happy', text: 'Oh! A visitor! Nobody visits. Are you here to buy rice? There’s lots. Nobody eats it.', bossIntro: true, music: 'boss1' },
    { who: 'sayo', expr: 'neutral', text: 'Who planted all this?' },
    { who: 'hoshiko', expr: 'curious', text: 'No idea! Somebody with very strong arms, I think.' },
    { who: 'sayo', expr: 'neutral', text: 'And you just… guard it. For no one.' },
    { who: 'hoshiko', expr: 'proud', text: 'You say that like it’s sad. Somebody planted it. That’s enough for me.' },
    { who: 'sayo', expr: 'tired', text: '…I know someone like that. She’s very annoying.' },
    { who: 'hoshiko', expr: 'curious', text: 'Is she pretty?' },
    { who: 'sayo', expr: 'annoyed', text: 'Get out of my way, scarecrow.' },
    { who: 'hoshiko', expr: 'determined', text: 'Nope! You’re carrying fire into a dry field. Stopping things is the whole job of a scarecrow!' },
  ],
};

export const STAGE1_POST_BOSS: DialogueDef = {
  id: 'sayo.s1.post',
  left: 'sayo',
  right: 'hoshiko',
  lines: [
    { who: 'hoshiko', expr: 'hurt', text: 'Ow. Ow. That was a lot of fire for a girl with no village.' },
    { who: 'sayo', expr: 'neutral', text: 'Your field’s fine. I didn’t burn a single stalk.' },
    { who: 'hoshiko', expr: 'sad', text: 'Hey, lantern girl. Wherever you’re going… if you meet the people who planted this—' },
    { who: 'sayo', expr: 'soft', text: 'I’ll tell them it’s still here.' },
    { who: 'hoshiko', expr: 'happy', text: 'Tell them it’s growing beautifully. Tell them nobody’s eaten any. They’ll be so proud.' },
    { who: 'sayo', expr: 'tired', text: '…Sure.' },
    { who: 'sayo', expr: 'soft', text: '(Somebody planted it. That’s enough.)' },
    { who: 'sayo', expr: 'annoyed', text: '(I really hate that that’s enough.)' },
  ],
};

export const STAGE1_INTERLUDE: InterludeDef = {
  title: 'Vigil · after the fields',
  lines: [
    'The scarecrow has a field. I have a lantern.',
    'Neither of us remembers who gave them to us.',
    'She seemed happy. I don’t know what I seemed.',
    'The road goes up from here. It always goes up.',
  ],
};

// ─────────────────────────────── script ───────────────────────────────

export function registerStage1Bursts(g: Game): void {
  g.onBurst(BURST_FLOCK, (game, e) => {
    const a = Math.atan2(game.player.y - e.y, game.player.x - e.x) + game.rng.range(-0.35, 0.35);
    game.spawn({ x: e.x, y: e.y, speed: 0.8, angle: a, type: BT.rice, color: C.crimson, accel: 0.05, target: game.pick(2.0, 2.6, 3.0, 3.3) });
  });
  g.onBurst(BURST_SHEAF, (game, e) => {
    const a = Math.atan2(game.player.y - e.y, game.player.x - e.x);
    game.fan(e.x, e.y, game.pick(5, 7, 9, 11), 0.14, game.pick(2.2, 2.8, 3.2, 3.5), a, BT.rice, C.gold);
    game.ring(e.x, e.y, game.pick(6, 10, 12, 14), 1.4, a, BT.small, C.amber);
  });
}

function* clearField(g: Game): Task {
  while (g.enemies.some((e) => e.alive && !e.intangible)) yield;
}

export function* stage1(g: Game): Task {
  registerStage1Bursts(g);
  g.showStageCard(STAGE1_INFO);

  if (g.startAt === 'start') {
    yield* wait(180);
    yield* waveChaffLines(g);
    yield* wait(40);
    yield* waveCrows(g, 10);
    yield* wait(60);
    g.enemy(LANTERN, FIELD_W / 2, -24, lanternHold(120, 300));
    yield* wait(80);
    g.stageSched.add(waveCrows(g, 6));
    yield* wait(300);
    yield* waveColumns(g);
    yield* wait(80);
    g.enemy(LANTERN, 96, -24, lanternHold(100, 240));
    g.enemy(LANTERN, FIELD_W - 96, -24, lanternHold(100, 240));
    yield* wait(120);
    yield* waveChaffLines(g);
    yield* clearField(g);
    yield* wait(60);
  }

  if (g.startAt !== 'boss') {
    yield* g.runBoss(CROW_MATRON);
    yield* wait(90);
    yield* waveMurmuration(g);
    yield* wait(60);
    for (let i = 0; i < 3; i++) {
      g.enemy(LANTERN, [96, FIELD_W - 96, FIELD_W / 2][i], -24, lanternHold(90 + i * 20, 220, true));
      yield* wait(140);
    }
    g.stageSched.add(waveCrows(g, 8));
    yield* waveColumns(g);
    yield* wait(40);
    yield* waveChaffLines(g);
    yield* clearField(g);
    yield* wait(120);
  }

  yield* g.runBoss(HOSHIKO, STAGE1_PRE_BOSS, STAGE1_POST_BOSS);
  yield* g.stageClear(1);
}
