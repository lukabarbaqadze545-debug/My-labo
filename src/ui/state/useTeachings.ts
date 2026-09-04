import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/persistence/db';
import { library } from '@/content';
import { setUserKnowledge, type Facet } from '@/content/knowledge';
import { resetAliasIndex, type AliasEntry } from '@/language/ka';

/**
 * Everything the user has taught Luka's Labo, in the shapes the engine wants.
 *
 * Aliases are handed to the pipeline per call rather than baked into the
 * bundled index, and taught facets are pushed into the content registry. Both
 * take effect on the next message with no rebuild and no code change, which is
 * the whole point of the Teach Labo surface.
 */
export function useTeachings() {
  const aliasRows = useLiveQuery(() => db.userAliases.toArray(), []);
  const knowledgeRows = useLiveQuery(() => db.userKnowledge.toArray(), []);

  const aliases = useMemo(() => aliasRows ?? [], [aliasRows]);
  const knowledge = useMemo(() => knowledgeRows ?? [], [knowledgeRows]);

  const extraAliases = useMemo<AliasEntry[]>(
    () =>
      aliases.map((row) => ({
        concept: row.concept,
        ...(library.topicById.has(row.concept) ? { topicId: row.concept } : {}),
        label: row.label,
        forms: row.forms,
        // Taught words outrank bundled ones: the user knows their own wording.
        weight: 1.4,
      })),
    [aliases],
  );

  useEffect(() => {
    setUserKnowledge(
      knowledge
        .filter((row) => row.kind === 'facet' && row.topicId && row.facet)
        .map((row) => ({
          id: row.id,
          topicId: row.topicId!,
          facet: row.facet as Facet,
          text: { ka: row.text },
          level: 2 as const,
          source: {
            sourceTitle: 'მომხმარებლის ნასწავლი',
            sourceType: 'user' as const,
            confidence: 'medium' as const,
          },
        })),
    );
  }, [knowledge]);

  useEffect(() => {
    // The bundled alias index is cached; taught words change its vocabulary,
    // which the typo repairer reads.
    resetAliasIndex();
  }, [aliases]);

  return { extraAliases, aliases, knowledge };
}
