import { useEffect, useState } from 'react';
import './App.css';
import {
  wakeServer,
  analyzeManuscript,
  switchProfile,
  refineSection,
  applySuggestion,
  revertRevision,
  extractPdf,
} from './api';
import { downloadText, fileName, manuscriptText } from './exportText';
import { PROFILES } from './profiles';
import { SAMPLE_MANUSCRIPT } from './sampleManuscript';
import ManuscriptForm from './components/ManuscriptForm';
import ProfileSwitch from './components/ProfileSwitch';
import ReportPanel from './components/ReportPanel';
import PrintableReport from './components/PrintableReport';
import ThemeToggle from './components/ThemeToggle';
import Tour from './components/Tour';
import { START_TOUR, REPORT_TOUR, tourSeen } from './tourSteps';

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

// wakeServer keeps retrying for about two minutes, so one answer settles it.
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
  return [status, setStatus];
}

// The pasted text and chosen format survive a reload. Storage can be missing
// or full (private windows, large papers), and the app works without it.
const DRAFT_KEY = 'research-copilot:draft';
const DRAFT_SAVE_DELAY_MS = 500;

function readDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    const known = PROFILES.some((option) => option.value === draft?.profile);
    return { text: typeof draft?.text === 'string' ? draft.text : '', profile: known ? draft.profile : 'lncs' };
  } catch {
    return { text: '', profile: 'lncs' };
  }
}

function useSavedDraft(text, profile) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (text.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, profile }));
        else localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Not saving the draft is fine; the text is still in the form.
      }
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, profile]);
}

// Accepted revisions live only in this tab and in a server session that
// expires, so leaving before downloading them loses them.
function useLeaveWarning(active) {
  useEffect(() => {
    if (!active) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}

const SERVER_MESSAGES = {
  waking: 'Waking the server. The first check can take up to a minute.',
  down: 'Still no answer from the server. You can try the check anyway.',
};

export default function App() {
  const [draft] = useState(readDraft);
  const [text, setText] = useState(draft.text);
  const [profile, setProfile] = useState(draft.profile);
  const [analysis, setAnalysis] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [acknowledged, setAcknowledged] = useState(() => new Set());
  const [refinement, setRefinement] = useState(IDLE);

  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [undoing, setUndoing] = useState(null);
  const [downloaded, setDownloaded] = useState(false);
  const [uploadNote, setUploadNote] = useState(null);
  const [error, setError] = useState(null);

  const [server, setServer] = useServerStatus();
  const slow = useSlowHint(analyzing || uploading);
  const unsavedRevisions = revisions.length > 0 && !downloaded;
  useSavedDraft(text, profile);
  useLeaveWarning(unsavedRevisions);

  // A first-time visitor gets a short tour of each screen once. The button in
  // the top bar opens it again.
  const [tour, setTour] = useState(null);
  const screen = analysis ? REPORT_TOUR : START_TOUR;
  useEffect(() => {
    if (tourSeen(screen.key)) return undefined;
    const timer = setTimeout(() => setTour(screen), 900);
    return () => clearTimeout(timer);
  }, [screen]);

  const clearSession = () => {
    setAnalysis(null);
    setRevisions([]);
    setDownloaded(false);
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
      setServer('ready');
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
      setDownloaded(false);
      setRefinement(IDLE);
    } catch (err) {
      reportFailure(err);
    } finally {
      setApplying(false);
    }
  };

  const handleUndo = async (section) => {
    setUndoing(section);
    setError(null);
    try {
      const result = await revertRevision(analysis.sessionId, section);
      setAnalysis((current) => ({ ...current, report: result.report, document: result.document }));
      setRevisions(result.revisions);
      setDownloaded(false);
      if (refinement.section === section) setRefinement(IDLE);
    } catch (err) {
      reportFailure(err);
    } finally {
      setUndoing(null);
    }
  };

  const handleDownload = () => {
    downloadText(manuscriptText(analysis.title, analysis.document), fileName(analysis.title));
    setDownloaded(true);
  };

  const handleNewCheck = () => {
    if (unsavedRevisions && !window.confirm('Start a new check? Accepted revisions you have not downloaded will be lost.')) {
      return;
    }
    clearSession();
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
                <button type="button" className="btn btn--secondary btn--small" onClick={handleNewCheck}>
                  New check
                </button>
                <button type="button" className="btn btn--secondary btn--small" data-tour="print" onClick={() => window.print()}>
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
          <ThemeToggle />
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setTour(screen)}>
            How it works
          </button>
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
              onUndo={handleUndo}
              onDownload={handleDownload}
              undoing={undoing}
            />
          </main>
        ) : (
          <main className="start">
            <h1 className="start__headline">See your paper marked up before you submit it.</h1>
            <p className="start__lede">
              Research Copilot checks a manuscript against Springer LNCS, IEEE, ACM or ACL conference formatting rules
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

      {tour && <Tour key={tour.key} tour={tour} onClose={() => setTour(null)} />}

      {analysis && <PrintableReport analysis={analysis} revisions={revisions} acknowledged={acknowledged} />}
    </>
  );
}
