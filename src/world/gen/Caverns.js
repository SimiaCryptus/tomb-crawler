// Sunken Caverns: organic caves grown with a hex cellular automaton.
// The initial noise depends only on global coordinates, so cells just outside the
// chunk are sampled from the same noise and caves roughly continue across borders.
import { CONFIG } from '../../config.js';
import { hash32 } from '../../core/Rng.js';
import { DIRS } from '../../hex/Hex.js';
import { CELL } from '../Chunk.js';
import { S, N, NEIGH, colOf, rowOf, inChunk, localIndex, addPocket, openEdgePortals } from './Context.js';

export const CavernsGenerator = {
  id: 'caverns',
  name: 'Sunken Caverns',
  description: 'Flooded natural caves: wide organic chambers, narrow squeezes and stone pillars.',

  generate(ctx) {
    const G = CONFIG.GEN, C = G.caverns;
    const { rng, type, reserved } = ctx;
    const oq = ctx.cq * S, or = ctx.cr * S;
    const noise = (gq, gr) => hash32(ctx.seed, gq, gr, 0xca7e) / 4294967296 < C.fill;

    if (!ctx.isOriginChunk && rng.chance(G.pocketChance)) {
      addPocket(ctx, rng.int(3, S - 4), rng.int(3, S - 4));
    }

    for (let i = 0; i < N; i++) {
      if (!reserved[i]) type[i] = noise(oq + colOf(i), or + rowOf(i)) ? CELL.FLOOR : CELL.WALL;
    }

    let cur = Uint8Array.from(type), next = new Uint8Array(N);
    for (let s = 0; s < C.steps; s++) {
      for (let i = 0; i < N; i++) {
        if (reserved[i]) { next[i] = cur[i]; continue; }
        const lq = colOf(i), lr = rowOf(i);
        let walls = 0;
        for (const [dq, dr] of DIRS) {
          const q = lq + dq, r = lr + dr;
          const floor = inChunk(q, r) ? cur[localIndex(q, r)] === CELL.FLOOR : noise(oq + q, or + r);
          if (!floor) walls++;
        }
        next[i] = walls >= C.wallAt ? CELL.WALL : walls <= C.floorAt ? CELL.FLOOR : cur[i];
      }
      [cur, next] = [next, cur];
    }
    type.set(cur);

    // Pillars inside wide open areas; remaining open cells count as chambers.
    for (let i = 0; i < N; i++) {
      if (type[i] !== CELL.FLOOR || reserved[i] || NEIGH[i].length < 6) continue;
      if (!NEIGH[i].every((j) => type[j] === CELL.FLOOR)) continue;
      if (rng.chance(C.pillarChance)) type[i] = CELL.WALL;
      else ctx.chamberCells.push(i);
    }

    openEdgePortals(ctx);
    ctx.minRegion = C.minRegion;
  },
};