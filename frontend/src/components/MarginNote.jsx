export default function MarginNote({
  issue,
  active,
  acknowledged,
  refining,
  busy,
  onPoint,
  onRefine,
  onToggleAcknowledged,
}) {
  const classes = ['note', active && 'note--active', acknowledged && 'note--done'].filter(Boolean).join(' ');

  return (
    <li
      id={`note-${issue.id}`}
      className={classes}
      onMouseEnter={() => onPoint(issue.id)}
      onMouseLeave={() => onPoint(null)}
      onFocus={() => onPoint(issue.id)}
      onBlur={() => onPoint(null)}
    >
      <span className={`badge badge--${issue.severity.toLowerCase()}`}>{issue.severity}</span>
      <p className="note__problem">{issue.problem}</p>
      <p className="note__action">
        {acknowledged
          ? 'Still counted in the score. Check the paper again after editing it.'
          : issue.action}
      </p>
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
    </li>
  );
}
