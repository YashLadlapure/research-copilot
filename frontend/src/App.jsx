import { useState } from 'react';
import './App.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const PROFILES = [
  { value: 'springer_lncs', label: 'Springer LNCS' },
  { value: 'ieee_conference', label: 'IEEE Conference' },
];

const SEVERITY_COLOR = {
  Critical: '#ef4444',
  Review: '#f59e0b',
  Good: '#22c55e',
};

export default function App() {
  const [text, setText] = useState('');
  const [profile, setProfile] = useState('springer_lncs');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [structured, setStructured] = useState(null);
  const [report, setReport] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [currentSuggestion, setCurrentSuggestion] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    setStructured(null);
    setCurrentSuggestion(null);
    setSelectedSection(null);
    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manuscriptText: text, profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setSessionId(data.sessionId);
      setStructured(data.structured);
      setReport(data.report);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async (section) => {
    if (!sessionId) return;
    setSelectedSection(section);
    setCurrentSuggestion(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/refine-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, targetSection: section, mode: 'strict' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refinement failed');
      setCurrentSuggestion(data.suggestion);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!sessionId || !currentSuggestion) return;
    try {
      await fetch(`${API}/api/apply-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          targetSection: selectedSection,
          revisedText: currentSuggestion.revised_text,
        }),
      });
      setCurrentSuggestion(null);
      setSelectedSection(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const scoreColor = (score) => {
    if (score >= 75) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="app-root">
      {/* Hero */}
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
        {/* LEFT — Input */}
        <section className="panel panel-left">
          <h2>Manuscript</h2>

          <label className="field-label">Publication Profile</label>
          <select
            className="select"
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
          >
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

          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={loading || !text.trim()}
          >
            {loading ? '⏳ Analyzing…' : '🔍 Analyze Manuscript'}
          </button>

          <p className="trust-note">
            ⚠️ Do not upload sensitive unpublished work to public deployments.
            Author remains responsible for final review.
          </p>
        </section>

        {/* CENTER — Compliance Dashboard */}
        <section className="panel panel-center">
          <h2>Compliance Dashboard</h2>

          {!report && !loading && (
            <div className="empty-state">Run analysis to see your compliance report.</div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Processing manuscript…</p>
            </div>
          )}

          {report && (
            <>
              {/* Score Card */}
              <div className="score-card" style={{ borderColor: scoreColor(report.overallScore) }}>
                <div className="score-value" style={{ color: scoreColor(report.overallScore) }}>
                  {report.overallScore}<span className="score-unit">/100</span>
                </div>
                <div className="score-label">Readiness Score</div>
              </div>

              {/* Section Status */}
              <h3>Section Status</h3>
              <div className="section-status-list">
                {structured?.sections_detected?.map((sec) => (
                  <div key={sec} className="section-chip section-chip--found">✅ {sec}</div>
                ))}
                {structured?.sections_missing?.map((sec) => (
                  <div key={sec} className="section-chip section-chip--missing">❌ {sec}</div>
                ))}
              </div>

              {/* Issues */}
              <h3>Issues ({report.issues?.length || 0})</h3>
              <div className="issues-list">
                {report.issues?.length === 0 && (
                  <div className="issue-card issue-card--good">🎉 No issues found!</div>
                )}
                {report.issues?.map((issue, i) => (
                  <div
                    key={i}
                    className="issue-card"
                    style={{ borderLeftColor: SEVERITY_COLOR[issue.severity] }}
                  >
                    <div className="issue-header">
                      <span
                        className="severity-badge"
                        style={{ background: SEVERITY_COLOR[issue.severity] }}
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

        {/* RIGHT — Revision Preview */}
        <section className="panel panel-right">
          <h2>Revision Preview</h2>

          {!currentSuggestion && !loading && (
            <div className="empty-state">
              {selectedSection
                ? `Selected: ${selectedSection} — waiting for suggestion…`
                : 'Click "Refine Section" on an issue to see suggestions.'}
            </div>
          )}

          {loading && selectedSection && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Generating Gemini suggestion for <strong>{selectedSection}</strong>…</p>
            </div>
          )}

          {currentSuggestion && (
            <>
              <div className="diff-header">
                <span className="diff-section-label">Section: <strong>{currentSuggestion.target_section}</strong></span>
                <span className="diff-mode-label">Mode: {currentSuggestion.mode || 'strict'}</span>
              </div>

              <div className="diff-grid">
                <div className="diff-col diff-col--original">
                  <div className="diff-col-title">Original</div>
                  <pre className="diff-text">{currentSuggestion.original_text}</pre>
                </div>
                <div className="diff-col diff-col--revised">
                  <div className="diff-col-title">Suggested</div>
                  <pre className="diff-text">{currentSuggestion.revised_text}</pre>
                </div>
              </div>

              <div className="suggestion-meta">
                {currentSuggestion.rationale && (
                  <p><strong>Rationale:</strong> {currentSuggestion.rationale}</p>
                )}
                {currentSuggestion.safety_note && (
                  <p className="safety-note">🛡️ <strong>Safety:</strong> {currentSuggestion.safety_note}</p>
                )}
                {currentSuggestion.confidence !== undefined && (
                  <p><strong>Confidence:</strong> {Math.round(currentSuggestion.confidence * 100)}%</p>
                )}
              </div>

              <div className="revision-actions">
                <button className="btn btn-success" onClick={handleApply}>✅ Apply</button>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setCurrentSuggestion(null); setSelectedSection(null); }}
                >
                  ✕ Reject
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
