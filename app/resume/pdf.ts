import { jsPDF } from 'jspdf';
import type { Section } from '../user.ts';
import type { Block, Outline } from './outline.ts';

function spacerHeight(section: Section): number {
  switch (section) {
    case 'info':
      return 7;
    case 'education':
      return 2;
    case 'summary':
    case 'skills':
      return 10;
    default:
      return 8;
  }
}

function textStyle({ kind, section }: Block) {
  switch (kind) {
    case 'person-name':
      return { fontSize: 22, fontStyle: 'bold', lineHeight: 8 };
    case 'section-title':
      return { fontSize: 14, fontStyle: 'bold', lineHeight: 7 };
    case 'job-heading':
      return { fontSize: 12, fontStyle: 'bold', lineHeight: 6 };
    case 'date-line':
      return { fontSize: 12, fontStyle: 'italic', lineHeight: 6 };
    default:
      return {
        fontSize: 12,
        fontStyle: 'normal',
        lineHeight: section === 'education' ? 6 : 5,
      };
  }
}

export function renderPdf(outline: Outline): Blob {
  const doc = new jsPDF();
  let y = 20;
  for (const block of outline) {
    const { kind, text, section } = block;
    if (kind === 'spacer') {
      y += spacerHeight(section);
      continue;
    }
    const { fontSize, fontStyle, lineHeight } = textStyle(block);
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);
    const centered = kind === 'person-name' || kind === 'contact-line';
    let x = 14;
    if (centered) x = doc.internal.pageSize.width / 2;
    else if (kind === 'bullet') x = 20;
    const lines: string[] = doc.splitTextToSize(
      text,
      kind === 'bullet' ? 174 : 180,
    );
    for (const [index, line] of lines.entries()) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      if (kind === 'bullet' && index === 0) doc.text('•', 14, y);
      doc.text(line, x, y, centered ? { align: 'center' } : {});
      y += lineHeight;
    }
    if (kind === 'bullet') y += 2;
  }
  return doc.output('blob');
}
