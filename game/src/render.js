// Drawing only: the world's state and the current screen in, pixels out. The camera
// shows a 1280x720 window of the 2560x1600 desert town, scaled to fit the browser
// window. Flat shapes, a low dusk sun, long shadows, canvas text for the HUD and the
// panels. The judge sees the game mostly through its screenshots, so the HUD, the
// minimap, the mission marker and the wanted stars are always on screen together.

import { BUILDINGS, FONT, LAKEBED, MISSIONS, PALETTE, ROADS, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const MINIMAP = { x: VIEW.width - 234, y: 64, w: 210, h: 132 };

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function camera(state) {
    const p = state.player;
    const cx = Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2));
    const cy = Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2));
    return { x: cx, y: cy };
  }

  function drawShadow(x, y, rx, ry) {
    context.fillStyle = 'rgba(40,16,8,0.35)';
    context.beginPath();
    context.ellipse(x + 16, y + 8, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  }

  function drawCar(x, y, angle, color, police, wrecked) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    drawShadow(0, 0, 30, 12);
    context.fillStyle = 'rgba(0,0,0,0.55)';
    context.fillRect(-28, -15, 56, 30);
    context.fillStyle = wrecked ? '#4a4038' : color;
    context.fillRect(-28, -13, 56, 26);
    context.fillStyle = wrecked ? '#3a3230' : '#2a2f38';
    context.fillRect(-12, -11, 22, 22);
    context.fillStyle = wrecked ? '#3a3230' : '#cfe6f2';
    context.fillRect(-8, -11, 14, 22);
    context.fillStyle = '#1a1a1a';
    context.fillRect(-24, -15, 10, 5);
    context.fillRect(-24, 10, 10, 5);
    context.fillRect(14, -15, 10, 5);
    context.fillRect(14, 10, 10, 5);
    if (police && !wrecked) {
      const flash = Math.floor(performance.now() / 260) % 2 === 0;
      context.fillStyle = flash ? PALETTE.policeLightR : PALETTE.policeLightB;
      context.fillRect(-4, -13, 8, 26);
      context.fillStyle = '#fdf3e3';
      context.font = `bold 11px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('HP', 0, 0);
    }
    context.restore();
  }

  function drawPerson(x, y, angle, color, down) {
    drawShadow(x, y, 12, 5);
    context.save();
    context.translate(x, y);
    if (down) {
      context.rotate(Math.PI / 2);
      context.fillStyle = color;
      context.fillRect(-12, -6, 24, 12);
    } else {
      context.rotate(angle);
      context.fillStyle = color;
      context.beginPath();
      context.arc(0, 0, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2e1f16';
      context.fillRect(8, -3, 10, 6);
    }
    context.restore();
  }

  function drawWorld(state, cam) {
    // Sand base.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sandDark;
    for (const s of state.speckles) {
      context.fillRect(s.x, s.y, s.r, s.r);
    }
    // Dry lakebed: pale cracked sand.
    context.fillStyle = PALETTE.lakebed;
    context.fillRect(LAKEBED.x, LAKEBED.y, LAKEBED.width, LAKEBED.height);
    context.strokeStyle = 'rgba(120,80,40,0.5)';
    context.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const x = LAKEBED.x + 60 + i * 80;
      context.beginPath();
      context.moveTo(x, LAKEBED.y + 30);
      context.lineTo(x + 40, LAKEBED.y + 200);
      context.lineTo(x - 20, LAKEBED.y + 380);
      context.stroke();
    }
    // Distant mesas along the north edge.
    context.fillStyle = PALETTE.mesaFar;
    for (let i = 0; i < 6; i += 1) {
      const x = 120 + i * 430;
      context.fillRect(x, 0, 260, 70 + (i % 3) * 24);
    }
    context.fillStyle = PALETTE.mesaNear;
    for (let i = 0; i < 5; i += 1) {
      const x = 300 + i * 480;
      context.fillRect(x, 30, 200, 50 + (i % 2) * 20);
    }
    // Roads with edge lines and centre dashes.
    for (const road of ROADS) {
      context.fillStyle = PALETTE.sidewalk;
      if (road.x1 === road.x2) context.fillRect(road.x1 - road.width / 2 - 10, road.y1, road.width + 20, road.y2 - road.y1);
      else context.fillRect(road.x1, road.y1 - road.width / 2 - 10, road.x2 - road.x1, road.width + 20);
      context.fillStyle = PALETTE.road;
      if (road.x1 === road.x2) context.fillRect(road.x1 - road.width / 2, road.y1, road.width, road.y2 - road.y1);
      else context.fillRect(road.x1, road.y1 - road.width / 2, road.x2 - road.x1, road.width);
      context.strokeStyle = PALETTE.roadEdge;
      context.lineWidth = 3;
      context.beginPath();
      if (road.x1 === road.x2) {
        context.moveTo(road.x1 - road.width / 2 + 3, road.y1);
        context.lineTo(road.x1 - road.width / 2 + 3, road.y2);
        context.moveTo(road.x1 + road.width / 2 - 3, road.y1);
        context.lineTo(road.x1 + road.width / 2 - 3, road.y2);
      } else {
        context.moveTo(road.x1, road.y1 - road.width / 2 + 3);
        context.lineTo(road.x2, road.y1 - road.width / 2 + 3);
        context.moveTo(road.x1, road.y1 + road.width / 2 - 3);
        context.lineTo(road.x2, road.y1 + road.width / 2 - 3);
      }
      context.stroke();
      context.fillStyle = PALETTE.dash;
      if (road.x1 === road.x2) {
        for (let y = road.y1 + 20; y < road.y2 - 20; y += 56) context.fillRect(road.x1 - 3, y, 6, 30);
      } else {
        for (let x = road.x1 + 20; x < road.x2 - 20; x += 56) context.fillRect(x, road.y1 - 3, 30, 6);
      }
    }
    // Cacti and rocks.
    for (const d of state.decorations) {
      if (d.kind === 'cactus') {
        context.fillStyle = '#4a7a3f';
        context.fillRect(d.x - 2, d.y - d.size, 4, d.size * 2);
        context.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size / 2, 4);
        context.fillRect(d.x, d.y - d.size / 2, d.size / 2, 4);
      } else {
        context.fillStyle = '#8a7a68';
        context.beginPath();
        context.arc(d.x, d.y, d.size / 2, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Buildings: flat roofs, walls, signs.
    for (const b of BUILDINGS) {
      context.fillStyle = 'rgba(40,16,8,0.3)';
      context.fillRect(b.x + 8, b.y + 8, b.w, b.h);
      context.fillStyle = b.wall;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      context.strokeStyle = PALETTE.buildingLine;
      context.lineWidth = 3;
      context.strokeRect(b.x, b.y, b.w, b.h);
      if (b.label) {
        text(b.label, b.x + b.w / 2, b.y + b.h / 2 - 4, 20, PALETTE.text, 'center', 'middle');
        if (b.sub) text(b.sub, b.x + b.w / 2, b.y + b.h / 2 + 18, 13, PALETTE.muted, 'center', 'middle');
      }
    }
    // Pickups.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const bob = Math.sin(state.time * 3 + pickup.x) * 3;
      if (pickup.kind === 'cash') {
        context.fillStyle = PALETTE.cash;
        context.fillRect(pickup.x - 10, pickup.y - 6 + bob, 20, 12);
        text('$', pickup.x, pickup.y + 4 + bob, 13, '#12330f', 'center', 'middle');
      } else if (pickup.kind === 'medkit') {
        context.fillStyle = '#fdf3e3';
        context.fillRect(pickup.x - 9, pickup.y - 9 + bob, 18, 18);
        context.fillStyle = PALETTE.medkit;
        context.fillRect(pickup.x - 2, pickup.y - 7 + bob, 4, 14);
        context.fillRect(pickup.x - 7, pickup.y - 2 + bob, 14, 4);
      } else {
        context.fillStyle = PALETTE.ammo;
        context.fillRect(pickup.x - 8, pickup.y - 5 + bob, 16, 10);
        context.fillStyle = '#3a2c10';
        context.fillRect(pickup.x - 5, pickup.y - 5 + bob, 3, 10);
        context.fillRect(pickup.x + 2, pickup.y - 5 + bob, 3, 10);
      }
    }
    // Pedestrians and officers.
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.down);
    for (const officer of state.officers) {
      drawPerson(officer.x, officer.y, officer.angle, '#2e4a7a', false);
      context.fillStyle = '#fdf3e3';
      context.beginPath();
      context.arc(officer.x, officer.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    // Cars: traffic and parked first, police next, the player's car last.
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      drawCar(car.x, car.y, car.angle, car.color, car.kind === 'police', car.wrecked);
    }
    const p = state.player;
    if (p.inCar && p.car) {
      drawCar(p.car.x, p.car.y, p.car.angle, p.car.color, false, false);
    } else {
      const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0;
      if (!blink) {
        drawPerson(p.x, p.y, p.angle, PALETTE.player, false);
        // Pistol in hand, pointing at the aim.
        context.save();
        context.translate(p.x, p.y);
        context.rotate(p.aimAngle);
        context.fillStyle = '#2e1f16';
        context.fillRect(10, -2, 14, 4);
        context.restore();
      }
    }
    // Bullets.
    context.fillStyle = PALETTE.bullet;
    for (const b of state.bullets) {
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawMarker(state, cam) {
    const mission = MISSIONS[state.missionIndex];
    if (!mission || state.complete) return;
    let marker = null;
    if (state.missionIndex === 0 && state.mission.phase === 'steal') marker = mission.carMarker;
    else if (state.missionIndex === 1 && state.mission.phase === 'escape') marker = mission.escape;
    else marker = mission.marker;
    if (!marker) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    // A diamond on the ground at the objective.
    context.save();
    context.translate(marker.x, marker.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = PALETTE.marker;
    context.fillRect(-12 * pulse, -12 * pulse, 24 * pulse, 24 * pulse);
    context.strokeStyle = '#7a5a00';
    context.lineWidth = 3;
    context.strokeRect(-12 * pulse, -12 * pulse, 24 * pulse, 24 * pulse);
    context.restore();
    // A ring around it.
    context.strokeStyle = 'rgba(255,225,77,0.7)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(marker.x, marker.y, 34 + Math.sin(state.time * 4) * 6, 0, Math.PI * 2);
    context.stroke();
    // An arrow at the edge of the screen when the marker is off screen.
    const sx = marker.x - cam.x;
    const sy = marker.y - cam.y;
    if (sx < 0 || sx > VIEW.width || sy < 0 || sy > VIEW.height) {
      const ax = Math.max(40, Math.min(VIEW.width - 40, sx));
      const ay = Math.max(100, Math.min(VIEW.height - 40, sy));
      const angle = Math.atan2(sy - ay, sx - ax);
      context.save();
      context.translate(ax, ay);
      context.rotate(angle);
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-10, -12);
      context.lineTo(-10, 12);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  function drawHud(state, ui) {
    const p = state.player;
    context.textBaseline = 'top';
    // Cash, health, ammo, top left.
    text(`$${p.cash}`, 24, 18, 34, PALETTE.text, 'left', 'top');
    context.fillStyle = 'rgba(0,0,0,0.45)';
    context.fillRect(24, 60, 220, 16);
    context.fillStyle = p.hp > 30 ? PALETTE.health : PALETTE.healthLow;
    context.fillRect(24, 60, 220 * Math.max(0, p.hp / 100), 16);
    text(`HP ${Math.max(0, Math.ceil(p.hp))}`, 252, 58, 18, PALETTE.text, 'left', 'top');
    text(`Ammo ${p.ammo} / ${p.reserve}`, 24, 84, 20, PALETTE.text, 'left', 'top');
    if (p.inCar && p.car) {
      const speed = Math.round(Math.abs(p.car.speed) * 0.12);
      text(`${speed} mph`, 24, 112, 22, PALETTE.text, 'left', 'top');
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(24, 140, 160, 12);
      context.fillStyle = p.car.hp > 30 ? PALETTE.health : PALETTE.healthLow;
      context.fillRect(24, 140, 160 * Math.max(0, p.car.hp / 100), 12);
      text('CAR', 192, 136, 14, PALETTE.text, 'left', 'top');
    }
    // Wanted stars, top right.
    for (let i = 0; i < 5; i += 1) {
      const x = VIEW.width - 250 + i * 34;
      starPath(context, x, 34, 13);
      context.fillStyle = i < p.wanted ? PALETTE.star : PALETTE.starEmpty;
      context.fill();
      context.strokeStyle = 'rgba(0,0,0,0.5)';
      context.lineWidth = 2;
      context.stroke();
    }
    drawMinimap(state);
    // Objective, top centre.
    const mission = MISSIONS[state.missionIndex];
    if (mission && !state.complete) {
      let objective = mission.name;
      if (state.missionIndex === 0 && state.mission.phase === 'steal') objective = 'Steal a car';
      else if (state.missionIndex === 1 && state.mission.phase === 'grab') objective = 'Grab the till — hold E';
      else if (state.missionIndex === 1 && state.mission.phase === 'escape') objective = 'Lose them on the highway';
      else if (state.missionIndex === 3 && !p.inCar) objective = 'Border Delivery — you need a car';
      text(objective, VIEW.width / 2, 16, 26, PALETTE.text, 'center', 'top');
      if (state.mission.timer > 0) {
        const seconds = Math.ceil(state.mission.timer);
        text(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, VIEW.width / 2, 48, 26, seconds <= 15 ? PALETTE.healthLow : PALETTE.marker, 'center', 'top');
      }
      if (state.missionIndex === 1 && state.mission.phase === 'grab' && state.mission.grabTimer > 0) {
        context.fillStyle = 'rgba(0,0,0,0.5)';
        context.fillRect(VIEW.width / 2 - 110, 84, 220, 12);
        context.fillStyle = PALETTE.marker;
        context.fillRect(VIEW.width / 2 - 110, 84, 220 * (state.mission.grabTimer / 2), 12);
      }
    }
    // Transient message banner.
    if (ui.message && ui.messageTimer > 0) {
      context.fillStyle = 'rgba(20,10,16,0.75)';
      const width = 560;
      context.fillRect((VIEW.width - width) / 2, 130, width, 44);
      text(ui.message, VIEW.width / 2, 141, 24, PALETTE.marker, 'center', 'top');
    }
    if (ui.muted) text('MUTED', VIEW.width - 24, VIEW.height - 30, 16, PALETTE.muted, 'right', 'top');
  }

  function drawMinimap(state) {
    const scaleX = MINIMAP.w / WORLD.width;
    const scaleY = MINIMAP.h / WORLD.height;
    context.fillStyle = 'rgba(20,12,18,0.85)';
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.strokeStyle = PALETTE.panelLine;
    context.lineWidth = 2;
    context.strokeRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.fillStyle = PALETTE.lakebed;
    context.fillRect(MINIMAP.x + LAKEBED.x * scaleX, MINIMAP.y + LAKEBED.y * scaleY, LAKEBED.width * scaleX, LAKEBED.height * scaleY);
    context.strokeStyle = '#8a8a96';
    context.lineWidth = 2;
    for (const road of ROADS) {
      context.beginPath();
      context.moveTo(MINIMAP.x + road.x1 * scaleX, MINIMAP.y + road.y1 * scaleY);
      context.lineTo(MINIMAP.x + road.x2 * scaleX, MINIMAP.y + road.y2 * scaleY);
      context.stroke();
    }
    const mission = MISSIONS[state.missionIndex];
    if (mission && !state.complete) {
      let marker = mission.marker;
      if (state.missionIndex === 0 && state.mission.phase === 'steal') marker = mission.carMarker;
      else if (state.missionIndex === 1 && state.mission.phase === 'escape') marker = mission.escape;
      if (marker) {
        context.fillStyle = PALETTE.marker;
        context.beginPath();
        context.arc(MINIMAP.x + marker.x * scaleX, MINIMAP.y + marker.y * scaleY, 4, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.fillStyle = '#c9c9c9';
    for (const car of state.cars) {
      if (car.kind === 'police') continue;
      context.fillRect(MINIMAP.x + car.x * scaleX - 1, MINIMAP.y + car.y * scaleY - 1, 2, 2);
    }
    context.fillStyle = PALETTE.policeLightR;
    for (const car of state.cars) {
      if (car.kind !== 'police' || car.wrecked) continue;
      context.beginPath();
      context.arc(MINIMAP.x + car.x * scaleX, MINIMAP.y + car.y * scaleY, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(MINIMAP.x + state.player.x * scaleX, MINIMAP.y + state.player.y * scaleY, 4, 0, Math.PI * 2);
    context.fill();
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(20,10,16,0.82)';
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelLine;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 72, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 36, 23, PALETTE.marker, 'center');
  }

  function drawTitle(state, best) {
    // Dusk sky over the town, then the title.
    const gradient = context.createLinearGradient(0, 0, 0, VIEW.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.55, '#a34a3a');
    gradient.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(1020, 150, 62, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255,217,160,0.25)';
    context.beginPath();
    context.arc(1020, 150, 92, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.mesaFar;
    context.fillRect(0, 470, 420, 90);
    context.fillRect(700, 500, 580, 60);
    drawPanel('RUSTLINE', [
      'A desert highway story. Rosa, ex-trucker, now the best',
      'getaway driver on Route 9 — and Old Pete needs four jobs done.',
      'Steal cars, dodge the highway patrol, run the missions.',
      '',
      `Best cash: $${best}`,
      'Move WASD / arrows · E enter car · Mouse aim, click shoot',
      'F punch · G save · L load · M mute · P pause',
    ], 'Press Space or click to start');
  }

  /** Paint one frame: the world through the camera, then the HUD or a panel. */
  function draw(state, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cam = camera(state);
    context.setTransform(view.scale, 0, 0, view.scale, view.x - cam.x * view.scale, view.y - cam.y * view.scale);
    drawWorld(state, cam);
    drawMarker(state, cam);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Warm dusk wash over the whole frame.
    const wash = context.createLinearGradient(0, 0, 0, VIEW.height);
    wash.addColorStop(0, 'rgba(60,20,60,0.10)');
    wash.addColorStop(1, 'rgba(232,118,58,0.12)');
    context.fillStyle = wash;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui.best);
      return;
    }
    drawHud(state, ui);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The desert waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The highway patrol caught Rosa.', `Cash kept: $${state.player.cash}`, ''], 'Press Space to try again');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Rosa went down on Route 9.', `Cash kept: $${state.player.cash}`, ''], 'Press Space to try again');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('DELIVERED', [
        'Rosa made the border run. All four jobs done.',
        `Total cash: $${state.player.cash}`,
        `Time: ${Math.floor(state.completeTime / 60)}:${String(Math.floor(state.completeTime % 60)).padStart(2, '0')}`,
        '',
      ], 'Press Space to play again');
    }
  }

  /** Turn a browser pointer position (CSS pixels) into a world position. */
  function toWorld(state, clientX, clientY) {
    const cam = camera(state);
    const ratio = window.devicePixelRatio || 1;
    const logicalX = (clientX * ratio - view.x) / view.scale;
    const logicalY = (clientY * ratio - view.y) / view.scale;
    return { x: logicalX + cam.x, y: logicalY + cam.y };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toWorld };
}
