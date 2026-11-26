import type { Speaker } from '../game/defs';

/**
 * Flat, paper-cut vector portraits (spec §8.3). Each portrait is a fixed bust;
 * expressions swap only eyes, brows and mouth. Drawn in a 240×320 box.
 */

export const PORTRAIT_W = 240;
export const PORTRAIT_H = 320;

export const SPEAKER_NAMES: Record<Speaker, string> = {
  sayo: 'Sayo Kagari',
  hoshiko: 'Hoshiko Aze',
};

type Ctx = CanvasRenderingContext2D;

function ell(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}

function line(c: Ctx, pts: number[], stroke: string, width: number) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.strokeStyle = stroke;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}

function curve(c: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, stroke: string, width: number) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(cx, cy, x1, y1);
  c.strokeStyle = stroke;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.stroke();
}

/** Paper-cut drop shadow behind the silhouette. */
function paperShadow(c: Ctx, draw: () => void) {
  c.save();
  c.translate(5, 5);
  c.globalAlpha = 0.35;
  c.filter = 'brightness(0)';
  draw();
  c.restore();
  draw();
}

// ─────────────────────────────── Sayo ───────────────────────────────

const SAYO_SKIN = '#f3dccb';
const SAYO_HAIR = '#1a1424';
const SAYO_INK = '#1a1424';

function sayoBase(c: Ctx) {
  // Long hair behind.
  c.fillStyle = SAYO_HAIR;
  c.beginPath();
  c.moveTo(66, 120);
  c.quadraticCurveTo(60, 60, 120, 54);
  c.quadraticCurveTo(182, 60, 176, 122);
  c.lineTo(196, 320);
  c.lineTo(44, 320);
  c.closePath();
  c.fill();
  // Robe and sleeves.
  c.fillStyle = '#2b2350';
  c.beginPath();
  c.moveTo(20, 320);
  c.quadraticCurveTo(34, 244, 96, 226);
  c.lineTo(144, 226);
  c.quadraticCurveTo(206, 244, 220, 320);
  c.closePath();
  c.fill();
  // Collar.
  c.fillStyle = '#ece6f4';
  c.beginPath();
  c.moveTo(96, 226);
  c.lineTo(120, 276);
  c.lineTo(144, 226);
  c.lineTo(134, 226);
  c.lineTo(120, 258);
  c.lineTo(106, 226);
  c.closePath();
  c.fill();
  c.fillStyle = '#f0a040';
  c.fillRect(40, 300, 160, 8);
  // Neck & face.
  c.fillStyle = SAYO_SKIN;
  c.fillRect(108, 186, 24, 44);
  ell(c, 120, 142, 46, 54, SAYO_SKIN);
  // Bangs.
  c.fillStyle = SAYO_HAIR;
  c.beginPath();
  c.moveTo(70, 140);
  c.quadraticCurveTo(66, 74, 120, 70);
  c.quadraticCurveTo(176, 74, 170, 140);
  c.lineTo(160, 112);
  c.lineTo(150, 128);
  c.lineTo(138, 100);
  c.lineTo(124, 122);
  c.lineTo(110, 100);
  c.lineTo(96, 126);
  c.lineTo(86, 108);
  c.closePath();
  c.fill();
  // Side locks.
  c.beginPath();
  c.moveTo(72, 128);
  c.quadraticCurveTo(66, 190, 80, 222);
  c.lineTo(88, 150);
  c.closePath();
  c.moveTo(168, 128);
  c.quadraticCurveTo(174, 190, 160, 222);
  c.lineTo(152, 150);
  c.closePath();
  c.fill();
  // Amber hairpin with a tiny lantern charm.
  line(c, [146, 82, 184, 58], '#f0a040', 4);
  ell(c, 186, 57, 6, 6, '#ffcf70');
  c.fillStyle = '#ffd38a';
  c.fillRect(181, 64, 9, 12);
}

function sayoEyes(c: Ctx, kind: 'open' | 'half' | 'closed' | 'wide') {
  for (const x of [100, 140]) {
    if (kind === 'closed') {
      curve(c, x - 11, 148, x, 155, x + 11, 148, SAYO_INK, 3);
      continue;
    }
    const ry = kind === 'wide' ? 10 : 8;
    ell(c, x, 148, 11, ry, '#fbf6ff');
    ell(c, x, 149, 6.5, ry - 1, '#3a2a40');
    ell(c, x, 150, 3.5, 4, '#f0a040');
    ell(c, x + 2, 146, 2, 2, '#ffffff');
    if (kind === 'half') {
      c.fillStyle = SAYO_SKIN;
      c.fillRect(x - 13, 136, 26, 11);
      line(c, [x - 12, 147, x + 12, 147], SAYO_INK, 3);
    } else {
      curve(c, x - 12, 145, x, 136 - (kind === 'wide' ? 3 : 0), x + 12, 145, SAYO_INK, 3);
    }
  }
}

function drawSayo(c: Ctx, expr: string) {
  paperShadow(c, () => sayoBase(c));
  switch (expr) {
    case 'tired':
      sayoEyes(c, 'half');
      line(c, [88, 130, 110, 131], SAYO_INK, 2);
      line(c, [130, 131, 152, 130], SAYO_INK, 2);
      line(c, [112, 180, 128, 180], '#a0505a', 2.5);
      break;
    case 'annoyed':
      sayoEyes(c, 'half');
      line(c, [88, 126, 110, 134], SAYO_INK, 3);
      line(c, [130, 134, 152, 126], SAYO_INK, 3);
      curve(c, 110, 182, 120, 178, 130, 182, '#a0505a', 2.5);
      break;
    case 'soft':
      sayoEyes(c, 'closed');
      line(c, [88, 132, 110, 130], SAYO_INK, 2);
      line(c, [130, 130, 152, 132], SAYO_INK, 2);
      curve(c, 110, 178, 120, 184, 130, 178, '#a0505a', 2.5);
      ell(c, 94, 166, 8, 4, 'rgba(240,120,130,0.35)');
      ell(c, 146, 166, 8, 4, 'rgba(240,120,130,0.35)');
      break;
    case 'surprised':
      sayoEyes(c, 'wide');
      line(c, [88, 124, 110, 122], SAYO_INK, 2);
      line(c, [130, 122, 152, 124], SAYO_INK, 2);
      ell(c, 120, 182, 4, 5, '#a0505a');
      break;
    case 'smirk':
      sayoEyes(c, 'half');
      line(c, [88, 130, 110, 130], SAYO_INK, 2);
      line(c, [130, 128, 152, 126], SAYO_INK, 2);
      curve(c, 110, 180, 124, 182, 132, 175, '#a0505a', 2.5);
      break;
    default:
      sayoEyes(c, 'open');
      line(c, [88, 130, 110, 129], SAYO_INK, 2);
      line(c, [130, 129, 152, 130], SAYO_INK, 2);
      line(c, [113, 180, 127, 180], '#a0505a', 2.5);
  }
}

// ─────────────────────────────── Hoshiko ───────────────────────────────

const HOSHI_SKIN = '#f6e2cc';
const STRAW = '#e8c26a';
const STITCH = '#8a3a3a';

function hoshikoBase(c: Ctx) {
  // Braids.
  c.fillStyle = STRAW;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(120 + s * 58, 220, 14, 54, s * 0.15, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = '#c9a050';
  c.lineWidth = 2;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      curve(c, 120 + s * 48, 182 + i * 18, 120 + s * 58, 190 + i * 18, 120 + s * 68, 182 + i * 18, '#c9a050', 2);
    }
    ell(c, 120 + s * 60, 276, 9, 6, '#b04848');
  }
  // Patchwork dress.
  c.fillStyle = '#8a4a3a';
  c.beginPath();
  c.moveTo(24, 320);
  c.quadraticCurveTo(40, 240, 98, 230);
  c.lineTo(142, 230);
  c.quadraticCurveTo(200, 240, 216, 320);
  c.closePath();
  c.fill();
  c.fillStyle = '#c9a25a';
  c.fillRect(54, 272, 34, 28);
  c.fillStyle = '#5a6a8a';
  c.fillRect(150, 266, 30, 30);
  c.setLineDash([4, 4]);
  c.strokeStyle = '#efe3c8';
  c.lineWidth = 1.5;
  c.strokeRect(54, 272, 34, 28);
  c.strokeRect(150, 266, 30, 30);
  c.setLineDash([]);
  // Straw at the collar.
  for (let i = 0; i < 9; i++) line(c, [100 + i * 5, 232, 96 + i * 6, 250 + (i % 3) * 4], STRAW, 2.5);
  // Neck & face.
  c.fillStyle = HOSHI_SKIN;
  c.fillRect(108, 192, 24, 40);
  ell(c, 120, 150, 50, 52, HOSHI_SKIN);
  // Bangs.
  c.fillStyle = STRAW;
  c.beginPath();
  c.moveTo(70, 140);
  c.quadraticCurveTo(76, 96, 120, 96);
  c.quadraticCurveTo(166, 96, 170, 140);
  c.lineTo(156, 124);
  c.lineTo(146, 136);
  c.lineTo(132, 118);
  c.lineTo(120, 132);
  c.lineTo(108, 118);
  c.lineTo(94, 136);
  c.lineTo(84, 124);
  c.closePath();
  c.fill();
  // Wide straw hat.
  c.fillStyle = '#e0bf70';
  c.beginPath();
  c.moveTo(6, 108);
  c.quadraticCurveTo(120, 2, 234, 108);
  c.quadraticCurveTo(120, 128, 6, 108);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(150,110,50,0.5)';
  c.lineWidth = 1.5;
  for (let i = 1; i < 6; i++) curve(c, 6 + i * 6, 108 - i * 4, 120, 10 + i * 14, 234 - i * 6, 108 - i * 4, 'rgba(150,110,50,0.45)', 1.5);
  c.fillStyle = '#b04848';
  c.beginPath();
  c.moveTo(66, 82);
  c.quadraticCurveTo(120, 64, 174, 82);
  c.lineTo(176, 94);
  c.quadraticCurveTo(120, 76, 64, 94);
  c.closePath();
  c.fill();
  // Cheek stitches (she is, after all, a scarecrow).
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) line(c, [120 + s * (30 + i * 5), 172, 120 + s * (32 + i * 5), 178], STITCH, 1.5);
  }
}

function buttonEye(c: Ctx, x: number, y: number) {
  ell(c, x, y, 9, 9, '#2a1a2a');
  ell(c, x, y, 6.5, 6.5, '#4a3040');
  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) ell(c, x + dx, y + dy, 1.2, 1.2, '#efe3c8');
}

function drawHoshiko(c: Ctx, expr: string) {
  paperShadow(c, () => hoshikoBase(c));
  const ink = '#2a1a2a';
  switch (expr) {
    case 'happy':
      curve(c, 88, 156, 100, 144, 112, 156, ink, 3.5);
      curve(c, 128, 156, 140, 144, 152, 156, ink, 3.5);
      curve(c, 100, 178, 120, 198, 140, 178, STITCH, 3);
      for (let i = 0; i < 4; i++) line(c, [106 + i * 9, 182 + (i === 1 || i === 2 ? 5 : 0), 106 + i * 9, 190], STITCH, 1.5);
      break;
    case 'curious':
      buttonEye(c, 100, 154);
      buttonEye(c, 140, 154);
      line(c, [88, 136, 110, 138], ink, 2.5);
      line(c, [130, 132, 152, 128], ink, 2.5);
      ell(c, 122, 184, 4, 4, STITCH);
      break;
    case 'proud':
      curve(c, 88, 152, 100, 160, 112, 152, ink, 3.5);
      curve(c, 128, 152, 140, 160, 152, 152, ink, 3.5);
      curve(c, 104, 180, 120, 192, 136, 180, STITCH, 3);
      ell(c, 92, 170, 8, 4, 'rgba(240,120,130,0.4)');
      ell(c, 148, 170, 8, 4, 'rgba(240,120,130,0.4)');
      break;
    case 'determined':
      buttonEye(c, 100, 156);
      buttonEye(c, 140, 156);
      line(c, [86, 136, 112, 144], ink, 3.5);
      line(c, [128, 144, 154, 136], ink, 3.5);
      line(c, [104, 184, 136, 184], STITCH, 3);
      for (let i = 0; i < 4; i++) line(c, [108 + i * 8, 180, 108 + i * 8, 188], STITCH, 1.5);
      break;
    case 'hurt':
      line(c, [92, 148, 108, 160], ink, 3);
      line(c, [108, 148, 92, 160], ink, 3);
      line(c, [132, 148, 148, 160], ink, 3);
      line(c, [148, 148, 132, 160], ink, 3);
      line(c, [104, 186, 110, 182, 116, 186, 122, 182, 128, 186, 134, 182], STITCH, 2.5);
      ell(c, 160, 132, 4, 7, 'rgba(140,190,255,0.8)');
      break;
    case 'sad':
      buttonEye(c, 100, 158);
      buttonEye(c, 140, 158);
      line(c, [88, 138, 110, 132], ink, 2.5);
      line(c, [130, 132, 152, 138], ink, 2.5);
      curve(c, 108, 188, 120, 180, 132, 188, STITCH, 3);
      break;
    default:
      buttonEye(c, 100, 154);
      buttonEye(c, 140, 154);
      curve(c, 108, 182, 120, 188, 132, 182, STITCH, 3);
  }
}

const DRAW: Record<Speaker, (c: Ctx, expr: string) => void> = {
  sayo: drawSayo,
  hoshiko: drawHoshiko,
};

/** Renders a portrait into a canvas at the device pixel ratio. Cached per speaker/expression. */
const cache = new Map<string, HTMLCanvasElement>();

export function portraitCanvas(who: Speaker, expr: string): HTMLCanvasElement {
  const key = `${who}:${expr}`;
  let cv = cache.get(key);
  if (!cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv = document.createElement('canvas');
    cv.width = PORTRAIT_W * dpr;
    cv.height = PORTRAIT_H * dpr;
    const c = cv.getContext('2d')!;
    c.scale(dpr, dpr);
    DRAW[who](c, expr);
    cache.set(key, cv);
  }
  return cv;
}

/** Copy a cached portrait into a visible canvas element. */
export function paintPortrait(target: HTMLCanvasElement, who: Speaker, expr: string): void {
  const src = portraitCanvas(who, expr);
  if (target.width !== src.width) {
    target.width = src.width;
    target.height = src.height;
  }
  const c = target.getContext('2d')!;
  c.clearRect(0, 0, target.width, target.height);
  c.drawImage(src, 0, 0);
}
