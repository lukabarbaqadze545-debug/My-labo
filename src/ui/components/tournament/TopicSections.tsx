import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { CtTopic } from '@/content/competitive';
import { relatedTopics } from '@/domain/competitive';
import { CodeBlock } from '../CodeBlock';
import { CT_SECTION_LABEL } from './labels';

/**
 * Renders a topic's authored content as a sequence of focused sections. Every
 * section is optional; an unauthored topic simply shows the roadmap notice and
 * its relationships. No per-topic logic — this is a pure renderer over CtTopic.
 */

/**
 * Authored prose uses `backticks` for identifiers and expressions (p[r+1],
 * long long, O(1)). Render those as inline code so the teaching text reads like
 * an editorial rather than raw markdown.
 */
function Prose({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="ct-code">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="ct-sec" id={id}>
      <h2 className="ct-sec__h">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="ct-list">
      {items.map((item, i) => (
        <li key={i}>
          <Prose text={item} />
        </li>
      ))}
    </ul>
  );
}

function RelChips({ ids }: { ids: readonly string[] }) {
  const topics = relatedTopics(ids);
  if (topics.length === 0) return <p className="ct-muted">—</p>;
  return (
    <div className="ct-chips">
      {topics.map((t) => (
        <Link key={t.id} to={`/tournament/${t.id}`} className="ct-chip">
          {t.title}
        </Link>
      ))}
    </div>
  );
}

export function TopicSections({ topic, authored }: { topic: CtTopic; authored: boolean }) {
  return (
    <div className="ct-sections">
      {!authored ? (
        <div className="ct-slot-notice">
          <p>
            ეს თემა როუდმაპში უკვეა, სრული მასალა კი მალე დაემატება. ქვემოთ ხედავ, რას უკავშირდება.
          </p>
        </div>
      ) : null}

      {topic.whatIs ? (
        <Section id="what-is" title={CT_SECTION_LABEL.whatIs}>
          <p className="ct-lead"><Prose text={topic.whatIs} /></p>
        </Section>
      ) : null}

      {topic.intuition ? (
        <Section id="intuition" title={CT_SECTION_LABEL.intuition}>
          <p className="ct-insight"><Prose text={topic.intuition} /></p>
        </Section>
      ) : null}

      {topic.naive ? (
        <Section id="naive" title={CT_SECTION_LABEL.naive}>
          <p><Prose text={topic.naive} /></p>
        </Section>
      ) : null}

      {topic.whyItWorks ? (
        <Section id="why" title={CT_SECTION_LABEL.whyItWorks}>
          <p><Prose text={topic.whyItWorks} /></p>
        </Section>
      ) : null}

      {topic.whenToUse?.length ? (
        <Section id="when" title={CT_SECTION_LABEL.whenToUse}>
          <Bullets items={topic.whenToUse} />
        </Section>
      ) : null}

      {topic.signals?.length ? (
        <Section id="signals" title={CT_SECTION_LABEL.signals}>
          <Bullets items={topic.signals} />
        </Section>
      ) : null}

      {topic.walkthrough?.length ? (
        <Section id="walkthrough" title={CT_SECTION_LABEL.walkthrough}>
          <ol className="ct-steps">
            {topic.walkthrough.map((step, i) => (
              <li key={i}>
                <Prose text={step} />
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {topic.cpp?.length ? (
        <Section id="cpp" title={CT_SECTION_LABEL.cpp}>
          {topic.cpp.map((snippet, i) => (
            <CodeBlock key={i} lang="cpp" code={snippet.code} {...(snippet.caption ? { caption: snippet.caption } : {})} />
          ))}
        </Section>
      ) : null}

      {topic.time || topic.space ? (
        <Section id="complexity" title={CT_SECTION_LABEL.complexity}>
          <dl className="ct-complexity">
            {topic.time ? (
              <>
                <dt>დრო</dt>
                <dd>{topic.time}</dd>
              </>
            ) : null}
            {topic.space ? (
              <>
                <dt>მეხსიერება</dt>
                <dd>{topic.space}</dd>
              </>
            ) : null}
          </dl>
        </Section>
      ) : null}

      {topic.mistakes?.length ? (
        <Section id="mistakes" title={CT_SECTION_LABEL.mistakes}>
          <Bullets items={topic.mistakes} />
        </Section>
      ) : null}

      {topic.edgeCases?.length ? (
        <Section id="edge-cases" title={CT_SECTION_LABEL.edgeCases}>
          <Bullets items={topic.edgeCases} />
        </Section>
      ) : null}

      <Section id="prerequisites" title={CT_SECTION_LABEL.prerequisites}>
        <RelChips ids={topic.prerequisites} />
      </Section>

      <Section id="related" title={CT_SECTION_LABEL.related}>
        <RelChips ids={topic.related} />
      </Section>

      <Section id="combines" title={CT_SECTION_LABEL.combines}>
        {topic.combineNote ? <p><Prose text={topic.combineNote} /></p> : null}
        <RelChips ids={topic.combinesWith} />
      </Section>

      {topic.exercises?.length ? (
        <Section id="exercises" title={CT_SECTION_LABEL.exercises}>
          <Bullets items={topic.exercises} />
        </Section>
      ) : null}

      {topic.practice?.length ? (
        <Section id="practice" title={CT_SECTION_LABEL.practice}>
          <ul className="ct-practice">
            {topic.practice.map((task, i) => (
              <li key={i}>
                {task.url ? (
                  <a href={task.url} target="_blank" rel="noreferrer noopener">
                    {task.name} ↗
                  </a>
                ) : (
                  <span>{task.name}</span>
                )}
                {task.tag ? <span className="ct-practice__tag">{task.tag}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
