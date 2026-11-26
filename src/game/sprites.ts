/** Sprite ids shared by the simulation (which only stores numbers) and the atlas builder. */
export const S = {
  orb: 0,
  rice: 1,
  petal: 2,
  needle: 3,
  paper: 4,
  big: 5,
  spark: 6,
  ring: 7,
  ward: 8,
  hitbox: 9,
  sayo: 10,
  wisp: 11,
  lance: 12,
  emitter: 13,
  effigy: 14,
  white: 15,
  shard: 16,
} as const;

export type SpriteId = (typeof S)[keyof typeof S];
