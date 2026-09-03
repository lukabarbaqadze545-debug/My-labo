import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { t as tr } from '@/content';
import { discover, discoveryHref, DISCOVERY_REASON_LABELS, type DiscoveryResult } from '@/domain/discovery';
import { useApp, useT } from '../state/AppState';
import { Chip } from './primitives';

/**
 * „გამაოცე".
 *
 * Repeated presses never repeat within a session, and the card always says
 * *why* it surfaced — a surprise you cannot explain feels arbitrary rather
 * than curated.
 */
export function DiscoveryDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { profile, subjectById, track } = useApp();
  const [seen, setSeen] = useState<string[]>([]);
  const [result, setResult] = useState<DiscoveryResult | undefined>();

  const roll = useCallback(() => {
    setResult((prev) => {
      const exclude = prev ? [...seen, prev.item.id] : seen;
      const next = discover({ profile, recentIds: exclude });
      if (next) setSeen((s) => [...s, next.item.id].slice(-30));
      return next ?? prev;
    });
  }, [profile, seen]);

  useEffect(() => {
    const first = discover({ profile });
    if (first) {
      setResult(first);
      setSeen([first.item.id]);
    }
    // Roll once on open only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const describe = (r: DiscoveryResult): { kicker: string; title: string; body: string; subjectId: string } => {
    switch (r.kind) {
      case 'topic':
        return { kicker: '◈ თემა', title: tr(r.item.title), body: tr(r.item.hook), subjectId: r.item.subjectId };
      case 'fact':
        return { kicker: '💡 ფაქტი', title: tr(r.item.text), body: tr(r.item.why), subjectId: r.item.subjectId };
      case 'formula':
        return { kicker: '∑ ფორმულა', title: tr(r.item.name), body: r.item.expression, subjectId: r.item.subjectId };
      case 'person':
        return {
          kicker: '☺ ადამიანი',
          title: tr(r.item.name),
          body: `${r.item.lived} · ${tr(r.item.known)}`,
          subjectId: r.item.subjectId,
        };
      case 'event':
        return {
          kicker: '⌛ ისტორია',
          title: tr(r.item.title),
          body: tr(r.item.summary),
          subjectId: r.item.subjectId,
        };
      case 'activity':
        return {
          kicker: '⚗ აქტივობა',
          title: tr(r.item.title),
          body: tr(r.item.invitation),
          subjectId: r.item.subjectId,
        };
    }
  };

  const info = result ? describe(result) : undefined;
  const subject = info ? subjectById.get(info.subjectId) : undefined;

  return (
    <div
      className="overlay overlay--center"
      role="dialog"
      aria-modal="true"
      aria-label={t.discovery.title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        style={subject ? ({ ['--accent-h' as string]: String(subject.theme.hue) } as React.CSSProperties) : undefined}
      >
        <div className="modal__head">
          <span aria-hidden="true">✧</span>
          <h2 className="modal__title">{t.discovery.title}</h2>
          <button className="btn btn--quiet" style={{ marginInlineStart: 'auto' }} onClick={onClose}>
            {t.nav.close}
          </button>
        </div>

        <div className="modal__body">
          {!result || !info ? (
            <p className="muted small">{t.discovery.thinking}</p>
          ) : (
            <div className="stack rise" key={result.item.id}>
              <div className="row">
                <Chip tone="accent">{info.kicker}</Chip>
                <Chip>{DISCOVERY_REASON_LABELS[result.reason]}</Chip>
                {subject ? <Chip tone="medium">{tr(subject.name)}</Chip> : null}
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-lg)' }}>{info.title}</h3>
              {info.body ? (
                <p className="small" style={{ color: 'var(--ink-2)' }}>
                  {info.body}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={roll}>
            <span aria-hidden="true">↻</span> {t.discovery.again}
          </button>
          {result ? (
            <Link
              className="btn btn--primary"
              to={discoveryHref(result)}
              onClick={() => {
                track({ type: 'view', subjectId: describe(result).subjectId });
                onClose();
              }}
            >
              {t.discovery.open}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
