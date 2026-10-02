// Shared generation context + helpers used by every level generator.
// A generator only has to carve its layout; finalize() applies the common
// post-processing (origin chamber, connectivity repair, cracks, pockets, dead ends).
import { CONFIG } from '../../config.js';
import { Rng, hash32 } from '../../core/Rng.js';
import { DIRS, distance, cellsInRadius } from '../../hex/Hex.js';
import { CELL } from '../Chunk.js';

export const S = CONFIG.CHUNK_SIZE;
export const N = S * S;
export const localIndex = (lq, lr) => lr * S + lq;
export const inChunk = (lq, lr) => lq >= 0 && lq < S && lr >= 0 && lr < S;
export const colOf = (i) => i % S;
export const rowOf = (i) => (i / S) | 0;

// In-chunk neighbour indices for every local cell.
export const NEIGH = Array.from({ length: N }, (_, i) => {
  const out = [];
  for (const [dq, dr] of DIRS) {
    const q = colOf(i) + dq, r = rowOf(i) + dr;
    if (inChunk(q, r)) out.push(localIndex(q, r));
  }
  return out;
});

export function chunkTier(cq, cr) {
  const d = distance(cq * S + S / 2, cr * S + S / 2, 0, 0);
  return Math.floor(d / CONFIG.DIFFICULTY.tierDistance);
}

// Deterministic openings along the East ('E') or South ('S') edge of chunk (cq, cr).
// Both chunks sharing that edge compute the same list, so openings always line up:
//   E edge: local (S-1, t) of (cq,cr)  <->  local (0, t) of (cq+1,cr)
//   S edge: local (t, S-1) of (cq,cr)  <->  local (t, 0) of (cq,cr+1)
export function edgeOpenings(seed, cq, cr, side) {
  const G = CONFIG.GEN;
  const rng = new Rng(hash32(seed, cq, cr, side === 'E' ? 0xea57 : 0x5047));
  const n = rng.int(G.edgePortals[0], G.edgePortals[1]);
  const out = new Set();
  for (let k = 0; k < n; k++) {
    const t = rng.int(1, S - 2);
    out.add(t);
    if (rng.chance(G.widePortalChance) && t + 1 <= S - 2) out.add(t + 1);
  }
  return [...out];
}

export function createContext(seed, cq, cr) {
  return {
    seed, cq, cr,
    rng: new Rng(hash32(seed, cq, cr, 0x51ed)),
    tier: chunkTier(cq, cr),
    isOriginChunk: cq === 0 && cr === 0,
    type: new Uint8Array(N).fill(CELL.WALL),
    reserved: new Uint8Array(N),   // never touched by carving (treasure pockets)
    portal: new Uint8Array(N),
    keep: new Uint8Array(N),       // cells whose region must never be filled in
    pockets: [],
    chamberCells: [],
    minRegion: 0,                  // >0: isolated regions smaller than this get filled
  };
}

export function isOpen(ctx, lq, lr) {
  return inChunk(lq, lr) && ctx.type[localIndex(lq, lr)] === CELL.FLOOR;
}

export function carve(ctx, lq, lr) {
  if (!inChunk(lq, lr)) return false;
  const i = localIndex(lq, lr);
  if (ctx.reserved[i]) return false;
  ctx.type[i] = CELL.FLOOR;
  return true;
}

export function carveHex(ctx, lq, lr, rad, out) {
  for (const [q, r] of cellsInRadius(lq, lr, rad)) {
    if (carve(ctx, q, r) && out) out.push(localIndex(q, r));
  }
}

// Shortest hex path made of at most two straight legs along hex axes.
export function carvePath(ctx, aq, ar, bq, br, reverse = false) {
  let dq = bq - aq, dr = br - ar;
  const legs = [];
  if (dq * dr < 0) {
    const m = Math.min(Math.abs(dq), Math.abs(dr));
    const sq = Math.sign(dq), sr = Math.sign(dr);
    legs.push([sq, sr, m]);
    dq -= sq * m; dr -= sr * m;
  }
  if (dq) legs.push([Math.sign(dq), 0, Math.abs(dq)]);
  if (dr) legs.push([0, Math.sign(dr), Math.abs(dr)]);
  if (reverse) legs.reverse();
  let q = aq, r = ar;
  carve(ctx, q, r);
  for (const [sq, sr, n] of legs) {
    for (let s = 0; s < n; s++) { q += sq; r += sr; carve(ctx, q, r); }
  }
}

// Sealed treasure cell; its ring is sealed with cracked walls in finalize().
export function addPocket(ctx, lq, lr) {
  const i = localIndex(lq, lr);
  ctx.pockets.push(i);
  ctx.reserved[i] = 1;
  ctx.type[i] = CELL.FLOOR;
  for (const [dq, dr] of DIRS) {
    const j = localIndex(lq + dq, lr + dr);
    ctx.reserved[j] = 1;
    ctx.type[j] = CELL.WALL;
  }
}

// Opens the shared edge openings on all four sides of the chunk.
export function openEdgePortals(ctx) {
  const { seed, cq, cr } = ctx;
  const mark = (lq, lr) => {
    const i = localIndex(lq, lr);
    if (ctx.reserved[i]) return;
    ctx.type[i] = CELL.FLOOR;
    ctx.portal[i] = 1;
    ctx.keep[i] = 1;
  };
  for (const t of edgeOpenings(seed, cq, cr, 'E')) mark(S - 1, t);
  for (const t of edgeOpenings(seed, cq - 1, cr, 'E')) mark(0, t);
  for (const t of edgeOpenings(seed, cq, cr, 'S')) mark(t, S - 1);
  for (const t of edgeOpenings(seed, cq, cr - 1, 'S')) mark(t, 0);
}

// Joins every floor region of the chunk to the largest one by carving the
// shortest tunnel (BFS through walls). Tiny, unimportant regions may be filled.
export function ensureConnected(ctx) {
  const { type, reserved, keep } = ctx;
  const walk = (i) => !reserved[i] && type[i] === CELL.FLOOR;
  const comp = new Int32Array(N).fill(-1);
  const comps = [];
  for (let i = 0; i < N; i++) {
    if (comp[i] >= 0 || !walk(i)) continue;
    const id = comps.length;
    const cells = [i];
    comp[i] = id;
    let kept = !!keep[i];
    for (let h = 0; h < cells.length; h++) {
      for (const j of NEIGH[cells[h]]) {
        if (comp[j] >= 0 || !walk(j)) continue;
        comp[j] = id;
        cells.push(j);
        if (keep[j]) kept = true;
      }
    }
    comps.push({ id, cells, kept });
  }

  let live = comps;
  if (ctx.minRegion > 0) {
    live = [];
    for (const c of comps) {
      if (c.cells.length < ctx.minRegion && !c.kept) {
        for (const i of c.cells) { type[i] = CELL.WALL; comp[i] = -1; }
      } else live.push(c);
    }
  }
  if (live.length <= 1) return;

  live.sort((a, b) => b.cells.length - a.cells.length);
  const main = live[0].id;
  const prev = new Int32Array(N);
  for (let k = 1; k < live.length; k++) {
    const c = live[k];
    prev.fill(-2);
    const queue = [];
    for (const i of c.cells) { prev[i] = -1; queue.push(i); }
    let hit = -1;
    for (let h = 0; h < queue.length && hit < 0; h++) {
      const cur = queue[h];
      for (const j of NEIGH[cur]) {
        if (prev[j] !== -2 || reserved[j]) continue;
        prev[j] = cur;
        if (comp[j] === main) { hit = j; break; }
        queue.push(j);
      }
    }
    if (hit < 0) continue;
    for (const i of c.cells) comp[i] = main;
    for (let i = prev[hit]; i >= 0 && prev[i] !== -1; i = prev[i]) {
      type[i] = CELL.FLOOR;
      comp[i] = main;
    }
  }
}

export function finalize(ctx) {
  const G = CONFIG.GEN;
  const { type, reserved, keep, rng, tier, cq, cr } = ctx;

  // Guaranteed open start chamber around the origin (spans several chunks).
  if (Math.abs(cq) <= 1 && Math.abs(cr) <= 1) {
    for (let i = 0; i < N; i++) {
      if (reserved[i]) continue;
      if (distance(cq * S + colOf(i), cr * S + rowOf(i), 0, 0) <= G.originChamberRadius) {
        type[i] = CELL.FLOOR;
        keep[i] = 1;
      }
    }
  }

  // Validate / repair connectivity.
  ensureConnected(ctx);

  // Cracked walls (scale with distance).
  const crackRatio = Math.min(G.crackedMax, G.crackedBase + G.crackedPerTier * tier);
  for (let i = 0; i < N; i++) {
    if (type[i] !== CELL.WALL || reserved[i]) continue;
    if (NEIGH[i].some((j) => type[j] === CELL.FLOOR) && rng.chance(crackRatio)) type[i] = CELL.CRACKED;
  }

  // Seal pockets: 1-2 cracked walls (preferring ones facing open floor), rest solid.
  for (const p of ctx.pockets) {
    const lq = colOf(p), lr = rowOf(p);
    const ring = new Set(DIRS.map(([dq, dr]) => localIndex(lq + dq, lr + dr)));
    const touches = (d) => {
      const j = localIndex(lq + DIRS[d][0], lr + DIRS[d][1]);
      return NEIGH[j].some((x) => x !== p && !ring.has(x) && type[x] === CELL.FLOOR) ? 1 : 0;
    };
    const order = rng.shuffle([0, 1, 2, 3, 4, 5]).sort((a, b) => touches(b) - touches(a));
    const n = rng.int(1, 2);
    for (let k = 0; k < 6; k++) {
      const [dq, dr] = DIRS[order[k]];
      type[localIndex(lq + dq, lr + dr)] = k < n ? CELL.CRACKED : CELL.WALL;
    }
  }

  // Dead ends for coin piles.
  const deadEnds = [];
  for (let i = 0; i < N; i++) {
    if (type[i] !== CELL.FLOOR) continue;
    const lq = colOf(i), lr = rowOf(i);
    if (lq === 0 || lr === 0 || lq === S - 1 || lr === S - 1) continue;
    let n = 0;
    for (const j of NEIGH[i]) if (type[j] === CELL.FLOOR) n++;
    if (n === 1) deadEnds.push(i);
  }

  return {
    type, rng, tier,
    pockets: ctx.pockets,
    chamberCells: ctx.chamberCells,
    deadEnds,
    portal: ctx.portal,
  };
}