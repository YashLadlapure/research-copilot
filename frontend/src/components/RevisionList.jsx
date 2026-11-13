import { useState } from 'react';
import { latestRevisions } from '../revisions';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="btn btn--secondary btn--small" onClick={copy}>
      {copied ? 'Copied' : 'Copy text'}
    </button>
  );
}

export default function RevisionList({ revisions }) {
  if (revisions.length === 0) {
    return (
      <div className="empty">
        <h3>No accepted revisions yet</h3>
        <p>Revisions you accept are kept here so you can copy them into your manuscript.</p>
      </div>
    );
  }

  return (
    <ul className="revision-list">
      {latestRevisions(revisions).map((revision) => (
        <li key={revision.section} className="revision-item">
          <div className="revision-item__head">
            <h3>{revision.section}</h3>
            <CopyButton text={revision.revisedText} />
          </div>
          {revision.changeSummary && <p className="revision__summary">{revision.changeSummary}</p>}
          <p className="revision-item__text">{revision.revisedText}</p>
        </li>
      ))}
    </ul>
  );
}
