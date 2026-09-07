import { useState } from 'react';
import { compareWorlds, type Consequence, type ParallelWorld } from '@/domain/worlds';
import { KIND_GLYPH, KIND_LABEL } from './labels';

/**
 * Side-by-side comparison of two worlds.
 *
 * Every row comes from stored data; nothing is interpreted. The useful signal
 * is asymmetry — a consequence one branch reasoned through and the other never
 * considered is exactly the gap worth seeing.
 */

const FIELD_LABEL = {
  baseRule: 'ბაზისური რეალობა',
  changedRule: 'შეცვლილი წესი',
  conclusion: 'დასკვნა',
} as const;

interface Props {
  worlds: readonly ParallelWorld[];
  consequences: readonly Consequence[];
  initialA: string | null;
  onClose: () => void;
}

export function WorldCompare({ worlds, consequences, initialA, onClose }: Props) {
  const [aId, setAId] = useState(initialA ?? worlds[0]?.id ?? '');
  const [bId, setBId] = useState(worlds.find((w) => w.id !== aId)?.id ?? '');

  const comparison = compareWorlds(aId, bId, worlds, consequences);

  const picker = (value: string, onChange: (id: string) => void, label: string) => (
    <label className="wcmp__pick">
      <span className="wed__label">{label}</span>
      <select className="ask-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {worlds.map((world) => (
          <option key={world.id} value={world.id}>
            {world.title}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="wcmp">
      <header className="wcmp__head">
        <h2 className="wed__h2">შედარება</h2>
        <button className="ask-tool" onClick={onClose}>
          ✕ დახურვა
        </button>
      </header>

      <div className="wcmp__pickers">
        {picker(aId, setAId, 'სამყარო A')}
        {picker(bId, setBId, 'სამყარო B')}
      </div>

      {!comparison ? (
        <p className="xsmall muted">აირჩიე ორი განსხვავებული სამყარო.</p>
      ) : (
        <>
          <p className="wcmp__rel">
            {comparison.ancestor ? (
              <>
                საერთო წარმომავლობა: <strong>{comparison.ancestor.title}</strong>
                {comparison.siblings ? ' · პარალელური ტოტები' : ' · პირდაპირი შთამომავლობა'}
              </>
            ) : (
              'ეს ორი სამყარო დამოუკიდებელია — საერთო წინაპარი არ აქვთ.'
            )}
          </p>

          <table className="wcmp__table">
            <tbody>
              {comparison.fields.map((field) => (
                <tr key={field.label} className={field.same ? 'is-same' : 'is-diff'}>
                  <th scope="row">{FIELD_LABEL[field.label]}</th>
                  <td>{field.a || <em className="muted">—</em>}</td>
                  <td>{field.b || <em className="muted">—</em>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {comparison.consequences.map((group) =>
            group.onlyA.length === 0 && group.onlyB.length === 0 && group.shared.length === 0 ? null : (
              <section key={group.kind} className="wcmp__group">
                <h3 className="wed__label">
                  {KIND_GLYPH[group.kind]} {KIND_LABEL[group.kind]}
                </h3>
                <div className="wcmp__cols">
                  <ul className="wcmp__col">
                    {group.onlyA.map((c) => (
                      <li key={c.id} className="wcmp__only">
                        <span className="wcmp__lvl">L{c.level}</span> {c.text}
                      </li>
                    ))}
                  </ul>
                  <ul className="wcmp__col wcmp__col--shared">
                    {group.shared.map(({ a }) => (
                      <li key={a.id}>
                        <span className="wcmp__lvl">L{a.level}</span> {a.text}
                      </li>
                    ))}
                  </ul>
                  <ul className="wcmp__col">
                    {group.onlyB.map((c) => (
                      <li key={c.id} className="wcmp__only">
                        <span className="wcmp__lvl">L{c.level}</span> {c.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ),
          )}

          {comparison.openQuestions.onlyA.length > 0 || comparison.openQuestions.onlyB.length > 0 ? (
            <section className="wcmp__group">
              <h3 className="wed__label">ღია კითხვები</h3>
              <div className="wcmp__cols">
                <ul className="wcmp__col">
                  {comparison.openQuestions.onlyA.map((q) => (
                    <li key={q} className="wcmp__only">{q}</li>
                  ))}
                </ul>
                <ul className="wcmp__col wcmp__col--shared">
                  {comparison.openQuestions.shared.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                <ul className="wcmp__col">
                  {comparison.openQuestions.onlyB.map((q) => (
                    <li key={q} className="wcmp__only">{q}</li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
