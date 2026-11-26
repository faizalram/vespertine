import { S } from '../game/sprites';

/**
 * Procedurally drawn sprite atlas (stylised vector art, no image files).
 *
 * Two sprite modes:
 *  - TINT: channels encode masks. R = body (tinted by bullet colour), G = core
 *          (blends to white), alpha = coverage. Black outline = R0 G0.
 *          One shape serves every bullet colour.
 *  - RAW:  regular full-colour sprite.
 */
export const MODE_TINT = 0;
export const MODE_RAW = 1;

export interface Region {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Default draw size in field units. */
  w: number;
  h: number;
  mode: number;
}

type Draw = (c: CanvasRenderingContext2D, w: number, h: number) => void;

interface Def {
  id: number;
  /** Cell size in atlas pixels (drawn at 2x field resolution). */
  w: number;
  h: number;
  mode: number;
  draw: Draw;
}

const BODY = 'rgb(255,0,0)';
const CORE = 'rgb(255,255,0)';
const OUTLINE = 'rgba(0,0,0,0.85)';

function radial(c: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, stops: Array<[number, string]>) {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}

const drawOrb: Draw = (c, w) => {
  const r = w / 2;
  ellipse(c, r, r, r - 1, r - 1, OUTLINE);
  ellipse(c, r, r, r - 3, r - 3, BODY);
  ellipse(c, r, r, r * 0.62, r * 0.62, radial(c, r, r, 0, r * 0.62, [[0, CORE], [0.55, CORE], [1, BODY]]));
};

const drawRice: Draw = (c, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  ellipse(c, cx, cy, w / 2 - 1, h / 2 - 1, OUTLINE);
  ellipse(c, cx, cy, w / 2 - 2.5, h / 2 - 2.5, BODY);
  ellipse(c, cx, cy, w * 0.18, h * 0.3, CORE);
};

const drawPetal: Draw = (c, w, h) => {
  const path = (inset: number) => {
    c.beginPath();
    c.moveTo(w / 2, inset);
    c.bezierCurveTo(w - inset, h * 0.35, w - inset * 1.5, h - inset, w / 2, h - inset);
    c.bezierCurveTo(inset * 1.5, h - inset, inset, h * 0.35, w / 2, inset);
    c.closePath();
  };
  path(1);
  c.fillStyle = OUTLINE;
  c.fill();
  path(3.5);
  c.fillStyle = BODY;
  c.fill();
  ellipse(c, w / 2, h * 0.58, w * 0.13, h * 0.2, CORE);
};

const drawNeedle: Draw = (c, w, h) => {
  const poly = (inset: number, fill: string) => {
    c.beginPath();
    c.moveTo(w / 2, inset);
    c.lineTo(w - inset, h * 0.55);
    c.lineTo(w / 2, h - inset);
    c.lineTo(inset, h * 0.55);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  };
  poly(0.5, OUTLINE);
  poly(2, BODY);
  c.fillStyle = CORE;
  c.fillRect(w / 2 - 1, h * 0.2, 2, h * 0.6);
};

const drawPaper: Draw = (c, w, h) => {
  c.fillStyle = OUTLINE;
  c.fillRect(1, 1, w - 2, h - 2);
  c.fillStyle = BODY;
  c.fillRect(3, 3, w - 6, h - 6);
  c.fillStyle = CORE;
  c.fillRect(w / 2 - 1.5, 6, 3, h - 12);
  c.fillRect(w / 2 - 5, 9, 10, 2);
};

const drawSpark: Draw = (c, w) => {
  const r = w / 2;
  c.fillStyle = radial(c, r, r, 0, r, [
    [0, 'rgba(255,255,0,1)'],
    [0.25, 'rgba(255,200,0,0.9)'],
    [0.6, 'rgba(255,0,0,0.35)'],
    [1, 'rgba(255,0,0,0)'],
  ]);
  c.fillRect(0, 0, w, w);
};

const drawRing: Draw = (c, w) => {
  const r = w / 2;
  c.fillStyle = radial(c, r, r, r * 0.7, r, [
    [0, 'rgba(255,0,0,0)'],
    [0.55, 'rgba(255,128,0,0.7)'],
    [0.75, 'rgba(255,255,0,1)'],
    [1, 'rgba(255,0,0,0)'],
  ]);
  c.fillRect(0, 0, w, w);
};

const drawWard: Draw = (c, w) => {
  const r = w / 2;
  c.fillStyle = radial(c, r, r, 0, r, [[0, 'rgba(255,0,0,0.12)'], [0.9, 'rgba(255,0,0,0.22)'], [1, 'rgba(255,0,0,0)']]);
  c.fillRect(0, 0, w, w);
  c.strokeStyle = 'rgba(255,200,0,0.9)';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(r, r, r - 4, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 1.5;
  c.setLineDash([6, 8]);
  c.beginPath();
  c.arc(r, r, r - 14, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
  // Eight small sigils around the rim.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = r + Math.cos(a) * (r - 9);
    const y = r + Math.sin(a) * (r - 9);
    ellipse(c, x, y, 3, 3, 'rgba(255,255,0,1)');
  }
};

const drawHitbox: Draw = (c, w) => {
  const r = w / 2;
  ellipse(c, r, r, r - 1, r - 1, 'rgba(255,60,80,0.95)');
  ellipse(c, r, r, r - 4, r - 4, '#ffffff');
};

const drawWisp: Draw = (c, w) => {
  const r = w / 2;
  c.fillStyle = radial(c, r, r, 0, r, [
    [0, 'rgba(255,255,0,1)'],
    [0.35, 'rgba(255,160,0,0.9)'],
    [1, 'rgba(255,0,0,0)'],
  ]);
  c.fillRect(0, 0, w, w);
};

const drawLance: Draw = (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,0,1)');
  g.addColorStop(0.4, 'rgba(255,180,0,0.8)');
  g.addColorStop(1, 'rgba(255,0,0,0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(w / 2, 0);
  c.lineTo(w, h * 0.25);
  c.lineTo(w / 2 + 1, h);
  c.lineTo(w / 2 - 1, h);
  c.lineTo(0, h * 0.25);
  c.closePath();
  c.fill();
};

const drawEmitter: Draw = (c, w) => {
  const r = w / 2;
  c.fillStyle = radial(c, r, r, 0, r, [[0, '#fff6d8'], [0.35, '#ffb347'], [0.7, 'rgba(255,120,40,0.5)'], [1, 'rgba(255,90,20,0)']]);
  c.fillRect(0, 0, w, w);
  c.strokeStyle = '#3a1d10';
  c.lineWidth = 1.5;
  c.strokeRect(r - 4, r - 5, 8, 10);
};

/** Sayo Kagari: indigo robe, amber trim, dark hair with an amber hairpin, lantern in hand. */
const drawSayo: Draw = (c, w, h) => {
  const cx = w / 2;
  c.save();
  // Lantern glow behind.
  c.fillStyle = radial(c, cx + 26, h * 0.62, 0, 26, [[0, 'rgba(255,190,90,0.75)'], [1, 'rgba(255,150,60,0)']]);
  c.fillRect(0, 0, w, h);
  // Sleeves.
  c.fillStyle = '#e9e4f2';
  c.beginPath();
  c.moveTo(cx - 14, h * 0.42);
  c.lineTo(cx - 34, h * 0.7);
  c.lineTo(cx - 18, h * 0.74);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(cx + 14, h * 0.42);
  c.lineTo(cx + 30, h * 0.66);
  c.lineTo(cx + 18, h * 0.72);
  c.closePath();
  c.fill();
  // Robe.
  c.fillStyle = '#2b2350';
  c.beginPath();
  c.moveTo(cx - 13, h * 0.38);
  c.lineTo(cx + 13, h * 0.38);
  c.lineTo(cx + 24, h * 0.96);
  c.lineTo(cx - 24, h * 0.96);
  c.closePath();
  c.fill();
  // Amber hem and sash.
  c.fillStyle = '#f0a040';
  c.fillRect(cx - 24, h * 0.92, 48, h * 0.04);
  c.fillRect(cx - 15, h * 0.56, 30, h * 0.035);
  // Collar.
  c.fillStyle = '#e9e4f2';
  c.beginPath();
  c.moveTo(cx - 8, h * 0.38);
  c.lineTo(cx, h * 0.5);
  c.lineTo(cx + 8, h * 0.38);
  c.closePath();
  c.fill();
  // Hair (long, dark) and face.
  c.fillStyle = '#17121f';
  c.beginPath();
  c.ellipse(cx, h * 0.24, 15, 17, 0, 0, Math.PI * 2);
  c.fill();
  c.fillRect(cx - 15, h * 0.24, 30, h * 0.22);
  c.fillStyle = '#f3dccb';
  c.beginPath();
  c.ellipse(cx, h * 0.27, 10, 11, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#17121f';
  c.beginPath();
  c.moveTo(cx - 12, h * 0.2);
  c.quadraticCurveTo(cx, h * 0.12, cx + 12, h * 0.21);
  c.lineTo(cx + 11, h * 0.25);
  c.quadraticCurveTo(cx, h * 0.19, cx - 11, h * 0.25);
  c.closePath();
  c.fill();
  // Eyes (tired, half-lidded).
  c.fillRect(cx - 6, h * 0.285, 4, 1.6);
  c.fillRect(cx + 2, h * 0.285, 4, 1.6);
  // Hairpin.
  c.strokeStyle = '#f0a040';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(cx + 6, h * 0.1);
  c.lineTo(cx + 18, h * 0.04);
  c.stroke();
  ellipse(c, cx + 18, h * 0.04, 2.5, 2.5, '#ffcf70');
  // Lantern.
  c.strokeStyle = '#3a2a20';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(cx + 22, h * 0.68);
  c.lineTo(cx + 26, h * 0.54);
  c.stroke();
  c.fillStyle = '#ffd38a';
  c.fillRect(cx + 21, h * 0.55, 10, 13);
  c.fillStyle = '#7a3a1a';
  c.fillRect(cx + 20, h * 0.54, 12, 2);
  c.fillRect(cx + 20, h * 0.55 + 12, 12, 2);
  c.restore();
};

/** Training Effigy: a straw scarecrow with a wide hat and a blank paper face. */
const drawEffigy: Draw = (c, w, h) => {
  const cx = w / 2;
  c.fillStyle = radial(c, cx, h * 0.45, 10, w * 0.5, [[0, 'rgba(200,120,160,0.35)'], [1, 'rgba(120,60,120,0)']]);
  c.fillRect(0, 0, w, h);
  // Post and crossbar.
  c.fillStyle = '#3b2a26';
  c.fillRect(cx - 4, h * 0.3, 8, h * 0.68);
  c.fillRect(cx - 54, h * 0.42, 108, 7);
  // Ragged straw sleeves.
  c.fillStyle = '#c9a25a';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx + s * 18, h * 0.4);
    c.lineTo(cx + s * 58, h * 0.44);
    c.lineTo(cx + s * 52, h * 0.52);
    c.lineTo(cx + s * 44, h * 0.48);
    c.lineTo(cx + s * 38, h * 0.54);
    c.lineTo(cx + s * 18, h * 0.5);
    c.closePath();
    c.fill();
  }
  // Coat.
  c.fillStyle = '#5a3550';
  c.beginPath();
  c.moveTo(cx - 20, h * 0.38);
  c.lineTo(cx + 20, h * 0.38);
  c.lineTo(cx + 26, h * 0.78);
  c.lineTo(cx + 14, h * 0.74);
  c.lineTo(cx + 6, h * 0.8);
  c.lineTo(cx - 6, h * 0.75);
  c.lineTo(cx - 16, h * 0.8);
  c.lineTo(cx - 26, h * 0.76);
  c.closePath();
  c.fill();
  c.fillStyle = '#c9a25a';
  c.fillRect(cx - 20, h * 0.55, 40, 4);
  // Paper face.
  c.fillStyle = '#efe6d8';
  c.beginPath();
  c.ellipse(cx, h * 0.3, 15, 16, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#2a1a2a';
  c.beginPath();
  c.arc(cx - 6, h * 0.3, 2.4, 0, Math.PI * 2);
  c.arc(cx + 6, h * 0.3, 2.4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#2a1a2a';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(cx - 5, h * 0.37);
  c.quadraticCurveTo(cx, h * 0.39, cx + 5, h * 0.37);
  c.stroke();
  // Wide straw hat.
  c.fillStyle = '#d8b46a';
  c.beginPath();
  c.moveTo(cx - 40, h * 0.22);
  c.quadraticCurveTo(cx, h * 0.02, cx + 40, h * 0.22);
  c.quadraticCurveTo(cx, h * 0.26, cx - 40, h * 0.22);
  c.closePath();
  c.fill();
  c.fillStyle = '#9a3b3b';
  c.fillRect(cx - 16, h * 0.16, 32, 3);
};

const drawWhite: Draw = (c, w, h) => {
  c.fillStyle = '#fff';
  c.fillRect(0, 0, w, h);
};

const drawShard: Draw = (c, w, h) => {
  c.fillStyle = BODY;
  c.beginPath();
  c.moveTo(w / 2, 0);
  c.lineTo(w, h / 2);
  c.lineTo(w / 2, h);
  c.lineTo(0, h / 2);
  c.closePath();
  c.fill();
  ellipse(c, w / 2, h / 2, w * 0.2, h * 0.2, CORE);
};


/** Chaff wisp: a bundle of straw around a small sad ember. */
const drawChaff: Draw = (c, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  c.fillStyle = radial(c, cx, cy, 0, w / 2, [[0, 'rgba(255,210,120,0.55)'], [1, 'rgba(255,170,80,0)']]);
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#d9b46a';
  c.lineWidth = 2;
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
    c.lineTo(cx + Math.cos(a + 0.25) * (w * 0.42), cy + Math.sin(a + 0.25) * (h * 0.42));
    c.stroke();
  }
  ellipse(c, cx, cy, 8, 8, '#3a2418');
  ellipse(c, cx, cy, 5, 5, '#ffcf70');
  c.fillStyle = '#3a2418';
  c.fillRect(cx - 3, cy - 1, 1.5, 1.5);
  c.fillRect(cx + 1.5, cy - 1, 1.5, 1.5);
};

/** Crow, drawn facing down (direction of travel). */
const drawCrow: Draw = (c, w, h) => {
  const cx = w / 2;
  c.fillStyle = '#120c16';
  c.beginPath();
  c.moveTo(cx, h * 0.92); // beak
  c.lineTo(cx + 5, h * 0.7);
  c.quadraticCurveTo(cx + w * 0.3, h * 0.55, w * 0.98, h * 0.3); // right wing tip
  c.lineTo(cx + w * 0.2, h * 0.4);
  c.lineTo(cx + 7, h * 0.1); // tail
  c.lineTo(cx - 7, h * 0.1);
  c.lineTo(cx - w * 0.2, h * 0.4);
  c.lineTo(w * 0.02, h * 0.3);
  c.quadraticCurveTo(cx - w * 0.3, h * 0.55, cx - 5, h * 0.7);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(190,150,230,0.7)';
  c.lineWidth = 1.2;
  c.stroke();
  ellipse(c, cx - 3, h * 0.72, 1.8, 1.8, '#ff4a5a');
  ellipse(c, cx + 3, h * 0.72, 1.8, 1.8, '#ff4a5a');
};

/** Paper field lantern with a painted, gently sad face. */
const drawFieldLantern: Draw = (c, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  c.fillStyle = radial(c, cx, cy, 4, w / 2, [[0, 'rgba(255,200,110,0.7)'], [1, 'rgba(255,140,60,0)']]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#ffdca0';
  c.beginPath();
  c.ellipse(cx, cy, w * 0.3, h * 0.36, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(160,80,40,0.55)';
  c.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    c.ellipse(cx, cy, Math.abs(i) * w * 0.07 + 0.5, h * 0.36, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = '#5a2a18';
  c.fillRect(cx - w * 0.16, cy - h * 0.4, w * 0.32, 4);
  c.fillRect(cx - w * 0.16, cy + h * 0.36, w * 0.32, 4);
  c.fillStyle = '#7a3020';
  c.beginPath();
  c.arc(cx - 6, cy - 1, 2, 0, Math.PI * 2);
  c.arc(cx + 6, cy - 1, 2, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#7a3020';
  c.beginPath();
  c.moveTo(cx - 4, cy + 7);
  c.quadraticCurveTo(cx, cy + 4, cx + 4, cy + 7);
  c.stroke();
};

/** Crow Matron: a tall woman in a cloak of black feathers and a pale crow mask. */
const drawMatron: Draw = (c, w, h) => {
  const cx = w / 2;
  c.fillStyle = radial(c, cx, h * 0.45, 10, w * 0.5, [[0, 'rgba(150,90,200,0.35)'], [1, 'rgba(90,40,140,0)']]);
  c.fillRect(0, 0, w, h);
  // Feather wings / cloak.
  c.fillStyle = '#140c1c';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx, h * 0.3);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      c.lineTo(cx + s * (w * 0.12 + t * w * 0.36), h * (0.28 + t * 0.12) + (i % 2 ? 10 : 0));
    }
    c.lineTo(cx + s * w * 0.3, h * 0.78);
    c.lineTo(cx + s * w * 0.1, h * 0.92);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = 'rgba(180,140,230,0.5)';
  c.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    for (let i = 1; i < 6; i++) {
      c.beginPath();
      c.moveTo(cx + s * w * 0.1, h * 0.38);
      c.lineTo(cx + s * (w * 0.12 + (i / 6) * w * 0.36), h * (0.3 + (i / 6) * 0.12) + 6);
      c.stroke();
    }
  }
  // Body.
  c.fillStyle = '#2a1638';
  c.beginPath();
  c.moveTo(cx - 14, h * 0.32);
  c.lineTo(cx + 14, h * 0.32);
  c.lineTo(cx + 24, h * 0.94);
  c.lineTo(cx - 24, h * 0.94);
  c.closePath();
  c.fill();
  // Hair and mask.
  c.fillStyle = '#0c0810';
  c.beginPath();
  c.ellipse(cx, h * 0.22, 17, 18, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#e8e2ee';
  c.beginPath();
  c.moveTo(cx - 12, h * 0.18);
  c.lineTo(cx + 12, h * 0.18);
  c.lineTo(cx + 9, h * 0.25);
  c.lineTo(cx, h * 0.36);
  c.lineTo(cx - 9, h * 0.25);
  c.closePath();
  c.fill();
  c.fillStyle = '#c03040';
  ellipse(c, cx - 5, h * 0.21, 2.2, 2.2, '#c03040');
  ellipse(c, cx + 5, h * 0.21, 2.2, 2.2, '#c03040');
};

/** Hoshiko Aze: straw-blond braids, wide hat, patchwork dress, a little scythe. */
const drawHoshiko: Draw = (c, w, h) => {
  const cx = w / 2;
  c.fillStyle = radial(c, cx, h * 0.5, 10, w * 0.5, [[0, 'rgba(255,200,120,0.3)'], [1, 'rgba(255,160,80,0)']]);
  c.fillRect(0, 0, w, h);
  // Scythe behind.
  c.strokeStyle = '#4a2e22';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(cx + 30, h * 0.92);
  c.lineTo(cx + 40, h * 0.28);
  c.stroke();
  c.fillStyle = '#cfd2dc';
  c.beginPath();
  c.moveTo(cx + 40, h * 0.28);
  c.quadraticCurveTo(cx + 18, h * 0.18, cx + 8, h * 0.3);
  c.quadraticCurveTo(cx + 22, h * 0.25, cx + 40, h * 0.33);
  c.closePath();
  c.fill();
  // Dress with patches.
  c.fillStyle = '#8a4a3a';
  c.beginPath();
  c.moveTo(cx - 12, h * 0.42);
  c.lineTo(cx + 12, h * 0.42);
  c.lineTo(cx + 26, h * 0.9);
  c.lineTo(cx - 26, h * 0.9);
  c.closePath();
  c.fill();
  c.fillStyle = '#c9a25a';
  c.fillRect(cx - 18, h * 0.66, 12, 10);
  c.fillStyle = '#5a6a8a';
  c.fillRect(cx + 4, h * 0.74, 12, 9);
  c.fillStyle = '#e9dfc8';
  c.fillRect(cx - 26, h * 0.86, 52, h * 0.04);
  // Straw tufts at sleeves.
  c.strokeStyle = '#e0bf70';
  c.lineWidth = 2;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(cx + s * 14, h * 0.48);
      c.lineTo(cx + s * (22 + i * 3), h * (0.56 + i * 0.02));
      c.stroke();
    }
  }
  // Braids.
  c.fillStyle = '#e8c26a';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(cx + s * 13, h * 0.42, 4, 13, s * 0.2, 0, Math.PI * 2);
    c.fill();
  }
  // Face.
  c.fillStyle = '#f6e2cc';
  c.beginPath();
  c.ellipse(cx, h * 0.31, 11, 12, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#e8c26a';
  c.beginPath();
  c.moveTo(cx - 12, h * 0.28);
  c.quadraticCurveTo(cx, h * 0.2, cx + 12, h * 0.28);
  c.lineTo(cx + 12, h * 0.25);
  c.quadraticCurveTo(cx, h * 0.17, cx - 12, h * 0.25);
  c.fill();
  // Button eyes and stitched smile.
  ellipse(c, cx - 4.5, h * 0.315, 2.2, 2.2, '#2a1a2a');
  ellipse(c, cx + 4.5, h * 0.315, 2.2, 2.2, '#2a1a2a');
  c.strokeStyle = '#a04040';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(cx - 4, h * 0.355);
  c.quadraticCurveTo(cx, h * 0.38, cx + 4, h * 0.355);
  c.stroke();
  // Wide straw hat.
  c.fillStyle = '#e0bf70';
  c.beginPath();
  c.moveTo(cx - 34, h * 0.24);
  c.quadraticCurveTo(cx, h * 0.04, cx + 34, h * 0.24);
  c.quadraticCurveTo(cx, h * 0.28, cx - 34, h * 0.24);
  c.closePath();
  c.fill();
  c.fillStyle = '#b04848';
  c.fillRect(cx - 14, h * 0.18, 28, 3);
};

function itemBox(c: CanvasRenderingContext2D, w: number, h: number, fill: string, glyph: string, glyphColor = '#fff') {
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.fillRect(1, 1, w - 2, h - 2);
  c.fillStyle = fill;
  c.fillRect(3, 3, w - 6, h - 6);
  c.fillStyle = glyphColor;
  c.font = `bold ${Math.round(h * 0.62)}px Georgia, serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(glyph, w / 2, h / 2 + 1);
}

const drawItemPower: Draw = (c, w, h) => itemBox(c, w, h, '#e0503a', 'P');
const drawItemPowerBig: Draw = (c, w, h) => itemBox(c, w, h, '#ff7040', 'P', '#fff2c0');
const drawItemPoint: Draw = (c, w, h) => itemBox(c, w, h, '#3a70e0', '◆', '#dfe8ff');
const drawItemLife: Draw = (c, w, h) => {
  const cx = w / 2;
  c.fillStyle = radial(c, cx, h * 0.6, 0, w / 2, [[0, '#fff0f6'], [0.4, '#ff8fb0'], [1, 'rgba(255,90,140,0)']]);
  c.beginPath();
  c.moveTo(cx, 1);
  c.quadraticCurveTo(w - 2, h * 0.55, cx, h - 2);
  c.quadraticCurveTo(2, h * 0.55, cx, 1);
  c.fill();
};
const drawItemBomb: Draw = (c, w, h) => {
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.fillRect(w * 0.2, 0, w * 0.6, h);
  c.fillStyle = '#5ad08a';
  c.fillRect(w * 0.26, 2, w * 0.48, h - 4);
  c.fillStyle = '#eaffef';
  c.fillRect(w / 2 - 1, 5, 2, h - 10);
  c.fillRect(w / 2 - 4, 8, 8, 2);
};
const drawItemStar: Draw = (c, w) => {
  const r = w / 2;
  c.fillStyle = radial(c, r, r, 0, r, [[0, '#ffffff'], [0.4, 'rgba(200,230,255,0.9)'], [1, 'rgba(150,200,255,0)']]);
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 ? r * 0.35 : r;
    c.lineTo(r + Math.cos(a) * rr, r + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
};
const drawMarker: Draw = (c, w, h) => {
  c.fillStyle = 'rgba(255,120,150,0.95)';
  c.beginPath();
  c.moveTo(w / 2, 0);
  c.lineTo(w, h);
  c.lineTo(0, h);
  c.closePath();
  c.fill();
};

const DEFS: Def[] = [
  { id: S.orb, w: 32, h: 32, mode: MODE_TINT, draw: drawOrb },
  { id: S.rice, w: 18, h: 34, mode: MODE_TINT, draw: drawRice },
  { id: S.petal, w: 28, h: 28, mode: MODE_TINT, draw: drawPetal },
  { id: S.needle, w: 12, h: 36, mode: MODE_TINT, draw: drawNeedle },
  { id: S.paper, w: 22, h: 30, mode: MODE_TINT, draw: drawPaper },
  { id: S.big, w: 80, h: 80, mode: MODE_TINT, draw: drawOrb },
  { id: S.spark, w: 32, h: 32, mode: MODE_TINT, draw: drawSpark },
  { id: S.ring, w: 256, h: 256, mode: MODE_TINT, draw: drawRing },
  { id: S.ward, w: 128, h: 128, mode: MODE_TINT, draw: drawWard },
  { id: S.hitbox, w: 16, h: 16, mode: MODE_RAW, draw: drawHitbox },
  { id: S.sayo, w: 96, h: 112, mode: MODE_RAW, draw: drawSayo },
  { id: S.wisp, w: 24, h: 24, mode: MODE_TINT, draw: drawWisp },
  { id: S.lance, w: 10, h: 40, mode: MODE_TINT, draw: drawLance },
  { id: S.emitter, w: 24, h: 24, mode: MODE_RAW, draw: drawEmitter },
  { id: S.effigy, w: 160, h: 160, mode: MODE_RAW, draw: drawEffigy },
  { id: S.white, w: 8, h: 8, mode: MODE_RAW, draw: drawWhite },
  { id: S.shard, w: 16, h: 20, mode: MODE_TINT, draw: drawShard },
  { id: S.feather, w: 16, h: 20, mode: MODE_TINT, draw: drawPetal },
  { id: S.chaff, w: 48, h: 48, mode: MODE_RAW, draw: drawChaff },
  { id: S.crow, w: 52, h: 44, mode: MODE_RAW, draw: drawCrow },
  { id: S.fieldLantern, w: 64, h: 72, mode: MODE_RAW, draw: drawFieldLantern },
  { id: S.matron, w: 192, h: 176, mode: MODE_RAW, draw: drawMatron },
  { id: S.hoshiko, w: 128, h: 144, mode: MODE_RAW, draw: drawHoshiko },
  { id: S.itemPower, w: 22, h: 22, mode: MODE_RAW, draw: drawItemPower },
  { id: S.itemPowerBig, w: 32, h: 32, mode: MODE_RAW, draw: drawItemPowerBig },
  { id: S.itemPoint, w: 22, h: 22, mode: MODE_RAW, draw: drawItemPoint },
  { id: S.itemLife, w: 30, h: 34, mode: MODE_RAW, draw: drawItemLife },
  { id: S.itemBomb, w: 24, h: 34, mode: MODE_RAW, draw: drawItemBomb },
  { id: S.itemStar, w: 18, h: 18, mode: MODE_RAW, draw: drawItemStar },
  { id: S.marker, w: 16, h: 12, mode: MODE_RAW, draw: drawMarker },
];

export interface Atlas {
  canvas: HTMLCanvasElement;
  regions: Region[];
}

/** Shelf-pack every sprite into one canvas, drawing each with 1px padding. */
export function buildAtlas(): Atlas {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const regions: Region[] = [];
  const sorted = [...DEFS].sort((a, b) => b.h - a.h);
  let x = 0;
  let y = 0;
  let rowH = 0;
  const pad = 2;
  for (const d of sorted) {
    if (x + d.w + pad > size) {
      x = 0;
      y += rowH + pad;
      rowH = 0;
    }
    if (y + d.h > size) throw new Error('atlas overflow');
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, d.w, d.h);
    ctx.clip();
    d.draw(ctx, d.w, d.h);
    ctx.restore();
    // Half-texel inset avoids bleeding from neighbours under linear filtering.
    regions[d.id] = {
      u0: (x + 0.5) / size,
      v0: (y + 0.5) / size,
      u1: (x + d.w - 0.5) / size,
      v1: (y + d.h - 0.5) / size,
      w: d.w / 2,
      h: d.h / 2,
      mode: d.mode,
    };
    x += d.w + pad;
    rowH = Math.max(rowH, d.h);
  }
  return { canvas, regions };
}
