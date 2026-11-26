import type { Task } from '../core/scheduler';
import type { Enemy, Game } from './game';

export const DIFFICULTIES = ['Gentle', 'Dusk', 'Midnight', 'Requiem'] as const;
export type DifficultyId = 0 | 1 | 2 | 3;

/** Item types. */
export const IT = {
  power: 0,
  powerBig: 1,
  point: 2,
  life: 3,
  bomb: 4,
  star: 5,
  /** Wren's bell turns bullets into souls. */
  soul: 6,
} as const;

export type CharId = 'sayo' | 'ilse' | 'tessel' | 'wren';
export const CHAR_IDS: readonly CharId[] = ['sayo', 'ilse', 'tessel', 'wren'];

/** A boss phase: a regular attack (elegy null) or a named Elegy. */
export interface PhaseDef {
  /** Stable id for Elegy History, e.g. "hoshiko.grain". */
  id: string;
  elegy: string | null;
  hp: number;
  /** Seconds. */
  time: number;
  /** Boss cannot be damaged; survive until the timer ends. */
  survival?: boolean;
  run: (g: Game) => Task;
}

export interface BossDef {
  id: string;
  name: string;
  title: string;
  sprite: number;
  hitR: number;
  phases: readonly PhaseDef[];
  midboss?: boolean;
  /** Portrait id for the Elegy cut-in. */
  portrait?: string;
}

export interface EnemyDef {
  sprite: number;
  hp: number;
  r: number;
  /** Items dropped on death. */
  drops: ReadonlyArray<number>;
  /** Rotate sprite to face its velocity. */
  orient?: boolean;
  score?: number;
}

export type Behavior = (g: Game, e: Enemy) => Task;

export type Speaker = CharId | 'hoshiko';

export interface DialogueLine {
  who: Speaker;
  expr: string;
  text: string;
  /** Switch music when this line appears (boss theme starts mid-conversation). */
  music?: string;
  /** Boss title card appears with this line. */
  bossIntro?: boolean;
}

export interface DialogueDef {
  id: string;
  left: Speaker;
  right: Speaker;
  lines: readonly DialogueLine[];
}

export interface StageInfo {
  number: number;
  title: string;
  poem: readonly string[];
  music: string;
}

export interface InterludeDef {
  title: string;
  lines: readonly string[];
}
