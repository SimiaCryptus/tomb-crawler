// Catacombs: rooms placed on a coarse grid, joined by straight axis-aligned
// passages (spanning tree + a few loops), with small dead-end alcoves.
import { CONFIG } from '../../config.js';
import { DIRS, distance } from '../../hex/Hex.js';
import { S, localIndex, carve, isOpen, carveHex, carvePath, addPocket, openEdgePortals } from './Context.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function carveRoom(ctx, lq, lr, C) {
  const { rng } = ctx;
  if (rng.chance(C.hexRoomChance)) {
    carveHex(ctx, lq, lr, rng.int(1, C.maxRoomRadius), ctx.chamberCells);
    return;
  }
  // Rhombus hall (a rectangle in axial space).
  const w = rng.int(2, C.maxRoomSize), h = rng.int(2, C.maxRoomSize);
  const q0 = lq - (w >> 1), r0 = lr - (h >> 1);
  for (let dr = 0; dr < h; dr++) {
    for (let dq = 0; dq < w; dq++) {
      const q = q0 + dq, r = r0 + dr;
      if (carve(ctx, q, r)) ctx.chamberCells.push(localIndex(q, r));
    }
  }
}

export const CatacombsGenerator = {
  id: 'catacombs',
  name: 'Catacombs',
  description: 'Burial halls and round crypts linked by long straight passages.',

  generate(ctx) {
    const G = CONFIG.GEN, C = G.catacombs;
    const { rng } = ctx;
    const n = C.grid, span = S / n;

    const slots = [];
    for (let gy = 0; gy < n; gy++) {
      for (let gx = 0; gx < n; gx++) {
        slots.push({
          gx, gy,
          lq: clamp(Math.floor((gx + 0.5) * span) + rng.int(-1, 1), 3, S - 4),
          lr: clamp(Math.floor((gy + 0.5) * span) + rng.int(-1, 1), 3, S - 4),
        });
      }
    }

    // One slot may become a sealed treasure pocket instead of a room.
    const pocket = !ctx.isOriginChunk && rng.chance(G.pocketChance) ? rng.int(0, slots.length - 1) : -1;
    if (pocket >= 0) addPocket(ctx, slots[pocket].lq, slots[pocket].lr);
    const nodes = slots.filter((_, k) => k !== pocket);

    for (const s of nodes) {
      if (rng.chance(C.roomChance)) carveRoom(ctx, s.lq, s.lr, C);
      else carve(ctx, s.lq, s.lr);
    }

    // Spanning tree: repeatedly connect the (jittered) nearest outside node.
    const rest = nodes.slice();
    const tree = rest.splice(rng.int(0, rest.length - 1), 1);
    while (rest.length) {
      let bd = Infinity, bi = 0, bt = tree[0];
      for (let i = 0; i < rest.length; i++) {
        for (const t of tree) {
          const d = distance(rest[i].lq, rest[i].lr, t.lq, t.lr) + rng.float() * C.jitter;
          if (d < bd) { bd = d; bi = i; bt = t; }
        }
      }
      const [a] = rest.splice(bi, 1);
      carvePath(ctx, a.lq, a.lr, bt.lq, bt.lr, rng.chance(0.5));
      tree.push(a);
    }

    // Extra corridors between grid neighbours create loops.
    const extra = rng.int(C.extraCorridors[0], C.extraCorridors[1]);
    for (let k = 0; k < extra; k++) {
      const a = rng.pick(nodes);
      const near = nodes.filter((b) => b !== a && Math.abs(b.gx - a.gx) + Math.abs(b.gy - a.gy) === 1);
      if (!near.length) continue;
      const b = rng.pick(near);
      carvePath(ctx, a.lq, a.lr, b.lq, b.lr, rng.chance(0.5));
    }

    // Alcoves: short dead-end niches off existing floor.
    const nAlc = rng.int(C.alcoves[0], C.alcoves[1]);
    for (let k = 0; k < nAlc; k++) {
      for (let tries = 0; tries < 12; tries++) {
        const q = rng.int(2, S - 3), r = rng.int(2, S - 3);
        if (!isOpen(ctx, q, r)) continue;
        const [dq, dr] = DIRS[rng.int(0, 5)];
        const len = rng.int(1, 3);
        let aq = q, ar = r;
        for (let s = 0; s < len; s++) {
          aq += dq; ar += dr;
          if (aq < 1 || ar < 1 || aq > S - 2 || ar > S - 2) break;
          if (isOpen(ctx, aq, ar)) break;
          carve(ctx, aq, ar);
        }
        break;
      }
    }

    openEdgePortals(ctx);
  },
};