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
