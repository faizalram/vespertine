/** Bullet tint palette. Saturated so bullets read clearly against the muted dusk backgrounds. */
export const C = {
  amber: 0,
  gold: 1,
  crimson: 2,
  rose: 3,
  violet: 4,
  indigo: 5,
  teal: 6,
  white: 7,
  ash: 8,
  azure: 9,
} as const;

export const PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [1.0, 0.62, 0.18], // amber
  [1.0, 0.86, 0.3], // gold
  [0.95, 0.18, 0.26], // crimson
  [1.0, 0.45, 0.7], // rose
  [0.72, 0.38, 1.0], // violet
  [0.38, 0.42, 1.0], // indigo
  [0.2, 0.92, 0.85], // teal
  [0.95, 0.95, 1.0], // white
  [0.62, 0.6, 0.7], // ash
  [0.3, 0.7, 1.0], // azure
];
