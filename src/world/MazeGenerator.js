// Generation pipeline: pick a registered generator, let it carve the chunk, then
// apply the shared post-processing. See src/world/gen/ for the generators.
import { createContext, finalize } from './gen/Context.js';
import { getGenerator } from './gen/registry.js';

export { localIndex, inChunk, chunkTier } from './gen/Context.js';

export function generateMaze(worldSeed, cq, cr, generatorId) {
  const gen = getGenerator(generatorId);
  const ctx = createContext(worldSeed, cq, cr);
  gen.generate(ctx);
  return finalize(ctx);
}