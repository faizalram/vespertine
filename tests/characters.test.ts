import { describe, expect, it } from 'vitest';
import { practiceScript } from '../src/content/practice';
import { STAGE1_STORY, stage1 } from '../src/content/stage1';
import { EXPRESSIONS } from '../src/ui/portraits';
import { BT } from '../src/game/bulletTypes';
import { CHARACTERS, REWIND_FRAMES } from '../src/game/characters';
import { FIELD_W } from '../src/game/constants';
import { CHAR_IDS, IT, type CharId } from '../src/game/defs';
import { EMPTY_INPUT, Game, type InputFrame } from '../src/game/game';

const idle = (g: Game, frames: number, inp: Partial<InputFrame> = {}) => {
  for (let f = 0; f < frames; f++) g.tick({ ...EMPTY_INPUT, ...inp });
};

/** Game with the practice boss already on screen and vulnerable. */
function withBoss(char: CharId): Game {
  const g = new Game(practiceScript(), { seed: 1, char });
  g.player.invuln = 99999;
  while (!g.boss.active) g.tick(EMPTY_INPUT);
  g.cancelAllBullets();
  return g;
}

/** Average boss damage per second over 10 s of point-blank fire. */
function dps(char: CharId, focus: boolean, dist = 120, power = 4): number {
  const g = withBoss(char);
  g.player.power = power;
  g.player.x = g.boss.x;
  g.player.y = g.boss.y + dist;
  const before = g.boss.hp;
  let dealt = 0;
  for (let f = 0; f < 600; f++) {
    g.bullets.clear();
    const hp = g.boss.hp;
    g.tick({ ...EMPTY_INPUT, shoot: true, focus });
    if (g.boss.hp < hp) dealt += hp - g.boss.hp;
    if (g.boss.hp <= 50) g.boss.hp = before; // keep the phase alive
    g.player.x = g.boss.x;
  }
  return dealt / 10;
}

describe('character roster', () => {
  it('stats follow the spec table', () => {
    expect(CHARACTERS.ilse.speed).toBe(5.0);
    expect(CHARACTERS.tessel.focusSpeed).toBe(1.8);
    expect(CHARACTERS.wren.grazeR).toBe(24);
    expect(CHARACTERS.wren.deathbombFrames).toBe(12);
    expect(new Game(stage1, { char: 'ilse' }).player.bombs).toBe(2);
    expect(new Game(stage1, { char: 'tessel' }).player.bombs).toBe(3);
  });

  it('every heroine deals meaningful damage; Ilse focused is the strongest, Wren is strongest up close', () => {
    const table: Record<string, [number, number]> = {};
    for (const id of CHAR_IDS) table[id] = [dps(id, false, id === 'wren' ? 60 : 120), dps(id, true)];
    console.log('DPS at power 4 (unfocused, focused):', JSON.stringify(Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v.map(Math.round)]))));
    for (const id of CHAR_IDS) {
      expect(table[id][0]).toBeGreaterThan(80);
      expect(table[id][1]).toBeGreaterThan(80);
    }
    expect(table.ilse[1]).toBeGreaterThan(table.sayo[1]);
    expect(table.ilse[1]).toBeGreaterThan(table.tessel[1]);
    // Wren's oar at point-blank range is the hardest-hitting unfocused shot.
    for (const id of ['sayo', 'ilse', 'tessel']) expect(table.wren[0]).toBeGreaterThan(table[id][0]);
  });
});

describe('Sayo', () => {
  it('Vigil slows bullets inside the ward', () => {
    const g = withBoss('sayo');
    g.tick({ ...EMPTY_INPUT, skill: true });
    expect(g.cs.vigil.active).toBe(true);
    g.bullets.spawn({ x: g.player.x + 20, y: g.player.y, speed: 2, angle: 0, type: BT.orb, color: 0 });
    const x0 = g.bullets.x[0];
    g.tick(EMPTY_INPUT);
    expect(g.bullets.x[0] - x0).toBeCloseTo(1, 1);
  });
});

describe('Ilse', () => {
  it('Survey Ray charts the boss for +25% damage', () => {
    const g = withBoss('ilse');
    g.player.x = g.boss.x;
    idle(g, 30, { shoot: true, focus: true });
    expect(g.boss.charted).toBeGreaterThan(0);
  });

  it('pins form lines that damage what crosses them; max three pins', () => {
    const g = withBoss('ilse');
    const b = g.boss;
    g.player.x = b.x - 60;
    g.player.y = b.y;
    g.tick({ ...EMPTY_INPUT, skill: true });
    idle(g, 91);
    g.player.x = b.x + 60;
    g.player.y = b.y;
    g.tick({ ...EMPTY_INPUT, skill: true });
    expect(g.cs.pins.length).toBe(2);
    g.player.x = FIELD_W / 2;
    g.player.y = 400;
    const hp = b.hp;
    idle(g, 60);
    expect(b.hp).toBeLessThan(hp); // the boss sits on the line between the pins
    for (let k = 0; k < 3; k++) {
      idle(g, 91);
      g.tick({ ...EMPTY_INPUT, skill: true });
    }
    expect(g.cs.pins.length).toBe(3);
  });

  it('Blank Margins erases the screen', () => {
    const g = withBoss('ilse');
    g.ring(100, 100, 50, 1, 0, BT.orb, 0);
    g.tick({ ...EMPTY_INPUT, bomb: true });
    expect(g.bullets.n).toBe(0);
    g.ring(100, 100, 10, 1, 0, BT.orb, 0);
    g.tick(EMPTY_INPUT);
    expect(g.bullets.n).toBe(0); // stays blank for a while
  });

  it('ink lines pierce: one shot can hit several enemies', () => {
    const g = new Game(practiceScript(), { seed: 1, char: 'ilse' });
    const def = { sprite: 0, hp: 100, r: 12, drops: [] as number[] };
    const a = g.enemy(def, g.player.x, g.player.y - 60, function* () { for (;;) yield; });
    const b = g.enemy(def, g.player.x, g.player.y - 120, function* () { for (;;) yield; });
    g.shots.spawn(g.player.x, g.player.y - 20, 0, -16, 5, 0, 0, 1);
    idle(g, 12);
    expect(a.hp).toBeLessThan(100);
    expect(b.hp).toBeLessThan(100);
  });
});

describe('Tessel', () => {
  it('guard dolls absorb small bullets, then crack', () => {
    const g = withBoss('tessel');
    idle(g, 20, { focus: true });
    const d = g.cs.dolls[0];
    for (let k = 0; k < 6; k++) {
      g.bullets.spawn({ x: d.x, y: d.y, speed: 0, angle: 0, type: BT.rice, color: 0 });
      g.bullets.age[g.bullets.n - 1] = 10;
      g.tick({ ...EMPTY_INPUT, focus: true });
    }
    expect(d.crack).toBeGreaterThan(0);
  });

  it('Rewind returns her to where she was 1.5 s ago once the Gear meter is full', () => {
    const g = withBoss('tessel');
    g.cs.meter = 1;
    const start = { x: g.player.x, y: g.player.y };
    for (let f = 0; f < REWIND_FRAMES; f++) g.tick({ ...EMPTY_INPUT, mx: f < 40 ? -1 : 0, my: -1 });
    expect(Math.hypot(g.player.x - start.x, g.player.y - start.y)).toBeGreaterThan(100);
    g.tick({ ...EMPTY_INPUT, skill: true });
    expect(Math.hypot(g.player.x - start.x, g.player.y - start.y)).toBeLessThan(8);
    expect(g.cs.meter).toBe(0);
  });

  it('dealing damage fills the Gear meter', () => {
    const g = withBoss('tessel');
    g.cs.meter = 0;
    g.player.x = g.boss.x;
    idle(g, 300, { shoot: true });
    expect(g.cs.meter).toBeGreaterThan(0.2);
  });
});

describe('Wren', () => {
  it('grazing fills the Toll; the bell turns nearby bullets into souls and starts Requiem', () => {
    const g = withBoss('wren');
    g.cs.meter = 0;
    const p = g.player;
    for (let k = 0; k < 50; k++) {
      g.bullets.spawn({ x: p.x + 18, y: p.y, speed: 0, angle: 0, type: BT.small, color: 0 });
      g.bullets.age[g.bullets.n - 1] = 10;
      g.tick(EMPTY_INPUT);
      g.bullets.clear();
    }
    expect(g.cs.meter).toBe(1);
    g.ring(p.x, p.y - 50, 20, 0, 0, BT.orb, 0);
    g.tick({ ...EMPTY_INPUT, skill: true });
    expect(g.bullets.n).toBe(0);
    expect(g.cs.requiem).toBeGreaterThan(0);
    expect(Array.from(g.items.type.slice(0, g.items.n))).toContain(IT.soul);
  });

  it('the oar hits harder up close than far away', () => {
    const near = withBoss('wren');
    near.player.x = near.boss.x;
    near.player.y = near.boss.y + 50;
    const far = withBoss('wren');
    far.player.x = far.boss.x;
    far.player.y = far.boss.y + 150;
    const h0 = near.boss.hp;
    const h1 = far.boss.hp;
    idle(near, 120, { shoot: true });
    idle(far, 120, { shoot: true });
    expect(h0 - near.boss.hp).toBeGreaterThan((h1 - far.boss.hp) * 1.5);
  });
});

describe('every heroine clears Stage 1', () => {
  for (const id of CHAR_IDS) {
    it(id, () => {
      const g = new Game(stage1, { seed: 5, char: id });
      let f = 0;
      while (!g.cleared && f < 60 * 60 * 8) {
        g.player.invuln = 5;
        const collecting = !g.boss.present && g.frame % 480 < 70;
        g.tick({
          ...EMPTY_INPUT,
          mx: Math.sin(g.frame / 50),
          my: collecting ? -1 : g.player.y < 360 ? 1 : 0,
          shoot: true,
          focus: g.boss.present,
          skill: g.frame % 240 === 0,
          advance: g.frame % 20 === 0,
        });
        f++;
      }
      expect(g.cleared).toBe(true);
      console.log(`${id}: stage 1 in ${(f / 60).toFixed(0)}s, captures ${g.captures}/${g.elegiesSeen}`);
    });
  }
});

describe('Stage 1 story', () => {
  it('every heroine has her own dialogue, using only expressions her portrait can draw', () => {
    for (const id of CHAR_IDS) {
      const st = STAGE1_STORY[id];
      expect(st.pre.left).toBe(id);
      expect(st.interlude.lines.length).toBeGreaterThanOrEqual(4);
      for (const d of [st.pre, st.post]) {
        expect(d.lines.some((l) => l.bossIntro)).toBe(d === st.pre);
        for (const l of d.lines) expect(EXPRESSIONS[l.who], `${d.id}: ${l.who}/${l.expr}`).toContain(l.expr);
      }
    }
  });
});
