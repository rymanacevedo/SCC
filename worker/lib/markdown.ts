/**
 * Renders untrusted text as literal Markdown data, so nothing in it can close
 * its container and become issue structure (headings, task lists, mentions).
 */

/** The length of the longest run of backticks in `text`. */
function longestBacktickRun(text: string) {
  let longest = 0;
  let current = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 96) {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return longest;
}

/**
 * `text` in a fenced code block whose fence is at least three backticks and
 * longer than any backtick run in `text`, so no line of it can close the fence.
 */
export function fencedBlock(text: string) {
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(text) + 1));
  return `${fence}\n${text}\n${fence}`;
}

const LINE_BREAK_PATTERN = /\r\n|\r|\n/g;

/**
 * `text` on one line in an inline code span. Line breaks become spaces, so the
 * text cannot start a new Markdown line. The delimiter is longer than any
 * backtick run in `text`, and a space pads each side when `text` starts or
 * ends with a backtick, or starts and ends with a space that CommonMark would
 * otherwise strip.
 */
export function inlineCode(text: string) {
  const line = text.replace(LINE_BREAK_PATTERN, ' ');
  const delimiter = '`'.repeat(longestBacktickRun(line) + 1);
  const pad =
    line.startsWith('`') ||
    line.endsWith('`') ||
    (line.startsWith(' ') && line.endsWith(' ') && line.trim() !== '');
  const padding = pad ? ' ' : '';
  return `${delimiter}${padding}${line}${padding}${delimiter}`;
}
