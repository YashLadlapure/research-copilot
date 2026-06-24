import { useState } from 'react';
import './App.css';
import { analyzeManuscript, refineSection, applySuggestion, extractPdf, fetchBonusTips, fetchExportData } from './api';
import { generateRevisionPdf } from './exportPdf';

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

const NON_REFINABLE = new Set([
  'references', 'bibliography',
  'language', 'metadata', 'structure', 'figures', 'tables',
]);

const DASHBOARD_TABS = ['Overview', 'Structure', 'Language', 'Tips', 'AI Disclosure'];
const SECTION_ORDER = ['title', 'abstract', 'keywords', 'introduction', 'methodology', 'results', 'conclusion', 'references'];

const APA_STEPS = [
  { label: 'Journal article', example: 'Author, A. A., & Author, B. B. (Year). Title of article. Journal Name, volume(issue), page–page. https://doi.org/xxxxx' },
  { label: 'Book', example: 'Author, A. A. (Year). Title of work: Capital letter also for subtitle. Publisher.' },
  { label: 'Book chapter', example: 'Author, A. A. (Year). Title of chapter. In E. Editor (Ed.), Title of book (pp. xx–xx). Publisher.' },
  { label: 'Conference paper', example: 'Author, A. A. (Year, Month). Title of paper. In B. Editor (Ed.), Proceedings title (pp. xx–xx). Publisher.' },
  { label: 'Website / online source', example: 'Author, A. A. (Year, Month Day). Title of page. Site Name. URL' },
];

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

function sortIssues(issues) {
  const refSections = new Set(['references', 'bibliography']);
  return [...issues].sort((a, b) => {
    const aRef = refSections.has((a.section || '').toLowerCase());
    const bRef = refSections.has((b.section || '').toLowerCase());
    if (aRef && !bRef) return 1;
    if (!aRef && bRef) return -1;
    return 0;
  });
}

function recalcScore(issues) {
  const criticalCount = issues.filter(i => i.severity === 'Critical').length;
  const reviewCount = issues.filter(i => i.severity === 'Review').length;
  return Math.max(0, 100 - criticalCount * 20 - reviewCount * 5);
}

function ApaGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="apa-guide">
      <button className="apa-guide__toggle" onClick={() => setOpen(o => !o)}>
        <span>📖 APA 7th edition — how to format references</span>
        <span className="apa-guide__chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ol className="apa-guide__list">
          <li className="apa-guide__rule"><strong>Author format:</strong> Last name, Initials. List all authors up to 20; for 21+, list first 19, add …, then last author.</li>
          <li className="apa-guide__rule"><strong>Year:</strong> In parentheses immediately after authors — (2023).</li>
          <li className="apa-guide__rule"><strong>Title:</strong> Sentence case only — capitalise the first word and proper nouns. No quotes, no bold.</li>
          <li className="apa-guide__rule"><strong>Journal name &amp; volume:</strong> Italicise the journal name and volume number — <em>Journal Name, 12</em>(3).</li>
          <li className="apa-guide__rule"><strong>DOI / URL:</strong> Always include as a hyperlink. Format: https://doi.org/xxxxx — no full stop after the URL.</li>
          <li className="apa-guide__rule"><strong>Hanging indent:</strong> First line flush left; subsequent lines indented 0.5 in (1.27 cm).</li>
          <li className="apa-guide__rule"><strong>Order:</strong> Alphabetical by first author's last name. Multiple works by the same author: oldest first.</li>
          {APA_STEPS.map((s, i) => (
            <li key={i} className="apa-guide__example">
              <span className="apa-guide__example-label">{s.label}</span>
              <code className="apa-guide__example-code">{s.example}</code>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function isNonRefinable(section) {
  return NON_REFINABLE.has((section || '').toLowerCase());
}

function getActionButtons(issue, onRefine, loading, onDismiss) {
  const sec = (issue.section || '').toLowerCase();

  if (isNonRefinable(sec)) {
    const isRef = sec === 'references' || sec === 'bibliography';
    return (
      <div className="issue-actions" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
        <div className="issue-manual-note">
          {isRef
            ? '⚠️ Must be fixed manually — references cannot be auto-edited to avoid citation errors.'
            : '⚠️ This issue requires manual correction in your manuscript.'}
        </div>
        {isRef && <ApaGuide />}
        <button
          className="action-btn action-btn--ghost"
          style={{ marginTop: '8px', fontSize: '0.75rem' }}
          onClick={() => onDismiss(issue)}
        >
          ✓ Mark as fixed manually
        </button>
      </div>
    );
  }

  const label = sec === 'abstract' ? 'Improve abstract' : sec === 'keywords' ? 'Suggest keywords' : 'Refine section';
  return (
    <div className="issue-actions">
      <button className="action-btn" onClick={() => onRefine(issue.section)} disabled={loading}>{label}</button>
    </div>
  );
}

export default function App() {
  const [text, setText] = useState('');
  const [profile, setProfile] = useState('lncs');
  const [refineMode, setRefineMode] = useState('strict');
  const [loading, setLoading] = useState(false);
  const [refiningSection, setRefiningSection] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');

  const [sessionId, setSessionId] = useState(null);
  const [structured, setStructured] = useState(null);
  const [report, setReport] = useState(null);
  const [revisedSections, setRevisedSections] = useState({});
  const [bonusTips, setBonusTips] = useState(null);
  const [dismissedIssues, setDismissedIssues] = useState([]);

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
    setRefiningSection(null);
    setActiveTab('Overview');
    setBonusTips(null);
    setRevisedSections({});
    setDismissedIssues([]);
    try {
      const data = await analyzeManuscript(text, profile);
      setSessionId(data.sessionId);
      setStructured(data.structuredManuscript);
      setReport(data.complianceReport);
      loadBonusTips(data.sessionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBonusTips = async (sid) => {
    setTipsLoading(true);
    try {
      const data = await fetchBonusTips(sid, profile);
      setBonusTips(data);
    } catch {
      // non-critical
    } finally {
      setTipsLoading(false);
    }
  };

  const handleRefine = async (section) => {
    if (!sessionId || loading || refiningSection) return;
    if (isNonRefinable(section)) return;
    setSelectedSection(section);
    setRefiningSection(section);
    setSuggestion(null);
    setError(null);
    try {
      const data = await refineSection(sessionId, section, refineMode);
      setSuggestion(data.suggestion);
    } catch (err) {
      setError(err.message);
      setSelectedSection(null);
    } finally {
      setRefiningSection(null);
    }
  };

  const handleSectionRowClick = (sectionName) => {
    if (!sessionId || loading || refiningSection) return;
    if (isNonRefinable(sectionName)) return;
    handleRefine(sectionName);
  };

  const handleApply = async () => {
    if (!sessionId || !suggestion) return;
    try {
      const data = await applySuggestion(sessionId, selectedSection, suggestion.revised_text);
      if (data.complianceReport) {
        const freshIssues = (data.complianceReport.issues || []).filter(
          issue => !dismissedIssues.some(d => d.section === issue.section && d.problem === issue.problem)
        );
        const updatedReport = {
          ...data.complianceReport,
          issues: freshIssues,
        };
        setReport(updatedReport);
      }
      if (data.structuredManuscript) setStructured(data.structuredManuscript);
      setRevisedSections(prev => ({ ...prev, [selectedSection]: suggestion.revised_text }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggestion(null);
      setSelectedSection(null);
    }
  };

  const handleDismissIssue = (issue) => {
    setDismissedIssues(prev => [...prev, issue]);
    setReport(prev => {
      if (!prev) return prev;
      const remaining = prev.issues.filter(
        i => !(i.section === issue.section && i.problem === issue.problem)
      );
      return { ...prev, issues: remaining, overallScore: recalcScore(remaining) };
    });
  };

  const handleReanalyze = async () => {
    if (!sessionId || !text.trim()) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);
    setSelectedSection(null);
    setRevisedSections({});
    setDismissedIssues([]);
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

  // Reject: dismiss the issue that triggered this refinement and recalculate score
  const handleReject = () => {
    if (selectedSection && report) {
      setReport(prev => {
        if (!prev) return prev;
        const remaining = prev.issues.filter(
          i => (i.section || '').toLowerCase() !== (selectedSection || '').toLowerCase()
        );
        return { ...prev, issues: remaining, overallScore: recalcScore(remaining) };
      });
      setDismissedIssues(prev => [
        ...prev,
        ...(report.issues || []).filter(
          i => (i.section || '').toLowerCase() === (selectedSection || '').toLowerCase()
        ),
      ]);
    }
    setSuggestion(null);
    setSelectedSection(null);
  };

  const handleExport = async () => {
    if (!sessionId || !report) return;
    setExportLoading(true);
    setError(null);
    try {
      const exportText = await fetchExportData(sessionId, revisedSections);
      generateRevisionPdf(exportText, revisedSections, profile, report.overallScore, report.manualWarnings || []);
    } catch (err) {
      setError('Export failed: ' + err.message);
    } finally {
      setExportLoading(false);
    }
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
  const sectionsFound = structured ? (structured.sectionsDetected?.length || 0) : 0;
  const sectionsTotal = structured
    ? (structured.sectionsDetected?.length || 0) + (structured.sectionsMissing?.length || 0)
    : 0;
  const isRefining = !!refiningSection;

  const visibleIssues = (allIssues) =>
    (allIssues || []).filter(
      issue => !dismissedIssues.some(d => d.section === issue.section && d.problem === issue.problem)
    );

  const issuesByTab = (tab) => {
    if (!report?.issues) return [];
    const base = visibleIssues(report.issues);
    if (tab === 'Overview') return sortIssues(base);
    if (tab === 'Structure') return sortIssues(base.filter(i =>
      ['abstract', 'introduction', 'conclusion', 'methodology', 'results',
       'discussion', 'background', 'future work', 'future scope', 'results and discussion'].includes((i.section || '').toLowerCase())
    ));
    if (tab === 'Language') return sortIssues(base.filter(i =>
      ['keywords', 'title', 'abstract', 'introduction', 'conclusion'].includes((i.section || '').toLowerCase())
    ));
    return [];
  };

  const buildSectionRows = () => {
    if (Array.isArray(report?.sectionStatus) && report.sectionStatus.length > 0) {
      return report.sectionStatus.map(s => ({ name: s.name, status: s.status, note: s.note || null }));
    }
    return [
      ...(structured?.sectionsDetected || []).map(sec => ({ name: sec, status: 'Good', note: null })),
      ...(structured?.sectionsMissing || []).map(sec => ({ name: sec, status: 'Missing', note: null })),
    ];
  };

  const profileLabel = PROFILES.find(p => p.value === profile)?.label || 'the target format';

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

        {/* LEFT */}
        <section className="panel panel-left">
          <div className="panel-heading">
            <span className="step-label">Step 1</span>
            <h2>Upload &amp; rules</h2>
          </div>

          <label className="drop-zone" htmlFor="pdf-upload">
            <div className="drop-zone-inner">
              {pdfLoading
                ? <span className="drop-hint">Extracting text from PDF…</span>
                : <span className="drop-hint">Drop PDF or paste manuscript text below</span>
              }
            </div>
            <input id="pdf-upload" type="file" accept=".pdf,application/pdf" onChange={handlePdfUpload} disabled={pdfLoading} style={{ display: 'none' }} />
          </label>

          <textarea className="textarea" placeholder="Or paste your manuscript text here…" value={text} onChange={(e) => setText(e.target.value)} rows={8} />

          <label className="field-label">Target publication format</label>
          <select className="select" value={profile} onChange={(e) => setProfile(e.target.value)}>
            {PROFILES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          <label className="field-label">Preserve meaning mode</label>
          <select className="select" value={refineMode} onChange={(e) => setRefineMode(e.target.value)}>
            {REFINE_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>

          <button className="btn btn-primary" onClick={handleAnalyze} disabled={loading || !text.trim()}>
            {loading && !isRefining ? 'Analyzing…' : 'Analyze manuscript'}
          </button>

          {report && (
            <button
              className="btn btn-outline"
              onClick={handleExport}
              disabled={exportLoading}
              style={{ marginTop: '8px' }}
            >
              {exportLoading ? 'Generating PDF…' : 'Export revision report'}
            </button>
          )}

          {hasRevisions && (
            <button className="btn btn-outline" onClick={handleReanalyze} disabled={loading} style={{ marginTop: '8px' }}>
              Re-score with applied changes
            </button>
          )}

          <p className="trust-note">
            Do not upload sensitive unpublished work to public deployments.
            Author remains responsible for final review.
          </p>
        </section>

        {/* CENTER */}
        <section className="panel panel-center">
          <div className="panel-heading">
            <span className="step-label">Step 2</span>
            <h2>Compliance dashboard</h2>
          </div>

          {!report && !loading && (
            <div className="empty-state">Run analysis to see your compliance report.</div>
          )}

          {loading && !isRefining && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Processing manuscript…</p>
            </div>
          )}

          {report && (
            <>
              <div className="score-row">
                <div className="score-block">
                  <div className="score-value" style={{ color: scoreColor(report.overallScore) }}>
                    {report.overallScore}<span className="score-unit">%</span>
                  </div>
                  <div className="score-sub">Submission readiness</div>
                  <div className="score-desc">{scoreSubtitle(report.overallScore, visibleIssues(report.issues))}</div>
                </div>
                <div className="score-meta">
                  <div className="meta-item">
                    <div className="meta-val">{profileLabel}</div>
                    <div className="meta-key">Template</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-val">{sectionsFound} / {sectionsTotal || sectionsFound}</div>
                    <div className="meta-key">Sections found</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-val" style={{ color: '#ef4444' }}>
                      {visibleIssues(report.issues).filter(i => i.severity === 'Critical').length || 0}
                    </div>
                    <div className="meta-key">Critical issues</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-val" style={{ color: '#22c55e' }}>
                      {report.issues?.filter(i => i.severity === 'Good').length || 0}
                    </div>
                    <div className="meta-key">Safe fixes</div>
                  </div>
                </div>
              </div>

              <div className="manual-warnings-hint">
                <span className="manual-warnings-hint__icon">&#x1F4CB;</span>
                <span className="manual-warnings-hint__text">
                  This score covers text-level compliance only. Layout rules (font sizes, margins, indentation, equation alignment) require manual verification in your {profileLabel} template.
                  <strong> Export the revision report</strong> to see the full checklist.
                </span>
              </div>

              <div className="tab-bar">
                {DASHBOARD_TABS.map(tab => (
                  <button key={tab} className={`tab-btn${activeTab === tab ? ' tab-btn--active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
                ))}
              </div>

              {activeTab === 'Tips' && (
                <div className="tips-card">
                  <p className="tips-title">✨ Bonus tips for {profileLabel}</p>
                  {tipsLoading && <div className="tips-loading">Asking Gemini for publication tips…</div>}
                  {!tipsLoading && bonusTips?.tips && (
                    <ol className="tips-list">
                      {bonusTips.tips.map((tip, i) => (
                        <li key={i} className="tips-item">{tip}</li>
                      ))}
                    </ol>
                  )}
                  {!tipsLoading && !bonusTips && (
                    <div className="tips-empty">Tips unavailable. Re-run analysis to load.</div>
                  )}
                </div>
              )}

              {activeTab === 'AI Disclosure' && (
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
              )}

              {activeTab !== 'Tips' && activeTab !== 'AI Disclosure' && (
                <>
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
                          <span className="severity-badge" style={{ background: SEVERITY_COLOR[issue.severity] || SEVERITY_COLOR.Review }}>{issue.severity}</span>
                          <span className="issue-title">{issue.problem}</span>
                        </div>
                        {issue.recommended_action && <p className="issue-action">{issue.recommended_action}</p>}
                        {getActionButtons(issue, handleRefine, isRefining, handleDismissIssue)}
                      </div>
                    ))}
                  </div>

                  {activeTab === 'Overview' && (
                    <>
                      <h3 className="section-heading">Detected paper sections</h3>
                      <div className="section-rows">
                        {buildSectionRows().map(s => {
                          const secNonRefinable = isNonRefinable(s.name);
                          const isMissing = s.status === 'Missing';
                          const isThisRefining = refiningSection === s.name;
                          const clickable = sessionId && !secNonRefinable && !isMissing && !isRefining;
                          return (
                            <div
                              key={s.name}
                              className={`section-row${clickable ? ' section-row--clickable' : ''}${isThisRefining ? ' section-row--selected' : ''}`}
                              onClick={() => clickable && handleSectionRowClick(s.name)}
                              title={clickable ? `Click to refine ${s.name} with Gemini` : undefined}
                            >
                              <div className="section-row-name" style={{ textTransform: 'capitalize' }}>{s.name}</div>
                              <div className="section-row-note">
                                {isThisRefining
                                  ? 'Sending to Gemini…'
                                  : s.note || (isMissing ? 'Not found in manuscript' : 'Detected')}
                              </div>
                              <div className="section-row-right">
                                {revisedSections[s.name] && <span className="section-revised-badge">Revised</span>}
                                <span
                                  className="section-row-badge"
                                  style={{
                                    background: isMissing ? '#fef2f2' : s.status === 'Critical' ? '#fef2f2' : s.status === 'Review' ? '#fffbeb' : '#f0fdf4',
                                    color: isMissing ? '#b91c1c' : s.status === 'Critical' ? '#b91c1c' : s.status === 'Review' ? '#92400e' : '#15803d',
                                  }}
                                >{isMissing ? 'Missing' : s.status}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </section>

        {/* RIGHT */}
        <section className="panel panel-right">
          <div className="panel-heading">
            <span className="step-label">Step 3</span>
            <h2>Safe revision preview</h2>
          </div>

          {!suggestion && !isRefining && (
            <div className="empty-state">Click any section or issue button to get a Gemini-powered replacement.</div>
          )}

          {isRefining && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Gemini is rewriting <strong style={{textTransform:'capitalize'}}>{refiningSection}</strong>…</p>
            </div>
          )}

          {suggestion && !isRefining && (
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
