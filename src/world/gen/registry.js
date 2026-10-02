// Level generator registry. A generator is:
//   { id, name, description, generate(ctx) }
// where generate() carves ctx.type (see Context.js helpers). Connectivity repair,
// cracked walls, pocket sealing and dead-end detection are applied afterwards.
import { hash32 } from '../../core/Rng.js';
import { LatticeGenerator } from './Lattice.js';
import { CatacombsGenerator } from './Catacombs.js';
import { CavernsGenerator } from './Caverns.js';

export const DEFAULT_GENERATOR = 'lattice';
const REGISTRY = new Map();

export function registerGenerator(gen) {
  if (!gen || !gen.id || typeof gen.generate !== 'function') throw new Error('Invalid generator');
  REGISTRY.set(gen.id, gen);
}

export function getGenerator(id) {
  return REGISTRY.get(id) || REGISTRY.get(DEFAULT_GENERATOR);
}

export function listGenerators() {
  return [...REGISTRY.values()];
}

// Deterministic choice for a seed (daily tomb / "random" setting).
export function generatorForSeed(seed) {
  const list = listGenerators();
  return list[hash32(seed, 0x6e6e) % list.length].id;
}

[LatticeGenerator, CatacombsGenerator, CavernsGenerator].forEach(registerGenerator);