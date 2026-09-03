import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { t as tr } from '@/content';
import type { UserDocument } from '@/persistence/db';
import { getDocument, updateDocument } from '@/persistence/repositories';
import { countWords } from '@/domain/document';
import { useApp, useT } from '../../state/AppState';
import { DocumentEditor } from './Editor';
import {
  exportDocx,
  exportHtml,
  exportMarkdown,
  exportPdf,
  exportPptx,
  type ExportFormat,
} from './exporters';

type SaveState = 'idle' | 'saving' | 'saved';

export function DocumentEditorPage() {
  const t = useT();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { subjects } = useApp();

  const [doc, setDoc] = useState<UserDocument | null | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [stats, setStats] = useState({ words: 0, chars: 0 });
  const [save, setSave] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string>('');
  const [zen, setZen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const pendingRef = useRef<{ doc?: unknown; text?: string; title?: string; subjectId?: string | null }>({});
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void getDocument(id).then((d) => {
      if (!alive) return;
      setDoc(d ?? null);
      if (d) setTitle(d.title);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  // Zen mode hides the app chrome via a body class.
  useEffect(() => {
    document.body.classList.toggle('is-writing-zen', zen);
    return () => document.body.classList.remove('is-writing-zen');
  }, [zen]);

  const flush = useCallback(async () => {
    const p = pendingRef.current;
    if (Object.keys(p).length === 0) return;
    pendingRef.current = {};
    const patch: Partial<UserDocument> = {};
    if (p.doc !== undefined) {
      patch.doc = p.doc;
      patch.text = p.text ?? '';
      patch.wordCount = countWords(p.text ?? '');
    }
    if (p.title !== undefined) patch.title = p.title;
    if (p.subjectId !== undefined) patch.subjectId = p.subjectId ?? undefined;
    await updateDocument(id, patch);
    setSave('saved');
    setSavedAt(
      new Date().toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' }),
    );
  }, [id]);

  const schedule = useCallback(() => {
    setSave('saving');
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flush(), 700);
  }, [flush]);

  // Save on unmount / tab hide so nothing is lost.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onHide);
      window.clearTimeout(timerRef.current);
      void flush();
    };
  }, [flush]);

  const onEditorChange = useCallback(
    (json: unknown, text: string) => {
      pendingRef.current.doc = json;
      pendingRef.current.text = text;
      schedule();
    },
    [schedule],
  );

  const onStats = useCallback((words: number, chars: number) => {
    setStats((p) => (p.words === words && p.chars === chars ? p : { words, chars }));
  }, []);

  const onTitleChange = (value: string) => {
    setTitle(value);
    pendingRef.current.title = value.trim() || t.documents.untitled;
    schedule();
  };

  const runExport = async (fmt: ExportFormat) => {
    setExportOpen(false);
    await flush();
    const safeTitle = title.trim() || t.documents.untitled;
    const current = pendingRef.current.doc ?? doc?.doc;
    if (fmt === 'pdf') {
      exportPdf(safeTitle);
      return;
    }
    setExporting(fmt);
    try {
      if (fmt === 'docx') await exportDocx(safeTitle, current);
      else if (fmt === 'pptx') await exportPptx(safeTitle, current);
      else if (fmt === 'md') exportMarkdown(safeTitle, current);
      else if (fmt === 'html') exportHtml(safeTitle, current);
    } catch (err) {
      console.error(err);
      window.alert(t.documents.exportFail);
    } finally {
      setExporting(null);
    }
  };

  if (doc === undefined) return <div className="page">{t.common.loading}</div>;
  if (doc === null) {
    return (
      <div className="page">
        <p className="empty__title">{t.common.notFound}</p>
        <Link className="btn btn--ghost" to="/write">
          {t.documents.back}
        </Link>
      </div>
    );
  }

  const readMin = Math.max(stats.words ? 1 : 0, Math.round(stats.words / 200));

  return (
    <div className="page doc-page">
      <div className="doc-editorbar">
        <button className="btn btn--quiet btn--sm" onClick={() => navigate('/write')}>
          ← {t.documents.back}
        </button>
        <span className="doc-editorbar__spacer" />
        <span className="doc-editorbar__save">
          {save === 'saving' ? t.documents.saving : savedAt ? t.documents.savedAt(savedAt) : ''}
        </span>
        <button className="btn btn--ghost btn--sm" onClick={() => setZen((v) => !v)}>
          {zen ? t.documents.zenOff : t.documents.zenOn}
        </button>
        <div className="doc-export">
          <button className="btn btn--ghost btn--sm" onClick={() => setExportOpen((v) => !v)}>
            ↓ {exporting ? t.documents.exporting : t.documents.export}
          </button>
          {exportOpen ? (
            <div className="popmenu" onMouseLeave={() => setExportOpen(false)}>
              <button onClick={() => void runExport('docx')}>{t.documents.exportWord}</button>
              <button onClick={() => void runExport('pdf')}>{t.documents.exportPdf}</button>
              <button onClick={() => void runExport('pptx')}>{t.documents.exportPptx}</button>
              <button onClick={() => void runExport('md')}>{t.documents.exportMd}</button>
              <button onClick={() => void runExport('html')}>{t.documents.exportHtml}</button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="doc-sheet">
        <h1 className="doc-print-title">{title || t.documents.untitled}</h1>
        <input
          className="doc-title-input"
          value={title}
          placeholder={t.documents.titlePlaceholder}
          onChange={(e) => onTitleChange(e.target.value)}
        />

        <div className="doc-meta-row">
          <label className="doc-subject">
            <span>{t.documents.linkSubject}:</span>
            <select
              value={doc.subjectId ?? ''}
              onChange={(e) => {
                const v = e.target.value || null;
                setDoc({ ...doc, subjectId: v ?? undefined });
                pendingRef.current.subjectId = v;
                schedule();
              }}
            >
              <option value="">{t.documents.noSubject}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {tr(s.name)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DocumentEditor initialContent={doc.doc} onChange={onEditorChange} onStats={onStats} />

        <div className="doc-statusbar">
          <span>{t.documents.words(stats.words)}</span>
          <span>{t.documents.chars(stats.chars)}</span>
          <span>{t.documents.readTime(readMin)}</span>
        </div>
      </div>
    </div>
  );
}
