import type { InputFrame } from '../game/game';

/**
 * Merges keyboard, gamepad and touch (relative drag) into one InputFrame per tick.
 *
 * Touch model (spec §7.1): the first finger anywhere outside a button drags the
 * ship relatively, so the finger never covers it. A second finger held anywhere
 * engages focus. On-screen buttons handle focus (toggle), skill and bomb.
 */
export class Input {
  private keys = new Set<string>();
  private dragId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private accX = 0;
  private accY = 0;
  private focusHolds = new Set<number>();
  private bombQueued = false;
  private skillQueued = false;
  private pauseQueued = false;
  private confirmQueued = false;
  private advanceQueued = false;
  private downX = 0;
  private downY = 0;
  private downT = 0;
  private padPrev: boolean[] = [];
  /** True once a touch has been seen: enables auto-fire and on-screen controls. */
  touchMode = false;
  focusToggle = false;
  sensitivity = 1.2;
  onFirstTouch: (() => void) | null = null;

  constructor(surface: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.dragId = null;
      this.focusHolds.clear();
    });
    surface.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'KeyX') this.bombQueued = true;
    if (e.code === 'KeyC') this.skillQueued = true;
    if (e.code === 'Escape' || e.code === 'KeyP') this.pauseQueued = true;
    if (e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'Space') {
      this.confirmQueued = true;
      this.advanceQueued = true;
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.pointerType !== 'mouse') {
      if (!this.touchMode) {
        this.touchMode = true;
        this.onFirstTouch?.();
      }
    }
    if (this.dragId === null) {
      this.dragId = e.pointerId;
      this.lastX = this.downX = e.clientX;
      this.lastY = this.downY = e.clientY;
      this.downT = performance.now();
    } else if (e.pointerType !== 'mouse') {
      this.focusHolds.add(e.pointerId);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== this.dragId) return;
    // Use coalesced events where available for smooth high-rate touch input.
    const evs = e.getCoalescedEvents?.() ?? [];
    const last = evs.length ? evs[evs.length - 1] : e;
    this.accX += last.clientX - this.lastX;
    this.accY += last.clientY - this.lastY;
    this.lastX = last.clientX;
    this.lastY = last.clientY;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.dragId) {
      this.dragId = null;
      // A short, nearly stationary touch is a tap: it advances dialogue without disturbing drags.
      const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
      if (moved < 12 && performance.now() - this.downT < 300) this.advanceQueued = true;
    }
    this.focusHolds.delete(e.pointerId);
  };

  pressBomb(): void {
    this.bombQueued = true;
  }

  pressSkill(): void {
    this.skillQueued = true;
  }

  pressPause(): void {
    this.pauseQueued = true;
  }

  get dragging(): boolean {
    return this.dragId !== null;
  }

  /** Edge-triggered: returns true once per press. */
  takePause(): boolean {
    const v = this.pauseQueued;
    this.pauseQueued = false;
    return v;
  }

  takeConfirm(): boolean {
    const v = this.confirmQueued;
    this.confirmQueued = false;
    return v;
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Discard edge presses (used when (un)pausing so a press doesn't leak into play). */
  flush(): void {
    this.bombQueued = this.skillQueued = this.confirmQueued = this.advanceQueued = false;
    this.accX = this.accY = 0;
  }

  /**
   * @param cssPerUnit CSS pixels per field unit, used to convert drag distance.
   */
  sample(cssPerUnit: number): InputFrame {
    const k = this.keys;
    let mx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let my = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    let shoot = k.has('KeyZ') || k.has('Space');
    let focus = k.has('ShiftLeft') || k.has('ShiftRight');
    let bomb = this.bombQueued;
    let skill = this.skillQueued;
    let skipHeld = k.has('ControlLeft') || k.has('ControlRight');

    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad) continue;
      const btn = (i: number) => !!pad.buttons[i]?.pressed;
      const edge = (i: number) => {
        const now = btn(i);
        const was = this.padPrev[i] ?? false;
        this.padPrev[i] = now;
        return now && !was;
      };
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (Math.abs(ax) > 0.25) mx = ax;
      if (Math.abs(ay) > 0.25) my = ay;
      if (btn(14)) mx = -1;
      if (btn(15)) mx = 1;
      if (btn(12)) my = -1;
      if (btn(13)) my = 1;
      shoot ||= btn(0) || btn(7);
      focus ||= btn(5) || btn(6) || btn(4);
      if (edge(1)) bomb = true;
      if (edge(2) || edge(3)) skill = true;
      if (edge(9)) this.pauseQueued = true;
      if (edge(0)) this.confirmQueued = this.advanceQueued = true;
      if (btn(8)) skipHeld = true;
      break;
    }

    const scale = this.sensitivity / cssPerUnit;
    const tx = this.accX * scale;
    const ty = this.accY * scale;
    this.accX = this.accY = 0;
    // Mouse drag counts too (handy for testing touch feel on desktop).
    if (this.dragId !== null) shoot = true;
    if (this.touchMode) shoot = true;
    focus ||= this.focusToggle || this.focusHolds.size > 0;

    const advance = this.advanceQueued;
    this.bombQueued = false;
    this.skillQueued = false;
    this.advanceQueued = false;
    return { mx, my, tx, ty, shoot, focus, bomb, skill, advance, skip: skipHeld };
  }
}
