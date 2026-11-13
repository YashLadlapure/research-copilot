import { useMemo, useState } from 'react';
import { diffWords } from 'diff';

const VIEWS = [
  { id: 'changes', label: 'Changes' },
  { id: 'original', label: 'Original' },
  { id: 'revised', label: 'Revised' },
];

// PDF text is hard-wrapped at the page width. Joining those lines lets the
// text reflow in the panel while blank lines still separate paragraphs.
function reflow(text) {
  return text.replace(/([^\n])\n(?!\n)/g, '$1 ');
}

export default function DiffView({ original, revised }) {
  const [view, setView] = useState('changes');
  const before = useMemo(() => reflow(original), [original]);
  const after = useMemo(() => reflow(revised), [revised]);
  const parts = useMemo(() => diffWords(before, after), [before, after]);

  return (
    <div className="diff">
      <div className="segmented" role="tablist" aria-label="Revision view">
        {VIEWS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={view === option.id}
            className={`segmented__option${view === option.id ? ' segmented__option--active' : ''}`}
            onClick={() => setView(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="diff__text" role="tabpanel">
        {view === 'original' && before}
        {view === 'revised' && after}
        {view === 'changes' &&
          parts.map((part, index) => {
            if (part.added) return <ins key={index}>{part.value}</ins>;
            if (part.removed) return <del key={index}>{part.value}</del>;
            return <span key={index}>{part.value}</span>;
          })}
      </div>
    </div>
  );
}
