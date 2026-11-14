import { useEffect, useState } from 'react';
import './App.css';
import { wakeServer, analyzeManuscript, switchProfile, refineSection, applySuggestion, extractPdf } from './api';
import { SAMPLE_MANUSCRIPT } from './sampleManuscript';
import ManuscriptForm from './components/ManuscriptForm';
import ProfileSwitch from './components/ProfileSwitch';
import ReportPanel from './components/ReportPanel';
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

function useServerStatus() {
  const [status, setStatus] = useState('waking');
  useEffect(() => {
    let current = true;
    wakeServer().then(
      () => current && setStatus('ready'),
      () => current && setStatus('down'),
    );
    return () => {
      current = false;
    };
  }, []);
  return status;
}

const SERVER_MESSAGES = {
  waking: 'Starting the server, which sleeps when idle…',
  down: 'The server is not responding. Checks will fail until it is back.',
};

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

  const server = useServerStatus();
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

  const check = async (manuscript) => {
    setAnalyzing(true);
    setError(null);
    try {
      setAnalysis(await analyzeManuscript(manuscript, profile));
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTrySample = () => {
    setText(SAMPLE_MANUSCRIPT);
    setUploadNote(null);
    check(SAMPLE_MANUSCRIPT);
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
      setAnalysis((current) => ({ ...current, report: result.report, document: result.document }));
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

  return (
    <>
      <div className="app">
        <header className={`toolbar${analysis ? '' : ' toolbar--start'}`}>
          <p className="toolbar__name">Research Copilot</p>
          {analysis ? (
            <>
              <ProfileSwitch
                value={profile}
                onChange={handleProfileChange}
                disabled={refinement.status === 'loading' || applying}
              />
              <div className="toolbar__actions">
                <button type="button" className="btn btn--secondary btn--small" onClick={clearSession}>
                  New check
                </button>
                <button type="button" className="btn btn--secondary btn--small" onClick={() => window.print()}>
                  Print report
                </button>
              </div>
            </>
          ) : (
            server !== 'ready' && (
              <p className={`toolbar__status toolbar__status--${server}`} role="status">
                {SERVER_MESSAGES[server]}
              </p>
            )
          )}
        </header>

        {error && (
          <div className="banner" role="alert">
            <span>{error}</span>
            <button type="button" className="link-button" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {analysis ? (
          <main>
            <ReportPanel
              analysis={analysis}
              revisions={revisions}
              acknowledged={acknowledged}
              refinement={refinement}
              applying={applying}
              onRefine={handleRefine}
              onAccept={handleAccept}
              onDiscard={() => setRefinement(IDLE)}
              onRetry={() => handleRefine(refinement.section)}
              onToggleAcknowledged={toggleAcknowledged}
            />
          </main>
        ) : (
          <main className="start">
            <h1 className="start__headline">See your paper marked up before you submit it.</h1>
            <p className="start__lede">
              Research Copilot checks a manuscript against Springer LNCS or IEEE conference formatting rules
              and pins each problem to the place it occurs. Wording problems can be rewritten for you to
              review, with a check that no number or citation changed.
            </p>
            <ManuscriptForm
              text={text}
              onTextChange={setText}
              profile={profile}
              onProfileChange={handleProfileChange}
              onAnalyze={() => check(text)}
              onUpload={handleUpload}
              onTrySample={handleTrySample}
              analyzing={analyzing}
              uploading={uploading}
              uploadNote={uploadNote}
              slow={slow}
            />
          </main>
        )}
      </div>

      {analysis && <PrintableReport analysis={analysis} revisions={revisions} acknowledged={acknowledged} />}
    </>
  );
}
