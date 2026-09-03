import { useT } from '../state/AppState';
import { Notice } from '../components/primitives';
import { Placeholder } from './Placeholder';

/** Live research radar — pulls from OpenAlex / NASA / USGS. Not wired yet. */
export function ResearchPage() {
  const t = useT();
  return (
    <Placeholder title={t.research.title} subtitle={t.research.subtitle} glyph="🧬">
      <div className="stack">
        <p className="prose">{t.research.intro}</p>
        <Notice tone="caution">{t.research.disclaimer}</Notice>
        <p className="xsmall muted">ცოცხალი წყაროების ჩართვა მიმდინარეობს.</p>
      </div>
    </Placeholder>
  );
}
