import './style.css';
import { AudioEngine } from './audio/audio';
import { PRACTICE_PHASES, STRESS_PHASE_INDEX, registerPracticeBursts } from './content/practice';
import { Input } from './core/input';
import { TICK } from './game/constants';
import { EMPTY_INPUT, Game } from './game/game';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import { computeLayout, readSafeInsets, type Layout } from './ui/layout';

type State = 'title' | 'play' | 'paused' | 'over';

const params = new URLSearchParams(location.search);
const START_PHASE = params.has('stress') ? STRESS_PHASE_INDEX : Number(params.get('phase') ?? 0) || 0;
const GOD = params.has('god');

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const canvas = $<HTMLCanvasElement>('#gl');
const renderer = new Renderer(canvas);
const input = new Input(document.body);
const audio = new AudioEngine();
const hud = new Hud();

let state: State = 'title';
let game: Game | null = null;
let layout: Layout;
let showDebug = params.has('debug') || params.has('stress');

function loadHiScore(): number {
  try {
    return Number(localStorage.getItem('vespertine.m0.hi') ?? 0) || 0;
  } catch {
    return 0;
  }
}
function saveHiScore(v: number): void {
  try {
    localStorage.setItem('vespertine.m0.hi', String(v));
  } catch {
    /* storage unavailable (private mode): ignore */
  }
}
hud.hiScore = loadHiScore();

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

// ───────────────────────────── state changes ─────────────────────────────

document.body.classList.add('title-screen');

function show(id: string, on: boolean): void {
  $(id).classList.toggle('show', on);
}

function newGame(): void {
  game = new Game(PRACTICE_PHASES, 20261126, 0);
  registerPracticeBursts(game);
  if (START_PHASE > 0) game.jumpTo(Math.min(START_PHASE, PRACTICE_PHASES.length - 1));
  input.flush();
}

function startFromTitle(): void {
  audio.unlock();
  audio.playTrack('stage1');
  if (input.touchMode && document.documentElement.requestFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('portrait'))
      .catch(() => {});
  }
  void (navigator as Navigator & { wakeLock?: { request(t: string): Promise<unknown> } }).wakeLock?.request('screen').catch(() => {});
  show('#title', false);
  document.body.classList.remove('title-screen');
  newGame();
  state = 'play';
}

function pause(): void {
  if (state !== 'play') return;
  state = 'paused';
  show('#pause', true);
  audio.suspend();
}

function resume(): void {
  if (state !== 'paused') return;
  state = 'play';
  show('#pause', false);
  input.flush();
  audio.resume();
}

function restart(): void {
  show('#pause', false);
  show('#over', false);
  audio.resume();
  newGame();
  state = 'play';
}

function gameOver(): void {
  state = 'over';
  saveHiScore(hud.hiScore);
  $('.over-score').textContent = `Score ${game!.score.toLocaleString('en-US')} · Graze ${game!.graze}`;
  setTimeout(() => show('#over', true), 900);
}

$('#title').addEventListener('click', () => state === 'title' && startFromTitle());
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
        restart();
        break;
      case 'mute':
        toggleMute();
        break;
      case 'flash':
        renderer.reduceFlash = !renderer.reduceFlash;
        flashBtn.textContent = `Reduce flashing: ${renderer.reduceFlash ? 'On' : 'Off'}`;
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

window.addEventListener('keydown', (e) => {
  if (e.code === 'Backquote' || e.code === 'F3') {
    showDebug = !showDebug;
    e.preventDefault();
  }
  if (e.code === 'KeyM') toggleMute();
  if (state === 'play' && game && /^Digit[1-5]$/.test(e.code)) game.jumpTo(Number(e.code.slice(5)) - 1);
});

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

function handleEvents(g: Game): void {
  for (const ev of g.events) {
    switch (ev) {
      case 'declare':
        audio.play('declare');
        if (g.boss.elegy) hud.showBanner(g.boss.elegy);
        if (navigator.vibrate && input.touchMode) navigator.vibrate(20);
        break;
      case 'death':
        audio.play('death');
        if (navigator.vibrate && input.touchMode) navigator.vibrate([60, 40, 60]);
        break;
      case 'bomb':
        audio.play('bomb');
        if (navigator.vibrate && input.touchMode) navigator.vibrate(40);
        break;
      case 'gameover':
        gameOver();
        break;
      case 'shot':
      case 'graze':
      case 'phaseEnd':
      case 'vigil':
      case 'bossHit':
        audio.play(ev);
        break;
      case 'cycle':
        hud.showBanner('The effigy stands again.');
        break;
    }
  }
}

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
  } else if (state === 'over') {
    game.tick(EMPTY_INPUT);
  }
}

function adaptQuality(dt: number): void {
  if (state !== 'play') return;
  qualityTimer += dt;
  qualityFrames++;
  if (dt > 1 / 45) slowFrames++;
  if (qualityTimer < 2) return;
  const slowShare = slowFrames / qualityFrames;
  if (slowShare > 0.25 && renderer.resolutionScale > 0.75) {
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

  if (state === 'title') {
    if (input.takeConfirm()) startFromTitle();
  } else if (state === 'paused') {
    if (input.takePause()) resume();
  } else if (state === 'over') {
    if (input.takeConfirm() && $('#over').classList.contains('show')) restart();
  }

  acc += dt;
  let steps = 0;
  while (acc >= TICK && steps < 2) {
    step();
    acc -= TICK;
    steps++;
  }
  // Fall behind gracefully: slow down instead of skipping ahead (genre convention).
  if (acc > TICK) acc = 0;

  if (state !== 'paused') renderer.updateVisuals(dt, game);
  renderer.render(state === 'title' ? null : game, layout.field, layout.vh);
  if (game && state !== 'title') hud.update(game);

  if (game) {
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
    if (showDebug && game) {
      hud.setDebug(
        `fps ${fps.toFixed(0)}  sim ${simMs.toFixed(2)}ms\n` +
          `bullets ${game.bullets.n}  shots ${game.shots.n}  fx ${game.fx.n}\n` +
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
