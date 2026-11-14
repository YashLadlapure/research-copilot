import { countWords } from '../text';

function PreservationNote({ preservation, warnings }) {
  if (warnings.length > 0) {
    return (
      <div className="notice notice--warning" role="alert">
        <strong>Check before accepting</strong>
        <ul>
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (!preservation) return null;
  return (
    <p className="notice notice--ok">
      {preservation.checked === 0
        ? 'No numbers or citations in this section to verify.'
        : `All ${preservation.checked} numbers and citations from the original are present in the revision.`}
    </p>
  );
}

// Sits in the margin beside the section being revised. The proposed text is
// shown in the paper itself; this card explains it and takes the decision.
export default function RevisionCard({ refinement, applying, onAccept, onDiscard, onRetry }) {
  const { status, section, suggestion, error } = refinement;

  if (status === 'loading') {
    return (
      <div className="revision revision--loading">
        <div className="spinner" />
        <p>Revising the {section}…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="revision" role="alert">
        <h4 className="revision__title">The {section} could not be revised</h4>
        <p>{error}</p>
        <p>Your manuscript has not been changed.</p>
        <div className="button-row">
          <button type="button" className="btn btn--secondary btn--small" onClick={onRetry}>Try again</button>
          <button type="button" className="btn btn--ghost btn--small" onClick={onDiscard}>Close</button>
        </div>
      </div>
    );
  }

  const unchanged = suggestion.originalText.trim() === suggestion.revisedText.trim();
  const wordsBefore = countWords(suggestion.originalText);
  const wordsAfter = countWords(suggestion.revisedText);

  return (
    <div className="revision">
      <div className="revision__head">
        <h4 className="revision__title">Proposed revision</h4>
        <span className="revision__words">
          {wordsBefore === wordsAfter ? `${wordsAfter} words` : `${wordsBefore} → ${wordsAfter} words`}
        </span>
      </div>

      {unchanged ? (
        <p className="notice notice--ok">Gemini found nothing to change in this section.</p>
      ) : (
        <>
          {suggestion.changeSummary && <p className="revision__summary">{suggestion.changeSummary}</p>}
          <PreservationNote preservation={suggestion.preservation} warnings={suggestion.warnings} />
        </>
      )}

      <div className="button-row">
        {!unchanged && (
          <button type="button" className="btn btn--primary btn--small" onClick={onAccept} disabled={applying}>
            {applying ? 'Applying…' : 'Accept revision'}
          </button>
        )}
        <button type="button" className="btn btn--secondary btn--small" onClick={onDiscard} disabled={applying}>
          {unchanged ? 'Close' : 'Discard'}
        </button>
      </div>
      {!unchanged && (
        <p className="field-hint">
          Accepting replaces this section here and re-runs the checks. Copy the accepted text into your
          own document from the Revisions tab.
        </p>
      )}
    </div>
  );
}
