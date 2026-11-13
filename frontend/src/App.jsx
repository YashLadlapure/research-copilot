import { useEffect, useRef, useState } from 'react';
import './App.css';
import { analyzeManuscript, switchProfile, refineSection, applySuggestion, extractPdf } from './api';
import { SAMPLE_MANUSCRIPT } from './sampleManuscript';
import { profileLabel } from './profiles';
import ManuscriptForm from './components/ManuscriptForm';
import ReportPanel from './components/ReportPanel';
import RevisionPanel from './components/RevisionPanel';
import PrintableReport from './components/PrintableReport';

const IDLE = { status: 'idle', section: null, suggestion: null, error: null };
const SLOW_REQUEST_MS = 8000;

// The API runs on a free instance that sleeps when idle, so a first request
// can take most of a minute. Say so rather than leave a bare spinner.
function useSlowHint(active) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => setSlow(true), SLOW_REQUEST_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [active]);
  return slow;
}

export default function App() {
  const [text, setText] = useState('');
  const [profile, setProfile] = useState('lncs');
  const [analysis, setAnalysis] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [acknowledged, setAcknowledged] = useState(() => new Set());
  const [refinement, setRefinement] = useState(IDLE);

  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [uploadNote, setUploadNote] = useState(null);
  const [error, setError] = useState(null);

  const revisionPanel = useRef(null);
  const slow = useSlowHint(analyzing || uploading);

  const clearSession = () => {
    setAnalysis(null);
    setRevisions([]);
    setAcknowledged(new Set());
    setRefinement(IDLE);
  };

  // A lost session means the server restarted or the hour ran out. The text
  // is still in the form, so the only thing to do is check it again.
  const reportFailure = (err) => {
    if (err.code === 'SESSION_EXPIRED') clearSession();
    setError(err.message);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    clearSession();
    try {
      setAnalysis(await analyzeManuscript(text, profile));
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleProfileChange = async (nextProfile) => {
    setProfile(nextProfile);
    if (!analysis) return;
    setError(null);
    setRefinement(IDLE);
    try {
      const { report } = await switchProfile(analysis.sessionId, nextProfile);
      setAnalysis((current) => ({ ...current, report }));
      setAcknowledged(new Set());
    } catch (err) {
      reportFailure(err);
    }
  };

  const handleUpload = async (file) => {
    setUploading(true);
    setError(null);
    setUploadNote(null);
    try {
      const result = await extractPdf(file);
      setText(result.text);
      clearSession();
      setUploadNote(
        result.truncated
          ? `Read the first 40 of ${result.pages} pages from ${file.name}.`
          : `Read ${result.pages} pages from ${file.name}. Check the text before running the checks.`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRefine = async (section) => {
    setRefinement({ status: 'loading', section, suggestion: null, error: null });
    setError(null);
    revisionPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    try {
      const { suggestion } = await refineSection(analysis.sessionId, section);
      setRefinement({ status: 'ready', section, suggestion, error: null });
    } catch (err) {
      if (err.code === 'SESSION_EXPIRED') return reportFailure(err);
      setRefinement({ status: 'error', section, suggestion: null, error: err.message });
    }
  };

  const handleAccept = async () => {
    setApplying(true);
    try {
      const result = await applySuggestion(analysis.sessionId, refinement.section);
      setAnalysis((current) => ({ ...current, report: result.report }));
      setRevisions(result.revisions);
      setRefinement(IDLE);
    } catch (err) {
      reportFailure(err);
    } finally {
      setApplying(false);
    }
  };

  const toggleAcknowledged = (issueId) => {
    setAcknowledged((current) => {
      const next = new Set(current);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  };

  const refining = refinement.status === 'loading';

  return (
    <>
      <div className="app">
        <header className="topbar">
          <h1 className="topbar__name">Research Copilot</h1>
          <p className="topbar__tagline">Formatting checks and reviewed refinement for LNCS and IEEE papers</p>
        </header>

        {error && (
          <div className="banner" role="alert">
            <span>{error}</span>
            <button type="button" className="link-button" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        <main className="workspace">
          <section className="pane pane--input" aria-labelledby="input-heading">
            <h2 id="input-heading" className="pane__heading">Manuscript</h2>
            <ManuscriptForm
              text={text}
              onTextChange={setText}
              profile={profile}
              onProfileChange={handleProfileChange}
              onAnalyze={handleAnalyze}
              onUpload={handleUpload}
              onLoadSample={() => {
                setText(SAMPLE_MANUSCRIPT);
                setUploadNote('Sample paper loaded. It is fictional and contains deliberate formatting problems.');
              }}
              analyzing={analyzing}
              uploading={uploading}
              uploadNote={uploadNote}
            />
          </section>

          <section className="pane pane--report" aria-labelledby="report-heading">
            <h2 id="report-heading" className="pane__heading">Compliance report</h2>
            {analyzing && (
              <div className="empty" aria-live="polite">
                <div className="spinner" />
                <p>Checking against {profileLabel(profile)}…</p>
                {slow && <p className="field-hint">The server sleeps when idle and can take up to a minute to wake.</p>}
              </div>
            )}
            {!analyzing && !analysis && (
              <div className="empty">
                <h3>Nothing checked yet</h3>
                <p>
                  Paste a manuscript or upload a PDF, choose the target format, and run the checks. The report
                  lists what breaks the format rules and which sections can be refined.
                </p>
              </div>
            )}
            {!analyzing && analysis && (
              <ReportPanel
                analysis={analysis}
                revisions={revisions}
                acknowledged={acknowledged}
                refiningSection={refining ? refinement.section : null}
                busy={refining || applying}
                onRefine={handleRefine}
                onToggleAcknowledged={toggleAcknowledged}
                onExport={() => window.print()}
              />
            )}
          </section>

          <section ref={revisionPanel} className="pane pane--revision" aria-labelledby="revision-heading">
            <h2 id="revision-heading" className="pane__heading">Revision</h2>
            <RevisionPanel
              refinement={refinement}
              applying={applying}
              onAccept={handleAccept}
              onDiscard={() => setRefinement(IDLE)}
              onRetry={() => handleRefine(refinement.section)}
            />
          </section>
        </main>
      </div>

      {analysis && <PrintableReport analysis={analysis} revisions={revisions} acknowledged={acknowledged} />}
    </>
  );
}
