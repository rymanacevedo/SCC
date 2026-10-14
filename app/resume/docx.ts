import { AlignmentType, Document, HeadingLevel, Packer, Paragraph } from 'docx';
import type { Block, Outline } from './outline.ts';

function paragraphOptions({ kind, text, section }: Block) {
  switch (kind) {
    case 'person-name':
      return {
        text,
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.HEADING_1,
      };
    case 'contact-line':
      return { text, alignment: AlignmentType.CENTER };
    case 'section-title':
      return { text, heading: HeadingLevel.HEADING_2, thematicBreak: true };
    case 'job-heading':
      return { text, heading: HeadingLevel.HEADING_3 };
    case 'paragraph':
      if (section === 'education')
        return { text, heading: HeadingLevel.HEADING_3 };
      return { text };
    case 'date-line':
      return { text, italics: true };
    case 'bullet':
      return { text, bullet: { level: 0 } };
    default:
      return { text };
  }
}

export function renderDocx(outline: Outline): Promise<Blob> {
  const children = outline.map(
    (block) => new Paragraph(paragraphOptions(block)),
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
