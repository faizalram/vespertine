import * as THREE from 'three';
import { BULLET_TYPES } from '../game/bulletTypes';
import { FIELD_H, FIELD_W, SPAWN_GRACE } from '../game/constants';
import { IT } from '../game/defs';
import { SAYO, type Game } from '../game/game';
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
    this.actors = new SpriteBatch(160, tex, r, false, 1);
    this.items = new SpriteBatch(1024, tex, r, false, 2);
    this.bullets = new SpriteBatch(4096, tex, r, false, 3);
    this.fx = new SpriteBatch(3200, tex, r, true, 4);
    this.top = new SpriteBatch(16, tex, r, false, 5);
    this.all = [this.back, this.shots, this.actors, this.items, this.bullets, this.fx, this.top];
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
    const { back, shots, actors, items, bullets, fx, top } = this;
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

    // Vigil ward.
    const v = g.vigil;
    if (v.active) {
      const k = v.t / SAYO.vigilFrames;
      const appear = Math.min(1, v.t / 12);
      const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
      const [r, gg, b] = PALETTE[C.amber];
      shots.push(S.ward, v.x, v.y, f * 0.01, (SAYO.vigilRadius * 2 * (0.6 + 0.4 * appear)) / 64, r, gg, b, 0.85 * fade);
    }

    // Player shots.
    const s = g.shots;
    const amb = PALETTE[C.amber];
    for (let i = 0; i < s.n; i++) {
      if (s.sprite[i] === S.wisp) shots.push(S.wisp, s.x[i], s.y[i], 0, 1, amb[0], amb[1], amb[2], 0.75);
      else shots.push(S.lance, s.x[i], s.y[i], Math.atan2(s.vy[i], s.vx[i]) + Math.PI / 2, 1, 1, 0.8, 0.5, 0.55);
    }

    // Enemies.
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const rot = e.orient || e.intangible ? Math.atan2(e.vy, e.vx) - Math.PI / 2 : Math.sin((f + e.x) * 0.05) * 0.12;
      const lit = e.flash > 0 ? 1.6 : 1;
      const sc = e.intangible ? 0.8 : 1;
      actors.push(e.sprite, e.x, e.y, rot, sc, lit, lit, lit, 1);
    }

    // Boss.
    if (boss.present && boss.def) {
      const bob = Math.sin(f * 0.05) * 3;
      const lit = boss.flash > 0 ? 1.35 : 1;
      const a = boss.defeated ? 0.75 : 1;
      actors.push(boss.def.sprite, boss.x, boss.y + bob, Math.sin(f * 0.03) * 0.04, 1, lit, lit, lit, a);
      if (boss.y > 0) top.push(S.marker, boss.x, FIELD_H - 5, 0, 1, 1, 1, 1, 0.9);
    }

    // Player and emitters.
    if (!g.over) {
      const blink = p.invuln > 0 && Math.floor(f / 3) % 2 === 0;
      const alpha = blink ? 0.35 : 1;
      actors.push(S.sayo, p.x, p.y, 0, 1, 1, 1, 1, alpha);
      for (let i = 0; i < p.emitterCount; i++) actors.push(S.emitter, p.emitters[i][0], p.emitters[i][1], 0, 1, 1, 1, 1, alpha);
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
    if (bomb.active) {
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
