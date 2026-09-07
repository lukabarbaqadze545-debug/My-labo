import { CT_STATUSES, type CtStatus } from '@/domain/competitive/types';
import { CT_STATUS_GLYPH, CT_STATUS_LABEL } from './labels';

/**
 * The progress control for one topic: a status segmented control plus a solved
 * counter and a review toggle. Used both on the detail page and (compactly) on
 * the card. All writes go through the parent's handlers — this component holds
 * no state.
 */

interface Props {
  status: CtStatus;
  solved: number;
  reviewFlag: boolean;
  onStatus: (status: CtStatus) => void;
  onSolved: (delta: number) => void;
  onToggleReview: () => void;
  compact?: boolean;
}

export function StatusControl({
  status,
  solved,
  reviewFlag,
  onStatus,
  onSolved,
  onToggleReview,
  compact,
}: Props) {
  return (
    <div className={`ct-status${compact ? ' ct-status--compact' : ''}`}>
      <div className="ct-status__seg" role="group" aria-label={CT_STATUS_LABEL[status]}>
        {CT_STATUSES.filter((s) => s !== 'review').map((s) => (
          <button
            key={s}
            className={`ct-status__opt${status === s ? ' is-active' : ''}`}
            onClick={() => onStatus(s)}
            title={CT_STATUS_LABEL[s]}
            aria-pressed={status === s}
          >
            <span aria-hidden="true">{CT_STATUS_GLYPH[s]}</span>
            {!compact ? <span className="ct-status__label">{CT_STATUS_LABEL[s]}</span> : null}
          </button>
        ))}
      </div>

      {!compact ? (
        <div className="ct-status__solved">
          <button className="btn btn--quiet btn--sm" onClick={() => onSolved(-1)} aria-label="−1">
            −
          </button>
          <span className="ct-status__count">
            <strong>{solved}</strong> ამოხსნილი
          </span>
          <button className="btn btn--quiet btn--sm" onClick={() => onSolved(1)} aria-label="+1">
            +
          </button>
        </div>
      ) : null}

      <button
        className={`ct-review${reviewFlag ? ' is-on' : ''}`}
        onClick={onToggleReview}
        aria-pressed={reviewFlag}
        title="გასამეორებლად მონიშვნა"
      >
        {CT_STATUS_GLYPH.review} {!compact ? 'გამეორება' : ''}
      </button>
    </div>
  );
}
