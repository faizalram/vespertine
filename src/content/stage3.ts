import { wait, type Task } from '../core/scheduler';
import { BT } from '../game/bulletTypes';
import { FIELD_H, FIELD_W, TAU } from '../game/constants';
import { IT, type BossDef, type CharId, type DialogueDef, type EnemyDef, type StageInfo } from '../game/defs';
import type { Enemy, Game } from '../game/game';
import { C } from '../game/palette';
import { S } from '../game/sprites';
import { clearField, remnant, type StageStory } from './stage1';

/**
 * Stage 3 — The Library of Kinder Endings (spec §4.3, §5).
 * A vast library where sad books rewrite themselves into happy ones, and go blank.
 * Midboss: the Inkmoth Swarm. Boss: Seraphine Lull, the Archivist Who Edits.
 * Theme: comforting lies vs. painful truths.
 */

export const STAGE3_INFO: StageInfo = {
  number: 3,
  scene: 'library',
  title: 'The Library of Kinder Endings',
  poem: ['Every story here ends happily.', 'That is how you know they are lying.'],
  music: 'stage3',
};

// ─────────────────────────────── enemies ───────────────────────────────

const MOTH: EnemyDef = { sprite: S.inkmoth, hp: 6, r: 10, drops: [IT.point], orient: true };
const MOTH_P: EnemyDef = { sprite: S.inkmoth, hp: 6, r: 10, drops: [IT.power], orient: true };
const BOOK: EnemyDef = { sprite: S.book, hp: 70, r: 17, drops: [IT.powerBig, IT.point, IT.point, IT.point] };
const QUILL: EnemyDef = { sprite: S.quill, hp: 12, r: 10, drops: [IT.power, IT.point], orient: true };
const FAMILIAR_MOTH: EnemyDef = { sprite: S.inkmoth, hp: 1, r: 1, drops: [] };

/** Inkmoth: flutters along a noisy line, sometimes letting a drop of ink fall. */
function mothFlutter(vx: number, vy: number) {
  return function* (g: Game, e: Enemy): Task {
    const ph = g.rng.range(0, TAU);
    for (let t = 0; ; t++) {
      e.vx = vx + Math.sin(t * 0.21 + ph) * 1.3;
      e.vy = vy + Math.cos(t * 0.17 + ph) * 1.0;
      if (t % g.pick(90, 70, 55, 50) === 45 && e.y < FIELD_H * 0.6) {
        g.spawn({ x: e.x, y: e.y, speed: 1.6, angle: g.aimAt(e.x, e.y), type: BT.small, color: C.indigo });
      }
      yield;
    }
  };
}

/** Floating book: drifts in, opens, and recites a few lines of glyphs at you. */
function bookRecite(stopY: number) {
  return function* (g: Game, e: Enemy): Task {
    while (e.y < stopY) {
      e.vy = Math.max(0.3, (stopY - e.y) * 0.05);
      yield;
    }
    e.vy = 0;
    for (let line = 0; line < g.pick(3, 4, 5, 6); line++) {
      const a = g.aimAt(e.x, e.y);
      for (let k = 0; k < g.pick(6, 8, 10, 12); k++) {
        // A line of text: glyphs in a row, perpendicular to the aim, all moving together.
        const off = (k - 4.5) * 9;
        g.spawn({ x: e.x + Math.cos(a + Math.PI / 2) * off, y: e.y + Math.sin(a + Math.PI / 2) * off, speed: 2.0, angle: a, type: BT.glyph, color: C.white });
      }
      yield* wait(g.pick(60, 45, 36, 30));
    }
    for (;;) {
      e.vy = Math.max(-2.4, e.vy - 0.05);
      yield;
    }
  };
}

/** Quill: darts down toward where you are, then spits a fan of needles. */
function quillDive() {
  return function* (g: Game, e: Enemy): Task {
    const a = g.aimAt(e.x, e.y);
    for (let t = 0; t < 40; t++) {
      e.vx = Math.cos(a) * 3.2;
      e.vy = Math.sin(a) * 3.2;
      yield;
    }
    e.vx *= 0.2;
    e.vy *= 0.2;
    g.fan(e.x, e.y, g.pick(3, 5, 5, 7), 0.2, g.pick(2.4, 3, 3.4, 3.8), g.aimAt(e.x, e.y), BT.needle, C.indigo);
    yield* wait(20);
    for (;;) {
      e.vy = Math.max(-3, e.vy - 0.1);
      yield;
    }
  };
}

function* waveMoths(g: Game, n: number, fromLeft: boolean): Task {
  for (let i = 0; i < n; i++) {
    const y = 40 + g.rng.range(0, 80);
    g.enemy(i % 3 ? MOTH : MOTH_P, fromLeft ? -14 : FIELD_W + 14, y, mothFlutter(fromLeft ? 1.8 : -1.8, 0.5));
    yield* wait(g.pick(10, 8, 6, 6));
  }
}

function* waveQuills(g: Game, n: number): Task {
  for (let i = 0; i < n; i++) {
    g.enemy(QUILL, 40 + ((i * 97) % (FIELD_W - 80)), -14, quillDive());
    yield* wait(g.pick(30, 22, 18, 15));
  }
}

// ─────────────────────────────── midboss: Inkmoth Swarm ───────────────────────────────

const BURST_INKDROP = 6;

function spawnFamiliars(g: Game, n: number): Enemy[] {
  const out: Enemy[] = [];
  for (let i = 0; i < n; i++) {
    const e = g.enemy(FAMILIAR_MOTH, g.boss.x, g.boss.y, function* (): Task {
      for (;;) yield;
    });
    e.intangible = true;
    out.push(e);
  }
  return out;
}

function* swarmFlutter(g: Game): Task {
  g.patternSched.add(g.wander(150, 60));
  const moths = spawnFamiliars(g, 8);
  try {
    for (let t = 0; ; t++) {
      const b = g.boss;
      moths.forEach((e, i) => {
        const a = (i / moths.length) * TAU + t * 0.03;
        const r = 48 + Math.sin(t * 0.05 + i) * 10;
        e.vx = b.x + Math.cos(a) * r - e.x;
        e.vy = b.y + Math.sin(a) * r * 0.7 - e.y;
        if ((t + i * 11) % g.pick(70, 54, 44, 40) === 0) {
          g.fan(e.x, e.y, g.pick(1, 2, 3, 3), 0.25, 2.2, g.aimAt(e.x, e.y), BT.petal, C.indigo);
        }
      });
      yield;
    }
  } finally {
    for (const e of moths) e.alive = false;
  }
}

function* swarmLastPage(g: Game): Task {
  // Moths peel off and dive across the page, leaving drops of ink that fall a moment later.
  const moths = spawnFamiliars(g, 6);
  const dive = moths.map(() => ({ t: -1, vx: 0, vy: 0 }));
  try {
    for (let t = 0; ; t++) {
      const b = g.boss;
      moths.forEach((e, i) => {
        const d = dive[i];
        if (d.t < 0) {
          const a = (i / moths.length) * TAU + t * 0.025;
          e.vx = b.x + Math.cos(a) * 52 - e.x;
          e.vy = b.y + Math.sin(a) * 36 - e.y;
          if ((t + i * 37) % g.pick(200, 160, 130, 110) === 0) {
            const aim = g.aimAt(e.x, e.y);
            Object.assign(d, { t: 0, vx: Math.cos(aim) * 4.2, vy: Math.sin(aim) * 4.2 });
          }
        } else {
          e.vx = d.vx;
          e.vy = d.vy;
          if (d.t % g.pick(6, 4, 3, 3) === 0) {
            g.spawn({ x: e.x, y: e.y, speed: 0, angle: Math.PI / 2, type: BT.small, color: C.indigo, burstAt: 40, burstKind: BURST_INKDROP });
          }
          // Wrap back to the swarm once it leaves the page.
          if (++d.t > 120 || e.x < -30 || e.x > FIELD_W + 30 || e.y < -30 || e.y > FIELD_H + 30) {
            d.t = -1;
            e.x = b.x;
            e.y = b.y;
          }
        }
      });
      yield;
    }
  } finally {
    for (const e of moths) e.alive = false;
  }
}

export const INKMOTH_SWARM: BossDef = {
  id: 'swarm',
  name: 'The Inkmoth Swarm',
  title: 'Who Eat Only Endings',
  sprite: S.mothQueen,
  hitR: 30,
  midboss: true,
  phases: [
    { id: 'swarm.flutter', elegy: null, hp: 1000, time: 24, run: swarmFlutter },
    { id: 'swarm.page', elegy: 'Swarm Elegy “Moths Who Ate the Last Page”', hp: 1500, time: 36, recollection: 26, run: swarmLastPage },
  ],
};

// ─────────────────────────────── boss: Seraphine Lull ───────────────────────────────

function* seraphineMarginalia(g: Game): Task {
  g.patternSched.add(g.wander(200, 70));
  for (let k = 0; ; k++) {
    const b = g.boss;
    // Lines of text swept across the page, each with a gap where a word was erased.
    const n = g.pick(14, 18, 22, 24);
    const gap = g.rng.int(n - 4) + 2;
    const base = Math.PI / 2 + (k % 2 ? 0.35 : -0.35);
    for (let i = 0; i < n; i++) {
      if (Math.abs(i - gap) < g.pick(3, 2, 2, 1.5)) continue;
      const a = base + (i - n / 2) * 0.09;
      g.spawn({ x: b.x, y: b.y, speed: 2.1, angle: a, type: BT.glyph, color: C.white });
    }
    if (k % 2) g.fan(b.x, b.y, g.pick(3, 3, 5, 5), 0.15, 3.4, g.aimAt(b.x, b.y), BT.needle, C.rose);
    yield* wait(g.pick(42, 32, 26, 22));
  }
}

function* seraphineFootnotes(g: Game): Task {
  // Dense columns of tiny glyphs fall like footnotes; the gaps drift.
  const cols = 16;
  const w = FIELD_W / cols;
  for (let t = 0; ; t++) {
    if (t % g.pick(12, 9, 7, 6) === 0) {
      const gapA = Math.floor(((Math.sin(t * 0.011) + 1) / 2) * (cols - 3));
      const gapB = (gapA + 8) % cols;
      for (let c = 0; c < cols; c++) {
        const inGap = (c >= gapA && c < gapA + g.pick(4, 3, 3, 2)) || (g.diff >= 2 && c === gapB);
        if (inGap) continue;
        g.spawn({ x: (c + 0.5) * w, y: -8, speed: 1.6, angle: Math.PI / 2, type: BT.glyph, color: c % 2 ? C.white : C.ash });
      }
    }
    if (t % g.pick(90, 70, 55, 50) === 30) {
      const b = g.boss;
      g.fan(b.x, b.y, 3, 0.2, 3.2, g.aimAt(b.x, b.y), BT.needle, C.rose);
    }
    yield;
  }
}

function* seraphineErrata(g: Game): Task {
  g.patternSched.add(g.wander(170, 60));
  for (let t = 0; ; t++) {
    const b = g.boss;
    if (t % g.pick(5, 4, 3, 3) === 0) {
      // Two crossing streams of corrections.
      const a = Math.PI / 2 + Math.sin(t * 0.02) * 0.9;
      g.spawn({ x: b.x - 30, y: b.y, speed: 2.4, angle: a, type: BT.glyph, color: C.rose });
      g.spawn({ x: b.x + 30, y: b.y, speed: 2.4, angle: Math.PI - a, type: BT.glyph, color: C.violet });
    }
    if (t % 60 === 0) g.ring(b.x, b.y, g.pick(10, 14, 18, 20), 1.5, g.rng.range(0, TAU), BT.orb, C.ash);
    yield;
  }
}

function* seraphineRedaction(g: Game): Task {
  // Black bars strike out whole lanes of the page. One lane is always left legible.
  const lanes = 7;
  const laneH = (FIELD_H - 60) / lanes;
  for (let k = 0; ; k++) {
    const safe = g.rng.int(lanes - 2) + 1;
    const safe2 = g.diff === 0 ? (safe + 3) % lanes : -1;
    for (let i = 0; i < lanes; i++) {
      if (i === safe || i === safe2) continue;
      const y = 60 + (i + 0.5) * laneH;
      g.lasers.spawn(-10, y, 0, FIELD_W + 20, laneH * 0.8, g.pick(60, 50, 44, 40), 46, C.white, 1);
    }
    g.events.push('laser');
    if (g.diff >= 2 && k % 2 === 1) {
      // On harder difficulties, a vertical strike follows the horizontal ones.
      const x = g.player.x;
      g.lasers.spawn(x, -10, Math.PI / 2, FIELD_H + 20, 26, 70, 40, C.white, 1);
    }
    const b = g.boss;
    for (let t = 0; t < g.pick(130, 115, 100, 95); t++) {
      if (t % g.pick(16, 12, 10, 9) === 0) {
        g.spawn({ x: g.rng.range(0, FIELD_W), y: -8, speed: 1.2, angle: Math.PI / 2 + g.rng.range(-0.2, 0.2), type: BT.glyph, color: C.ash });
      }
      if (t === 60) g.fan(b.x, b.y, g.pick(3, 5, 5, 7), 0.16, 2.8, g.aimAt(b.x, b.y), BT.needle, C.rose);
      yield;
    }
  }
}

function* seraphineHappyEnding(g: Game): Task {
  // A gentle flower of petals turns slowly... and keeps tightening until it is no longer gentle.
  let a = 0;
  for (let t = 0; ; t++) {
    const k = Math.min(1, t / 1800); // over thirty seconds, the ending is revised
    const every = Math.round(g.pick(8, 6, 5, 4) - k * 2);
    if (t % Math.max(2, every) === 0) {
      const b = g.boss;
      const petals = g.pick(5, 6, 7, 8);
      const color = k < 0.35 ? C.rose : k < 0.7 ? C.crimson : C.violet;
      for (let i = 0; i < petals; i++) {
        const ang = a + (i / petals) * TAU;
        g.spawn({ x: b.x, y: b.y, speed: 1.2 + k * 1.4, angle: ang, type: BT.petal, color, angVel: 0.006 + k * 0.006 });
        g.spawn({ x: b.x, y: b.y, speed: 1.2 + k * 1.4, angle: -ang, type: BT.petal, color, angVel: -(0.006 + k * 0.006) });
      }
      a += 0.07 + k * 0.05;
    }
    yield;
  }
}

export const SERAPHINE: BossDef = {
  id: 'seraphine',
  name: 'Seraphine Lull',
  title: 'the Archivist Who Edits',
  sprite: S.seraphine,
  hitR: 30,
  portrait: 'seraphine',
  phases: [
    { id: 'seraphine.marginalia', elegy: null, hp: 2000, time: 32, run: seraphineMarginalia },
    { id: 'seraphine.footnotes', elegy: 'Index Elegy “Footnotes to a Forgotten War”', hp: 2600, time: 42, recollection: 27, run: seraphineFootnotes },
    { id: 'seraphine.errata', elegy: null, hp: 2100, time: 32, run: seraphineErrata },
    { id: 'seraphine.redaction', elegy: 'Redaction Elegy “Black Bars Across the Sky”', hp: 1, time: 36, survival: true, recollection: 28, run: seraphineRedaction },
    { id: 'seraphine.ending', elegy: 'Revision Elegy “The Happy Ending You Were Promised”', hp: 3200, time: 55, recollection: 29, run: seraphineHappyEnding },
  ],
};

export function registerStage3Bursts(g: Game): void {
  g.onBurst(BURST_INKDROP, (game, e) => {
    // The drop of ink falls, then splatters into three.
    game.fan(e.x, e.y, game.pick(1, 2, 3, 3), 0.5, 1.6, game.aimAt(e.x, e.y), BT.small, C.indigo);
  });
}

// ─────────────────────────────── dialogue ───────────────────────────────

const L = (char: CharId, id: string, lines: DialogueDef['lines']): DialogueDef => ({ id, left: char, right: 'seraphine', lines });

export const STAGE3_STORY: Record<CharId, StageStory> = {
  sayo: {
    pre: L('sayo', 'sayo.s3.pre', [
      { who: 'sayo', expr: 'neutral', text: 'Every book on this shelf ends with “and they lived happily.” Every single one.' },
      { who: 'seraphine', expr: 'gentle', text: 'Shh. This is a library. And yes. I made sure of it.', bossIntro: true, music: 'boss3' },
      { who: 'seraphine', expr: 'smile', text: 'You carry a sad story, Keeper. A god forgotten by everyone but you. Let me give it a better ending.' },
      { who: 'sayo', expr: 'tired', text: 'What ending?' },
      { who: 'seraphine', expr: 'gentle', text: 'The god simply went to sleep, content, and the girl was free to go home. Isn’t that kinder?' },
      { who: 'sayo', expr: 'annoyed', text: 'He didn’t go to sleep. He was forgotten. That’s the true ending, and I’m keeping it.' },
      { who: 'seraphine', expr: 'pleading', text: 'Why carry the sad version?' },
      { who: 'sayo', expr: 'neutral', text: 'Because it’s the version where somebody stayed.' },
    ]),
    post: L('sayo', 'sayo.s3.post', [
      { who: 'seraphine', expr: 'sad', text: 'You really won’t let me help.' },
      { who: 'sayo', expr: 'neutral', text: 'Look at your shelves. Every book you fixed is blank.' },
      { who: 'seraphine', expr: 'shocked', text: '…They were happy.' },
      { who: 'sayo', expr: 'soft', text: 'They were empty. A story with nothing sad left in it has nothing left in it at all.' },
      { who: 'seraphine', expr: 'sad', text: 'There is one book I could never edit. The oldest. It is only one line, in a girl’s handwriting.' },
      { who: 'seraphine', expr: 'sad', text: '“Let no one ever grieve as I grieve.” Every time I rewrite it, the ink comes back.' },
      { who: 'sayo', expr: 'tired', text: '(Amari again. A prayer nobody could sell, and nobody could rewrite.)' },
    ]),
    interlude: {
      title: 'Vigil · after the library',
      lines: [
        'The librarian wanted to give my god a gentle ending. I almost let her.',
        'Then I saw her shelves: rows and rows of happy, empty books.',
        'There is a prayer that will not be rewritten. Let no one ever grieve as I grieve.',
        'I think my god heard it. I think he said yes. I think that is why he is gone.',
      ],
    },
  },

  ilse: {
    pre: L('ilse', 'ilse.s3.pre', [
      { who: 'ilse', expr: 'surprised', text: 'Blank books. Shelves of them. It looks exactly like my atlas.' },
      { who: 'seraphine', expr: 'gentle', text: 'Then we are colleagues. You draw what is lost. I soften it, so it hurts less to lose.', bossIntro: true, music: 'boss3' },
      { who: 'ilse', expr: 'annoyed', text: 'Soften it? These pages are empty.' },
      { who: 'seraphine', expr: 'smile', text: 'Empty pages never made anyone cry.' },
      { who: 'ilse', expr: 'annoyed', text: 'A blank page isn’t a happy ending. It’s no ending. It’s a coward’s ending.' },
      { who: 'seraphine', expr: 'stern', text: 'And your maps, which go blank by morning? What are those?' },
      { who: 'ilse', expr: 'grin', text: 'Those are drafts. I’m coming back with more ink.' },
    ]),
    post: L('ilse', 'ilse.s3.post', [
      { who: 'seraphine', expr: 'sad', text: 'Why fight so hard for a sadness you can’t keep?' },
      { who: 'ilse', expr: 'neutral', text: 'Give me one of those blank books.' },
      { who: 'seraphine', expr: 'shocked', text: '…What are you doing?' },
      { who: 'ilse', expr: 'smug', text: 'Mapping your library. Every shelf. Every book you blanked, and what it used to be called, if I can guess.' },
      { who: 'ilse', expr: 'sad', text: 'It’ll fade. I know. But for a few hours somebody will know there were stories here.' },
      { who: 'seraphine', expr: 'gentle', text: '…May I keep it? Until it fades?' },
      { who: 'ilse', expr: 'grin', text: '(Sold. To the librarian, for nothing. One must imagine the cartographer generous.)' },
    ]),
    interlude: {
      title: 'Vigil · after the library',
      lines: [
        'She said empty pages never made anyone cry.',
        'I filled one of her empty books with a map of her library, shelf by shelf.',
        'She asked to keep it until it fades. It will fade. She knows. She asked anyway.',
        'I think that is the bravest thing I have seen anyone do down here.',
      ],
    },
  },

  tessel: {
    pre: L('tessel', 'tessel.s3.pre', [
      { who: 'tessel', expr: 'curious', text: 'My right hand is trembling. It remembers a war. The war is in one of these books.' },
      { who: 'seraphine', expr: 'gentle', text: 'Not any more, little doll. I rewrote it. In my version, the soldier never went.', bossIntro: true, music: 'boss3' },
      { who: 'seraphine', expr: 'smile', text: 'I could rewrite you too. The bride gets married. The soldier stays home. Every part of you, happy.' },
      { who: 'tessel', expr: 'blank', text: 'Then my right hand would be remembering something that did not happen.' },
      { who: 'seraphine', expr: 'pleading', text: 'It would stop trembling.' },
      { who: 'tessel', expr: 'sad', text: 'It trembles because it was there. If you take that away, it is not his hand any more. It is a costume.' },
      { who: 'tessel', expr: 'neutral', text: 'I would rather be a sad book than a blank one.' },
    ]),
    post: L('tessel', 'tessel.s3.post', [
      { who: 'seraphine', expr: 'sad', text: 'May I read you? Only read. I promise not to edit.' },
      { who: 'tessel', expr: 'neutral', text: 'You may.' },
      { who: 'seraphine', expr: 'shocked', text: '…You are a very sad book.' },
      { who: 'tessel', expr: 'smile', text: 'Yes. But I am a book.' },
      { who: 'seraphine', expr: 'gentle', text: 'Your soldier had a horse. He thought about it at the very end. Did you know that?' },
      { who: 'tessel', expr: 'surprised', text: '…No. Thank you. Now someone does.' },
      { who: 'tessel', expr: 'smile', text: '(My right hand is still trembling. But I think, now, it is a little less alone.)' },
    ]),
    interlude: {
      title: 'Vigil · after the library',
      lines: [
        'The librarian offered to make every part of me happy.',
        'I said no. A hand that never trembled would not be his hand.',
        'She read me instead, and told me about the soldier’s horse.',
        'I carry the horse now too. I am getting heavier. I think that is called growing.',
      ],
    },
  },

  wren: {
    pre: L('wren', 'wren.s3.pre', [
      { who: 'wren', expr: 'neutral', text: 'A library of funerals where nobody died. Every ending says “and then they simply went away, smiling.”' },
      { who: 'seraphine', expr: 'gentle', text: 'Isn’t it lovely? No one has to watch anyone go.', bossIntro: true, music: 'boss3' },
      { who: 'wren', expr: 'stern', text: 'I watched ten thousand people go. Not one of them went smiling. Most of them went brave. That’s better.' },
      { who: 'seraphine', expr: 'pleading', text: 'But the grief, Sister. The ones left behind.' },
      { who: 'wren', expr: 'sad', text: 'Grief told honestly is the last kindness you can do for the dead. You’ve taken it from all of them.' },
      { who: 'seraphine', expr: 'stern', text: 'I took the pain.' },
      { who: 'wren', expr: 'wry', text: 'You took the names. Let’s talk about it, loudly, in your library.' },
    ]),
    post: L('wren', 'wren.s3.post', [
      { who: 'seraphine', expr: 'sad', text: 'You fight like someone who has buried a great many friends.' },
      { who: 'wren', expr: 'tired', text: 'Rowed. Not buried. It’s a different kind of goodbye.' },
      { who: 'seraphine', expr: 'pleading', text: 'Sister… would you read the last rites over the books I emptied? I never gave them any.' },
      { who: 'wren', expr: 'soft', text: 'I will. Every shelf. It might take a while.' },
      { who: 'seraphine', expr: 'gentle', text: 'There is a nun in white who passed through here, going up. She told me I was doing the kindest work in the world.' },
      { who: 'wren', expr: 'stern', text: '(Mother Cinder. You used to tell me that the kindest work is the hardest.)' },
      { who: 'wren', expr: 'sad', text: '(When did you start believing it was the easiest?)' },
    ]),
    interlude: {
      title: 'Vigil · after the library',
      lines: [
        'I read the last rites over four hundred blank books.',
        'I did not know their names, so I said: you were a story, and someone loved you enough to cry.',
        'Mother Cinder passed through here and called forgetting a kindness.',
        'She taught me everything I know. I am going to have to tell her she is wrong.',
      ],
    },
  },
};

// ─────────────────────────────── script ───────────────────────────────

export function* stage3(g: Game): Task {
  registerStage3Bursts(g);
  g.showStageCard(STAGE3_INFO);
  const S3 = 3;

  if (g.startAt === 'start') {
    yield* wait(200);
    remnant(g, S3, 0, true, 90);
    yield* waveMoths(g, 12, true);
    yield* wait(40);
    yield* waveMoths(g, 12, false);
    yield* wait(40);
    g.enemy(BOOK, 100, -20, bookRecite(110));
    g.enemy(BOOK, FIELD_W - 100, -20, bookRecite(130));
    remnant(g, S3, 1, false, 70);
    yield* wait(240);
    yield* waveQuills(g, 8);
    yield* wait(60);
    remnant(g, S3, 2, true, 120);
    g.stageSched.add(waveMoths(g, 10, false));
    g.enemy(BOOK, FIELD_W / 2, -20, bookRecite(100));
    yield* wait(260);
    yield* clearField(g);
    yield* wait(60);
  }

  if (g.startAt !== 'boss') {
    yield* g.runBoss(INKMOTH_SWARM);
    yield* wait(80);
    remnant(g, S3, 3, false, 90);
    yield* waveQuills(g, 10);
    for (let i = 0; i < 3; i++) {
      g.enemy(BOOK, [80, FIELD_W - 80, FIELD_W / 2][i], -20, bookRecite(100 + i * 20));
      yield* wait(120);
    }
    remnant(g, S3, 4, true, 60);
    yield* waveMoths(g, 14, true);
    yield* wait(30);
    remnant(g, S3, 5, false, 110);
    yield* waveMoths(g, 14, false);
    yield* clearField(g);
    yield* wait(120);
  }

  const story = STAGE3_STORY[g.char.id];
  yield* g.runBoss(SERAPHINE, story.pre, story.post);
  yield* g.stageClear(3, true);
}
