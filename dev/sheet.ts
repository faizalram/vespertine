// Dev-only contact sheet: every portrait expression plus blink/talk frames.
import { EXPRESSIONS, PORTRAIT_H, PORTRAIT_W, paintPortrait } from '../src/ui/portraits';
import type { Speaker } from '../src/game/defs';

const who = (new URLSearchParams(location.search).get('who') ?? 'sayo,ilse,tessel,wren').split(',') as Speaker[];
const scale = Number(new URLSearchParams(location.search).get('scale') ?? 0.62);
for (const w of who) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  const only = new URLSearchParams(location.search).get('expr');
  const exprs = only ? only.split(',') : [...EXPRESSIONS[w], 'blink', 'talk'];
  for (const e of exprs) {
    const cv = document.createElement('canvas');
    if (e === 'blink') paintPortrait(cv, w, 'neutral', 2);
    else if (e === 'talk') paintPortrait(cv, w, 'neutral', 0, true);
    else paintPortrait(cv, w, e);
    cv.style.width = `${PORTRAIT_W * scale}px`;
    cv.style.height = `${PORTRAIT_H * scale}px`;
    cv.title = `${w}:${e}`;
    row.append(cv);
  }
  document.body.append(row);
}

// ── Puppet preview: every heroine's in-game puppet, in each head expression, at 4x.
import { buildAtlas } from '../src/render/atlas';
import { HEAD_KINDS, puppets } from '../src/render/puppetArt';

if (new URLSearchParams(location.search).has('puppets')) {
  document.body.innerHTML = '';
  const { defs, rigs } = puppets();
  const atlas = buildAtlas(defs);
  const S = 4;
  const cv = document.createElement('canvas');
  cv.width = 1300;
  cv.height = 4 * 70 * S / 1.4;
  document.body.append(cv);
  const c = cv.getContext('2d')!;
  const ids = Object.keys(rigs) as Array<keyof typeof rigs>;
  ids.forEach((id, row) => {
    HEAD_KINDS.forEach((kind, col) => {
      const ox = 70 + col * 250;
      const oy = 110 + row * 200;
      const rig = rigs[id];
      // Static pose: draw parts at their rest transforms (no rotation).
      const jx: number[] = [];
      const jy: number[] = [];
      rig.parts.forEach((_, i) => {
        const resolve = (k: number): void => {
          if (jx[k] !== undefined) return;
          const p = rig.parts[k];
          let px = 0;
          let py = 0;
          if (p.parent >= 0) {
            resolve(p.parent);
            px = jx[p.parent];
            py = jy[p.parent];
          }
          jx[k] = px + p.attach[0];
          jy[k] = py + p.attach[1];
        };
        resolve(i);
      });
      rig.parts.forEach((p, i) => {
        const sprite = p.heads ? p.heads[kind] : p.sprite;
        const r = atlas.regions[sprite];
        const sx = r.u0 * atlas.canvas.width;
        const sy = r.v0 * atlas.canvas.height;
        const sw = (r.u1 - r.u0) * atlas.canvas.width;
        const sh = (r.v1 - r.v0) * atlas.canvas.height;
        const cx = jx[i] - p.pivot[0];
        const cy = jy[i] - p.pivot[1];
        c.drawImage(atlas.canvas, sx, sy, sw, sh, ox + (cx - r.w / 2) * S, oy + (cy - r.h / 2) * S, r.w * S, r.h * S);
      });
    });
  });
}
