import type { DomainPack } from '../types';

/**
 * The fallback pack. It carries no subject knowledge — only the form-level
 * analysis every domain shares (which lives in `BASE_SCHEMAS`). A conversation
 * that does not match a specialised pack still gets assumption surfacing,
 * contradiction detection, definition pressure and counterexample hunting.
 */
export const GENERAL_PACK: DomainPack = {
  id: 'general',
  label: 'ზოგადი მსჯელობა',
  cues: [],
  concepts: [],
  assumptionSchemas: [],
  loadBearingTerms: [],
  contestedCues: ['სწორ', 'ღირებულ', 'უკეთეს', 'ჯობ', 'უნდა'],
};
