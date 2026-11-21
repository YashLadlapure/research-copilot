import { useEffect, useRef, useState } from 'react';
import Proof from './Proof';
import Tabs from './Tabs';
import RevisionList from './RevisionList';
import { CheckTable, ManualChecklist } from './ReportTables';

function scoreTone(score) {
  if (score >= 80) return 'good';
  if (score >= 50) return 'review';
  return 'critical';
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function issueCount(critical, review) {
  if (critical + review === 0) return 'No issues found.';
  if (critical === 0) return `${plural(review, 'issue')} to review.`;
  if (review === 0) return `${plural(critical, 'critical issue')}.`;
  return `${plural(critical, 'critical issue')} and ${review} to review.`;
}

function Summary({ report }) {
  const heading = useRef(null);
  const critical = report.issues.filter((issue) => issue.severity === 'Critical').length;
  const review = report.issues.length - critical;
  const passed = report.checks.filter((check) => check.passed).length;

  // The report replaces the form, so start keyboard and screen-reader users
  // at its first line.
  useEffect(() => {
    heading.current.focus({ preventScroll: true });
  }, []);

  return (
    <header className="summary">
      <h1 ref={heading} tabIndex={-1} className={`summary__score summary__score--${scoreTone(report.score)}`}>
        <span className="summary__value">{report.score}</span>
        <span className="summary__scale">out of 100 for {report.profile.name}</span>
      </h1>
      <p className="summary__meta">
        {issueCount(critical, review)} {passed} of {report.checks.length} automated checks passed.
      </p>
      <p className="summary__sum">
        100 − {critical} × 20 − {review} × 5. Layout is not scored; it is on the manual checklist.
      </p>
    </header>
  );
}

export default function ReportPanel({ analysis, revisions, onUndo, onDownload, undoing, ...proofProps }) {
  const [tab, setTab] = useState('paper');
  const { report, extraction } = analysis;
  const revisedSections = new Set(revisions.map((revision) => revision.section));

  const tabs = [
    { id: 'paper', label: 'Marked-up paper', count: report.issues.length },
    { id: 'checks', label: 'Checks', count: report.checks.length },
    { id: 'manual', label: 'Manual checklist' },
    { id: 'revisions', label: 'Revisions', count: revisedSections.size },
  ];

  return (
    <div className="report">
      <Summary report={report} />

      {extraction === 'rules' && (
        <p className="notice notice--info">
          Gemini was unavailable, so the title, abstract and keywords were located by rules alone. If any of them
          looks wrong, check that each has its own label in the text.
        </p>
      )}

      <Tabs options={tabs} value={tab} onChange={setTab} label="Report views" />

      <div role="tabpanel">
        {tab === 'paper' && <Proof analysis={analysis} revisedSections={revisedSections} {...proofProps} />}
        {tab !== 'paper' && (
          <div className="panel">
            {tab === 'checks' && <CheckTable checks={report.checks} />}
            {tab === 'manual' && <ManualChecklist items={report.manualChecks} profileName={report.profile.name} />}
            {tab === 'revisions' && (
              <RevisionList revisions={revisions} onUndo={onUndo} onDownload={onDownload} undoing={undoing} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
