// Rustline tuning: every number, colour and map feature in one place.
// The world is a desert highway town at dusk, 2560x1600; the camera shows a 1280x720
// window of it. Nothing here is read from the network; everything is drawn by hand.

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 2560, height: 1600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const SAVE_KEY = 'rustline.save.v1';
export const BEST_KEY = 'rustline.best';

export const PLAYER = {
  radius: 14,
  walkSpeed: 215,
  runSpeed: 305,
  hp: 100,
  pistolDamage: 34,
  pistolRange: 430,
  fireCooldown: 0.26,
  punchDamage: 22,
  punchRange: 48,
  ammoStart: 24,
  ammoMax: 60,
  invulnerable: 1.0,
};

export const CAR = {
  length: 56,
  width: 26,
  accel: 430,
  brake: 720,
  reverseAccel: 250,
  maxSpeed: 640,
  maxReverse: 190,
  turnRate: 2.7,
  drag: 0.55,
  hp: 100,
  theftWanted: 1,
  enterRange: 70,
};

export const TRAFFIC = { count: 14, speed: 175, speedJitter: 55, hp: 80 };
export const PEDESTRIAN = { count: 12, speed: 58, speedJitter: 26 };

export const POLICE = {
  maxCars: 4,
  carSpeed: 575,
  carHp: 95,
  ramDamage: 9,
  ramCooldown: 1.1,
  officerSpeed: 240,
  shootRange: 300,
  shootCooldown: 1.5,
  shootDamage: 8,
  spawnInterval: 4,
};

export const WANTED = {
  max: 5,
  quietBeforeDecay: 20,
  decayStep: 10,
  stealCar: 1,
  hitPedestrian: 2,
  shooting: 1,
  heistHeat: 2,
};

/** Roads are straight centrelines with a width; cars drive along them. */
export const ROADS = [
  { x1: 0, y1: 700, x2: 2560, y2: 700, width: 96, name: 'Route 9' },
  { x1: 1280, y1: 180, x2: 1280, y2: 1250, width: 72, name: 'Main St' },
  { x1: 500, y1: 400, x2: 2100, y2: 400, width: 56, name: 'Cactus Ave' },
  { x1: 500, y1: 1020, x2: 2100, y2: 1020, width: 56, name: 'Depot Rd' },
  { x1: 700, y1: 400, x2: 700, y2: 1020, width: 56, name: 'West Rd' },
  { x1: 1900, y1: 400, x2: 1900, y2: 1020, width: 56, name: 'East Rd' },
];

/** The dry lakebed: open sand in the south-east, no buildings, made for the chase. */
export const LAKEBED = { x: 1800, y: 1100, width: 700, height: 450 };

/** Buildings are solid rectangles the player and cars cannot pass through. */
export const BUILDINGS = [
  { x: 1080, y: 540, w: 150, h: 100, roof: '#a8542f', wall: '#7e3f22', label: "PETE'S", sub: 'GAS' },
  { x: 1330, y: 500, w: 230, h: 100, roof: '#4f7d7a', wall: '#37594f', label: 'RUSTLINE', sub: 'MOTEL' },
  { x: 1330, y: 760, w: 190, h: 100, roof: '#c98f2e', wall: '#8a6420', label: 'DINER', sub: 'EAT' },
  { x: 1020, y: 760, w: 160, h: 100, roof: '#5d6b8c', wall: '#42506b', label: 'SHERIFF', sub: 'OFFICE' },
  { x: 780, y: 480, w: 180, h: 100, roof: '#8c4a4a', wall: '#633232', label: 'GARAGE', sub: 'REPAIR' },
  { x: 760, y: 880, w: 130, h: 90, roof: '#9c6b3f', wall: '#6f4a2b', label: '', sub: '' },
  { x: 1560, y: 880, w: 130, h: 90, roof: '#9c6b3f', wall: '#6f4a2b', label: '', sub: '' },
  { x: 1560, y: 250, w: 130, h: 90, roof: '#7a5a8c', wall: '#573f66', label: '', sub: '' },
  { x: 900, y: 250, w: 130, h: 90, roof: '#7a5a8c', wall: '#573f66', label: '', sub: '' },
  { x: 1980, y: 760, w: 140, h: 90, roof: '#4f7d7a', wall: '#37594f', label: '', sub: '' },
  { x: 2440, y: 540, w: 80, h: 100, roof: '#5d6b8c', wall: '#42506b', label: 'BORDER', sub: 'CHECK' },
];

/** Where parked, stealable cars wait at the start of the game. */
export const PARKED_CARS = [
  { x: 1000, y: 618, angle: 0, color: '#c94f38' },
  { x: 1470, y: 630, angle: Math.PI, color: '#3f7dc9' },
  { x: 1470, y: 900, angle: Math.PI / 2, color: '#d9a441' },
  { x: 860, y: 620, angle: -Math.PI / 2, color: '#7a9c4f' },
  { x: 1160, y: 880, angle: 0, color: '#8c5aa8' },
];

/** The four jobs, in order. kind: drive | heist | chase | delivery. */
export const MISSIONS = [
  {
    name: "Smuggler's Run",
    briefing: "Pete needs a package at the Rustline Motel. Steal a car, then drive it there.",
    kind: 'drive',
    carMarker: { x: 1000, y: 618 },
    marker: { x: 1445, y: 625 },
    timeLimit: 100,
    payout: 300,
  },
  {
    name: 'Gas Station Heist',
    briefing: "Grab the till at Pete's, then get back on the highway and lose them.",
    kind: 'heist',
    marker: { x: 1155, y: 665 },
    escape: { x: 1280, y: 700 },
    timeLimit: 0,
    payout: 450,
  },
  {
    name: 'Lakebed Chase',
    briefing: 'Cut across the dry lakebed to the old airstrip. The patrol will be all over you.',
    kind: 'chase',
    marker: { x: 2150, y: 1330 },
    timeLimit: 90,
    payout: 600,
  },
  {
    name: 'Border Delivery',
    briefing: 'Final run: the goods go east to the border checkpoint. 120 seconds, no excuses.',
    kind: 'delivery',
    marker: { x: 2440, y: 700 },
    timeLimit: 120,
    payout: 1000,
  },
];

export const PICKUPS = { cash: 6, medkit: 3, ammo: 3 };
export const CASH_PICKUP = 50;

/** Dusk desert palette: low sun, orange sand, purple shade. */
export const PALETTE = {
  backdrop: '#241428',
  skyTop: '#2b1a3a',
  skyBottom: '#e8763a',
  sun: '#ffd9a0',
  mesaFar: '#6b3a52',
  mesaNear: '#4a2a3e',
  sand: '#c98d4e',
  sandDark: '#b57a3e',
  lakebed: '#d9b380',
  road: '#3a3a42',
  roadEdge: '#d8cdb4',
  dash: '#e8c95a',
  sidewalk: '#a8875e',
  buildingLine: '#2e1f16',
  player: '#ffd166',
  playerDark: '#c98f2e',
  traffic: '#8fa3b8',
  police: '#2e4a7a',
  policeLightR: '#ff3b30',
  policeLightB: '#3b82ff',
  bullet: '#ffe9a8',
  cash: '#7ddb6a',
  medkit: '#ff5a5a',
  ammo: '#ffd166',
  marker: '#ffe14d',
  text: '#fdf3e3',
  muted: '#e8c9a8',
  panel: '#2a1a26',
  panelLine: '#e8763a',
  star: '#ffd166',
  starEmpty: '#5a4a55',
  health: '#7ddb6a',
  healthLow: '#ff5a5a',
  minimap: '#1d1420',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
