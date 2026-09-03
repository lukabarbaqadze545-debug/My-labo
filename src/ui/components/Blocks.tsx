import { library, t as tr, type Block, type Formula } from '@/content';
import { CodeBlock } from './CodeBlock';
import { Figure } from '../labs/Figure';

/** Renders one authored content block. Unknown block types render nothing
 *  rather than throwing — content is data and may outrun the renderer. */
export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'paragraph':
      return <p>{tr(block.text)}</p>;

    case 'list':
      return (
        <ul className="blocklist">
          {block.items.map((item, i) => (
            <li key={i} className="blocklist__item">
              <span className="blocklist__marker" aria-hidden="true">
                {block.ordered ? `${i + 1}.` : '—'}
              </span>
              <span>{tr(item)}</span>
            </li>
          ))}
        </ul>
      );

    case 'callout':
      return (
        <aside className={`callout callout--${block.tone}`}>
          <div>
            {block.title ? <p className="callout__title">{tr(block.title)}</p> : null}
            <p className="callout__text">{tr(block.text)}</p>
          </div>
        </aside>
      );

    case 'termList':
      return (
        <ul className="termlist">
          {block.items.map((item, i) => (
            <li key={i} className="termlist__item">
              <p className="termlist__term">{tr(item.term)}</p>
              <p className="termlist__def">{tr(item.def)}</p>
            </li>
          ))}
        </ul>
      );

    case 'quote':
      return (
        <blockquote className="blockquote">
          <p>„{tr(block.text)}"</p>
          {block.attribution ? <p className="blockquote__attr">— {block.attribution}</p> : null}
        </blockquote>
      );

    case 'code':
      return <CodeBlock code={block.code} lang={block.lang} {...(block.caption ? { caption: tr(block.caption) } : {})} />;

    case 'formulaRef': {
      const formula = library.formulaById.get(block.formulaId);
      return formula ? <FormulaPanel formula={formula} /> : null;
    }

    case 'figure':
      return <Figure name={block.figure} {...(block.caption ? { caption: tr(block.caption) } : {})} />;

    default:
      return null;
  }
}

export function Blocks({ blocks }: { blocks: readonly Block[] }) {
  return (
    <div className="prose">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

/**
 * Full formula presentation: expression, every symbol with its unit, the
 * intuitive explanation and a worked example — the card shape the brief asked
 * for with F = ma.
 */
export function FormulaPanel({ formula, compact = false }: { formula: Formula; compact?: boolean }) {
  return (
    <div className="formula" id={`formula-${formula.id}`}>
      <p className="formula__name">{tr(formula.name)}</p>
      <div className="formula__expression mono">{formula.expression}</div>

      {!compact ? (
        <>
          <div>
            <p className="formula__label">სიმბოლოები</p>
            <ul className="formula__vars">
              {formula.variables.map((variable, i) => (
                <li key={i} className="formula__var">
                  <span className="formula__symbol">{variable.symbol}</span>
                  <span className="formula__meaning">
                    {tr(variable.meaning)}
                    {variable.unit ? <span className="formula__unit">{variable.unit}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="formula__label">რას ნიშნავს</p>
            <p className="formula__block">{tr(formula.explanation)}</p>
          </div>

          {formula.example ? (
            <div>
              <p className="formula__label">მაგალითი</p>
              <p className="formula__block">{tr(formula.example)}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
