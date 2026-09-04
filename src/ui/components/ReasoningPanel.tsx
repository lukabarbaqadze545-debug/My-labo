import type { Assumption, DomainPack, Move, ReasoningState } from '@/domain/reasoning';
import { useT } from '../state/AppState';

/**
 * A mirror of the engine's conversation state.
 *
 * This is the honesty surface for Socratic mode: the user can see exactly
 * which claims were recorded, which premises were inferred, what is undefined
 * and what conflicts — and why the engine chose the step it did. If the panel
 * is empty, the engine had nothing to work with, and says so.
 */
export function ReasoningPanel({
  state,
  pack,
  lastMove,
}: {
  state: ReasoningState;
  pack: DomainPack;
  lastMove?: Move | undefined;
}) {
  const t = useT();
  const a = t.assistant;

  const openAssumptions = state.assumptions.filter((x) => x.status !== 'rejected');
  const undefinedTerms = state.terms.filter((x) => !x.defined && (x.loadBearing || x.uses >= 3));
  const conflicts = state.contradictions.filter((x) => !x.resolved);
  const openQuestions = state.openQuestions.filter((x) => !x.answered);

  const empty =
    state.claims.length === 0 &&
    openAssumptions.length === 0 &&
    undefinedTerms.length === 0 &&
    conflicts.length === 0;

  const statusLabel = (status: Assumption['status']) =>
    status === 'accepted'
      ? a.rAccepted
      : status === 'surfaced'
        ? a.rSurfaced
        : status === 'rejected'
          ? a.rRejected
          : a.rInferred;

  return (
    <aside className="rmap">
      <header className="rmap__head">
        <span className="rmap__title">{a.reasoning}</span>
        <span className="rmap__meta">
          {a.rDomain}: {pack.label} · {a.rDepth}: {state.depth}
        </span>
      </header>

      {lastMove ? (
        <div className="rmap__why">
          <span className="rmap__label">{a.rWhy}</span>
          <p className="rmap__whytext">{lastMove.rationale}</p>
        </div>
      ) : null}

      {empty ? <p className="rmap__empty">{a.rEmpty}</p> : null}

      {state.claims.length > 0 ? (
        <section className="rmap__sec">
          <span className="rmap__label">{a.rClaims}</span>
          <ul className="rmap__list">
            {state.claims.slice(-5).map((c) => (
              <li key={c.id} className="rmap__item">
                <span className={`rmap__badge rmap__badge--${c.type}`}>{c.type}</span>
                <span className="rmap__text">{c.text}</span>
                {c.examined ? <span className="rmap__tick" title={a.rExamined}>✓</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {openAssumptions.length > 0 ? (
        <section className="rmap__sec">
          <span className="rmap__label">{a.rAssumptions}</span>
          <ul className="rmap__list">
            {openAssumptions.slice(-4).map((x) => (
              <li key={x.id} className="rmap__item">
                <span className={`rmap__badge rmap__badge--${x.status}`}>{statusLabel(x.status)}</span>
                <span className="rmap__text">{x.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {undefinedTerms.length > 0 ? (
        <section className="rmap__sec">
          <span className="rmap__label">{a.rTerms}</span>
          <div className="rmap__chips">
            {undefinedTerms.slice(0, 6).map((x) => (
              <span key={x.stem} className="rmap__chip">
                {x.surface} <em>×{x.uses}</em>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {conflicts.length > 0 ? (
        <section className="rmap__sec rmap__sec--alert">
          <span className="rmap__label">{a.rContradictions}</span>
          <ul className="rmap__list">
            {conflicts.map((x) => (
              <li key={x.id} className="rmap__item">
                <span className="rmap__text">{x.note}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {openQuestions.length > 0 ? (
        <section className="rmap__sec">
          <span className="rmap__label">{a.rOpen}</span>
          <ul className="rmap__list">
            {openQuestions.map((q) => (
              <li key={q.id} className="rmap__item">
                <span className="rmap__badge">{q.moveKind}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
