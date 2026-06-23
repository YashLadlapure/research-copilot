import { useState } from 'react';
import './App.css';
import { analyzeManuscript, refineSection, applySuggestion, extractPdf } from './api';

const PROFILES = [
  { value: 'lncs', label: 'Springer LNCS' },
  { value: 'ieee', label: 'IEEE Conference' },
];

const SEVERITY_COLOR = {
  Critical: '#ef4444',
  Review: '#f59e0b',
  Good: '#22c55e',
};

function scoreColor(score) {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

export default function App() {
  const [text, setText] = useState('');
  const [profile, setProfile] = useState('lncs');
  const [refineMode, setRefineMode] = useState('strict');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [sessionId, setSessionId] = useState(null);
  const [structured, setStructured] = useState(null);
  const [report, setReport] = useState(null);

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
    try {
      const data = await analyzeManuscript(text, profile);
      setSessionId(data.sessionId);
      setStructured(data.structuredManuscript);
      setReport(data.complianceReport);
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
      await applySuggestion(sessionId, selectedSection, suggestion.revised_text);
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggestion(null);
      setSelectedSection(null);
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
      ...(report.sectionStatus?.map(s => `${s.status === 'Good' ? '✅' : '❌'} ${s.name}`) || []),
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

  return (
    <div className="app-root">
      <header className="hero">
        <h1>🔬 Research Copilot</h1>
        <p>AI-assisted publication compliance and safe manuscript refinement</p>
      </header>

      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="main-grid">
        <section className="panel panel-left">
          <h2>Manuscript</h2>

          <label className="field-label">Publication Profile</label>
          <select className="select" value={profile} onChange={(e) => setProfile(e.target.value)}>
            {PROFILES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <label className="field-label">Paste Manuscript Text</label>
          <textarea
            className="textarea"
            placeholder="Paste your research manuscript here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={20}
          />

          <label className="field-label">
            Or Upload PDF
            <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '0.4rem' }}>
              (PDF only — convert .docx to PDF first)
            </span>
          </label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handlePdfUpload}
            disabled={pdfLoading}
            style={{ marginBottom: '0.5rem' }}
          />
          {pdfLoading && <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>Extracting text from PDF…</p>}

          <label className="field-label">Refine Mode</label>
          <select className="select" value={refineMode} onChange={(e) => setRefineMode(e.target.value)}>
            <option value="strict">Strict — grammar only</option>
            <option value="balanced">Balanced — clarity + flow</option>
            <option value="aggressive">Aggressive — full polish</option>
          </select>

          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={loading || !text.trim()}
          >
            {loading && !selectedSection ? '⏳ Analyzing…' : '🔍 Analyze Manuscript'}
          </button>

          <p className="trust-note">
            ⚠️ Do not upload sensitive unpublished work to public deployments.
            Author remains responsible for final review.
          </p>
        </section>

        <section className="panel panel-center">
          <h2>Compliance Dashboard</h2>

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
              <div className="score-card" style={{ borderColor: scoreColor(report.overallScore) }}>
                <div className="score-value" style={{ color: scoreColor(report.overallScore) }}>
                  {report.overallScore}<span className="score-unit">/100</span>
                </div>
                <div className="score-label">Readiness Score</div>
              </div>

              <button className="btn btn-secondary" onClick={handleExport} style={{ marginBottom: '1rem' }}>
                ⬇️ Export Report
              </button>

              <h3>Section Status</h3>
              <div className="section-status-list">
                {Array.isArray(report.sectionStatus) && report.sectionStatus.length > 0
                  ? report.sectionStatus.map((s) => (
                      <div
                        key={s.name}
                        className={`section-chip ${
                          s.status === 'Good' ? 'section-chip--found' : 'section-chip--missing'
                        }`}
                      >
                        {s.status === 'Good' ? '✅' : '❌'} {s.name}
                      </div>
                    ))
                  : (
                    <>
                      {structured?.sectionsDetected?.map((sec) => (
                        <div key={sec} className="section-chip section-chip--found">✅ {sec}</div>
                      ))}
                      {structured?.sectionsMissing?.map((sec) => (
                        <div key={sec} className="section-chip section-chip--missing">❌ {sec}</div>
                      ))}
                    </>
                  )
                }
              </div>

              <h3>Issues ({report.issues?.length ?? 0})</h3>
              <div className="issues-list">
                {(!report.issues || report.issues.length === 0) && (
                  <div className="issue-card issue-card--good">🎉 No issues found!</div>
                )}
                {report.issues?.map((issue, i) => (
                  <div
                    key={i}
                    className="issue-card"
                    style={{ borderLeftColor: SEVERITY_COLOR[issue.severity] || SEVERITY_COLOR.Review }}
                  >
                    <div className="issue-header">
                      <span
                        className="severity-badge"
                        style={{ background: SEVERITY_COLOR[issue.severity] || SEVERITY_COLOR.Review }}
                      >
                        {issue.severity}
                      </span>
                      <span className="issue-section">{issue.section}</span>
                    </div>
                    <p className="issue-problem">{issue.problem}</p>
                    {issue.recommended_action && (
                      <p className="issue-action">💡 {issue.recommended_action}</p>
                    )}
                    <button
                      className="btn btn-sm"
                      onClick={() => handleRefine(issue.section)}
                      disabled={loading}
                    >
                      ✨ Refine Section
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="panel panel-right">
          <h2>Revision Preview</h2>

          {!suggestion && !loading && (
            <div className="empty-state">
              {selectedSection
                ? `Selected: ${selectedSection} — waiting for suggestion…`
                : 'Click "Refine Section" on an issue to see suggestions.'}
            </div>
          )}

          {loading && selectedSection && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Generating suggestion for <strong>{selectedSection}</strong>…</p>
            </div>
          )}

          {suggestion && (
            <>
              <div className="diff-header">
                <span className="diff-section-label">
                  Section: <strong>{suggestion.target_section}</strong>
                </span>
                <span className="diff-mode-label">Mode: {suggestion.mode || refineMode}</span>
              </div>

              <div className="diff-grid">
                <div className="diff-col diff-col--original">
                  <div className="diff-col-title">Original</div>
                  <pre className="diff-text">{suggestion.original_text}</pre>
                </div>
                <div className="diff-col diff-col--revised">
                  <div className="diff-col-title">Suggested</div>
                  <pre className="diff-text">{suggestion.revised_text}</pre>
                </div>
              </div>

              <div className="suggestion-meta">
                {suggestion.change_summary && (
                  <p><strong>Summary:</strong> {suggestion.change_summary}</p>
                )}
                {suggestion.rationale && (
                  <p><strong>Rationale:</strong> {suggestion.rationale}</p>
                )}
                {suggestion.safety_note && (
                  <p className="safety-note">
                    🛡️ <strong>Safety:</strong> {suggestion.safety_note}
                  </p>
                )}
                {suggestion.confidence !== undefined && (
                  <p><strong>Confidence:</strong> {Math.round(suggestion.confidence * 100)}%</p>
                )}
              </div>

              <div className="revision-actions">
                <button className="btn btn-success" onClick={handleApply}>✅ Apply</button>
                <button className="btn btn-ghost" onClick={handleReject}>✕ Reject</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
