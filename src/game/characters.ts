import { BULLET_TYPES } from './bulletTypes';
import { FIELD_H, FIELD_W, TAU } from './constants';
import { IT, type CharId } from './defs';
import type { Game } from './game';
import { C } from './palette';
import { SK } from './pools';
import { S } from './sprites';

/**
 * The four heroines (spec §3). Each definition owns its shot, skill, Litany
 * and passives; the simulation calls into these hooks.
 */
export interface CharacterDef {
  id: CharId;
  name: string;
  title: string;
  quote: string;
  stance: string;
  playstyle: string;
  stars: number;
  sprite: number;
  optionSprite: number;
  speed: number;
  focusSpeed: number;
  hitR: number;
  grazeR: number;
  bombs: number;
  deathbombFrames: number;
  bombInvuln: number;
  skillName: string;
  bombName: string;
  meterLabel: string;
  /** Position the options (emitters, dolls, lanterns) around the player. */
  layoutOptions(g: Game): void;
  fire(g: Game, t: number): void;
  /** Per-tick passive logic (meters, pins, dolls, history). */
  update(g: Game): void;
  /** Returns true when the skill fired. */
  trySkill(g: Game): boolean;
  bombStart(g: Game): void;
  /** Called every tick while the Litany is active; must clear g.bomb.active when done. */
  bombUpdate(g: Game): void;
  /** HUD meter, 0..1. */
  meter(g: Game): number;
  damageMult(g: Game): number;
  onGraze?(g: Game): void;
  onDamage?(g: Game, dmg: number): void;
  /** Bullets inside this circle move at `f` speed. */
  slowZone?(g: Game): readonly [number, number, number, number] | null;
  /** Called before player collision: lets options eat bullets. */
  absorbBullets?(g: Game): void;
}

export interface Doll {
  x: number;
  y: number;
  absorbed: number;
  crack: number;
}

export interface BombObj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

/** Mutable per-run character state. One shape for all heroines keeps things simple. */
export class CharState {
  /** Generic 0..1 meter: Vigil (Sayo), Gear (Tessel), Toll (Wren). */
  meter = 1;
  // Sayo
  readonly vigil = { active: false, t: 0, x: 0, y: 0 };
  // Ilse
  readonly pins: Array<{ x: number; y: number; age: number }> = [];
  pinCooldown = 0;
  // Tessel
  readonly dolls: Doll[] = [
    { x: 0, y: 0, absorbed: 0, crack: 0 },
    { x: 0, y: 0, absorbed: 0, crack: 0 },
  ];
  readonly history = new Float32Array(REWIND_FRAMES * 2);
  histIdx = 0;
  histCount = 0;
  readonly afterimage = { x: 0, y: 0, t: 0 };
  // Wren
  requiem = 0;
  readonly bell = { x: 0, y: 0, t: 0 };
  // Litanies with moving parts
  readonly bombObjs: BombObj[] = [];
}

export const REWIND_FRAMES = 90;
const VIGIL_FRAMES = 300;
const VIGIL_RADIUS = 56;
const PIN_LIFE = 900;
const PIN_COOLDOWN = 90;
const BELL_RADIUS = 96;
const REQUIEM_FRAMES = 300;

// ───────────────────────────── shared helpers ─────────────────────────────

function powerScale(g: Game): number {
  return 0.85 + (g.player.power - 1) * 0.05;
}

/** Ease emitters between wide and focused layouts (index = number of options). */
function blendLayout(
  g: Game,
  wide: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  focus: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  n: number,
): void {
  const p = g.player;
  p.emitterCount = n;
  const w = wide[n];
  const f = focus[n];
  for (let i = 0; i < n; i++) {
    const b = p.focusBlend;
    const bob = Math.sin(g.frame * 0.08 + i * 1.7) * 1.5;
    follow(p.emitters[i], p.x + w[i][0] + (f[i][0] - w[i][0]) * b, p.y + w[i][1] + (f[i][1] - w[i][1]) * b + bob, 0.38 - i * 0.05);
  }
}

/** Options trail behind the player on a soft spring instead of being bolted on. */
function follow(e: [number, number], tx: number, ty: number, k: number): void {
  e[0] += (tx - e[0]) * k;
  e[1] += (ty - e[1]) * k;
}

function optionCount(g: Game): number {
  return Math.max(1, Math.min(4, Math.floor(g.player.power)));
}

const STD_WIDE: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [], [[0, -26]], [[-24, 4], [24, 4]], [[-26, 6], [26, 6], [0, -26]], [[-26, 6], [26, 6], [-15, -14], [15, -14]],
];
const STD_FOCUS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [], [[0, -24]], [[-10, -14], [10, -14]], [[-12, -12], [12, -12], [0, -24]], [[-12, -12], [12, -12], [-5, -22], [5, -22]],
];

/** Distance from point to segment. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Pin segments as [ax, ay, bx, by] tuples (2 pins = a line, 3 pins = a triangle). */
export function pinSegments(g: Game): Array<[number, number, number, number]> {
  const pins = g.cs.pins;
  const segs: Array<[number, number, number, number]> = [];
  for (let i = 0; i + 1 < pins.length; i++) segs.push([pins[i].x, pins[i].y, pins[i + 1].x, pins[i + 1].y]);
  if (pins.length === 3) segs.push([pins[2].x, pins[2].y, pins[0].x, pins[0].y]);
  return segs;
}

// ───────────────────────────── Sayo Kagari ─────────────────────────────

export const SAYO: CharacterDef = {
  id: 'sayo',
  name: 'Sayo Kagari',
  title: 'Keeper of the Last Lantern',
  quote: '“The god’s gone. The dark isn’t. So I keep the light.”',
  stance: 'Duty and ritual. If no one is listening, is a prayer still a prayer?',
  playstyle: 'Steady and forgiving. Homing wisps, a beam that strengthens while you hold still.',
  stars: 1,
  sprite: S.sayo,
  optionSprite: S.emitter,
  speed: 4.0,
  focusSpeed: 2.0,
  hitR: 2.5,
  grazeR: 16,
  bombs: 3,
  deathbombFrames: 8,
  bombInvuln: 270,
  skillName: 'Vigil',
  bombName: 'Litany of the Unextinguished',
  meterLabel: 'Vigil',

  layoutOptions(g) {
    blendLayout(g, STD_WIDE, STD_FOCUS, optionCount(g));
  },

  fire(g, t) {
    const p = g.player;
    const ps = powerScale(g);
    if (p.focus) {
      // Wick Lance; Patient Flame adds up to +20% while standing still.
      const pat = 1 + (Math.min(p.stillFrames, 120) / 120) * 0.2;
      if (t % 2 === 0) {
        g.shots.spawn(p.x - 4, p.y - 12, 0, -14, 2.2 * pat * ps, S.lance);
        g.shots.spawn(p.x + 4, p.y - 12, 0, -14, 2.2 * pat * ps, S.lance);
      }
      if (t % 4 === 0) {
        for (let i = 0; i < p.emitterCount; i++) g.shots.spawn(p.emitters[i][0], p.emitters[i][1] - 6, 0, -13, 0.8 * pat, S.lance);
      }
    } else {
      if (t % 4 === 0) {
        g.shots.spawn(p.x - 6, p.y - 10, 0, -12, 2.0 * ps, S.lance);
        g.shots.spawn(p.x + 6, p.y - 10, 0, -12, 2.0 * ps, S.lance);
      }
      if (t % 8 === 0) {
        for (let i = 0; i < p.emitterCount; i++) {
          const [ex, ey] = p.emitters[i];
          const side = Math.sign(ex - p.x);
          const a = -Math.PI / 2 + side * (ey > p.y - 4 ? 0.45 : 0.18);
          g.shots.spawn(ex, ey, Math.cos(a) * 7, Math.sin(a) * 7, 2.6, S.wisp, SK.homing);
        }
      }
    }
  },

  update(g) {
    const cs = g.cs;
    const v = cs.vigil;
    if (v.active) {
      if (++v.t >= VIGIL_FRAMES) v.active = false;
    } else if (cs.meter < 1) cs.meter = Math.min(1, cs.meter + 1 / 1200);
  },

  trySkill(g) {
    const cs = g.cs;
    if (cs.meter < 1 || cs.vigil.active) return false;
    cs.meter = 0;
    Object.assign(cs.vigil, { active: true, t: 0, x: g.player.x, y: g.player.y });
    return true;
  },

  slowZone(g) {
    const v = g.cs.vigil;
    return v.active ? [v.x, v.y, VIGIL_RADIUS, 0.5] : null;
  },

  bombStart(g) {
    g.flash = 0.6;
    g.shake = 6;
  },

  bombUpdate(g) {
    const b = g.bomb;
    const p = g.player;
    const k = Math.min(1, b.t / 100);
    b.r = (1 - (1 - k) * (1 - k)) * 380;
    b.x = p.x;
    b.y = p.y;
    g.cancelBulletsInRadius(p.x, p.y, b.r);
    if (b.t < 140) g.damageInRadius(p.x, p.y, b.r, 6, 3.5);
    if (b.t >= 160) b.active = false;
  },

  meter(g) {
    const v = g.cs.vigil;
    return v.active ? 1 - v.t / VIGIL_FRAMES : g.cs.meter;
  },

  damageMult() {
    return 1;
  },
};

// ───────────────────────────── Ilse Marrow ─────────────────────────────

export const ILSE: CharacterDef = {
  id: 'ilse',
  name: 'Ilse Marrow',
  title: 'Cartographer of the Vanishing',
  quote: '“Every map I’ve ever drawn has gone blank. So I draw faster.”',
  stance: 'Absurdist revolt. If everything I make will be erased, why make anything?',
  playstyle: 'Glass cannon. Piercing ink, a ray that marks targets, pins that draw kill zones.',
  stars: 3,
  sprite: S.ilse,
  optionSprite: S.inkOrb,
  speed: 5.0,
  focusSpeed: 2.2,
  hitR: 2.0,
  grazeR: 16,
  bombs: 2,
  deathbombFrames: 6,
  bombInvuln: 150,
  skillName: 'Survey Pins',
  bombName: 'Litany of Blank Margins',
  meterLabel: 'Pins',

  layoutOptions(g) {
    blendLayout(g, STD_WIDE, STD_FOCUS, optionCount(g));
  },

  fire(g, t) {
    const p = g.player;
    const ps = powerScale(g);
    if (p.focus) {
      // Survey Ray: thin and fast; anything it touches becomes Charted.
      if (t % 2 === 0) {
        g.shots.spawn(p.x - 3, p.y - 14, 0, -18, 2.0 * ps, S.ray, SK.chart);
        g.shots.spawn(p.x + 3, p.y - 14, 0, -18, 2.0 * ps, S.ray, SK.chart);
      }
      if (t % 4 === 0) {
        for (let i = 0; i < p.emitterCount; i++) g.shots.spawn(p.emitters[i][0], p.emitters[i][1] - 6, 0, -17, 1.0, S.ray, SK.chart);
      }
    } else {
      // Ink Meridians: three piercing lines plus one per option.
      if (t % 3 === 0) {
        g.shots.spawn(p.x, p.y - 14, 0, -16, 1.6 * ps, S.ink, SK.plain, 1);
        g.shots.spawn(p.x - 10, p.y - 8, -0.9, -15.8, 1.6 * ps, S.ink, SK.plain, 1);
        g.shots.spawn(p.x + 10, p.y - 8, 0.9, -15.8, 1.6 * ps, S.ink, SK.plain, 1);
      }
      if (t % 6 === 0) {
        for (let i = 0; i < p.emitterCount; i++) {
          const [ex, ey] = p.emitters[i];
          g.shots.spawn(ex, ey - 6, Math.sign(ex - p.x) * 1.4, -15.6, 1.6, S.ink, SK.plain, 1);
        }
      }
    }
  },

  update(g) {
    const cs = g.cs;
    if (cs.pinCooldown > 0) cs.pinCooldown--;
    for (let i = 0; i < cs.pins.length; i++) {
      if (++cs.pins[i].age > PIN_LIFE) {
        cs.pins.splice(i, 1);
        i--;
      }
    }
    if (cs.pins.length < 2) return;
    // Ink lines between pins cut anything that crosses them.
    for (const [ax, ay, bx, by] of pinSegments(g)) {
      for (const e of g.enemies) {
        if (e.alive && !e.intangible && segDist(e.x, e.y, ax, ay, bx, by) < e.r + 4) g.damageEnemy(e, 0.5);
      }
      const b = g.boss;
      if (b.present && b.vulnerable && segDist(b.x, b.y, ax, ay, bx, by) < b.hitR) g.damageBoss(0.55);
    }
  },

  trySkill(g) {
    const cs = g.cs;
    if (cs.pinCooldown > 0) return false;
    cs.pins.push({ x: g.player.x, y: g.player.y, age: 0 });
    if (cs.pins.length > 3) cs.pins.shift();
    cs.pinCooldown = PIN_COOLDOWN;
    return true;
  },

  bombStart(g) {
    g.flash = 1;
    g.shake = 4;
    g.cancelAllBullets();
  },

  bombUpdate(g) {
    const b = g.bomb;
    // The page stays blank for a second: nothing new can be written on it.
    if (b.t < 70) {
      g.cancelAllBullets();
      g.damageInRadius(FIELD_W / 2, FIELD_H / 2, 9999, 8, 5);
      if (b.t % 4 === 0) g.flash = Math.max(g.flash, 0.35);
    }
    if (b.t >= 90) b.active = false;
  },

  meter(g) {
    return 1 - g.cs.pinCooldown / PIN_COOLDOWN;
  },

  damageMult() {
    return 1;
  },
};

// ───────────────────────────── Tessel ─────────────────────────────

const DOLL_WIDE: ReadonlyArray<readonly [number, number]> = [[-30, 2], [30, 2]];
const DOLL_GUARD: ReadonlyArray<readonly [number, number]> = [[-11, -24], [11, -24]];
const DOLL_ABSORB = 6;
const DOLL_CRACK = 240;

export const TESSEL: CharacterDef = {
  id: 'tessel',
  name: 'Tessel',
  title: 'The Patchwork Doll',
  quote: '“My left hand remembers a wedding. My right hand remembers a war. I remember neither.”',
  stance: 'Identity. If I am made of their memories, am I someone, or am I a grave?',
  playstyle: 'Tactician. Dolls that fan out or stand guard and eat bullets; rewind 1.5 seconds.',
  stars: 2,
  sprite: S.tessel,
  optionSprite: S.doll,
  speed: 4.5,
  focusSpeed: 1.8,
  hitR: 2.5,
  grazeR: 16,
  bombs: 3,
  deathbombFrames: 8,
  bombInvuln: 210,
  skillName: 'Rewind',
  bombName: 'Litany of Spare Parts',
  meterLabel: 'Gear',

  layoutOptions(g) {
    const p = g.player;
    p.emitterCount = 2;
    for (let i = 0; i < 2; i++) {
      const b = p.focusBlend;
      const w = DOLL_WIDE[i];
      const f = DOLL_GUARD[i];
      const bob = Math.sin(g.frame * 0.07 + i * 3) * 1.2;
      follow(p.emitters[i], p.x + w[0] + (f[0] - w[0]) * b, p.y + w[1] + (f[1] - w[1]) * b + bob, 0.32);
      const d = g.cs.dolls[i];
      d.x = p.emitters[i][0];
      d.y = p.emitters[i][1];
    }
  },

  fire(g, t) {
    const p = g.player;
    const ps = powerScale(g);
    const needles = Math.min(3, Math.floor(p.power));
    if (p.focus) {
      if (t % 3 === 0) {
        g.shots.spawn(p.x - 4, p.y - 12, 0, -14, 2.0 * ps, S.needle);
        g.shots.spawn(p.x + 4, p.y - 12, 0, -14, 2.0 * ps, S.needle);
      }
      if (t % 4 === 0) {
        for (const d of g.cs.dolls) {
          if (d.crack > 0) continue;
          for (let k = 0; k < needles; k++) g.shots.spawn(d.x + (k - (needles - 1) / 2) * 4, d.y - 6, 0, -14, 1.2, S.needle);
        }
      }
    } else {
      if (t % 4 === 0) {
        g.shots.spawn(p.x - 5, p.y - 10, 0, -13, 2.0 * ps, S.needle);
        g.shots.spawn(p.x + 5, p.y - 10, 0, -13, 2.0 * ps, S.needle);
      }
      if (t % 5 === 0) {
        g.cs.dolls.forEach((d, i) => {
          if (d.crack > 0) return;
          const side = i === 0 ? -1 : 1;
          for (let k = 0; k < needles; k++) {
            // First needle angles slightly inward (converging ahead); extra needles fan outward.
            const a = -Math.PI / 2 + side * (k === 0 ? -0.12 : 0.04 + k * 0.12);
            g.shots.spawn(d.x, d.y, Math.cos(a) * 13, Math.sin(a) * 13, 1.6, S.needle);
          }
        });
      }
    }
  },

  update(g) {
    const cs = g.cs;
    const p = g.player;
    cs.history[cs.histIdx * 2] = p.x;
    cs.history[cs.histIdx * 2 + 1] = p.y;
    cs.histIdx = (cs.histIdx + 1) % REWIND_FRAMES;
    cs.histCount = Math.min(REWIND_FRAMES, cs.histCount + 1);
    for (const d of cs.dolls) {
      if (d.crack > 0 && --d.crack === 0) d.absorbed = 0;
    }
    if (cs.afterimage.t > 0) cs.afterimage.t--;
  },

  absorbBullets(g) {
    const p = g.player;
    if (p.focusBlend < 0.8) return;
    const bl = g.bullets;
    for (const d of g.cs.dolls) {
      if (d.crack > 0) continue;
      for (let i = 0; i < bl.n; i++) {
        const t = BULLET_TYPES[bl.type[i]];
        if (t.hitR > 5) continue; // big bullets pass through
        const r = 9 + t.hitR;
        const dx = bl.x[i] - d.x;
        const dy = bl.y[i] - d.y;
        if (dx * dx + dy * dy < r * r) {
          g.fx.spawn(bl.x[i], bl.y[i], 0, -0.5, 12, S.spark, bl.color[i], 0.6, 0.1, 0.8);
          bl.remove(i);
          i--;
          if (++d.absorbed >= DOLL_ABSORB) {
            d.crack = DOLL_CRACK;
            g.events.push('dollCrack');
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * TAU;
              g.fx.spawn(d.x, d.y, Math.cos(a) * 2, Math.sin(a) * 2, 20, S.spark, C.ash, 0.5, 0.1);
            }
            break;
          }
        }
      }
    }
  },

  trySkill(g) {
    const cs = g.cs;
    if (cs.meter < 1 || cs.histCount < REWIND_FRAMES) return false;
    const p = g.player;
    // The oldest stored position is exactly REWIND_FRAMES ago.
    const ox = cs.history[cs.histIdx * 2];
    const oy = cs.history[cs.histIdx * 2 + 1];
    Object.assign(cs.afterimage, { x: p.x, y: p.y, t: 40 });
    p.x = ox;
    p.y = oy;
    p.invuln = Math.max(p.invuln, 20);
    cs.meter = 0;
    cs.histCount = 0;
    return true;
  },

  onDamage(g, dmg) {
    g.cs.meter = Math.min(1, g.cs.meter + dmg / 800);
  },

  bombStart(g) {
    const p = g.player;
    const objs = g.cs.bombObjs;
    objs.length = 0;
    const n = 24;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      const s = 3.2 + (k % 3) * 0.9;
      objs.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, alive: true });
    }
    g.shake = 4;
  },

  bombUpdate(g) {
    const b = g.bomb;
    const objs = g.cs.bombObjs;
    for (const o of objs) {
      if (!o.alive) continue;
      o.x += o.vx;
      o.y += o.vy;
      o.vx *= 0.975;
      o.vy *= 0.975;
      g.cancelBulletsInRadius(o.x, o.y, 30);
      g.damageInRadius(o.x, o.y, 30, 2.5, 0.6);
      if (b.t === 70 + (objs.indexOf(o) % 4) * 6) {
        // Each little doll pops in a ring of light.
        o.alive = false;
        g.cancelBulletsInRadius(o.x, o.y, 70);
        g.damageInRadius(o.x, o.y, 70, 20, 14);
        g.fx.spawn(o.x, o.y, 0, 0, 24, S.ring, C.rose, 0.1, 1.1, 0.8);
        g.shake = Math.max(g.shake, 3);
      }
    }
    if (b.t >= 110) {
      b.active = false;
      objs.length = 0;
    }
  },

  meter(g) {
    return g.cs.meter;
  },

  damageMult() {
    return 1;
  },
};

// ───────────────────────────── Sister Wren ─────────────────────────────

const WREN_WIDE: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [], [[0, 18]], [[-18, 12], [18, 12]], [[-20, 10], [20, 10], [0, 22]], [[-22, 8], [22, 8], [-10, 22], [10, 22]],
];
const WREN_FOCUS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [], [[0, -22]], [[-12, -16], [12, -16]], [[-14, -14], [14, -14], [0, -26]], [[-16, -12], [16, -12], [-6, -26], [6, -26]],
];

export const WREN: CharacterDef = {
  id: 'wren',
  name: 'Sister Wren',
  title: 'Ferrywoman of the Empty River',
  quote: '“I have carried ten thousand souls across the water. Not one of them asked to forget.”',
  stance: 'Letting go. Is releasing something the same as forgetting it?',
  playstyle: 'Risk dancer. A short, brutal oar sweep; grazing fills the bell that eats bullets.',
  stars: 3,
  sprite: S.wren,
  optionSprite: S.soulOrb,
  speed: 4.2,
  focusSpeed: 2.0,
  hitR: 2.0,
  grazeR: 24,
  bombs: 2,
  deathbombFrames: 12,
  bombInvuln: 240,
  skillName: 'Ring the Bell',
  bombName: 'Litany of the Ferry',
  meterLabel: 'Toll',

  layoutOptions(g) {
    blendLayout(g, WREN_WIDE, WREN_FOCUS, optionCount(g));
  },

  fire(g, t) {
    const p = g.player;
    const ps = powerScale(g);
    if (p.focus) {
      // Soul Lantern: slow, steady ghost-lights.
      if (t % 4 === 0) {
        g.shots.spawn(p.x - 5, p.y - 12, 0, -9, 2.0 * ps, S.soul);
        g.shots.spawn(p.x + 5, p.y - 12, 0, -9, 2.0 * ps, S.soul);
      }
      if (t % 6 === 0) {
        for (let i = 0; i < p.emitterCount; i++) {
          const wob = Math.sin(g.frame * 0.2 + i) * 0.4;
          g.shots.spawn(p.emitters[i][0], p.emitters[i][1] - 4, wob, -8.5, 2.6, S.soul);
        }
      }
    } else if (t % 6 === 0) {
      // Oar Sweep: a fan of short arcs; brutal up close, weak far away.
      const arcs = 2 + p.emitterCount;
      for (let k = 0; k < arcs; k++) {
        const a = -Math.PI / 2 + (k - (arcs - 1) / 2) * 0.22;
        g.shots.spawn(p.x, p.y - 10, Math.cos(a) * 9, Math.sin(a) * 9, 3.6 * ps, S.arc, SK.falloff, 0, 17);
      }
    }
  },

  update(g) {
    const cs = g.cs;
    if (cs.requiem > 0) cs.requiem--;
    if (cs.bell.t > 0) cs.bell.t--;
  },

  onGraze(g) {
    g.cs.meter = Math.min(1, g.cs.meter + 1 / 45);
  },

  trySkill(g) {
    const cs = g.cs;
    if (cs.meter < 1) return false;
    const p = g.player;
    cs.meter = 0;
    Object.assign(cs.bell, { x: p.x, y: p.y, t: 40 });
    g.cancelBulletsInRadius(p.x, p.y, BELL_RADIUS, IT.soul);
    cs.requiem = REQUIEM_FRAMES;
    return true;
  },

  bombStart(g) {
    const p = g.player;
    const objs = g.cs.bombObjs;
    objs.length = 0;
    objs.push({ x: p.x, y: FIELD_H + 70, vx: 0, vy: -4.6, alive: true });
    g.shake = 3;
  },

  bombUpdate(g) {
    const b = g.bomb;
    const boat = g.cs.bombObjs[0];
    if (boat) {
      boat.y += boat.vy;
      boat.x += (g.player.x - boat.x) * 0.02; // the ferry drifts toward its passenger
      b.x = boat.x;
      b.y = boat.y;
      g.cancelBulletsInRadius(boat.x, boat.y, 120);
      g.damageInRadius(boat.x, boat.y, 120, 5, 3);
    }
    if (b.t >= 130) {
      b.active = false;
      g.cs.bombObjs.length = 0;
    }
  },

  meter(g) {
    return g.cs.requiem > 0 ? g.cs.requiem / REQUIEM_FRAMES : g.cs.meter;
  },

  damageMult(g) {
    return g.cs.requiem > 0 ? 1.5 : 1;
  },
};

export const CHARACTERS: Record<CharId, CharacterDef> = { sayo: SAYO, ilse: ILSE, tessel: TESSEL, wren: WREN };
