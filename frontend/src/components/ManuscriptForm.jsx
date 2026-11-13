import { useRef, useState } from 'react';
import { PROFILES } from '../profiles';
import { countWords } from '../text';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export default function ManuscriptForm({
  text,
  onTextChange,
  profile,
  onProfileChange,
  onAnalyze,
  onUpload,
  onLoadSample,
  analyzing,
  uploading,
  uploadNote,
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
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        onAnalyze();
      }}
    >
      <div
        className={`dropzone${dragging ? ' dropzone--active' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <p className="dropzone__text">
          {uploading ? 'Extracting text from the PDF…' : 'Drop a PDF here, or'}
        </p>
        {!uploading && (
          <button type="button" className="btn btn--secondary btn--small" onClick={() => fileInput.current.click()}>
            Choose a PDF
          </button>
        )}
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
      </div>
      {fileError && <p className="field-error" role="alert">{fileError}</p>}
      {uploadNote && <p className="field-hint">{uploadNote}</p>}

      <div className="field">
        <div className="field__row">
          <label htmlFor="manuscript-text">Manuscript text</label>
          <button type="button" className="link-button" onClick={onLoadSample} disabled={busy}>
            Use sample paper
          </button>
        </div>
        <textarea
          id="manuscript-text"
          className="textarea"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Paste the full text, starting with the title."
          spellCheck={false}
        />
        <p className="field-hint">{words > 0 ? `${words.toLocaleString()} words` : 'Text from an uploaded PDF appears here for you to check.'}</p>
      </div>

      <div className="field">
        <label htmlFor="profile">Target format</label>
        <select id="profile" className="select" value={profile} onChange={(event) => onProfileChange(event.target.value)} disabled={busy}>
          {PROFILES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn btn--primary" disabled={busy || words === 0}>
        {analyzing ? 'Checking…' : 'Check manuscript'}
      </button>

      <p className="privacy-note">
        Text is sent to this app's server and, for title detection and refinement, to Google's Gemini API.
        It is held in memory for up to an hour and never written to disk. Do not submit work you cannot share.
      </p>
    </form>
  );
}
