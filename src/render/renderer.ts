import * as THREE from 'three';
import { BULLET_TYPES, BT } from '../game/bulletTypes';
import { pinSegments } from '../game/characters';
import { FIELD_H, FIELD_W, SPAWN_GRACE } from '../game/constants';
import { IT } from '../game/defs';
import type { Game } from '../game/game';
import { C, PALETTE } from '../game/palette';
import { LaserPool } from '../game/pools';
import { S } from '../game/sprites';
import { buildAtlas } from './atlas';
import { createBackground, NO_CUES, type CameraCues, type SceneId, type StageBackground } from './background';
import { SpriteBatch } from './spriteBatch';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ITEM_SPRITE: Record<number, number> = {
  [IT.power]: S.itemPower,
  [IT.powerBig]: S.itemPowerBig,
  [IT.point]: S.itemPoint,
  [IT.life]: S.itemLife,
  [IT.bomb]: S.itemBomb,
  [IT.star]: S.itemStar,
  [IT.soul]: S.itemSoul,
  [IT.recollection]: S.itemRecollection,
};

/** Player shot tints by sprite: [r, g, b, alpha, additive, stretch-per-speed]. */
const SHOT_STYLE: Record<number, readonly [number, number, number, number, boolean, number]> = {
  [S.lance]: [1, 0.8, 0.5, 0.55, true, 0.035],
  [S.wisp]: [1, 0.62, 0.18, 0.75, true, 0],
  [S.ray]: [1, 0.9, 0.45, 0.8, true, 0.04],
  [S.ink]: [0.16, 0.22, 0.55, 0.95, false, 0.03],
  [S.needle]: [1, 0.62, 0.55, 0.7, true, 0.035],
  [S.arc]: [0.75, 1, 0.95, 0.85, true, 0],
  [S.soul]: [0.35, 1, 0.9, 0.8, true, 0],
};

/** Accent colour per heroine, for afterimages and auras. */
const ACCENT: Record<string, readonly [number, number, number]> = {
  sayo: [1, 0.66, 0.3],
  ilse: [0.45, 0.55, 1],
  tessel: [1, 0.55, 0.5],
  wren: [0.4, 1, 0.9],
};

/** Enemy sprites with flapping wings / swimming wiggle / gentle sway. */
const FLAPPERS = new Set<number>([S.crow, S.inkmoth]);
const SWIMMERS = new Set<number>([S.koi, S.quill]);
const SWAYERS = new Set<number>([S.fieldLantern, S.drownedLantern, S.book, S.paperBoat, S.chaff]);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Ease-out with a little overshoot, for things popping into existence. */
const backOut = (t: number) => {
  const c = 1.7;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

/**
 * Two layers composed into the playfield viewport:
 *  1. a 3D perspective background scene;
 *  2. a flat orthographic sprite scene in field units (y down).
 * Everything is drawn at an interpolated position between the last two
 * simulation ticks, so motion stays smooth on 90–144 Hz displays.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  private bg: StageBackground;
  private sceneId: SceneId = 'fields';
  private readonly scene = new THREE.Scene();
  private readonly cam: THREE.OrthographicCamera;
  private readonly back: SpriteBatch;
  private readonly shots: SpriteBatch;
  private readonly shotsN: SpriteBatch;
  private readonly actors: SpriteBatch;
  private readonly items: SpriteBatch;
  private readonly bullets: SpriteBatch;
  private readonly fx: SpriteBatch;
  private readonly top: SpriteBatch;
  private readonly all: SpriteBatch[];
  private pixelRatio: number;
  private elegyFade = 0;
  private time = 0;
  /** Recent interpolated player positions (render frames) for afterimages. */
  private readonly ghosts: Array<[number, number]> = [];
  private bossGhosts: Array<[number, number]> = [];
  reduceFlash = false;
  drawCalls = 0;

  constructor(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'high-performance', alpha: false });
    this.pixelRatio = Math.min(dpr, 2);
    this.gl.setPixelRatio(this.pixelRatio);
    this.gl.autoClear = false;
    this.gl.info.autoReset = false;
    this.gl.setClearColor(0x0c0912, 1);
    this.bg = createBackground('fields');

    // Orthographic camera with top=0, bottom=FIELD_H: field units, y grows downward.
    this.cam = new THREE.OrthographicCamera(0, FIELD_W, 0, FIELD_H, -10, 10);
    this.cam.position.z = 5;

    const atlas = buildAtlas();
    const tex = new THREE.CanvasTexture(atlas.canvas);
    tex.flipY = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.NoColorSpace;

    const r = atlas.regions;
    this.back = new SpriteBatch(16, tex, r, false, -1);
    this.shots = new SpriteBatch(2048, tex, r, true, 0);
    this.shotsN = new SpriteBatch(512, tex, r, false, 0.5);
    this.actors = new SpriteBatch(200, tex, r, false, 1);
    this.items = new SpriteBatch(1100, tex, r, false, 2);
    this.bullets = new SpriteBatch(4200, tex, r, false, 3);
    this.fx = new SpriteBatch(3400, tex, r, true, 4);
    this.top = new SpriteBatch(32, tex, r, false, 5);
    this.all = [this.back, this.shots, this.shotsN, this.actors, this.items, this.bullets, this.fx, this.top];
    for (const b of this.all) this.scene.add(b.mesh);
  }

  get resolutionScale(): number {
    return this.pixelRatio;
  }

  setPixelRatio(r: number): void {
    this.pixelRatio = r;
    this.gl.setPixelRatio(r);
  }

  resize(w: number, h: number): void {
    this.gl.setSize(w, h, false);
  }

  /** Swap the 3D backdrop when the stage changes. */
  private ensureScene(id: SceneId): void {
    if (id === this.sceneId) return;
    this.bg.dispose();
    this.bg = createBackground(id);
    this.sceneId = id;
  }

  /** Advance purely visual state (background, camera). */
  updateVisuals(dt: number, g: Game | null): void {
    this.time += dt;
    this.ensureScene(g?.stageInfo?.scene ?? 'fields');
    let cues: CameraCues = NO_CUES;
    if (g) {
      const p = g.player;
      cues = {
        lean: clamp((p.x - FIELD_W / 2) / (FIELD_W / 2), -1, 1),
        bank: clamp(p.vxSmooth / g.char.speed, -1, 1),
        bossPresent: g.boss.present,
        elegy: !!(g.boss.present && g.boss.elegy),
        declareT: g.boss.declareT,
        shake: g.shake,
        punch: g.bomb.active ? Math.max(0, 1 - g.bomb.t / 30) : 0,
      };
    }
    const elegy = cues.elegy ? 1 : 0;
    this.elegyFade += (elegy - this.elegyFade) * Math.min(1, dt * 3);
    this.bg.update(dt, cues);
  }

  /** @param alpha interpolation factor between the previous and the current tick (0..1). */
  render(g: Game | null, field: Rect, cssH: number, alpha = 1): void {
    const gl = this.gl;
    gl.info.reset();
    gl.setScissorTest(false);
    gl.clear();

    const vy = cssH - field.y - field.h;
    gl.setScissorTest(true);
    gl.setScissor(field.x, vy, field.w, field.h);
    gl.setViewport(field.x, vy, field.w, field.h);
    gl.render(this.bg.scene, this.bg.camera);

    if (g) {
      this.fill(g, clamp(alpha, 0, 1));
      const sh = g.shake;
      this.cam.position.x = sh > 0 ? Math.sin(this.time * 97) * sh * 0.5 : 0;
      this.cam.position.y = sh > 0 ? Math.cos(this.time * 83) * sh * 0.5 : 0;
      gl.clearDepth();
      gl.render(this.scene, this.cam);
    }
    gl.setScissorTest(false);
    this.drawCalls = gl.info.render.calls;
  }

  private fill(g: Game, a: number): void {
    const { back, shots, shotsN, actors, items, bullets, fx, top } = this;
    for (const b of this.all) b.begin();
    const p = g.player;
    const f = g.frame;
    const t = this.time;
    const boss = g.boss;
    const ch = g.char;
    const cs = g.cs;
    const back1 = 1 - a; // how far to step back along velocity for velocity-interpolated objects

    const px = lerp(p.px, p.x, a);
    const py = lerp(p.py, p.y, a);
    const bx = lerp(boss.px, boss.x, a);
    const by = lerp(boss.py, boss.y, a);

    // ── Elegy backdrop: the dusk dims and a sigil spins up behind the boss.
    if (this.elegyFade > 0.01) {
      back.push(S.white, FIELD_W / 2, FIELD_H / 2, 0, 1, 0.1, 0.04, 0.14, 0.5 * this.elegyFade, FIELD_W, FIELD_H);
      const [r, gg, b] = PALETTE[C.rose];
      const grow = backOut(clamp(boss.declareT / 45, 0, 1));
      shots.push(S.ward, bx, by, t * 0.25, 4.2 * grow, r, gg, b, 0.22 * this.elegyFade);
      shots.push(S.ward, bx, by, -t * 0.38, 2.6 * grow, r, gg, b, 0.18 * this.elegyFade);
    }
    if (g.dialogue) back.push(S.white, FIELD_W / 2, FIELD_H / 2, 0, 1, 0.05, 0.03, 0.08, 0.3, FIELD_W, FIELD_H);

    // ── Sayo: Vigil ward, unfolding with a little overshoot.
    const v = cs.vigil;
    if (v.active) {
      const k = v.t / 300;
      const appear = backOut(clamp(v.t / 16, 0, 1));
      const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
      const [r, gg, b] = PALETTE[C.amber];
      shots.push(S.ward, v.x, v.y, t * 0.6, ((56 * 2) / 64) * appear, r, gg, b, 0.85 * fade);
      shots.push(S.ward, v.x, v.y, -t * 0.4, ((56 * 2) / 64) * appear * 0.7, r, gg, b, 0.3 * fade);
    }

    // ── Ilse: survey pins and the ink lines between them.
    if (cs.pins.length) {
      for (const [ax, ay, bx2, by2] of pinSegments(g)) {
        const len = Math.hypot(bx2 - ax, by2 - ay);
        const rot = Math.atan2(by2 - ay, bx2 - ax);
        const pulse = 0.55 + 0.25 * Math.sin(t * 9);
        shotsN.push(S.white, (ax + bx2) / 2, (ay + by2) / 2, rot, 1, 0.1, 0.13, 0.3, 0.85, len, 3);
        shots.push(S.beam, (ax + bx2) / 2, (ay + by2) / 2, rot, 1, 1, 0.8, 0.35, pulse, len, 6);
      }
      for (const pin of cs.pins) {
        const fade = pin.age > 840 ? (900 - pin.age) / 60 : 1;
        const drop = backOut(clamp(pin.age / 12, 0, 1));
        shotsN.push(S.pin, pin.x, pin.y - 6 - (1 - drop) * 14, 0, 1, 1, 1, 1, fade * clamp(pin.age / 4, 0, 1));
      }
    }

    // ── Wren: Requiem aura and the bell's ring.
    if (cs.requiem > 0) {
      const aa = Math.min(1, cs.requiem / 40) * (0.35 + 0.15 * Math.sin(t * 12));
      shots.push(S.wisp, px, py, 0, 3.4 + Math.sin(t * 6) * 0.3, 0.3, 1, 0.85, aa);
    }
    if (cs.bell.t > 0) {
      const k = 1 - cs.bell.t / 40;
      shots.push(S.ring, cs.bell.x, cs.bell.y, 0, ((96 * 2) / 128) * backOut(Math.min(1, k * 1.6)), 0.4, 1, 0.9, 1 - k);
    }

    // ── Player shots: interpolated along velocity, stretched by speed, wisps with tails.
    const s = g.shots;
    for (let i = 0; i < s.n; i++) {
      const sp = s.sprite[i];
      const st = SHOT_STYLE[sp] ?? SHOT_STYLE[S.lance];
      const vx = s.vx[i];
      const vy = s.vy[i];
      const x = s.x[i] - vx * back1;
      const y = s.y[i] - vy * back1;
      const speed = Math.hypot(vx, vy);
      const rot = Math.atan2(vy, vx) + Math.PI / 2;
      let al = st[3];
      if (s.maxAge[i] > 0) al *= 1 - s.age[i] / (s.maxAge[i] + 1);
      const batch = st[4] ? shots : shotsN;
      if (sp === S.wisp || sp === S.soul) {
        for (let k = 2; k >= 1; k--) batch.push(sp, x - vx * k * 0.9, y - vy * k * 0.9, 0, 1 - k * 0.22, st[0], st[1], st[2], al * (0.35 / k));
        batch.push(sp, x, y, 0, 1, st[0], st[1], st[2], al);
      } else {
        const pop = sp === S.arc ? 0.7 + 0.5 * Math.min(1, s.age[i] / 8) : 1;
        batch.push(sp, x, y, rot, pop, st[0], st[1], st[2], al, 0, 0, 1 + speed * st[5]);
      }
    }

    // ── Enemies: pop in, flap, sway, squash when hit.
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const ex = lerp(e.px, e.x, a);
      const ey = lerp(e.py, e.y, a);
      const age = e.age + a;
      const pop = e.intangible ? 1 : backOut(clamp(age / 14, 0, 1));
      let rot = e.orient || e.intangible ? Math.atan2(e.y - e.py, e.x - e.px) - Math.PI / 2 : 0;
      let sc = pop * (e.intangible ? 0.8 : 1);
      let sy = 1;
      let bob = 0;
      let al = clamp(age / 8, 0, 1);
      if (FLAPPERS.has(e.sprite)) {
        sc *= 1 + Math.sin(age * 0.55 + e.id) * 0.16;
        sy = 1 / (1 + Math.sin(age * 0.55 + e.id) * 0.1);
      } else if (SWIMMERS.has(e.sprite)) {
        rot += Math.sin(age * 0.35 + e.id) * 0.18;
      } else if (SWAYERS.has(e.sprite)) {
        rot += Math.sin(age * 0.05 + e.id) * 0.12;
        bob = Math.sin(age * 0.07 + e.id) * 2;
      } else if (e.sprite === S.remnant) {
        al *= 0.55 + 0.25 * Math.sin(age * 0.08);
        bob = Math.sin(age * 0.05) * 3;
        // A faint shimmer marks it as worth catching.
        fx.push(S.wisp, ex, ey + bob, 0, 2.2, 0.8, 0.85, 1, 0.15 + 0.08 * Math.sin(age * 0.2));
      }
      if (e.flash > 0) {
        sc *= 1.08;
        sy *= 0.9;
      }
      const lit = e.flash > 0 ? 1.7 : 1;
      actors.push(e.sprite, ex, ey + bob, rot, sc, lit, lit, lit, al, 0, 0, sy);
      if (e.charted > 0) fx.push(S.reticle, ex, ey, t * 3, (e.r * 2.4) / 16, 1, 0.85, 0.35, Math.min(1, e.charted / 30) * 0.8);
    }

    // ── Boss: breathing, leaning into movement, charging up on declarations, trailing when she dashes.
    if (boss.present && boss.def) {
      const dx = boss.x - boss.px;
      const dy = boss.y - boss.py;
      const moving = Math.hypot(dx, dy);
      if (moving > 1.6) this.bossGhosts.unshift([bx, by]);
      else this.bossGhosts.length = Math.max(0, this.bossGhosts.length - 1);
      if (this.bossGhosts.length > 8) this.bossGhosts.length = 8;
      for (let k = 2; k < this.bossGhosts.length; k += 2) {
        const [gx, gy] = this.bossGhosts[k];
        actors.push(boss.def.sprite, gx, gy, 0, 1, 0.8, 0.7, 1, 0.22 * (1 - k / 8));
      }
      const breath = Math.sin(t * 2.2);
      const lean = clamp(dx * 0.06, -0.16, 0.16);
      const bob = Math.sin(t * 3) * 3;
      let lit = boss.flash > 0 ? 1.35 : 1;
      const dt = boss.declareT;
      if (dt < 40 && boss.elegy) {
        // Charge-up: light gathers into her before the Elegy begins.
        const k = dt / 40;
        lit += (1 - k) * 0.6;
        const [r, gg, b] = PALETTE[C.rose];
        fx.push(S.ring, bx, by, 0, 3.2 * (1 - k) + 0.3, r, gg, b, k * 0.9);
        fx.push(S.wisp, bx, by, 0, 4 * k, 1, 0.85, 0.9, (1 - k) * 0.6);
      }
      const jitter = boss.defeated ? Math.sin(t * 60) * 1.5 : 0;
      const al = boss.defeated ? 0.75 : 1;
      actors.push(boss.def.sprite, bx + jitter, by + bob, lean + Math.sin(t * 1.5) * 0.03, 1 + breath * 0.012, lit, lit, lit, al, 0, 0, 1 + breath * 0.02);
      if (boss.y > 0) top.push(S.marker, bx, FIELD_H - 5, 0, 1, 1, 1, 1, 0.9);
      if (boss.charted > 0) fx.push(S.reticle, bx, by, t * 2.4, 4.2, 1, 0.85, 0.35, Math.min(1, boss.charted / 30) * 0.7);
    } else {
      this.bossGhosts.length = 0;
    }

    // ── Ondine's memory ghost: your own past self, replayed.
    const mg = g.memoryGhost;
    if (mg.active) {
      fx.push(S.ghost, mg.x, mg.y, 0, 2.6, 0.4, 0.7, 1, 0.35 + 0.1 * Math.sin(t * 8));
      actors.push(ch.sprite, mg.x, mg.y, 0, 1, 0.5, 0.75, 1, 0.35);
    }

    // ── Player: afterimages, banking, hover; options trailing on springs.
    const accent = ACCENT[ch.id];
    this.ghosts.unshift([px, py]);
    if (this.ghosts.length > 12) this.ghosts.length = 12;
    if (cs.afterimage.t > 0) {
      actors.push(ch.sprite, cs.afterimage.x, cs.afterimage.y, 0, 1, 0.6, 0.9, 1, (cs.afterimage.t / 40) * 0.45);
    }
    if (!g.over) {
      const speed = Math.hypot(p.x - p.px, p.y - p.py);
      if (speed > 2.5 && !p.focus) {
        for (let k = 3; k <= 9; k += 3) {
          const gp = this.ghosts[k];
          if (gp) actors.push(ch.sprite, gp[0], gp[1], 0, 1, accent[0], accent[1], accent[2], 0.22 * (1 - k / 11));
        }
      }
      const blink = p.invuln > 0 && Math.floor(f / 3) % 2 === 0;
      const alpha = blink ? 0.35 : 1;
      const bank = clamp(p.vxSmooth / ch.speed, -1, 1);
      const hover = Math.sin(t * 3.1) * 1.2;
      actors.push(ch.sprite, px, py + hover, bank * 0.16, 1 - Math.abs(bank) * 0.06, 1, 1, 1, alpha, 0, 0, 1 + Math.abs(bank) * 0.05);
      if (ch.id === 'tessel') {
        cs.dolls.forEach((d, i) => {
          const dx2 = lerp(p.emittersPrev[i][0], p.emitters[i][0], a);
          const dy2 = lerp(p.emittersPrev[i][1], p.emitters[i][1], a);
          const cracked = d.crack > 0;
          const shake = !cracked && d.absorbed > 3 ? Math.sin(t * 50) * 0.15 : Math.sin(t * 2 + i) * 0.08;
          const c2 = cracked ? 0.5 : 1;
          actors.push(S.doll, dx2, dy2, shake, 1, c2, c2, cracked ? 0.55 : 1, (cracked ? 0.45 : 1) * alpha);
        });
      } else {
        for (let i = 0; i < p.emitterCount; i++) {
          const ox = lerp(p.emittersPrev[i][0], p.emitters[i][0], a);
          const oy = lerp(p.emittersPrev[i][1], p.emitters[i][1], a);
          actors.push(ch.optionSprite, ox, oy, t * 1.5 + i, 1 + Math.sin(t * 5 + i) * 0.06, 1, 1, 1, alpha);
        }
      }
      // Focus aura: a thin ring tightens around her as she slows down.
      if (p.focusBlend > 0.02) {
        const fb = p.focusBlend;
        fx.push(S.ring, px, py, t, 0.42 - fb * 0.1, accent[0], accent[1], accent[2], fb * 0.45);
      }
    }
    if (g.bomb.active && ch.id === 'tessel') {
      for (const o of cs.bombObjs) if (o.alive) actors.push(S.doll, o.x, o.y, t * 12, 1.1, 1, 0.9, 0.9, 1);
    }

    // ── Items: bobbing; the ones flying to you stretch toward you.
    const it = g.items;
    for (let i = 0; i < it.n; i++) {
      const ty = it.type[i];
      const ix = lerp(it.px[i], it.x[i], a);
      const iy = lerp(it.py[i], it.y[i], a);
      const age = it.age[i] + a;
      const pop = backOut(clamp(age / 10, 0, 1));
      let rot = 0;
      let sy = 1;
      let bob = 0;
      if (it.homing[i]) {
        rot = Math.atan2(py - iy, px - ix) - Math.PI / 2;
        sy = 1.35;
      } else {
        bob = Math.sin(age * 0.12 + i) * 1.2;
      }
      if (ty === IT.star) rot = age * 0.15;
      if (ty === IT.recollection) {
        // A slow heartbeat of light around the shard.
        const beat = 0.5 + 0.5 * Math.sin(age * 0.12);
        fx.push(S.wisp, ix, iy + bob, 0, 2.4 + beat * 0.8, 0.85, 0.9, 1, 0.35 + beat * 0.25);
        rot = Math.sin(age * 0.05) * 0.3;
      }
      items.push(ITEM_SPRITE[ty], ix, iy + bob, rot, pop, 1, 1, 1, 1, 0, 0, sy);
    }

    // ── Enemy bullets: interpolated along their heading; elongated ones stretch with speed.
    const bl = g.bullets;
    for (let i = 0; i < bl.n; i++) {
      const bt = BULLET_TYPES[bl.type[i]];
      const col = PALETTE[bl.color[i]];
      const ang = bl.angle[i];
      const spd = bl.speed[i];
      const x = bl.x[i] - Math.cos(ang) * spd * back1;
      const y = bl.y[i] - Math.sin(ang) * spd * back1;
      const age = bl.age[i];
      let al = 1;
      let sc = 1;
      if (age < SPAWN_GRACE) {
        const k = (age + a) / SPAWN_GRACE;
        al = 0.3 + 0.7 * k;
        sc = 1.7 - 0.7 * k;
      }
      const rot = bt.orient ? ang + Math.PI / 2 : bl.type[i] === BT.coin ? age * 0.08 : 0;
      const sy = bt.orient ? 1 + Math.min(0.35, spd * 0.06) : 1;
      if (bl.type[i] === BT.big) shots.push(S.wisp, x, y, 0, 2.6 * sc, col[0], col[1], col[2], 0.35 * al);
      bullets.push(bt.sprite, x, y, rot, sc, col[0], col[1], col[2], al, bt.w, bt.h, sy);
    }

    // ── Lasers: warning line, snap open, fade.
    const lz = g.lasers;
    for (let i = 0; i < lz.n; i++) {
      const len = lz.length[i];
      const rot = lz.angle[i];
      const cx = lz.x[i] + Math.cos(rot) * len * 0.5;
      const cy = lz.y[i] + Math.sin(rot) * len * 0.5;
      const lt = lz.t[i] + a;
      const ph = lz.phase(i);
      const col = PALETTE[lz.color[i]];
      if (ph === 0) {
        const blink = 0.35 + 0.35 * Math.sin(lt * 0.5);
        const ramp = clamp(lt / lz.warn[i], 0, 1);
        fx.push(S.beam, cx, cy, rot, 1, col[0], col[1], col[2], blink * (0.4 + ramp * 0.6), len, 3 + ramp * 3);
        continue;
      }
      const open = ph === 1 ? backOut(clamp((lt - lz.warn[i]) / 7, 0, 1)) : 1 - clamp((lt - lz.warn[i] - lz.active[i]) / LaserPool.FADE, 0, 1);
      const w = lz.width[i] * open;
      if (lz.style[i] === 1) {
        // Redaction: a black bar with a pale, trembling edge.
        bullets.push(S.white, cx, cy, rot, 1, 0.03, 0.02, 0.05, 0.94, len, w);
        const edge = 0.6 + 0.3 * Math.sin(lt * 0.9 + i);
        for (const side of [-1, 1]) {
          const ox = -Math.sin(rot) * side * w * 0.5;
          const oy = Math.cos(rot) * side * w * 0.5;
          fx.push(S.beam, cx + ox, cy + oy, rot, 1, 1, 0.92, 0.85, edge * open, len, 5);
        }
      } else {
        fx.push(S.beam, cx, cy, rot, 1, col[0], col[1], col[2], open, len, w * 1.6);
      }
    }

    // ── Effects.
    const e = g.fx;
    for (let i = 0; i < e.n; i++) {
      const k = 1 - e.life[i] / e.maxLife[i];
      const sc = e.s0[i] + (e.s1[i] - e.s0[i]) * k;
      const col = PALETTE[e.color[i]];
      fx.push(e.sprite[i], e.x[i] + e.vx[i] * a, e.y[i] + e.vy[i] * a, e.rot[i], sc, col[0], col[1], col[2], e.a0[i] * (1 - k));
    }
    const bomb = g.bomb;
    if (bomb.active && ch.id === 'wren') {
      fx.push(S.boat, bomb.x, bomb.y, Math.sin(t * 3) * 0.05, 1, 1, 1, 1, 0.9);
    }
    if (bomb.active && ch.id === 'sayo') {
      const al = bomb.t < 120 ? 1 : 1 - (bomb.t - 120) / 40;
      const [r, gg, b] = PALETTE[C.amber];
      fx.push(S.ring, px, py, 0, (bomb.r * 2) / 128, r, gg, b, al);
      fx.push(S.ring, px, py, t * 1.2, (bomb.r * 1.4) / 128, 1, 0.9, 0.6, al * 0.6);
    }
    const flash = this.reduceFlash ? g.flash * 0.25 : g.flash;
    if (flash > 0) fx.push(S.white, FIELD_W / 2, FIELD_H / 2, 0, 1, 1, 0.85, 0.7, flash * 0.5, FIELD_W, FIELD_H);

    // ── Hitbox while focused: pops in, spins.
    if (!g.over && (p.focus || p.deathTimer >= 0)) {
      const pop = backOut(clamp(p.focusBlend * 1.3, 0, 1));
      top.push(S.hitbox, px, py, t * 3, 0.85 * Math.max(0.2, pop));
    }

    for (const b of this.all) b.end();
  }
}
