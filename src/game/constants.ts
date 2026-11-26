/** Logical playfield size in field units (y grows downward, origin top-left). */
export const FIELD_W = 384;
export const FIELD_H = 448;

/** Fixed simulation rate. */
export const TPS = 60;
export const TICK = 1 / TPS;

export const TAU = Math.PI * 2;

/** Enemy bullets are harmless for this many frames after spawning (fairness rule, spec §7.6). */
export const SPAWN_GRACE = 6;
