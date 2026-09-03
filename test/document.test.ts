import { describe, expect, it } from 'vitest';
import {
  blankDoc,
  countWords,
  docFromText,
  normalize,
  plainText,
  readingMinutes,
  snippet,
  toMarkdown,
  type PMNode,
} from '@/domain/document';

const doc: PMNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'ჩემი გეგმა' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'ეს არის ', marks: [] },
        { type: 'text', text: 'მუქი', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' და ' },
        { type: 'text', text: 'ბმული', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'პირველი' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'მეორე' }] }] },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'დასრულებული' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'გასაკეთებელი' }] }],
        },
      ],
    },
    { type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'const x = 1;' }] },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ა' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ბ' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '2' }] }] },
          ],
        },
      ],
    },
  ],
};

describe('document helpers', () => {
  it('makes a valid blank document', () => {
    expect(blankDoc()).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('builds a document from plain text, splitting on blank lines', () => {
    const d = docFromText('one\n\ntwo');
    expect(d.content).toHaveLength(2);
    expect(plainText(d)).toBe('one\ntwo');
  });

  it('extracts plain text block by block', () => {
    const text = plainText(doc);
    expect(text.split('\n')[0]).toBe('ჩემი გეგმა');
    expect(text).toContain('ეს არის მუქი და ბმული.');
    expect(text).toContain('პირველი');
    expect(text).toContain('const x = 1;');
  });

  it('counts words and reading time', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('ერთი ორი სამი')).toBe(3);
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(50)).toBe(1);
    expect(readingMinutes(600)).toBe(3);
  });

  it('trims snippets', () => {
    expect(snippet('a  b\n\nc')).toBe('a b c');
    expect(snippet('x'.repeat(200), 10)).toHaveLength(10);
  });
});

describe('document normalisation', () => {
  const blocks = normalize(doc);

  it('flattens the tree into the block model', () => {
    expect(blocks.map((b) => b.kind)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'taskList',
      'codeBlock',
      'table',
    ]);
  });

  it('keeps inline marks and link hrefs', () => {
    const para = blocks[1];
    if (para?.kind !== 'paragraph') throw new Error('expected paragraph');
    const bold = para.inlines.find((i) => i.bold);
    const link = para.inlines.find((i) => i.href);
    expect(bold?.text).toBe('მუქი');
    expect(link?.href).toBe('https://example.com');
  });

  it('reads task checked state', () => {
    const tasks = blocks[3];
    if (tasks?.kind !== 'taskList') throw new Error('expected taskList');
    expect(tasks.items.map((i) => i.checked)).toEqual([true, false]);
  });

  it('reads table cells row by row', () => {
    const table = blocks[5];
    if (table?.kind !== 'table') throw new Error('expected table');
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1]!.map((c) => c.map((x) => x.text).join(''))).toEqual(['1', '2']);
  });

  it('returns nothing for a non-doc value', () => {
    expect(normalize(null)).toEqual([]);
    expect(normalize({ type: 'paragraph' })).toEqual([]);
  });
});

describe('markdown export', () => {
  const md = toMarkdown('ჩემი გეგმა', doc);

  it('starts with the title as an H1', () => {
    expect(md.startsWith('# ჩემი გეგმა')).toBe(true);
  });

  it('renders marks, lists, tasks, code and tables', () => {
    expect(md).toContain('**მუქი**');
    expect(md).toContain('[ბმული](https://example.com)');
    expect(md).toContain('- პირველი');
    expect(md).toContain('- [x] დასრულებული');
    expect(md).toContain('- [ ] გასაკეთებელი');
    expect(md).toContain('```js');
    expect(md).toContain('| ა | ბ |');
    expect(md).toContain('| --- | --- |');
  });
});
