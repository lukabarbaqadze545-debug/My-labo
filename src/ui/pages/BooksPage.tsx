import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/persistence/db';
import {
  commitBook,
  deleteBook,
  setBookDisabled,
  saveAiSettings,
} from '@/persistence/repositories';
import { ingestPdf, BookExtractionError, type ImportPreview } from '@/domain/books';
import { useT } from '../state/AppState';
import { useAiSettings } from '../components/AiSettings';

/**
 * Learn from Books.
 *
 * The flow is deliberately four steps with a stop before the last one:
 * upload → extract → preview → import. Nothing reaches the assistant's
 * knowledge until the preview has been seen, because a bad extraction
 * imported silently is worse than no import at all.
 */

type Phase =
  | { kind: 'idle' }
  | { kind: 'working'; label: string; page?: number; total?: number }
  | { kind: 'preview'; preview: ImportPreview; filename: string }
  | { kind: 'error'; message: string };

const QUALITY_LABEL: Record<string, string> = {
  good: 'კარგი',
  fair: 'საშუალო',
  poor: 'დაბალი',
  failed: 'წარუმატებელი',
};

const TYPE_LABEL: Record<string, string> = {
  definition: 'განმარტება',
  claim: 'მტკიცება',
  argument: 'არგუმენტი',
  counterargument: 'კონტრარგუმენტი',
  objection: 'შესაგებელი',
  reply: 'პასუხი',
  example: 'მაგალითი',
  thoughtExperiment: 'სააზროვნო ექსპერიმენტი',
  distinction: 'გამიჯვნა',
  position: 'პოზიცია',
  concept: 'ცნება',
  term: 'ტერმინი',
  question: 'კითხვა',
};

export function BooksPage() {
  const t = useT();
  const ai = useAiSettings();
  const books = useLiveQuery(() => db.books.orderBy('importedAt').reverse().toArray(), []) ?? [];
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setPhase({ kind: 'working', label: t.books.reading });
    try {
      const buffer = await file.arrayBuffer();
      const preview = await ingestPdf(buffer, {
        filename: file.name,
        onProgress: (page, total) =>
          setPhase({ kind: 'working', label: t.books.extracting, page, total }),
      });
      setPhase({ kind: 'preview', preview, filename: file.name });
    } catch (err) {
      const message =
        err instanceof BookExtractionError
          ? err.kind === 'empty'
            ? t.books.errNoText
            : err.kind === 'encrypted'
              ? t.books.errEncrypted
              : t.books.errUnreadable
          : t.books.errUnreadable;
      setPhase({ kind: 'error', message });
    }
  }, [t.books]);

  const confirmImport = async (preview: ImportPreview) => {
    setPhase({ kind: 'working', label: t.books.saving });
    try {
      const book = await commitBook(preview);
      // A first import switches books on, so the effect is visible immediately.
      if (ai.bookMode === 'off') {
        await saveAiSettings({ bookMode: 'with_labo', bookIds: [book.id] });
      }
      setPhase({ kind: 'idle' });
    } catch {
      setPhase({ kind: 'error', message: t.books.errSave });
    }
  };

  const askThisBook = async (bookId: string) => {
    await saveAiSettings({ bookMode: 'book', bookIds: [bookId] });
  };

  return (
    <div className="page books-page">
      <header className="hero">
        <h1 className="hero__title">{t.books.title}</h1>
        <p className="hero__sub">{t.books.subtitle}</p>
      </header>

      {/* ------------------------------ upload ----------------------------- */}
      <section className="books-upload">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
        <button
          className="btn btn--primary"
          disabled={phase.kind === 'working'}
          onClick={() => fileRef.current?.click()}
        >
          {t.books.upload}
        </button>
        <span className="xsmall muted">{t.books.uploadHint}</span>
      </section>

      {phase.kind === 'working' ? (
        <div className="books-status">
          <span className="ask-dots" aria-hidden="true"><span /><span /><span /></span>
          <span>
            {phase.label}
            {phase.page && phase.total ? ` — ${phase.page}/${phase.total}` : ''}
          </span>
        </div>
      ) : null}

      {phase.kind === 'error' ? (
        <div className="books-status books-status--error">
          <strong>{t.books.failed}</strong>
          <span>{phase.message}</span>
          <button className="btn btn--quiet btn--sm" onClick={() => setPhase({ kind: 'idle' })}>
            {t.common.cancel}
          </button>
        </div>
      ) : null}

      {/* ------------------------------ preview ---------------------------- */}
      {phase.kind === 'preview' ? (
        <PreviewPanel
          preview={phase.preview}
          onImport={() => void confirmImport(phase.preview)}
          onCancel={() => setPhase({ kind: 'idle' })}
        />
      ) : null}

      {/* ------------------------------ library ---------------------------- */}
      <section className="books-library">
        <h2 className="section__title">{t.books.library}</h2>
        {books.length === 0 ? (
          <p className="muted">{t.books.empty}</p>
        ) : (
          <ul className="books-list">
            {books.map((book) => (
              <li key={book.id} className={`book-card${book.disabled ? ' is-off' : ''}`}>
                <div className="book-card__head">
                  <span className="book-card__title">{book.title}</span>
                  {book.author ? <span className="book-card__author">{book.author}</span> : null}
                </div>
                <div className="book-card__meta">
                  <span>{book.totalPages} {t.books.pages}</span>
                  <span>{book.stats.sections} {t.books.chapters}</span>
                  <span>{book.stats.chunks} {t.books.passages}</span>
                  <span>{book.stats.knowledge} {t.books.items}</span>
                  <span className={`book-quality book-quality--${book.extractionQuality}`}>
                    {QUALITY_LABEL[book.extractionQuality]}
                  </span>
                </div>
                {book.warnings.length > 0 ? (
                  <ul className="book-card__warnings">
                    {book.warnings.slice(0, 3).map((w) => (
                      <li key={w}>⚠ {w}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="book-card__actions">
                  <Link className="btn btn--ghost btn--sm" to="/ask" onClick={() => void askThisBook(book.id)}>
                    {t.books.askThis}
                  </Link>
                  <button
                    className="btn btn--quiet btn--sm"
                    onClick={() => setExpanded(expanded === book.id ? null : book.id)}
                  >
                    {expanded === book.id ? t.books.hideKnowledge : t.books.reviewKnowledge}
                  </button>
                  <button
                    className="btn btn--quiet btn--sm"
                    onClick={() => void setBookDisabled(book.id, !book.disabled)}
                  >
                    {book.disabled ? t.books.enable : t.books.disable}
                  </button>
                  <button
                    className="btn btn--quiet btn--sm popmenu__danger"
                    onClick={() => {
                      if (window.confirm(t.books.removeConfirm)) void deleteBook(book.id);
                    }}
                  >
                    {t.books.remove}
                  </button>
                </div>
                {expanded === book.id ? <BookKnowledgeList bookId={book.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ------------------------------- preview -------------------------------- */

function PreviewPanel({
  preview,
  onImport,
  onCancel,
}: {
  preview: ImportPreview;
  onImport: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const { report, book } = preview;
  const counts = report.counts;

  const rows: [string, number | string][] = [
    [t.books.pages, report.pages],
    [t.books.chapters, counts.sections ?? 0],
    [t.books.passages, counts.chunks ?? 0],
    [t.books.quality, QUALITY_LABEL[report.quality] ?? report.quality],
  ];

  const knowledgeCounts = Object.entries(counts).filter(
    ([key]) => key in TYPE_LABEL,
  );

  const failed = report.quality === 'failed';

  return (
    <section className="books-preview">
      <h2 className="section__title">{t.books.previewTitle}</h2>

      <p className="books-preview__book">
        <strong>{book.title}</strong>
        {book.author ? ` — ${book.author}` : ''} · {book.language.toUpperCase()}
      </p>

      <div className="books-preview__grid">
        {rows.map(([label, value]) => (
          <div key={label} className="books-preview__stat">
            <span className="books-preview__num">{value}</span>
            <span className="books-preview__label">{label}</span>
          </div>
        ))}
      </div>

      {knowledgeCounts.length > 0 ? (
        <>
          <h3 className="books-preview__sub">{t.books.foundKnowledge}</h3>
          <div className="books-preview__chips">
            {knowledgeCounts.map(([key, value]) => (
              <span key={key} className="rmap__chip">
                {TYPE_LABEL[key]} <em>{value}</em>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="muted">{t.books.noKnowledge}</p>
      )}

      {report.warnings.length > 0 ? (
        <>
          <h3 className="books-preview__sub">{t.books.warnings}</h3>
          <ul className="book-card__warnings">
            {report.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="row">
        <button className="btn btn--primary" disabled={failed} onClick={onImport}>
          {t.books.import}
        </button>
        <button className="btn btn--quiet" onClick={onCancel}>
          {t.common.cancel}
        </button>
        {failed ? <span className="xsmall" style={{ color: 'var(--danger)' }}>{t.books.cannotImport}</span> : null}
      </div>
    </section>
  );
}

/* --------------------------- knowledge review ---------------------------- */

function BookKnowledgeList({ bookId }: { bookId: string }) {
  const t = useT();
  const items =
    useLiveQuery(() => db.bookKnowledge.where('bookId').equals(bookId).toArray(), [bookId]) ?? [];

  if (items.length === 0) return <p className="muted xsmall">{t.books.noKnowledge}</p>;

  return (
    <ul className="book-knowledge">
      {items.slice(0, 60).map((item) => (
        <li key={item.id} className="book-knowledge__item">
          <span className={`rmap__badge rmap__badge--${item.confidence}`}>
            {TYPE_LABEL[item.type] ?? item.type}
          </span>
          <span className="book-knowledge__text">{item.content}</span>
          <span className="book-knowledge__page">
            გვ. {item.source.pageStart}
            {item.source.pageEnd !== item.source.pageStart ? `–${item.source.pageEnd}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}
