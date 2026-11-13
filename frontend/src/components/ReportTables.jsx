export function CheckTable({ checks }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Check</th>
            <th scope="col">Expected</th>
            <th scope="col">Found</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <th scope="row">{check.label}</th>
              <td>{check.expected}</td>
              <td>{check.observed}</td>
              <td>
                <span className={`badge badge--${check.passed ? 'good' : 'review'}`}>{check.passed ? 'Pass' : 'Fail'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionList({ sections, revisedSections, refiningSection, busy, onRefine }) {
  return (
    <ul className="section-list">
      {sections.map((section) => {
        const canRefine = section.present && !section.refineBlocker;
        return (
          <li key={section.name} className="section-row">
            <div className="section-row__main">
              <span className="section-row__name">{section.name}</span>
              <span className="section-row__detail">
                {section.present ? `${section.words.toLocaleString()} words` : 'Not found'}
                {section.required ? ' · required' : ''}
                {revisedSections.has(section.name) ? ' · revised' : ''}
              </span>
              {section.present && section.refineBlocker && section.name !== 'title' && (
                <span className="section-row__detail">{section.refineBlocker}</span>
              )}
            </div>
            <span className={`badge badge--${section.status.toLowerCase()}`}>{section.status}</span>
            {canRefine ? (
              <button
                type="button"
                className="btn btn--secondary btn--small"
                onClick={() => onRefine(section.name)}
                disabled={busy}
                aria-label={`Refine ${section.name}`}
              >
                {refiningSection === section.name ? 'Revising…' : 'Refine'}
              </button>
            ) : (
              <span className="section-row__spacer" />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ManualChecklist({ items, profileName }) {
  return (
    <>
      <p className="field-hint">
        These {profileName} rules concern layout, which cannot be read from plain text. Check each one in the
        formatted document.
      </p>
      <ul className="checklist">
        {items.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.rule}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
