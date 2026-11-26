import { DIFFICULTIES } from '../game/defs';
import { DIALOGUE_CPF, type Game } from '../game/game';
import type { Layout } from './layout';
import { paintPortrait, SPEAKER_NAMES } from './portraits';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $$ = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));

/** DOM HUD. Writes only when a value changes, to keep layout work off the hot path. */
export class Hud {
  private cache = new Map<string, string>();
  private els = new Map<string, HTMLElement[]>();
  private fieldUi = $('#field-ui');
  private banner = $('#banner');
  private boss = $('#boss');
  private debug = $('#debug');
  private stageCard = $('#stage-card');
  private bossCard = $('#boss-card');
  private cutin = $('#cutin');
  private capture = $('#capture');
  private dlg = $('#dialogue');
  private dlgLeft = $<HTMLCanvasElement>('#dialogue .portrait.left');
  private dlgRight = $<HTMLCanvasElement>('#dialogue .portrait.right');
  private dlgSpeaker = $('#dialogue .speaker');
  private dlgText = $('#dialogue .text');
  private dlgMore = $('#dialogue .more');
  private timers = new Map<HTMLElement, number>();
  private lastDialogueKey = '';
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

  /** Show an element (adds .show) for a duration in milliseconds (real time, independent of frame rate). */
  private flashEl(el: HTMLElement, ms: number): void {
    el.classList.add('show');
    this.timers.set(el, performance.now() + ms);
  }

  private hideEl(el: HTMLElement): void {
    el.classList.remove('show');
    this.timers.delete(el);
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
    place(this.fieldUi, l.field.x, l.field.y, l.field.w, l.field.h);
    this.fieldUi.style.setProperty('--u', l.scale.toFixed(3));
  }

  showBanner(text: string): void {
    this.banner.textContent = text;
    this.flashEl(this.banner, 2600);
  }

  showStageCard(g: Game): void {
    const info = g.stageInfo;
    if (!info) return;
    $('#stage-card .sc-num').textContent = `Stage ${info.number}`;
    $('#stage-card .sc-title').textContent = info.title;
    $('#stage-card .sc-poem').innerHTML = info.poem.map((l) => l.replace(/[<&]/g, '')).join('<br>');
    this.flashEl(this.stageCard, 4500);
  }

  showBossCard(g: Game): void {
    const def = g.boss.def;
    if (!def) return;
    $('#boss-card .bc-title').textContent = def.title;
    $('#boss-card .bc-name').textContent = def.name;
    this.hideEl(this.stageCard);
    this.flashEl(this.bossCard, 3200);
  }

  playCutin(g: Game): void {
    const def = g.boss.def;
    if (!def?.portrait) return;
    const cv = this.cutin.querySelector('canvas')!;
    paintPortrait(cv, def.portrait as 'hoshiko', 'determined');
    this.cutin.classList.remove('play');
    void this.cutin.offsetWidth; // restart the CSS animation
    this.cutin.classList.add('play');
  }

  showCapture(g: Game): void {
    const c = g.lastCapture;
    if (!c) return;
    this.capture.classList.toggle('fail', !c.captured);
    this.capture.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = c.captured ? 'Elegy Captured' : 'Elegy Failed';
    this.capture.append(b);
    if (c.captured) this.capture.append(`Bonus ${c.bonus.toLocaleString('en-US')}`);
    this.flashEl(this.capture, 2600);
  }

  private updateDialogue(g: Game): void {
    const d = g.dialogue;
    this.dlg.classList.toggle('show', !!d);
    if (!d) {
      this.lastDialogueKey = '';
      return;
    }
    if (this.stageCard.classList.contains('show')) this.hideEl(this.stageCard);
    const line = d.def.lines[d.i];
    const key = `${d.def.id}:${d.i}`;
    if (key !== this.lastDialogueKey) {
      this.lastDialogueKey = key;
      const isLeft = line.who === d.def.left;
      // Each side keeps its last expression while the other speaks.
      if (isLeft) paintPortrait(this.dlgLeft, line.who, line.expr);
      else paintPortrait(this.dlgRight, line.who, line.expr);
      if (d.i === 0) {
        // Paint the silent side with a neutral face the first time.
        if (isLeft) paintPortrait(this.dlgRight, d.def.right, 'neutral');
        else paintPortrait(this.dlgLeft, d.def.left, 'neutral');
      }
      this.dlgLeft.classList.toggle('dim', !isLeft);
      this.dlgRight.classList.toggle('dim', isLeft);
      // The boss's portrait only appears once she has introduced herself.
      const rightSeen = d.def.lines.slice(0, d.i + 1).some((l) => l.who === d.def.right);
      this.dlgRight.style.opacity = rightSeen ? '1' : '0';
      this.dlgSpeaker.textContent = SPEAKER_NAMES[line.who];
      this.dlgSpeaker.classList.toggle('right', !isLeft);
    }
    const shown = Math.min(line.text.length, Math.floor(d.age * DIALOGUE_CPF));
    this.set('__dlgText', line.text.slice(0, shown));
    this.dlgText.textContent = this.cache.get('__dlgText')!;
    this.dlgMore.classList.toggle('show', shown >= line.text.length);
  }

  update(g: Game): void {
    const p = g.player;
    this.hiScore = Math.max(this.hiScore, g.score);
    this.set('diff', DIFFICULTIES[g.diff]);
    this.set('score', g.score.toLocaleString('en-US'));
    this.set('hi', this.hiScore.toLocaleString('en-US'));
    this.set('lives', '●'.repeat(Math.max(0, p.lives)) || '—');
    this.set('bombs', '✦'.repeat(Math.max(0, p.bombs)) || '—');
    this.set('lifeFrags', g.lifeFrags ? `${g.lifeFrags}/5` : '');
    this.set('bombFrags', g.bombFrags ? `${g.bombFrags}/3` : '');
    this.set('power', p.power >= 4 ? 'MAX' : p.power.toFixed(2));
    this.set('pointValue', g.pointValue.toLocaleString('en-US'));
    this.set('graze', String(g.graze));
    this.bar('vigil', g.vigil.active ? 1 - g.vigil.t / 300 : p.vigilMeter, true);

    const b = g.boss;
    const showBoss = b.present && b.phase >= 0 && !b.defeated && !g.dialogue;
    this.boss.classList.toggle('show', showBoss);
    if (showBoss && b.def) {
      this.bar('hp', b.survival ? b.timer / b.maxTimer : b.hp / b.maxHp);
      this.set('timer', b.active ? String(Math.ceil(b.timer / 60)).padStart(2, '0') : '');
      this.set('elegy', b.elegy ?? '');
      this.set('bossName', b.def.name);
      const remaining = b.def.phases.slice(b.phase + 1).filter((ph) => ph.elegy).length;
      this.set('bossStars', '✧'.repeat(remaining));
    }

    this.updateDialogue(g);

    const now = performance.now();
    for (const [el, until] of this.timers) if (now >= until) this.hideEl(el);
  }

  setDebug(text: string | null): void {
    this.debug.classList.toggle('show', text !== null);
    if (text !== null) this.debug.textContent = text;
  }
}
