import { normalize, toMarkdown, type Block, type Inline } from '@/domain/document';

/**
 * Document exporters. The heavy format libraries (`docx`, `pptxgenjs`) are
 * dynamically imported so they land in their own chunks and only load when the
 * reader actually exports — keeping the initial bundle (and the PWA precache)
 * small.
 *
 * The `docx` / `pptxgenjs` builders are typed loosely on purpose: they are an
 * integration boundary whose object shapes are validated at runtime by the
 * libraries themselves, and their published types are far stricter than their
 * accepted inputs.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ExportFormat = 'docx' | 'pptx' | 'pdf' | 'md' | 'html';

function safeName(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
  return cleaned || 'დოკუმენტი';
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function inlineText(inlines: Inline[]): string {
  return inlines.map((i) => i.text).join('');
}

/* --------------------------------- text --------------------------------- */

export function exportMarkdown(title: string, doc: unknown): void {
  download(new Blob([toMarkdown(title, doc)], { type: 'text/markdown' }), `${safeName(title)}.md`);
}

function inlineHtml(inlines: Inline[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return inlines
    .map((i) => {
      if (i.text === '\n') return '<br/>';
      let s = esc(i.text);
      if (i.code) return `<code>${s}</code>`;
      if (i.bold) s = `<strong>${s}</strong>`;
      if (i.italic) s = `<em>${s}</em>`;
      if (i.underline) s = `<u>${s}</u>`;
      if (i.strike) s = `<s>${s}</s>`;
      if (i.href) s = `<a href="${esc(i.href)}">${s}</a>`;
      return s;
    })
    .join('');
}

function blocksHtml(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': {
        const lvl = Math.min(6, b.level);
        out.push(`<h${lvl}>${inlineHtml(b.inlines)}</h${lvl}>`);
        break;
      }
      case 'paragraph':
        out.push(`<p${b.align ? ` style="text-align:${b.align}"` : ''}>${inlineHtml(b.inlines) || '<br/>'}</p>`);
        break;
      case 'bulletList':
      case 'orderedList': {
        const tag = b.kind === 'bulletList' ? 'ul' : 'ol';
        out.push(`<${tag}>${b.items.map((it) => `<li>${blocksHtml(it)}</li>`).join('')}</${tag}>`);
        break;
      }
      case 'taskList':
        out.push(
          `<ul class="tasks">${b.items
            .map((it) => `<li>${it.checked ? '☑' : '☐'} ${blocksHtml(it.content)}</li>`)
            .join('')}</ul>`,
        );
        break;
      case 'blockquote':
        out.push(`<blockquote>${blocksHtml(b.content)}</blockquote>`);
        break;
      case 'codeBlock':
        out.push(`<pre><code>${b.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>`);
        break;
      case 'horizontalRule':
        out.push('<hr/>');
        break;
      case 'image':
        out.push(`<img src="${b.src}" alt="${b.alt ?? ''}"/>`);
        break;
      case 'table':
        out.push(
          `<table>${b.rows
            .map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c)}</td>`).join('')}</tr>`)
            .join('')}</table>`,
        );
        break;
    }
  }
  return out.join('\n');
}

export function exportHtml(title: string, doc: unknown): void {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<!doctype html>
<html lang="ka"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body{max-width:46rem;margin:3rem auto;padding:0 1.25rem;font:16px/1.7 'Noto Serif Georgian',Georgia,serif;color:#1b1a17}
  h1,h2,h3,h4{font-family:'Noto Sans Georgian',system-ui,sans-serif;line-height:1.3}
  h1{font-size:2rem} pre{background:#f4f1ea;padding:1rem;border-radius:8px;overflow:auto}
  code{font-family:ui-monospace,Menlo,monospace}
  blockquote{border-left:3px solid #c8bfad;margin:1rem 0;padding-left:1rem;color:#3f3d38}
  table{border-collapse:collapse;width:100%} td{border:1px solid #ddd6c8;padding:.4rem .6rem}
  img{max-width:100%} hr{border:none;border-top:1px solid #ddd6c8;margin:2rem 0}
  ul.tasks{list-style:none;padding-left:1rem}
</style></head>
<body><h1>${esc(title)}</h1>
${blocksHtml(normalize(doc))}
</body></html>`;
  download(new Blob([html], { type: 'text/html' }), `${safeName(title)}.html`);
}

/* ---------------------------------- pdf --------------------------------- */

/**
 * PDF goes through the browser's own print-to-PDF: it renders the actual
 * document markup, so Georgian type, pagination and selectable text all come
 * for free, offline, with zero bundle cost. The editor toggles `is-printing`
 * on <body> so only the document is on the page while the dialog is open.
 */
export function exportPdf(title: string): void {
  const previous = document.title;
  document.title = safeName(title);
  document.body.classList.add('is-printing');
  const cleanup = () => {
    document.body.classList.remove('is-printing');
    document.title = previous;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.setTimeout(() => {
    window.print();
    window.setTimeout(cleanup, 1000);
  }, 60);
}

/* --------------------------------- docx --------------------------------- */

export async function exportDocx(title: string, doc: unknown): Promise<void> {
  const d: any = await import('docx');
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    ExternalHyperlink,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    ImageRun,
    LevelFormat,
  } = d;

  const HEADINGS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];
  const ALIGN: Record<string, unknown> = {
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
    justify: AlignmentType.JUSTIFIED,
    left: AlignmentType.LEFT,
  };

  const runs = (inlines: Inline[]): any[] => {
    const out: any[] = [];
    for (const i of inlines) {
      if (i.text === '\n') {
        out.push(new TextRun({ break: 1 }));
        continue;
      }
      const base: any = {
        text: i.text,
        bold: i.bold,
        italics: i.italic,
        strike: i.strike,
        ...(i.underline ? { underline: {} } : {}),
        ...(i.code ? { font: 'Consolas' } : {}),
      };
      out.push(
        i.href
          ? new ExternalHyperlink({ children: [new TextRun({ ...base, style: 'Hyperlink' })], link: i.href })
          : new TextRun(base),
      );
    }
    return out;
  };

  const imageParagraph = async (src: string): Promise<any | null> => {
    try {
      const img = await loadImage(src);
      const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
      const maxW = 540;
      const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
      return new Paragraph({
        children: [
          new ImageRun({
            data: buf,
            type: src.includes('image/png') ? 'png' : 'jpg',
            transformation: {
              width: Math.round(img.naturalWidth * scale),
              height: Math.round(img.naturalHeight * scale),
            },
          }),
        ],
      });
    } catch {
      return null;
    }
  };

  const render = async (
    blocks: Block[],
    opts: { quote?: boolean; bullet?: number; ordered?: number } = {},
  ): Promise<any[]> => {
    const acc: any[] = [];
    for (const b of blocks) {
      switch (b.kind) {
        case 'heading':
          acc.push(
            new Paragraph({ heading: HEADINGS[Math.min(5, b.level - 1)], children: runs(b.inlines) }),
          );
          break;
        case 'paragraph':
          acc.push(
            new Paragraph({
              children: runs(b.inlines),
              ...(b.align ? { alignment: ALIGN[b.align] } : {}),
              ...(opts.quote ? { indent: { left: 480 }, style: 'IntenseQuote' } : {}),
              ...(typeof opts.bullet === 'number' ? { bullet: { level: opts.bullet } } : {}),
              ...(typeof opts.ordered === 'number'
                ? { numbering: { reference: 'ordered', level: opts.ordered } }
                : {}),
            }),
          );
          break;
        case 'bulletList':
          for (const item of b.items) acc.push(...(await render(item, { bullet: (opts.bullet ?? -1) + 1 })));
          break;
        case 'orderedList':
          for (const item of b.items) acc.push(...(await render(item, { ordered: (opts.ordered ?? -1) + 1 })));
          break;
        case 'taskList':
          for (const item of b.items) {
            const [first, ...rest] = item.content;
            acc.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `${item.checked ? '☒' : '☐'}  ` }),
                  ...(first && first.kind === 'paragraph' ? runs(first.inlines) : []),
                ],
              }),
            );
            acc.push(...(await render(rest)));
          }
          break;
        case 'blockquote':
          acc.push(...(await render(b.content, { quote: true })));
          break;
        case 'codeBlock':
          for (const line of b.text.split('\n')) {
            acc.push(
              new Paragraph({
                children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 20 })],
                shading: { fill: 'F2EEE3' },
              }),
            );
          }
          break;
        case 'horizontalRule':
          acc.push(
            new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C8BFAD' } } }),
          );
          break;
        case 'image': {
          const p = await imageParagraph(b.src);
          if (p) acc.push(p);
          break;
        }
        case 'table':
          acc.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: b.rows.map(
                (row) =>
                  new TableRow({
                    children: row.map(
                      (cell) => new TableCell({ children: [new Paragraph({ children: runs(cell) })] }),
                    ),
                  }),
              ),
            }),
          );
          acc.push(new Paragraph({ text: '' }));
          break;
      }
    }
    return acc;
  };

  const body = await render(normalize(doc));
  const document_ = new Document({
    numbering: {
      config: [
        {
          reference: 'ordered',
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title })] }),
          ...body,
        ],
      },
    ],
  });

  download(await Packer.toBlob(document_), `${safeName(title)}.docx`);
}

/* --------------------------------- pptx --------------------------------- */

export async function exportPptx(title: string, doc: unknown): Promise<void> {
  const mod: any = await import('pptxgenjs');
  const PptxGen = mod.default;
  const pptx = new PptxGen();
  pptx.layout = 'LAYOUT_WIDE';
  const ACCENT = '2E5AA8';
  const INK = '1B1A17';

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: 'F7F4EC' };
  titleSlide.addText(title || '(უსათაურო)', {
    x: 0.7,
    y: 2.2,
    w: 11.9,
    h: 1.6,
    fontSize: 40,
    bold: true,
    color: INK,
  });
  titleSlide.addText(new Date().toLocaleDateString('ka-GE'), {
    x: 0.7,
    y: 3.9,
    w: 8,
    h: 0.5,
    fontSize: 14,
    color: '6B6760',
  });

  type Line = { text: string; options: Record<string, unknown> };
  let slide: any = null;
  let contentSlides = 0;
  let lines: Line[] = [];
  let slideTitle = title || 'დოკუმენტი';

  const flush = () => {
    if (slide && lines.length) {
      slide.addText(
        lines.map((l) => ({ text: l.text, options: { breakLine: true, ...l.options } })),
        { x: 0.7, y: 1.6, w: 11.9, h: 5.4, fontSize: 18, color: INK, valign: 'top' },
      );
    }
    lines = [];
  };

  const newSlide = (heading: string) => {
    flush();
    slide = pptx.addSlide();
    contentSlides += 1;
    slide.addText(heading, { x: 0.7, y: 0.5, w: 11.9, h: 0.9, fontSize: 26, bold: true, color: ACCENT });
    slideTitle = heading;
  };

  const push = (text: string, options: Record<string, unknown> = {}) => {
    if (!slide) newSlide(slideTitle);
    if (lines.length >= 11) newSlide(`${slideTitle} (გაგრძელება)`);
    lines.push({ text, options });
  };

  const walk = (bs: Block[], indent = 0) => {
    for (const b of bs) {
      switch (b.kind) {
        case 'heading':
          if (b.level <= 2) newSlide(inlineText(b.inlines) || slideTitle);
          else push(inlineText(b.inlines), { bold: true, indentLevel: indent });
          break;
        case 'paragraph':
          if (inlineText(b.inlines).trim())
            push(inlineText(b.inlines), { indentLevel: indent, bullet: indent > 0 });
          break;
        case 'bulletList':
        case 'orderedList':
          b.items.forEach((item, n) => {
            const first = item.find((x) => x.kind === 'paragraph' || x.kind === 'heading');
            const prefix = b.kind === 'orderedList' ? `${n + 1}. ` : '';
            if (first && (first.kind === 'paragraph' || first.kind === 'heading'))
              push(prefix + inlineText(first.inlines), {
                bullet: b.kind === 'bulletList',
                indentLevel: indent,
              });
            walk(
              item.filter((x) => x.kind === 'bulletList' || x.kind === 'orderedList'),
              indent + 1,
            );
          });
          break;
        case 'taskList':
          b.items.forEach((item) => {
            const first = item.content.find((x) => x.kind === 'paragraph');
            if (first && first.kind === 'paragraph')
              push(`${item.checked ? '☑' : '☐'} ${inlineText(first.inlines)}`, { indentLevel: indent });
          });
          break;
        case 'blockquote':
          walk(b.content, indent);
          break;
        case 'codeBlock':
          push(b.text, { fontFace: 'Consolas', fontSize: 13, indentLevel: indent });
          break;
        case 'image':
          flush();
          if (!slide) newSlide(slideTitle);
          try {
            slide.addImage({ data: b.src, x: 1, y: 1.6, w: 8, h: 4.5, sizing: { type: 'contain', w: 8, h: 4.5 } });
          } catch {
            /* unsupported src */
          }
          break;
        case 'table':
          flush();
          if (!slide) newSlide(slideTitle);
          slide.addTable(
            b.rows.map((r) => r.map((c) => ({ text: inlineText(c) }))),
            { x: 0.7, y: 1.6, w: 11.9, fontSize: 12, border: { type: 'solid', pt: 1, color: 'DDD6C8' } },
          );
          break;
      }
    }
  };

  walk(normalize(doc));
  flush();
  if (contentSlides === 0) {
    titleSlide.addText('(ცარიელი დოკუმენტი)', { x: 0.7, y: 4.4, w: 8, h: 0.5, fontSize: 14, color: '6B6760' });
  }

  download((await pptx.write({ outputType: 'blob' })) as Blob, `${safeName(title)}.pptx`);
}
