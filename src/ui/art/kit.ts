/**
 * Shared vector drawing kit for character art (portraits and in-game puppets).
 * Everything is plain Canvas 2D: soft shapes, tapered strokes, layered eyes.
 */

export type Ctx = CanvasRenderingContext2D;

export function ell(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}

export function stroke(c: Ctx, pts: number[], color: string, width: number, close = false): void {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  if (close) c.closePath();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}

export function qcurve(c: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, color: string, width: number): void {
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(cx, cy, x1, y1);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.stroke();
}

/** A stroke that is thick in the middle and tapers to points at both ends (brows, lashes, hair strands). */
export function taper(c: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, width: number, color: string): void {
  const nx = -(y1 - y0);
  const ny = x1 - x0;
  const len = Math.hypot(nx, ny) || 1;
  const ox = (nx / len) * width * 0.5;
  const oy = (ny / len) * width * 0.5;
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(cx + ox, cy + oy, x1, y1);
  c.quadraticCurveTo(cx - ox, cy - oy, x0, y0);
  c.fillStyle = color;
  c.fill();
}

export function linGrad(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Array<[number, string]>): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

export function radGrad(c: Ctx, x: number, y: number, r0: number, r1: number, stops: Array<[number, string]>): CanvasGradient {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

/**
 * One lock of hair: a curved, pointed teardrop from a root (rx, ry) to a tip (tx, ty),
 * bowing sideways by `bend`. Locks overlap to build bangs and side hair.
 */
export function lock(c: Ctx, rx: number, ry: number, tx: number, ty: number, width: number, bend: number, fill: string | CanvasGradient): void {
  const mx = (rx + tx) / 2;
  const my = (ry + ty) / 2;
  const dx = tx - rx;
  const dy = ty - ry;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  c.beginPath();
  c.moveTo(rx - nx * width * 0.5, ry - ny * width * 0.5);
  c.quadraticCurveTo(cx - nx * width * 0.35, cy - ny * width * 0.35, tx, ty);
  c.quadraticCurveTo(cx + nx * width * 0.35, cy + ny * width * 0.35, rx + nx * width * 0.5, ry + ny * width * 0.5);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}

/** Soft, slightly heart-shaped face: wide cheeks, gentle pointed chin. */
export function faceShape(c: Ctx, cx: number, top: number, halfW: number, chinY: number, fill: string | CanvasGradient): void {
  const cheekY = top + (chinY - top) * 0.58;
  c.beginPath();
  c.moveTo(cx - halfW, top + (chinY - top) * 0.22);
  c.bezierCurveTo(cx - halfW, top - (chinY - top) * 0.12, cx + halfW, top - (chinY - top) * 0.12, cx + halfW, top + (chinY - top) * 0.22);
  c.bezierCurveTo(cx + halfW * 1.02, cheekY, cx + halfW * 0.55, chinY - 6, cx, chinY);
  c.bezierCurveTo(cx - halfW * 0.55, chinY - 6, cx - halfW * 1.02, cheekY, cx - halfW, top + (chinY - top) * 0.22);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}

// ─────────────────────────────── eyes ───────────────────────────────

export type EyeKind = 'open' | 'half' | 'closed' | 'happy' | 'wide' | 'down' | 'hurt' | 'dull';
export type EyeStyle = 'anime' | 'tired' | 'sharp' | 'gentle' | 'doll';

export interface EyeSpec {
  w: number;
  h: number;
  iris: string;
  irisDark: string;
  lash: string;
  skin: string;
  style: EyeStyle;
}

/** Shapes the upper/lower lid for each style. Returns control offsets. */
function lidShape(style: EyeStyle) {
  switch (style) {
    case 'tired':
      return { top: 0.66, outerLift: 0.0, lidCover: 0.16, lower: 0.5 };
    case 'sharp':
      return { top: 0.7, outerLift: 0.18, lidCover: 0.08, lower: 0.45 };
    case 'gentle':
      return { top: 0.72, outerLift: -0.08, lidCover: 0.12, lower: 0.52 };
    case 'doll':
      return { top: 0.85, outerLift: 0.0, lidCover: 0.0, lower: 0.62 };
    default:
      return { top: 0.75, outerLift: 0.06, lidCover: 0.06, lower: 0.52 };
  }
}

/**
 * Anime eye centred at (x, y). `side` is -1 for the eye on the viewer's left, +1 for right
 * (outer corner points away from the nose). `gaze` shifts the iris sideways (-1..1).
 */
export function eye(c: Ctx, x: number, y: number, side: -1 | 1, kind: EyeKind, e: EyeSpec, gaze = 0): void {
  const w = e.w;
  const h = kind === 'wide' ? e.h * 1.15 : e.h;
  const ls = lidShape(e.style);
  const ox = x + side * w * 0.5; // outer corner
  const ix = x - side * w * 0.5; // inner corner
  const oy = y - h * ls.outerLift;
  const iy = y + h * 0.05;

  if (kind === 'closed' || kind === 'happy' || kind === 'hurt') {
    c.lineCap = 'round';
    if (kind === 'hurt') {
      // >  <
      stroke(c, [ix + side * w * 0.05, y - h * 0.35, ox - side * w * 0.15, y, ix + side * w * 0.05, y + h * 0.35], e.lash, 3.2);
      return;
    }
    const cy = kind === 'happy' ? y - h * 0.55 : y + h * 0.35;
    taper(c, ix, iy, x, cy, ox, oy, 4.2, e.lash);
    // A little lash flick at the outer corner.
    taper(c, ox - side * 2, oy, ox + side * w * 0.12, oy - h * 0.12, ox + side * w * 0.2, oy - h * 0.05, 2, e.lash);
    return;
  }

  c.save();
  // Eye opening (sclera).
  const lowerY = y + h * ls.lower;
  const upperCY = y - h * ls.top;
  c.beginPath();
  c.moveTo(ix, iy);
  c.quadraticCurveTo(x, upperCY, ox, oy);
  c.quadraticCurveTo(x + side * w * 0.12, lowerY, ix, iy);
  c.closePath();
  c.fillStyle = '#fdfbff';
  c.fill();
  c.clip();

  // Iris and pupil.
  const irx = w * (kind === 'wide' ? 0.27 : 0.31);
  const iry = h * (kind === 'wide' ? 0.42 : 0.48);
  const icx = x + gaze * w * 0.14 + side * w * 0.02;
  const icy = y + h * (kind === 'down' ? 0.2 : 0.06);
  const irisFill = kind === 'dull'
    ? linGrad(c, icx, icy - iry, icx, icy + iry, [[0, '#5a5a66'], [1, '#9a9aa6']])
    : linGrad(c, icx, icy - iry, icx, icy + iry, [[0, e.irisDark], [0.55, e.iris], [1, e.iris]]);
  ell(c, icx, icy, irx, iry, irisFill);
  c.strokeStyle = e.irisDark;
  c.lineWidth = 1.2;
  c.beginPath();
  c.ellipse(icx, icy, irx, iry, 0, 0, Math.PI * 2);
  c.stroke();
  ell(c, icx, icy + iry * 0.05, irx * 0.48, iry * 0.52, kind === 'dull' ? '#3a3a44' : e.irisDark);
  // A soft lighter crescent at the bottom of the iris.
  if (kind !== 'dull') {
    c.globalAlpha = 0.45;
    ell(c, icx, icy + iry * 0.55, irx * 0.65, iry * 0.28, '#ffffff');
    c.globalAlpha = 1;
  }
  // Highlights: the life in the eye.
  const hl = kind === 'dull' ? 0.35 : 1;
  c.globalAlpha = hl;
  ell(c, icx - side * irx * 0.38, icy - iry * 0.42, irx * 0.36, iry * 0.26, '#ffffff', -0.4 * side);
  ell(c, icx + side * irx * 0.35, icy + iry * 0.3, irx * 0.14, iry * 0.11, '#ffffff');
  c.globalAlpha = 1;
  // Shadow cast by the upper lid.
  c.globalAlpha = 0.22;
  c.fillStyle = e.lash;
  c.fillRect(x - w, upperCY - 2, w * 2, h * 0.32 + (y - upperCY) * 0.35);
  c.globalAlpha = 1;

  // Heavy lid (tired / half / down): skin covers the top of the eye.
  const cover = kind === 'half' || kind === 'down' ? 0.5 : kind === 'wide' ? 0 : ls.lidCover;
  let lidY = upperCY;
  if (cover > 0) {
    lidY = upperCY + (lowerY - upperCY) * cover;
    c.fillStyle = e.skin;
    c.beginPath();
    c.moveTo(ix - 4, iy - 30);
    c.lineTo(ox + side * 4, oy - 30);
    c.lineTo(ox + side * 4, oy + (lidY - upperCY) * 0.6);
    c.quadraticCurveTo(x, lidY, ix - side * 4, iy + (lidY - upperCY) * 0.15);
    c.closePath();
    c.fill();
  }
  c.restore();

  // Upper lash line (thick, with an outer flick) along the lid edge.
  const lashCY = cover > 0 ? lidY : upperCY;
  const lashOy = cover > 0 ? oy + (lidY - upperCY) * 0.5 : oy;
  taper(c, ix - side * 1, iy, x, lashCY - 1.5, ox + side * 1.5, lashOy, e.style === 'doll' ? 3.8 : 5.6, e.lash);
  if (e.style === 'doll') {
    // Painted doll lashes.
    for (let k = 0; k < 3; k++) {
      const t = 0.45 + k * 0.22;
      const px = ix + (ox - ix) * t;
      const py = iy + (lashOy - iy) * t - h * 0.42 * Math.sin(Math.PI * t);
      stroke(c, [px, py, px + side * 3, py - 4.5], e.lash, 1.4);
    }
  } else {
    taper(c, ox - side * 3, lashOy, ox + side * w * 0.14, lashOy - h * 0.16, ox + side * w * 0.24, lashOy - h * 0.02, 2.4, e.lash);
    // Double-lid crease.
    c.globalAlpha = 0.35;
    qcurve(c, ix + side * w * 0.15, iy - h * 0.38, x, lashCY - h * 0.32, ox - side * w * 0.05, lashOy - h * 0.3, e.lash, 1.1);
    c.globalAlpha = 1;
  }
  // Lower lash: just a hint at the outer half.
  c.globalAlpha = 0.6;
  qcurve(c, x + side * w * 0.05, lowerY - 1, x + side * w * 0.3, lowerY - 0.5, ox - side * 1, oy + h * 0.15, e.lash, 1.2);
  c.globalAlpha = 1;
}

/** A tapered brow. `tilt` > 0 lifts the inner end (worry), < 0 lowers it (anger). */
export function brow(c: Ctx, x: number, y: number, side: -1 | 1, tilt: number, len: number, color: string, lift = 0): void {
  const ix = x - side * len * 0.5;
  const ox = x + side * len * 0.5;
  const iy = y - tilt * 6 - lift;
  const oy = y + tilt * 2 - lift;
  taper(c, ix, iy, x, Math.min(iy, oy) - 3, ox, oy + 1, 3.6, color);
}

// ─────────────────────────────── mouths ───────────────────────────────

export type MouthKind =
  | 'neutral' | 'smile' | 'grin' | 'fang' | 'frown' | 'o' | 'smirk' | 'flat' | 'wavy' | 'gold' | 'openSmall' | 'openSmile' | 'teeth';

export function mouth(c: Ctx, x: number, y: number, kind: MouthKind, color: string, scale = 1): void {
  const s = scale;
  const inside = '#5a2430';
  switch (kind) {
    case 'smile':
      qcurve(c, x - 7 * s, y - 1, x, y + 5 * s, x + 7 * s, y - 1, color, 2.2);
      break;
    case 'grin':
    case 'fang':
    case 'gold':
    case 'teeth':
    case 'openSmile': {
      const w = (kind === 'openSmile' ? 7 : 10) * s;
      const d = (kind === 'openSmile' ? 7 : kind === 'teeth' ? 6 : 10) * s;
      c.beginPath();
      c.moveTo(x - w, y - 1);
      c.quadraticCurveTo(x, y + 1, x + w, y - 1);
      c.quadraticCurveTo(x + w * 0.6, y + d, x, y + d);
      c.quadraticCurveTo(x - w * 0.6, y + d, x - w, y - 1);
      c.closePath();
      c.fillStyle = inside;
      c.fill();
      // Tongue.
      c.save();
      c.clip();
      ell(c, x, y + d * 0.95, w * 0.55, d * 0.42, '#c75a66');
      if (kind !== 'openSmile') {
        c.fillStyle = '#ffffff';
        c.fillRect(x - w, y - 2, w * 2, d * 0.32);
      }
      if (kind === 'gold') {
        c.fillStyle = '#f0c040';
        c.fillRect(x + w * 0.2, y - 1, w * 0.28, d * 0.32);
      }
      c.restore();
      if (kind === 'fang') {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(x - w * 0.55, y);
        c.lineTo(x - w * 0.42, y + d * 0.45);
        c.lineTo(x - w * 0.3, y + 0.5);
        c.fill();
      }
      c.strokeStyle = color;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(x - w, y - 1);
      c.quadraticCurveTo(x + w * 0.6 - w * 0.6, y + d + 0.5, x + w, y - 1);
      c.stroke();
      break;
    }
    case 'frown':
      qcurve(c, x - 6 * s, y + 3, x, y - 2 * s, x + 6 * s, y + 3, color, 2.2);
      break;
    case 'o':
      ell(c, x, y + 2, 4 * s, 5 * s, inside);
      ell(c, x, y + 4, 2.4 * s, 2 * s, '#c75a66');
      break;
    case 'openSmall':
      ell(c, x, y + 1.5, 4.2 * s, 3.4 * s, inside);
      ell(c, x, y + 3, 2.6 * s, 1.5 * s, '#c75a66');
      break;
    case 'smirk':
      qcurve(c, x - 6 * s, y + 1, x + 2 * s, y + 3 * s, x + 8 * s, y - 3 * s, color, 2.2);
      break;
    case 'flat':
      qcurve(c, x - 5 * s, y + 1, x, y + 1.5, x + 5 * s, y + 1, color, 2.2);
      break;
    case 'wavy':
      stroke(c, [x - 8 * s, y + 1, x - 4 * s, y - 2, x, y + 1, x + 4 * s, y - 2, x + 8 * s, y + 1], color, 2);
      break;
    default:
      qcurve(c, x - 5 * s, y, x, y + 2.5 * s, x + 5 * s, y, color, 2.2);
  }
}

/** The open-mouth shape a face uses while talking. */
export function talkingMouth(kind: MouthKind): MouthKind {
  return kind === 'smile' || kind === 'grin' || kind === 'fang' || kind === 'gold' || kind === 'teeth' ? 'openSmile' : 'openSmall';
}

export function blush(c: Ctx, x: number, y: number, strength = 1): void {
  ell(c, x, y, 11, 5.5, radGrad(c, x, y, 0, 11, [[0, `rgba(255,110,130,${0.42 * strength})`], [1, 'rgba(255,110,130,0)']]));
  for (let k = 0; k < 3; k++) stroke(c, [x - 5 + k * 4, y + 1.5, x - 3 + k * 4, y - 1.5], `rgba(220,90,110,${0.5 * strength})`, 1);
}

export function tear(c: Ctx, x: number, y: number): void {
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + 4, y + 7, x, y + 10);
  c.quadraticCurveTo(x - 4, y + 7, x, y);
  c.fillStyle = 'rgba(150,210,255,0.85)';
  c.fill();
  ell(c, x - 1, y + 6, 1, 1.5, '#ffffff');
}

export function sweat(c: Ctx, x: number, y: number): void {
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + 5, y + 8, x, y + 11);
  c.quadraticCurveTo(x - 5, y + 8, x, y);
  c.fillStyle = 'rgba(170,220,255,0.9)';
  c.fill();
}
