// Several accepted revisions of one section collapse into a single entry
// running from the first original to the latest text.
export function latestRevisions(revisions) {
  const bySection = new Map();
  for (const revision of revisions) {
    const earlier = bySection.get(revision.section);
    bySection.set(revision.section, {
      ...revision,
      originalText: earlier ? earlier.originalText : revision.originalText,
    });
  }
  return [...bySection.values()];
}
