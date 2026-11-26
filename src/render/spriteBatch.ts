import * as THREE from 'three';
import type { Region } from './atlas';

const VERT = /* glsl */ `
attribute vec4 iA;   // x, y, rotation, scale
attribute vec4 iB;   // width, height, mode, unused
attribute vec4 iUV;  // u0, v0, u1, v1
attribute vec4 iC;   // rgba tint
varying vec2 vUv;
varying vec4 vC;
varying float vMode;
void main() {
  vec2 local = position.xy;               // -0.5..0.5
  vec2 p = local * iB.xy * iA.w;
  float c = cos(iA.z), s = sin(iA.z);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + iA.xy;
  vUv = vec2(mix(iUV.x, iUV.z, local.x + 0.5), mix(iUV.y, iUV.w, local.y + 0.5));
  vC = iC;
  vMode = iB.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec4 vC;
varying float vMode;
void main() {
  vec4 t = texture2D(uMap, vUv);
  vec3 col;
  if (vMode < 0.5) {
    col = mix(vC.rgb * t.r, vec3(1.0), t.g);
  } else {
    col = t.rgb * vC.rgb;
  }
  float a = t.a * vC.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`;

/** One draw call for up to `cap` sprites, rebuilt every frame. */
export class SpriteBatch {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly a: Float32Array;
  private readonly b: Float32Array;
  private readonly uv: Float32Array;
  private readonly c: Float32Array;
  private readonly attrs: THREE.InstancedBufferAttribute[];
  private readonly cap: number;
  private n = 0;

  constructor(cap: number, map: THREE.Texture, private readonly regions: Region[], additive: boolean, order: number) {
    this.cap = cap;
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    this.a = new Float32Array(cap * 4);
    this.b = new Float32Array(cap * 4);
    this.uv = new Float32Array(cap * 4);
    this.c = new Float32Array(cap * 4);
    const mk = (arr: Float32Array, name: string) => {
      const at = new THREE.InstancedBufferAttribute(arr, 4);
      at.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, at);
      return at;
    };
    this.attrs = [mk(this.a, 'iA'), mk(this.b, 'iB'), mk(this.uv, 'iUV'), mk(this.c, 'iC')];
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uMap: { value: map } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = order;
  }

  begin(): void {
    this.n = 0;
  }

  push(sprite: number, x: number, y: number, rot = 0, scale = 1, r = 1, g = 1, b = 1, alpha = 1, w = 0, h = 0): void {
    if (this.n >= this.cap) return;
    const reg = this.regions[sprite];
    const o = this.n * 4;
    this.a[o] = x;
    this.a[o + 1] = y;
    this.a[o + 2] = rot;
    this.a[o + 3] = scale;
    this.b[o] = w || reg.w;
    this.b[o + 1] = h || reg.h;
    this.b[o + 2] = reg.mode;
    this.uv[o] = reg.u0;
    this.uv[o + 1] = reg.v0;
    this.uv[o + 2] = reg.u1;
    this.uv[o + 3] = reg.v1;
    this.c[o] = r;
    this.c[o + 1] = g;
    this.c[o + 2] = b;
    this.c[o + 3] = alpha;
    this.n++;
  }

  end(): void {
    this.geo.instanceCount = this.n;
    const len = this.n * 4;
    for (const at of this.attrs) {
      at.clearUpdateRanges();
      if (len > 0) at.addUpdateRange(0, len);
      at.needsUpdate = true;
    }
  }

  get count(): number {
    return this.n;
  }
}
