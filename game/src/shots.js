// The screenshot scenes behind ?shot=start|drive|chase|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame.

import { STEP } from './config.js';
import { EVENT_BUSTED } from './world.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 3;
const CHASE_SECONDS = 3;
const END_LIMIT_SECONDS = 45;
const ACTION_ENTER = 4;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
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
  // Forward while turning: a stationary car with no steering authority can
  // never line up on a sideways target, so creep forward and arc onto it.
  const throttle = Math.abs(diff) > 2.2 ? 1 : -1;
  return { x: steer, y: throttle };
}

/** Put the player in a fresh car at a spot on the map, facing east. */
function placePlayerInCar(world, x, y, hp) {
  const state = world.state;
  const p = state.player;
  const car = {
    id: state.cars.length, kind: 'parked', road: null, axis: null, dir: 0, lane: 0,
    x, y, angle: 0, speed: 0, cruise: 0,
    hp: hp === undefined ? 100 : hp, color: '#c94f2a', wrecked: false, ramTimer: 0,
  };
  state.cars.push(car);
  p.inCar = true;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  return car;
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
    // Start already on Route 9 at the west end: the shot is the highway drive
    // itself, not the tight turn out of the gas-station forecourt.
    const car = placePlayerInCar(world, 420, 700, 100);
    const motel = { x: 1445, y: 625 };
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      const p = state.player;
      // East along the highway, weaving a little to look alive.
      const ahead = p.car.x + 600;
      const weave = 700 + Math.sin(state.time * 0.7) * 36;
      const move = driveInput(p.car, ahead, weave);
      const aim = aimAt(p, motel.x, motel.y);
      world.step(STEP, move, aim, false, 0);
    }
    return { screen: SCREEN_PLAY, best: state.player.cash };
  }

  if (name === 'chase') {
    world.reset();
    const car = placePlayerInCar(world, 420, 700, 250);
    const p = state.player;
    p.wanted = 4;
    p.quietTime = 0;
    // Two patrol cars already on the player's tail, so the chase reads in frame.
    for (const [dx, laneY] of [[-220, 676], [-280, 724]]) {
      state.cars.push({
        id: state.cars.length, kind: 'police', road: null, axis: null, dir: 0, lane: 0,
        x: car.x + dx, y: laneY, angle: 0, speed: 300, cruise: 0,
        hp: 95, color: '#2e4a7a', wrecked: false, ramTimer: 0,
      });
    }
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      // East along Route 9, weaving a little to look alive.
      const ahead = p.car.x + 600;
      const weave = 700 + Math.sin(state.time * 0.9) * 40;
      const move = driveInput(p.car, ahead, weave);
      world.step(STEP, move, { x: p.x + 400, y: p.y }, false, 0);
    }
    return { screen: SCREEN_PLAY, best: state.player.cash };
  }

  // end: a roadblock on the highway, the getaway car already hurt, no evasion.
  world.reset();
  const car = placePlayerInCar(world, 600, 700, 20);
  const p = state.player;
  p.wanted = 5;
  p.quietTime = 0;
  for (const offsetY of [664, 690, 716, 742, 768]) {
    state.cars.push({
      id: state.cars.length, kind: 'parked', road: null, axis: null, dir: 0, lane: 0,
      x: car.x + 280, y: offsetY, angle: Math.PI, speed: 0, cruise: 0,
      hp: 95, color: '#2e4a7a', wrecked: false, ramTimer: 0, fixed: true,
    });
  }
  let busted = false;
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
    const move = driveInput(p.car, p.car.x + 800, 700);
    const events = world.step(STEP, move, { x: p.x + 400, y: p.y }, false, 0);
    if (events & EVENT_BUSTED) {
      busted = true;
      break;
    }
  }
  if (!busted) state.busted = true;
  return { screen: SCREEN_BUSTED, best: state.player.cash };
}
