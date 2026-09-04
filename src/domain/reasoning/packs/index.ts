import type { DomainPack } from '../types';
import { contentTerms } from '../language';
import { GENERAL_PACK } from './general';
import { PHILOSOPHY_PACK } from './philosophy';
import { GEOROUTE_PACK } from './georoute';

export { GENERAL_PACK, PHILOSOPHY_PACK, GEOROUTE_PACK };

/**
 * Packs that the assistant offers. GeoRoute is registered but not listed for
 * selection here — Luka's Labo has no travel surface; it is kept so the
 * domain-independence of the engine stays tested rather than asserted.
 */
export const PACKS: DomainPack[] = [PHILOSOPHY_PACK, GENERAL_PACK];

export const ALL_PACKS: DomainPack[] = [PHILOSOPHY_PACK, GEOROUTE_PACK, GENERAL_PACK];

export function packById(id: string | undefined): DomainPack {
  return ALL_PACKS.find((p) => p.id === id) ?? GENERAL_PACK;
}

/**
 * Route a conversation to a pack by cue overlap. Falls back to general, which
 * still does form-level reasoning — so a misroute costs specificity, never
 * capability.
 */
export function resolvePack(text: string, candidates: readonly DomainPack[] = PACKS): DomainPack {
  const terms = contentTerms(text);
  if (terms.length === 0) return GENERAL_PACK;

  let best: { pack: DomainPack; hits: number } = { pack: GENERAL_PACK, hits: 0 };
  for (const pack of candidates) {
    let hits = 0;
    for (const cue of pack.cues) {
      if (terms.some((t) => t.startsWith(cue) || cue.startsWith(t))) hits++;
    }
    if (hits > best.hits) best = { pack, hits };
  }
  return best.hits > 0 ? best.pack : GENERAL_PACK;
}
