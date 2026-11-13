function sectionLabel(section) {
  return section === 'document' ? 'Whole paper' : section;
}

function IssueCard({ issue, acknowledged, refining, canRefine, onRefine, onToggleAcknowledged }) {
  const severity = issue.severity.toLowerCase();

  return (
    <li className={`issue issue--${severity}${acknowledged ? ' issue--acknowledged' : ''}`}>
      <div className="issue__meta">
        <span className={`badge badge--${severity}`}>{issue.severity}</span>
        <span className="issue__section">{sectionLabel(issue.section)}</span>
      </div>
      <p className="issue__problem">{issue.problem}</p>
      <p className="issue__action">{issue.action}</p>

      {issue.manualOnly ? (
        <div className="issue__footer">
          <span className="issue__manual">Fix this in your own document.</span>
          <button type="button" className="link-button" onClick={() => onToggleAcknowledged(issue.id)}>
            {acknowledged ? 'Reopen' : 'Mark as done'}
          </button>
        </div>
      ) : (
        <div className="issue__footer">
          <button
            type="button"
            className="btn btn--secondary btn--small"
            onClick={() => onRefine(issue.section)}
            disabled={!canRefine}
          >
            {refining ? 'Revising…' : `Refine ${issue.section}`}
          </button>
        </div>
      )}
    </li>
  );
}

export default function IssueList({ issues, acknowledged, refiningSection, busy, onRefine, onToggleAcknowledged }) {
  if (issues.length === 0) {
    return (
      <div className="empty">
        <h3>No issues found</h3>
        <p>Every automated check passed. Work through the manual checklist before you submit.</p>
      </div>
    );
  }

  const open = issues.filter((issue) => !acknowledged.has(issue.id));
  const done = issues.filter((issue) => acknowledged.has(issue.id));

  const renderCard = (issue) => (
    <IssueCard
      key={issue.id}
      issue={issue}
      acknowledged={acknowledged.has(issue.id)}
      refining={refiningSection === issue.section && !issue.manualOnly}
      canRefine={!busy}
      onRefine={onRefine}
      onToggleAcknowledged={onToggleAcknowledged}
    />
  );

  return (
    <>
      <ul className="issue-list">{open.map(renderCard)}</ul>
      {done.length > 0 && (
        <>
          <h3 className="list-heading">Marked as done ({done.length})</h3>
          <p className="field-hint">
            These still count towards the score, because the app cannot see changes made in your own document.
            Check the manuscript again after editing it.
          </p>
          <ul className="issue-list">{done.map(renderCard)}</ul>
        </>
      )}
    </>
  );
}
