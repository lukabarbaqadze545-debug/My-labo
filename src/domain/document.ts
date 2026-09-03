/**
 * Pure helpers for the writing room.
 *
 * The editor stores ProseMirror JSON. Everything downstream — previews, word
 * count, and the Word / PDF / PowerPoint exporters — goes through `normalize`,
 * which flattens that tree into a small, stable block model. Keeping it pure
 * means the exporters are testable without a browser or the editor.
 */

export interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  marks?: PMMark[];
  text?: string;
}

export function blankDoc(): PMNode {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function docFromText(text: string): PMNode {
  const paras = text.split(/\n{2,}/).map((chunk) => ({
    type: 'paragraph',
    content: chunk ? [{ type: 'text', text: chunk }] : undefined,
  }));
  return { type: 'doc', content: paras.length ? paras : [{ type: 'paragraph' }] };
}

/* -------------------------------- text -------------------------------- */

export function plainText(doc: unknown): string {
  const node = doc as PMNode | undefined;
  if (!node) return '';
  const lines: string[] = [];
  const blockTypes = new Set([
    'paragraph',
    'heading',
    'listItem',
    'taskItem',
    'blockquote',
    'codeBlock',
    'tableCell',
    'tableHeader',
  ]);

  const walk = (n: PMNode, buf: string[]): void => {
    if (n.type === 'text') {
      buf.push(n.text ?? '');
      return;
    }
    if (n.type === 'hardBreak') {
      buf.push('\n');
      return;
    }
    const isBlock = blockTypes.has(n.type);
    const local: string[] = isBlock ? [] : buf;
    for (const child of n.content ?? []) walk(child, local);
    if (isBlock) {
      const joined = local.join('').trim();
      if (joined) lines.push(joined);
    }
  };

  walk(node, []);
  return lines.join('\n');
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** ~200 wpm, rounded up, minimum 1 for any non-empty document. */
export function readingMinutes(words: number): number {
  return words === 0 ? 0 : Math.max(1, Math.round(words / 200));
}

export function snippet(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/* ----------------------------- block model ---------------------------- */

export interface Inline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
}

export type Align = 'left' | 'center' | 'right' | 'justify';

export type Block =
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'paragraph'; inlines: Inline[]; align?: Align }
  | { kind: 'bulletList' | 'orderedList'; items: Block[][] }
  | { kind: 'taskList'; items: { checked: boolean; content: Block[] }[] }
  | { kind: 'blockquote'; content: Block[] }
  | { kind: 'codeBlock'; text: string; language?: string }
  | { kind: 'horizontalRule' }
  | { kind: 'image'; src: string; alt?: string }
  | { kind: 'table'; rows: Inline[][][] };

function inlinesOf(node: PMNode): Inline[] {
  const out: Inline[] = [];
  for (const child of node.content ?? []) {
    if (child.type === 'hardBreak') {
      out.push({ text: '\n' });
      continue;
    }
    if (child.type !== 'text' || !child.text) continue;
    const marks = child.marks ?? [];
    const has = (t: string) => marks.some((m) => m.type === t);
    const link = marks.find((m) => m.type === 'link');
    out.push({
      text: child.text,
      ...(has('bold') ? { bold: true } : {}),
      ...(has('italic') ? { italic: true } : {}),
      ...(has('underline') ? { underline: true } : {}),
      ...(has('strike') ? { strike: true } : {}),
      ...(has('code') ? { code: true } : {}),
      ...(link && typeof link.attrs?.href === 'string' ? { href: link.attrs.href as string } : {}),
    });
  }
  return out;
}

function blocksOf(nodes: PMNode[]): Block[] {
  const out: Block[] = [];
  for (const node of nodes) out.push(...blockOf(node));
  return out;
}

function blockOf(node: PMNode): Block[] {
  switch (node.type) {
    case 'heading':
      return [
        {
          kind: 'heading',
          level: typeof node.attrs?.level === 'number' ? (node.attrs.level as number) : 1,
          inlines: inlinesOf(node),
        },
      ];
    case 'paragraph': {
      const align = node.attrs?.textAlign;
      const inlines = inlinesOf(node);
      if (inlines.length === 0) return [{ kind: 'paragraph', inlines: [] }];
      return [
        {
          kind: 'paragraph',
          inlines,
          ...(align && align !== 'left' ? { align: align as Align } : {}),
        },
      ];
    }
    case 'bulletList':
    case 'orderedList':
      return [
        {
          kind: node.type,
          items: (node.content ?? []).map((li) => blocksOf(li.content ?? [])),
        },
      ];
    case 'taskList':
      return [
        {
          kind: 'taskList',
          items: (node.content ?? []).map((li) => ({
            checked: li.attrs?.checked === true,
            content: blocksOf(li.content ?? []),
          })),
        },
      ];
    case 'blockquote':
      return [{ kind: 'blockquote', content: blocksOf(node.content ?? []) }];
    case 'codeBlock':
      return [
        {
          kind: 'codeBlock',
          text: (node.content ?? []).map((c) => c.text ?? '').join(''),
          ...(typeof node.attrs?.language === 'string' && node.attrs.language
            ? { language: node.attrs.language as string }
            : {}),
        },
      ];
    case 'horizontalRule':
      return [{ kind: 'horizontalRule' }];
    case 'image':
      return typeof node.attrs?.src === 'string'
        ? [
            {
              kind: 'image',
              src: node.attrs.src as string,
              ...(typeof node.attrs?.alt === 'string' ? { alt: node.attrs.alt as string } : {}),
            },
          ]
        : [];
    case 'table':
      return [
        {
          kind: 'table',
          rows: (node.content ?? []).map((row) =>
            (row.content ?? []).map((cell) => {
              const first = (cell.content ?? [])[0];
              return first ? inlinesOf(first) : [];
            }),
          ),
        },
      ];
    default:
      // Unknown wrapper — descend so nothing is silently dropped.
      return node.content ? blocksOf(node.content) : [];
  }
}

export function normalize(doc: unknown): Block[] {
  const node = doc as PMNode | undefined;
  if (!node || node.type !== 'doc') return [];
  return blocksOf(node.content ?? []);
}

/* ---------------------------- markdown / html --------------------------- */

function inlineMd(inlines: Inline[]): string {
  return inlines
    .map((i) => {
      let s = i.text;
      if (i.code) return `\`${s}\``;
      if (i.bold) s = `**${s}**`;
      if (i.italic) s = `*${s}*`;
      if (i.strike) s = `~~${s}~~`;
      if (i.href) s = `[${s}](${i.href})`;
      return s;
    })
    .join('');
}

export function toMarkdown(title: string, doc: unknown): string {
  const lines: string[] = [`# ${title}`, ''];
  const render = (blocks: Block[], indent = ''): void => {
    for (const b of blocks) {
      switch (b.kind) {
        case 'heading':
          lines.push(`${'#'.repeat(Math.min(6, b.level))} ${inlineMd(b.inlines)}`, '');
          break;
        case 'paragraph':
          lines.push(`${indent}${inlineMd(b.inlines)}`, '');
          break;
        case 'bulletList':
          b.items.forEach((item) => {
            lines.push(`${indent}- ${childInline(item)}`);
            render(nested(item), `${indent}  `);
          });
          lines.push('');
          break;
        case 'orderedList':
          b.items.forEach((item, n) => {
            lines.push(`${indent}${n + 1}. ${childInline(item)}`);
            render(nested(item), `${indent}  `);
          });
          lines.push('');
          break;
        case 'taskList':
          b.items.forEach((item) => lines.push(`${indent}- [${item.checked ? 'x' : ' '}] ${childInline(item.content)}`));
          lines.push('');
          break;
        case 'blockquote':
          b.content.forEach((c) => {
            if (c.kind === 'paragraph' || c.kind === 'heading') lines.push(`> ${inlineMd(c.inlines)}`);
          });
          lines.push('');
          break;
        case 'codeBlock':
          lines.push('```' + (b.language ?? ''), b.text, '```', '');
          break;
        case 'horizontalRule':
          lines.push('---', '');
          break;
        case 'image':
          lines.push(`![${b.alt ?? ''}](${b.src})`, '');
          break;
        case 'table':
          if (b.rows.length) {
            lines.push(`| ${b.rows[0]!.map((c) => inlineMd(c)).join(' | ')} |`);
            lines.push(`| ${b.rows[0]!.map(() => '---').join(' | ')} |`);
            b.rows.slice(1).forEach((r) => lines.push(`| ${r.map((c) => inlineMd(c)).join(' | ')} |`));
            lines.push('');
          }
          break;
      }
    }
  };
  const firstPara = (blocks: Block[]): Inline[] => {
    for (const b of blocks) if (b.kind === 'paragraph' || b.kind === 'heading') return b.inlines;
    return [];
  };
  const childInline = (blocks: Block[]) => inlineMd(firstPara(blocks));
  const nested = (blocks: Block[]) => blocks.filter((b) => b.kind === 'bulletList' || b.kind === 'orderedList');
  render(normalize(doc));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
