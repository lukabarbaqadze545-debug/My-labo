import { useMemo } from 'react';
import { SUBJECT_GROUP_LABELS, t as tr } from '@/content';
import { useApp, useT } from '../state/AppState';
import { RoomCard } from '../components/RoomCard';
import { SectionHead } from '../components/primitives';

/** Every lab, grouped by direction. */
export function LabsPage() {
  const t = useT();
  const { subjects } = useApp();

  const groups = useMemo(() => {
    const byGroup = new Map<string, typeof subjects>();
    for (const subject of subjects) {
      const bucket = byGroup.get(subject.group);
      if (bucket) bucket.push(subject);
      else byGroup.set(subject.group, [subject]);
    }
    return byGroup;
  }, [subjects]);

  return (
    <div className="page">
      <header className="hero">
        <h1 className="hero__title">{t.nav.labs}</h1>
        <p className="hero__sub">{t.home.roomsSubtitle}</p>
      </header>

      {[...groups.entries()].map(([group, list]) => (
        <section className="section" key={group}>
          <SectionHead title={tr(SUBJECT_GROUP_LABELS[group])} />
          <div className="rooms">
            {list.map((subject) => (
              <RoomCard key={subject.id} subject={subject} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
