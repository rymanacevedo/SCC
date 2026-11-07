/**
 * Renders untrusted text as literal Markdown data, so nothing in it can close
 * its container and become issue structure (headings, task lists, mentions).
 */

const BACKTICK = '`';
const BACKTICK_CODE = BACKTICK.charCodeAt(0);
/** CommonMark's shortest code fence. */
const MIN_FENCE_LENGTH = 3;
const MIN_CODE_SPAN_DELIMITER_LENGTH = 1;

/** The length of the longest run of backticks in `text`. */
function longestBacktickRun(text: string) {
  let longest = 0;
  let current = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === BACKTICK_CODE) {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return longest;
}

/**
 * A backtick run at least `minLength` long and longer than any backtick run in
 * `text`, so nothing in `text` can close a container it delimits.
 */
function backtickDelimiter(text: string, minLength: number) {
  return BACKTICK.repeat(Math.max(minLength, longestBacktickRun(text) + 1));
}

/**
 * `text` in a fenced code block whose fence is at least three backticks and
 * longer than any backtick run in `text`, so no line of it can close the fence.
 */
export function fencedBlock(text: string) {
  const fence = backtickDelimiter(text, MIN_FENCE_LENGTH);
  return `${fence}\n${text}\n${fence}`;
}

/** CRLF, CR, LF, NEL (U+0085), line separator (U+2028), paragraph separator (U+2029). */
const LINE_BREAK_PATTERN = /\r\n|[\r\n\u0085\u2028\u2029]/g;

/**
 * `text` on one line in an inline code span. Line breaks become spaces, so the
 * text cannot start a new Markdown line. The delimiter is longer than any
 * backtick run in `text`, and a space pads each side when `text` starts or
 * ends with a backtick, or starts and ends with a space that CommonMark would
 * otherwise strip. Empty text renders as a span holding one space.
 */
export function inlineCode(text: string) {
  // Two backticks alone are not a code span, so empty text becomes one space,
  // which CommonMark keeps because the content is all spaces.
  const line = text.replace(LINE_BREAK_PATTERN, ' ') || ' ';
  const delimiter = backtickDelimiter(line, MIN_CODE_SPAN_DELIMITER_LENGTH);
  const needsPadding =
    line.startsWith(BACKTICK) ||
    line.endsWith(BACKTICK) ||
    (line.startsWith(' ') && line.endsWith(' ') && line.trim() !== '');
  const padding = needsPadding ? ' ' : '';
  return `${delimiter}${padding}${line}${padding}${delimiter}`;
}
