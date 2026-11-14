import { useRef, useState } from 'react';
import { profileLabel } from '../profiles';
import { countWords } from '../text';
import ProfileSwitch from './ProfileSwitch';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export default function ManuscriptForm({
  text,
  onTextChange,
  profile,
  onProfileChange,
  onAnalyze,
  onUpload,
  onTrySample,
  analyzing,
  uploading,
  uploadNote,
  slow,
}) {
  const fileInput = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState(null);

  const acceptFile = (file) => {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) return setFileError('Only PDF files can be uploaded. For Word or LaTeX, paste the text.');
    if (file.size > MAX_PDF_BYTES) return setFileError('That PDF is larger than 10 MB.');
    setFileError(null);
    onUpload(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  };

  const words = countWords(text);
  const busy = analyzing || uploading;

  return (
    <>
      <form
        className={`composer${dragging ? ' composer--dragging' : ''}`}
        data-tour="composer"
        onSubmit={(event) => {
          event.preventDefault();
          onAnalyze();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <label htmlFor="manuscript-text" className="visually-hidden">Manuscript text</label>
        <textarea
          id="manuscript-text"
          className="composer__text"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Paste the full text of your paper, starting with the title. Or drop a PDF here."
          spellCheck={false}
          disabled={uploading}
        />

        <div className="composer__bar">
          <ProfileSwitch value={profile} onChange={onProfileChange} disabled={busy} data-tour="format" />
          <button
            type="button"
            className="btn btn--secondary"
            data-tour="pdf"
            onClick={() => fileInput.current.click()}
            disabled={busy}
          >
            {uploading ? 'Reading the PDF…' : 'Choose a PDF'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(event) => {
              acceptFile(event.target.files[0]);
              event.target.value = '';
            }}
          />
          <span className="composer__count">{words > 0 && `${words.toLocaleString()} words`}</span>
          <button type="submit" className="btn btn--primary" data-tour="check" disabled={busy || words === 0}>
            {analyzing ? 'Checking…' : 'Check manuscript'}
          </button>
        </div>
      </form>

      <div className="start__status" aria-live="polite">
        {fileError && <p className="field-error" role="alert">{fileError}</p>}
        {!fileError && uploadNote && !busy && <p className="field-hint">{uploadNote}</p>}
        {busy && (
          <p className="field-hint">
            {analyzing ? `Checking against ${profileLabel(profile)}…` : 'Extracting text from the PDF…'}
            {slow && ' The server sleeps when idle and can take up to a minute to wake.'}
          </p>
        )}
      </div>

      <p className="start__sample" data-tour="sample">
        No paper to hand?{' '}
        <button type="button" className="link-button" onClick={onTrySample} disabled={busy}>
          Try the sample paper
        </button>
        , a made-up one with deliberate mistakes.
      </p>

      <p className="privacy-note">
        Text is sent to this app's server and, for title detection and refinement, to Google's Gemini API.
        It is held in memory for up to an hour and never written to disk. Do not submit work you cannot share.
      </p>
    </>
  );
}
