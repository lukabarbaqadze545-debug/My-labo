/**
 * A minimal PDF writer, for tests only.
 *
 * The ingestion pipeline's only impure step is "PDF bytes in, page text out".
 * Testing it needs real PDF bytes, and pulling in a PDF *generation* library
 * just for that would be a heavier dependency than the thing under test. This
 * emits the smallest valid PDF that carries text on numbered pages.
 *
 * WinAnsi only — enough for the Latin fixtures the extractor tests use.
 */

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** One page's worth of lines, drawn top-down. */
export interface PdfPageSpec {
  lines: string[];
}

export function makePdf(pages: PdfPageSpec[]): Uint8Array {
  const objects: string[] = [];
  const pageCount = pages.length;

  // Object numbering: 1 catalog, 2 pages, 3 font, then per page: page + content.
  const firstPageObj = 4;
  const kids = pages.map((_, i) => `${firstPageObj + i * 2} 0 R`).join(' ');

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  pages.forEach((page, i) => {
    const pageObj = firstPageObj + i * 2;
    const contentObj = pageObj + 1;

    const body =
      'BT\n/F1 11 Tf\n14 TL\n1 0 0 1 56 740 Tm\n' +
      page.lines.map((line) => `(${escapePdfText(line)}) Tj T*`).join('\n') +
      '\nET';

    objects[pageObj] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObj} 0 R >>`;
    objects[contentObj] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  });

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    const obj = objects[i];
    if (obj === undefined) continue;
    offsets[i] = out.length;
    out += `${i} 0 obj\n${obj}\nendobj\n`;
  }

  const xrefStart = out.length;
  const maxObj = objects.length;
  out += `xref\n0 ${maxObj}\n0000000000 65535 f \n`;
  for (let i = 1; i < maxObj; i++) {
    const offset = offsets[i] ?? 0;
    out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${maxObj} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
