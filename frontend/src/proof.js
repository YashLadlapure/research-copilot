// Works out where each issue shows up in the paper: which phrases to mark in
// the text, and which section an issue's margin note sits beside.

const WORD_CHAR = /\w/;
const REFERENCE_START = /\n(?=\s*(?:\[\d+\]|\d{1,3}\.\s))/;

// A section body becomes paragraphs, with sub-heading lines kept apart so they
// can be set as headings. Reference lists are split per entry instead, because
// their lines are not separated by blank lines.
function toBlocks(section, subheadings) {
  if (section.name === 'references') {
    return section.body
      .split(REFERENCE_START)
      .map((entry) => ({ kind: 'entry', text: entry.replace(/\s+/g, ' ').trim() }))
      .filter((block) => block.text);
  }

  const blocks = [];
  let lines = [];
  const endParagraph = () => {
    if (lines.length > 0) blocks.push({ kind: 'paragraph', text: lines.join(' ') });
    lines = [];
  };

  for (const raw of section.body.split('\n')) {
    const line = raw.trim();
    if (!line) {
      endParagraph();
    } else if (subheadings.has(line)) {
      endParagraph();
      blocks.push({ kind: 'subheading', text: line });
    } else {
      lines.push(line);
    }
  }
  endParagraph();
  return blocks;
}

// "it's" must not match inside "merit's", nor "MQTT" inside "MQTTS".
function splitsWord(text, start, end) {
  const before = text[start - 1] ?? '';
  const after = text[end] ?? '';
  return (
    (WORD_CHAR.test(text[start]) && WORD_CHAR.test(before)) ||
    (WORD_CHAR.test(text[end - 1]) && WORD_CHAR.test(after))
  );
}

function findRanges(text, targets) {
  const ranges = [];
  for (const target of targets) {
    let from = 0;
    while (!(target.once && target.used)) {
      const start = text.indexOf(target.phrase, from);
      if (start === -1) break;
      const end = start + target.phrase.length;
      from = end;
      if (splitsWord(text, start, end)) continue;
      ranges.push({ start, end, issue: target.issue });
      target.used = true;
    }
  }
  return ranges.sort((a, b) => a.start - b.start || b.end - a.end);
}

// Splits text into plain strings and { text, issue } pieces for marked phrases.
function markText(text, targets) {
  const parts = [];
  let cursor = 0;
  for (const range of findRanges(text, targets)) {
    if (range.start < cursor) continue;
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push({ text: text.slice(range.start, range.end), issue: range.issue });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export function markUp(paper, issues) {
  const subheadings = new Set(paper.subheadings);
  const sections = paper.sections.map((section) => ({
    name: section.name,
    heading: section.heading,
    length: section.body.length,
    blocks: toBlocks(section, subheadings),
  }));
  const contains = (section, phrase) =>
    section.heading.includes(phrase) || section.blocks.some((block) => block.text.includes(phrase));

  // An issue raised against one section is marked wherever it occurs there.
  // Anything else is marked once, where the phrase first appears in the paper.
  const targets = issues.flatMap((issue) =>
    (issue.evidence || []).map((evidence) => {
      const phrase = evidence.replace(/\s+/g, ' ');
      const home = sections.findIndex((section) => section.name === issue.section && contains(section, phrase));
      return { phrase, issue, home, once: home === -1, used: false };
    }),
  );

  const anchors = new Map();
  const marked = sections.map((section, index) => {
    const wanted = targets.filter((target) =>
      target.once ? section.name !== 'references' : target.home === index,
    );
    const mark = (text) => {
      const parts = markText(text, wanted);
      for (const part of parts) {
        if (typeof part !== 'string' && !anchors.has(part.issue.id)) anchors.set(part.issue.id, index);
      }
      return parts;
    };
    const heading = mark(section.heading);
    const blocks = section.blocks.map((block) => ({ kind: block.kind, parts: mark(block.text) }));
    const hasMarks = [heading, ...blocks.map((block) => block.parts)].some((parts) =>
      parts.some((part) => typeof part !== 'string'),
    );
    return { name: section.name, length: section.length, heading, blocks, hasMarks, notes: [] };
  });

  // A note sits beside the first place its issue is marked, or beside the
  // section it names. Issues about the paper as a whole go at the top.
  const top = [];
  for (const issue of issues) {
    const index = anchors.get(issue.id) ?? sections.findIndex((section) => section.name === issue.section);
    (index === -1 ? top : marked[index].notes).push(issue);
  }

  return { top, sections: marked };
}
