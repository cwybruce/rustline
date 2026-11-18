// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, busted, wasted and
// complete. G saves the run to localStorage, L loads it back.
//
// ?seed=N fixes the traffic and the world. ?shot=start|drive|chase|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BUSTED, EVENT_CRIME, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED,
  createWorld,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_LOAD, ACTION_MUTE, ACTION_PAUSE, ACTION_SAVE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best cash then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = { best: scene.best, message: '', messageTimer: 0, muted: audio.isMuted() };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  const ui = { best, message: '', messageTimer: 0, muted: false };

  function announce(message) {
    status.textContent = message;
  }

  function showMessage(message, seconds) {
    ui.message = message;
    ui.messageTimer = seconds;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    showMessage('Job 1: Smuggler\'s Run — steal a car', 4);
    announce('Playing. Steal a car to start the first job.');
  }

  function endGame(nextScreen) {
    screen = nextScreen;
    if (world.state.player.cash > best) {
      best = world.state.player.cash;
      saveBest(best);
      ui.best = best;
    }
    if (nextScreen === SCREEN_BUSTED) {
      audio.busted();
      announce('Busted. The highway patrol caught Rosa.');
    } else if (nextScreen === SCREEN_WASTED) {
      announce('Wasted. Rosa went down on Route 9.');
    } else if (nextScreen === SCREEN_COMPLETE) {
      audio.mission();
      announce(`Delivered. All four jobs done. Cash $${world.state.player.cash}.`);
    }
  }

  function saveRun() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.serialize()));
      showMessage('Run saved', 2);
    } catch {
      showMessage('Save failed — storage is off', 2);
    }
  }

  function loadRun() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) {
        showMessage('No saved run', 2);
        return;
      }
      if (world.deserialize(JSON.parse(raw))) {
        screen = SCREEN_PLAY;
        showMessage('Run loaded', 2);
        announce('Run loaded.');
      }
    } catch {
      showMessage('Load failed', 2);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      ui.muted = audio.isMuted();
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_SAVE && screen === SCREEN_PLAY) saveRun();
    if (actions & ACTION_LOAD && (screen === SCREEN_PLAY || screen === SCREEN_TITLE)) loadRun();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_COMPLETE)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, { x: world.state.player.x, y: world.state.player.y }, false, 0);
      return;
    }
    const mouse = input.mouse;
    const aim = renderer.toWorld(world.state, mouse.x, mouse.y);
    const events = world.step(STEP, input.move(), aim, mouse.down, actions);
    const p = world.state.player;
    if (events & EVENT_MISSION) {
      audio.mission();
      if (world.state.complete) endGame(SCREEN_COMPLETE);
      else showMessage(`Job done — cash $${p.cash}`, 3);
    }
    if (events & EVENT_PICKUP) {
      audio.pickup();
      showMessage(`+$${50}`, 1.5);
    }
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_CRIME) showMessage(`Wanted level ${p.wanted}`, 2);
    if (events & EVENT_BUSTED) endGame(SCREEN_BUSTED);
    else if (events & EVENT_WASTED) endGame(SCREEN_WASTED);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;
    const actions = handleActions();
    ui.messageTimer = Math.max(0, ui.messageTimer - frameDt);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const p = world.state.player;
    const driving = p.inCar && p.car ? Math.abs(p.car.speed) / 640 : 0;
    audio.engine(driving, p.inCar);
    const policeNear = world.state.cars.some((c) => c.kind === 'police' && !c.wrecked
      && Math.hypot(c.x - p.x, c.y - p.y) < 700);
    audio.siren(p.wanted > 0 && policeNear, STEP);
    renderer.draw(world.state, screen, ui);
  }

  // Leaving the tab pauses a running game rather than letting the patrol close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Rustline. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
