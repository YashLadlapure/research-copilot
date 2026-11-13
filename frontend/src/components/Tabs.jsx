import { useRef } from 'react';

// A tab list with the keyboard behaviour screen-reader users expect: one tab
// stop, arrow keys to move, Home and End to jump.
export default function Tabs({ options, value, onChange, label, variant = 'underline' }) {
  const buttons = useRef([]);

  const handleKeyDown = (event) => {
    const index = options.findIndex((option) => option.id === value);
    const last = options.length - 1;
    const target = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (target === undefined) return;

    event.preventDefault();
    onChange(options[target].id);
    buttons.current[target]?.focus();
  };

  return (
    <div className={`tabs tabs--${variant}`} role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
      {options.map((option, index) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`tabs__tab${selected ? ' tabs__tab--selected' : ''}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
            {option.count !== undefined && <span className="tabs__count">{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
