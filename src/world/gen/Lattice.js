// "Lattice rooms + carved corridors" (the original generator).
//
// Cells with even (lq, lr) are lattice nodes (always floor). Every other cell is a
// connector between two nodes one lattice step (2 cells) apart. A randomized Prim's
// spanning tree over the nodes carves connectors. Each chunk owns its east and south
// border connectors, randomly opens some and always opens at least one per border.
import { CONFIG } from '../../config.js';
import { DIRS, distance } from '../../hex/Hex.js';
import { CELL } from '../Chunk.js';
import { S, N, localIndex, inChunk, addPocket } from './Context.js';

function connectorEnds(lq, lr) {
  const oddQ = lq & 1, oddR = lr & 1;
  if (oddQ && !oddR) return [lq - 1, lr, lq + 1, lr];     // E-W axis
  if (!oddQ && oddR) return [lq, lr - 1, lq, lr + 1];     // SE-NW axis
  return [lq - 1, lr + 1, lq + 1, lr - 1];                // SW-NE axis
}

export const LatticeGenerator = {
  id: 'lattice',
  name: 'Lattice Crypts',
  description: 'Winding corridors over a regular node lattice, with loops and small crypt chambers.',

  generate(ctx) {
    const G = CONFIG.GEN;
    const { rng, type, reserved, portal } = ctx;
    const isNode = new Uint8Array(N);

    const nodes = [];
    for (let lr = 0; lr < S; lr += 2) {
      for (let lq = 0; lq < S; lq += 2) {
        const i = localIndex(lq, lr);
        isNode[i] = 1;
        type[i] = CELL.FLOOR;
        nodes.push(i);
      }
    }

    if (!ctx.isOriginChunk && rng.chance(G.pocketChance)) {
      addPocket(ctx, 2 + 2 * rng.int(0, 5), 2 + 2 * rng.int(0, 5));
    }

    // Randomized Prim's spanning tree over the node lattice.
    const visited = new Uint8Array(N);
    const start = rng.pick(nodes.filter((i) => !reserved[i]));
    visited[start] = 1;
    const frontier = [];
    const addEdges = (i) => {
      const lq = i % S, lr = (i / S) | 0;
      for (let d = 0; d < 6; d++) frontier.push([lq, lr, d]);
    };
    addEdges(start);
    while (frontier.length) {
      const k = rng.int(0, frontier.length - 1);
      const [lq, lr, d] = frontier[k];
      frontier[k] = frontier[frontier.length - 1];
      frontier.pop();
      const [dq, dr] = DIRS[d];
      const nq = lq + 2 * dq, nr = lr + 2 * dr;
      if (!inChunk(nq, nr)) continue;
      const ni = localIndex(nq, nr);
      if (visited[ni] || reserved[ni]) continue;
      visited[ni] = 1;
      type[localIndex(lq + dq, lr + dr)] = CELL.FLOOR;
      addEdges(ni);
    }

    // Portals: border connectors owned by this chunk (east and south edges).
    const internal = [], boundary = [], east = [], south = [];
    for (let i = 0; i < N; i++) {
      if (isNode[i]) continue;
      const lq = i % S, lr = (i / S) | 0;
      const [aq, ar, bq, br] = connectorEnds(lq, lr);
      const ia = inChunk(aq, ar), ib = inChunk(bq, br);
      if (ia && ib) { internal.push(i); continue; }
      boundary.push(i);
      if (lq === S - 1 && (ia || ib)) east.push(i);
      else if (lr === S - 1 && (ia || ib)) south.push(i);
      if (rng.chance(G.portalChance)) type[i] = CELL.FLOOR;
    }
    if (east.length) type[rng.pick(east)] = CELL.FLOOR;
    if (south.length) type[rng.pick(south)] = CELL.FLOOR;
    for (const i of boundary) if (type[i] === CELL.FLOOR) portal[i] = 1;

    // Loops.
    for (const i of internal) {
      if (type[i] === CELL.WALL && !reserved[i] && rng.chance(G.loopRatio)) type[i] = CELL.FLOOR;
    }

    // Crypt chambers.
    const nCh = rng.int(G.chambers[0], G.chambers[1]);
    for (let c = 0; c < nCh; c++) {
      const lq = 2 + 2 * rng.int(0, 5), lr = 2 + 2 * rng.int(0, 5);
      const rad = rng.chance(G.bigChamberChance) ? 2 : 1;
      if (ctx.pockets.some((p) => distance(lq, lr, p % S, (p / S) | 0) <= rad + 1)) continue;
      for (let dq = -rad; dq <= rad; dq++) {
        const lo = Math.max(-rad, -dq - rad), hi = Math.min(rad, -dq + rad);
        for (let dr = lo; dr <= hi; dr++) {
          const i = localIndex(lq + dq, lr + dr);
          type[i] = CELL.FLOOR;
          ctx.chamberCells.push(i);
        }
      }
    }
  },
};