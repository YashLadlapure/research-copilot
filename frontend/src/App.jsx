import { useState } from 'react';
import './App.css';
import { analyzeManuscript, refineSection, applySuggestion, extractPdf } from './api';

const PROFILES = [
  { value: 'lncs', label: 'Springer LNCS' },
  { value: 'ieee', label: 'IEEE Conference' },
];

const REFINE_MODES = [
  { value: 'strict', label: 'Strict (preferred)', desc: 'Grammar and formatting only' },
  { value: 'balanced', label: 'Balanced', desc: 'Clarity, flow, and structure' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Full academic polish' },
];

const SEVERITY_COLOR = {
  Critical: '#ef4444',
  Review: '#f59e0b',
  Good: '#22c55e',
};

const NON_REFINABLE = ['references', 'bibliography'];

const DASHBOARD_TABS = ['Overview', 'Structure', 'Language', 'AI Disclosure'];

function scoreColor(score) {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function scoreSubtitle(score, issues) {
  if (!issues || issues.length === 0) return 'No issues detected — ready for submission.';
  const critical = issues.filter(i => i.severity === 'Critical');
  const review = issues.filter(i => i.severity === 'Review');
  if (score >= 80) return `Strong draft${critical.length ? `, needs ${critical.map(i => i.section).join(' and ')} cleanup` : ''}.`;
  if (score >= 60) return `Good structure, ${critical.length} critical issue${critical.length > 1 ? 's' : ''} to resolve.`;
  return `${critical.length} critical and ${review.length} review issues found.`;
}

function getActionButtons(issue, onRefine, loading) {
  const sec = (issue.section || '').toLowerCase();
  const canRefine = !NON_REFINABLE.includes(sec);

  if (sec === 'abstract') return (
    <div className="issue-actions">
      {canRefine && <button className="action-btn" onClick={() => onRefine(issue.section)} disabled={loading}>Shorten abstract</button>}
      <button className="action-btn action-btn--ghost" onClick={() => onRefine(issue.section)} disabled={loading || !canRefine}>Show rationale</button>
    </div>
  );
  if (sec === 'keywords') return (
    <div className="issue-actions">
      {canRefine && <button className="action-btn" onClick={() => onRefine(issue.section)} disabled={loading}>Suggest keywords</button>}
    </div>
  );
  if (!canRefine) return null;
  return (
    <div className="issue-actions">
      <button className="action-btn" onClick={() => onRefine(issue.section)} disabled={loading}>Refine section</button>
    </div>
  );
}

export default function App() {
  const [text, setText] = useState('');
  const [profile, setProfile] = useState('lncs');
  const [refineMode, setRefineMode] = useState('strict');
  const [paperTitle, setPaperTitle] = useState('');
  const [journalNotes, setJournalNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');

  const [sessionId, setSessionId] = useState(null);
  const [structured, setStructured] = useState(null);
  const [report, setReport] = useState(null);
  const [revisedSections, setRevisedSections] = useState({});

  const [selectedSection, setSelectedSection] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    setStructured(null);
    setSessionId(null);
    setSuggestion(null);
    setSelectedSection(null);
    setActiveTab('Overview');
    try {
      const data = await analyzeManuscript(text, profile);
      setSessionId(data.sessionId);
      setStructured(data.structuredManuscript);
      setReport(data.complianceReport);
      setRevisedSections({});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async (section) => {
    if (!sessionId) return;
    setSelectedSection(section);
    setSuggestion(null);
    setLoading(true);
    setError(null);
    try {
      const data = await refineSection(sessionId, section, refineMode);
      setSuggestion(data.suggestion);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!sessionId || !suggestion) return;
    try {
      const data = await applySuggestion(sessionId, selectedSection, suggestion.revised_text);
      if (data.complianceReport) setReport(data.complianceReport);
      if (data.structuredManuscript) setStructured(data.structuredManuscript);
      setRevisedSections(prev => ({
        ...prev,
        [selectedSection]: suggestion.revised_text,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggestion(null);
      setSelectedSection(null);
    }
  };

  const handleReanalyze = async () => {
    if (!sessionId || !text.trim()) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);
    setSelectedSection(null);
    try {
      const data = await analyzeManuscript(text, profile, sessionId);
      setSessionId(data.sessionId);
      setStructured(data.structuredManuscript);
      setReport(data.complianceReport);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    setSuggestion(null);
    setSelectedSection(null);
  };

  const handleExport = () => {
    const profileLabel = PROFILES.find(p => p.value === profile)?.label || profile;
    const lines = [
      `Research Copilot — Compliance Report`,
      `Profile: ${profileLabel}`,
      `Readiness Score: ${report.overallScore}/100`,
      ``,
      `SECTION STATUS`,
      ...(report.sectionStatus?.map(s => `${s.status === 'Good' ? '[OK]' : '[!]'} ${s.name}${s.note ? ' — ' + s.note : ''}`) || []),
      ``,
      `ISSUES (${report.issues?.length ?? 0})`,
      ...(report.issues?.map(i => `[${i.severity}] ${i.section}: ${i.problem}`) || []),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${profile}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfLoading(true);
    setError(null);
    try {
      const { text: extracted } = await extractPdf(file);
      setText(extracted);
    } catch (err) {
      setError(err.message);
    } finally {
      setPdfLoading(false);
      e.target.value = '';
    }
  };

  const hasRevisions = Object.keys(revisedSections).length > 0;
  const sectionsFound = structured
    ? (structured.sectionsDetected?.length || 0)
    : 0;
  const sectionsTotal = structured
    ? (structured.sectionsDetected?.length || 0) + (structured.sectionsMissing?.length || 0)
    : 0;

  const issuesByTab = (tab) => {
    if (!report?.issues) return [];
    if (tab === 'Overview') return report.issues;
    if (tab === 'Structure') return report.issues.filter(i =>
      ['abstract', 'introduction', 'conclusion', 'methodology', 'results'].includes((i.section || '').toLowerCase())
    );
    if (tab === 'Language') return report.issues.filter(i =>
      ['keywords', 'title', 'abstract'].includes((i.section || '').toLowerCase())
    );
    if (tab === 'AI Disclosure') return [];
    return report.issues;
  };

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-icon">&#x1F52C;</span>
          <span className="brand-name">Research Copilot</span>
        </div>
        <p className="topbar-sub">Publication compliance and safe manuscript refinement</p>
      </header>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>&#x2715;</button>
        </div>
      )}

      <div className="main-grid">

        {/* ── LEFT: Upload & Rules ── */}
        <section className="panel panel-left">
          <div className="panel-heading">
            <span className="step-label">Step 1</span>
            <h2>Upload &amp; rules</h2>
          </div>

          <label className="drop-zone" htmlFor="pdf-upload">
            <div className="drop-zone-inner">
              {pdfLoading
                ? <span className="drop-hint">Extracting text from PDF…</span>
                : <>
                    <span className="drop-hint">Drop PDF or paste manuscript text below</span>
                  </>
              }
            </div>
            <input
              id="pdf-upload"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handlePdfUpload}
              disabled={pdfLoading}
              style={{ display: 'none' }}
            />
          </label>

          <textarea
            className="textarea"
            placeholder="Or paste your manuscript text here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
          />

          <label className="field-label">Target publication format</label>
          <select className="select" value={profile} onChange={(e) => setProfile(e.target.value)}>
            {PROFILES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          <label className="field-label">Paper title <span className="field-optional">(optional)</span></label>
          <input
            className="input"
            type="text"
            placeholder="e.g. A Heuristic Approach to…"
            value={paperTitle}
            onChange={(e) => setPaperTitle(e.target.value)}
          />

          <label className="field-label">Preserve meaning mode</label>
          <select className="select" value={refineMode} onChange={(e) => setRefineMode(e.target.value)}>
            {REFINE_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>

          <label className="field-label">Journal rules or notes <span className="field-optional">(optional)</span></label>
          <textarea
            className="textarea textarea--short"
            placeholder="e.g. Keep academic tone formal, do not add claims not supported by the manuscript…"
            value={journalNotes}
            onChange={(e) => setJournalNotes(e.target.value)}
            rows={4}
          />

          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={loading || !text.trim()}
          >
            {loading && !selectedSection ? 'Analyzing…' : 'Analyze manuscript'}
          </button>

          {report && (
            <button
              className="btn btn-outline"
              onClick={handleExport}
              style={{ marginTop: '8px' }}
            >
              Export report
            </button>
          )}

          {hasRevisions && (
            <button
              className="btn btn-outline"
              onClick={handleReanalyze}
              disabled={loading}
              style={{ marginTop: '8px' }}
            >
              Re-score with applied changes
            </button>
          )}

          <p className="trust-note">
            Do not upload sensitive unpublished work to public deployments.
            Author remains responsible for final review.
          </p>
        </section>

        {/* ── CENTER: Compliance Dashboard ── */}
        <section className="panel panel-center">
          <div className="panel-heading">
            <span className="step-label">Step 2</span>
            <h2>Compliance dashboard</h2>
          </div>

          {!report && !loading && (
            <div className="empty-state">Run analysis to see your compliance report.</div>
          )}

          {loading && !selectedSection && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Processing manuscript…</p>
            </div>
          )}

          {report && (
            <>
              {/* Score row */}
              <div className="score-row">
                <div className="score-block">
                  <div className="score-value" style={{ color: scoreColor(report.overallScore) }}>
                    {report.overallScore}<span className="score-unit">%</span>
                  </div>
                  <div className="score-sub">Submission readiness</div>
                  <div className="score-desc">{scoreSubtitle(report.overallScore, report.issues)}</div>
                </div>
                <div className="score-meta">
                  <div className="meta-item">
                    <div className="meta-val">{PROFILES.find(p => p.value === profile)?.label}</div>
                    <div className="meta-key">Template</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-val">{sectionsFound} / {sectionsTotal || sectionsFound}</div>
                    <div className="meta-key">Sections found</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-val" style={{ color: '#ef4444' }}>{report.issues?.filter(i => i.severity === 'Critical').length || 0}</div>
                    <div className="meta-key">Critical issues</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-val" style={{ color: '#22c55e' }}>{report.issues?.filter(i => i.severity === 'Good').length || (report.issues?.length ? 0 : 0)}</div>
                    <div className="meta-key">Safe fixes</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="tab-bar">
                {DASHBOARD_TABS.map(tab => (
                  <button
                    key={tab}
                    className={`tab-btn${activeTab === tab ? ' tab-btn--active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >{tab}</button>
                ))}
              </div>

              {activeTab === 'AI Disclosure' ? (
                <div className="ai-disclosure-card">
                  <p className="ai-disclosure-title">How AI is used in this tool</p>
                  <ul className="ai-disclosure-list">
                    <li>Section extraction uses Gemini 1.5 Flash to identify manuscript structure.</li>
                    <li>Compliance rules are deterministic — no AI involved in scoring.</li>
                    <li>Refinements are generated by Gemini with strict constraints to avoid meaning changes.</li>
                    <li>All suggestions require author review and approval before applying.</li>
                    <li>No manuscript content is stored permanently. Sessions are in-memory only.</li>
                  </ul>
                </div>
              ) : (
                <>
                  {/* Issues */}
                  <div className="issues-list">
                    {issuesByTab(activeTab).length === 0 && (
                      <div className="issue-card issue-card--good">No issues in this category.</div>
                    )}
                    {issuesByTab(activeTab).map((issue, i) => (
                      <div
                        key={i}
                        className="issue-card"
                        style={{ borderLeftColor: SEVERITY_COLOR[issue.severity] || SEVERITY_COLOR.Review }}
                      >
                        <div className="issue-header">
                          <span
                            className="severity-badge"
                            style={{ background: SEVERITY_COLOR[issue.severity] || SEVERITY_COLOR.Review }}
                          >{issue.severity}</span>
                          <span className="issue-title">{issue.problem}</span>
                        </div>
                        {issue.recommended_action && (
                          <p className="issue-action">{issue.recommended_action}</p>
                        )}
                        {getActionButtons(issue, handleRefine, loading)}
                      </div>
                    ))}
                  </div>

                  {/* Section status rows */}
                  {activeTab === 'Overview' && (
                    <>
                      <h3 className="section-heading">Detected paper sections</h3>
                      <div className="section-rows">
                        {Array.isArray(report.sectionStatus) && report.sectionStatus.length > 0
                          ? report.sectionStatus.map(s => (
                              <div key={s.name} className="section-row">
                                <div className="section-row-name">{s.name}</div>
                                <div className="section-row-note">{s.note || (s.status === 'Good' ? 'No issues detected' : 'Needs attention')}</div>
                                <span
                                  className="section-row-badge"
                                  style={{
                                    background: s.status === 'Good' ? '#14532d' : s.status === 'Critical' ? '#450a0a' : '#78350f',
                                    color: s.status === 'Good' ? '#86efac' : s.status === 'Critical' ? '#fca5a5' : '#fde68a',
                                  }}
                                >{s.status}</span>
                              </div>
                            ))
                          : [
                              ...(structured?.sectionsDetected || []).map(sec => ({ name: sec, status: 'Good' })),
                              ...(structured?.sectionsMissing || []).map(sec => ({ name: sec, status: 'Missing' })),
                            ].map(s => (
                              <div key={s.name} className="section-row">
                                <div className="section-row-name" style={{ textTransform: 'capitalize' }}>{s.name}</div>
                                <div className="section-row-note">{s.status === 'Good' ? 'Detected' : 'Not found in manuscript'}</div>
                                <span
                                  className="section-row-badge"
                                  style={{
                                    background: s.status === 'Good' ? '#14532d' : '#450a0a',
                                    color: s.status === 'Good' ? '#86efac' : '#fca5a5',
                                  }}
                                >{s.status}</span>
                              </div>
                            ))
                        }
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </section>

        {/* ── RIGHT: Safe Revision Preview ── */}
        <section className="panel panel-right">
          <div className="panel-heading">
            <span className="step-label">Step 3</span>
            <h2>Safe revision preview</h2>
          </div>

          {!suggestion && !loading && (
            <div className="empty-state">
              {selectedSection
                ? `Generating suggestion for ${selectedSection}…`
                : 'Select an issue and click a refinement action to see suggestions here.'}
            </div>
          )}

          {loading && selectedSection && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Generating revision for <strong>{selectedSection}</strong>…</p>
            </div>
          )}

          {suggestion && (
            <>
              <div className="revision-section-label">Section: {suggestion.target_section}</div>

              <div className="revision-block revision-block--original">
                <div className="revision-block-title">Original {suggestion.target_section}</div>
                <p className="revision-block-text">{suggestion.original_text}</p>
              </div>

              <div className="revision-block revision-block--revised">
                <div className="revision-block-title">Gemini refined {suggestion.target_section}</div>
                <p className="revision-block-text">{suggestion.revised_text}</p>
              </div>

              {(suggestion.change_summary || suggestion.rationale) && (
                <div className="revision-meta">
                  {suggestion.change_summary && <p><strong>Summary:</strong> {suggestion.change_summary}</p>}
                  {suggestion.rationale && <p><strong>Rationale:</strong> {suggestion.rationale}</p>}
                  {suggestion.confidence !== undefined && <p><strong>Confidence:</strong> {Math.round(suggestion.confidence * 100)}%</p>}
                </div>
              )}

              <div className="revision-actions">
                <button className="btn btn-apply" onClick={handleApply}>Apply safely</button>
                <button className="btn btn-outline" onClick={handleReject}>Reject change</button>
              </div>

              <div className="responsible-ai-note">
                Responsible AI mode: the app suggests revisions, formatting help, and compliance
                guidance, but the final manuscript remains under author review before submission.
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
