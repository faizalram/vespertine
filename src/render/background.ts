import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FIELD_H, FIELD_W } from '../game/constants';

/**
 * Stage 1 backdrop: "Fields of Unharvested Names".
 * Low-poly flat-shaded rice terraces flooded with dusk light, scarecrow
 * silhouettes, drifting lanterns, a frozen setting sun and the pale
 * Cenotaph Moon. The terrain is periodic along z, so three tiles leapfrog
 * forever.
 */

const L = 120; // tile length along z
const HALF_W = 48; // tile half-width along x
const SEG_X = 64;
const SEG_Z = 96;
const TAU = Math.PI * 2;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function rawHeight(x: number, z: number): number {
  const p = (z / L) * TAU;
  return (
    Math.abs(x) * 0.3 +
    2.2 * Math.sin(x * 0.13 + Math.sin(p * 2) * 1.6) +
    1.6 * Math.cos(p * 3 + x * 0.07) +
    1.1 * Math.sin(p * 5 - x * 0.05) -
    4
  );
}

/** Quantised into flat paddies with short steep risers. */
function terraceHeight(x: number, z: number): number {
  const v = rawHeight(x, z);
  const step = 1.3;
  const q = Math.floor(v / step);
  const f = v / step - q;
  return (q + smoothstep(0.78, 1, f)) * step;
}

function buildTerrain(): THREE.BufferGeometry {
  const tris = SEG_X * SEG_Z * 2;
  const pos = new Float32Array(tris * 9);
  const nor = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  const dx = (HALF_W * 2) / SEG_X;
  const dz = L / SEG_Z;
  const water = new THREE.Color();
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
    if (n.y > 0.985) {
      // Flooded paddy: reflects the sky, brighter further from the valley floor.
      const k = smoothstep(-4, 10, avgY);
      water.copy(waterLo).lerp(waterHi, k * 0.8 + 0.1 * Math.sin(ax * 0.7 + az * 0.3));
      c.copy(water);
    } else if (n.y > 0.8) {
      c.copy(rice).lerp(bank, 0.4);
    } else {
      c.copy(bank);
    }
    for (let k = 0; k < 3; k++) {
      pos[o] = v[k].x;
      pos[o + 1] = v[k].y;
      pos[o + 2] = v[k].z;
      nor[o] = n.x;
      nor[o + 1] = n.y;
      nor[o + 2] = n.z;
      col[o] = c.r;
      col[o + 1] = c.g;
      col[o + 2] = c.b;
      o += 3;
    }
  };
  for (let iz = 0; iz < SEG_Z; iz++) {
    for (let ix = 0; ix < SEG_X; ix++) {
      const x0 = -HALF_W + ix * dx;
      const x1 = x0 + dx;
      const z0 = -iz * dz;
      const z1 = z0 - dz;
      pushTri(x0, z0, x1, z0, x0, z1);
      pushTri(x1, z0, x1, z1, x0, z1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function buildScarecrowGeometry(): THREE.BufferGeometry {
  const post = new THREE.BoxGeometry(0.16, 2.4, 0.16).translate(0, 1.2, 0);
  const bar = new THREE.BoxGeometry(1.7, 0.12, 0.12).translate(0, 1.7, 0);
  const hat = new THREE.ConeGeometry(0.62, 0.42, 7).translate(0, 2.55, 0);
  const head = new THREE.BoxGeometry(0.34, 0.34, 0.2).translate(0, 2.2, 0);
  return mergeGeometries([post, bar, hat, head])!;
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uMoon;
uniform float uTime;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float e = d.y;
  vec3 zen = vec3(0.06, 0.035, 0.13);
  vec3 mid = vec3(0.30, 0.14, 0.32);
  vec3 hor = vec3(0.92, 0.48, 0.40);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.14, e));
  col = mix(col, zen, smoothstep(0.14, 0.55, e));
  col = mix(col, vec3(0.25, 0.12, 0.2), smoothstep(0.0, -0.15, e));
  // Thin cloud bands.
  float band = sin(d.x * 9.0 + uTime * 0.03) * sin(e * 60.0 + d.x * 4.0);
  col = mix(col, col * 0.78, smoothstep(0.6, 1.0, band) * smoothstep(0.02, 0.08, e) * (1.0 - smoothstep(0.1, 0.25, e)));
  // The sun that will not set: half sunk, enormous glow.
  float sd = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.42, 0.22) * pow(sd, 18.0) * 0.55;
  col += vec3(1.0, 0.65, 0.4) * pow(sd, 300.0) * 0.6;
  col = mix(col, vec3(1.0, 0.62, 0.42), smoothstep(0.9985, 0.9989, sd) * step(-0.004, e));
  // The pale Cenotaph Moon.
  float md = max(dot(d, uMoon), 0.0);
  col += vec3(0.75, 0.72, 0.9) * pow(md, 600.0) * 0.25;
  float disk = smoothstep(0.99935, 0.9995, md);
  // Soft limb darkening instead of surface detail: pale, blank, like paper.
  float limb = smoothstep(0.9995, 1.0, md);
  vec3 moonCol = mix(vec3(0.70, 0.66, 0.80), vec3(0.93, 0.91, 0.97), limb);
  col = mix(col, moonCol, disk * 0.8);
  gl_FragColor = vec4(col, 1.0);
}`;

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,200,1)');
  gr.addColorStop(0.2, 'rgba(255,180,90,0.9)');
  gr.addColorStop(0.5, 'rgba(255,120,50,0.25)');
  gr.addColorStop(1, 'rgba(255,90,30,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Stage1Background {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly tiles: THREE.Object3D[] = [];
  private readonly lanterns: THREE.Points;
  private readonly lanternPos: Float32Array;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly sky: THREE.Mesh;
  private scroll = 0;
  private time = 0;
  /** World units per second. */
  speed = 7;
  shake = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(58, FIELD_W / FIELD_H, 0.5, 600);
    this.camera.position.set(0, 10, 6);
    this.camera.rotation.set(-0.33, 0, 0);

    const fogColor = new THREE.Color(0.55, 0.3, 0.36);
    this.scene.fog = new THREE.Fog(fogColor, 28, 175);

    this.scene.add(new THREE.HemisphereLight(0xc49ac0, 0x1c0f22, 1.6));
    const sun = new THREE.DirectionalLight(0xffa070, 1.4);
    sun.position.set(-4, 3, -12);
    this.scene.add(sun);

    const terrainGeo = buildTerrain();
    const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const crowGeo = buildScarecrowGeometry();
    const crowMat = new THREE.MeshLambertMaterial({ color: 0x1a0e1e });
    for (let k = 0; k < 3; k++) {
      const tile = new THREE.Group();
      tile.add(new THREE.Mesh(terrainGeo, terrainMat));
      const count = 14;
      const crows = new THREE.InstancedMesh(crowGeo, crowMat, count);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < count; i++) {
        // Deterministic placement so every tile matches at the seams.
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * (5 + ((i * 7.31) % 26));
        const z = -((i * 37.7) % L);
        const y = terraceHeight(x, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 1.3) % 1.2 - 0.6);
        s.setScalar(0.9 + ((i * 0.37) % 0.5));
        m.compose(new THREE.Vector3(x, y, z), q, s);
        crows.setMatrixAt(i, m);
      }
      tile.add(crows);
      this.scene.add(tile);
      this.tiles.push(tile);
    }

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uSun: { value: new THREE.Vector3(-0.18, 0.004, -1).normalize() },
        uMoon: { value: new THREE.Vector3(0.3, 0.1, -1).normalize() },
        uTime: { value: 0 },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), this.skyMat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);

    const lanternCount = 70;
    this.lanternPos = new Float32Array(lanternCount * 3);
    for (let i = 0; i < lanternCount; i++) {
      this.lanternPos[i * 3] = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 70 - 35;
      this.lanternPos[i * 3 + 1] = 2 + ((i * 7.13) % 16);
      this.lanternPos[i * 3 + 2] = -((i * 19.37) % 190) + 10;
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(this.lanternPos, 3));
    this.lanterns = new THREE.Points(
      lg,
      new THREE.PointsMaterial({
        map: glowTexture(),
        size: 1.6,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffc080,
        fog: false,
      }),
    );
    this.lanterns.frustumCulled = false;
    this.scene.add(this.lanterns);
  }

  update(dt: number): void {
    this.time += dt;
    this.scroll = (this.scroll + this.speed * dt) % L;
    for (let k = 0; k < this.tiles.length; k++) this.tiles[k].position.z = this.scroll - k * L + 12;

    const lp = this.lanternPos;
    for (let i = 0; i < lp.length; i += 3) {
      lp[i + 2] += this.speed * dt;
      lp[i + 1] += dt * 0.35;
      lp[i] += Math.sin(this.time * 0.4 + i) * dt * 0.2;
      if (lp[i + 2] > 12) lp[i + 2] -= 190;
      if (lp[i + 1] > 20) lp[i + 1] = 2;
    }
    (this.lanterns.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

    this.skyMat.uniforms.uTime.value = this.time;
    // Slow breathing sway; a little roll for the 2.5D feel.
    const cam = this.camera;
    const sh = this.shake;
    cam.position.x = Math.sin(this.time * 0.13) * 2.2 + (sh > 0 ? (Math.random() - 0.5) * sh * 0.08 : 0);
    cam.position.y = 10 + Math.sin(this.time * 0.21) * 0.6 + (sh > 0 ? (Math.random() - 0.5) * sh * 0.08 : 0);
    cam.rotation.z = Math.sin(this.time * 0.11) * 0.03;
    this.sky.position.copy(cam.position);
  }
}
