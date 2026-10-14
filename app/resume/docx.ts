import { AlignmentType, Document, HeadingLevel, Packer, Paragraph } from 'docx';
import type { Outline } from './outline.ts';

export function renderDocx(outline: Outline): Promise<Blob> {
  const children = outline.map(
    ({ kind, text, section }) =>
      new Paragraph({
        text,
        ...(kind === 'person-name' || kind === 'contact-line'
          ? { alignment: AlignmentType.CENTER }
          : {}),
        ...(kind === 'person-name' ? { heading: HeadingLevel.HEADING_1 } : {}),
        ...(kind === 'section-title'
          ? { heading: HeadingLevel.HEADING_2, thematicBreak: true }
          : {}),
        ...(kind === 'job-heading' ||
        (kind === 'paragraph' && section === 'education')
          ? { heading: HeadingLevel.HEADING_3 }
          : {}),
        ...(kind === 'date-line' ? { italics: true } : {}),
        ...(kind === 'bullet' ? { bullet: { level: 0 } } : {}),
      }),
  );
  return Packer.toBlob(
    new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
            },
          },
          children,
        },
      ],
    }),
  );
}
