// Rustline's world: the desert town, its roads and buildings, traffic, pedestrians,
// the police, the four missions, combat and the wanted level. Pure simulation: state
// in, events out. The renderer draws it; the input module feeds it.

import {
  BUILDINGS, CAR, CASH_PICKUP, LAKEBED, MISSIONS, PARKED_CARS, PEDESTRIAN,
  PICKUPS, PLAYER, POLICE, ROADS, TRAFFIC, WANTED, WORLD,
} from './config.js';
import { createRandom } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_BUSTED = 2;
export const EVENT_WASTED = 4;
export const EVENT_MISSION = 8;
export const EVENT_PICKUP = 16;
export const EVENT_SHOT = 32;
export const EVENT_CRIME = 64;

function clamp(value, min, max) {
  return value < min ? min : value > max ? value : value;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Push a circle out of a solid rectangle; returns true when it overlapped. */
function pushCircleOutOfRect(circle, radius, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    circle.x = nearestX + (dx / d) * radius;
    circle.y = nearestY + (dy / d) * radius;
  } else {
    // Centre inside the rectangle: push out along the smallest exit.
    const left = circle.x - rect.x;
    const right = rect.x + rect.w - circle.x;
    const top = circle.y - rect.y;
    const bottom = rect.y + rect.h - circle.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) circle.x = rect.x - radius;
    else if (m === right) circle.x = rect.x + rect.w + radius;
    else if (m === top) circle.y = rect.y - radius;
    else circle.y = rect.y + rect.h + radius;
  }
  return true;
}

function circleHitsRect(x, y, radius, rect) {
  const nearestX = clamp(x, rect.x, rect.x + rect.w);
  const nearestY = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function pointOnRoad(road, rng) {
  if (road.x1 === road.x2) {
    return { x: road.x1, y: rng.range(road.y1 + 40, road.y2 - 40) };
  }
  return { x: rng.range(road.x1 + 40, road.x2 - 40), y: road.y1 };
}

export function createWorld(random) {
  const state = {
    time: 0,
    playTime: 0,
    seed: 0,
    player: null,
    cars: [],
    peds: [],
    officers: [],
    bullets: [],
    pickups: [],
    decorations: [],
    speckles: [],
    missionIndex: 0,
    mission: { phase: 'steal', timer: 0, grabTimer: 0, failed: false },
    policeTimer: 0,
    officerTimer: 0,
    crimeCooldown: 0,
    complete: false,
    completeTime: 0,
    busted: false,
    wasted: false,
  };

  function spawnTrafficCar() {
    const road = random.pick(ROADS);
    const point = pointOnRoad(road, random);
    const axis = road.x1 === road.x2 ? 'y' : 'x';
    const dir = random.chance(0.5) ? 1 : -1;
    const lane = (random.chance(0.5) ? 1 : -1) * (road.width / 4);
    const angle = axis === 'x' ? (dir === 1 ? 0 : Math.PI) : (dir === 1 ? Math.PI / 2 : -Math.PI / 2);
    return {
      id: state.cars.length,
      kind: 'traffic',
      road, axis, dir, lane,
      x: point.x, y: point.y,
      angle,
      speed: TRAFFIC.speed + random.range(-TRAFFIC.speedJitter, TRAFFIC.speedJitter),
      cruise: TRAFFIC.speed + random.range(-TRAFFIC.speedJitter, TRAFFIC.speedJitter),
      hp: TRAFFIC.hp,
      color: random.pick(['#8fa3b8', '#b8a58f', '#7a9c7a', '#a87a8c', '#c9c9c9', '#5a7a9c']),
      wrecked: false,
      ramTimer: 0,
    };
  }

  function spawnPed() {
    const road = random.pick(ROADS);
    const point = pointOnRoad(road, random);
    const axis = road.x1 === road.x2 ? 'y' : 'x';
    const side = random.chance(0.5) ? 1 : -1;
    const offset = side * (road.width / 2 + 14);
    return {
      x: axis === 'x' ? point.x : point.x + offset,
      y: axis === 'x' ? point.y + offset : point.y,
      angle: 0,
      speed: PEDESTRIAN.speed + random.range(-PEDESTRIAN.speedJitter, PEDESTRIAN.speedJitter),
      road, axis, dir: random.chance(0.5) ? 1 : -1, offset,
      down: false, downTimer: 0,
      color: random.pick(['#e8dcc8', '#c9a86a', '#7a9cc9', '#c97a7a', '#9cc97a']),
    };
  }

  function spawnPickup(kind, rng) {
    const road = random.pick(ROADS);
    const point = pointOnRoad(road, rng);
    return { kind, x: point.x + rng.range(-30, 30), y: point.y + rng.range(-30, 30), taken: false };
  }

  function reset() {
    state.time = 0;
    state.playTime = 0;
    state.missionIndex = 0;
    state.mission = { phase: 'steal', timer: 0, grabTimer: 0, failed: false };
    state.policeTimer = 0;
    state.officerTimer = 0;
    state.crimeCooldown = 0;
    state.complete = false;
    state.completeTime = 0;
    state.busted = false;
    state.wasted = false;
    state.player = {
      x: 1150, y: 760, angle: -Math.PI / 2,
      hp: PLAYER.hp, cash: 0, ammo: PLAYER.ammoStart, reserve: 48,
      wanted: 0, quietTime: 0, decayTimer: 0,
      inCar: false, car: null,
      invulnerable: 0, bustMeter: 0,
      aimAngle: 0, fireTimer: 0, punchTimer: 0,
    };
    state.cars = [];
    for (let i = 0; i < TRAFFIC.count; i += 1) state.cars.push(spawnTrafficCar());
    for (const parked of PARKED_CARS) {
      state.cars.push({
        id: state.cars.length, kind: 'parked',
        road: null, axis: null, dir: 0, lane: 0,
        x: parked.x, y: parked.y, angle: parked.angle, speed: 0, cruise: 0,
        hp: CAR.hp, color: parked.color, wrecked: false, ramTimer: 0,
      });
    }
    state.peds = [];
    for (let i = 0; i < PEDESTRIAN.count; i += 1) state.peds.push(spawnPed());
    state.officers = [];
    state.bullets = [];
    state.pickups = [];
    for (let i = 0; i < PICKUPS.cash; i += 1) state.pickups.push(spawnPickup('cash', random));
    for (let i = 0; i < PICKUPS.medkit; i += 1) state.pickups.push(spawnPickup('medkit', random));
    for (let i = 0; i < PICKUPS.ammo; i += 1) state.pickups.push(spawnPickup('ammo', random));
    state.decorations = [];
    for (let i = 0; i < 130; i += 1) {
      const x = random.range(40, WORLD.width - 40);
      const y = random.range(40, WORLD.height - 40);
      const onRoad = ROADS.some((r) => {
        const pad = r.width / 2 + 24;
        if (r.x1 === r.x2) return Math.abs(x - r.x1) < pad && y > r.y1 - 20 && y < r.y2 + 20;
        return Math.abs(y - r.y1) < pad && x > r.x1 - 20 && x < r.x2 + 20;
      });
      const inBuilding = BUILDINGS.some((b) => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20);
      if (!onRoad && !inBuilding) {
        state.decorations.push({ x, y, kind: random.chance(0.55) ? 'cactus' : 'rock', size: random.range(6, 16) });
      }
    }
    state.speckles = [];
    for (let i = 0; i < 320; i += 1) {
      state.speckles.push({ x: random.range(0, WORLD.width), y: random.range(0, WORLD.height), r: random.range(1, 3) });
    }
  }

  function addWanted(amount) {
    const p = state.player;
    p.wanted = Math.min(WANTED.max, p.wanted + amount);
    p.quietTime = 0;
    p.decayTimer = 0;
  }

  function resolveCarBuildings(car) {
    const fx = car.x + Math.cos(car.angle) * 18;
    const fy = car.y + Math.sin(car.angle) * 18;
    const bx = car.x - Math.cos(car.angle) * 18;
    const by = car.y - Math.sin(car.angle) * 18;
    for (const b of BUILDINGS) {
      const front = { x: fx, y: fy };
      const back = { x: bx, y: by };
      if (pushCircleOutOfRect(front, 15, b) || pushCircleOutOfRect(back, 15, b)) {
        car.x = (front.x + back.x) / 2;
        car.y = (front.y + back.y) / 2;
        if (Math.abs(car.speed) > 240) {
          car.hp -= 6;
          car.speed *= 0.4;
        } else {
          car.speed *= 0.7;
        }
      }
    }
    car.x = clamp(car.x, 30, WORLD.width - 30);
    car.y = clamp(car.y, 30, WORLD.height - 30);
  }

  function resolvePlayerBuildings(p) {
    for (const b of BUILDINGS) pushCircleOutOfRect(p, PLAYER.radius, b);
    p.x = clamp(p.x, 20, WORLD.width - 20);
    p.y = clamp(p.y, 20, WORLD.height - 20);
  }

  function updatePlayerCar(dt, move) {
    const p = state.player;
    const car = p.car;
    const speed = car.speed;
    const grip = clamp(Math.abs(speed) / 220, 0, 1);
    car.angle += move.x * CAR.turnRate * (speed >= 0 ? 1 : -1) * grip * dt;
    if (move.y < 0) car.speed += CAR.accel * dt;
    else if (move.y > 0) {
      if (speed > 10) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= car.speed * CAR.drag * dt;
    }
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    resolveCarBuildings(car);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (car.hp <= 0) {
      state.busted = true;
    }
  }

  function updatePlayerFoot(dt, move, aim) {
    const p = state.player;
    const len = Math.hypot(move.x, move.y);
    if (len > 0.01) {
      const nx = move.x / len;
      const ny = move.y / len;
      p.x += nx * PLAYER.walkSpeed * dt;
      p.y += ny * PLAYER.walkSpeed * dt;
      p.angle = Math.atan2(ny, nx);
      resolvePlayerBuildings(p);
    }
    p.aimAngle = Math.atan2(aim.y - p.y, aim.x - p.x);
  }

  function nearestStealableCar() {
    const p = state.player;
    let best = null;
    let bestD = CAR.enterRange;
    for (const car of state.cars) {
      if (car.kind !== 'parked') continue;
      if (car.wrecked) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    const p = state.player;
    car.kind = 'player';
    car.speed = 0;
    p.inCar = true;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    addWanted(WANTED.stealCar);
    return EVENT_CRIME;
  }

  function exitCar() {
    const p = state.player;
    const car = p.car;
    car.kind = 'parked';
    car.speed = 0;
    const side = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
    p.x = car.x + side.x * 40;
    p.y = car.y + side.y * 40;
    resolvePlayerBuildings(p);
    p.inCar = false;
    p.car = null;
  }

  reset();
  return { state, reset, step, addWanted, nearestStealableCar, currentMarker, serialize, deserialize };

  function currentMarker() {
    const mission = MISSIONS[state.missionIndex];
    if (!mission) return null;
    if (state.missionIndex === 0 && state.mission.phase === 'steal') return mission.carMarker;
    if (state.missionIndex === 1 && state.mission.phase === 'escape') return mission.escape;
    return mission.marker;
  }

  function serialize() {
    const p = state.player;
    return {
      cash: p.cash, hp: p.hp, ammo: p.ammo, reserve: p.reserve,
      missionIndex: state.missionIndex, missionPhase: state.mission.phase,
      x: p.x, y: p.y, wanted: p.wanted, playTime: state.playTime,
    };
  }

  function deserialize(data) {
    if (!data || typeof data !== 'object') return false;
    reset();
    const p = state.player;
    p.cash = data.cash | 0;
    p.hp = clamp(data.hp | 0, 1, PLAYER.hp);
    p.ammo = data.ammo | 0;
    p.reserve = data.reserve | 0;
    p.x = clamp(data.x | 0, 20, WORLD.width - 20);
    p.y = clamp(data.y | 0, 20, WORLD.height - 20);
    p.wanted = clamp(data.wanted | 0, 0, WANTED.max);
    state.playTime = data.playTime | 0;
    state.missionIndex = clamp(data.missionIndex | 0, 0, MISSIONS.length - 1);
    state.mission.phase = state.missionIndex === 0 ? 'steal' : 'run';
    if (state.missionIndex === 1) state.mission.phase = 'grab';
    if (state.missionIndex === 2 || state.missionIndex === 3) state.mission.phase = 'run';
    const mission = MISSIONS[state.missionIndex];
    state.mission.timer = mission.timeLimit;
    return true;
  }

  function updateTraffic(dt) {
    const cars = state.cars;
    for (const car of cars) {
      if (car.kind !== 'traffic' || car.wrecked) continue;
      const road = car.road;
      const start = car.axis === 'x' ? road.x1 : road.y1;
      const end = car.axis === 'x' ? road.x2 : road.y2;
      // Slow down for a car ahead in the same lane.
      let ahead = null;
      for (const other of cars) {
        if (other === car || other.kind !== 'traffic' || other.wrecked) continue;
        if (other.road !== road || other.dir !== car.dir || other.lane !== car.lane) continue;
        const along = car.axis === 'x' ? other.x - car.x : other.y - car.y;
        const gap = along * car.dir;
        if (gap > 0 && gap < 110 && (ahead === null || gap < ahead)) ahead = gap;
      }
      const targetSpeed = ahead === null ? car.cruise : Math.min(car.cruise, 60);
      car.speed += clamp(targetSpeed - car.speed, -300 * dt, 300 * dt);
      const pos = car.axis === 'x' ? car.x : car.y;
      let next = pos + car.dir * car.speed * dt;
      if (next > end - 30 || next < start + 30) {
        car.dir *= -1;
        car.lane *= -1;
        next = clamp(next, start + 30, end - 30);
      }
      if (car.axis === 'x') {
        car.x = next;
        car.y = road.y1 + car.lane;
        car.angle = car.dir === 1 ? 0 : Math.PI;
      } else {
        car.y = next;
        car.x = road.x1 + car.lane;
        car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    // Car-on-car bumps: circles push apart, hard hits damage.
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        if (a.wrecked || b.wrecked) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= 44 || d < 0.001) continue;
        const push = (44 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const closing = Math.abs((a.speed || 0) - (b.speed || 0));
        if (closing > 260) {
          a.hp -= 8;
          b.hp -= 8;
          if (a.kind === 'traffic' && a.hp <= 0) { a.wrecked = true; a.speed = 0; }
          if (b.kind === 'traffic' && b.hp <= 0) { b.wrecked = true; b.speed = 0; }
        }
      }
    }
  }

  function updatePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          const fresh = spawnPed();
          ped.x = fresh.x;
          ped.y = fresh.y;
          ped.road = fresh.road;
          ped.axis = fresh.axis;
          ped.dir = fresh.dir;
          ped.offset = fresh.offset;
          ped.down = false;
        }
        continue;
      }
      const road = ped.road;
      const start = ped.axis === 'x' ? road.x1 : road.y1;
      const end = ped.axis === 'x' ? road.x2 : road.y2;
      const pos = ped.axis === 'x' ? ped.x : ped.y;
      let next = pos + ped.dir * ped.speed * dt;
      if (next > end - 30 || next < start + 30) {
        ped.dir *= -1;
        next = clamp(next, start + 30, end - 30);
      }
      if (ped.axis === 'x') {
        ped.x = next;
        ped.y = road.y1 + ped.offset;
        ped.angle = ped.dir === 1 ? 0 : Math.PI;
      } else {
        ped.y = next;
        ped.x = road.x1 + ped.offset;
        ped.angle = ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }
      // Sidewalks run past buildings: a pedestrian who would walk into a wall
      // turns around instead of clipping through it.
      const inside = BUILDINGS.some((b) => ped.x > b.x - 12 && ped.x < b.x + b.w + 12 && ped.y > b.y - 12 && ped.y < b.y + b.h + 12);
      if (inside) ped.dir *= -1;
      // A fast car hitting a pedestrian knocks them down; the player's car is a crime.
      for (const car of state.cars) {
        if (car.wrecked) continue;
        const speed = Math.abs(car.speed || 0);
        if (speed < 60) continue;
        if (dist(ped.x, ped.y, car.x, car.y) < 34) {
          ped.down = true;
          ped.downTimer = 20;
          if (car.kind === 'player') addWanted(WANTED.hitPedestrian);
          break;
        }
      }
      void p;
    }
  }

  function spawnPoliceCar() {
    const p = state.player;
    const road = ROADS[0];
    const side = random.chance(0.5) ? 1 : -1;
    const x = clamp(p.x + side * random.range(650, 950), 60, WORLD.width - 60);
    return {
      id: state.cars.length,
      kind: 'police', road, axis: 'x', dir: 0, lane: 0,
      x, y: road.y1 + (random.chance(0.5) ? -24 : 24),
      angle: side === 1 ? Math.PI : 0,
      speed: 0, cruise: POLICE.carSpeed, hp: POLICE.carHp,
      color: '#2e4a7a', wrecked: false, ramTimer: 0,
    };
  }

  function spawnOfficer() {
    const p = state.player;
    const angle = random.range(0, Math.PI * 2);
    return {
      x: clamp(p.x + Math.cos(angle) * 520, 30, WORLD.width - 30),
      y: clamp(p.y + Math.sin(angle) * 520, 30, WORLD.height - 30),
      angle: 0, hp: 40, shootTimer: random.range(0.5, 1.5),
    };
  }

  function updatePolice(dt) {
    const p = state.player;
    state.policeTimer -= dt;
    const wantCars = Math.min(p.wanted, POLICE.maxCars);
    const policeCars = state.cars.filter((c) => c.kind === 'police' && !c.wrecked);
    if (p.wanted > 0 && state.policeTimer <= 0 && policeCars.length < wantCars) {
      state.cars.push(spawnPoliceCar());
      state.policeTimer = POLICE.spawnInterval;
    }
    for (const car of policeCars) {
      car.ramTimer -= dt;
      const desired = Math.atan2(p.y - car.y, p.x - car.x);
      const turn = clamp(angleDiff(desired, car.angle), -1, 1);
      car.angle += turn * 3.1 * dt;
      const d = dist(car.x, car.y, p.x, p.y);
      if (p.inCar) {
        car.speed = Math.min(car.speed + 520 * dt, POLICE.carSpeed);
      } else if (d > 130) {
        car.speed = Math.min(car.speed + 520 * dt, POLICE.carSpeed * 0.8);
      } else {
        car.speed = Math.max(car.speed - 700 * dt, 0);
      }
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      resolveCarBuildings(car);
      if (p.inCar && p.car && d < 46 && car.ramTimer <= 0) {
        p.car.hp -= POLICE.ramDamage;
        car.ramTimer = POLICE.ramCooldown;
        car.speed *= 0.5;
        p.car.speed *= 0.85;
        if (p.car.hp <= 0) state.busted = true;
      }
      // An officer steps out when the patrol car stops near a player on foot.
      if (!p.inCar && d < 140 && state.officers.length < 2 && state.officerTimer <= 0) {
        state.officers.push(spawnOfficer());
        state.officerTimer = 6;
      }
    }
    state.officerTimer -= dt;
    if (p.wanted >= 2 && !p.inCar && state.officers.length < 2 && state.officerTimer <= 0) {
      state.officers.push(spawnOfficer());
      state.officerTimer = 6;
    }
    // Officers chase on foot and shoot at wanted 3+.
    for (let i = state.officers.length - 1; i >= 0; i -= 1) {
      const officer = state.officers[i];
      if (officer.hp <= 0) {
        state.officers.splice(i, 1);
        continue;
      }
      officer.shootTimer -= dt;
      const d = dist(officer.x, officer.y, p.x, p.y);
      officer.angle = Math.atan2(p.y - officer.y, p.x - officer.x);
      if (d > 34) {
        officer.x += Math.cos(officer.angle) * POLICE.officerSpeed * dt;
        officer.y += Math.sin(officer.angle) * POLICE.officerSpeed * dt;
        resolvePlayerBuildings(officer);
      } else {
        p.bustMeter += dt;
        if (p.bustMeter > 1.2) state.busted = true;
      }
      if (p.wanted >= 3 && d < POLICE.shootRange && d > 60 && officer.shootTimer <= 0 && !p.inCar) {
        const spread = random.range(-0.12, 0.12);
        state.bullets.push({
          x: officer.x, y: officer.y,
          vx: Math.cos(officer.angle + spread) * 620,
          vy: Math.sin(officer.angle + spread) * 620,
          life: 1.1, from: 'police', damage: POLICE.shootDamage,
        });
        officer.shootTimer = POLICE.shootCooldown;
      }
    }
    if (p.wanted === 0) {
      // Heat gone: the patrol leaves.
      for (const car of policeCars) car.wrecked = true;
      state.officers.length = 0;
    }
  }

  function updateBullets(dt) {
    const p = state.player;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height;
      if (!dead) {
        for (const building of BUILDINGS) {
          if (circleHitsRect(b.x, b.y, 3, building)) { dead = true; break; }
        }
      }
      if (!dead && b.from === 'player') {
        for (const car of state.cars) {
          if (car.kind === 'player' || car.wrecked) continue;
          if (dist(b.x, b.y, car.x, car.y) < 30) {
            car.hp -= b.damage;
            dead = true;
            if (car.kind === 'traffic' && car.hp <= 0) { car.wrecked = true; car.speed = 0; }
            if (car.kind === 'police' && car.hp <= 0) car.wrecked = true;
            break;
          }
        }
        if (!dead) {
          for (const officer of state.officers) {
            if (dist(b.x, b.y, officer.x, officer.y) < 18) {
              officer.hp -= b.damage;
              dead = true;
              break;
            }
          }
        }
        if (!dead) {
          for (const ped of state.peds) {
            if (!ped.down && dist(b.x, b.y, ped.x, ped.y) < 16) {
              ped.down = true;
              ped.downTimer = 20;
              addWanted(WANTED.hitPedestrian);
              dead = true;
              break;
            }
          }
        }
      }
      if (!dead && b.from === 'police' && !p.inCar && p.invulnerable <= 0) {
        if (dist(b.x, b.y, p.x, p.y) < PLAYER.radius) {
          p.hp -= b.damage;
          p.invulnerable = 0.6;
          dead = true;
          if (p.hp <= 0) state.wasted = true;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  function updatePickups() {
    const p = state.player;
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      if (dist(p.x, p.y, pickup.x, pickup.y) < 30) {
        pickup.taken = true;
        if (pickup.kind === 'cash') p.cash += CASH_PICKUP;
        else if (pickup.kind === 'medkit') p.hp = Math.min(PLAYER.hp, p.hp + 40);
        else if (pickup.kind === 'ammo') p.reserve += 24;
        return EVENT_PICKUP;
      }
    }
    return EVENT_NONE;
  }

  function updateMissions(dt) {
    const p = state.player;
    const mission = MISSIONS[state.missionIndex];
    if (!mission || state.complete) return EVENT_NONE;
    const m = state.mission;
    if (m.timer > 0) {
      m.timer -= dt;
      if (m.timer <= 0) {
        m.timer = mission.timeLimit;
        m.phase = state.missionIndex === 0 ? 'deliver' : 'run';
        if (state.missionIndex === 1) m.phase = 'grab';
        addWanted(1);
        return EVENT_CRIME;
      }
    }
    const marker = currentMarker();
    if (state.missionIndex === 0 && m.phase === 'steal') {
      if (p.inCar) {
        m.phase = 'deliver';
        m.timer = mission.timeLimit;
      }
      return EVENT_NONE;
    }
    if (state.missionIndex === 1 && m.phase === 'grab') {
      if (!p.inCar && marker && dist(p.x, p.y, marker.x, marker.y) < 55) {
        m.grabTimer += dt;
        if (m.grabTimer > 2) {
          m.phase = 'escape';
          m.grabTimer = 0;
          addWanted(WANTED.heistHeat);
          return EVENT_CRIME;
        }
      } else {
        m.grabTimer = 0;
      }
      return EVENT_NONE;
    }
    if (marker && dist(p.x, p.y, marker.x, marker.y) < 70) {
      const needsCar = state.missionIndex === 3;
      if (needsCar && !p.inCar) return EVENT_NONE;
      p.cash += mission.payout;
      state.missionIndex += 1;
      if (state.missionIndex >= MISSIONS.length) {
        state.complete = true;
        state.completeTime = state.playTime;
        return EVENT_MISSION;
      }
      const next = MISSIONS[state.missionIndex];
      state.mission = { phase: 'steal', timer: 0, grabTimer: 0, failed: false };
      if (state.missionIndex === 1) state.mission.phase = 'grab';
      if (state.missionIndex === 2 || state.missionIndex === 3) {
        state.mission.phase = 'run';
        state.mission.timer = next.timeLimit;
      }
      if (state.missionIndex === 2) {
        p.wanted = Math.max(p.wanted, 3);
        for (let i = 0; i < 3; i += 1) state.cars.push(spawnPoliceCar());
      }
      return EVENT_MISSION;
    }
    return EVENT_NONE;
  }

  function updateWanted(dt) {
    const p = state.player;
    state.crimeCooldown -= dt;
    if (p.wanted <= 0) return;
    p.quietTime += dt;
    const policeNear = state.cars.some((c) => c.kind === 'police' && !c.wrecked && dist(c.x, c.y, p.x, p.y) < 500)
      || state.officers.length > 0;
    if (p.quietTime > WANTED.quietBeforeDecay && !policeNear) {
      p.decayTimer += dt;
      if (p.decayTimer >= WANTED.decayStep) {
        p.wanted -= 1;
        p.decayTimer = 0;
        if (p.wanted === 0) p.bustMeter = 0;
      }
    }
  }

  function step(dt, move, aim, mouseDown, actions) {
    const p = state.player;
    let events = EVENT_NONE;
    state.time += dt;
    state.playTime += dt;
    p.fireTimer -= dt;
    p.punchTimer -= dt;
    p.invulnerable -= dt;
    if (p.bustMeter > 0 && state.officers.every((o) => dist(o.x, o.y, p.x, p.y) > 40)) {
      p.bustMeter = Math.max(0, p.bustMeter - dt * 0.5);
    }

    if (actions & 4) { // ACTION_ENTER
      if (p.inCar) exitCar();
      else {
        const car = nearestStealableCar();
        if (car) events |= enterCar(car);
      }
    }
    if (actions & 8) { // ACTION_PUNCH
      if (!p.inCar && p.punchTimer <= 0) {
        p.punchTimer = 0.4;
        for (const officer of state.officers) {
          const d = dist(p.x, p.y, officer.x, officer.y);
          if (d < PLAYER.punchRange && Math.abs(angleDiff(Math.atan2(officer.y - p.y, officer.x - p.x), p.aimAngle)) < 1.2) {
            officer.hp -= PLAYER.punchDamage;
          }
        }
      }
    }
    if (actions & 16) { // ACTION_RELOAD
      const need = Math.min(PLAYER.ammoStart, PLAYER.ammoMax) - p.ammo;
      const take = Math.min(need, p.reserve);
      if (take > 0) {
        p.ammo += take;
        p.reserve -= take;
      }
    }

    if (p.inCar) updatePlayerCar(dt, move);
    else updatePlayerFoot(dt, move, aim);

    if (mouseDown && !p.inCar && p.fireTimer <= 0 && p.ammo > 0) {
      p.ammo -= 1;
      p.fireTimer = PLAYER.fireCooldown;
      state.bullets.push({
        x: p.x + Math.cos(p.aimAngle) * 22,
        y: p.y + Math.sin(p.aimAngle) * 22,
        vx: Math.cos(p.aimAngle) * 780,
        vy: Math.sin(p.aimAngle) * 780,
        life: PLAYER.pistolRange / 780,
        from: 'player',
        damage: PLAYER.pistolDamage,
      });
      events |= EVENT_SHOT;
      const witnessed = state.cars.some((c) => c.kind === 'police' && !c.wrecked && dist(c.x, c.y, p.x, p.y) < 600)
        || state.officers.some((o) => dist(o.x, o.y, p.x, p.y) < 600);
      if (witnessed && state.crimeCooldown <= 0) {
        addWanted(WANTED.shooting);
        state.crimeCooldown = 3;
      }
    }

    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateBullets(dt);
    events |= updatePickups();
    events |= updateMissions(dt);
    updateWanted(dt);

    // Clean up wrecked police cars so the map does not fill with them.
    state.cars = state.cars.filter((c) => !(c.kind === 'police' && c.wrecked && dist(c.x, c.y, p.x, p.y) > 1200));

    if (state.busted) events |= EVENT_BUSTED;
    if (state.wasted) events |= EVENT_WASTED;
    if (p.hp <= 0) {
      state.wasted = true;
      events |= EVENT_WASTED;
    }
    return events;
  }
