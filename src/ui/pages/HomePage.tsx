import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { library, t as tr, SUBJECT_GROUP_LABELS } from '@/content';
import { buildDailyEdition } from '@/domain/daily';
import { mixWithExploration, isProfileCold } from '@/domain/personalization';
import { greeting } from '@/i18n';
import { useApp, useT } from '../state/AppState';
import { Chip, SectionHead, subjectStyle } from '../components/primitives';
import { RoomCard } from '../components/RoomCard';

/**
 * The home screen.
 *
 * Explicit constraint from the brief: no deadlines, no tasks, nothing that
 * looks like homework. The first thing on the page is something to be curious
 * about. The mosaic below is an *edition* — deterministic per day — so opening
 * the app twice in an afternoon shows the same thing, and tomorrow does not.
 */
export function HomePage() {
  const t = useT();
  const { profile, subjects, subjectById, prefs, track } = useApp();

  const edition = useMemo(
    () => buildDailyEdition(new Date(), profile.topSubjects),
    [profile.topSubjects],
  );

  const roomIds = useMemo(() => mixWithExploration(profile, 8, isProfileCold(profile) ? 0.75 : 0.35), [profile]);
  const rooms = roomIds
    .map((id) => subjectById.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const featured = edition.discovery;
  const featuredSubject = featured ? subjectById.get(featured.subjectId) : undefined;

  const yearsAgo = edition.onThisDay ? new Date().getFullYear() - edition.onThisDay.event.year : 0;
  const matchLabel = edition.onThisDay
    ? edition.onThisDay.match === 'exactDay'
      ? t.daily.exactDay
      : edition.onThisDay.match === 'sameMonth'
        ? t.daily.sameMonth
        : t.daily.anniversary
    : '';

  return (
    <div className="page">
      <header className="hero">
        <p className="hero__greeting">{greeting(t)}</p>
        <h1 className="hero__title">{t.home.todayInLab}</h1>
        <p className="hero__sub">{t.home.todaySubtitle}</p>
      </header>

      <div className="daily">
        {featured ? (
          <Link
            to={`/topics/${featured.id}`}
            className="daily__card daily__card--feature"
            style={subjectStyle(featuredSubject)}
            onClick={() => track({ type: 'view', subjectId: featured.subjectId, topicId: featured.id })}
          >
            <div>
              <p className="daily__kicker">
                <span className="daily__glyph" aria-hidden="true">
                  🔬
                </span>
                {t.home.discovery}
              </p>
              <h2 className="daily__title mt-4">{tr(featured.title)}</h2>
              <p className="daily__text mt-4">{tr(featured.hook)}</p>
            </div>
            <div className="daily__foot">
              {featuredSubject ? <Chip tone="accent">{tr(featuredSubject.name)}</Chip> : null}
              {featured.tags?.slice(0, 2).map((tag) => (
                <Chip key={tag}>{tag}</Chip>
              ))}
            </div>
          </Link>
        ) : null}

        {edition.question ? (
          <Link to="/questions" className="daily__card">
            <p className="daily__kicker">
              <span className="daily__glyph" aria-hidden="true">
                🧠
              </span>
              {t.home.question}
            </p>
            <p className="daily__title">{tr(edition.question.text)}</p>
            <div className="daily__foot">
              <span>{t.questions.linked} →</span>
            </div>
          </Link>
        ) : null}

        {edition.fact ? (
          <Link to={`/facts?open=${edition.fact.id}`} className="daily__card">
            <p className="daily__kicker">
              <span className="daily__glyph" aria-hidden="true">
                💡
              </span>
              {t.home.fact}
            </p>
            <p className="daily__text" style={{ color: 'var(--ink)' }}>
              {tr(edition.fact.text)}
            </p>
            <div className="daily__foot">
              <span>{edition.fact.source.publisher}</span>
            </div>
          </Link>
        ) : null}

        {edition.onThisDay ? (
          <Link to={`/timeline?open=${edition.onThisDay.event.id}`} className="daily__card daily__card--wide">
            <p className="daily__kicker">
              <span className="daily__glyph" aria-hidden="true">
                📜
              </span>
              {t.home.onThisDay}
              <Chip>{matchLabel}</Chip>
            </p>
            <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-4)' }}>
              <span className="daily__year">{edition.onThisDay.event.year}</span>
              <span className="grow">
                <span className="daily__title">{tr(edition.onThisDay.event.title)}</span>
              </span>
            </div>
            <p className="daily__text">{tr(edition.onThisDay.event.summary)}</p>
            <div className="daily__foot">
              <span>{t.daily.yearsAgo(yearsAgo)}</span>
            </div>
          </Link>
        ) : null}

        {edition.formula ? (
          <Link to={`/formulas?open=${edition.formula.id}`} className="daily__card">
            <p className="daily__kicker">
              <span className="daily__glyph" aria-hidden="true">
                🧮
              </span>
              {t.home.formula}
            </p>
            <p className="daily__title">{tr(edition.formula.name)}</p>
            <p
              className="mono"
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-sunken)',
                fontSize: 'var(--text-sm)',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {edition.formula.expression}
            </p>
          </Link>
        ) : null}

        {edition.spaceTopic ? (
          <Link
            to={`/topics/${edition.spaceTopic.id}`}
            className="daily__card"
            style={subjectStyle(subjectById.get('astronomy'))}
          >
            <p className="daily__kicker">
              <span className="daily__glyph" aria-hidden="true">
                🌌
              </span>
              {t.home.space}
            </p>
            <p className="daily__title">{tr(edition.spaceTopic.title)}</p>
            <p className="daily__text">{tr(edition.spaceTopic.hook)}</p>
          </Link>
        ) : null}

        <Link to="/research" className="daily__card daily__card--wide">
          <p className="daily__kicker">
            <span className="daily__glyph" aria-hidden="true">
              🧬
            </span>
            {t.home.research}
          </p>
          <p className="daily__title">{t.research.subtitle}</p>
          <p className="daily__text">{t.research.intro}</p>
          <div className="daily__foot">
            <Chip tone="accent">OpenAlex</Chip>
            <Chip>Crossref</Chip>
            <Chip>NASA</Chip>
          </div>
        </Link>

        {edition.person ? (
          <Link to={`/people/${edition.person.id}`} className="daily__card">
            <p className="daily__kicker">
              <span className="daily__glyph" aria-hidden="true">
                ☺
              </span>
              {t.home.person}
            </p>
            <p className="daily__title">{tr(edition.person.name)}</p>
            <p className="daily__text">
              {edition.person.lived} · {tr(edition.person.known)}
            </p>
          </Link>
        ) : null}
      </div>

      <section className="section">
        <SectionHead
          title={t.home.rooms}
          subtitle={t.home.roomsSubtitle}
          action={
            <Link className="btn btn--ghost" to="/labs">
              {t.home.allLabs} →
            </Link>
          }
        />
        <div className="rooms">
          {rooms.map((subject) => (
            <RoomCard key={subject.id} subject={subject} />
          ))}
        </div>
      </section>

      {edition.extraTopics.length > 0 ? (
        <section className="section">
          <SectionHead
            title={t.home.continueExploring}
            subtitle={
              isProfileCold(profile) || prefs.favouriteSubjects.length === 0
                ? undefined
                : t.home.forYou
            }
          />
          <div className="grid-2">
            {edition.extraTopics.map((topic) => {
              const subject = subjectById.get(topic.subjectId);
              const isOutside = !profile.topSubjects.includes(topic.subjectId);
              return (
                <Link
                  key={topic.id}
                  to={`/topics/${topic.id}`}
                  className="card"
                  style={subjectStyle(subject)}
                  onClick={() => track({ type: 'view', subjectId: topic.subjectId, topicId: topic.id })}
                >
                  <div className="row">
                    {subject ? <Chip tone="accent">{tr(subject.name)}</Chip> : null}
                    {isOutside && profile.topSubjects.length > 0 ? <Chip>{t.home.somethingNew}</Chip> : null}
                  </div>
                  <p className="card__title">{tr(topic.title)}</p>
                  <p className="card__body">{tr(topic.hook)}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <p className="xsmall muted mt-6">
        {library.topics.length} თემა · {library.formulas.length} ფორმულა · {library.facts.length} ფაქტი ·{' '}
        {subjects.length} ლაბორატორია · {Object.keys(SUBJECT_GROUP_LABELS).length - 1} მიმართულება
      </p>
    </div>
  );
}
