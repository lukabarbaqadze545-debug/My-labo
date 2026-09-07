import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CT_CATEGORY_LABELS, CT_PRIORITIES, isAuthored, type CtCategory, type CtPriority } from '@/content/competitive';
import { CT_STATUSES, type CtStatus } from '@/domain/competitive/types';
import { filterTopics } from '@/domain/competitive';
import { useCompetitive } from '../state/useCompetitive';
import { TopicCard } from '../components/tournament/TopicCard';
import { CT_PRIORITY_LABEL, CT_STATUS_LABEL } from '../components/tournament/labels';

/**
 * The roadmap: the whole syllabus as categorised, filterable cards, with a
 * progress overview and the single "study this next" pointer up top. It is a
 * roadmap, not a dashboard — the categories are the syllabus, in order.
 */
export function TournamentPage() {
  const { roadmap, views, stats, recommended, loading } = useCompetitive();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CtCategory | 'all'>('all');
  const [priority, setPriority] = useState<CtPriority | 'all'>('all');
  const [status, setStatus] = useState<CtStatus | 'all'>('all');

  const anyFilter = query.trim() || category !== 'all' || priority !== 'all' || status !== 'all';

  const filtered = useMemo(
    () => filterTopics(views, { query, category, priority, status }),
    [views, query, category, priority, status],
  );
  const filteredIds = useMemo(() => new Set(filtered.map((v) => v.topic.id)), [filtered]);

  const authoredCount = views.filter((v) => v.authored).length;

  return (
    <div className="page ct-page">
      <header className="ask-head">
        <h1 className="ask-head__title">ტურნირის მომზადება</h1>
        <p className="ask-head__sub">
          ოლიმპიადური თემები ერთმანეთის მიყოლებით — თითოეული ცალკე სასწავლო მოდულია, კავშირებით და პრაქტიკით.
        </p>
      </header>

      {/* progress overview */}
      <div className="ct-overview">
        <div className="ct-overview__stat">
          <strong>{stats.byStatus.mastered}</strong>
          <span>{CT_STATUS_LABEL.mastered}</span>
        </div>
        <div className="ct-overview__stat">
          <strong>{stats.byStatus.learning + stats.byStatus.practicing}</strong>
          <span>მიმდინარე</span>
        </div>
        <div className="ct-overview__stat">
          <strong>{stats.solved}</strong>
          <span>ამოხსნილი ამოცანა</span>
        </div>
        <div className="ct-overview__stat">
          <strong>{stats.reviewCount}</strong>
          <span>{CT_STATUS_LABEL.review}</span>
        </div>
        <div className="ct-overview__bar" title={`${Math.round(stats.mastery * 100)}% ავტორიზებული თემებიდან`}>
          <span style={{ width: `${Math.round(stats.mastery * 100)}%` }} />
        </div>
      </div>

      {/* next recommended */}
      {recommended ? (
        <Link to={`/tournament/${recommended.topic.id}`} className="ct-next">
          <span className="ct-next__label">შემდეგ ისწავლე</span>
          <span className="ct-next__title">{recommended.topic.title}</span>
          <span className="ct-next__go" aria-hidden="true">→</span>
        </Link>
      ) : (
        <p className="ct-next ct-next--done">
          ავტორიზებული თემები ათვისებულია. მალე დაემატება მეტი.
        </p>
      )}

      {/* filters */}
      <div className="ct-filters">
        <input
          className="input input--sm ct-filters__search"
          placeholder="ძებნა…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="ask-select" value={category} onChange={(e) => setCategory(e.target.value as CtCategory | 'all')}>
          <option value="all">ყველა კატეგორია</option>
          {roadmap.map((c) => (
            <option key={c.category} value={c.category}>
              {CT_CATEGORY_LABELS[c.category].ka}
            </option>
          ))}
        </select>
        <select className="ask-select" value={priority} onChange={(e) => setPriority(e.target.value as CtPriority | 'all')}>
          <option value="all">ყველა პრიორიტეტი</option>
          {CT_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {CT_PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <select className="ask-select" value={status} onChange={(e) => setStatus(e.target.value as CtStatus | 'all')}>
          <option value="all">ყველა სტატუსი</option>
          {CT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <span className="ct-filters__count">
          {anyFilter ? `${filtered.length} / ${views.length}` : `${authoredCount} მზადაა`}
        </span>
      </div>

      {/* roadmap by category */}
      {loading ? (
        <p className="ct-muted">იტვირთება…</p>
      ) : (
        <div className="ct-roadmap">
          {roadmap.map((cat) => {
            const shown = cat.topics.filter((v) => filteredIds.has(v.topic.id));
            if (shown.length === 0) return null;
            const done = cat.topics.filter((v) => v.progress.status === 'mastered').length;
            return (
              <section key={cat.category} className="ct-cat">
                <header className="ct-cat__head">
                  <h2 className="ct-cat__title">{CT_CATEGORY_LABELS[cat.category].ka}</h2>
                  <span className="ct-cat__meta">
                    {done}/{cat.topics.length} · {cat.topics.filter(isAuthoredView).length} მზადაა
                  </span>
                </header>
                <div className="ct-grid">
                  {shown.map((view) => (
                    <TopicCard key={view.topic.id} view={view} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

const isAuthoredView = (v: { topic: Parameters<typeof isAuthored>[0] }) => isAuthored(v.topic);
