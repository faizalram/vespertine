import { S } from './sprites';

export interface BulletType {
  sprite: number;
  /** Draw size in field units. */
  w: number;
  h: number;
  /** Collision radius; smaller than the visible sprite (spec §7.6). */
  hitR: number;
  /** Rotate the sprite to face its direction of travel. */
  orient: boolean;
}

export const BT = {
  orb: 0,
  rice: 1,
  petal: 2,
  needle: 3,
  paper: 4,
  big: 5,
  small: 6,
} as const;

export const BULLET_TYPES: readonly BulletType[] = [
  { sprite: S.orb, w: 16, h: 16, hitR: 4.2, orient: false },
  { sprite: S.rice, w: 9, h: 17, hitR: 2.8, orient: true },
  { sprite: S.petal, w: 14, h: 14, hitR: 3.2, orient: true },
  { sprite: S.needle, w: 6, h: 18, hitR: 2.2, orient: true },
  { sprite: S.paper, w: 11, h: 15, hitR: 3.2, orient: true },
  { sprite: S.big, w: 40, h: 40, hitR: 12, orient: false },
  { sprite: S.orb, w: 10, h: 10, hitR: 2.6, orient: false },
];
