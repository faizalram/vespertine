import type { CharId } from '../game/defs';
import { ell, linGrad, lock, qcurve, radGrad, stroke, taper, type Ctx } from '../ui/art/kit';
import { MODE_RAW, type Def } from './atlas';

/**
 * In-game heroines as jointed chibi puppets (big heads, expressive eyes).
 * Each part is its own atlas sprite; puppet.ts animates them with springs.
 * Parts are drawn in field units at 3 atlas pixels per unit.
 */

const PX = 3;
let nextId = 200;

export type HeadKind = 'open' | 'half' | 'closed' | 'happy' | 'hurt';
export const HEAD_KINDS: readonly HeadKind[] = ['open', 'half', 'closed', 'happy', 'hurt'];

export type Drive = 'none' | 'head' | 'hair' | 'hem' | 'armL' | 'armR' | 'prop' | 'acc' | 'back';

export interface RigPart {
  name: string;
  sprite: number;
  /** Index of the parent part, or -1 for the body root. */
  parent: number;
  /** Joint position in the parent's frame (relative to the parent's joint). */
  attach: readonly [number, number];
  /** Joint position relative to this sprite's centre. */
  pivot: readonly [number, number];
  drive: Drive;
  /** How much of the parent's rotation this part follows (1 rigid, 0 hangs in world space). */
  inherit: number;
  /** For the head: the sprite to use per expression. */
  heads?: Record<HeadKind, number>;
}

export interface Rig {
  parts: RigPart[];
  /** Part whose position gets a glow (Sayo's lantern), with an offset in its frame. */
  glow?: { part: number; offset: readonly [number, number]; color: readonly [number, number, number] };
}

const defs: Def[] = [];

function part(w: number, h: number, draw: (c: Ctx, w: number, h: number) => void): number {
  const id = nextId++;
  defs.push({
    id,
    w: Math.ceil(w * PX),
    h: Math.ceil(h * PX),
    mode: MODE_RAW,
    scale: PX,
    draw: (c) => {
      c.save();
      c.scale(PX, PX);
      draw(c, w, h);
      c.restore();
    },
  });
  return id;
}

// ─────────────────────────────── shared chibi features ───────────────────────────────

interface EyeLook {
  iris: string;
  irisDark: string;
  irisR?: string;
  irisDarkR?: string;
  lash: string;
  skin: string;
  doll?: boolean;
  sharp?: boolean;
}

function chibiEye(c: Ctx, x: number, y: number, side: -1 | 1, kind: HeadKind, e: EyeLook): void {
  const lash = e.lash;
  if (kind === 'closed') {
    taper(c, x - 2.1, y + 0.2, x, y + 1.6, x + 2.1, y + 0.2, 1.0, lash);
    return;
  }
  if (kind === 'happy') {
    taper(c, x - 2.1, y + 0.9, x, y - 1.7, x + 2.1, y + 0.9, 1.0, lash);
    return;
  }
  if (kind === 'hurt') {
    stroke(c, [x - side * 1.6, y - 1.5, x + side * 1.3, y, x - side * 1.6, y + 1.5], lash, 0.8);
    return;
  }
  const iris = side > 0 && e.irisR ? e.irisR : e.iris;
  const dark = side > 0 && e.irisDarkR ? e.irisDarkR : e.irisDark;
  const half = kind === 'half';
  if (half) {
    // A focused, determined look: only the lower part of the eye shows under a dropped lid.
    c.save();
    c.beginPath();
    c.rect(x - 3, y - 0.5, 6, 4);
    c.clip();
  }
  ell(c, x, y, 2.0, 2.5, '#fdfbff');
  ell(c, x, y + 0.3, 1.65, 2.2, linGrad(c, x, y - 2, x, y + 2.4, [[0, dark], [0.6, iris], [1, iris]]));
  ell(c, x, y + 0.4, 0.75, 1.05, dark);
  ell(c, x - side * 0.55, y - 0.75, 0.62, 0.5, '#ffffff');
  ell(c, x + side * 0.6, y + 1.1, 0.28, 0.24, '#ffffff');
  if (half) {
    ell(c, x - side * 0.4, y + 0.2, 0.5, 0.35, '#ffffff');
    c.restore();
    taper(c, x - 2.2, y - 0.3, x, y - 0.9, x + 2.2, y - 0.5, 0.95, lash);
    return;
  }
  const lift = e.sharp ? 0.6 : 0;
  taper(c, x - side * 2.2, y - 1.0, x, y - 3.3, x + side * 2.3, y - 1.4 - lift, e.doll ? 0.85 : 1.05, lash);
  if (e.doll) {
    for (let k = 0; k < 3; k++) stroke(c, [x + side * (0.2 + k * 0.8), y - 2.7 + k * 0.4, x + side * (0.6 + k * 1.0), y - 3.7 + k * 0.4], lash, 0.3);
  } else {
    taper(c, x + side * 1.6, y - 1.5 - lift, x + side * 2.6, y - 2.3 - lift, x + side * 2.9, y - 1.6 - lift, 0.5, lash);
  }
}

function chibiMouth(c: Ctx, x: number, y: number, kind: HeadKind, color: string): void {
  if (kind === 'happy') {
    c.beginPath();
    c.moveTo(x - 1.5, y - 0.2);
    c.quadraticCurveTo(x, y + 0.2, x + 1.5, y - 0.2);
    c.quadraticCurveTo(x, y + 2.2, x - 1.5, y - 0.2);
    c.fillStyle = '#7a2a38';
    c.fill();
    ell(c, x, y + 1.0, 0.7, 0.4, '#d06070');
  } else if (kind === 'hurt') {
    stroke(c, [x - 1.6, y + 0.3, x - 0.8, y - 0.3, x, y + 0.3, x + 0.8, y - 0.3, x + 1.6, y + 0.3], color, 0.4);
  } else if (kind === 'half') {
    qcurve(c, x - 1.0, y + 0.2, x, y + 0.3, x + 1.0, y + 0.2, color, 0.45);
  } else {
    qcurve(c, x - 1.1, y, x, y + 0.7, x + 1.1, y, color, 0.45);
  }
}

function cheeks(c: Ctx, x: number, y: number, gap: number, strength: number): void {
  for (const s of [-1, 1]) ell(c, x + s * gap, y, 1.8, 0.9, radGrad(c, x + s * gap, y, 0, 1.8, [[0, `rgba(255,120,140,${strength})`], [1, 'rgba(255,120,140,0)']]));
}

interface HeadArt {
  skin: string;
  skinShade: string;
  /** Drawn behind the face (back of the head). */
  behind(c: Ctx): void;
  /** Drawn over the face (bangs, accessories). */
  front(c: Ctx): void;
  eyes: EyeLook;
  mouth: string;
  blush: number;
  /** Extra face marks (freckles, crack, beauty mark). */
  marks?(c: Ctx): void;
}

/** Head sprite: 30 × 28 units, face centred at (15, 16). */
function heads(h: HeadArt): Record<HeadKind, number> {
  const out = {} as Record<HeadKind, number>;
  for (const kind of HEAD_KINDS) {
    out[kind] = part(30, 28, (c) => {
      h.behind(c);
      ell(c, 15, 16.2, 10.2, 9.6, linGrad(c, 0, 7, 0, 26, [[0, h.skin], [1, h.skinShade]]));
      h.marks?.(c);
      cheeks(c, 15, 20.2, 5.6, kind === 'happy' || kind === 'hurt' ? h.blush + 0.2 : h.blush);
      chibiEye(c, 11, 17.3, -1, kind, h.eyes);
      chibiEye(c, 19, 17.3, 1, kind, h.eyes);
      chibiMouth(c, 15, 21.6, kind, h.mouth);
      h.front(c);
    });
  }
  return out;
}

function sleeve(fill: string, cuff: string, skin: string, flip: boolean, extra?: (c: Ctx) => void): number {
  return part(9, 15, (c) => {
    if (flip) {
      c.translate(9, 0);
      c.scale(-1, 1);
    }
    c.beginPath();
    c.moveTo(2.2, 0);
    c.lineTo(6.8, 0);
    c.quadraticCurveTo(9, 7, 8.5, 12.5);
    c.quadraticCurveTo(5, 14.4, 1.4, 12.6);
    c.quadraticCurveTo(0.2, 6, 2.2, 0);
    c.fillStyle = linGrad(c, 0, 0, 9, 0, [[0, fill], [1, shade(fill)]]);
    c.fill();
    c.beginPath();
    c.moveTo(1.4, 12.6);
    c.quadraticCurveTo(5, 14.4, 8.5, 12.5);
    c.lineTo(8.3, 11.2);
    c.quadraticCurveTo(5, 12.9, 1.5, 11.3);
    c.fillStyle = cuff;
    c.fill();
    ell(c, 5.6, 13.6, 1.35, 1.2, skin);
    extra?.(c);
  });
}

/** A darker version of a #rrggbb colour. */
function shade(hex: string, k = 0.78): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

function torsoShape(c: Ctx, top: string, bottom: string): void {
  c.beginPath();
  c.moveTo(1.5, 16);
  c.quadraticCurveTo(1, 4, 6, 1.6);
  c.lineTo(14, 1.6);
  c.quadraticCurveTo(19, 4, 18.5, 16);
  c.closePath();
  c.fillStyle = linGrad(c, 0, 0, 0, 16, [[0, top], [1, bottom]]);
  c.fill();
}

function hemShape(c: Ctx, top: string, bottom: string, w = 26, h = 14): void {
  c.beginPath();
  c.moveTo(w * 0.2, 0);
  c.lineTo(w * 0.8, 0);
  c.quadraticCurveTo(w * 0.94, h * 0.6, w * 0.98, h * 0.9);
  c.quadraticCurveTo(w * 0.5, h * 1.08, w * 0.02, h * 0.9);
  c.quadraticCurveTo(w * 0.06, h * 0.6, w * 0.2, 0);
  c.closePath();
  c.fillStyle = linGrad(c, 0, 0, 0, h, [[0, top], [1, bottom]]);
  c.fill();
}

// Standard joint layout shared by every heroine (units).
const HEAD_ATTACH = [0, -5.5] as const; // neck, relative to the body root
const HEAD_PIVOT = [0, 9] as const; // neck relative to the head sprite centre
const TORSO_ATTACH = [0, -5.5] as const;
const TORSO_PIVOT = [0, -7] as const;
const HEM_ATTACH = [0, 9] as const;
const HEM_PIVOT = [0, -6.5] as const;
const ARM_PIVOT = [0, -6.6] as const;

// ─────────────────────────────── Sayo ───────────────────────────────

const SAYO_HAIR = '#1b1424';
const SAYO_SHEEN = '#3d3258';

function sayoRig(): Rig {
  const hairBack = part(30, 34, (c) => {
    c.beginPath();
    c.moveTo(3, 8);
    c.bezierCurveTo(3, -3, 27, -3, 27, 8);
    c.lineTo(29, 30);
    for (const [x, y] of [[25.5, 33.5], [21, 30.5], [15, 33.8], [9, 30.5], [4.5, 33.5], [1, 30]] as const) c.lineTo(x, y);
    c.closePath();
    c.fillStyle = linGrad(c, 0, 0, 0, 34, [[0, SAYO_SHEEN], [0.4, SAYO_HAIR], [1, '#110c18']]);
    c.fill();
  });
  const torso = part(20, 16, (c) => {
    torsoShape(c, '#3a2f6a', '#241c48');
    c.beginPath();
    c.moveTo(6.4, 1.6);
    c.lineTo(10, 9.5);
    c.lineTo(13.6, 1.6);
    c.lineTo(12.3, 1.6);
    c.lineTo(10, 7);
    c.lineTo(7.7, 1.6);
    c.closePath();
    c.fillStyle = '#f2eef8';
    c.fill();
    c.fillStyle = linGrad(c, 0, 12, 0, 16, [[0, '#f4ac4a'], [1, '#c87a24']]);
    c.fillRect(1.3, 12, 17.4, 4);
    stroke(c, [10, 12.4, 10, 15.6], '#8a4a1a', 0.5);
  });
  const hem = part(26, 14, (c) => {
    hemShape(c, '#30265a', '#1e1838');
    c.save();
    c.beginPath();
    c.rect(0, 11, 26, 3);
    c.clip();
    hemShape(c, '#f0a040', '#c87a24');
    c.restore();
    stroke(c, [13, 1, 12.5, 12], 'rgba(10,6,24,0.5)', 0.5);
  });
  const armL = sleeve('#efe9f6', '#30265a', '#f6dccb', false);
  const armR = sleeve('#efe9f6', '#30265a', '#f6dccb', true);
  const lantern = part(8, 14, (c) => {
    stroke(c, [4, 0, 4, 4.4], '#5a3a22', 0.5);
    c.fillStyle = '#7a3a1a';
    c.fillRect(1.6, 3.8, 4.8, 1);
    c.fillRect(1.6, 11.6, 4.8, 1);
    ell(c, 4, 8.2, 3, 3.8, linGrad(c, 0, 4, 0, 12, [[0, '#fff2c0'], [1, '#ffb050']]));
    for (const x of [2.6, 4, 5.4]) stroke(c, [x, 4.8, x, 11.6], 'rgba(160,80,30,0.45)', 0.3);
  });
  const head = heads({
    skin: '#f8e5d8',
    skinShade: '#efcdbc',
    eyes: { iris: '#e8a040', irisDark: '#5e2f10', lash: SAYO_HAIR, skin: '#f8e5d8' },
    mouth: '#a85a62',
    blush: 0.3,
    behind: (c) => ell(c, 15, 13, 12.4, 12, SAYO_HAIR),
    front: (c) => {
      const g = linGrad(c, 0, 2, 0, 16, [[0, SAYO_SHEEN], [0.5, SAYO_HAIR], [1, SAYO_HAIR]]);
      lock(c, 5.2, 9, 3.8, 26, 4.4, -0.8, SAYO_HAIR);
      lock(c, 24.8, 9, 26.2, 26, 4.4, 0.8, SAYO_HAIR);
      c.beginPath();
      c.moveTo(4.3, 14);
      c.bezierCurveTo(3.4, 1.5, 26.6, 1.5, 25.7, 14);
      c.lineTo(4.3, 14);
      c.fillStyle = g;
      c.fill();
      for (const [rx, tx, ty, w] of [[8.5, 6.4, 15, 5], [12, 11, 14.2, 4.6], [15, 15, 14.8, 4.4], [18, 19, 14.2, 4.6], [21.5, 23.6, 15, 5]] as const) {
        lock(c, rx, 6, tx, ty, w, 0, g);
      }
      c.globalAlpha = 0.5;
      qcurve(c, 9, 6.5, 15, 4.2, 21, 6.5, '#6a5c90', 0.8);
      c.globalAlpha = 1;
      // Amber hairpin with a lantern charm.
      taper(c, 20, 7, 23.5, 4, 27.5, 1.6, 1.1, '#e89a3a');
      ell(c, 27.7, 1.6, 1, 1, '#ffd27a');
      c.fillStyle = '#ffd38a';
      c.fillRect(27, 3.2, 1.8, 2.2);
    },
  });
  return rig(
    [
      { name: 'hairBack', sprite: hairBack, parent: 'head', attach: [0, -13.5], pivot: [0, -13], drive: 'hair', inherit: 0.6 },
      { name: 'torso', sprite: torso, attach: TORSO_ATTACH, pivot: TORSO_PIVOT },
      { name: 'hem', sprite: hem, attach: HEM_ATTACH, pivot: HEM_PIVOT, drive: 'hem' },
      { name: 'armL', sprite: armL, attach: [-6.8, -3.4], pivot: ARM_PIVOT, drive: 'armL' },
      { name: 'armR', sprite: armR, attach: [6.8, -3.4], pivot: ARM_PIVOT, drive: 'armR' },
      { name: 'head', sprite: head.open, attach: HEAD_ATTACH, pivot: HEAD_PIVOT, drive: 'head', heads: head },
      { name: 'lantern', sprite: lantern, parent: 'armR', attach: [1.1, 13.2], pivot: [0, -6.6], drive: 'prop', inherit: 0 },
    ],
    { part: 'lantern', offset: [0, 1.6], color: [1, 0.68, 0.3] },
  );
}

/** A part in draw order; parents are referenced by name and must come earlier or later freely. */
interface PartSpec {
  name: string;
  sprite: number;
  parent?: string;
  attach: readonly [number, number];
  pivot: readonly [number, number];
  drive?: Drive;
  inherit?: number;
  heads?: Record<HeadKind, number>;
}

function rig(specs: PartSpec[], glow?: { part: string; offset: readonly [number, number]; color: readonly [number, number, number] }): Rig {
  const index = new Map(specs.map((sp, i) => [sp.name, i]));
  const parts: RigPart[] = specs.map((sp) => ({
    name: sp.name,
    sprite: sp.sprite,
    parent: sp.parent ? index.get(sp.parent)! : -1,
    attach: sp.attach,
    pivot: sp.pivot,
    drive: sp.drive ?? 'none',
    inherit: sp.inherit ?? 1,
    heads: sp.heads,
  }));
  return { parts, glow: glow ? { part: index.get(glow.part)!, offset: glow.offset, color: glow.color } : undefined };
}

// ─────────────────────────────── Ilse ───────────────────────────────

const ILSE_HAIR = '#1d2850';
const ILSE_SHEEN = '#3e5292';

function ilseRig(): Rig {
  const compass = part(40, 20, (c) => {
    stroke(c, [4, 10, 38, 4.5], '#b8902e', 1.6);
    stroke(c, [4, 10, 38, 15.5], '#d9b04a', 1.6);
    stroke(c, [38, 4.5, 39.6, 4], '#e8e8f0', 0.8);
    stroke(c, [38, 15.5, 39.6, 16], '#e8e8f0', 0.8);
    ell(c, 4, 10, 2.6, 2.6, '#f0cc60');
    ell(c, 4, 10, 1.1, 1.1, '#8a6a20');
  });
  const hairBack = part(28, 22, (c) => {
    c.beginPath();
    c.moveTo(2.5, 10);
    c.bezierCurveTo(2, -2, 26, -2, 25.5, 10);
    c.lineTo(26.5, 20);
    for (const [x, y] of [[23, 18], [20, 21.5], [14, 19.5], [8, 21.5], [5, 18], [1.5, 20]] as const) c.lineTo(x, y);
    c.closePath();
    c.fillStyle = linGrad(c, 0, 0, 0, 22, [[0, ILSE_SHEEN], [1, '#141c3a']]);
    c.fill();
  });
  const torso = part(20, 16, (c) => {
    torsoShape(c, '#2a3668', '#172040');
    c.fillStyle = '#1a2244';
    c.beginPath();
    c.moveTo(6, 1.6);
    c.lineTo(3.4, 6.5);
    c.lineTo(9, 4);
    c.closePath();
    c.moveTo(14, 1.6);
    c.lineTo(16.6, 6.5);
    c.lineTo(11, 4);
    c.closePath();
    c.fill();
    stroke(c, [6, 1.6, 3.4, 6.5, 9, 4], '#e0b04a', 0.5);
    stroke(c, [14, 1.6, 16.6, 6.5, 11, 4], '#e0b04a', 0.5);
    stroke(c, [10, 4.5, 10, 16], '#e0b04a', 0.5);
    for (let k = 0; k < 3; k++) ell(c, 11.6, 7 + k * 3, 0.6, 0.6, '#f0cc60');
    ell(c, 4, 12, 1.2, 0.8, '#0c1024');
  });
  const hem = part(26, 13, (c) => {
    for (const s of [0, 1]) {
      c.beginPath();
      const x0 = s ? 13.3 : 4.5;
      const x1 = s ? 21.5 : 12.7;
      c.moveTo(x0, 0);
      c.lineTo(x1, 0);
      c.lineTo(s ? 25 : 12.5, 12.5);
      c.lineTo(s ? 13.5 : 1, 12);
      c.closePath();
      c.fillStyle = linGrad(c, 0, 0, 0, 13, [[0, '#24305e'], [1, '#141a36']]);
      c.fill();
      stroke(c, [s ? 25 : 12.5, 12.5, s ? 13.5 : 1, 12], '#e0b04a', 0.6);
    }
  });
  const armL = sleeve('#26326a', '#e0b04a', '#f5dccb', false, (c) => {
    // A rolled map tucked in her hand.
    c.save();
    c.translate(5.2, 13.3);
    c.rotate(-0.4);
    c.fillStyle = '#efe4c8';
    c.fillRect(-1.1, -3.4, 2.2, 6.8);
    stroke(c, [-1.1, -3.4, 1.1, -3.4], '#b8a070', 0.3);
    c.restore();
  });
  const armR = sleeve('#26326a', '#e0b04a', '#f5dccb', true, (c) => {
    taper(c, 3, 12.8, 2, 14, 0.8, 15.4, 0.6, '#e0b04a');
  });
  const ahoge = part(7, 9, (c) => lock(c, 2.6, 8.6, 5.8, 0.6, 2.2, -1.6, ILSE_SHEEN));
  const head = heads({
    skin: '#f6dece',
    skinShade: '#eac6b2',
    eyes: { iris: '#5078e8', irisDark: '#18225a', lash: '#141a34', skin: '#f6dece', sharp: true },
    mouth: '#a85a62',
    blush: 0.22,
    behind: (c) => ell(c, 15, 13, 12.2, 11.8, ILSE_HAIR),
    marks: (c) => {
      for (const [x, y] of [[11.4, 19.6], [12.6, 20.4], [10.3, 20.5], [18.6, 19.6], [17.4, 20.4], [19.7, 20.5]] as const) {
        ell(c, x, y, 0.32, 0.28, 'rgba(170,100,70,0.6)');
      }
    },
    front: (c) => {
      const g = linGrad(c, 0, 2, 0, 16, [[0, ILSE_SHEEN], [0.5, ILSE_HAIR], [1, ILSE_HAIR]]);
      lock(c, 5, 10, 4.2, 21.5, 4, -0.6, ILSE_HAIR);
      lock(c, 25, 10, 26, 21.5, 4, 0.6, ILSE_HAIR);
      c.beginPath();
      c.moveTo(4.4, 14);
      c.bezierCurveTo(3.4, 1.5, 26.6, 1.5, 25.6, 14);
      c.lineTo(4.4, 14);
      c.fillStyle = g;
      c.fill();
      for (const [rx, tx, ty, w, b] of [[22, 25, 13.5, 4.6, 0.8], [19, 20.5, 15, 5, 1.2], [15.5, 14.5, 15.8, 5.4, 1.6], [12, 9, 15.6, 5.2, 1.6], [8.5, 5, 14.4, 4.8, 1.2]] as const) {
        lock(c, rx, 6, tx, ty, w, b, g);
      }
      // Goggles riding on her hair.
      stroke(c, [3.6, 7.2, 26.4, 6.8], '#5a3e24', 1.4);
      for (const x of [11, 19]) {
        ell(c, x, 6.4, 3.3, 2.6, '#c9a04a');
        ell(c, x, 6.4, 2.5, 1.9, linGrad(c, x, 4.5, x, 8.3, [[0, '#ffe2a0'], [1, '#d08a2a']]));
        ell(c, x - 0.9, 5.6, 0.8, 0.5, 'rgba(255,255,255,0.85)');
      }
    },
  });
  return rig([
    { name: 'compass', sprite: compass, attach: [1, 9], pivot: [0, 0], drive: 'back' },
    { name: 'hairBack', sprite: hairBack, parent: 'head', attach: [0, -13.5], pivot: [0, -9], drive: 'hair', inherit: 0.8 },
    { name: 'torso', sprite: torso, attach: TORSO_ATTACH, pivot: TORSO_PIVOT },
    { name: 'hem', sprite: hem, attach: HEM_ATTACH, pivot: [0, -6], drive: 'hem' },
    { name: 'armL', sprite: armL, attach: [-6.8, -3.4], pivot: ARM_PIVOT, drive: 'armL' },
    { name: 'armR', sprite: armR, attach: [6.8, -3.4], pivot: ARM_PIVOT, drive: 'armR' },
    { name: 'head', sprite: head.open, attach: HEAD_ATTACH, pivot: HEAD_PIVOT, drive: 'head', heads: head },
    { name: 'ahoge', sprite: ahoge, parent: 'head', attach: [1.2, -20.5], pivot: [-0.9, 4], drive: 'acc', inherit: 1 },
  ]);
}

// ─────────────────────────────── Tessel ───────────────────────────────

const TESSEL_HAIR = '#6a4a3e';
const TESSEL_SHEEN = '#94705e';

function curls(c: Ctx, x: number, y0: number, n: number, r: number): void {
  for (let i = 0; i < n; i++) {
    const y = y0 + i * r * 1.45;
    ell(c, x + (i % 2 ? 0.5 : -0.5), y, r, r * 0.9, linGrad(c, x, y - r, x, y + r, [[0, TESSEL_SHEEN], [1, TESSEL_HAIR]]));
  }
}

function tesselRig(): Rig {
  const hairBack = part(32, 28, (c) => {
    ell(c, 16, 9, 12.5, 9, TESSEL_HAIR);
    curls(c, 4.5, 8, 5, 3.4);
    curls(c, 27.5, 8, 5, 3.4);
  });
  const torso = part(19, 15, (c) => {
    c.save();
    c.scale(19 / 20, 15 / 16);
    torsoShape(c, '#a4482f', '#742c1c');
    c.restore();
    for (let k = 0; k < 6; k++) ell(c, 5.5 + k * 1.6, 2.2 + Math.sin((k / 5) * Math.PI) * 1.4, 1.2, 1.1, '#f6f0e8');
    ell(c, 9.5, 6.4, 1.3, 1.6, '#d9b06a');
  });
  const hem = part(28, 14, (c) => {
    hemShape(c, '#a04630', '#702a1c', 28, 12.5);
    for (let k = 0; k < 8; k++) ell(c, 2.2 + k * 3.4, 12.6, 1.9, 1.3, '#f6f0e8');
  });
  const arm = (flip: boolean) => part(7, 15, (c) => {
    if (flip) {
      c.translate(7, 0);
      c.scale(-1, 1);
    }
    ell(c, 3.5, 1.8, 2.4, 2.2, '#a4482f');
    stroke(c, [3.5, 2.5, 3.2, 7.2, 3.8, 12.2], '#f2ece6', 2);
    ell(c, 3.3, 7.4, 1.2, 1.2, '#e4dad2');
    stroke(c, [2.2, 7.4, 4.4, 7.4], 'rgba(130,110,110,0.6)', 0.25);
    ell(c, 4, 13.3, 1.3, 1.2, '#f6f0ea');
  });
  const bow = part(20, 11, (c) => {
    c.fillStyle = '#b84a48';
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(10, 6);
      c.bezierCurveTo(10 + s * 6, -1, 10 + s * 10.5, 2, 10 + s * 9, 9);
      c.bezierCurveTo(10 + s * 6, 9.5, 10 + s * 3, 8, 10, 6);
      c.fill();
    }
    c.globalAlpha = 0.4;
    qcurve(c, 8, 4.4, 5.5, 2.2, 3.4, 3.4, '#ffffff', 0.6);
    c.globalAlpha = 1;
    ell(c, 10, 6.2, 2, 1.8, '#8a3030');
  });
  const head = heads({
    skin: '#fcf7f2',
    skinShade: '#efe4dc',
    eyes: { iris: '#4a9ae8', irisDark: '#163a6a', irisR: '#e8a640', irisDarkR: '#6a3a10', lash: '#3a2a2a', skin: '#fcf7f2', doll: true },
    mouth: '#c06070',
    blush: 0.42,
    behind: (c) => ell(c, 15, 13, 12.2, 11.8, TESSEL_HAIR),
    marks: (c) => stroke(c, [21.5, 9, 20.8, 11.2, 22.4, 13], 'rgba(110,90,90,0.55)', 0.25),
    front: (c) => {
      const g = linGrad(c, 0, 2, 0, 15, [[0, TESSEL_SHEEN], [1, TESSEL_HAIR]]);
      c.beginPath();
      c.moveTo(4.4, 13.6);
      c.bezierCurveTo(3.4, 1.5, 26.6, 1.5, 25.6, 13.6);
      for (let k = 0; k <= 8; k++) c.lineTo(25.6 - k * 2.65, 13.6 + (k % 2 ? 0.7 : 0));
      c.closePath();
      c.fillStyle = g;
      c.fill();
      curls(c, 4.6, 12.5, 4, 2.4);
      curls(c, 25.4, 12.5, 4, 2.4);
    },
  });
  return rig([
    { name: 'hairBack', sprite: hairBack, parent: 'head', attach: [0, -13], pivot: [0, -10], drive: 'hair', inherit: 0.7 },
    { name: 'torso', sprite: torso, attach: TORSO_ATTACH, pivot: [0, -6.6] },
    { name: 'hem', sprite: hem, attach: [0, 8.4], pivot: [0, -6.4], drive: 'hem' },
    { name: 'armL', sprite: arm(false), attach: [-6.2, -3.2], pivot: ARM_PIVOT, drive: 'armL' },
    { name: 'armR', sprite: arm(true), attach: [6.2, -3.2], pivot: ARM_PIVOT, drive: 'armR' },
    { name: 'head', sprite: head.open, attach: HEAD_ATTACH, pivot: HEAD_PIVOT, drive: 'head', heads: head },
    { name: 'bow', sprite: bow, parent: 'head', attach: [0, -20.5], pivot: [0, 2.5], drive: 'acc', inherit: 1 },
  ]);
}

// ─────────────────────────────── Wren ───────────────────────────────

const WREN_VEIL = '#1f2b32';

function wrenRig(): Rig {
  const oar = part(11, 48, (c) => {
    stroke(c, [4.5, 47, 5.5, 6], '#4a3a30', 1.6);
    c.beginPath();
    c.moveTo(5.5, 6);
    c.quadraticCurveTo(10.5, 2, 10.6, 11);
    c.quadraticCurveTo(8, 6.5, 5.4, 10);
    c.closePath();
    c.fillStyle = linGrad(c, 5, 2, 11, 11, [[0, '#7ac8be'], [1, '#d0f4ee']]);
    c.fill();
    c.beginPath();
    c.moveTo(5.5, 6);
    c.quadraticCurveTo(0.4, 2, 0.4, 11);
    c.quadraticCurveTo(3, 6.5, 5.6, 10);
    c.closePath();
    c.fill();
  });
  const veil = part(30, 36, (c) => {
    c.beginPath();
    c.moveTo(3, 9);
    c.bezierCurveTo(2, -2, 28, -2, 27, 9);
    c.bezierCurveTo(28.5, 20, 29.5, 28, 29.8, 35);
    c.quadraticCurveTo(22, 33, 15, 35.5);
    c.quadraticCurveTo(8, 33, 0.2, 35);
    c.bezierCurveTo(0.5, 28, 1.5, 20, 3, 9);
    c.fillStyle = linGrad(c, 0, 0, 0, 36, [[0, '#35464f'], [0.5, WREN_VEIL], [1, '#141c22']]);
    c.fill();
  });
  const torso = part(20, 16, (c) => {
    torsoShape(c, '#f2ece2', '#d8d0c0');
    c.fillStyle = '#2aa89a';
    c.fillRect(7.2, 2, 2, 14);
    c.fillRect(10.8, 2, 2, 14);
    ell(c, 10, 13.5, 0.9, 0.9, '#c9a24a');
  });
  const hem = part(26, 13, (c) => {
    hemShape(c, '#ebe5d9', '#cfc6b4', 26, 12.4);
    c.save();
    c.beginPath();
    c.rect(0, 10.6, 26, 3);
    c.clip();
    hemShape(c, '#2aa89a', '#1a7a70', 26, 12.4);
    c.restore();
  });
  const armL = sleeve('#efe9de', '#2aa89a', '#f1dece', false);
  const armR = sleeve('#efe9de', '#2aa89a', '#f1dece', true);
  const bell = part(6, 8, (c) => {
    stroke(c, [3, 0, 3, 2.4], '#6a5030', 0.4);
    c.beginPath();
    c.moveTo(3, 2);
    c.quadraticCurveTo(5.8, 2, 5.9, 7);
    c.lineTo(0.1, 7);
    c.quadraticCurveTo(0.2, 2, 3, 2);
    c.fillStyle = linGrad(c, 0, 2, 6, 7, [[0, '#f8d870'], [1, '#a07a24']]);
    c.fill();
    ell(c, 3, 7.3, 0.7, 0.7, '#8a6a2a');
  });
  const head = heads({
    skin: '#f3e1d2',
    skinShade: '#e4c8b4',
    eyes: { iris: '#2aa094', irisDark: '#0b3a36', lash: '#24262a', skin: '#f3e1d2' },
    mouth: '#9e5a5a',
    blush: 0.22,
    behind: (c) => ell(c, 15, 13, 12.6, 12.2, WREN_VEIL),
    marks: (c) => ell(c, 20.6, 19.4, 0.3, 0.3, '#6a4a40'),
    front: (c) => {
      // Wimple framing the face, veil over the crown, one grey strand escaping.
      c.beginPath();
      c.moveTo(4.2, 17);
      c.bezierCurveTo(3, 3, 27, 3, 25.8, 17);
      c.lineTo(23.8, 17);
      c.bezierCurveTo(24.4, 7.4, 5.6, 7.4, 6.2, 17);
      c.closePath();
      c.fillStyle = '#f8f4ec';
      c.fill();
      c.beginPath();
      c.moveTo(3.4, 10);
      c.bezierCurveTo(2.6, -1.5, 27.4, -1.5, 26.6, 10);
      c.bezierCurveTo(21, 5, 9, 5, 3.4, 10);
      c.fillStyle = WREN_VEIL;
      c.fill();
      taper(c, 6.8, 10.5, 6.2, 13, 6.9, 15.4, 0.6, '#c0bac2');
    },
  });
  return rig([
    { name: 'oar', sprite: oar, attach: [-9.5, 2], pivot: [0, 8], drive: 'back' },
    { name: 'veil', sprite: veil, parent: 'head', attach: [0, -14], pivot: [0, -15], drive: 'hair', inherit: 0.5 },
    { name: 'torso', sprite: torso, attach: TORSO_ATTACH, pivot: TORSO_PIVOT },
    { name: 'hem', sprite: hem, attach: HEM_ATTACH, pivot: [0, -6.2], drive: 'hem' },
    { name: 'armL', sprite: armL, attach: [-6.8, -3.4], pivot: ARM_PIVOT, drive: 'armL' },
    { name: 'armR', sprite: armR, attach: [6.8, -3.4], pivot: ARM_PIVOT, drive: 'armR' },
    { name: 'head', sprite: head.open, attach: HEAD_ATTACH, pivot: HEAD_PIVOT, drive: 'head', heads: head },
    { name: 'bell', sprite: bell, attach: [4.6, 5.2], pivot: [0, -3.8], drive: 'prop', inherit: 0 },
  ]);
}

// ─────────────────────────────── build ───────────────────────────────

let built: { defs: Def[]; rigs: Record<CharId, Rig> } | null = null;

/** Builds every puppet sprite definition and rig once (sprites are drawn when the atlas is built). */
export function puppets(): { defs: Def[]; rigs: Record<CharId, Rig> } {
  if (!built) {
    const rigs = { sayo: sayoRig(), ilse: ilseRig(), tessel: tesselRig(), wren: wrenRig() };
    built = { defs, rigs };
  }
  return built;
}
