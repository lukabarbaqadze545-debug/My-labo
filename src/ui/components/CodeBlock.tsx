import { useMemo } from 'react';

/**
 * Syntax highlighting without a runtime library.
 *
 * A full highlighter would add ~200 KB and a network dependency for what the
 * content actually needs (Python and JavaScript snippets). This tokenises the
 * few constructs that matter and escapes everything, so it stays safe and works
 * offline.
 */

const KEYWORDS: Record<string, string[]> = {
  python: ['def', 'return', 'if', 'else', 'elif', 'while', 'for', 'in', 'not', 'and', 'or', 'None', 'True', 'False', 'import', 'from', 'pass', 'class', 'lambda'],
  javascript: ['function', 'return', 'if', 'else', 'for', 'while', 'const', 'let', 'var', 'async', 'await', 'try', 'catch', 'new', 'class', 'export', 'import', 'throw', 'null', 'undefined', 'true', 'false'],
};

interface Token {
  text: string;
  cls?: string;
}

function tokenize(code: string, lang: string): Token[] {
  const keywords = new Set(KEYWORDS[lang] ?? KEYWORDS.javascript ?? []);
  const tokens: Token[] = [];
  // Comments, strings, numbers, identifiers, everything else.
  const pattern = /(#[^\n]*|\/\/[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(code)) !== null) {
    if (match.index > last) tokens.push({ text: code.slice(last, match.index) });
    const [full, comment, str, num, ident] = match;
    if (comment) tokens.push({ text: full, cls: 'tok-com' });
    else if (str) tokens.push({ text: full, cls: 'tok-str' });
    else if (num) tokens.push({ text: full, cls: 'tok-num' });
    else if (ident) {
      if (keywords.has(ident)) tokens.push({ text: full, cls: 'tok-key' });
      else if (code[match.index + full.length] === '(') tokens.push({ text: full, cls: 'tok-fn' });
      else tokens.push({ text: full });
    }
    last = match.index + full.length;
  }
  if (last < code.length) tokens.push({ text: code.slice(last) });
  return tokens;
}

export function CodeBlock({ code, lang, caption }: { code: string; lang: string; caption?: string }) {
  const tokens = useMemo(() => tokenize(code, lang), [code, lang]);
  return (
    <figure className="codeblock">
      <div className="codeblock__head">
        <span className="codeblock__lang">{lang}</span>
        {caption ? <figcaption>{caption}</figcaption> : null}
      </div>
      <pre>
        <code>
          {tokens.map((token, i) =>
            token.cls ? (
              <span key={i} className={token.cls}>
                {token.text}
              </span>
            ) : (
              <span key={i}>{token.text}</span>
            ),
          )}
        </code>
      </pre>
    </figure>
  );
}
