import { Link } from 'react-router-dom';
import { library, t as tr, type Subject } from '@/content';
import { subjectStyle } from './primitives';

export function RoomCard({ subject, compact = false }: { subject: Subject; compact?: boolean }) {
  const topics = library.topicsBySubject.get(subject.id)?.length ?? 0;
  const formulas = library.formulasBySubject.get(subject.id)?.length ?? 0;
  const activities = library.activitiesBySubject.get(subject.id)?.length ?? 0;

  return (
    <Link
      to={`/labs/${subject.id}`}
      className={compact ? 'room room--compact' : 'room'}
      style={subjectStyle(subject)}
    >
      <span className="room__glyph" aria-hidden="true">
        {subject.theme.glyph}
      </span>
      <span className="grow">
        <span className="room__name">{tr(subject.name)}</span>
        {!compact ? <span className="room__tagline">{tr(subject.tagline)}</span> : null}
      </span>
      {!compact ? (
        <span className="room__meta">
          {topics > 0 ? <span>{topics} თემა</span> : null}
          {formulas > 0 ? <span>{formulas} ფორმულა</span> : null}
          {activities > 0 ? <span>{activities} აქტივობა</span> : null}
          {topics === 0 && formulas === 0 && activities === 0 ? <span>მალე</span> : null}
        </span>
      ) : null}
    </Link>
  );
}
