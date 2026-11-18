// Keyboard and mouse input. Held keys give movement; one-shot presses (enter a car,
// punch, reload, save, load, mute, start, pause) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.
// The mouse aims: the game reads its position every frame, clicks fire the pistol.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_SAVE = 32;
export const ACTION_LOAD = 64;
export const ACTION_MUTE = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const RELOAD = new Set(['KeyR']);
const SAVE = new Set(['KeyG']);
const LOAD = new Set(['KeyL']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false };
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  function press(code) {
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(code)) actions |= ACTION_PUNCH;
    else if (RELOAD.has(code)) actions |= ACTION_RELOAD;
    else if (SAVE.has(code)) actions |= ACTION_SAVE;
    else if (LOAD.has(code)) actions |= ACTION_LOAD;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
    else return false;
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (!event.repeat && press(event.code)) {
      // one-shot action queued
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    mouse.down = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  target.addEventListener('pointerdown', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.down = true;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    mouse,
    /** -1, 0 or 1 on each axis, from the held movement keys. */
    move() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
