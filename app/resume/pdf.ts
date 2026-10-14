import { jsPDF } from 'jspdf';
import type { Outline } from './outline.ts';

export function renderPdf(outline: Outline): Blob {
  const doc = new jsPDF();
  let y = 20;
  for (const { kind, text, section } of outline) {
    if (kind === 'spacer') {
      y +=
        section === 'info'
          ? 7
          : section === 'education'
            ? 2
            : section === 'summary' || section === 'skills'
              ? 10
              : 8;
      continue;
    }
    doc.setFontSize(
      kind === 'person-name' ? 22 : kind === 'section-title' ? 14 : 12,
    );
    doc.setFont(
      'helvetica',
      ['person-name', 'section-title', 'job-heading'].includes(kind)
        ? 'bold'
        : kind === 'date-line'
          ? 'italic'
          : 'normal',
    );
    const centered = kind === 'person-name' || kind === 'contact-line';
    const lines: string[] = doc.splitTextToSize(
      text,
      kind === 'bullet' ? 174 : 180,
    );
    for (let index = 0; index < lines.length; index++) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      if (kind === 'bullet' && index === 0) doc.text('•', 14, y);
      doc.text(
        lines[index]!,
        centered
          ? doc.internal.pageSize.width / 2
          : kind === 'bullet'
            ? 20
            : 14,
        y,
        centered ? { align: 'center' } : {},
      );
      y +=
        kind === 'person-name'
          ? 8
          : kind === 'section-title'
            ? 7
            : kind === 'job-heading' ||
                kind === 'date-line' ||
                section === 'education'
              ? 6
              : 5;
    }
    if (kind === 'bullet') y += 2;
  }
  return doc.output('blob');
}
