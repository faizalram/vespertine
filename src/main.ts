import './style.css';
import { AudioEngine, type Sfx } from './audio/audio';
import { practiceScript } from './content/practice';
import { STAGE1_INTERLUDE, stage1 } from './content/stage1';
import { Input } from './core/input';
import { TICK } from './game/constants';
import { DIFFICULTIES, type DifficultyId } from './game/defs';
import { EMPTY_INPUT, Game, type GameOptions } from './game/game';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import { computeLayout, readSafeInsets, type Layout } from './ui/layout';

type State = 'title' | 'difficulty' | 'play' | 'paused' | 'over' | 'clear' | 'interlude';

const params = new URLSearchParams(location.search);
const GOD = params.has('god');
const PRACTICE = params.has('practice') || params.has('stress');
const START_AT: GameOptions['startAt'] = params.has('boss') ? 'boss' : params.has('midboss') ? 'midboss' : 'start';
const FORCED_DIFF = params.has('diff') ? (Math.max(0, Math.min(3, Number(params.get('diff')))) as DifficultyId) : null;

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const canvas = $<HTMLCanvasElement>('#gl');
const renderer = new Renderer(canvas);
const input = new Input(document.body);
const audio = new AudioEngine();
const hud = new Hud();

let state: State = 'title';
let game: Game | null = null;
let difficulty: DifficultyId = 1;
let layout: Layout;
let showDebug = params.has('debug') || params.has('stress');

// ───────────────────────────── save data ─────────────────────────────

interface SaveData {
  hi: Record<string, number>;
  elegies: Record<string, { attempts: number; captures: number }>;
  stage1Clears: Record<string, number>;
}

const SAVE_KEY = 'vespertine.save.v1';
function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { hi: {}, elegies: {}, stage1Clears: {}, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { hi: {}, elegies: {}, stage1Clears: {} };
}
const save = loadSave();
function persist(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* private mode: progress lives only for this session */
  }
}
function recordHiScore(): void {
  if (!game) return;
  const k = String(game.diff);
  save.hi[k] = Math.max(save.hi[k] ?? 0, game.score);
  persist();
}
function elegyStat(g: Game) {
  const def = g.boss.def?.phases[g.boss.phase];
  if (!def) return null;
  const key = `${def.id}|sayo|${g.diff}`;
  return (save.elegies[key] ??= { attempts: 0, captures: 0 });
}

// ───────────────────────────── layout ─────────────────────────────

function relayout(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  layout = computeLayout(vw, vh, readSafeInsets($('#safe-probe')));
  renderer.resize(vw, vh);
  hud.applyLayout(layout);
}
window.addEventListener('resize', relayout);
window.visualViewport?.addEventListener('resize', relayout);
relayout();

// ───────────────────────────── screens ─────────────────────────────

const SCREENS = ['#title', '#difficulty', '#pause', '#over', '#clear', '#interlude'];
function showScreen(id: string | null): void {
  for (const s of SCREENS) $(s).classList.toggle('show', s === id);
  document.body.classList.toggle('title-screen', id === '#title' || id === '#difficulty' || id === '#interlude');
  document.body.classList.toggle('menu-open', id !== null);
  if (id) {
    // Focus the first sensible button for keyboard/gamepad navigation.
    const first = $(id).querySelector<HTMLButtonElement>('button:not(:disabled):not(.quiet)');
    first?.focus({ preventScroll: true });
  }
}
showScreen('#title');

function enterDifficulty(): void {
  audio.unlock();
  audio.playTrack('title');
  if (FORCED_DIFF !== null || PRACTICE) {
    startGame(FORCED_DIFF ?? 1);
    return;
  }
  state = 'difficulty';
  showScreen('#difficulty');
  $<HTMLButtonElement>(`[data-diff="${difficulty}"]`).focus({ preventScroll: true });
}

function startGame(diff: DifficultyId): void {
  difficulty = diff;
  audio.unlock();
  if (input.touchMode && document.documentElement.requestFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('portrait'))
      .catch(() => {});
  }
  void (navigator as Navigator & { wakeLock?: { request(t: string): Promise<unknown> } }).wakeLock?.request('screen').catch(() => {});
  newGame();
  showScreen(null);
  state = 'play';
}

function newGame(): void {
  const script = PRACTICE ? practiceScript(params.has('stress')) : stage1;
  game = new Game(script, { difficulty, startAt: START_AT, seed: (Date.now() & 0xffffff) | 1 });
  hud.hiScore = save.hi[String(difficulty)] ?? 0;
  input.flush();
  audio.resume();
}

function pause(): void {
  if (state !== 'play') return;
  state = 'paused';
  showScreen('#pause');
  audio.suspend();
}

function resume(): void {
  if (state !== 'paused') return;
  state = 'play';
  showScreen(null);
  input.flush();
  audio.resume();
}

function toTitle(): void {
  recordHiScore();
  game = null;
  state = 'title';
  audio.resume();
  audio.playTrack('title');
  showScreen('#title');
}

function showContinue(): void {
  if (!game) return;
  state = 'over';
  recordHiScore();
  const g = game;
  $('.over-score').textContent = `Score ${g.score.toLocaleString('en-US')} · Graze ${g.graze}`;
  $('#over .credits').textContent = `(${g.credits} left)`;
  $<HTMLButtonElement>('[data-act="continue"]').style.display = g.credits > 0 ? '' : 'none';
  $('.over-note').textContent =
    g.diff === 0 && g.continuesUsed === 0
      ? 'On Gentle, one continue still leads to the good ending.'
      : 'Continuing leads to a different ending.';
  setTimeout(() => state === 'over' && showScreen('#over'), 900);
}

function showClear(): void {
  if (!game?.results) return;
  state = 'clear';
  recordHiScore();
  save.stage1Clears[String(game.diff)] = (save.stage1Clears[String(game.diff)] ?? 0) + 1;
  persist();
  const r = game.results;
  const rows: Array<[string, string]> = [
    ['Difficulty', DIFFICULTIES[game.diff]],
    ['Stage clear bonus', r.clearBonus.toLocaleString('en-US')],
    ['Elegies captured', `${r.captures} / ${r.elegies}`],
    ['Graze', String(r.graze)],
    ['Continues used', String(game.continuesUsed)],
    ['Score', r.score.toLocaleString('en-US')],
  ];
  const dl = $('#clear .results');
  dl.innerHTML = '';
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  setTimeout(() => state === 'clear' && showScreen('#clear'), 1200);
}

function showInterlude(): void {
  state = 'interlude';
  audio.stopMusic();
  showScreen('#interlude');
  $('#interlude .il-title').textContent = STAGE1_INTERLUDE.title;
  const box = $('#interlude .il-lines');
  box.innerHTML = '';
  const end = $('#interlude .il-end');
  end.classList.remove('show');
  STAGE1_INTERLUDE.lines.forEach((text, i) => {
    const p = document.createElement('p');
    p.textContent = text;
    box.append(p);
    setTimeout(() => p.classList.add('show'), 600 + i * 1800);
  });
  setTimeout(() => end.classList.add('show'), 600 + STAGE1_INTERLUDE.lines.length * 1800);
}

// ───────────────────────────── DOM wiring ─────────────────────────────

$('#title').addEventListener('click', () => state === 'title' && enterDifficulty());
document.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((b) =>
  b.addEventListener('click', () => {
    if (state !== 'difficulty' || b.disabled) return;
    audio.play('select');
    startGame(Number(b.dataset.diff) as DifficultyId);
  }),
);
$('#pause-btn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (state === 'play') pause();
  else if (state === 'paused') resume();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

const muteBtn = $('[data-act="mute"]');
const flashBtn = $('[data-act="flash"]');
function toggleMute(): void {
  audio.unlock();
  audio.setMuted(!audio.muted);
  muteBtn.textContent = `Sound: ${audio.muted ? 'Off' : 'On'}`;
}
document.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
  b.addEventListener('click', () => {
    audio.play('select');
    switch (b.dataset.act) {
      case 'resume':
        resume();
        break;
      case 'restart':
        newGame();
        showScreen(null);
        state = 'play';
        break;
      case 'mute':
        toggleMute();
        break;
      case 'flash':
        renderer.reduceFlash = !renderer.reduceFlash;
        flashBtn.textContent = `Reduce flashing: ${renderer.reduceFlash ? 'On' : 'Off'}`;
        break;
      case 'title':
        toTitle();
        break;
      case 'back':
        state = 'title';
        showScreen('#title');
        break;
      case 'continue':
        if (game?.continueGame()) {
          showScreen(null);
          state = 'play';
          input.flush();
        }
        break;
      case 'giveup':
        toTitle();
        break;
      case 'vigil':
        showInterlude();
        break;
    }
  }),
);

// On-screen controls (portrait / touch).
const btnFocus = $<HTMLButtonElement>('#btn-focus');
const btnSkill = $<HTMLButtonElement>('#btn-skill');
const btnBomb = $<HTMLButtonElement>('#btn-bomb');
btnFocus.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.focusToggle = !input.focusToggle;
  btnFocus.classList.toggle('on', input.focusToggle);
});
btnSkill.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.pressSkill();
});
btnBomb.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.pressBomb();
});

/** Keyboard menu navigation: arrows move between buttons, Z / Enter activates. */
function menuKey(e: KeyboardEvent): boolean {
  const screenEl = SCREENS.map((s) => $(s)).find((el) => el.classList.contains('show'));
  if (!screenEl) return false;
  const buttons = Array.from(screenEl.querySelectorAll<HTMLButtonElement>('button')).filter((b) => !b.disabled && b.offsetParent !== null);
  if (!buttons.length) return false;
  const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
    const d = e.code === 'ArrowDown' ? 1 : -1;
    buttons[(idx + d + buttons.length) % buttons.length].focus({ preventScroll: true });
    audio.play('select');
    return true;
  }
  if (e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'Space') {
    (idx >= 0 ? buttons[idx] : buttons[0]).click();
    return true;
  }
  if (e.code === 'KeyX' || e.code === 'Escape') {
    if (state === 'paused') resume();
    else if (state === 'difficulty') {
      state = 'title';
      showScreen('#title');
    }
    return true;
  }
  return false;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Backquote' || e.code === 'F3') {
    showDebug = !showDebug;
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyM') {
    toggleMute();
    return;
  }
  if (state === 'title') {
    if (e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      enterDifficulty();
    }
    return;
  }
  if (state === 'difficulty' || state === 'paused' || state === 'over' || state === 'clear' || state === 'interlude') {
    // Escape in play is handled by Input; here it closes menus.
    if (menuKey(e)) {
      e.preventDefault();
      input.takePause(); // swallow the Escape the Input layer also saw
    }
    return;
  }
  if (state === 'play' && game && /^Digit[1-5]$/.test(e.code)) game.jumpTo(Number(e.code.slice(5)) - 1);
});

// ───────────────────────────── events ─────────────────────────────

const DIRECT_SFX: Partial<Record<string, Sfx>> = {
  shot: 'shot', graze: 'graze', phaseEnd: 'phaseEnd', vigil: 'vigil', bossHit: 'bossHit',
  enemyHit: 'enemyHit', enemyDie: 'enemyDie', item: 'item', bossDefeat: 'bossDefeat',
};

function vibrate(p: number | number[]): void {
  if (input.touchMode && navigator.vibrate) navigator.vibrate(p);
}

function handleEvents(g: Game): void {
  for (const ev of g.events) {
    const sfx = DIRECT_SFX[ev];
    if (sfx) {
      audio.play(sfx);
      continue;
    }
    switch (ev) {
      case 'music':
        audio.playTrack(g.music);
        break;
      case 'stageCard':
        hud.showStageCard(g);
        break;
      case 'bossIntro':
        hud.showBossCard(g);
        break;
      case 'declare': {
        audio.play('declare');
        if (g.boss.elegy) hud.showBanner(g.boss.elegy);
        hud.playCutin(g);
        const st = elegyStat(g);
        if (st) st.attempts++;
        vibrate(20);
        break;
      }
      case 'capture':
      case 'captureFail': {
        audio.play(ev);
        hud.showCapture(g);
        if (ev === 'capture') {
          const def = g.boss.def?.phases[g.boss.phase];
          if (def) {
            const st = save.elegies[`${def.id}|sayo|${g.diff}`];
            if (st) st.captures++;
          }
          persist();
        }
        break;
      }
      case 'death':
        audio.play('death');
        vibrate([60, 40, 60]);
        break;
      case 'bomb':
        audio.play('bomb');
        vibrate(40);
        break;
      case 'extend':
        audio.play('extend');
        hud.showBanner('A new candle is lit.');
        break;
      case 'bombGet':
        audio.play('bombGet');
        hud.showBanner('A new Litany is remembered.');
        break;
      case 'fullPower':
        hud.showBanner('The Ember burns at full strength.');
        break;
      case 'dialogueLine':
        audio.play('talk');
        break;
      case 'gameover':
        showContinue();
        break;
      case 'stageClear':
        showClear();
        break;
    }
  }
}

// ───────────────────────────── loop ─────────────────────────────

let last = performance.now();
let acc = 0;
let fpsFrames = 0;
let fpsTime = 0;
let fps = 0;
let simMs = 0;
let qualityTimer = 0;
let slowFrames = 0;
let qualityFrames = 0;

function step(): void {
  if (!game) return;
  if (state === 'play') {
    if (input.takePause()) {
      pause();
      return;
    }
    const t0 = performance.now();
    const inp = input.sample(layout.scale);
    if (GOD) game.player.invuln = Math.max(game.player.invuln, 2);
    game.tick(inp);
    simMs = simMs * 0.95 + (performance.now() - t0) * 0.05;
    handleEvents(game);
  } else if (state === 'over' || state === 'clear') {
    game.tick(EMPTY_INPUT);
  }
}

function adaptQuality(dt: number): void {
  if (state !== 'play') return;
  qualityTimer += dt;
  qualityFrames++;
  if (dt > 1 / 45) slowFrames++;
  if (qualityTimer < 2) return;
  if (slowFrames / qualityFrames > 0.25 && renderer.resolutionScale > 0.75) {
    renderer.setPixelRatio(Math.max(0.75, renderer.resolutionScale - 0.25));
    relayout();
  }
  qualityTimer = 0;
  slowFrames = 0;
  qualityFrames = 0;
}

function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  if (Math.abs(dt - TICK) < 0.002) dt = TICK;

  if (state === 'paused' && input.takePause()) resume();

  acc += dt;
  let steps = 0;
  while (acc >= TICK && steps < 2) {
    step();
    acc -= TICK;
    steps++;
  }
  // Fall behind gracefully: slow down instead of skipping ahead (genre convention).
  if (acc > TICK) acc = 0;

  const inGame = game !== null && state !== 'title' && state !== 'difficulty' && state !== 'interlude';
  if (state !== 'paused') renderer.updateVisuals(dt, inGame ? game : null);
  renderer.render(inGame ? game : null, layout.field, layout.vh);
  if (inGame && game) {
    hud.update(game);
    const p = game.player;
    btnSkill.classList.toggle('ready', p.vigilMeter >= 1 && !game.vigil.active);
    btnBomb.disabled = p.bombs <= 0;
  }

  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    fps = fpsFrames / fpsTime;
    fpsFrames = 0;
    fpsTime = 0;
    if (showDebug && game && inGame) {
      hud.setDebug(
        `fps ${fps.toFixed(0)}  sim ${simMs.toFixed(2)}ms\n` +
          `bullets ${game.bullets.n}  enemies ${game.enemies.length}  items ${game.items.n}\n` +
          `draws ${renderer.drawCalls}  res ${renderer.resolutionScale.toFixed(2)}x`,
      );
    } else hud.setDebug(null);
  }
  adaptQuality(dt);
  requestAnimationFrame(frame);
}

// Expose a tiny hook for automated tests.
(window as unknown as { __vespertine: unknown }).__vespertine = {
  get state() {
    return state;
  },
  get game() {
    return game;
  },
  get fps() {
    return fps;
  },
};

requestAnimationFrame(frame);
