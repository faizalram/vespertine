import type { Speaker } from '../game/defs';
import {
  blush, brow, eye, ell, faceShape, linGrad, lock, mouth, qcurve, radGrad, stroke, sweat, talkingMouth, taper, tear,
  type Ctx, type EyeKind, type EyeSpec, type MouthKind,
} from './art/kit';

/**
 * Vector portraits (spec §8.3). Each character is a static base (hair, clothes,
 * face shape) plus a face described by eyes / brows / mouth. Separating the face
 * lets any expression blink and talk: see LivePortrait.
 */

export const PORTRAIT_W = 240;
export const PORTRAIT_H = 320;

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

export const SPEAKER_NAMES: Record<Speaker, string> = {
  sayo: 'Sayo Kagari',
  ilse: 'Ilse Marrow',
  tessel: 'Tessel',
  wren: 'Sister Wren',
  hoshiko: 'Hoshiko Aze',
  ondine: 'Ondine Vesk',
  seraphine: 'Seraphine Lull',
};

interface Face {
  eyes: EyeKind;
  /** Brow tilt; a pair gives each brow its own tilt (raised eyebrow). */
  brow: number | readonly [number, number];
  browLift?: number;
  mouth: MouthKind;
  blush?: boolean;
  tear?: boolean;
  sweat?: boolean;
  gaze?: number;
  extra?: (c: Ctx) => void;
}

interface Art {
  base(c: Ctx): void;
  /** Drawn over the face (spectacles). */
  overlay?(c: Ctx): void;
  eye: EyeSpec | 'button';
  /** Iris override for the right eye (Tessel's mismatched eyes). */
  eyeR?: Partial<EyeSpec>;
  eyeY: number;
  eyeX: readonly [number, number];
  browY: number;
  browLen: number;
  browColor: string;
  mouthY: number;
  mouthColor: string;
  /** Hoshiko's stitched mouth. */
  stitches?: boolean;
  faces: Record<string, Face>;
}

// ─────────────────────────────── shared body parts ───────────────────────────────

function shoulders(c: Ctx, top: string, bottom: string): void {
  c.beginPath();
  c.moveTo(12, 320);
  c.bezierCurveTo(18, 262, 50, 240, 96, 232);
  c.lineTo(144, 232);
  c.bezierCurveTo(190, 240, 222, 262, 228, 320);
  c.closePath();
  c.fillStyle = linGrad(c, 0, 230, 0, 320, [[0, top], [1, bottom]]);
  c.fill();
}

function neck(c: Ctx, skin: string, shade: string): void {
  c.beginPath();
  c.moveTo(109, 182);
  c.lineTo(131, 182);
  c.lineTo(134, 236);
  c.lineTo(106, 236);
  c.closePath();
  c.fillStyle = skin;
  c.fill();
  // Shadow under the jaw.
  c.beginPath();
  c.moveTo(107, 190);
  c.quadraticCurveTo(120, 212, 133, 190);
  c.lineTo(133, 182);
  c.lineTo(107, 182);
  c.closePath();
  c.fillStyle = shade;
  c.fill();
}

function face(c: Ctx, skin: string, shadeCol: string, halfW = 47): void {
  faceShape(c, 120, 90, halfW, 198, linGrad(c, 0, 90, 0, 200, [[0, skin], [1, shadeCol]]));
  // Soft warmth on the cheeks.
  ell(c, 120, 168, halfW * 0.85, 22, radGrad(c, 120, 168, 0, halfW * 0.85, [[0, 'rgba(255,190,180,0.18)'], [1, 'rgba(255,190,180,0)']]));
}

function nose(c: Ctx, shade: string): void {
  qcurve(c, 121, 163, 124, 168, 120, 170, shade, 1.6);
}

/** A glossy band across the crown of the hair. */
function angelRing(c: Ctx, y: number, w: number, color: string): void {
  c.globalAlpha = 0.55;
  for (let k = 0; k < 4; k++) {
    const x0 = 120 - w + k * (w / 2) + 4;
    taper(c, x0, y + Math.abs(k - 1.5) * 3, x0 + w / 4, y - 4 + Math.abs(k - 1.5) * 2, x0 + w / 2 - 6, y + Math.abs(k - 1.5) * 3, 4, color);
  }
  c.globalAlpha = 1;
}

function paperShadow(c: Ctx, draw: () => void): void {
  c.save();
  c.translate(5, 5);
  c.globalAlpha = 0.3;
  c.filter = 'brightness(0)';
  draw();
  c.restore();
  draw();
}

// ─────────────────────────────── Sayo ───────────────────────────────

const SAYO_HAIR = '#1b1424';
const SAYO_SHEEN = '#3a2f55';
const SAYO_SKIN = '#f7e3d6';
const SAYO_SKIN_SH = '#ecc9b8';

function sayoBase(c: Ctx): void {
  // Long straight hair behind her.
  c.beginPath();
  c.moveTo(66, 140);
  c.bezierCurveTo(56, 52, 184, 52, 174, 140);
  c.bezierCurveTo(186, 210, 196, 260, 204, 320);
  c.lineTo(36, 320);
  c.bezierCurveTo(44, 260, 54, 210, 66, 140);
  c.fillStyle = linGrad(c, 0, 60, 0, 320, [[0, SAYO_SHEEN], [0.35, SAYO_HAIR], [1, '#120e1a']]);
  c.fill();
  // Kimono: indigo with a white collar crossed left over right, amber obi.
  shoulders(c, '#352b62', '#211a40');
  c.fillStyle = '#e9e4f2';
  c.beginPath();
  c.moveTo(146, 230);
  c.lineTo(112, 300);
  c.lineTo(124, 320);
  c.lineTo(156, 236);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(94, 230);
  c.lineTo(128, 302);
  c.lineTo(114, 320);
  c.lineTo(84, 238);
  c.closePath();
  c.fillStyle = '#f6f2fa';
  c.fill();
  stroke(c, [97, 234, 127, 296], '#f0a040', 1.6);
  c.fillStyle = linGrad(c, 0, 300, 0, 320, [[0, '#f2a848'], [1, '#c87a24']]);
  c.fillRect(30, 302, 180, 18);
  stroke(c, [30, 310, 210, 310], '#8a4a1a', 1.2);
  // Folds in the sleeves.
  c.globalAlpha = 0.25;
  qcurve(c, 40, 300, 54, 270, 82, 254, '#0e0a20', 3);
  qcurve(c, 200, 300, 186, 270, 158, 254, '#0e0a20', 3);
  c.globalAlpha = 1;
  neck(c, SAYO_SKIN, SAYO_SKIN_SH);
  face(c, SAYO_SKIN, SAYO_SKIN_SH);
  nose(c, '#d9a898');
  // Long side locks falling over the shoulders.
  const hairFill = linGrad(c, 0, 100, 0, 280, [[0, SAYO_HAIR], [1, '#140f1c']]);
  lock(c, 72, 116, 60, 278, 24, -8, hairFill);
  lock(c, 84, 122, 86, 236, 14, 6, hairFill);
  lock(c, 168, 116, 180, 278, 24, 8, hairFill);
  lock(c, 156, 122, 154, 236, 14, -6, hairFill);
  // Crown and straight-cut bangs, a few strands out of place (she does not fuss).
  const capG = linGrad(c, 0, 56, 0, 142, [[0, SAYO_SHEEN], [0.45, SAYO_HAIR], [1, SAYO_HAIR]]);
  c.beginPath();
  c.moveTo(70, 132);
  c.bezierCurveTo(62, 54, 178, 54, 170, 132);
  c.lineTo(70, 132);
  c.fillStyle = capG;
  c.fill();
  const bangs: Array<[number, number, number, number, number, number]> = [
    [86, 96, 74, 140, 20, -5], [100, 92, 92, 134, 18, -3], [112, 92, 106, 136, 17, 2],
    [124, 92, 122, 138, 17, -2], [136, 92, 138, 134, 18, 3], [148, 94, 152, 138, 19, 4], [158, 98, 166, 140, 18, 5],
  ];
  for (const [rx, ry, tx, ty, w, b] of bangs) lock(c, rx, ry, tx, ty, w, b, capG);
  taper(c, 128, 94, 140, 116, 132, 148, 3, SAYO_HAIR); // one stray strand
  angelRing(c, 88, 38, '#5a4c80');
  // Amber hairpin with a tiny lantern charm, its glow on her hair.
  ell(c, 186, 70, 26, 26, radGrad(c, 186, 70, 0, 26, [[0, 'rgba(255,190,90,0.35)'], [1, 'rgba(255,170,60,0)']]));
  taper(c, 146, 100, 166, 84, 190, 66, 5, '#e89a3a');
  ell(c, 191, 65, 5, 5, '#ffd27a');
  stroke(c, [191, 70, 193, 88], '#6a4a2a', 1);
  c.fillStyle = '#ffd38a';
  c.fillRect(188, 88, 10, 12);
  c.fillStyle = '#8a4a1a';
  c.fillRect(187, 87, 12, 2);
  c.fillRect(187, 99, 12, 2);
}

const SAYO: Art = {
  base: sayoBase,
  eye: { w: 33, h: 29, iris: '#e5a040', irisDark: '#5e2f10', lash: SAYO_HAIR, skin: SAYO_SKIN, style: 'tired' },
  eyeY: 152,
  eyeX: [101, 139],
  browY: 129,
  browLen: 24,
  browColor: SAYO_HAIR,
  mouthY: 181,
  mouthColor: '#a85a62',
  faces: {
    neutral: { eyes: 'open', brow: 0, mouth: 'neutral' },
    tired: { eyes: 'half', brow: 0.25, mouth: 'flat', gaze: -0.3 },
    annoyed: { eyes: 'half', brow: -0.6, mouth: 'frown', gaze: 0.4 },
    soft: { eyes: 'closed', brow: 0.2, mouth: 'smile', blush: true },
    surprised: { eyes: 'wide', brow: 0.5, browLift: 4, mouth: 'o' },
    smirk: { eyes: 'half', brow: [0.1, -0.3], mouth: 'smirk', gaze: 0.5 },
  },
};

// ─────────────────────────────── Ilse ───────────────────────────────

const ILSE_HAIR = '#1d2850';
const ILSE_SHEEN = '#3a4c8a';
const ILSE_SKIN = '#f5dccb';
const ILSE_SKIN_SH = '#e8c2ae';

function ilseBase(c: Ctx): void {
  // Her great drafting compass, slung behind one shoulder.
  stroke(c, [176, 320, 204, 132], '#b8902e', 7);
  stroke(c, [204, 132, 236, 320], '#d9b04a', 7);
  ell(c, 204, 132, 10, 10, '#f0cc60');
  ell(c, 204, 132, 4, 4, '#8a6a20');
  // Short choppy bob, behind.
  c.beginPath();
  c.moveTo(68, 150);
  c.bezierCurveTo(58, 62, 182, 62, 172, 150);
  c.lineTo(176, 206);
  c.lineTo(164, 196);
  c.lineTo(160, 212);
  c.lineTo(80, 212);
  c.lineTo(76, 196);
  c.lineTo(64, 206);
  c.closePath();
  c.fillStyle = linGrad(c, 0, 70, 0, 212, [[0, ILSE_SHEEN], [1, '#141c3a']]);
  c.fill();
  // Navy coat with gold piping and a high collar.
  shoulders(c, '#25305e', '#161d3c');
  c.fillStyle = '#1a2244';
  c.beginPath();
  c.moveTo(92, 232);
  c.lineTo(78, 262);
  c.lineTo(112, 246);
  c.closePath();
  c.moveTo(148, 232);
  c.lineTo(162, 262);
  c.lineTo(128, 246);
  c.closePath();
  c.fill();
  stroke(c, [92, 232, 78, 262, 112, 246], '#e0b04a', 2);
  stroke(c, [148, 232, 162, 262, 128, 246], '#e0b04a', 2);
  stroke(c, [120, 250, 120, 320], '#e0b04a', 2);
  for (let k = 0; k < 3; k++) ell(c, 128, 264 + k * 18, 3.5, 3.5, '#f0cc60');
  // Ink everywhere. She is always mid-map.
  ell(c, 64, 286, 7, 4, '#0c1024');
  ell(c, 74, 278, 3, 2, '#0c1024');
  ell(c, 178, 300, 4, 3, '#0c1024');
  neck(c, ILSE_SKIN, ILSE_SKIN_SH);
  face(c, ILSE_SKIN, ILSE_SKIN_SH, 45);
  nose(c, '#d29e8a');
  // Freckles across her nose.
  for (const [x, y] of [[104, 168], [109, 172], [99, 173], [113, 167], [131, 168], [136, 172], [141, 173], [127, 167]] as const) {
    ell(c, x, y, 1.3, 1.1, 'rgba(170,100,70,0.55)');
  }
  // Choppy side hair to the jaw.
  const hf = linGrad(c, 0, 100, 0, 210, [[0, ILSE_HAIR], [1, '#141c3a']]);
  lock(c, 74, 130, 68, 210, 18, -4, hf);
  lock(c, 86, 136, 84, 196, 12, 3, hf);
  lock(c, 166, 130, 174, 210, 18, 4, hf);
  lock(c, 154, 136, 158, 192, 12, -3, hf);
  // Side-swept bangs falling to the left.
  const capG = linGrad(c, 0, 60, 0, 146, [[0, ILSE_SHEEN], [0.45, ILSE_HAIR], [1, ILSE_HAIR]]);
  c.beginPath();
  c.moveTo(70, 134);
  c.bezierCurveTo(62, 60, 178, 60, 170, 134);
  c.lineTo(70, 134);
  c.fillStyle = capG;
  c.fill();
  const bangs: Array<[number, number, number, number, number, number]> = [
    [150, 96, 168, 136, 18, 4], [138, 92, 148, 140, 20, 6], [124, 92, 122, 144, 22, 8],
    [108, 94, 96, 146, 22, 9], [94, 98, 76, 140, 20, 6],
  ];
  for (const [rx, ry, tx, ty, w, b] of bangs) lock(c, rx, ry, tx, ty, w, b, capG);
  // The cowlick that will not lie down.
  lock(c, 122, 70, 146, 34, 9, -9, ILSE_SHEEN);
  angelRing(c, 92, 36, '#5a6eb0');
  // Goggles pushed up into her hair.
  stroke(c, [70, 102, 170, 100], '#5a3e24', 6);
  for (const x of [102, 138]) {
    ell(c, x, 98, 15, 12, '#c9a04a');
    ell(c, x, 98, 11.5, 9, linGrad(c, x, 88, x, 108, [[0, '#ffe2a0'], [1, '#d08a2a']]));
    ell(c, x - 4, 94, 4, 2.5, 'rgba(255,255,255,0.85)', -0.4);
  }
  // Pen tucked behind her ear.
  taper(c, 164, 156, 176, 134, 190, 112, 4.5, '#e0b04a');
  ell(c, 190, 112, 2.5, 2.5, '#8a6a20');
}

const ILSE: Art = {
  base: ilseBase,
  eye: { w: 33, h: 30, iris: '#5078e8', irisDark: '#18225a', lash: '#141a34', skin: ILSE_SKIN, style: 'sharp' },
  eyeY: 152,
  eyeX: [101, 139],
  browY: 128,
  browLen: 25,
  browColor: '#141a34',
  mouthY: 181,
  mouthColor: '#a85a62',
  faces: {
    neutral: { eyes: 'open', brow: 0, mouth: 'smile' },
    grin: { eyes: 'happy', brow: 0.05, browLift: 3, mouth: 'fang' },
    smug: { eyes: 'half', brow: [0.15, -0.35], mouth: 'smirk', gaze: 0.5 },
    annoyed: { eyes: 'half', brow: -0.7, mouth: 'flat', gaze: -0.4 },
    surprised: { eyes: 'wide', brow: 0.5, browLift: 5, mouth: 'o' },
    sad: { eyes: 'down', brow: 0.6, mouth: 'frown' },
  },
};

// ─────────────────────────────── Tessel ───────────────────────────────

const TESSEL_HAIR = '#6a4a3e';
const TESSEL_SHEEN = '#8e6a5a';
const TESSEL_SKIN = '#fbf5f0';
const TESSEL_SKIN_SH = '#eee2da';

function ringlet(c: Ctx, x: number, y0: number, n: number, r: number): void {
  for (let i = 0; i < n; i++) {
    const y = y0 + i * r * 1.5;
    const s = i % 2 ? 1 : -1;
    ell(c, x + s * 2, y, r, r * 0.9, linGrad(c, x, y - r, x, y + r, [[0, TESSEL_SHEEN], [1, TESSEL_HAIR]]));
    qcurve(c, x - r * 0.6, y - r * 0.2, x, y - r * 0.8, x + r * 0.6, y - r * 0.2, 'rgba(255,230,210,0.35)', 1.5);
  }
}

function tesselBase(c: Ctx): void {
  // Ringlets behind her shoulders.
  for (const s of [-1, 1]) ringlet(c, 120 + s * 66, 160, 6, 15);
  c.beginPath();
  c.moveTo(68, 150);
  c.bezierCurveTo(60, 58, 180, 58, 172, 150);
  c.lineTo(68, 150);
  c.fillStyle = TESSEL_HAIR;
  c.fill();
  // Rust dress, white lace collar, a music-box key for a brooch.
  shoulders(c, '#9a4430', '#6e2a1c');
  for (let k = 0; k < 9; k++) ell(c, 86 + k * 8.5, 238 + Math.sin((k / 8) * Math.PI) * 6, 7, 6, '#f6f0e8');
  for (let k = 0; k < 9; k++) ell(c, 86 + k * 8.5, 238 + Math.sin((k / 8) * Math.PI) * 6, 2, 2, '#e0d6ca');
  ell(c, 120, 262, 9, 11, '#d9b06a');
  ell(c, 120, 262, 6, 8, '#f3ead8');
  stroke(c, [120, 256, 120, 268], '#8a6a3a', 2);
  stroke(c, [116, 266, 124, 266], '#8a6a3a', 2);
  // Porcelain neck, with the ring where it joins her body.
  neck(c, TESSEL_SKIN, TESSEL_SKIN_SH);
  qcurve(c, 104, 222, 120, 228, 136, 222, 'rgba(140,120,120,0.45)', 1.4);
  face(c, TESSEL_SKIN, TESSEL_SKIN_SH, 44);
  // Painted cheeks and the faint seam at her jaw.
  ell(c, 94, 174, 9, 8, 'rgba(240,120,140,0.32)');
  ell(c, 146, 174, 9, 8, 'rgba(240,120,140,0.32)');
  qcurve(c, 82, 170, 120, 214, 158, 170, 'rgba(160,140,140,0.25)', 1.2);
  qcurve(c, 121, 164, 123, 168, 120, 169, '#d8c4bc', 1.4);
  // The hairline crack at her temple.
  stroke(c, [150, 112, 146, 124, 154, 134, 149, 146], 'rgba(110,90,90,0.55)', 1.3);
  // Doll-blunt bangs.
  c.beginPath();
  c.moveTo(70, 132);
  c.bezierCurveTo(62, 56, 178, 56, 170, 132);
  for (let k = 0; k <= 8; k++) c.lineTo(170 - k * 12.5, 132 + (k % 2 ? 3 : 0));
  c.closePath();
  c.fillStyle = linGrad(c, 0, 60, 0, 134, [[0, TESSEL_SHEEN], [1, TESSEL_HAIR]]);
  c.fill();
  angelRing(c, 88, 36, '#b08a78');
  // Ringlets framing her face.
  ringlet(c, 72, 126, 5, 11);
  ringlet(c, 168, 126, 5, 11);
  // Her great rust bow.
  c.fillStyle = '#b84a48';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(120, 64);
    c.bezierCurveTo(120 + s * 30, 30, 120 + s * 52, 46, 120 + s * 44, 80);
    c.bezierCurveTo(120 + s * 30, 84, 120 + s * 14, 74, 120, 64);
    c.fill();
  }
  c.globalAlpha = 0.35;
  qcurve(c, 108, 56, 96, 46, 84, 52, '#ffffff', 2.5);
  qcurve(c, 132, 56, 144, 46, 156, 52, '#ffffff', 2.5);
  c.globalAlpha = 1;
  ell(c, 120, 66, 10, 9, '#8a3030');
}

const TESSEL: Art = {
  base: tesselBase,
  eye: { w: 33, h: 32, iris: '#4a9ae8', irisDark: '#163a6a', lash: '#3a2a2a', skin: TESSEL_SKIN, style: 'doll' },
  eyeR: { iris: '#e8a640', irisDark: '#6a3a10' },
  eyeY: 151,
  eyeX: [101, 139],
  browY: 128,
  browLen: 22,
  browColor: '#5a4038',
  mouthY: 181,
  mouthColor: '#c06070',
  faces: {
    neutral: { eyes: 'open', brow: 0, mouth: 'flat' },
    curious: { eyes: 'wide', brow: [0.1, 0.6], browLift: 2, mouth: 'o', gaze: 0.3 },
    smile: { eyes: 'open', brow: 0.15, mouth: 'smile', blush: true },
    blank: { eyes: 'dull', brow: 0, mouth: 'flat' },
    sad: { eyes: 'half', brow: 0.65, mouth: 'frown', tear: true },
    surprised: { eyes: 'wide', brow: 0.5, browLift: 4, mouth: 'o' },
  },
};

// ─────────────────────────────── Wren ───────────────────────────────

const WREN_VEIL = '#1f2b32';
const WREN_SKIN = '#f1dece';
const WREN_SKIN_SH = '#e2c6b2';

function wrenBase(c: Ctx): void {
  // Her oar-scythe over one shoulder.
  stroke(c, [34, 320, 44, 52], '#4a3a30', 8);
  c.beginPath();
  c.moveTo(44, 52);
  c.quadraticCurveTo(108, 18, 140, 58);
  c.quadraticCurveTo(96, 46, 46, 82);
  c.closePath();
  c.fillStyle = linGrad(c, 44, 40, 140, 60, [[0, '#7ac8be'], [1, '#c8f0ea']]);
  c.fill();
  // The veil falls long behind her.
  c.beginPath();
  c.moveTo(62, 136);
  c.bezierCurveTo(52, 54, 188, 54, 178, 136);
  c.bezierCurveTo(190, 200, 200, 260, 208, 320);
  c.lineTo(32, 320);
  c.bezierCurveTo(40, 260, 50, 200, 62, 136);
  c.fillStyle = linGrad(c, 0, 60, 0, 320, [[0, '#33444e'], [0.4, WREN_VEIL], [1, '#141c22']]);
  c.fill();
  // Bone-white habit with a teal stole.
  shoulders(c, '#efe9dd', '#d8d0c0');
  c.fillStyle = '#2aa89a';
  c.fillRect(104, 236, 10, 84);
  c.fillRect(126, 236, 10, 84);
  ell(c, 120, 300, 5, 5, '#c9a24a');
  // Bell on a cord.
  stroke(c, [150, 236, 168, 276], '#6a5030', 2);
  c.beginPath();
  c.moveTo(168, 272);
  c.quadraticCurveTo(186, 272, 188, 302);
  c.lineTo(148, 302);
  c.quadraticCurveTo(150, 272, 168, 272);
  c.fillStyle = linGrad(c, 148, 272, 188, 302, [[0, '#f0cc60'], [1, '#a07a24']]);
  c.fill();
  ell(c, 168, 304, 4, 4, '#8a6a2a');
  neck(c, WREN_SKIN, WREN_SKIN_SH);
  face(c, WREN_SKIN, WREN_SKIN_SH, 44);
  nose(c, '#cc9e8c');
  // Grey strands escaping the wimple: a long career.
  taper(c, 80, 116, 74, 140, 80, 168, 3, '#b8b2ba');
  taper(c, 160, 116, 168, 138, 162, 164, 3, '#b8b2ba');
  // Wimple: a white band at the brow, framing the cheeks.
  c.beginPath();
  c.moveTo(66, 150);
  c.bezierCurveTo(60, 70, 180, 70, 174, 150);
  c.lineTo(166, 150);
  c.bezierCurveTo(168, 96, 72, 96, 74, 150);
  c.closePath();
  c.fillStyle = '#f6f2ea';
  c.fill();
  c.fillStyle = WREN_VEIL;
  c.beginPath();
  c.moveTo(62, 112);
  c.bezierCurveTo(58, 48, 182, 48, 178, 112);
  c.bezierCurveTo(150, 84, 90, 84, 62, 112);
  c.fill();
  // A small beauty mark, and the faint lines of someone who smiles at funerals.
  ell(c, 147, 168, 1.6, 1.6, '#6a4a40');
  c.globalAlpha = 0.25;
  qcurve(c, 92, 186, 96, 192, 100, 194, '#9a6a5a', 1.2);
  qcurve(c, 148, 186, 144, 192, 140, 194, '#9a6a5a', 1.2);
  c.globalAlpha = 1;
}

const WREN: Art = {
  base: wrenBase,
  eye: { w: 32, h: 27, iris: '#2aa094', irisDark: '#0b3a36', lash: '#24262a', skin: WREN_SKIN, style: 'gentle' },
  eyeY: 153,
  eyeX: [101, 139],
  browY: 131,
  browLen: 23,
  browColor: '#4a4a4e',
  mouthY: 181,
  mouthColor: '#9e5a5a',
  faces: {
    neutral: { eyes: 'open', brow: 0.1, mouth: 'neutral' },
    soft: { eyes: 'closed', brow: 0.2, mouth: 'smile' },
    wry: { eyes: 'half', brow: [0.05, -0.3], mouth: 'smirk', gaze: 0.4 },
    sad: { eyes: 'down', brow: 0.6, mouth: 'frown' },
    stern: { eyes: 'open', brow: -0.6, mouth: 'flat' },
    tired: {
      eyes: 'half', brow: 0.3, mouth: 'flat', gaze: -0.2,
      extra: (c) => {
        c.globalAlpha = 0.3;
        qcurve(c, 90, 166, 101, 170, 112, 166, '#9a6a6a', 1.4);
        qcurve(c, 128, 166, 139, 170, 150, 166, '#9a6a6a', 1.4);
        c.globalAlpha = 1;
      },
    },
  },
};

// ─────────────────────────────── Hoshiko ───────────────────────────────

const HOSHI_SKIN = '#f6e2cc';
const STRAW = '#e8c26a';
const STITCH = '#8a3a3a';

function hoshikoBase(c: Ctx): void {
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(120 + s * 58, 220, 14, 54, s * 0.15, 0, Math.PI * 2);
    c.fillStyle = STRAW;
    c.fill();
    for (let i = 0; i < 5; i++) qcurve(c, 120 + s * 48, 182 + i * 18, 120 + s * 58, 190 + i * 18, 120 + s * 68, 182 + i * 18, '#c9a050', 2);
    ell(c, 120 + s * 60, 276, 9, 6, '#b04848');
  }
  shoulders(c, '#9a5444', '#743a2e');
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
  for (let i = 0; i < 9; i++) stroke(c, [100 + i * 5, 232, 96 + i * 6, 250 + (i % 3) * 4], STRAW, 2.5);
  neck(c, HOSHI_SKIN, '#e8ccb2');
  faceShape(c, 120, 96, 50, 202, linGrad(c, 0, 96, 0, 202, [[0, HOSHI_SKIN], [1, '#eccfb4']]));
  c.beginPath();
  c.moveTo(70, 140);
  c.quadraticCurveTo(76, 96, 120, 96);
  c.quadraticCurveTo(166, 96, 170, 140);
  for (const [x, y] of [[156, 124], [146, 136], [132, 118], [120, 132], [108, 118], [94, 136], [84, 124]] as const) c.lineTo(x, y);
  c.closePath();
  c.fillStyle = STRAW;
  c.fill();
  c.beginPath();
  c.moveTo(6, 108);
  c.quadraticCurveTo(120, 2, 234, 108);
  c.quadraticCurveTo(120, 128, 6, 108);
  c.closePath();
  c.fillStyle = linGrad(c, 0, 20, 0, 120, [[0, '#f0d488'], [1, '#d4ae5e']]);
  c.fill();
  for (let i = 1; i < 6; i++) qcurve(c, 6 + i * 6, 108 - i * 4, 120, 10 + i * 14, 234 - i * 6, 108 - i * 4, 'rgba(150,110,50,0.45)', 1.5);
  c.beginPath();
  c.moveTo(66, 82);
  c.quadraticCurveTo(120, 64, 174, 82);
  c.lineTo(176, 94);
  c.quadraticCurveTo(120, 76, 64, 94);
  c.closePath();
  c.fillStyle = '#b04848';
  c.fill();
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) stroke(c, [120 + s * (30 + i * 5), 172, 120 + s * (32 + i * 5), 178], STITCH, 1.5);
}

const HOSHIKO: Art = {
  base: hoshikoBase,
  eye: 'button',
  eyeY: 154,
  eyeX: [100, 140],
  browY: 134,
  browLen: 22,
  browColor: '#2a1a2a',
  mouthY: 182,
  mouthColor: STITCH,
  stitches: true,
  faces: {
    neutral: { eyes: 'open', brow: 0, mouth: 'smile' },
    happy: { eyes: 'happy', brow: 0, browLift: 2, mouth: 'grin' },
    curious: { eyes: 'open', brow: [0, 0.6], mouth: 'o' },
    proud: { eyes: 'closed', brow: 0.1, mouth: 'smile', blush: true },
    determined: { eyes: 'open', brow: -0.8, mouth: 'teeth' },
    hurt: { eyes: 'hurt', brow: 0.6, mouth: 'wavy', sweat: true },
    sad: { eyes: 'open', brow: 0.65, mouth: 'frown' },
  },
};

function buttonEye(c: Ctx, x: number, y: number, kind: EyeKind, side: -1 | 1): void {
  if (kind === 'closed' || kind === 'happy') {
    taper(c, x - 10, y, x, kind === 'happy' ? y - 10 : y + 7, x + 10, y, 4, '#2a1a2a');
    return;
  }
  if (kind === 'hurt') {
    stroke(c, [x - 7, y - 7, x + 7, y + 7], '#2a1a2a', 3);
    stroke(c, [x + 7, y - 7, x - 7, y + 7], '#2a1a2a', 3);
    return;
  }
  const r = kind === 'wide' ? 11 : 9.5;
  ell(c, x, y, r, r, '#2a1a2a');
  ell(c, x, y, r * 0.72, r * 0.72, '#4a3040');
  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) ell(c, x + dx, y + dy, 1.3, 1.3, '#efe3c8');
  ell(c, x - side * 3, y - 4, 2.6, 1.6, 'rgba(255,255,255,0.6)', -0.5);
  if (kind === 'half' || kind === 'down') {
    c.fillStyle = HOSHI_SKIN;
    c.fillRect(x - r - 1, y - r - 2, r * 2 + 2, r);
    stroke(c, [x - r, y - 1, x + r, y - 1], '#2a1a2a', 2.5);
  }
}

// ─────────────────────────────── Ondine ───────────────────────────────

const ONDINE_SKIN = '#ebcdb6';
const ONDINE_HAIR = '#2a6a6a';

function ondineBase(c: Ctx): void {
  c.beginPath();
  c.moveTo(60, 150);
  c.bezierCurveTo(20, 120, 36, 240, 10, 300);
  c.lineTo(230, 300);
  c.bezierCurveTo(204, 240, 220, 120, 180, 150);
  c.quadraticCurveTo(170, 80, 120, 80);
  c.quadraticCurveTo(70, 80, 60, 150);
  c.fillStyle = linGrad(c, 0, 80, 0, 300, [[0, '#3a8a8a'], [1, '#1a4a4a']]);
  c.fill();
  shoulders(c, '#246664', '#14403e');
  for (let i = 0; i < 3; i++) ell(c, 120, 262 + i * 18, 4, 4, '#e0b04a');
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.2 + (i / 8) * 0.6);
    ell(c, 120 + Math.cos(a) * 34, 214 + Math.sin(a) * 22, 6, 6, '#f0c860');
    ell(c, 120 + Math.cos(a) * 34, 214 + Math.sin(a) * 22, 2.5, 2.5, '#b8862a');
  }
  neck(c, ONDINE_SKIN, '#dcb49c');
  face(c, ONDINE_SKIN, '#dcb49c', 47);
  nose(c, '#c48e78');
  const hf = ONDINE_HAIR;
  lock(c, 84, 100, 72, 160, 22, -6, hf);
  lock(c, 104, 96, 96, 134, 20, -3, hf);
  lock(c, 136, 96, 148, 132, 20, 4, hf);
  lock(c, 156, 100, 170, 160, 22, 6, hf);
  c.beginPath();
  c.ellipse(120, 92, 104, 22, -0.06, 0, Math.PI * 2);
  c.fillStyle = '#16302e';
  c.fill();
  c.beginPath();
  c.moveTo(72, 92);
  c.quadraticCurveTo(76, 30, 124, 30);
  c.quadraticCurveTo(170, 32, 168, 90);
  c.closePath();
  c.fill();
  c.fillStyle = '#e0b04a';
  c.fillRect(74, 76, 94, 8);
  qcurve(c, 150, 70, 196, 20, 214, 40, '#e8e0c8', 5);
  stroke(c, [206, 98, 214, 128], '#c9a24a', 1.5);
  c.fillStyle = '#efe4c8';
  c.fillRect(204, 126, 20, 14);
  c.fillStyle = '#7a3020';
  c.font = 'bold 10px Georgia, serif';
  c.fillText('¤', 210, 137);
  for (const [x, y, r] of [[40, 200, 5], [30, 170, 3], [206, 220, 4], [214, 190, 2.5]] as const) {
    c.strokeStyle = 'rgba(200,255,250,0.6)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
  }
}

const monocle = (c: Ctx): void => {
  c.strokeStyle = '#e0b04a';
  c.lineWidth = 2.2;
  c.beginPath();
  c.arc(139, 152, 17, 0, Math.PI * 2);
  c.stroke();
  stroke(c, [154, 160, 166, 204], '#e0b04a', 1.2);
};

const ONDINE: Art = {
  base: ondineBase,
  eye: { w: 32, h: 28, iris: '#d4a848', irisDark: '#5a3e10', lash: '#1a2a2a', skin: ONDINE_SKIN, style: 'anime' },
  eyeY: 152,
  eyeX: [101, 139],
  browY: 129,
  browLen: 25,
  browColor: '#1a3a3a',
  mouthY: 181,
  mouthColor: '#a04848',
  faces: {
    neutral: { eyes: 'open', brow: 0, mouth: 'smile' },
    grin: { eyes: 'happy', brow: -0.1, browLift: 3, mouth: 'gold' },
    sly: { eyes: 'half', brow: [0.1, -0.4], mouth: 'smirk', gaze: 0.6 },
    counting: { eyes: 'down', brow: 0, mouth: 'neutral', extra: monocle },
    offended: { eyes: 'wide', brow: -0.8, mouth: 'o' },
    sincere: { eyes: 'open', brow: 0.4, mouth: 'flat' },
    sad: { eyes: 'down', brow: 0.7, mouth: 'frown', tear: true },
  },
};

// ─────────────────────────────── Seraphine ───────────────────────────────

const SERA_SKIN = '#f5e6da';
const SERA_HAIR = '#e8e4dc';

function seraphineBase(c: Ctx): void {
  c.beginPath();
  c.moveTo(66, 130);
  c.quadraticCurveTo(58, 66, 120, 62);
  c.quadraticCurveTo(182, 66, 174, 130);
  c.lineTo(198, 320);
  c.lineTo(42, 320);
  c.closePath();
  c.fillStyle = linGrad(c, 0, 60, 0, 320, [[0, '#f6f4ee'], [1, '#cfc8bc']]);
  c.fill();
  shoulders(c, '#56688a', '#3a4862');
  c.fillStyle = '#efe8dc';
  c.beginPath();
  c.moveTo(96, 230);
  c.lineTo(120, 266);
  c.lineTo(144, 230);
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
  c.save();
  c.translate(40, 214);
  c.rotate(-0.25);
  c.fillStyle = '#efe8dc';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(s * 20, -8, s * 38, 0);
    c.lineTo(s * 38, 30);
    c.quadraticCurveTo(s * 20, 22, 0, 30);
    c.closePath();
    c.fill();
  }
  stroke(c, [0, 0, 0, 30], '#a09888', 1.2);
  c.restore();
  neck(c, SERA_SKIN, '#e4cec0');
  face(c, SERA_SKIN, '#e4cec0', 45);
  nose(c, '#d0a898');
  const hf = SERA_HAIR;
  lock(c, 116, 84, 86, 144, 26, 8, hf);
  lock(c, 124, 84, 154, 144, 26, -8, hf);
  lock(c, 76, 110, 70, 230, 18, -4, hf);
  lock(c, 164, 110, 170, 230, 18, 4, hf);
  angelRing(c, 84, 34, '#ffffff');
}

const SERAPHINE: Art = {
  base: seraphineBase,
  overlay: (c) => {
    c.strokeStyle = '#8a7a5a';
    c.lineWidth = 2;
    for (const x of [101, 139]) {
      c.beginPath();
      c.arc(x, 152, 17, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 0.18;
      ell(c, x - 6, 145, 6, 3, '#ffffff', -0.5);
      c.globalAlpha = 1;
    }
    stroke(c, [118, 150, 122, 150], '#8a7a5a', 2);
  },
  eye: { w: 31, h: 26, iris: '#7484a8', irisDark: '#2a3450', lash: '#5a4e44', skin: SERA_SKIN, style: 'gentle' },
  eyeY: 152,
  eyeX: [101, 139],
  browY: 130,
  browLen: 23,
  browColor: '#a8a094',
  mouthY: 181,
  mouthColor: '#a86868',
  faces: {
    neutral: { eyes: 'open', brow: 0.1, mouth: 'neutral' },
    gentle: { eyes: 'closed', brow: 0.2, mouth: 'smile' },
    smile: { eyes: 'happy', brow: 0.1, mouth: 'smile', blush: true },
    pleading: { eyes: 'wide', brow: 0.85, mouth: 'frown' },
    stern: { eyes: 'half', brow: -0.5, mouth: 'flat' },
    sad: { eyes: 'down', brow: 0.6, mouth: 'frown' },
    shocked: { eyes: 'wide', brow: 0.3, browLift: 5, mouth: 'o' },
  },
};

const ART: Record<Speaker, Art> = { sayo: SAYO, ilse: ILSE, tessel: TESSEL, wren: WREN, hoshiko: HOSHIKO, ondine: ONDINE, seraphine: SERAPHINE };

// ─────────────────────────────── drawing ───────────────────────────────

/** Eye state overrides used for animation: 0 = as the expression says, 1 = half-closed, 2 = closed. */
export type BlinkState = 0 | 1 | 2;

function drawFace(c: Ctx, art: Art, f: Face, blink: BlinkState, talk: boolean): void {
  let kind: EyeKind = f.eyes;
  const already = kind === 'closed' || kind === 'happy' || kind === 'hurt';
  if (!already) {
    if (blink === 2) kind = 'closed';
    else if (blink === 1) kind = kind === 'wide' ? 'open' : 'half';
  }
  const [lx, rx] = art.eyeX;
  if (art.eye === 'button') {
    buttonEye(c, lx, art.eyeY, kind, -1);
    buttonEye(c, rx, art.eyeY, kind, 1);
  } else {
    eye(c, lx, art.eyeY, -1, kind, art.eye, f.gaze ?? 0);
    eye(c, rx, art.eyeY, 1, kind, { ...art.eye, ...art.eyeR }, f.gaze ?? 0);
  }
  const [bl, br] = typeof f.brow === 'number' ? [f.brow, f.brow] : f.brow;
  brow(c, lx, art.browY, -1, bl, art.browLen, art.browColor, f.browLift ?? 0);
  brow(c, rx, art.browY, 1, br, art.browLen, art.browColor, f.browLift ?? 0);
  const m = talk ? talkingMouth(f.mouth) : f.mouth;
  mouth(c, 120, art.mouthY, m, art.mouthColor);
  if (art.stitches && !talk) {
    for (let k = -2; k <= 2; k++) stroke(c, [120 + k * 5, art.mouthY - 2, 120 + k * 5, art.mouthY + 4], art.mouthColor, 1.2);
  }
  if (f.blush) {
    blush(c, 94, art.mouthY - 12);
    blush(c, 146, art.mouthY - 12);
  }
  if (f.tear) tear(c, rx + 12, art.eyeY + 8);
  if (f.sweat) sweat(c, 166, art.eyeY - 30);
  f.extra?.(c);
  art.overlay?.(c);
}

/** Bases are drawn once per character and device pixel ratio. */
const baseCache = new Map<string, HTMLCanvasElement>();

function baseCanvas(who: Speaker, dpr: number): HTMLCanvasElement {
  const key = `${who}@${dpr}`;
  let cv = baseCache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = PORTRAIT_W * dpr;
    cv.height = PORTRAIT_H * dpr;
    const c = cv.getContext('2d')!;
    c.scale(dpr, dpr);
    paperShadow(c, () => ART[who].base(c));
    baseCache.set(key, cv);
  }
  return cv;
}

/** Render a portrait into a canvas (resized to the device pixel ratio). */
export function paintPortrait(target: HTMLCanvasElement, who: Speaker, expr: string, blink: BlinkState = 0, talk = false): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (target.width !== PORTRAIT_W * dpr) {
    target.width = PORTRAIT_W * dpr;
    target.height = PORTRAIT_H * dpr;
  }
  const c = target.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, target.width, target.height);
  c.drawImage(baseCanvas(who, dpr), 0, 0);
  c.scale(dpr, dpr);
  const art = ART[who];
  drawFace(c, art, art.faces[expr] ?? art.faces.neutral, blink, talk);
}
