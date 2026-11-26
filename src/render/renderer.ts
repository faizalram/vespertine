import * as THREE from 'three';
import { BULLET_TYPES } from '../game/bulletTypes';
import { FIELD_H, FIELD_W, SPAWN_GRACE } from '../game/constants';
import { IT } from '../game/defs';
import { pinSegments } from '../game/characters';
import type { Game } from '../game/game';
import { C, PALETTE } from '../game/palette';
import { S } from '../game/sprites';
import { buildAtlas } from './atlas';
import { Stage1Background } from './background';
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
};

/** Player shot tints by sprite: [r, g, b, alpha, additive]. */
const SHOT_STYLE: Record<number, readonly [number, number, number, number, boolean]> = {
  [S.lance]: [1, 0.8, 0.5, 0.55, true],
  [S.wisp]: [1, 0.62, 0.18, 0.75, true],
  [S.ray]: [1, 0.9, 0.45, 0.8, true],
  [S.ink]: [0.16, 0.22, 0.55, 0.95, false],
  [S.needle]: [1, 0.62, 0.55, 0.7, true],
  [S.arc]: [0.75, 1, 0.95, 0.85, true],
  [S.soul]: [0.35, 1, 0.9, 0.8, true],
};

/**
 * Two layers composed into the playfield viewport:
 *  1. a 3D perspective background scene;
 *  2. a flat orthographic sprite scene in field units (y down) for everything
 *     that can interact with the player.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly bg = new Stage1Background();
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
    this.back = new SpriteBatch(8, tex, r, false, -1);
    this.shots = new SpriteBatch(1024, tex, r, true, 0);
    this.shotsN = new SpriteBatch(512, tex, r, false, 0.5);
    this.actors = new SpriteBatch(160, tex, r, false, 1);
    this.items = new SpriteBatch(1024, tex, r, false, 2);
    this.bullets = new SpriteBatch(4096, tex, r, false, 3);
    this.fx = new SpriteBatch(3200, tex, r, true, 4);
    this.top = new SpriteBatch(16, tex, r, false, 5);
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

  /** Advance purely visual state (background scroll). */
  updateVisuals(dt: number, g: Game | null): void {
    this.bg.shake = g ? g.shake : 0;
    // The world slows to a drift while a boss holds the sky.
    const targetSpeed = g && g.boss.present ? 2 : 7;
    this.bg.speed += (targetSpeed - this.bg.speed) * Math.min(1, dt * 1.5);
    const elegy = g && g.boss.present && g.boss.elegy ? 1 : 0;
    this.elegyFade += (elegy - this.elegyFade) * Math.min(1, dt * 3);
    this.bg.update(dt);
  }

  render(g: Game | null, field: Rect, cssH: number): void {
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
      this.fill(g);
      const sh = g.shake;
      this.cam.position.x = sh > 0 ? (Math.random() - 0.5) * sh : 0;
      this.cam.position.y = sh > 0 ? (Math.random() - 0.5) * sh : 0;
      gl.clearDepth();
      gl.render(this.scene, this.cam);
    }
    gl.setScissorTest(false);
    this.drawCalls = gl.info.render.calls;
  }

  private fill(g: Game): void {
    const { back, shots, shotsN, actors, items, bullets, fx, top } = this;
    for (const b of this.all) b.begin();
    const p = g.player;
    const f = g.frame;
    const boss = g.boss;

    // Elegy backdrop: the dusk dims and a slow sigil turns behind the boss.
    if (this.elegyFade > 0.01) {
      back.push(S.white, FIELD_W / 2, FIELD_H / 2, 0, 1, 0.1, 0.04, 0.14, 0.5 * this.elegyFade, FIELD_W, FIELD_H);
      const [r, gg, b] = PALETTE[C.rose];
      shots.push(S.ward, boss.x, boss.y, f * 0.004, 4.2, r, gg, b, 0.22 * this.elegyFade);
      shots.push(S.ward, boss.x, boss.y, -f * 0.006, 2.6, r, gg, b, 0.18 * this.elegyFade);
    }
    // Dialogue: dim the field a little so the text reads.
    if (g.dialogue) back.push(S.white, FIELD_W / 2, FIELD_H / 2, 0, 1, 0.05, 0.03, 0.08, 0.3, FIELD_W, FIELD_H);

    const ch = g.char;
    const cs = g.cs;

    // Sayo: Vigil ward.
    const v = cs.vigil;
    if (v.active) {
      const k = v.t / 300;
      const appear = Math.min(1, v.t / 12);
      const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
      const [r, gg, b] = PALETTE[C.amber];
      shots.push(S.ward, v.x, v.y, f * 0.01, (56 * 2 * (0.6 + 0.4 * appear)) / 64, r, gg, b, 0.85 * fade);
    }

    // Ilse: survey pins and the ink lines between them.
    if (cs.pins.length) {
      for (const [ax, ay, bx, by] of pinSegments(g)) {
        const len = Math.hypot(bx - ax, by - ay);
        const rot = Math.atan2(by - ay, bx - ax);
        const pulse = 0.55 + 0.25 * Math.sin(f * 0.15);
        shotsN.push(S.white, (ax + bx) / 2, (ay + by) / 2, rot, 1, 0.1, 0.13, 0.3, 0.85, len, 3);
        shots.push(S.white, (ax + bx) / 2, (ay + by) / 2, rot, 1, 1, 0.8, 0.35, pulse, len, 1.5);
      }
      for (const pin of cs.pins) {
        const fade = pin.age > 840 ? (900 - pin.age) / 60 : 1;
        shotsN.push(S.pin, pin.x, pin.y - 6, 0, 1, 1, 1, 1, fade);
      }
    }

    // Wren: Requiem aura and the bell's ring.
    if (cs.requiem > 0) {
      const a = Math.min(1, cs.requiem / 40) * (0.35 + 0.15 * Math.sin(f * 0.2));
      shots.push(S.wisp, p.x, p.y, 0, 3.4, 0.3, 1, 0.85, a);
    }
    if (cs.bell.t > 0) {
      const k = 1 - cs.bell.t / 40;
      shots.push(S.ring, cs.bell.x, cs.bell.y, 0, ((96 * 2) / 128) * (0.3 + 0.7 * k), 0.4, 1, 0.9, 1 - k);
    }

    // Player shots.
    const s = g.shots;
    for (let i = 0; i < s.n; i++) {
      const sp = s.sprite[i];
      const st = SHOT_STYLE[sp] ?? SHOT_STYLE[S.lance];
      const rot = sp === S.wisp || sp === S.soul ? 0 : Math.atan2(s.vy[i], s.vx[i]) + Math.PI / 2;
      let a = st[3];
      if (s.maxAge[i] > 0) a *= 1 - s.age[i] / (s.maxAge[i] + 1);
      (st[4] ? shots : shotsN).push(sp, s.x[i], s.y[i], rot, 1, st[0], st[1], st[2], a);
    }

    // Enemies.
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const rot = e.orient || e.intangible ? Math.atan2(e.vy, e.vx) - Math.PI / 2 : Math.sin((f + e.x) * 0.05) * 0.12;
      const lit = e.flash > 0 ? 1.6 : 1;
      const sc = e.intangible ? 0.8 : 1;
      actors.push(e.sprite, e.x, e.y, rot, sc, lit, lit, lit, 1);
      if (e.charted > 0) fx.push(S.reticle, e.x, e.y, f * 0.05, (e.r * 2.4) / 16, 1, 0.85, 0.35, Math.min(1, e.charted / 30) * 0.8);
    }

    // Boss.
    if (boss.present && boss.def) {
      const bob = Math.sin(f * 0.05) * 3;
      const lit = boss.flash > 0 ? 1.35 : 1;
      const a = boss.defeated ? 0.75 : 1;
      actors.push(boss.def.sprite, boss.x, boss.y + bob, Math.sin(f * 0.03) * 0.04, 1, lit, lit, lit, a);
      if (boss.y > 0) top.push(S.marker, boss.x, FIELD_H - 5, 0, 1, 1, 1, 1, 0.9);
      if (boss.charted > 0) fx.push(S.reticle, boss.x, boss.y, f * 0.04, 4.2, 1, 0.85, 0.35, Math.min(1, boss.charted / 30) * 0.7);
    }

    // Player and emitters.
    if (cs.afterimage.t > 0) {
      actors.push(ch.sprite, cs.afterimage.x, cs.afterimage.y, 0, 1, 0.6, 0.9, 1, (cs.afterimage.t / 40) * 0.45);
    }
    if (!g.over) {
      const blink = p.invuln > 0 && Math.floor(f / 3) % 2 === 0;
      const alpha = blink ? 0.35 : 1;
      actors.push(ch.sprite, p.x, p.y, 0, 1, 1, 1, 1, alpha);
      if (ch.id === 'tessel') {
        for (const d of cs.dolls) {
          const cracked = d.crack > 0;
          const shake = !cracked && d.absorbed > 3 ? Math.sin(f * 1.3) * 0.15 : 0;
          actors.push(S.doll, d.x, d.y, shake, 1, cracked ? 0.5 : 1, cracked ? 0.5 : 1, cracked ? 0.55 : 1, (cracked ? 0.45 : 1) * alpha);
        }
      } else {
        for (let i = 0; i < p.emitterCount; i++) actors.push(ch.optionSprite, p.emitters[i][0], p.emitters[i][1], 0, 1, 1, 1, 1, alpha);
      }
    }
    // Litany parts: Tessel's spare dolls.
    if (g.bomb.active && ch.id === 'tessel') {
      for (const o of cs.bombObjs) if (o.alive) actors.push(S.doll, o.x, o.y, f * 0.2, 1.1, 1, 0.9, 0.9, 1);
    }

    // Items (under bullets so bullets always stay readable).
    const it = g.items;
    for (let i = 0; i < it.n; i++) {
      const t = it.type[i];
      const rot = t === IT.star ? (f + i) * 0.15 : 0;
      items.push(ITEM_SPRITE[t], it.x[i], it.y[i], rot, 1, 1, 1, 1, 1);
    }

    // Enemy bullets.
    const bl = g.bullets;
    for (let i = 0; i < bl.n; i++) {
      const t = BULLET_TYPES[bl.type[i]];
      const col = PALETTE[bl.color[i]];
      const age = bl.age[i];
      let a = 1;
      let sc = 1;
      if (age < SPAWN_GRACE) {
        const k = age / SPAWN_GRACE;
        a = 0.3 + 0.7 * k;
        sc = 1.6 - 0.6 * k;
      }
      const rot = t.orient ? bl.angle[i] + Math.PI / 2 : 0;
      bullets.push(t.sprite, bl.x[i], bl.y[i], rot, sc, col[0], col[1], col[2], a, t.w, t.h);
    }

    // Effects.
    const e = g.fx;
    for (let i = 0; i < e.n; i++) {
      const k = 1 - e.life[i] / e.maxLife[i];
      const sc = e.s0[i] + (e.s1[i] - e.s0[i]) * k;
      const col = PALETTE[e.color[i]];
      fx.push(e.sprite[i], e.x[i], e.y[i], e.rot[i], sc, col[0], col[1], col[2], e.a0[i] * (1 - k));
    }
    const bomb = g.bomb;
    if (bomb.active && ch.id === 'wren') {
      fx.push(S.boat, bomb.x, bomb.y, Math.sin(f * 0.05) * 0.05, 1, 1, 1, 1, 0.9);
    }
    if (bomb.active && ch.id === 'sayo') {
      const a = bomb.t < 120 ? 1 : 1 - (bomb.t - 120) / 40;
      const [r, gg, b] = PALETTE[C.amber];
      fx.push(S.ring, p.x, p.y, 0, (bomb.r * 2) / 128, r, gg, b, a);
      fx.push(S.ring, p.x, p.y, f * 0.02, (bomb.r * 1.4) / 128, 1, 0.9, 0.6, a * 0.6);
    }
    const flash = this.reduceFlash ? g.flash * 0.25 : g.flash;
    if (flash > 0) fx.push(S.white, FIELD_W / 2, FIELD_H / 2, 0, 1, 1, 0.85, 0.7, flash * 0.5, FIELD_W, FIELD_H);

    // Hitbox while focused.
    if (!g.over && (p.focus || p.deathTimer >= 0)) top.push(S.hitbox, p.x, p.y, f * 0.05, 0.85);

    for (const b of this.all) b.end();
  }
}
