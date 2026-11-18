import { useMemo, useRef, useState } from 'react';
import { markUp } from '../proof';
import { useMarginLayout } from '../useMarginLayout';
import DiffView from './DiffView';
import MarginNote from './MarginNote';
import RevisionCard from './RevisionCard';

// Sections longer than this are shown clipped until opened, unless they hold
// something the reader needs to see.
const LONG_SECTION_CHARS = 2400;

function showNote(issueId) {
  document.getElementById(`note-${issueId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function Marked({ parts, linking }) {
  return parts.map((part, index) => {
    if (typeof part === 'string') return part;
    const { id, severity } = part.issue;
    const classes = [
      'mark',
      `mark--${severity.toLowerCase()}`,
      linking.active === id && 'mark--active',
      linking.acknowledged.has(id) && 'mark--done',
    ];
    return (
      <mark
        key={index}
        className={classes.filter(Boolean).join(' ')}
        onMouseEnter={() => linking.onPoint(id)}
        onMouseLeave={() => linking.onPoint(null)}
        onClick={() => showNote(id)}
      >
        {part.text}
      </mark>
    );
  });
}

function Notes({ label, order, issues, linking, noteActions, children }) {
  if (issues.length === 0 && !children) return null;
  return (
    <aside className="notes" aria-label={label} style={{ '--order': order }}>
      {children}
      {issues.length > 0 && (
        <ul className="notes__list">
          {issues.map((issue) => (
            <MarginNote
              key={issue.id}
              issue={issue}
              active={linking.active === issue.id}
              acknowledged={linking.acknowledged.has(issue.id)}
              refining={noteActions.refiningSection === issue.section && !issue.manualOnly}
              busy={noteActions.busy}
              onPoint={linking.onPoint}
              onRefine={noteActions.onRefine}
              onToggleAcknowledged={noteActions.onToggleAcknowledged}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

function Section({ section, order, summary, revised, refinement, linking, noteActions, revisionActions }) {
  const [open, setOpen] = useState(false);
  const revising = refinement !== null;
  const suggestion = refinement?.suggestion;
  const showDiff = suggestion && suggestion.originalText.trim() !== suggestion.revisedText.trim();

  const long = section.length > LONG_SECTION_CHARS && !section.hasMarks && !revising;
  const canRefine = summary && !summary.refineBlocker;
  const tooLong = summary?.refineBlocker && section.name !== 'references' && summary.words > 0;

  return (
    <section className="sheet__section" aria-busy={refinement?.status === 'loading'}>
      <div className="sheet__heading-row">
        <h3 className="sheet__heading">
          <Marked parts={section.heading} linking={linking} />
        </h3>
        <p className="sheet__tools">
          {summary && <span>{summary.words.toLocaleString()} words</span>}
          {revised && <span>revised</span>}
          {canRefine && (
            <button
              type="button"
              className="link-button"
              onClick={() => noteActions.onRefine(section.name)}
              disabled={noteActions.busy}
              aria-label={`Refine ${section.name}`}
            >
              Refine
            </button>
          )}
          {tooLong && <span>too long to refine in one pass</span>}
        </p>
      </div>

      {showDiff ? (
        <DiffView original={suggestion.originalText} revised={suggestion.revisedText} />
      ) : (
        <div className={`sheet__body${long && !open ? ' sheet__body--clipped' : ''}`}>
          {section.blocks.map((block, index) =>
            block.kind === 'subheading' ? (
              <h4 key={index} className="sheet__subheading">
                <Marked parts={block.parts} linking={linking} />
              </h4>
            ) : (
              <p key={index} className={block.kind === 'entry' ? 'sheet__entry' : undefined}>
                <Marked parts={block.parts} linking={linking} />
              </p>
            ),
          )}
        </div>
      )}
      {long && (
        <button type="button" className="link-button sheet__more" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Show less' : 'Show the whole section'}
        </button>
      )}

      <Notes
        label={`Notes on the ${section.name}`}
        order={order}
        issues={section.notes}
        linking={linking}
        noteActions={noteActions}
      >
        {revising && <RevisionCard refinement={refinement} {...revisionActions} />}
      </Notes>
    </section>
  );
}

function announcement({ status, section }) {
  if (status === 'loading') return `Revising the ${section}.`;
  if (status === 'ready') return `A revision of the ${section} is ready to review.`;
  if (status === 'error') return `The ${section} could not be revised.`;
  return '';
}

// The paper set as a page, with every issue marked where it occurs and its
// note in the margin beside it.
export default function Proof({
  analysis,
  acknowledged,
  revisedSections,
  refinement,
  applying,
  onRefine,
  onAccept,
  onDiscard,
  onRetry,
  onToggleAcknowledged,
}) {
  const { title, document: paper, report } = analysis;
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const visible = useMemo(
    () =>
      report.issues.filter(
        (issue) => (!criticalOnly || issue.severity === 'Critical') && !(hideDone && acknowledged.has(issue.id)),
      ),
    [report.issues, criticalOnly, hideDone, acknowledged],
  );
  const marked = useMemo(() => markUp(paper, visible), [paper, visible]);
  const [active, setActive] = useState(null);
  const root = useRef(null);
  useMarginLayout(root);

  const refining = refinement.status === 'loading';
  const linking = { active, acknowledged, onPoint: setActive };
  const noteActions = {
    refiningSection: refining ? refinement.section : null,
    busy: refining || applying,
    onRefine,
    onToggleAcknowledged,
  };
  const revisionActions = { applying, onAccept, onDiscard, onRetry };
  const summaries = new Map(report.sections.map((section) => [section.name, section]));

  return (
    <>
      {report.issues.length > 0 && (
        <div className="filters" role="group" aria-label="Filter issues">
          <button type="button" className="chip" aria-pressed={criticalOnly} onClick={() => setCriticalOnly(!criticalOnly)}>
            Critical only
          </button>
          <button type="button" className="chip" aria-pressed={hideDone} onClick={() => setHideDone(!hideDone)}>
            Hide marked as done
          </button>
          <span className="filters__count" aria-live="polite">
            Showing {visible.length} of {report.issues.length} issues
          </span>
        </div>
      )}

      <div ref={root} className="proof">
      <p className="visually-hidden" role="status">{announcement(refinement)}</p>

      <article className="sheet" aria-label="Manuscript">
        <header className="sheet__front">
          <h2 className="sheet__title">{title || 'Untitled manuscript'}</h2>
          {paper.byline.map((line) => (
            <p key={line} className="sheet__byline">{line}</p>
          ))}
          <Notes label="Notes on the whole paper" order={0} issues={marked.top} linking={linking} noteActions={noteActions}>
            {report.issues.length > 0 && visible.length === 0 && (
              <div className="revision">
                <h4 className="revision__title">No issues match this filter</h4>
                <p>Turn a filter off to see the rest.</p>
              </div>
            )}
            {report.issues.length === 0 && (
              <div className="revision">
                <h4 className="revision__title">No issues found</h4>
                <p>Every automated check passed. Work through the manual checklist before you submit.</p>
              </div>
            )}
          </Notes>
        </header>

        {marked.sections.map((section, index) => (
          <Section
            key={`${section.name}-${index}`}
            section={section}
            order={index + 1}
            summary={summaries.get(section.name)}
            revised={revisedSections.has(section.name)}
            refinement={refinement.status !== 'idle' && refinement.section === section.name ? refinement : null}
            linking={linking}
            noteActions={noteActions}
            revisionActions={revisionActions}
          />
        ))}
      </article>
      </div>
    </>
  );
}
