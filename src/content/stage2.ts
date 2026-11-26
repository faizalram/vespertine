import { wait, type Task } from '../core/scheduler';
import { BT } from '../game/bulletTypes';
import { FIELD_H, FIELD_W, TAU } from '../game/constants';
import { IT, type BossDef, type CharId, type DialogueDef, type EnemyDef, type StageInfo } from '../game/defs';
import type { Enemy, Game } from '../game/game';
import { C } from '../game/palette';
import { S } from '../game/sprites';
import { clearField, remnant, type StageStory } from './stage1';

/**
 * Stage 2 — The Drowned Lantern Market (spec §4.3, §5).
 * A canal town sunk under a lake; paper lanterns float up through the water.
 * Midboss: Hoshiko (rematch). Boss: Ondine Vesk, Pawnbroker of Yesterdays.
 * Theme: memory as property. Who owns the past?
 */

export const STAGE2_INFO: StageInfo = {
  number: 2,
  scene: 'market',
  title: 'The Drowned Lantern Market',
  poem: ['Everything here was sold once.', 'The water keeps the receipts.'],
  music: 'stage2',
};

// ─────────────────────────────── enemies ───────────────────────────────

const KOI: EnemyDef = { sprite: S.koi, hp: 9, r: 11, drops: [IT.power], orient: true };
const KOI_PT: EnemyDef = { sprite: S.koi, hp: 9, r: 11, drops: [IT.point], orient: true };
const BOAT: EnemyDef = { sprite: S.paperBoat, hp: 16, r: 12, drops: [IT.point, IT.power] };
const DROWNED_LANTERN: EnemyDef = { sprite: S.drownedLantern, hp: 110, r: 18, drops: [IT.powerBig, IT.powerBig, IT.point, IT.point, IT.point] };

function aimed(g: Game, e: Enemy, type: number = BT.coin, color: number = C.gold): void {
  g.fan(e.x, e.y, g.pick(1, 1, 3, 3), 0.2, g.pick(2.2, 2.7, 3.1, 3.5), g.aimAt(e.x, e.y), type, color);
}

/** Koi spirit: swims an S-curve across the canal and flicks a coin at you once. */
function koiSwim(dir: 1 | -1, amp: number) {
  return function* (g: Game, e: Enemy): Task {
    for (let t = 0; ; t++) {
      e.vx = dir * 2.4;
      e.vy = Math.cos(t * 0.05) * amp + 0.5;
      if (t === 50) aimed(g, e, BT.coin, C.gold);
      yield;
    }
  };
}

/** Paper boat: drifts down on the current, zig-zagging, firing a little three-way spread. */
function boatDrift(x0: number) {
  return function* (g: Game, e: Enemy): Task {
    const phase = g.rng.range(0, TAU);
    for (let t = 0; ; t++) {
      e.vy = 1.1;
      e.vx = Math.sin(t * 0.035 + phase) * 1.0 + (FIELD_W / 2 - x0) * 0.0008;
      if (t > 40 && t % g.pick(80, 60, 48, 40) === 0 && e.y < FIELD_H * 0.65) {
        g.fan(e.x, e.y, 3, 0.35, g.pick(1.8, 2.2, 2.6, 2.9), Math.PI / 2, BT.paper, C.teal);
      }
      yield;
    }
  };
}

/** Drowned lantern: rises up from under the water, breathes out ripples, and sinks again. */
function lanternRise(stopY: number, hold: number) {
  return function* (g: Game, e: Enemy): Task {
    while (e.y > stopY) {
      e.vy = -Math.max(0.5, (e.y - stopY) * 0.025);
      yield;
    }
    e.vy = 0;
    for (let t = 0; t < hold; t++) {
      if (t % g.pick(55, 42, 34, 30) === 0) {
        const off = g.rng.range(0, TAU);
        g.ring(e.x, e.y, g.pick(14, 20, 26, 30), 1.0, off, BT.orb, C.teal, { accel: 0.02, target: 2.2 });
      }
      yield;
    }
    for (;;) {
      e.vy = Math.min(2, e.vy + 0.04);
      yield;
    }
  };
}

function* waveKoi(g: Game, n: number, dir: 1 | -1): Task {
  for (let i = 0; i < n; i++) {
    g.enemy(i % 2 ? KOI : KOI_PT, dir > 0 ? -16 : FIELD_W + 16, 50 + (i % 3) * 22, koiSwim(dir, 1.2));
    yield* wait(g.pick(16, 12, 10, 9));
  }
}

function* waveBoats(g: Game, rows: number): Task {
  const xs = [70, 160, 240, 320];
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < 2; k++) {
      const x = xs[(r * 2 + k) % xs.length] + g.rng.range(-10, 10);
      g.enemy(BOAT, x, -14, boatDrift(x));
    }
    yield* wait(g.pick(60, 45, 38, 32));
  }
}

// ─────────────────────────────── midboss: Hoshiko again ───────────────────────────────

function* hoshikoDrift(g: Game): Task {
  g.patternSched.add(g.wander(160, 60));
  let k = 0;
  for (;;) {
    const b = g.boss;
    g.ring(b.x, b.y, g.pick(14, 18, 24, 28), 2.0, k * 0.17, BT.rice, C.gold);
    if (k % 2) g.fan(b.x, b.y, g.pick(3, 5, 5, 7), 0.18, 3.0, g.aimAt(b.x, b.y), BT.rice, C.amber);
    k++;
    yield* wait(g.pick(40, 30, 24, 22));
  }
}

function* hoshikoDownriver(g: Game): Task {
  // Rice falls like rain on a river wind, while she flicks sheaves at you.
  let t = 0;
  for (;;) {
    const wind = Math.sin(t * 0.006) * 0.45;
    if (t % g.pick(5, 3, 2, 2) === 0) {
      g.spawn({ x: g.rng.range(-40, FIELD_W + 40), y: -12, speed: 0.6, angle: Math.PI / 2 + wind, type: BT.rice, color: C.gold, grav: 0.025 });
    }
    if (t % g.pick(70, 55, 45, 40) === 0) {
      const b = g.boss;
      g.fan(b.x, b.y, g.pick(5, 7, 9, 11), 0.15, 2.6, g.aimAt(b.x, b.y), BT.rice, C.amber);
    }
    t++;
    yield;
  }
}

export const HOSHIKO_REMATCH: BossDef = {
  id: 'hoshiko2',
  name: 'Hoshiko Aze',
  title: 'Who Followed You Downriver',
  sprite: S.hoshiko,
  hitR: 30,
  midboss: true,
  portrait: 'hoshiko',
  phases: [
    { id: 'hoshiko2.drift', elegy: null, hp: 900, time: 22, run: hoshikoDrift },
    { id: 'hoshiko2.downriver', elegy: 'Scarecrow Elegy “Following You Downriver”', hp: 1400, time: 34, recollection: 16, run: hoshikoDownriver },
  ],
};

function hoshikoInterrupts(char: CharId): DialogueDef {
  return {
    id: `${char}.s2.mid`,
    left: char,
    right: 'hoshiko',
    lines: [
      { who: 'hoshiko', expr: 'happy', text: 'Wait up! I followed you downriver! I’ve never seen a city before!' },
      { who: 'hoshiko', expr: 'curious', text: 'Is it supposed to be underwater?' },
      { who: 'hoshiko', expr: 'determined', text: 'Doesn’t matter! I came all this way, so you have to play with me first!' },
    ],
  };
}

// ─────────────────────────────── boss: Ondine Vesk ───────────────────────────────

const BURST_RIPPLE = 4;
const BURST_FADE = 5;

function* ondineHaggle(g: Game): Task {
  g.patternSched.add(g.wander(190, 70));
  let k = 0;
  for (;;) {
    const b = g.boss;
    // Coins tossed up in a glittering arc; they rain back down.
    const n = g.pick(8, 12, 16, 18);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.4;
      g.spawn({ x: b.x, y: b.y, speed: g.rng.range(2.6, 3.8), angle: a, type: BT.coin, color: C.gold, grav: 0.045 });
    }
    yield* wait(30);
    g.fan(b.x, b.y, g.pick(3, 5, 7, 7), 0.16, 3.2, g.aimAt(b.x, b.y), BT.paper, C.white);
    k++;
    yield* wait(g.pick(50, 38, 30, 26));
  }
}

function* ondineInterest(g: Game): Task {
  // Each ring is half again as large as the last, until the debt is called in.
  for (;;) {
    let n = g.pick(4, 6, 8, 8);
    const off = g.rng.range(0, TAU);
    for (let k = 0; k < 6; k++) {
      const b = g.boss;
      g.ring(b.x, b.y, Math.round(n), 1.6 + k * 0.08, off + k * 0.11, BT.coin, k % 2 ? C.gold : C.amber);
      n *= 1.5;
      yield* wait(g.pick(26, 20, 16, 14));
    }
    yield* wait(g.pick(70, 55, 45, 40));
  }
}

function* ondineAppraisal(g: Game): Task {
  g.patternSched.add(g.wander(170, 60));
  let a = 0;
  for (let t = 0; ; t++) {
    const b = g.boss;
    const arms = g.pick(3, 4, 5, 5);
    if (t % g.pick(6, 4, 3, 3) === 0) {
      for (let i = 0; i < arms; i++) g.spawn({ x: b.x, y: b.y, speed: 2.2, angle: a + (i / arms) * TAU, type: BT.coin, color: C.gold });
      a += 0.13;
    }
    if (t % 80 === 40) g.fan(b.x, b.y, g.pick(3, 5, 5, 7), 0.12, 3.8, g.aimAt(b.x, b.y), BT.needle, C.teal);
    yield;
  }
}

function* ondineLanterns(g: Game): Task {
  // Lanterns rise from beneath the water and burst into ripples, with prices written on them.
  for (let k = 0; ; k++) {
    const n = g.pick(3, 4, 5, 6);
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5 + (k % 2) * 0.5) / n) * FIELD_W;
      g.spawn({
        x, y: FIELD_H + 20, speed: 1.6, angle: -Math.PI / 2, type: BT.big, color: C.amber,
        accel: -0.008, target: 0.6, burstAt: 140 + i * 12, burstKind: BURST_RIPPLE,
      });
    }
    const b = g.boss;
    g.ring(b.x, b.y, g.pick(10, 14, 18, 22), 1.4, g.rng.range(0, TAU), BT.coin, C.gold);
    yield* wait(g.pick(150, 120, 100, 90));
  }
}

function* ondineMemory(g: Game): Task {
  // Your own path from four seconds ago, resold to you as a trail of standing coins.
  const ghost = g.memoryGhost;
  ghost.active = true;
  try {
    for (let t = 0; ; t++) {
      const [x, y] = g.trailAt(240);
      ghost.x = x;
      ghost.y = y;
      if (t > 60 && t % g.pick(7, 5, 4, 4) === 0) {
        g.spawn({ x, y, speed: 0, angle: g.rng.range(0, TAU), type: BT.glyph, color: C.azure, burstAt: g.pick(110, 140, 170, 190), burstKind: BURST_FADE });
      }
      if (t % g.pick(80, 60, 50, 45) === 0) {
        const b = g.boss;
        g.ring(b.x, b.y, g.pick(10, 16, 20, 24), 1.5, g.rng.range(0, TAU), BT.coin, C.gold);
      }
      yield;
    }
  } finally {
    ghost.active = false;
  }
}

export const ONDINE: BossDef = {
  id: 'ondine',
  name: 'Ondine Vesk',
  title: 'Pawnbroker of Yesterdays',
  sprite: S.ondine,
  hitR: 32,
  portrait: 'ondine',
  phases: [
    { id: 'ondine.haggle', elegy: null, hp: 1900, time: 32, run: ondineHaggle },
    { id: 'ondine.interest', elegy: 'Ledger Elegy “Interest Compounded in Regret”', hp: 2500, time: 42, recollection: 17, run: ondineInterest },
    { id: 'ondine.appraisal', elegy: null, hp: 2000, time: 32, run: ondineAppraisal },
    { id: 'ondine.lanterns', elegy: 'Lantern Elegy “Prices Written on Water”', hp: 2700, time: 45, recollection: 18, run: ondineLanterns },
    { id: 'ondine.memory', elegy: 'Pawn Elegy “Your First Memory, Resold”', hp: 2900, time: 50, recollection: 19, run: ondineMemory },
  ],
};

export function registerStage2Bursts(g: Game): void {
  g.onBurst(BURST_RIPPLE, (game, e) => {
    const off = game.rng.range(0, TAU);
    game.ring(e.x, e.y, game.pick(14, 20, 26, 30), 0.6, off, BT.small, C.teal, { accel: 0.025, target: game.pick(1.8, 2.2, 2.5, 2.8) });
    game.ring(e.x, e.y, game.pick(8, 10, 12, 14), 0.4, off + 0.2, BT.orb, C.amber, { accel: 0.02, target: 1.6 });
  });
  g.onBurst(BURST_FADE, () => {});
}

// ─────────────────────────────── dialogue ───────────────────────────────

const L = (char: CharId, id: string, lines: DialogueDef['lines']): DialogueDef => ({ id, left: char, right: 'ondine', lines });

export const STAGE2_STORY: Record<CharId, StageStory> = {
  // Sayo: what is a prayer worth? Ondine has an old ticket with a familiar name on it.
  sayo: {
    pre: L('sayo', 'sayo.s2.pre', [
      { who: 'sayo', expr: 'tired', text: 'A whole town under the lake, and every window still lit. Somebody pays for the oil.' },
      { who: 'ondine', expr: 'grin', text: 'Somebody does, darling! Welcome to Vesk’s. Everything you’ve forgotten, held in trust, for a modest fee.', bossIntro: true, music: 'boss2' },
      { who: 'sayo', expr: 'neutral', text: 'You’re a pawnbroker.' },
      { who: 'ondine', expr: 'sly', text: 'I’m a librarian with better margins. And you, lantern girl, are carrying something very valuable.' },
      { who: 'sayo', expr: 'annoyed', text: 'It’s a lantern.' },
      { who: 'ondine', expr: 'counting', text: 'It’s the last prayer to a god nobody remembers. Do you know what that’s worth? I’ll give you a fortune for it.' },
      { who: 'sayo', expr: 'neutral', text: 'It isn’t for sale. It isn’t even mine. That’s the point.' },
      { who: 'ondine', expr: 'offended', text: 'Everything’s for sale, sweetheart. Some things just haven’t heard the right offer.' },
    ]),
    post: L('sayo', 'sayo.s2.post', [
      { who: 'ondine', expr: 'offended', text: 'Fine! Keep your lamp! No refunds on my dignity.' },
      { who: 'sayo', expr: 'neutral', text: 'You don’t actually sell any of this, do you.' },
      { who: 'ondine', expr: 'sincere', text: '…Somebody has to keep it. If I call it a business, nobody asks me why I cry over the inventory.' },
      { who: 'ondine', expr: 'sad', text: 'Funny thing. The oldest ticket in my vault is for a prayer. A girl named Amari pawned it a hundred years ago.' },
      { who: 'sayo', expr: 'surprised', text: 'What did she pawn?' },
      { who: 'ondine', expr: 'sad', text: 'Her grief. Or she tried to. It was too heavy for my shelves. It went up, toward the moon.' },
      { who: 'sayo', expr: 'tired', text: '(A hundred years. That’s when my god went quiet.)' },
    ]),
    interlude: {
      title: 'Vigil · after the market',
      lines: [
        'The pawnbroker cries over her shelves and calls it accounting.',
        'A girl named Amari tried to sell her grief. It was too heavy to keep.',
        'I have kept this lantern lit for longer than I can remember.',
        'I am beginning to wonder whose grief it has been holding up.',
      ],
    },
  },

  // Ilse: Ondine owns the one map Ilse cannot draw.
  ilse: {
    pre: L('ilse', 'ilse.s2.pre', [
      { who: 'ilse', expr: 'grin', text: 'A flooded city! Streets, bridges, canals. Hold still, nobody fade, I’m inking.' },
      { who: 'ondine', expr: 'grin', text: 'A cartographer! Oh, I adore cartographers. Your blank maps sell beautifully. People see whatever they’ve lost in them.', bossIntro: true, music: 'boss2' },
      { who: 'ilse', expr: 'annoyed', text: 'You sell my blank maps?' },
      { who: 'ondine', expr: 'sly', text: 'Second shelf, by the door. Very popular with widowers.' },
      { who: 'ondine', expr: 'counting', text: 'And I have one of yours you’ll want back. Shelf nine. A little town. Lovely river. You drew it as a child.' },
      { who: 'ilse', expr: 'surprised', text: '…My hometown. You have my hometown.' },
      { who: 'ondine', expr: 'grin', text: 'For the right price, darling. Let’s haggle.' },
      { who: 'ilse', expr: 'annoyed', text: 'Oh, we’re going to haggle.' },
    ]),
    post: L('ilse', 'ilse.s2.post', [
      { who: 'ondine', expr: 'offended', text: 'All right! All right. Shelf nine. The ticket’s yours. Go on.' },
      { who: 'ilse', expr: 'sad', text: '…' },
      { who: 'ondine', expr: 'sincere', text: 'You’re not taking it.' },
      { who: 'ilse', expr: 'neutral', text: 'If I take it, I stop looking. If I stop looking, I stop drawing.' },
      { who: 'ilse', expr: 'smug', text: 'Keep it. Somebody should remember that town, even if she’s a crook.' },
      { who: 'ondine', expr: 'sad', text: '…I’ll dust it every week. Professional courtesy.' },
      { who: 'ilse', expr: 'grin', text: '(And now I know it exists. That’s a start. That’s a whole compass point.)' },
    ]),
    interlude: {
      title: 'Vigil · after the market',
      lines: [
        'My hometown is on shelf nine, in a drowned shop, next to a jar of somebody’s first kiss.',
        'I could have taken it. I didn’t.',
        'A map you’ve finished is a map you’ve stopped walking.',
        'I’m not done walking. I don’t think I ever want to be.',
      ],
    },
  },

  // Tessel: Ondine recognises her parts as stock. Who owns a self made of property?
  tessel: {
    pre: L('tessel', 'tessel.s2.pre', [
      { who: 'tessel', expr: 'curious', text: 'There are lanterns under the water. My glass eye has seen this street before.' },
      { who: 'ondine', expr: 'grin', text: 'Of course it has, sweetheart. I sold it. Lot two hundred and six: one glass eye, gently used, with memories.', bossIntro: true, music: 'boss2' },
      { who: 'tessel', expr: 'surprised', text: 'You sold my eye?' },
      { who: 'ondine', expr: 'counting', text: 'And the music box. And those hands, unless I’m very much mistaken. A dollmaker bought the lot. Paid in cash.' },
      { who: 'tessel', expr: 'blank', text: 'Then I am made of your inventory.' },
      { who: 'ondine', expr: 'sly', text: 'Technically, darling, you’re made of my unpaid invoices.' },
      { who: 'tessel', expr: 'sad', text: 'What am I worth?' },
      { who: 'ondine', expr: 'grin', text: 'Let’s find out! I always appraise by stress test.' },
    ]),
    post: L('tessel', 'tessel.s2.post', [
      { who: 'ondine', expr: 'offended', text: 'Ow! Damaged goods! Damaged goods!' },
      { who: 'tessel', expr: 'neutral', text: 'Do you want your parts back?' },
      { who: 'ondine', expr: 'sincere', text: '…No. Keep them. They look better on you. They were only ever sitting on my shelves, being sad.' },
      { who: 'tessel', expr: 'curious', text: 'The dollmaker. Who were they?' },
      { who: 'ondine', expr: 'sad', text: 'Tall. Quiet. Wore white like a nun. Took the whole lot and said she was building someone to remember them.' },
      { who: 'tessel', expr: 'blank', text: '…' },
      { who: 'tessel', expr: 'smile', text: '(Someone made me on purpose. To remember. That is a kind of job.)' },
    ]),
    interlude: {
      title: 'Vigil · after the market',
      lines: [
        'I was bought. Lot two hundred and six, and five others.',
        'But the pawnbroker would not take me back. She said I looked better than her shelves.',
        'A dollmaker in white built me to remember the people inside me.',
        'If that is my purpose, I would like to be good at it.',
      ],
    },
  },

  // Wren: the coin for the ferryman. Passage and payment.
  wren: {
    pre: L('wren', 'wren.s2.pre', [
      { who: 'wren', expr: 'tired', text: 'A drowned market. I used to row through towns like this, carrying whoever the water took.' },
      { who: 'ondine', expr: 'grin', text: 'A ferrywoman! Colleague! We’re both in the passage business, sister. I just keep better books.', bossIntro: true, music: 'boss2' },
      { who: 'wren', expr: 'stern', text: 'I never charged anyone.' },
      { who: 'ondine', expr: 'sly', text: 'Oh? Then who took the coin from under all those tongues? Don’t look at me like that.' },
      { who: 'wren', expr: 'sad', text: 'The coin was for them, not me. It’s how they knew they had paid enough to let go.' },
      { who: 'ondine', expr: 'counting', text: 'Well, my customers don’t want to let go. They want to pawn it. Grief, kept on a shelf, collecting interest.' },
      { who: 'wren', expr: 'wry', text: 'And who pays the interest?' },
      { who: 'ondine', expr: 'grin', text: 'Ha! Nobody’s asked me that in a century. Let’s settle the account, sister!' },
    ]),
    post: L('wren', 'wren.s2.post', [
      { who: 'ondine', expr: 'offended', text: 'Account settled! Painfully!' },
      { who: 'wren', expr: 'soft', text: 'You keep all of it, don’t you. Every memory nobody came back for.' },
      { who: 'ondine', expr: 'sincere', text: 'Somebody should. Your lot used to. Then the river stopped and I was the only one left with shelves.' },
      { who: 'ondine', expr: 'sad', text: 'Here. A coin, for whoever you carry next. Don’t tell anyone I gave something away.' },
      { who: 'wren', expr: 'soft', text: '…Thank you. I’ll put it under the right tongue.' },
      { who: 'ondine', expr: 'sad', text: 'Your old mother superior came through here, you know. Heading up the Procession Road. She didn’t stop to shop.' },
      { who: 'wren', expr: 'stern', text: '(Mother Cinder. You never did like paying for anything.)' },
    ]),
    interlude: {
      title: 'Vigil · after the market',
      lines: [
        'The pawnbroker gave me a coin and made me promise not to tell.',
        'It is warm. Someone held it a long time before letting go.',
        'Grief kept on a shelf earns nothing. Grief carried across the water is finally spent.',
        'I have a passenger’s fare now. I need only find the passenger.',
      ],
    },
  },
};

// ─────────────────────────────── script ───────────────────────────────

export function* stage2(g: Game): Task {
  registerStage2Bursts(g);
  g.showStageCard(STAGE2_INFO);
  const S2 = 2;

  if (g.startAt === 'start') {
    yield* wait(200);
    remnant(g, S2, 0, true, 80);
    yield* waveKoi(g, 8, 1);
    yield* wait(60);
    yield* waveKoi(g, 8, -1);
    yield* wait(40);
    remnant(g, S2, 1, false, 60);
    yield* waveBoats(g, 4);
    yield* wait(60);
    g.enemy(DROWNED_LANTERN, 70, FIELD_H + 30, lanternRise(200, 260));
    g.enemy(DROWNED_LANTERN, FIELD_W - 70, FIELD_H + 30, lanternRise(220, 260));
    yield* wait(160);
    g.stageSched.add(waveKoi(g, 6, 1));
    remnant(g, S2, 2, true, 110);
    yield* wait(200);
    yield* waveBoats(g, 3);
    yield* clearField(g);
    yield* wait(60);
  }

  if (g.startAt !== 'boss') {
    yield* g.runBoss(HOSHIKO_REMATCH, hoshikoInterrupts(g.char.id));
    yield* wait(80);
    remnant(g, S2, 3, false, 90);
    g.stageSched.add(waveKoi(g, 8, -1));
    yield* waveBoats(g, 3);
    for (let i = 0; i < 3; i++) {
      g.enemy(DROWNED_LANTERN, [FIELD_W / 2, 80, FIELD_W - 80][i], FIELD_H + 30, lanternRise(180 + i * 20, 200));
      yield* wait(110);
    }
    remnant(g, S2, 4, true, 70);
    yield* waveKoi(g, 10, 1);
    yield* wait(40);
    remnant(g, S2, 5, false, 120);
    yield* waveBoats(g, 4);
    yield* clearField(g);
    yield* wait(120);
  }

  const story = STAGE2_STORY[g.char.id];
  yield* g.runBoss(ONDINE, story.pre, story.post);
  yield* g.stageClear(2);
}
