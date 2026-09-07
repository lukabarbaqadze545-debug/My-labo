import { Link } from 'react-router-dom';
import type { CtTopicView } from '@/domain/competitive';
import { CT_STATUS_GLYPH, CT_STATUS_LABEL, CT_PRIORITY_LABEL, ctEnglish, ctName } from './labels';

/**
 * A compact roadmap card. Shows just enough to decide whether to open it:
 * name, status dot, priority, whether it is authored yet, and — if locked —
 * what is blocking it.
 */
export function TopicCard({ view }: { view: CtTopicView }) {
  const { topic, progress, authored, unlocked, missingPrereqs } = view;

  return (
    <Link
      to={`/tournament/${topic.id}`}
      className={`ct-card ct-card--${progress.status}${!authored ? ' ct-card--slot' : ''}`}
    >
      <div className="ct-card__top">
        <span className="ct-card__dot" title={CT_STATUS_LABEL[progress.status]}>
          {CT_STATUS_GLYPH[progress.status]}
        </span>
        <span className="ct-card__names">
          <span className="ct-card__title">{ctName(topic)}</span>
          {ctEnglish(topic) ? <span className="ct-card__en">{ctEnglish(topic)}</span> : null}
        </span>
        {progress.reviewFlag ? <span className="ct-card__flag" title="გასამეორებელი">⟳</span> : null}
      </div>

      <div className="ct-card__meta">
        <span className={`ct-prio ct-prio--${topic.priority}`}>
          {CT_PRIORITY_LABEL[topic.priority]}
        </span>
        {progress.solved > 0 ? <span className="ct-card__solved">{progress.solved} ✓</span> : null}
        {!authored ? <span className="ct-card__soon">მალე</span> : null}
      </div>

      {authored && !unlocked ? (
        <p className="ct-card__lock">
          საჭიროა: {missingPrereqs.map((t) => ctName(t)).join(', ')}
        </p>
      ) : null}
    </Link>
  );
}
