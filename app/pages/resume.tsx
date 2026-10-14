import { type Handle, on } from 'remix/component';
import { StartOver } from '../builder/start-over.tsx';
import { downloadDocument } from '../resume/download.ts';
import type { Outline } from '../resume/outline.ts';
import { Preview } from '../resume/preview.tsx';
import { Alert } from '../ui/alert.tsx';
import { Button } from '../ui/button.tsx';
import { cardClass } from '../ui/card.tsx';
import { PageHeading } from '../ui/heading.tsx';

export interface ResumeProps {
  outline: Outline;
  error?: string;
}

export function ResumePage(handle: Handle<ResumeProps>) {
  let pending = false;
  let exportError = '';
  async function exportDocument(format: 'pdf' | 'docx') {
    if (pending) return;
    pending = true;
    exportError = '';
    void handle.update();
    try {
      const outline = handle.props.outline;
      let blob: Blob;
      if (format === 'pdf') {
        const { renderPdf } = await import('../resume/pdf.ts');
        blob = renderPdf(outline);
      } else {
        const { renderDocx } = await import('../resume/docx.ts');
        blob = await renderDocx(outline);
      }
      const name =
        outline
          .find((block) => block.kind === 'person-name')
          ?.text.replaceAll(' ', '_') || 'resume';
      downloadDocument(blob, `${name}_resume.${format}`);
    } catch {
      exportError = 'The Export could not be created. Please try again.';
    } finally {
      pending = false;
      void handle.update();
    }
  }
  return () => {
    const disabled = pending || !handle.props.outline.length;
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeading
          title="Preview"
          subtitle="Check your Resume, then export it as a PDF or Word document."
        />
        <div className="flex flex-wrap gap-4">
          <Button
            disabled={disabled}
            mix={on('click', () => exportDocument('pdf'))}
          >
            Export PDF
          </Button>
          <Button
            disabled={disabled}
            mix={on('click', () => exportDocument('docx'))}
          >
            Export DOCX
          </Button>
        </div>
        <p role="status" aria-live="polite" className="mt-2 mb-4 text-sm">
          {pending ? 'Creating Export…' : ''}
        </p>
        {exportError || handle.props.error ? (
          <div className="mb-4">
            <Alert tone="error">{exportError || handle.props.error}</Alert>
          </div>
        ) : null}
        <div className={cardClass('outlined', 'p-8')}>
          <Preview outline={handle.props.outline} />
        </div>
        <StartOver action="/resume" />
      </div>
    );
  };
}
