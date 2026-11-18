// The screenshot scenes behind ?shot=start|drive|chase|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame.

import { STEP } from './config.js';
import { EVENT_BUSTED } from './world.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 26;
const CHASE_SECONDS = 14;
const END_LIMIT_SECONDS = 45;
const ACTION_ENTER = 4;

function clamp(value, min, max) {
  return value < min ? min : value > max ? value : value;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Steering and throttle to drive a car toward a point on the map. */
function driveInput(car, tx, ty) {
  const desired = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(desired, car.angle);
  const steer = clamp(diff * 1.8, -1, 1);
  let throttle = -1;
  if (Math.abs(diff) > 2.2) throttle = 1;
  else if (Math.abs(diff) > 1.2) throttle = 0;
  return { x: steer, y: throttle };
}

/** Walking input toward a point on the map. */
function walkInput(px, py, tx, ty) {
  const dx = tx - px;
  const dy = ty - py;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function aimAt(p, tx, ty) {
  return { x: tx, y: ty };
}

/**
 * Set `world` to the named scene (start, drive, chase or end; any other name is
 * start) and return the screen to draw over it and the best cash to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name !== 'drive' && name !== 'chase' && name !== 'end') {
    world.reset();
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, { x: state.player.x, y: state.player.y }, false, 0);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'drive') {
    world.reset();
    const carMarker = { x: 1000, y: 618 };
    const motel = { x: 1445, y: 625 };
    let entered = false;
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      const p = state.player;
      let move = { x: 0, y: 0 };
      let actions = 0;
      let aim = { x: p.x, y: p.y };
      if (!entered) {
        move = walkInput(p.x, p.y, carMarker.x, carMarker.y);
        aim = aimAt(p, carMarker.x, carMarker.y);
        if (Math.hypot(carMarker.x - p.x, carMarker.y - p.y) < 60) actions = ACTION_ENTER;
        if (p.inCar) entered = true;
      } else {
        move = driveInput(p.car, motel.x, motel.y);
        aim = aimAt(p, motel.x, motel.y);
      }
      world.step(STEP, move, aim, false, actions);
    }
    return { screen: SCREEN_PLAY, best: state.player.cash };
  }

  if (name === 'chase') {
    world.reset();
    const carMarker = { x: 1000, y: 618 };
    let entered = false;
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      const p = state.player;
      let move = { x: 0, y: 0 };
      let actions = 0;
      if (!entered) {
        move = walkInput(p.x, p.y, carMarker.x, carMarker.y);
        if (Math.hypot(carMarker.x - p.x, carMarker.y - p.y) < 60) actions = ACTION_ENTER;
        if (p.inCar) {
          entered = true;
          p.wanted = 4;
          p.quietTime = 0;
        }
      } else {
        // East along the highway, weaving a little to look alive.
        const ahead = p.car.x + 700;
        const weave = 700 + Math.sin(state.time * 0.9) * 55;
        move = driveInput(p.car, ahead, weave);
      }
      world.step(STEP, move, { x: p.x + 400, y: p.y }, false, actions);
    }
    return { screen: SCREEN_PLAY, best: state.player.cash };
  }

  // end: a roadblock on the highway, the getaway car already hurt, no evasion.
  world.reset();
  const carMarker = { x: 1000, y: 618 };
  let entered = false;
  let roadblock = false;
  let busted = false;
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
    const p = state.player;
    let move = { x: 0, y: 0 };
    let actions = 0;
    if (!entered) {
      move = walkInput(p.x, p.y, carMarker.x, carMarker.y);
      if (Math.hypot(carMarker.x - p.x, carMarker.y - p.y) < 60) actions = ACTION_ENTER;
      if (p.inCar) {
        entered = true;
        p.car.hp = 25;
        p.wanted = 5;
        p.quietTime = 0;
      }
    } else {
      if (!roadblock) {
        roadblock = true;
        for (const offset of [380, 420]) {
          state.cars.push({
            id: state.cars.length, kind: 'police', road: null, axis: null, dir: 0, lane: 0,
            x: p.car.x + offset, y: 676, angle: Math.PI, speed: 0, cruise: 0,
            hp: 95, color: '#2e4a7a', wrecked: false, ramTimer: 0,
          });
        }
        state.cars.push({
          id: state.cars.length, kind: 'police', road: null, axis: null, dir: 0, lane: 0,
          x: p.car.x + 400, y: 724, angle: Math.PI, speed: 0, cruise: 0,
          hp: 95, color: '#2e4a7a', wrecked: false, ramTimer: 0,
        });
      }
      move = driveInput(p.car, p.car.x + 800, 700);
    }
    const events = world.step(STEP, move, { x: p.x + 400, y: p.y }, false, actions);
    if (events & EVENT_BUSTED) {
      busted = true;
      break;
    }
  }
  if (!busted) state.busted = true;
  return { screen: SCREEN_BUSTED, best: state.player.cash };
}
