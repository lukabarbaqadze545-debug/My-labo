import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  createDocument,
  deleteDocumentForever,
  duplicateDocument,
  listDocuments,
  listTrashedDocuments,
  restoreDocument,
  trashDocument,
  updateDocument,
} from '@/persistence/repositories';
import { readingMinutes, snippet } from '@/domain/document';
import { useT } from '../../state/AppState';
import { EmptyState, SectionHead } from '../../components/primitives';

function relative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'ახლახან';
  if (min < 60) return `${min} წთ წინ`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} სთ წინ`;
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function DocumentsPage() {
  const t = useT();
  const navigate = useNavigate();
  const docs = useLiveQuery(() => listDocuments(), []);
  const trashed = useLiveQuery(() => listTrashedDocuments(), []);
  const [showTrash, setShowTrash] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const create = async () => {
    const doc = await createDocument({ title: t.documents.untitled });
    navigate(`/write/${doc.id}`);
  };

  return (
    <div className="page">
      <header className="hero">
        <h1 className="hero__title">{t.documents.title}</h1>
        <p className="hero__sub">{t.documents.subtitle}</p>
      </header>

      <div className="row" style={{ marginBottom: 'var(--space-5)' }}>
        <button className="btn btn--primary" onClick={() => void create()}>
          + {t.documents.newDoc}
        </button>
      </div>

      {docs && docs.length === 0 ? (
        <EmptyState glyph="✍" title={t.documents.empty} hint={t.documents.emptyHint} />
      ) : (
        <div className="doc-grid">
          {(docs ?? []).map((doc) => (
            <div key={doc.id} className="doc-card">
              <Link to={`/write/${doc.id}`} className="doc-card__body">
                <span className="doc-card__title">{doc.title || t.documents.untitled}</span>
                <span className="doc-card__snippet">{snippet(doc.text) || '—'}</span>
              </Link>
              <div className="doc-card__foot">
                <span className="doc-card__meta">
                  {t.documents.words(doc.wordCount)} · {relative(doc.updatedAt)}
                </span>
                <div className="doc-card__menu">
                  <button
                    className="btn btn--quiet btn--sm"
                    onClick={() => setMenuId(menuId === doc.id ? null : doc.id)}
                    aria-label="მენიუ"
                  >
                    ⋯
                  </button>
                  {menuId === doc.id ? (
                    <div className="popmenu" onMouseLeave={() => setMenuId(null)}>
                      <button
                        onClick={() => {
                          const name = window.prompt(t.documents.rename, doc.title);
                          if (name != null) void updateDocument(doc.id, { title: name.trim() || t.documents.untitled });
                          setMenuId(null);
                        }}
                      >
                        {t.documents.rename}
                      </button>
                      <button
                        onClick={async () => {
                          setMenuId(null);
                          const copy = await duplicateDocument(doc.id);
                          if (copy) navigate(`/write/${copy.id}`);
                        }}
                      >
                        {t.documents.duplicate}
                      </button>
                      <button
                        className="popmenu__danger"
                        onClick={() => {
                          void trashDocument(doc.id);
                          setMenuId(null);
                        }}
                      >
                        {t.documents.moveToTrash}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <span className="doc-card__read">{t.documents.readTime(readingMinutes(doc.wordCount))}</span>
            </div>
          ))}
        </div>
      )}

      {trashed && trashed.length > 0 ? (
        <section className="section" style={{ marginTop: 'var(--space-7)' }}>
          <SectionHead
            title={`${t.documents.trash} (${trashed.length})`}
            action={
              <button className="btn btn--ghost btn--sm" onClick={() => setShowTrash((v) => !v)}>
                {showTrash ? '−' : '+'}
              </button>
            }
          />
          {showTrash ? (
            <ul className="trashlist">
              {trashed.map((doc) => (
                <li key={doc.id}>
                  <span className="grow">{doc.title || t.documents.untitled}</span>
                  <button className="btn btn--quiet btn--sm" onClick={() => void restoreDocument(doc.id)}>
                    {t.documents.restore}
                  </button>
                  <button
                    className="btn btn--quiet btn--sm popmenu__danger"
                    onClick={() => {
                      if (window.confirm(t.documents.deleteForeverConfirm)) void deleteDocumentForever(doc.id);
                    }}
                  >
                    {t.documents.deleteForever}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
