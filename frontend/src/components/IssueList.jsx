function sectionLabel(section) {
  return section === 'document' ? 'Whole paper' : section.charAt(0).toUpperCase() + section.slice(1);
}

function IssueRow({ issue, acknowledged, refining, busy, onRefine, onToggleAcknowledged }) {
  const severity = issue.severity.toLowerCase();

  return (
    <li className={`issue${acknowledged ? ' issue--acknowledged' : ''}`}>
      <div className="issue__body">
        <p className="issue__meta">
          <span className={`badge badge--${severity}`}>{issue.severity}</span>
          <span className="issue__section">{sectionLabel(issue.section)}</span>
        </p>
        <p className="issue__problem">{issue.problem}</p>
        <p className="issue__action">{issue.action}</p>
      </div>
      <div className="issue__control">
        {issue.manualOnly ? (
          <button type="button" className="link-button" onClick={() => onToggleAcknowledged(issue.id)}>
            {acknowledged ? 'Reopen' : 'Mark as done'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--secondary btn--small"
            onClick={() => onRefine(issue.section)}
            disabled={busy}
            aria-label={`Refine ${issue.section}`}
          >
            {refining ? 'Revising…' : 'Refine'}
          </button>
        )}
      </div>
    </li>
  );
}

function IssueGroup({ title, hint, issues, ...rowProps }) {
  if (issues.length === 0) return null;
  return (
    <section className="issue-group">
      <h3 className="issue-group__title">
        {title} <span className="issue-group__count">{issues.length}</span>
      </h3>
      <p className="field-hint">{hint}</p>
      <ul className="issue-list">
        {issues.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            acknowledged={rowProps.acknowledged.has(issue.id)}
            refining={rowProps.refiningSection === issue.section && !issue.manualOnly}
            busy={rowProps.busy}
            onRefine={rowProps.onRefine}
            onToggleAcknowledged={rowProps.onToggleAcknowledged}
          />
        ))}
      </ul>
    </section>
  );
}

export default function IssueList({ issues, ...rowProps }) {
  if (issues.length === 0) {
    return (
      <div className="empty">
        <h3>No issues found</h3>
        <p>Every automated check passed. Work through the manual checklist before you submit.</p>
      </div>
    );
  }

  const { acknowledged } = rowProps;
  const open = issues.filter((issue) => !acknowledged.has(issue.id));

  return (
    <>
      <IssueGroup
        title="Can be refined here"
        hint="Wording and length problems. Gemini proposes a revision and you decide whether to keep it."
        issues={open.filter((issue) => !issue.manualOnly)}
        {...rowProps}
      />
      <IssueGroup
        title="Fix in your document"
        hint="Structure, references and formatting. These need changes only you can make."
        issues={open.filter((issue) => issue.manualOnly)}
        {...rowProps}
      />
      <IssueGroup
        title="Marked as done"
        hint="Still counted in the score, because the app cannot see edits made in your own document. Check the manuscript again after editing."
        issues={issues.filter((issue) => acknowledged.has(issue.id))}
        {...rowProps}
      />
    </>
  );
}
