// Every tuning number and shared constant in one place. Solmara is a grid city: roads run
// north-south and east-west on a fixed pitch, blocks hold the buildings, and the south edge
// is a beach where the grid meets the sea.
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmara.save.v1';

export const CITY = {
  pitch: 78,          // road centre to road centre
  roadHalf: 7,        // half the asphalt width
  roads: [-2, -1, 0, 1, 2], // road indices each way
  blockHalf: 30,      // half a buildable block (pitch - road width, halved, minus margin)
  beachZ: 196,        // sand starts here (south, +z)
  waterZ: 232,        // sea starts here
  extent: 205,        // city ground plane half-size
};

export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 9.0,
  jumpSpeed: 7.5,
  gravity: 22,
  radius: 0.55,
  height: 1.8,
  maxHealth: 100,
  punchDamage: 12,
  pistolDamage: 34,
  pistolRange: 55,
  pistolCooldown: 0.28,
};

export const CAR_TYPES = {
  comet:   { name: 'Comet GT',   topSpeed: 34, accel: 16, brake: 30, turn: 2.1, seats: 2, price: 0 },
  bison:   { name: 'Bison',      topSpeed: 26, accel: 12, brake: 26, turn: 1.9, seats: 4, price: 0 },
  mule:    { name: 'Mule Van',   topSpeed: 21, accel: 9,  brake: 22, turn: 1.6, seats: 2, price: 0 },
  cab:     { name: 'Sol Cab',    topSpeed: 25, accel: 12, brake: 26, turn: 1.9, seats: 4, price: 0 },
  cruiser: { name: 'Interceptor',topSpeed: 32, accel: 15, brake: 30, turn: 2.2, seats: 4, price: 0 },
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 12,     // seconds unseen before a star drops
  bustRange: 2.2,     // a cop this close for bustTime seconds busts the player
  bustTime: 1.6,
  policeCars: [0, 1, 2, 3, 4, 5], // police cars on the road per star level
};

export const PALETTE = {
  sky: 0x87bfe8,
  fog: 0xa8c8e0,
  sun: 0xfff2d8,
  asphalt: 0x3a3f46,
  sidewalk: 0x9aa0a3,
  sand: 0xe8d29a,
  sea: 0x2f7fb8,
  grass: 0x5f9e4d,
  building: [0xd8c9b0, 0xb8c4cc, 0xc9a689, 0x8fa3b5, 0xe0d6c2, 0xa89a86, 0x7f93a8],
  glass: 0x2b3f55,
};

export const MISSION_CASH = { start: 0 };
export const START_CASH = 250;
