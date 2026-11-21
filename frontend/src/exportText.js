// The paper as plain text, with every accepted revision already in place.
// Built from the parsed document, so it carries the section text the checks
// ran on rather than the original layout.
export function manuscriptText(title, document) {
  const lines = [title, ...document.byline, ''];
  for (const section of document.sections) {
    if (section.name === 'keywords') {
      lines.push(`${section.heading}: ${section.body}`, '');
    } else {
      lines.push(section.heading, section.body, '');
    }
  }
  return `${lines.join('\n').trim()}\n`;
}

export function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function fileName(title) {
  const full = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Cut long titles at a word, not mid-word.
  const slug = full.length > 60 ? full.slice(0, 61).replace(/-[^-]*$/, '') : full;
  return `${slug || 'manuscript'}-revised.txt`;
}
