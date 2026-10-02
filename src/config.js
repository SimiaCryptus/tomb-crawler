// All tunable constants live here.
export const CONFIG = {
  HEX_SIZE: 1,
  CHUNK_SIZE: 16,          // parallelogram chunks, 16x16 in (q, r). Must be even.
  VIEW_CHUNK_RADIUS: 1,    // 3x3 active chunks (covers a view radius of 14 cells)
  KEEP_CHUNK_RADIUS: 3,    // chunk data beyond this is dropped (diffs are kept)
  TICK_RATE: 60,

  PLAYER_SPEED: 5.0,       // cells / second
  TURN_BUFFER: 0.4,        // seconds a queued turn stays valid
  START_LIVES: 3,
  MAX_LIVES: 5,
  INVULN_TIME: 2.0,
  HIT_RADIUS: 0.95,        // world units, player-enemy contact distance

  SCORE: { coin: 10, pile: 50, enemy: 100, wall: 5, distanceBonus: 2 },

  GEN: {
    // shared
    pocketChance: 0.45,
    crackedBase: 0.05,
    crackedPerTier: 0.012,
    crackedMax: 0.2,
    coinDensity: [0.7, 0.85],
    piles: [1, 3],
    pickups: [0, 2],
    extraPickupPerTier: 0.04,
    ankhChance: 0.1,
    originChamberRadius: 2,
    originSafeRadius: 8,
    edgePortals: [1, 3],       // openings per shared chunk edge (catacombs, caverns)
    widePortalChance: 0.35,    // chance an opening is 2 cells wide

    // lattice generator
    portalChance: 0.3,
    loopRatio: 0.15,
    chambers: [0, 2],
    bigChamberChance: 0.3,

    catacombs: {
      grid: 3,                 // rooms laid out on a grid x grid lattice per chunk
      roomChance: 0.75,
      hexRoomChance: 0.6,
      maxRoomRadius: 2,
      maxRoomSize: 4,
      jitter: 2.5,             // randomness when picking spanning-tree edges
      extraCorridors: [1, 3],
      alcoves: [2, 5],
    },

    caverns: {
      fill: 0.55,              // initial floor probability
      steps: 4,                // cellular automaton iterations
      wallAt: 4,               // become wall with >= this many wall neighbours
      floorAt: 2,              // become floor with <= this many wall neighbours
      minRegion: 5,            // isolated blobs smaller than this are filled in
      pillarChance: 0.08,
    },
  },

  DIFFICULTY: {
    tierDistance: 15,
    timeTierSeconds: 150,
    enemiesPerTier: 0.6,
    maxEnemiesPerChunk: 6,
    speedPerTier: 0.05,
    speedCap: 0.95,        // fraction of player speed (cobra dashes excepted)
  },

  ENEMY_SPAWN_MIN_DIST: 6,
  ENEMY_DESPAWN_DIST: 26,
  ENEMIES: {
    scarab:   { speed: 2.4, minDist: 0,  weight: 6 },
    sentinel: { speed: 1.6, minDist: 15, weight: 3 },
    cobra:    { speed: 2.2, minDist: 30, weight: 3, dashSpeed: 9, sight: 7, windup: 0.45, cooldown: 1.6 },
    hound:    { speed: 3.3, minDist: 50, weight: 2, huntRadius: 10, bfsBudget: 400 },
    swarm:    { speed: 4.2, minDist: 80, weight: 2 },
  },

  DEVICES: {
    bomb:         { fuse: 1.5, radius: 2 },
    incendiary:   { fuse: 1.0, spread: 3, budget: 24, burnTime: 5 },
    shapedCharge: { fuse: 1.0, radius: 3, forwardHalfAngle: 59 },
  },
  INVENTORY_CAPS: { bomb: 5, incendiary: 3, shapedCharge: 3 },
  MULTIPLIERS: { 2: 10, 3: 8 },

  PICKUP_WEIGHTS: {
    bomb:         { base: 45, perTier: -1, min: 25 },
    incendiary:   { base: 20, perTier: 1 },
    shapedCharge: { base: 15, perTier: 1 },
    mult2:        { base: 15, perTier: 0 },
    mult3:        { base: 5,  perTier: 0.5 },
  },

  // Defaults for the user-adjustable view settings (see Settings screen).
  CAMERA: {
    fov: 50, distance: 19, tilt: 55, damping: 5, lookAhead: 1.8, orthoHeight: 20,
    fpFov: 75,             // first-person field of view
    eyeHeight: 0.75,       // first-person eye height
    fpBack: 0.3,           // first-person camera offset behind the cell centre
    fpPitch: 0.1,          // slight downward look
    fpTurnDamping: 10,
  },
  VIEW: { fogNear: 16, fogFar: 38, fpFogNear: 1.5, fpFogFar: 15, wallHeight: 1.4, maxPixelRatio: 2 },

  FIRST_PERSON: {
    turnBuffer: 1.2,       // seconds a relative turn stays queued
    autoCorner: true,      // follow single-exit bends instead of stopping
  },
};