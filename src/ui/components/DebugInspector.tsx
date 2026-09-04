import type { PipelineTrace } from '@/domain/conversation';
import { useT } from '../state/AppState';

/**
 * Developer view of one pipeline run.
 *
 * This exists to make the engine improvable: when a message goes wrong, the
 * failing stage should be visible at a glance rather than inferred from the
 * reply. Off by default — it is a workbench, not part of the product surface.
 */
export function DebugInspector({ trace }: { trace: PipelineTrace }) {
  const t = useT();
  const d = t.debug;
  const n = trace.normalized;

  const rows: { label: string; value: string }[] = [
    { label: d.raw, value: trace.raw },
    { label: d.normalized, value: n.text },
    { label: d.tokens, value: n.tokens.join(' · ') },
    { label: d.stems, value: n.contentStems.join(' · ') || '—' },
    { label: d.script, value: `${n.script}${n.isBareFollowUp ? ' · bare follow-up' : ''}` },
    ...(n.repairs.length
      ? [{ label: d.repairs, value: n.repairs.map((r) => `${r.from}→${r.to}`).join(', ') }]
      : []),
    {
      label: d.intents,
      value: trace.intents.map((i) => `${i.kind} (${i.score.toFixed(1)})`).join(' · '),
    },
    {
      label: d.candidates,
      value:
        trace.candidates
          .map((c) => `${c.label} [${c.layer} ${c.score.toFixed(1)} cov ${c.coverage.toFixed(2)}]`)
          .join('\n') || '—',
    },
    {
      label: d.reference,
      value: trace.reference
        ? `„${trace.reference.surface}" → ${trace.reference.label ?? '—'} (${trace.reference.confidence.toFixed(2)})`
        : '—',
    },
    { label: d.layer, value: trace.layerUsed },
    { label: d.verdict, value: trace.verdict },
    { label: d.action, value: `${trace.action.kind} — ${trace.action.rationale}` },
    ...(trace.unknownReason ? [{ label: d.unknownReason, value: trace.unknownReason }] : []),
    {
      label: d.timings,
      value: Object.entries(trace.timings)
        .map(([k, v]) => `${k} ${v}ms`)
        .join(' · '),
    },
  ];

  const conf = Object.entries(trace.confidence) as [string, number][];
  const books = trace.books;

  return (
    <div className="dbg">
      <span className="dbg__title">{d.title}</span>

      <div className="dbg__conf">
        {conf.map(([key, value]) => (
          <div key={key} className="dbg__bar">
            <span className="dbg__barlabel">{key}</span>
            <span className="dbg__track">
              <span
                className="dbg__fill"
                style={{ width: `${Math.round(value * 100)}%` }}
                data-low={value < 0.4 ? 'true' : undefined}
              />
            </span>
            <span className="dbg__num">{value.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {books ? (
        <div className="dbg__books">
          <span className="dbg__title">{d.booksTitle}</span>
          <dl className="dbg__rows">
            <div className="dbg__row">
              <dt>{d.bookMode}</dt>
              <dd>{books.mode}</dd>
            </div>
            <div className="dbg__row">
              <dt>{d.booksSearched}</dt>
              <dd>{books.searched.join(', ') || '—'}</dd>
            </div>
            <div className="dbg__row">
              <dt>{d.bookHits}</dt>
              <dd>
                {books.hits.length
                  ? books.hits
                      .map((h) => `${h.book} გვ.${h.pages} · ${h.score} · ${h.chunkId}`)
                      .join('\n')
                  : '—'}
              </dd>
            </div>
            <div className="dbg__row">
              <dt>{d.bookKnowledge}</dt>
              <dd>
                {books.knowledgeUsed.length
                  ? books.knowledgeUsed
                      .map((k) => `${k.type} (${k.confidence}) გვ.${k.pages} — ${k.book}`)
                      .join('\n')
                  : '—'}
              </dd>
            </div>
            <div className="dbg__row">
              <dt>{d.bookCitations}</dt>
              <dd>{books.citations}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <dl className="dbg__rows">
        {rows.map((row) => (
          <div key={row.label} className="dbg__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
