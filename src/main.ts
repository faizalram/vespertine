import './style.css';
import { AudioEngine, type Sfx } from './audio/audio';
import { practiceScript } from './content/practice';
import { RECOLLECTIONS } from './content/recollections';
import { HOSHIKO, CROW_MATRON, STAGE1_STORY, type StageStory } from './content/stage1';
import { HOSHIKO_REMATCH, ONDINE, STAGE2_STORY } from './content/stage2';
import { INKMOTH_SWARM, SERAPHINE, STAGE3_STORY } from './content/stage3';
import { storyScript } from './content/story';
import { Input } from './core/input';
import { TICK } from './game/constants';
import { CHARACTERS } from './game/characters';
import { CHAR_IDS, DIFFICULTIES, type BossDef, type CharId, type DifficultyId, type Speaker } from './game/defs';
import { EMPTY_INPUT, Game, type GameOptions } from './game/game';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import { computeLayout, readSafeInsets, type Layout } from './ui/layout';
import { paintPortrait, SPEAKER_NAMES } from './ui/portraits';

type State = 'title' | 'codex' | 'select' | 'difficulty' | 'play' | 'paused' | 'over' | 'clear' | 'interlude';

const params = new URLSearchParams(location.search);
const GOD = params.has('god');
const PRACTICE = params.has('practice') || params.has('stress');
const START_AT: GameOptions['startAt'] = params.has('boss') ? 'boss' : params.has('midboss') ? 'midboss' : 'start';
const START_STAGE = Math.max(1, Math.min(3, Number(params.get('stage') ?? 1) || 1));
const FORCED_CHAR = CHAR_IDS.includes(params.get('char') as CharId) ? (params.get('char') as CharId) : null;
const FORCED_DIFF = params.has('diff') ? (Math.max(0, Math.min(3, Number(params.get('diff')))) as DifficultyId) : null;

const STORIES: readonly Record<CharId, StageStory>[] = [STAGE1_STORY, STAGE2_STORY, STAGE3_STORY];
const ALL_BOSSES: readonly BossDef[] = [CROW_MATRON, HOSHIKO, HOSHIKO_REMATCH, ONDINE, INKMOTH_SWARM, SERAPHINE];

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
  lastChar?: CharId;
  hi: Record<string, number>;
  elegies: Record<string, { attempts: number; captures: number }>;
  stage1Clears: Record<string, number>;
  recollections: number[];
  bossesMet: string[];
}

const SAVE_KEY = 'vespertine.save.v1';
function loadSave(): SaveData {
  const fresh: SaveData = { hi: {}, elegies: {}, stage1Clears: {}, recollections: [], bossesMet: [] };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { ...fresh, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return fresh;
}
const save = loadSave();
let charId: CharId = FORCED_CHAR ?? save.lastChar ?? 'sayo';
function persist(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* private mode: progress lives only for this session */
  }
}
function recordHiScore(): void {
  if (!game) return;
  const k = `${game.char.id}|${game.diff}`;
  save.hi[k] = Math.max(save.hi[k] ?? 0, game.score);
  persist();
}
function elegyStat(g: Game) {
  const def = g.boss.def?.phases[g.boss.phase];
  if (!def) return null;
  return (save.elegies[`${def.id}|${g.char.id}|${g.diff}`] ??= { attempts: 0, captures: 0 });
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

const SCREENS = ['#title', '#codex', '#select', '#difficulty', '#pause', '#over', '#clear', '#interlude'];
const MENU_SCREENS = new Set(['#title', '#codex', '#select', '#difficulty', '#interlude']);
function showScreen(id: string | null): void {
  for (const s of SCREENS) $(s).classList.toggle('show', s === id);
  document.body.classList.toggle('title-screen', id !== null && MENU_SCREENS.has(id));
  document.body.classList.toggle('menu-open', id !== null);
  if (id) {
    const first = $(id).querySelector<HTMLButtonElement>('button:not(:disabled):not(.quiet):not(.tab)');
    first?.focus({ preventScroll: true });
  }
}
showScreen('#title');

function toTitle(): void {
  recordHiScore();
  game = null;
  state = 'title';
  audio.resume();
  audio.playTrack('title');
  showScreen('#title');
}

function enterSelect(): void {
  audio.unlock();
  audio.playTrack('title');
  if (FORCED_CHAR || PRACTICE) {
    enterDifficulty();
    return;
  }
  buildCards();
  state = 'select';
  showScreen('#select');
  selectChar(charId);
}

let cardsBuilt = false;
function buildCards(): void {
  if (cardsBuilt) return;
  cardsBuilt = true;
  const box = $('#select .cards');
  for (const id of CHAR_IDS) {
    const ch = CHARACTERS[id];
    const card = document.createElement('button');
    card.className = 'card';
    card.dataset.char = id;
    const cv = document.createElement('canvas');
    paintPortrait(cv, id, 'neutral');
    const name = document.createElement('span');
    name.className = 'c-name';
    name.textContent = ch.name.replace('Sister ', '');
    const stars = document.createElement('span');
    stars.className = 'c-stars';
    stars.textContent = '★'.repeat(ch.stars) + '☆'.repeat(3 - ch.stars);
    card.append(cv, name, stars);
    card.addEventListener('click', () => {
      if (charId === id && card.classList.contains('sel')) chooseChar();
      else selectChar(id);
    });
    box.append(card);
  }
}

function selectChar(id: CharId): void {
  charId = id;
  const ch = CHARACTERS[id];
  document.querySelectorAll<HTMLElement>('#select .card').forEach((c) => c.classList.toggle('sel', c.dataset.char === id));
  $('#select .d-title').textContent = ch.title;
  $('#select .d-name').textContent = ch.name;
  $('#select .d-quote').textContent = ch.quote;
  $('#select .d-stance').textContent = ch.stance;
  $('#select .d-play').textContent = ch.playstyle;
  $('#select .d-meta').textContent = `Skill: ${ch.skillName} · ${ch.bombName}`;
  $<HTMLButtonElement>('[data-act="choose"]').focus({ preventScroll: true });
}

function chooseChar(): void {
  save.lastChar = charId;
  persist();
  audio.play('select');
  enterDifficulty();
}

function enterDifficulty(): void {
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
  const script = PRACTICE ? practiceScript(params.has('stress')) : storyScript;
  game = new Game(script, { difficulty, char: charId, startAt: START_AT, startStage: START_STAGE, seed: (Date.now() & 0xffffff) | 1 });
  hud.hiScore = save.hi[`${charId}|${difficulty}`] ?? 0;
  hud.resetScore();
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
  if (game.results.stage === 1) save.stage1Clears[String(game.diff)] = (save.stage1Clears[String(game.diff)] ?? 0) + 1;
  persist();
  const r = game.results;
  const rows: Array<[string, string]> = [
    ['Stage', `${r.stage} · ${game.stageInfo?.title ?? ''}`],
    ['Difficulty', DIFFICULTIES[game.diff]],
    ['Stage clear bonus', r.clearBonus.toLocaleString('en-US')],
    ['Elegies captured', `${r.captures} / ${r.elegies}`],
    ['Recollections', `${r.recollections} / 30`],
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
  $('#clear h2').textContent = r.final ? 'Act One Clear' : 'Stage Clear';
  setTimeout(() => state === 'clear' && showScreen('#clear'), 1200);
}

const interludeTimers: number[] = [];
function showInterlude(): void {
  if (!game?.results) return;
  state = 'interlude';
  audio.stopMusic();
  showScreen('#interlude');
  const stage = game.results.stage;
  const final = game.results.final;
  const interlude = STORIES[stage - 1][charId].interlude;
  interludeTimers.forEach(clearTimeout);
  interludeTimers.length = 0;
  $('#interlude .il-title').textContent = interlude.title;
  const box = $('#interlude .il-lines');
  box.innerHTML = '';
  const end = $('#interlude .il-end');
  const onwardBtn = $('#interlude .il-onward');
  const titleBtn = $('#interlude .il-title-btn');
  end.classList.remove('show');
  onwardBtn.classList.remove('show');
  end.textContent = final ? 'End of Act One. The road continues up the Silent Belfry in a later build.' : '';
  onwardBtn.style.display = final ? 'none' : '';
  titleBtn.style.display = final ? '' : 'none';
  interlude.lines.forEach((text, i) => {
    const p = document.createElement('p');
    p.textContent = text;
    box.append(p);
    interludeTimers.push(window.setTimeout(() => p.classList.add('show'), 600 + i * 1800));
  });
  interludeTimers.push(
    window.setTimeout(() => {
      end.classList.add('show');
      onwardBtn.classList.add('show');
      (final ? titleBtn : onwardBtn).focus({ preventScroll: true });
    }, 600 + interlude.lines.length * 1800),
  );
}

function onward(): void {
  if (!game || state !== 'interlude') return;
  game.nextStage();
  hud.resetScore();
  showScreen(null);
  input.flush();
  state = 'play';
}

// ───────────────────────────── codex ─────────────────────────────

let codexTab: 'recollections' | 'people' | 'elegies' = 'recollections';

function openCodex(): void {
  audio.unlock();
  state = 'codex';
  renderCodex();
  showScreen('#codex');
}

function renderCodex(): void {
  document.querySelectorAll<HTMLElement>('#codex .tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === codexTab));
  const body = $('#codex .codex-body');
  body.innerHTML = '';
  const el = (tag: string, cls = '', text = '') => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  if (codexTab === 'recollections') {
    const got = new Set(save.recollections);
    const titles = ['Fields of Unharvested Names', 'The Drowned Lantern Market', 'The Library of Kinder Endings'];
    for (let s = 1; s <= 3; s++) {
      const list = RECOLLECTIONS.map((r, i) => [r, i] as const).filter(([r]) => r.stage === s);
      const have = list.filter(([, i]) => got.has(i)).length;
      const h = el('h3', '', `Stage ${s} · ${titles[s - 1]}`);
      h.append(el('small', '', `${have} / ${list.length}`));
      body.append(h);
      const ol = el('ol');
      for (const [r, i] of list) ol.append(got.has(i) ? el('li', '', r.text) : el('li', 'locked', 'Not yet remembered.'));
      body.append(ol);
    }
  } else if (codexTab === 'people') {
    body.append(el('h3', '', 'Those who remember'));
    for (const id of CHAR_IDS) body.append(personRow(id, CHARACTERS[id].title, CHARACTERS[id].quote, true));
    body.append(el('h3', '', 'Those you met on the road'));
    const bossLines: Array<[Speaker | null, BossDef, string]> = [
      [null, CROW_MATRON, 'She counts the crows every evening. The number never comes out right.'],
      ['hoshiko', HOSHIKO, 'Guards a field nobody remembers planting. Somebody planted it. That is enough for her.'],
      ['ondine', ONDINE, '“Grief is just love with poor liquidity.” Keeps everything nobody came back for.'],
      [null, INKMOTH_SWARM, 'They eat only endings. The beginnings are all still there.'],
      ['seraphine', SERAPHINE, 'Rewrites sad stories into happy ones, and cannot understand why the pages go blank.'],
    ];
    for (const [speaker, def, blurb] of bossLines) {
      const met = save.bossesMet.includes(def.id);
      body.append(personRow(speaker, met ? def.title : '???', met ? blurb : 'Not yet met.', met, met ? def.name : '???'));
    }
  } else {
    const table = el('table', 'elegy-table');
    for (const def of ALL_BOSSES) {
      for (const ph of def.phases) {
        if (!ph.elegy) continue;
        let attempts = 0;
        let captures = 0;
        for (const [k, v] of Object.entries(save.elegies)) {
          if (k.startsWith(`${ph.id}|`)) {
            attempts += v.attempts;
            captures += v.captures;
          }
        }
        const tr = el('tr', attempts ? '' : 'unseen');
        tr.append(el('td', '', attempts ? ph.elegy : '??? Elegy'), el('td', '', def.name), el('td', 'num', `${captures} / ${attempts}`));
        table.append(tr);
      }
    }
    body.append(el('h3', '', 'Elegy History'), table);
  }
}

function personRow(speaker: Speaker | null, title: string, text: string, unlocked: boolean, name?: string): HTMLElement {
  const row = document.createElement('div');
  row.className = `person${unlocked ? '' : ' locked'}`;
  const cv = document.createElement('canvas');
  if (speaker && unlocked) paintPortrait(cv, speaker, 'neutral');
  const info = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = name ?? (speaker ? SPEAKER_NAMES[speaker] : '');
  const i = document.createElement('i');
  i.textContent = title;
  const p = document.createElement('p');
  p.textContent = text;
  info.append(b, i, p);
  row.append(cv, info);
  return row;
}

// ───────────────────────────── DOM wiring ─────────────────────────────

document.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((b) =>
  b.addEventListener('click', () => {
    if (state !== 'difficulty' || b.disabled) return;
    audio.play('select');
    startGame(Number(b.dataset.diff) as DifficultyId);
  }),
);
document.querySelectorAll<HTMLButtonElement>('#codex .tab').forEach((b) =>
  b.addEventListener('click', () => {
    codexTab = b.dataset.tab as typeof codexTab;
    audio.play('select');
    renderCodex();
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
      case 'story':
        enterSelect();
        break;
      case 'codex':
        openCodex();
        break;
      case 'closeCodex':
        state = 'title';
        showScreen('#title');
        break;
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
      case 'choose':
        chooseChar();
        break;
      case 'toSelect':
        enterSelect();
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
      case 'onward':
        onward();
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

/** Keyboard menu navigation: arrows move between buttons, Z / Enter activates, X / Esc backs out. */
function menuKey(e: KeyboardEvent): boolean {
  const screenEl = SCREENS.map((s) => $(s)).find((el) => el.classList.contains('show'));
  if (!screenEl) return false;
  const buttons = Array.from(screenEl.querySelectorAll<HTMLButtonElement>('button')).filter(
    (b) => !b.disabled && b.offsetParent !== null && getComputedStyle(b).display !== 'none',
  );
  if (!buttons.length) return false;
  const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    const d = e.code === 'ArrowDown' || e.code === 'ArrowRight' ? 1 : -1;
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
    else if (state === 'difficulty') enterSelect();
    else if (state === 'codex') {
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
  if (state === 'select') {
    const i = CHAR_IDS.indexOf(charId);
    if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
      selectChar(CHAR_IDS[(i + 1) % 4]);
      audio.play('select');
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
      selectChar(CHAR_IDS[(i + 3) % 4]);
      audio.play('select');
    } else if (e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'Space') chooseChar();
    else if (e.code === 'KeyX' || e.code === 'Escape') {
      state = 'title';
      showScreen('#title');
    }
    e.preventDefault();
    input.takePause();
    return;
  }
  if (state !== 'play') {
    if (menuKey(e)) {
      e.preventDefault();
      input.takePause(); // swallow the Escape the Input layer also saw
    }
    return;
  }
  if (game && /^Digit[1-5]$/.test(e.code)) game.jumpTo(Number(e.code.slice(5)) - 1);
});

// ───────────────────────────── events ─────────────────────────────

const DIRECT_SFX: Partial<Record<string, Sfx>> = {
  shot: 'shot', graze: 'graze', phaseEnd: 'phaseEnd', bossHit: 'bossHit', laser: 'laser',
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
      case 'bossEnter':
        if (g.boss.def && !save.bossesMet.includes(g.boss.def.id)) {
          save.bossesMet.push(g.boss.def.id);
          persist();
        }
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
          const st = elegyStat(g);
          if (st) st.captures++;
          persist();
        }
        break;
      }
      case 'recollection': {
        audio.play('recollection');
        const idx = g.lastRecollection;
        if (idx >= 0) {
          hud.showRecollection(RECOLLECTIONS[idx].text);
          if (!save.recollections.includes(idx)) {
            save.recollections.push(idx);
            persist();
          }
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
      case 'skill':
        audio.play(({ sayo: 'vigil', ilse: 'pin', tessel: 'rewind', wren: 'bell' } as const)[g.char.id]);
        if (g.char.id === 'wren') vibrate(30);
        break;
      case 'dollCrack':
        audio.play('dollCrack');
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
let slowTick = 0;

function step(): void {
  if (!game) return;
  if (state === 'play') {
    if (input.takePause()) {
      pause();
      return;
    }
    // Slow motion (boss defeat): the world advances one tick in three.
    if (game.slowmo > 0) {
      game.slowmo--;
      if (slowTick++ % 3 !== 0) return;
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

  const inGame = game !== null && (state === 'play' || state === 'paused' || state === 'over' || state === 'clear');
  if (state !== 'paused') renderer.updateVisuals(dt, inGame ? game : null);
  // Interpolate between the previous and current tick (frozen while paused or slowed).
  const alpha = state === 'play' && !(game && game.slowmo > 0) ? acc / TICK : 1;
  renderer.render(inGame ? game : null, layout.field, layout.vh, alpha);
  if (inGame && game) {
    hud.update(game);
    const cs = game.cs;
    const ready = game.char.id === 'ilse' ? cs.pinCooldown === 0 : cs.meter >= 1 && !cs.vigil.active;
    btnSkill.classList.toggle('ready', ready);
    btnBomb.disabled = game.player.bombs <= 0;
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
          `bullets ${game.bullets.n}  lasers ${game.lasers.n}  enemies ${game.enemies.length}  items ${game.items.n}\n` +
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
