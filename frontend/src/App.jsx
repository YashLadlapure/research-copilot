import { useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:4000/api'

const PROFILES = [
  { value: 'lncs', label: 'Springer LNCS' },
  { value: 'ieee', label: 'IEEE Conference' },
]

const SEVERITY_COLOR = {
  Critical: '#ef4444',
  Review: '#f59e0b',
  Good: '#22c55e',
}

function SeverityBadge({ level }) {
  return (
    <span style={{
      background: SEVERITY_COLOR[level] || '#6b7280',
      color: '#fff',
      borderRadius: '4px',
      padding: '2px 10px',
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: '0.5px',
    }}>{level}</span>
  )
}

function ScoreCard({ score }) {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="score-card" style={{ borderColor: color }}>
      <div className="score-number" style={{ color }}>{score}</div>
      <div className="score-label">Readiness Score</div>
    </div>
  )
}

function IssueCard({ issue }) {
  return (
    <div className="issue-card" style={{ borderLeft: `4px solid ${SEVERITY_COLOR[issue.severity] || '#6b7280'}` }}>
      <div className="issue-header">
        <span className="issue-section">{issue.section}</span>
        <SeverityBadge level={issue.severity} />
      </div>
      <p className="issue-problem">{issue.problem}</p>
      <p className="issue-why">{issue.whyItMatters}</p>
      {issue.recommendedAction && (
        <p className="issue-action">💡 {issue.recommendedAction}</p>
      )}
    </div>
  )
}

function DiffViewer({ original, revised, onAccept, onReject }) {
  return (
    <div className="diff-viewer">
      <div className="diff-col">
        <div className="diff-label original-label">Original</div>
        <div className="diff-text">{original}</div>
      </div>
      <div className="diff-col">
        <div className="diff-label revised-label">Suggested</div>
        <div className="diff-text revised">{revised}</div>
      </div>
      <div className="diff-actions">
        <button className="btn-accept" onClick={onAccept}>✅ Apply</button>
        <button className="btn-reject" onClick={onReject}>❌ Reject</button>
      </div>
    </div>
  )
}

export default function App() {
  const [text, setText] = useState('')
  const [profile, setProfile] = useState('lncs')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [activeSection, setActiveSection] = useState(null)
  const [refining, setRefining] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [refineMode, setRefineMode] = useState('strict')
  const [appliedSections, setAppliedSections] = useState({})

  async function handleAnalyze() {
    if (!text.trim()) { setError('Please paste your manuscript text.'); return }
    setLoading(true); setError(''); setResult(null); setSuggestion(null); setActiveSection(null)
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, profile }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefine(section) {
    if (!result?.sessionId) return
    setActiveSection(section); setRefining(true); setSuggestion(null)
    try {
      const res = await fetch(`${API_BASE}/refine-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: result.sessionId, targetSection: section, mode: refineMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refinement failed')
      setSuggestion(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setRefining(false)
    }
  }

  function handleAccept() {
    if (!suggestion) return
    setAppliedSections(prev => ({ ...prev, [activeSection]: suggestion.revisedText }))
    setSuggestion(null)
  }

  function handleReject() { setSuggestion(null) }

  const issues = result?.complianceReport?.issues || []
  const criticalCount = issues.filter(i => i.severity === 'Critical').length
  const reviewCount = issues.filter(i => i.severity === 'Review').length

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo-block">
            <span className="logo-icon">📄</span>
            <span className="logo-text">Research <span className="logo-accent">Copilot</span></span>
          </div>
          <span className="header-tagline">AI-powered publication compliance assistant</span>
        </div>
      </header>

      <main className="app-main">
        {/* Input Panel */}
        <section className="input-panel">
          <h2 className="panel-title">Manuscript Input</h2>

          <div className="profile-selector">
            <label>Target Publication Profile</label>
            <div className="profile-buttons">
              {PROFILES.map(p => (
                <button
                  key={p.value}
                  className={`profile-btn ${profile === p.value ? 'active' : ''}`}
                  onClick={() => setProfile(p.value)}
                >{p.label}</button>
              ))}
            </div>
          </div>

          <div className="mode-selector">
            <label>Refinement Mode</label>
            <select value={refineMode} onChange={e => setRefineMode(e.target.value)} className="mode-select">
              <option value="strict">Strict — Preserve Meaning</option>
              <option value="balanced">Balanced Refinement</option>
              <option value="aggressive">Aggressive Cleanup</option>
            </select>
          </div>

          <textarea
            className="manuscript-input"
            placeholder="Paste your manuscript text here..."
            value={text}
            onChange={e => setText(e.target.value)}
            rows={14}
          />

          <div className="input-footer">
            <span className="char-count">{text.length} characters</span>
            <button className="btn-analyze" onClick={handleAnalyze} disabled={loading}>
              {loading ? '⏳ Analyzing...' : '🔍 Analyze Manuscript'}
            </button>
          </div>

          {error && <div className="error-banner">⚠️ {error}</div>}
        </section>

        {/* Results Panel */}
        {result && (
          <section className="results-panel">
            {/* Score + Summary */}
            <div className="results-top">
              <ScoreCard score={result.complianceReport?.overallScore ?? 0} />
              <div className="results-summary">
                <h2 className="panel-title">Compliance Report</h2>
                <p className="profile-tag">Profile: <strong>{PROFILES.find(p=>p.value===profile)?.label}</strong></p>
                <div className="issue-counts">
                  <span className="count-badge critical">{criticalCount} Critical</span>
                  <span className="count-badge review">{reviewCount} Review</span>
                  <span className="count-badge good">{issues.filter(i=>i.severity==='Good').length} Good</span>
                </div>
              </div>
            </div>

            {/* Section Status */}
            <div className="section-status">
              <h3>Section Status</h3>
              <div className="section-chips">
                {Object.entries(result.complianceReport?.sectionStatus || {}).map(([sec, info]) => (
                  <div
                    key={sec}
                    className={`section-chip ${info.status?.toLowerCase()}`}
                    onClick={() => handleRefine(sec)}
                    title={`Click to refine ${sec}`}
                  >
                    <span className="chip-icon">
                      {info.status === 'Good' ? '✅' : info.status === 'Critical' ? '🔴' : '🟡'}
                    </span>
                    <span className="chip-name">{sec}</span>
                    {appliedSections[sec] && <span className="chip-applied">✨</span>}
                  </div>
                ))}
              </div>
              <p className="refine-hint">💡 Click any section to generate a safe AI refinement suggestion</p>
            </div>

            {/* Issues */}
            {issues.length > 0 && (
              <div className="issues-list">
                <h3>Detected Issues</h3>
                {issues.map((issue, i) => <IssueCard key={i} issue={issue} />)}
              </div>
            )}

            {/* Diff Viewer */}
            {refining && (
              <div className="loading-refine">⏳ Generating safe refinement for <strong>{activeSection}</strong>...</div>
            )}
            {suggestion && !refining && (
              <div className="suggestion-block">
                <h3>Refinement Suggestion — <em>{activeSection}</em></h3>
                <div className="suggestion-meta">
                  <span>📋 {suggestion.changeSummary}</span>
                  <span>🛡️ {suggestion.safetyNote}</span>
                </div>
                <DiffViewer
                  original={suggestion.originalText}
                  revised={suggestion.revisedText}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
                <p className="rationale">💬 <strong>Rationale:</strong> {suggestion.rationale}</p>
              </div>
            )}

            {/* Export */}
            <div className="export-block">
              <h3>Export</h3>
              <button className="btn-export" onClick={() => {
                const sections = result.complianceReport?.sectionStatus || {}
                const lines = [
                  `Research Copilot — Compliance Checklist`,
                  `Profile: ${PROFILES.find(p=>p.value===profile)?.label}`,
                  `Readiness Score: ${result.complianceReport?.overallScore ?? 0}/100`,
                  ``,
                  `ISSUES:`,
                  ...issues.map(i => `[${i.severity}] ${i.section}: ${i.problem}`),
                  ``,
                  `SECTION STATUS:`,
                  ...Object.entries(sections).map(([s, v]) => `${s}: ${v.status} — ${v.summary}`),
                  ``,
                  `NOTE: Author remains responsible for final content and submission decisions.`,
                ]
                const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = 'compliance-checklist.txt'; a.click()
              }}>⬇️ Download Checklist</button>
              <p className="disclaimer">⚠️ AI suggestions are for formatting and structure guidance only. Author remains responsible for all content and submission decisions.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
