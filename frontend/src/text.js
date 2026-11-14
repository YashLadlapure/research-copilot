export function countWords(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// PDF text is hard-wrapped at the page width. Joining those lines lets the
// text reflow on screen while blank lines still separate paragraphs.
export function reflow(text) {
  return text.replace(/([^\n])\n(?!\n)/g, '$1 ');
}
