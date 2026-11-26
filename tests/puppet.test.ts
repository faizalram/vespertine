import { describe, expect, it } from 'vitest';
import { Puppet, Spring } from '../src/render/puppet';

const still = { vx: 0, vy: 0, focus: false, hurt: false, invulnerable: false };
const DT = 1 / 60;

describe('Spring', () => {
  it('settles on its target', () => {
    const s = new Spring(60, 10);
    for (let i = 0; i < 300; i++) s.step(1, DT);
    expect(s.x).toBeCloseTo(1, 2);
  });
});

describe('Puppet secondary motion', () => {
  it('hair and skirt trail behind the direction of travel', () => {
    const p = new Puppet('sayo');
    for (let i = 0; i < 40; i++) p.update(DT, { ...still, vx: 4 });
    // Moving right, hanging parts swing back (positive rotation sends their tips left).
    expect(p.hair.x).toBeGreaterThan(0.15);
    expect(p.hem.x).toBeGreaterThan(0.1);
  });

  it('a hanging lantern swings past rest when she stops, then calms down', () => {
    const p = new Puppet('sayo');
    for (let i = 0; i < 60; i++) p.update(DT, { ...still, vx: 4 });
    let min = Infinity;
    for (let i = 0; i < 90; i++) {
      p.update(DT, still);
      min = Math.min(min, p.prop.x);
    }
    expect(min).toBeLessThan(-0.05); // overshoot: it swung through to the other side
    // Checked before her first idle habit (checking the lantern) at ~6 s sets it swinging again.
    for (let i = 0; i < 180; i++) p.update(DT, still);
    expect(Math.abs(p.prop.x)).toBeLessThan(0.08);
  });

  it('teleports (Rewind, respawn) do not snap the springs', () => {
    const p = new Puppet('tessel');
    p.update(DT, { ...still, vx: 200, vy: -150 });
    expect(Math.abs(p.hair.v)).toBeLessThan(5);
  });

  it('a Litany raises both arms; a flinch never cancels a bigger reaction', () => {
    const p = new Puppet('ilse');
    p.react('cast');
    for (let i = 0; i < 25; i++) p.update(DT, still);
    expect(p.armL.x).toBeGreaterThan(1);
    expect(p.armR.x).toBeLessThan(-1);
    p.react('flinch');
    for (let i = 0; i < 5; i++) p.update(DT, still);
    expect(p.armL.x).toBeGreaterThan(1);
  });
});
