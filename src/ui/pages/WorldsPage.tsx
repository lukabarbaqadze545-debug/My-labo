import { useCallback, useEffect, useRef, useState } from 'react';
import { exportWorlds, parseWorldsImport, type ParallelWorld } from '@/domain/worlds';
import {
  addConsequence,
  branchWorld,
  createWorld,
  deleteConsequence,
  deleteWorld,
  importWorldsData,
  linkConsequence,
  unlinkConsequence,
  updateConsequence,
  updateWorld,
} from '@/persistence/repositories';
import { useWorlds } from '../state/useWorlds';
import { WorldList } from '../components/worlds/WorldList';
import { WorldEditor } from '../components/worlds/WorldEditor';
import { WorldCompare } from '../components/worlds/WorldCompare';

/**
 * Parallel Worlds — a laboratory for counterfactuals.
 *
 * Composition only. Lineage, inheritance, consequence ordering, the causal map
 * and comparison all live in `@/domain/worlds`; persistence lives in the
 * repositories. What is left here is which world is open and which panel shows.
 */

const ACTIVE_KEY = 'labo:worlds:active';

export function WorldsPage() {
  const { worlds, consequences, byId, forest, loading, resolve, consequencesFor } = useWorlds();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  });
  const [comparing, setComparing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Remember which world was open; drop the memory if it was deleted. */
  useEffect(() => {
    if (loading) return;
    if (selectedId && !byId.has(selectedId)) {
      setSelectedId(null);
      return;
    }
    try {
      if (selectedId) localStorage.setItem(ACTIVE_KEY, selectedId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  }, [selectedId, byId, loading]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2800);
  };

  const selected = selectedId ? resolve(selectedId) : undefined;

  /* ------------------------------- writes ------------------------------- */

  const create = useCallback(async () => {
    const world = await createWorld({ title: 'ახალი სამყარო' });
    if (world) {
      setSelectedId(world.id);
      setComparing(false);
    }
  }, []);

  const patch = useCallback(
    (worldPatch: Partial<ParallelWorld>) => {
      if (!selectedId) return;
      void updateWorld(selectedId, worldPatch);
    },
    [selectedId],
  );

  const branch = useCallback(async () => {
    if (!selected) return;
    const rule = window.prompt('რა იცვლება ამ ტოტში?', '');
    if (rule === null) return;
    const created = await branchWorld(selected.id, `${selected.title} — ტოტი`, rule);
    if (created) {
      setSelectedId(created.id);
      flash('ტოტი შეიქმნა. ბაზისური რეალობა მშობლისგან მემკვიდრეობითია.');
    }
  }, [selected]);

  const remove = useCallback(async () => {
    if (!selected) return;
    const children = worlds.filter((w) => w.parentId === selected.id).length;
    const warning = children
      ? `„${selected.title}" და მისი ${children} ტოტი წაიშლება. გავაგრძელო?`
      : `„${selected.title}" წაიშლება. გავაგრძელო?`;
    if (!window.confirm(warning)) return;
    await deleteWorld(selected.id);
    setSelectedId(null);
  }, [selected, worlds]);

  /* --------------------------- import / export -------------------------- */

  const doExport = () => {
    const dump = exportWorlds(worlds, consequences);
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `labo-worlds-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    try {
      const parsed = parseWorldsImport(JSON.parse(await file.text()));
      if (parsed.worlds.length === 0) {
        flash(parsed.errors[0] ?? 'ფაილში სამყარო ვერ მოიძებნა.');
        return;
      }
      await importWorldsData(parsed.worlds, parsed.consequences);
      flash(
        `დაემატა ${parsed.worlds.length} სამყარო, ${parsed.consequences.length} შედეგი.` +
          (parsed.errors.length ? ` ${parsed.errors.length} ჩანაწერი გამოტოვდა.` : ''),
      );
    } catch {
      flash('ფაილი ვერ წაიკითხა.');
    }
  };

  /* -------------------------------- view -------------------------------- */

  return (
    <div className="page worlds-page">
      <header className="ask-head">
        <h1 className="ask-head__title">ალტერნატიული სამყაროები</h1>
        <p className="ask-head__sub">
          შეცვალე ერთი წესი და გაიარე შედეგებზე — პირდაპირიდან სისტემურამდე.
        </p>
      </header>

      <div className="worlds-bar">
        <span className="xsmall muted">{worlds.length} სამყარო</span>
        <div className="worlds-bar__actions">
          <button className="ask-tool" onClick={() => setComparing((v) => !v)} disabled={worlds.length < 2}>
            ⇄ შედარება
          </button>
          <button className="ask-tool" onClick={doExport} disabled={worlds.length === 0}>
            ექსპორტი
          </button>
          <button className="ask-tool" onClick={() => fileRef.current?.click()}>
            იმპორტი
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void doImport(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {notice ? <p className="ask-note ask-note--ok">{notice}</p> : null}

      <div className="worlds-layout">
        <WorldList
          forest={forest}
          worlds={worlds}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setComparing(false);
          }}
          onCreate={() => void create()}
        />

        <div className="worlds-main">
          {comparing ? (
            <WorldCompare
              worlds={worlds}
              consequences={consequences}
              initialA={selectedId}
              onClose={() => setComparing(false)}
            />
          ) : selected ? (
            <WorldEditor
              world={selected}
              byId={byId}
              consequences={consequencesFor(selected.id)}
              onPatch={patch}
              onAddConsequence={(kind, level, text) => {
                void addConsequence({ worldId: selected.id, kind, level, text });
              }}
              onEditConsequence={(id, text) => void updateConsequence(id, { text })}
              onDeleteConsequence={(id) => void deleteConsequence(id)}
              onLink={(childId, parentId) => {
                void linkConsequence(childId, parentId).then((ok) => {
                  if (!ok) flash('ეს კავშირი წრეს შექმნიდა.');
                });
              }}
              onUnlink={(childId, parentId) => void unlinkConsequence(childId, parentId)}
              onBranch={() => void branch()}
              onDelete={() => void remove()}
              onCompare={() => setComparing(true)}
              onSelect={setSelectedId}
            />
          ) : (
            <div className="worlds-empty">
              <p className="worlds-empty__title">აირჩიე ან შექმენი სამყარო</p>
              <p className="worlds-empty__hint">
                სამყარო იწყება ერთი კითხვით: „რა მოხდებოდა, თუ…?" — შემდეგ მსჯელობ, რა გამომდინარეობს
                აქედან პირდაპირ, ირიბად და სისტემურად.
              </p>
              <button className="btn btn--primary btn--sm" onClick={() => void create()}>
                + ახალი სამყარო
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
