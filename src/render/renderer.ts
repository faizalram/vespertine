import * as THREE from 'three';
import { BULLET_TYPES } from '../game/bulletTypes';
import { FIELD_H, FIELD_W, SPAWN_GRACE } from '../game/constants';
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
  private readonly shots: SpriteBatch;
  private readonly actors: SpriteBatch;
  private readonly bullets: SpriteBatch;
  private readonly fx: SpriteBatch;
  private readonly top: SpriteBatch;
  private pixelRatio: number;
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

    this.shots = new SpriteBatch(1024, tex, atlas.regions, true, 0);
    this.actors = new SpriteBatch(64, tex, atlas.regions, false, 1);
    this.bullets = new SpriteBatch(4096, tex, atlas.regions, false, 2);
    this.fx = new SpriteBatch(3200, tex, atlas.regions, true, 3);
    this.top = new SpriteBatch(16, tex, atlas.regions, false, 4);
    for (const b of [this.shots, this.actors, this.bullets, this.fx, this.top]) this.scene.add(b.mesh);
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
    const { shots, actors, bullets, fx, top } = this;
    for (const b of [shots, actors, bullets, fx, top]) b.begin();
    const p = g.player;
    const f = g.frame;

    // Vigil ward (under everything else that glows).
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
      const rot = Math.atan2(s.vy[i], s.vx[i]) + Math.PI / 2;
      if (s.sprite[i] === S.wisp) shots.push(S.wisp, s.x[i], s.y[i], 0, 1, amb[0], amb[1], amb[2], 0.75);
      else shots.push(S.lance, s.x[i], s.y[i], rot, 1, 1, 0.8, 0.5, 0.55);
    }

    // Boss.
    const boss = g.boss;
    if (boss.present) {
      const bob = Math.sin(f * 0.05) * 3;
      actors.push(S.effigy, boss.x, boss.y + bob, Math.sin(f * 0.03) * 0.05, 1);
    }

    // Player and emitters.
    if (!g.over) {
      const blink = p.invuln > 0 && Math.floor(f / 3) % 2 === 0;
      const alpha = blink ? 0.35 : 1;
      actors.push(S.sayo, p.x, p.y, 0, 1, 1, 1, 1, alpha);
      for (const [ex, ey] of p.emitters) actors.push(S.emitter, ex, ey, 0, 1, 1, 1, 1, alpha);
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
    if (!g.over && (p.focus || p.deathTimer >= 0)) {
      top.push(S.hitbox, p.x, p.y, f * 0.05, 0.85);
    }

    for (const b of [shots, actors, bullets, fx, top]) b.end();
  }
}
