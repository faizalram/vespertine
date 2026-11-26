import type { Speaker } from '../game/defs';

/**
 * Flat, paper-cut vector portraits (spec §8.3). Each portrait is a fixed bust;
 * expressions swap only eyes, brows and mouth. Drawn in a 240×320 box.
 */

/** Every expression each portrait can draw (anything else falls back to neutral). */
export const EXPRESSIONS: Record<Speaker, readonly string[]> = {
  sayo: ['neutral', 'tired', 'annoyed', 'soft', 'surprised', 'smirk'],
  ilse: ['neutral', 'grin', 'smug', 'annoyed', 'surprised', 'sad'],
  tessel: ['neutral', 'curious', 'smile', 'blank', 'sad', 'surprised'],
  wren: ['neutral', 'soft', 'wry', 'sad', 'stern', 'tired'],
  hoshiko: ['neutral', 'happy', 'curious', 'proud', 'determined', 'hurt', 'sad'],
  ondine: ['neutral', 'grin', 'sly', 'counting', 'offended', 'sincere', 'sad'],
  seraphine: ['neutral', 'gentle', 'smile', 'pleading', 'stern', 'sad', 'shocked'],
};

export const PORTRAIT_W = 240;
export const PORTRAIT_H = 320;

export const SPEAKER_NAMES: Record<Speaker, string> = {
  sayo: 'Sayo Kagari',
  ilse: 'Ilse Marrow',
  tessel: 'Tessel',
  wren: 'Sister Wren',
  hoshiko: 'Hoshiko Aze',
  ondine: 'Ondine Vesk',
  seraphine: 'Seraphine Lull',
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


// ─────────────────────────────── shared face parts ───────────────────────────────

type EyeKind = 'open' | 'half' | 'closed' | 'wide' | 'smile' | 'down';

function eyes(c: Ctx, xs: readonly number[], y: number, kind: EyeKind, skin: string, iris: readonly string[], ink: string) {
  xs.forEach((x, i) => {
    if (kind === 'closed' || kind === 'down') {
      curve(c, x - 11, y, x, y + (kind === 'closed' ? 7 : -4), x + 11, y, ink, 3);
      return;
    }
    if (kind === 'smile') {
      curve(c, x - 11, y + 3, x, y - 7, x + 11, y + 3, ink, 3.5);
      return;
    }
    const ry = kind === 'wide' ? 10 : 8;
    ell(c, x, y, 11, ry, '#fbf6ff');
    ell(c, x, y + 1, 6.5, ry - 1, iris[i % iris.length]);
    ell(c, x, y + 2, 3, 3.5, '#120c16');
    ell(c, x + 2.5, y - 2, 2, 2, '#ffffff');
    if (kind === 'half') {
      c.fillStyle = skin;
      c.fillRect(x - 13, y - 12, 26, 11);
      line(c, [x - 12, y - 1, x + 12, y - 1], ink, 3);
    } else {
      curve(c, x - 12, y - 3, x, y - 12 - (kind === 'wide' ? 3 : 0), x + 12, y - 3, ink, 3);
    }
  });
}

function brows(c: Ctx, y: number, tilt: number, ink: string, lift = 0) {
  line(c, [88, y + tilt - lift, 110, y - tilt - lift], ink, 2.5);
  line(c, [130, y - tilt - lift, 152, y + tilt - lift], ink, 2.5);
}

function bust(c: Ctx, robe: string, skin: string) {
  c.fillStyle = robe;
  c.beginPath();
  c.moveTo(20, 320);
  c.quadraticCurveTo(34, 244, 96, 226);
  c.lineTo(144, 226);
  c.quadraticCurveTo(206, 244, 220, 320);
  c.closePath();
  c.fill();
  c.fillStyle = skin;
  c.fillRect(108, 186, 24, 44);
  ell(c, 120, 142, 46, 54, skin);
}

// ─────────────────────────────── Ilse ───────────────────────────────

const ILSE_SKIN = '#f2d8c4';
const ILSE_HAIR = '#18203c';

function ilseBase(c: Ctx) {
  // Compass head peeking over her shoulder.
  line(c, [176, 320, 198, 150, 214, 320], '#c9a24a', 6);
  ell(c, 198, 150, 9, 9, '#ffd36a');
  bust(c, '#1c2446', ILSE_SKIN);
  // Gold-trimmed lapels.
  c.fillStyle = '#e0b04a';
  c.beginPath();
  c.moveTo(96, 226);
  c.lineTo(116, 300);
  c.lineTo(108, 300);
  c.lineTo(88, 232);
  c.closePath();
  c.moveTo(144, 226);
  c.lineTo(124, 300);
  c.lineTo(132, 300);
  c.lineTo(152, 232);
  c.closePath();
  c.fill();
  // Ink stains on the collar: she is always mid-map.
  ell(c, 70, 270, 6, 4, '#0c1024');
  ell(c, 80, 262, 3, 2, '#0c1024');
  // Short, choppy bob.
  c.fillStyle = ILSE_HAIR;
  c.beginPath();
  c.moveTo(70, 176);
  c.quadraticCurveTo(58, 80, 120, 78);
  c.quadraticCurveTo(184, 80, 170, 176);
  c.lineTo(160, 150);
  c.lineTo(162, 116);
  c.lineTo(148, 104);
  c.lineTo(132, 122);
  c.lineTo(122, 100);
  c.lineTo(104, 124);
  c.lineTo(92, 106);
  c.lineTo(78, 120);
  c.lineTo(80, 150);
  c.closePath();
  c.fill();
  // Goggles pushed up into her hair.
  line(c, [72, 100, 168, 100], '#6a5030', 5);
  for (const x of [102, 138]) {
    ell(c, x, 98, 15, 11, '#6a5030');
    ell(c, x, 98, 11, 8, '#ffd36a');
    ell(c, x + 3, 95, 3, 2, '#fff6d0');
  }
  // Pen tucked behind an ear.
  line(c, [164, 150, 186, 118], '#e0b04a', 3);
}

function drawIlse(c: Ctx, expr: string) {
  paperShadow(c, () => ilseBase(c));
  const ink = ILSE_HAIR;
  const iris = ['#3a4a8a'];
  const mouth = '#a0505a';
  switch (expr) {
    case 'grin':
      eyes(c, [100, 140], 150, 'smile', ILSE_SKIN, iris, ink);
      brows(c, 130, 0, ink, 3);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(106, 176);
      c.quadraticCurveTo(120, 194, 136, 174);
      c.closePath();
      c.fill();
      curve(c, 106, 176, 120, 194, 136, 174, mouth, 2.5);
      break;
    case 'smug':
      eyes(c, [100, 140], 150, 'half', ILSE_SKIN, iris, ink);
      line(c, [88, 130, 110, 131], ink, 2.5);
      line(c, [130, 126, 152, 122], ink, 2.5);
      curve(c, 108, 180, 124, 184, 136, 172, mouth, 2.5);
      break;
    case 'annoyed':
      eyes(c, [100, 140], 150, 'half', ILSE_SKIN, iris, ink);
      brows(c, 132, -4, ink);
      line(c, [110, 182, 130, 180], mouth, 2.5);
      break;
    case 'surprised':
      eyes(c, [100, 140], 150, 'wide', ILSE_SKIN, iris, ink);
      brows(c, 124, 1, ink, 4);
      ell(c, 120, 182, 5, 6, mouth);
      break;
    case 'sad':
      eyes(c, [100, 140], 152, 'down', ILSE_SKIN, iris, ink);
      brows(c, 132, 4, ink);
      curve(c, 110, 184, 120, 178, 130, 184, mouth, 2.5);
      break;
    default:
      eyes(c, [100, 140], 150, 'open', ILSE_SKIN, iris, ink);
      brows(c, 130, 0, ink);
      curve(c, 110, 179, 120, 183, 130, 179, mouth, 2.5);
  }
}

// ─────────────────────────────── Tessel ───────────────────────────────

const TESSEL_SKIN = '#f6f0ea';
const TESSEL_HAIR = '#5a4038';

function tesselBase(c: Ctx) {
  // Ringlets behind.
  c.fillStyle = TESSEL_HAIR;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(120 + s * (54 + i * 6), 180 + i * 34, 14, 22, s * 0.2, 0, Math.PI * 2);
      c.fill();
    }
  }
  bust(c, '#8a3b2a', TESSEL_SKIN);
  // Lace collar.
  c.fillStyle = '#f2ece4';
  for (let i = 0; i < 7; i++) ell(c, 90 + i * 10, 232, 8, 7, '#f2ece4');
  // Hair and a large rust bow.
  c.fillStyle = TESSEL_HAIR;
  c.beginPath();
  c.moveTo(72, 150);
  c.quadraticCurveTo(64, 82, 120, 80);
  c.quadraticCurveTo(176, 82, 168, 150);
  c.quadraticCurveTo(150, 104, 120, 104);
  c.quadraticCurveTo(90, 104, 72, 150);
  c.fill();
  c.fillStyle = '#b04848';
  c.beginPath();
  c.moveTo(120, 78);
  c.lineTo(78, 52);
  c.lineTo(84, 96);
  c.closePath();
  c.moveTo(120, 78);
  c.lineTo(162, 52);
  c.lineTo(156, 96);
  c.closePath();
  c.fill();
  ell(c, 120, 78, 9, 9, '#8a3030');
  // Porcelain hairline crack and jaw seam.
  line(c, [148, 108, 142, 128, 152, 140, 146, 152], 'rgba(110,90,90,0.55)', 1.5);
  curve(c, 82, 170, 120, 204, 158, 170, 'rgba(150,130,130,0.35)', 1.5);
  // Rosy painted cheeks.
  ell(c, 92, 168, 9, 5, 'rgba(230,120,130,0.35)');
  ell(c, 148, 168, 9, 5, 'rgba(230,120,130,0.35)');
}

function drawTessel(c: Ctx, expr: string) {
  paperShadow(c, () => tesselBase(c));
  const ink = '#3a2a2a';
  // One glass-blue eye, one amber: they were never a pair.
  const iris = ['#3a8ae0', '#e0a040'];
  const mouth = '#b05a60';
  switch (expr) {
    case 'curious':
      eyes(c, [100, 140], 148, 'wide', TESSEL_SKIN, iris, ink);
      line(c, [88, 128, 110, 126], ink, 2);
      line(c, [130, 122, 152, 120], ink, 2);
      ell(c, 120, 182, 3, 3, mouth);
      break;
    case 'smile':
      eyes(c, [100, 140], 148, 'open', TESSEL_SKIN, iris, ink);
      brows(c, 128, 0, ink);
      curve(c, 110, 178, 120, 186, 130, 178, mouth, 2.5);
      break;
    case 'blank':
      // Perfectly still: the doll face she wears when she is listening to her parts.
      eyes(c, [100, 140], 148, 'open', TESSEL_SKIN, ['#9a9aa8', '#9a9aa8'], ink);
      line(c, [114, 181, 126, 181], mouth, 2);
      break;
    case 'sad':
      eyes(c, [100, 140], 150, 'half', TESSEL_SKIN, iris, ink);
      brows(c, 130, 4, ink);
      curve(c, 112, 184, 120, 180, 128, 184, mouth, 2.5);
      ell(c, 142, 166, 3, 5, 'rgba(140,190,255,0.75)');
      break;
    case 'surprised':
      eyes(c, [100, 140], 148, 'wide', TESSEL_SKIN, iris, ink);
      brows(c, 124, 0, ink, 4);
      ell(c, 120, 183, 4, 5, mouth);
      break;
    default:
      eyes(c, [100, 140], 148, 'open', TESSEL_SKIN, iris, ink);
      brows(c, 128, 0, ink);
      line(c, [114, 180, 126, 180], mouth, 2.5);
  }
}

// ─────────────────────────────── Wren ───────────────────────────────

const WREN_SKIN = '#efdccb';
const WREN_VEIL = '#1e2a30';

function wrenBase(c: Ctx) {
  // The oar-scythe's blade over her shoulder.
  line(c, [36, 320, 40, 60], '#4a3a30', 7);
  c.fillStyle = '#9ad8d0';
  c.beginPath();
  c.moveTo(40, 60);
  c.quadraticCurveTo(100, 30, 130, 64);
  c.quadraticCurveTo(90, 52, 42, 84);
  c.closePath();
  c.fill();
  // Veil falling behind.
  c.fillStyle = WREN_VEIL;
  c.beginPath();
  c.moveTo(62, 140);
  c.quadraticCurveTo(58, 62, 120, 58);
  c.quadraticCurveTo(182, 62, 178, 140);
  c.lineTo(200, 300);
  c.lineTo(40, 300);
  c.closePath();
  c.fill();
  bust(c, '#e8e2d6', WREN_SKIN);
  c.fillStyle = '#2aa89a';
  c.fillRect(114, 236, 12, 84);
  // Bell on a cord.
  line(c, [150, 236, 166, 276], '#6a5030', 2);
  c.fillStyle = '#c9a24a';
  c.beginPath();
  c.moveTo(166, 272);
  c.quadraticCurveTo(182, 272, 184, 300);
  c.lineTo(148, 300);
  c.quadraticCurveTo(150, 272, 166, 272);
  c.fill();
  ell(c, 166, 302, 4, 4, '#8a6a2a');
  // Wimple band framing the face.
  c.fillStyle = '#e8e2d6';
  c.beginPath();
  c.moveTo(72, 120);
  c.quadraticCurveTo(120, 84, 168, 120);
  c.lineTo(166, 108);
  c.quadraticCurveTo(120, 72, 74, 108);
  c.closePath();
  c.fill();
  // A few grey strands escaping the veil.
  line(c, [84, 118, 80, 150], '#b8b0b8', 2);
  line(c, [156, 118, 162, 146], '#b8b0b8', 2);
}

function drawWren(c: Ctx, expr: string) {
  paperShadow(c, () => wrenBase(c));
  const ink = '#2a2020';
  const iris = ['#2a8a80'];
  const mouth = '#9a5050';
  switch (expr) {
    case 'soft':
      eyes(c, [100, 140], 150, 'closed', WREN_SKIN, iris, ink);
      brows(c, 132, 1, ink);
      curve(c, 110, 178, 120, 184, 130, 178, mouth, 2.5);
      break;
    case 'wry':
      eyes(c, [100, 140], 150, 'half', WREN_SKIN, iris, ink);
      line(c, [88, 131, 110, 131], ink, 2.5);
      line(c, [130, 128, 152, 125], ink, 2.5);
      curve(c, 108, 181, 122, 183, 134, 175, mouth, 2.5);
      break;
    case 'sad':
      eyes(c, [100, 140], 152, 'down', WREN_SKIN, iris, ink);
      brows(c, 132, 5, ink);
      curve(c, 110, 184, 120, 179, 130, 184, mouth, 2.5);
      break;
    case 'stern':
      eyes(c, [100, 140], 150, 'open', WREN_SKIN, iris, ink);
      brows(c, 132, -4, ink);
      line(c, [110, 181, 130, 181], mouth, 3);
      break;
    case 'tired':
      eyes(c, [100, 140], 151, 'half', WREN_SKIN, iris, ink);
      brows(c, 133, 2, ink);
      line(c, [112, 181, 128, 181], mouth, 2.5);
      // Faint lines under the eyes: a long career of goodbyes.
      curve(c, 92, 164, 100, 167, 108, 164, 'rgba(120,90,90,0.35)', 1.5);
      curve(c, 132, 164, 140, 167, 148, 164, 'rgba(120,90,90,0.35)', 1.5);
      break;
    default:
      eyes(c, [100, 140], 150, 'open', WREN_SKIN, iris, ink);
      brows(c, 132, 0, ink);
      curve(c, 111, 180, 120, 183, 129, 180, mouth, 2.5);
  }
}

// ─────────────────────────────── Ondine ───────────────────────────────

const ONDINE_SKIN = '#e8c8b0';
const ONDINE_HAIR = '#2a6a6a';

function ondineBase(c: Ctx) {
  // Hair drifting as if underwater.
  c.fillStyle = ONDINE_HAIR;
  c.beginPath();
  c.moveTo(60, 150);
  c.bezierCurveTo(20, 120, 36, 240, 10, 300);
  c.lineTo(230, 300);
  c.bezierCurveTo(204, 240, 220, 120, 180, 150);
  c.quadraticCurveTo(170, 80, 120, 80);
  c.quadraticCurveTo(70, 80, 60, 150);
  c.fill();
  // Teal merchant coat with gold buttons, coin necklace.
  bust(c, '#1f5a58', ONDINE_SKIN);
  c.fillStyle = '#e0b04a';
  for (let i = 0; i < 3; i++) ell(c, 120, 258 + i * 18, 4, 4, '#e0b04a');
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.2 + (i / 8) * 0.6);
    ell(c, 120 + Math.cos(a) * 34, 214 + Math.sin(a) * 22, 6, 6, '#f0c860');
    ell(c, 120 + Math.cos(a) * 34, 214 + Math.sin(a) * 22, 3, 3, '#b8862a');
  }
  // Bangs.
  c.fillStyle = ONDINE_HAIR;
  c.beginPath();
  c.moveTo(72, 130);
  c.quadraticCurveTo(80, 92, 120, 92);
  c.quadraticCurveTo(162, 92, 168, 130);
  c.quadraticCurveTo(140, 110, 120, 116);
  c.quadraticCurveTo(96, 108, 72, 130);
  c.fill();
  // A wide merchant's hat with a feather and a dangling price tag.
  c.fillStyle = '#16302e';
  c.beginPath();
  c.ellipse(120, 92, 104, 22, -0.06, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(72, 92);
  c.quadraticCurveTo(76, 30, 124, 30);
  c.quadraticCurveTo(170, 32, 168, 90);
  c.closePath();
  c.fill();
  c.fillStyle = '#e0b04a';
  c.fillRect(74, 76, 94, 8);
  curve(c, 150, 70, 196, 20, 214, 40, '#e8e0c8', 5);
  line(c, [206, 98, 214, 128], '#c9a24a', 1.5);
  c.fillStyle = '#efe4c8';
  c.fillRect(204, 126, 20, 14);
  c.fillStyle = '#7a3020';
  c.font = 'bold 10px Georgia, serif';
  c.fillText('¤', 210, 137);
  // Bubbles drifting upward: she lives under the lake.
  for (const [x, y, r] of [[40, 200, 5], [30, 170, 3], [206, 220, 4], [214, 190, 2.5]] as const) {
    c.strokeStyle = 'rgba(200,255,250,0.6)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
  }
}

function drawOndine(c: Ctx, expr: string) {
  paperShadow(c, () => ondineBase(c));
  const ink = '#1a2a2a';
  const iris = ['#c9a24a'];
  const mouth = '#a04848';
  const goldTooth = () => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(104, 176);
    c.quadraticCurveTo(120, 196, 138, 174);
    c.closePath();
    c.fill();
    c.fillStyle = '#f0c040';
    c.fillRect(124, 177, 6, 6);
    curve(c, 104, 176, 120, 196, 138, 174, mouth, 2.5);
  };
  switch (expr) {
    case 'grin':
      eyes(c, [100, 140], 148, 'smile', ONDINE_SKIN, iris, ink);
      brows(c, 128, -1, ink, 3);
      goldTooth();
      break;
    case 'sly':
      eyes(c, [100, 140], 148, 'half', ONDINE_SKIN, iris, ink);
      line(c, [88, 130, 110, 128], ink, 2.5);
      line(c, [130, 124, 152, 122], ink, 2.5);
      curve(c, 106, 180, 122, 184, 136, 172, mouth, 2.5);
      break;
    case 'counting':
      eyes(c, [100, 140], 148, 'down', ONDINE_SKIN, iris, ink);
      brows(c, 130, 0, ink);
      curve(c, 112, 180, 120, 184, 128, 180, mouth, 2.5);
      // A monocle, for appraisals.
      c.strokeStyle = '#e0b04a';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(140, 148, 15, 0, Math.PI * 2);
      c.stroke();
      line(c, [154, 154, 166, 200], '#e0b04a', 1.2);
      break;
    case 'offended':
      eyes(c, [100, 140], 148, 'wide', ONDINE_SKIN, iris, ink);
      brows(c, 128, -5, ink);
      ell(c, 120, 182, 7, 5, mouth);
      break;
    case 'sincere':
      eyes(c, [100, 140], 150, 'open', ONDINE_SKIN, iris, ink);
      brows(c, 130, 3, ink);
      line(c, [112, 181, 128, 181], mouth, 2.5);
      break;
    case 'sad':
      eyes(c, [100, 140], 151, 'down', ONDINE_SKIN, iris, ink);
      brows(c, 131, 5, ink);
      curve(c, 110, 184, 120, 179, 130, 184, mouth, 2.5);
      ell(c, 92, 170, 3, 5, 'rgba(160,220,255,0.75)');
      break;
    default:
      eyes(c, [100, 140], 148, 'open', ONDINE_SKIN, iris, ink);
      brows(c, 130, 0, ink);
      curve(c, 108, 179, 120, 186, 132, 179, mouth, 2.5);
  }
}

// ─────────────────────────────── Seraphine ───────────────────────────────

const SERA_SKIN = '#f3e2d4';
const SERA_HAIR = '#e8e4dc';

function seraphineBase(c: Ctx) {
  // Long pale hair, nearly white, like a page.
  c.fillStyle = SERA_HAIR;
  c.beginPath();
  c.moveTo(66, 130);
  c.quadraticCurveTo(58, 66, 120, 62);
  c.quadraticCurveTo(182, 66, 174, 130);
  c.lineTo(198, 320);
  c.lineTo(42, 320);
  c.closePath();
  c.fill();
  // Grey-blue robe with ink stains and a quill tucked in the collar.
  bust(c, '#4a5a72', SERA_SKIN);
  c.fillStyle = '#efe8dc';
  c.beginPath();
  c.moveTo(96, 226);
  c.lineTo(120, 262);
  c.lineTo(144, 226);
  c.closePath();
  c.fill();
  ell(c, 160, 284, 8, 5, '#1c2030');
  ell(c, 70, 296, 5, 3, '#1c2030');
  c.fillStyle = '#f6f2ea';
  c.beginPath();
  c.moveTo(150, 240);
  c.quadraticCurveTo(190, 190, 214, 150);
  c.quadraticCurveTo(196, 196, 158, 248);
  c.closePath();
  c.fill();
  // An open book floating at her shoulder, its pages blank.
  c.save();
  c.translate(40, 214);
  c.rotate(-0.25);
  c.fillStyle = '#efe8dc';
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(20, -8, 38, 0);
  c.lineTo(38, 30);
  c.quadraticCurveTo(20, 22, 0, 30);
  c.closePath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(-20, -8, -38, 0);
  c.lineTo(-38, 30);
  c.quadraticCurveTo(-20, 22, 0, 30);
  c.closePath();
  c.fill();
  line(c, [0, 0, 0, 30], '#a09888', 1.2);
  c.restore();
  // Bangs, parted.
  c.fillStyle = SERA_HAIR;
  c.beginPath();
  c.moveTo(70, 140);
  c.quadraticCurveTo(70, 88, 118, 86);
  c.lineTo(108, 128);
  c.lineTo(96, 112);
  c.closePath();
  c.moveTo(170, 140);
  c.quadraticCurveTo(170, 88, 122, 86);
  c.lineTo(134, 126);
  c.lineTo(146, 110);
  c.closePath();
  c.fill();
  // Round spectacles.
  c.strokeStyle = '#8a7a5a';
  c.lineWidth = 2;
  for (const x of [100, 140]) {
    c.beginPath();
    c.arc(x, 149, 15, 0, Math.PI * 2);
    c.stroke();
  }
  line(c, [115, 147, 125, 147], '#8a7a5a', 2);
}

function drawSeraphine(c: Ctx, expr: string) {
  paperShadow(c, () => seraphineBase(c));
  const ink = '#4a4038';
  const iris = ['#6a7a9a'];
  const mouth = '#a06060';
  switch (expr) {
    case 'gentle':
      eyes(c, [100, 140], 150, 'closed', SERA_SKIN, iris, ink);
      brows(c, 128, 2, ink, 2);
      curve(c, 112, 180, 120, 184, 128, 180, mouth, 2.5);
      break;
    case 'smile':
      eyes(c, [100, 140], 150, 'smile', SERA_SKIN, iris, ink);
      brows(c, 128, 1, ink, 2);
      curve(c, 108, 179, 120, 188, 132, 179, mouth, 2.5);
      break;
    case 'pleading':
      eyes(c, [100, 140], 150, 'wide', SERA_SKIN, iris, ink);
      brows(c, 128, 6, ink);
      curve(c, 112, 183, 120, 179, 128, 183, mouth, 2.5);
      break;
    case 'stern':
      eyes(c, [100, 140], 150, 'half', SERA_SKIN, iris, ink);
      brows(c, 130, -4, ink);
      line(c, [112, 181, 128, 181], mouth, 2.5);
      break;
    case 'sad':
      eyes(c, [100, 140], 152, 'down', SERA_SKIN, iris, ink);
      brows(c, 130, 5, ink);
      curve(c, 110, 184, 120, 179, 130, 184, mouth, 2.5);
      break;
    case 'shocked':
      eyes(c, [100, 140], 149, 'wide', SERA_SKIN, iris, ink);
      brows(c, 122, 2, ink, 4);
      ell(c, 120, 183, 4, 5, mouth);
      break;
    default:
      eyes(c, [100, 140], 150, 'open', SERA_SKIN, iris, ink);
      brows(c, 129, 1, ink);
      curve(c, 112, 180, 120, 183, 128, 180, mouth, 2.5);
  }
}

const DRAW: Record<Speaker, (c: Ctx, expr: string) => void> = {
  sayo: drawSayo,
  ilse: drawIlse,
  tessel: drawTessel,
  wren: drawWren,
  hoshiko: drawHoshiko,
  ondine: drawOndine,
  seraphine: drawSeraphine,
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
