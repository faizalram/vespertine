import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FIELD_H, FIELD_W } from '../game/constants';

/**
 * 3D backdrops (spec §8.1). Gameplay stays flat; the world around it moves.
 * Every stage shares a camera rig that leans with the player, pulls in when a
 * boss arrives, rolls on Elegy declarations and punches on bombs.
 */

export interface CameraCues {
  /** Player's horizontal offset from centre, -1..1. */
  lean: number;
  /** Player's smoothed horizontal speed, roughly -1..1. */
  bank: number;
  bossPresent: boolean;
  elegy: boolean;
  /** Frames since an Elegy was declared. */
  declareT: number;
  shake: number;
  /** Bomb flash strength 0..1 (drives the FOV punch). */
  punch: number;
}

export const NO_CUES: CameraCues = { lean: 0, bank: 0, bossPresent: false, elegy: false, declareT: 999, shake: 0, punch: 0 };

const TAU = Math.PI * 2;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Deterministic hash noise for decoration placement. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function glowTexture(inner: string, mid: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.25, mid);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ─────────────────────────────── sky ───────────────────────────────

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uZen, uMid, uHor, uSunCol;
uniform vec3 uSun, uMoon;
uniform float uSunSize, uMoonSize, uTime;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float e = d.y;
  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.14, e));
  col = mix(col, uZen, smoothstep(0.14, 0.55, e));
  col = mix(col, uHor * 0.3, smoothstep(0.0, -0.15, e));
  float band = sin(d.x * 9.0 + uTime * 0.03) * sin(e * 60.0 + d.x * 4.0);
  col = mix(col, col * 0.8, smoothstep(0.6, 1.0, band) * smoothstep(0.02, 0.08, e) * (1.0 - smoothstep(0.1, 0.25, e)));
  float sd = max(dot(d, uSun), 0.0);
  col += uSunCol * pow(sd, 18.0) * 0.55 * uSunSize;
  col += uSunCol * pow(sd, 300.0) * 0.6 * uSunSize;
  col = mix(col, uSunCol * 1.1, smoothstep(0.9985, 0.9989, sd) * step(-0.004, e) * step(0.01, uSunSize));
  float md = max(dot(d, uMoon), 0.0);
  float mr = 1.0 - 0.0006 * uMoonSize;
  col += vec3(0.75, 0.72, 0.9) * pow(md, 600.0 / uMoonSize) * 0.25;
  float disk = smoothstep(mr - 0.00015, mr, md);
  float limb = smoothstep(mr, 1.0, md);
  col = mix(col, mix(vec3(0.70, 0.66, 0.80), vec3(0.93, 0.91, 0.97), limb), disk * 0.8);
  gl_FragColor = vec4(col, 1.0);
}`;

interface SkyOpts {
  zen: number;
  mid: number;
  hor: number;
  sunCol: number;
  sun: THREE.Vector3;
  moon: THREE.Vector3;
  sunSize: number;
  moonSize: number;
}

function makeSky(o: SkyOpts): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial } {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZen: { value: new THREE.Color(o.zen) },
      uMid: { value: new THREE.Color(o.mid) },
      uHor: { value: new THREE.Color(o.hor) },
      uSunCol: { value: new THREE.Color(o.sunCol) },
      uSun: { value: o.sun.clone().normalize() },
      uMoon: { value: o.moon.clone().normalize() },
      uSunSize: { value: o.sunSize },
      uMoonSize: { value: o.moonSize },
      uTime: { value: 0 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  mesh.renderOrder = -1;
  return { mesh, mat };
}

// ─────────────────────────────── base ───────────────────────────────

export abstract class StageBackground {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  /** World units per second. */
  speed = 7;
  protected time = 0;
  protected scroll = 0;
  /** Total distance travelled (not wrapped), for surfaces that scroll in a shader. */
  protected travel = 0;
  protected readonly tileLength: number;
  protected readonly tiles: THREE.Object3D[] = [];
  protected base = { x: 0, y: 10, z: 6, rx: -0.33, fov: 58 };
  protected sky?: THREE.Mesh;
  protected skyMat?: THREE.ShaderMaterial;
  private leanS = 0;
  private bankS = 0;
  private roll = 0;
  private rollV = 0;
  private fovS = 58;
  private lastDeclare = 999;
  private shakeT = 0;
  cruiseSpeed = 7;

  constructor(tileLength: number, fov = 58) {
    this.tileLength = tileLength;
    this.camera = new THREE.PerspectiveCamera(fov, FIELD_W / FIELD_H, 0.5, 600);
    this.fovS = fov;
    this.base.fov = fov;
  }

  update(dt: number, cues: CameraCues): void {
    this.time += dt;
    // The world slows to a drift while a boss holds the sky.
    const targetSpeed = cues.bossPresent ? this.cruiseSpeed * 0.28 : this.cruiseSpeed;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 1.5);
    this.scroll = (this.scroll + this.speed * dt) % this.tileLength;
    this.travel += this.speed * dt;
    for (let k = 0; k < this.tiles.length; k++) this.tiles[k].position.z = this.scroll - k * this.tileLength + 12;
    if (this.skyMat) this.skyMat.uniforms.uTime.value = this.time;
    this.animate(dt);
    this.updateCamera(dt, cues);
  }

  /** Per-stage decoration animation. */
  protected abstract animate(dt: number): void;

  private updateCamera(dt: number, cues: CameraCues): void {
    const k = Math.min(1, dt * 2.5);
    this.leanS += (cues.lean - this.leanS) * k;
    this.bankS += (cues.bank - this.bankS) * Math.min(1, dt * 4);
    // Elegy declaration: a springy roll and a slow push-in.
    if (cues.declareT < this.lastDeclare && cues.declareT < 5) this.rollV += 0.5;
    this.lastDeclare = cues.declareT;
    this.rollV += -this.roll * 40 * dt;
    this.rollV *= Math.exp(-3.5 * dt);
    this.roll += this.rollV * dt;
    const targetFov = this.base.fov - (cues.bossPresent ? 5 : 0) - (cues.elegy ? 2 : 0) + cues.punch * 7;
    this.fovS += (targetFov - this.fovS) * Math.min(1, dt * (cues.punch > 0.3 ? 12 : 2));
    const cam = this.camera;
    if (Math.abs(cam.fov - this.fovS) > 0.01) {
      cam.fov = this.fovS;
      cam.updateProjectionMatrix();
    }
    this.shakeT += dt * 60;
    const sh = cues.shake * 0.06;
    const sway = Math.sin(this.time * 0.13);
    cam.position.x = this.base.x + this.leanS * 3.2 + sway * 1.2 + (sh ? Math.sin(this.shakeT * 1.7) * sh : 0);
    cam.position.y = this.base.y + Math.sin(this.time * 0.21) * 0.5 + (sh ? Math.cos(this.shakeT * 2.3) * sh : 0);
    cam.position.z = this.base.z;
    cam.rotation.set(this.base.rx + Math.sin(this.time * 0.17) * 0.01, -this.leanS * 0.05, -this.bankS * 0.045 - this.leanS * 0.02 + this.roll * 0.12 + Math.sin(this.time * 0.11) * 0.02);
    if (this.sky) this.sky.position.copy(cam.position);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
  }
}

// ─────────────────────────────── Stage 1: fields ───────────────────────────────

const L1 = 120;
const HALF_W = 48;

function rawHeight(x: number, z: number): number {
  const p = (z / L1) * TAU;
  return Math.abs(x) * 0.3 + 2.2 * Math.sin(x * 0.13 + Math.sin(p * 2) * 1.6) + 1.6 * Math.cos(p * 3 + x * 0.07) + 1.1 * Math.sin(p * 5 - x * 0.05) - 4;
}

function terraceHeight(x: number, z: number): number {
  const v = rawHeight(x, z);
  const step = 1.3;
  const q = Math.floor(v / step);
  return (q + smoothstep(0.78, 1, v / step - q)) * step;
}

function buildTerrain(): THREE.BufferGeometry {
  const SEG_X = 64;
  const SEG_Z = 96;
  const tris = SEG_X * SEG_Z * 2;
  const pos = new Float32Array(tris * 9);
  const nor = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  const dx = (HALF_W * 2) / SEG_X;
  const dz = L1 / SEG_Z;
  const waterHi = new THREE.Color(0.95, 0.55, 0.45);
  const waterLo = new THREE.Color(0.42, 0.24, 0.42);
  const bank = new THREE.Color(0.16, 0.1, 0.16);
  const rice = new THREE.Color(0.42, 0.36, 0.2);
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  let o = 0;
  const pushTri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) => {
    v[0].set(ax, terraceHeight(ax, az), az);
    v[1].set(bx, terraceHeight(bx, bz), bz);
    v[2].set(cx, terraceHeight(cx, cz), cz);
    e1.subVectors(v[1], v[0]);
    e2.subVectors(v[2], v[0]);
    n.crossVectors(e1, e2).normalize();
    if (n.y < 0) n.negate();
    const avgY = (v[0].y + v[1].y + v[2].y) / 3;
    if (n.y > 0.985) c.copy(waterLo).lerp(waterHi, smoothstep(-4, 10, avgY) * 0.8 + 0.1 * Math.sin(ax * 0.7 + az * 0.3));
    else if (n.y > 0.8) c.copy(rice).lerp(bank, 0.4);
    else c.copy(bank);
    for (let k = 0; k < 3; k++) {
      pos.set([v[k].x, v[k].y, v[k].z], o);
      nor.set([n.x, n.y, n.z], o);
      col.set([c.r, c.g, c.b], o);
      o += 3;
    }
  };
  for (let iz = 0; iz < SEG_Z; iz++) {
    for (let ix = 0; ix < SEG_X; ix++) {
      const x0 = -HALF_W + ix * dx;
      const z0 = -iz * dz;
      pushTri(x0, z0, x0 + dx, z0, x0, z0 - dz);
      pushTri(x0 + dx, z0, x0 + dx, z0 - dz, x0, z0 - dz);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Floating glow particles that drift with the world (lanterns, pages, embers). */
class Drifters {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  constructor(
    private readonly count: number,
    private readonly box: { x: number; y0: number; y1: number; z0: number; z1: number },
    tex: THREE.Texture,
    color: number,
    size: number,
    private readonly rise: number,
    additive = true,
  ) {
    this.pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = (hash(i) - 0.5) * 2 * box.x;
      this.pos[i * 3 + 1] = box.y0 + hash(i + 50) * (box.y1 - box.y0);
      this.pos[i * 3 + 2] = box.z0 + hash(i + 99) * (box.z1 - box.z0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        map: tex, size, sizeAttenuation: true, transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, color, fog: !additive,
      }),
    );
    this.points.frustumCulled = false;
  }

  update(dt: number, speed: number, time: number): void {
    const p = this.pos;
    const b = this.box;
    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      p[j + 2] += speed * dt;
      p[j + 1] += dt * this.rise;
      p[j] += Math.sin(time * 0.5 + i) * dt * 0.4;
      if (p[j + 2] > b.z1) p[j + 2] -= b.z1 - b.z0;
      if (this.rise > 0 && p[j + 1] > b.y1) p[j + 1] = b.y0;
      if (this.rise < 0 && p[j + 1] < b.y0) p[j + 1] = b.y1;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}

export class FieldsBackground extends StageBackground {
  private readonly lanterns: Drifters;

  constructor() {
    super(L1);
    const fogColor = new THREE.Color(0.55, 0.3, 0.36);
    this.scene.fog = new THREE.Fog(fogColor, 28, 175);
    this.scene.add(new THREE.HemisphereLight(0xc49ac0, 0x1c0f22, 1.6));
    const sun = new THREE.DirectionalLight(0xffa070, 1.4);
    sun.position.set(-4, 3, -12);
    this.scene.add(sun);

    const terrainGeo = buildTerrain();
    const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const post = new THREE.BoxGeometry(0.16, 2.4, 0.16).translate(0, 1.2, 0);
    const bar = new THREE.BoxGeometry(1.7, 0.12, 0.12).translate(0, 1.7, 0);
    const hat = new THREE.ConeGeometry(0.62, 0.42, 7).translate(0, 2.55, 0);
    const head = new THREE.BoxGeometry(0.34, 0.34, 0.2).translate(0, 2.2, 0);
    const crowGeo = mergeGeometries([post, bar, hat, head])!;
    const crowMat = new THREE.MeshLambertMaterial({ color: 0x1a0e1e });
    for (let k = 0; k < 3; k++) {
      const tile = new THREE.Group();
      tile.add(new THREE.Mesh(terrainGeo, terrainMat));
      const count = 14;
      const crows = new THREE.InstancedMesh(crowGeo, crowMat, count);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * (5 + ((i * 7.31) % 26));
        const z = -((i * 37.7) % L1);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((i * 1.3) % 1.2) - 0.6);
        s.setScalar(0.9 + ((i * 0.37) % 0.5));
        m.compose(new THREE.Vector3(x, terraceHeight(x, z), z), q, s);
        crows.setMatrixAt(i, m);
      }
      tile.add(crows);
      this.scene.add(tile);
      this.tiles.push(tile);
    }
    const sky = makeSky({
      zen: 0x0f0921, mid: 0x4d2452, hor: 0xeb7a66, sunCol: 0xff6b38,
      sun: new THREE.Vector3(-0.18, 0.004, -1), moon: new THREE.Vector3(0.3, 0.1, -1), sunSize: 1, moonSize: 1,
    });
    this.sky = sky.mesh;
    this.skyMat = sky.mat;
    this.scene.add(sky.mesh);
    this.lanterns = new Drifters(70, { x: 35, y0: 2, y1: 20, z0: -180, z1: 12 }, glowTexture('rgba(255,240,200,1)', 'rgba(255,170,80,0.85)'), 0xffc080, 1.6, 0.35);
    this.scene.add(this.lanterns.points);
  }

  protected animate(dt: number): void {
    this.lanterns.update(dt, this.speed, this.time);
  }
}

// ─────────────────────────────── Stage 2: drowned market ───────────────────────────────

const WATER_VERT = /* glsl */ `
uniform float uTime;
uniform float uFlow;
varying vec3 vWorld;
varying float vWave;
varying float vFz;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  float fz = w.z - uFlow; // water flows past with the world
  float wave = sin(w.x * 0.35 + uTime * 1.1) * 0.18 + sin(fz * 0.22 - uTime * 0.8) * 0.22 + sin((w.x + fz) * 0.6 + uTime * 1.7) * 0.08;
  w.y += wave;
  vWave = wave;
  vWorld = w.xyz;
  vFz = fz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep, uShallow, uGlint, uFog;
uniform vec2 uFogRange;
uniform vec3 uCam;
varying vec3 vWorld;
varying float vWave;
varying float vFz;
void main() {
  vec3 col = mix(uDeep, uShallow, smoothstep(-0.3, 0.4, vWave));
  // Shifting caustic lattice: light from drowned windows below.
  float c1 = sin(vWorld.x * 1.3 + uTime * 0.9 + sin(vFz * 0.7 + uTime) * 1.5);
  float c2 = sin(vFz * 1.1 - uTime * 0.7 + sin(vWorld.x * 0.9) * 1.5);
  float caustic = pow(max(0.0, 1.0 - abs(c1 + c2)), 6.0);
  col += uGlint * caustic * 0.35;
  // Moonlight streak down the canal.
  float streak = exp(-pow(vWorld.x * 0.22 - 0.6, 2.0) * 3.0) * smoothstep(-0.1, 0.35, vWave);
  col += vec3(0.75, 0.8, 1.0) * streak * 0.25;
  float d = distance(vWorld, uCam);
  col = mix(col, uFog, smoothstep(uFogRange.x, uFogRange.y, d));
  gl_FragColor = vec4(col, 1.0);
}`;

const L2 = 120;

export class MarketBackground extends StageBackground {
  private readonly waterMat: THREE.ShaderMaterial;
  private readonly rising: Drifters;
  private readonly floating: Drifters;

  constructor() {
    super(L2, 56);
    this.cruiseSpeed = 6;
    this.base = { x: 0, y: 9, z: 6, rx: -0.3, fov: 56 };
    const fog = new THREE.Color(0.12, 0.2, 0.26);
    this.scene.fog = new THREE.Fog(fog, 26, 165);
    this.scene.add(new THREE.HemisphereLight(0x7fb8c8, 0x0a1218, 1.4));
    const moonLight = new THREE.DirectionalLight(0xbfd6ff, 1.0);
    moonLight.position.set(6, 10, -10);
    this.scene.add(moonLight);

    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uFlow: { value: 0 },
        uDeep: { value: new THREE.Color(0.04, 0.12, 0.16) },
        uShallow: { value: new THREE.Color(0.1, 0.3, 0.34) },
        uGlint: { value: new THREE.Color(1.0, 0.75, 0.4) },
        uFog: { value: fog },
        uFogRange: { value: new THREE.Vector2(30, 165) },
        uCam: { value: new THREE.Vector3() },
      },
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(240, 420, 80, 140).rotateX(-Math.PI / 2).translate(0, 0, -150), this.waterMat);
    water.frustumCulled = false;
    this.scene.add(water);

    // Rooftops of the drowned town: walls sunk to the eaves, roofs above the water.
    const wall = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const roof = new THREE.ConeGeometry(0.78, 0.7, 4).rotateY(Math.PI / 4).translate(0, 1.35, 0);
    const house = mergeGeometries([wall, roof])!;
    const houseMat = new THREE.MeshLambertMaterial({ vertexColors: false });
    const windowGeo = new THREE.PlaneGeometry(0.22, 0.28);
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffc070, fog: true });
    const bridgeGeo = mergeGeometries([
      new THREE.BoxGeometry(24, 0.5, 2.2).translate(0, 2.4, 0),
      new THREE.BoxGeometry(0.6, 3, 0.6).translate(-6, 1, 0),
      new THREE.BoxGeometry(0.6, 3, 0.6).translate(6, 1, 0),
    ])!;
    const bridgeMat = new THREE.MeshLambertMaterial({ color: 0x3a2a30 });
    const palette = [0x3a5a62, 0x5a3a52, 0x6a5a3a, 0x2f4a58, 0x4a3a5a];
    for (let k = 0; k < 3; k++) {
      const tile = new THREE.Group();
      const n = 36;
      const houses = new THREE.InstancedMesh(house, houseMat, n);
      const wins = new THREE.InstancedMesh(windowGeo, windowMat, n * 2);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const sc = new THREE.Vector3();
      const col = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * (13 + hash(i * 3) * 26);
        const z = -(i / n) * L2 - hash(i) * 3;
        const w = 4 + hash(i * 7) * 4;
        const h = 1.5 + hash(i * 11) * 3.5;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (hash(i * 13) - 0.5) * 0.3);
        sc.set(w, h, w * (0.8 + hash(i * 17) * 0.5));
        m.compose(new THREE.Vector3(x, -0.6, z), q, sc);
        houses.setMatrixAt(i, m);
        houses.setColorAt(i, col.setHex(palette[i % palette.length]));
        for (let j = 0; j < 2; j++) {
          // Lit windows facing the canal.
          const wx = x - side * (w / 2 + 0.02);
          const wy = -0.6 + h * (0.45 + j * 0.25);
          const wz = z + (j - 0.5) * w * 0.4;
          m.compose(new THREE.Vector3(wx, wy, wz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side > 0 ? -Math.PI / 2 : Math.PI / 2), new THREE.Vector3(w * 0.35, h * 0.5, 1));
          wins.setMatrixAt(i * 2 + j, m);
        }
      }
      tile.add(houses, wins);
      for (let b = 0; b < 2; b++) {
        const br = new THREE.Mesh(bridgeGeo, bridgeMat);
        br.position.set(0, -0.6, -20 - b * 60);
        tile.add(br);
      }
      this.scene.add(tile);
      this.tiles.push(tile);
    }
    const sky = makeSky({
      zen: 0x050c18, mid: 0x13324a, hor: 0x3c6a78, sunCol: 0x8fd0e0,
      sun: new THREE.Vector3(0, -0.2, -1), moon: new THREE.Vector3(-0.25, 0.16, -1), sunSize: 0, moonSize: 2.2,
    });
    this.sky = sky.mesh;
    this.skyMat = sky.mat;
    this.scene.add(sky.mesh);
    const lanternTex = glowTexture('rgba(255,245,215,1)', 'rgba(255,170,90,0.85)');
    this.rising = new Drifters(80, { x: 40, y0: -1, y1: 22, z0: -170, z1: 12 }, lanternTex, 0xffc890, 1.5, 0.9);
    this.floating = new Drifters(60, { x: 10, y0: 0.15, y1: 0.2, z0: -170, z1: 12 }, lanternTex, 0xffa860, 1.1, 0);
    this.scene.add(this.rising.points, this.floating.points);
  }

  protected animate(dt: number): void {
    this.waterMat.uniforms.uTime.value = this.time;
    this.waterMat.uniforms.uFlow.value = this.travel;
    (this.waterMat.uniforms.uCam.value as THREE.Vector3).copy(this.camera.position);
    // The water itself scrolls with the world.
    this.rising.update(dt, this.speed, this.time);
    this.floating.update(dt, this.speed, this.time);
  }
}

// ─────────────────────────────── Stage 3: library ───────────────────────────────

const L3 = 96;

function floorTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a1a16';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = y % 64 ? '#33201a' : '#2e1c17';
    g.fillRect(0, y, 256, 30);
  }
  // A long carpet runner down the middle.
  g.fillStyle = '#5a1e2a';
  g.fillRect(88, 0, 80, 256);
  g.fillStyle = '#c9a24a';
  g.fillRect(92, 0, 3, 256);
  g.fillRect(161, 0, 3, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class LibraryBackground extends StageBackground {
  private readonly pages: Drifters;
  private readonly candles: Drifters;
  private readonly flyers: THREE.InstancedMesh;
  private readonly flyerSeeds: Array<{ x: number; y: number; z: number; ph: number }> = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();

  constructor() {
    super(L3, 60);
    this.cruiseSpeed = 6.5;
    this.base = { x: 0, y: 8, z: 6, rx: -0.24, fov: 60 };
    const fog = new THREE.Color(0.1, 0.06, 0.08);
    this.scene.fog = new THREE.Fog(fog, 18, 120);
    this.scene.background = fog;
    this.scene.add(new THREE.HemisphereLight(0xffd2a0, 0x1a0e10, 1.2));
    const warm = new THREE.DirectionalLight(0xffb070, 0.9);
    warm.position.set(-3, 8, 4);
    this.scene.add(warm);

    const floorMat = new THREE.MeshLambertMaterial({ map: floorTexture() });
    const shelfMat = new THREE.MeshLambertMaterial({ color: 0x2a1812 });
    const bookMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const ribMat = new THREE.MeshLambertMaterial({ color: 0x24161a });
    const bookColors = [0x6a2a2a, 0x2a4a5a, 0x5a5a2a, 0x3a2a4a, 0x7a5a3a, 0x2a3a2a, 0x8a7a5a, 0x4a1a2a];
    const bookGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let k = 0; k < 3; k++) {
      const tile = new THREE.Group();
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, L3).rotateX(-Math.PI / 2).translate(0, 0, -L3 / 2), floorMat);
      tile.add(floor);
      // Shelf walls: boards, then hundreds of books.
      const boards = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.2, L3), shelfMat, 2 * 7);
      const books = new THREE.InstancedMesh(bookGeo, bookMat, 2 * 6 * 70);
      let bi = 0;
      const col = new THREE.Color();
      for (let side = 0; side < 2; side++) {
        const sx = side ? 12 : -12;
        for (let r = 0; r < 7; r++) {
          this.m.makeTranslation(sx, r * 2.6, -L3 / 2);
          boards.setMatrixAt(side * 7 + r, this.m);
          if (r === 6) continue;
          let z = 0;
          for (let i = 0; i < 70 && z < L3; i++) {
            const w = 0.25 + hash(bi * 3.1) * 0.4;
            const h = 1.5 + hash(bi * 5.3) * 0.9;
            const lean = hash(bi * 7.7) > 0.93 ? (side ? -0.3 : 0.3) : 0;
            this.q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean);
            this.m.compose(new THREE.Vector3(sx, r * 2.6 + 0.1 + h / 2, -z - w / 2), this.q, new THREE.Vector3(1.1, h, w));
            books.setMatrixAt(bi, this.m);
            books.setColorAt(bi, col.setHex(bookColors[Math.floor(hash(bi * 9.9) * bookColors.length)]));
            bi++;
            z += w + (hash(bi * 2.2) > 0.9 ? 0.8 : 0.02);
          }
        }
      }
      books.count = bi;
      tile.add(boards, books);
      // Gothic ribs arching overhead.
      const ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(12, 0.35, 6, 24, Math.PI), ribMat, 4);
      for (let r = 0; r < 4; r++) {
        this.m.makeTranslation(0, 17, -r * (L3 / 4));
        ribs.setMatrixAt(r, this.m);
      }
      tile.add(ribs);
      this.scene.add(tile);
      this.tiles.push(tile);
    }
    // Books that fly loose down the hall, pages flapping.
    const flyerGeo = mergeGeometries([
      new THREE.PlaneGeometry(1, 1.3).translate(0.5, 0, 0),
      new THREE.PlaneGeometry(1, 1.3).translate(-0.5, 0, 0),
    ])!;
    this.flyers = new THREE.InstancedMesh(flyerGeo, new THREE.MeshLambertMaterial({ color: 0xefe6d6, side: THREE.DoubleSide }), 24);
    for (let i = 0; i < 24; i++) this.flyerSeeds.push({ x: (hash(i) - 0.5) * 16, y: 4 + hash(i + 3) * 10, z: -hash(i + 7) * 140, ph: hash(i + 11) * TAU });
    this.flyers.frustumCulled = false;
    this.scene.add(this.flyers);
    const pageTex = glowTexture('rgba(255,250,235,0.95)', 'rgba(240,225,200,0.5)');
    this.pages = new Drifters(90, { x: 12, y0: 0, y1: 18, z0: -130, z1: 12 }, pageTex, 0xf4ead8, 0.7, -0.5, false);
    this.candles = new Drifters(50, { x: 11, y0: 1, y1: 15, z0: -130, z1: 12 }, glowTexture('rgba(255,240,200,1)', 'rgba(255,160,60,0.7)'), 0xffb060, 1.0, 0.05);
    this.scene.add(this.pages.points, this.candles.points);
  }

  protected animate(dt: number): void {
    this.pages.update(dt, this.speed, this.time);
    this.candles.update(dt, this.speed * 0.98, this.time);
    for (let i = 0; i < this.flyerSeeds.length; i++) {
      const f = this.flyerSeeds[i];
      f.z += (this.speed + 1.5) * dt;
      if (f.z > 12) f.z -= 152;
      const flap = Math.sin(this.time * 7 + f.ph) * 0.7;
      this.q.setFromEuler(new THREE.Euler(0.3 + flap * 0.2, Math.sin(this.time * 0.5 + f.ph) * 0.6, flap));
      this.m.compose(new THREE.Vector3(f.x + Math.sin(this.time + f.ph) * 1.5, f.y + Math.sin(this.time * 1.3 + f.ph) * 0.8, f.z), this.q, new THREE.Vector3(1, 1, 1));
      this.flyers.setMatrixAt(i, this.m);
    }
    this.flyers.instanceMatrix.needsUpdate = true;
  }
}

export type SceneId = 'fields' | 'market' | 'library';

export function createBackground(id: SceneId): StageBackground {
  switch (id) {
    case 'market':
      return new MarketBackground();
    case 'library':
      return new LibraryBackground();
    default:
      return new FieldsBackground();
  }
}
