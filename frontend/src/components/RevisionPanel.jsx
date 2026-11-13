import DiffView from './DiffView';
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

export default function RevisionPanel({ refinement, applying, onAccept, onDiscard, onRetry }) {
  const { status, section, suggestion, error } = refinement;

  if (status === 'idle') {
    return (
      <div className="empty">
        <h3>No revision open</h3>
        <p>
          Choose <em>Refine</em> on an issue or a section. The proposed text appears here next to the
          original, and nothing changes until you accept it.
        </p>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="empty" aria-live="polite">
        <div className="spinner" />
        <p>Revising the {section}…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="empty" role="alert">
        <h3>The {section} could not be revised</h3>
        <p>{error}</p>
        <p>Your manuscript has not been changed.</p>
        <div className="button-row">
          <button type="button" className="btn btn--secondary" onClick={onRetry}>Try again</button>
          <button type="button" className="btn btn--ghost" onClick={onDiscard}>Close</button>
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
        <h3 className="revision__section">{suggestion.section}</h3>
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
          <DiffView original={suggestion.originalText} revised={suggestion.revisedText} />
        </>
      )}

      <div className="button-row">
        {!unchanged && (
          <button type="button" className="btn btn--primary" onClick={onAccept} disabled={applying}>
            {applying ? 'Applying…' : 'Accept revision'}
          </button>
        )}
        <button type="button" className="btn btn--secondary" onClick={onDiscard} disabled={applying}>
          {unchanged ? 'Close' : 'Discard'}
        </button>
      </div>
      <p className="field-hint">
        Accepting replaces this section in the session and re-runs the checks. Copy the accepted text
        back into your own document from the Revisions tab.
      </p>
    </div>
  );
}
