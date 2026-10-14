import { type Handle, on } from 'remix/component';
import { StartOver } from '../builder/start-over.tsx';
import { downloadDocument } from '../resume/download.ts';
import type { Outline } from '../resume/outline.ts';
import { Preview } from '../resume/preview.tsx';
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
      const blob =
        format === 'pdf'
          ? (await import('../resume/pdf.ts')).renderPdf(outline)
          : await (await import('../resume/docx.ts')).renderDocx(outline);
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
  return () => (
    <div>
      <h1>Preview</h1>
      <div className="flex gap-4">
        <button
          type="button"
          disabled={pending || !handle.props.outline.length}
          mix={on('click', () => exportDocument('pdf'))}
        >
          Export PDF
        </button>
        <button
          type="button"
          disabled={pending || !handle.props.outline.length}
          mix={on('click', () => exportDocument('docx'))}
        >
          Export DOCX
        </button>
      </div>
      <p role="status" aria-live="polite">
        {pending ? 'Creating Export…' : exportError}
      </p>
      {handle.props.error && <p role="alert">{handle.props.error}</p>}
      <Preview outline={handle.props.outline} />
      <StartOver action="/resume" />
    </div>
  );
}
