const BACKTICK = '`';
const BACKTICK_CODE = BACKTICK.charCodeAt(0);
const MIN_FENCE_LENGTH = 3;
const MIN_CODE_SPAN_DELIMITER_LENGTH = 1;

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

function backtickDelimiter(text: string, minLength: number) {
  return BACKTICK.repeat(Math.max(minLength, longestBacktickRun(text) + 1));
}

export function fencedBlock(text: string) {
  const fence = backtickDelimiter(text, MIN_FENCE_LENGTH);
  return `${fence}\n${text}\n${fence}`;
}

const LINE_BREAK_PATTERN = /\r\n|[\r\n\u0085\u2028\u2029]/g;

export function inlineCode(text: string) {
  const line = text.replace(LINE_BREAK_PATTERN, ' ') || ' ';
  const delimiter = backtickDelimiter(line, MIN_CODE_SPAN_DELIMITER_LENGTH);
  const needsPadding =
    line.startsWith(BACKTICK) ||
    line.endsWith(BACKTICK) ||
    (line.startsWith(' ') && line.endsWith(' ') && line.trim() !== '');
  const padding = needsPadding ? ' ' : '';
  return `${delimiter}${padding}${line}${padding}${delimiter}`;
}
