import type { Handle } from 'remix/component';
import { TextLink } from '../ui/link.tsx';
import type { Block, Outline } from './outline.ts';

const editPaths = {
  info: '/info',
  experience: '/experience-summary',
  education: '/education-summary',
  skills: '/skills',
  summary: '/summary',
};
function PreviewBlock(handle: Handle<{ block: Block }>) {
  return () => {
    const { kind, text } = handle.props.block;
    switch (kind) {
      case 'person-name':
        return (
          <h1 className="text-2xl font-bold text-center my-4 dark:text-white text-gray-900">
            {text}
          </h1>
        );
      case 'section-title':
        return (
          <h2 className="text-xl font-semibold dark:text-white text-gray-900">
            {text}
          </h2>
        );
      case 'job-heading':
        return (
          <h3 className="text-lg font-semibold dark:text-white text-gray-900">
            {text}
          </h3>
        );
      case 'contact-line':
        return <p className="text-center my-2 leading-normal">{text}</p>;
      case 'spacer':
        return (
          <p className="my-2 leading-normal" aria-hidden="true">
            <br />
          </p>
        );
      default:
        return (
          <p className="my-2 leading-normal whitespace-pre-wrap">
            {kind === 'bullet' ? '• ' : ''}
            {text}
          </p>
        );
    }
  };
}
export function Preview(handle: Handle<{ outline: Outline }>) {
  return () => (
    <article aria-label="Resume Preview">
      {handle.props.outline.map((block, index, blocks) => (
        <div>
          {blocks[index - 1]?.section !== block.section && (
            <div className="flex justify-end">
              <TextLink href={editPaths[block.section]}>
                Edit{' '}
                {block.section === 'info'
                  ? 'Info'
                  : block.section.charAt(0).toUpperCase() +
                    block.section.slice(1)}
              </TextLink>
            </div>
          )}
          <PreviewBlock block={block} />
        </div>
      ))}
    </article>
  );
}
