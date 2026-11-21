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

export default function RevisionList({ revisions, onUndo, onDownload, undoing }) {
  if (revisions.length === 0) {
    return (
      <div className="empty">
        <h3>No accepted revisions yet</h3>
        <p>Revisions you accept are kept here so you can copy them into your manuscript.</p>
      </div>
    );
  }

  return (
    <>
      <div className="revision-list__head">
        <p>Accepted revisions are already in the paper. Download it to keep a copy with every change in place.</p>
        <button type="button" className="btn btn--primary btn--small" onClick={onDownload}>
          Download revised paper
        </button>
      </div>
      <ul className="revision-list">
        {latestRevisions(revisions).map((revision) => (
          <li key={revision.section} className="revision-item">
            <div className="revision-item__head">
              <h3>{revision.section}</h3>
              <div className="revision-item__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => onUndo(revision.section)}
                  disabled={undoing !== null}
                >
                  {undoing === revision.section ? 'Undoing…' : 'Undo'}
                </button>
                <CopyButton text={revision.revisedText} />
              </div>
            </div>
            {revision.changeSummary && <p className="revision__summary">{revision.changeSummary}</p>}
            <p className="revision-item__text">{revision.revisedText}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
