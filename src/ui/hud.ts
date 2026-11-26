import type { Game } from '../game/game';
import type { Layout } from './layout';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $$ = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));

/** DOM HUD. Writes only when a value changes, to keep layout work off the hot path. */
export class Hud {
  private cache = new Map<string, string>();
  private els = new Map<string, HTMLElement[]>();
  private banner = $('#banner');
  private bannerTimer = 0;
  private boss = $('#boss');
  private debug = $('#debug');
  hiScore = 0;

  constructor() {
    for (const el of $$('[data-k]')) {
      const k = el.dataset.k!;
      const list = this.els.get(k) ?? [];
      list.push(el);
      this.els.set(k, list);
    }
  }

  private set(k: string, text: string): void {
    if (this.cache.get(k) === text) return;
    this.cache.set(k, text);
    for (const el of this.els.get(k) ?? []) el.textContent = text;
  }

  private bar(k: string, frac: number, fullClass = false): void {
    const v = Math.max(0, Math.min(1, frac)).toFixed(3);
    if (this.cache.get(k) === v) return;
    this.cache.set(k, v);
    for (const el of this.els.get(k) ?? []) {
      el.style.transform = `scaleX(${v})`;
      if (fullClass) el.classList.toggle('full', frac >= 1);
    }
  }

  applyLayout(l: Layout): void {
    document.body.classList.toggle('portrait', l.mode === 'portrait');
    document.body.classList.toggle('desktop', l.mode === 'desktop');
    const place = (el: HTMLElement, x: number, y: number, w: number, h?: number) => {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${w}px`;
      if (h !== undefined) el.style.height = `${h}px`;
    };
    if (l.mode === 'desktop') place($('#panel'), l.panel.x, l.panel.y, l.panel.w, l.panel.h);
    else {
      place($('#strip'), l.panel.x, l.panel.y, l.panel.w, l.panel.h);
      place($('#controls'), l.controls.x, l.controls.y, l.controls.w, l.controls.h);
    }
    place(this.boss, l.field.x, l.field.y, l.field.w);
    place(this.banner, l.field.x, l.field.y + l.field.h * 0.32, l.field.w);
    this.debug.style.left = `${l.field.x + 4}px`;
    this.debug.style.top = `${l.field.y + l.field.h - 70}px`;
  }

  showBanner(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.add('show');
    this.bannerTimer = 150;
  }

  update(g: Game): void {
    const p = g.player;
    this.hiScore = Math.max(this.hiScore, g.score);
    this.set('score', g.score.toLocaleString('en-US'));
    this.set('hi', this.hiScore.toLocaleString('en-US'));
    this.set('lives', '●'.repeat(Math.max(0, p.lives)) || '—');
    this.set('bombs', '✦'.repeat(Math.max(0, p.bombs)) || '—');
    this.set('power', p.power.toFixed(2));
    this.set('graze', String(g.graze));
    this.bar('vigil', g.vigil.active ? 1 - g.vigil.t / 300 : p.vigilMeter, true);

    const b = g.boss;
    const showBoss = b.present && b.phase >= 0;
    this.boss.classList.toggle('show', showBoss);
    if (showBoss) {
      this.bar('hp', b.survival ? b.timer / b.maxTimer : b.hp / b.maxHp);
      this.set('timer', b.vulnerable || b.survival ? String(Math.ceil(b.timer / 60)).padStart(2, '0') : '');
      this.set('elegy', b.elegy ?? '');
    }

    if (this.bannerTimer > 0 && --this.bannerTimer === 0) this.banner.classList.remove('show');
  }

  setDebug(text: string | null): void {
    this.debug.classList.toggle('show', text !== null);
    if (text !== null) this.debug.textContent = text;
  }
}
