import { useState } from 'react';
import IssueList from './IssueList';
import Tabs from './Tabs';
import RevisionList from './RevisionList';
import { CheckTable, SectionList, ManualChecklist } from './ReportTables';

function scoreTone(score) {
  if (score >= 80) return 'good';
  if (score >= 50) return 'review';
  return 'critical';
}

function Summary({ report, title, onExport }) {
  const critical = report.issues.filter((issue) => issue.severity === 'Critical').length;
  const review = report.issues.length - critical;
  const passed = report.checks.filter((check) => check.passed).length;

  return (
    <div className="summary">
      <div className={`summary__score summary__score--${scoreTone(report.score)}`}>
        <span className="summary__value">{report.score}</span>
        <span className="summary__scale">/ 100</span>
      </div>
      <div className="summary__body">
        <p className="summary__title">{title || 'Untitled manuscript'}</p>
        <p className="summary__meta">
          {report.profile.name} · {passed} of {report.checks.length} automated checks passed
        </p>
        <p className="summary__counts">
          <span className="badge badge--critical">{critical} critical</span>
          <span className="badge badge--review">{review} to review</span>
        </p>
      </div>
      <button type="button" className="btn btn--secondary btn--small summary__export" onClick={onExport}>
        Print or save report
      </button>
    </div>
  );
}

export default function ReportPanel({
  analysis,
  revisions,
  acknowledged,
  refiningSection,
  busy,
  onRefine,
  onToggleAcknowledged,
  onExport,
}) {
  const [tab, setTab] = useState('issues');
  const { report, title, extraction } = analysis;
  const revisedSections = new Set(revisions.map((revision) => revision.section));

  const tabs = [
    { id: 'issues', label: 'Issues', count: report.issues.length },
    { id: 'sections', label: 'Sections' },
    { id: 'checks', label: 'Checks' },
    { id: 'manual', label: 'Manual checklist' },
    { id: 'revisions', label: 'Revisions', count: revisedSections.size },
  ];

  return (
    <div className="report">
      <Summary report={report} title={title} onExport={onExport} />

      <p className="field-hint">
        The score starts at 100 and loses 20 for each critical issue and 5 for each issue to review. It covers
        what can be read from the text; layout is on the manual checklist.
      </p>
      {extraction === 'rules' && (
        <p className="notice notice--info">
          Gemini was unavailable, so the title, abstract and keywords were located by rules alone. If any of them
          looks wrong, check that each has its own label in the text.
        </p>
      )}

      <Tabs options={tabs} value={tab} onChange={setTab} label="Report sections" />

      <div role="tabpanel">
        {tab === 'issues' && (
          <IssueList
            issues={report.issues}
            acknowledged={acknowledged}
            refiningSection={refiningSection}
            busy={busy}
            onRefine={onRefine}
            onToggleAcknowledged={onToggleAcknowledged}
          />
        )}
        {tab === 'sections' && (
          <SectionList
            sections={report.sections}
            revisedSections={revisedSections}
            refiningSection={refiningSection}
            busy={busy}
            onRefine={onRefine}
          />
        )}
        {tab === 'checks' && <CheckTable checks={report.checks} />}
        {tab === 'manual' && <ManualChecklist items={report.manualChecks} profileName={report.profile.name} />}
        {tab === 'revisions' && <RevisionList revisions={revisions} />}
      </div>
    </div>
  );
}
