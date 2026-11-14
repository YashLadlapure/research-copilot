import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { rememberTour } from '../tourSteps';

const SPOT_PAD = 8;
const EDGE = 12;
const GAP = 14;
const POPOVER_WIDTH = 340;

// A step-by-step walkthrough that dims the page and lights up one element at a
// time. It is opened by the caller and always records that it was seen, so a
// new visitor gets it once.
export default function Tour({ tour, onClose }) {
  const [steps] = useState(() => tour.steps.filter((step) => document.querySelector(step.target)));
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState(null);
  const [popover, setPopover] = useState({ top: 0, left: 0 });
  const popoverRef = useRef(null);
  const step = steps[index];

  const close = useCallback(() => {
    rememberTour(tour.key);
    onClose();
  }, [tour.key, onClose]);

  const place = useCallback(() => {
    const element = step && document.querySelector(step.target);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setSpot({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });

    const width = Math.min(POPOVER_WIDTH, window.innerWidth - EDGE * 2);
    const height = popoverRef.current?.offsetHeight ?? 0;
    let top = rect.bottom + SPOT_PAD + GAP;
    if (top + height > window.innerHeight - EDGE) top = rect.top - SPOT_PAD - GAP - height;
    top = Math.min(Math.max(top, EDGE), Math.max(EDGE, window.innerHeight - height - EDGE));
    const centred = rect.left + rect.width / 2 - width / 2;
    const left = Math.min(Math.max(centred, EDGE), window.innerWidth - width - EDGE);
    setPopover({ top, left, width });
  }, [step]);

  useEffect(() => {
    if (steps.length === 0) close();
  }, [steps, close]);

  // Bring the element into view, then follow it while the page settles.
  useLayoutEffect(() => {
    if (!step) return undefined;
    document.querySelector(step.target)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const first = requestAnimationFrame(place);
    const follow = () => requestAnimationFrame(place);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    const settle = setTimeout(place, 450);
    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
      cancelAnimationFrame(first);
      clearTimeout(settle);
    };
  }, [step, place]);

  useEffect(() => {
    popoverRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(current + 1, steps.length - 1));
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(current - 1, 0));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, steps.length]);

  if (!step) return null;
  const last = index === steps.length - 1;

  return (
    <div className="tour">
      {spot && (
        <div
          className="tour__spot"
          style={{
            top: spot.top - SPOT_PAD,
            left: spot.left - SPOT_PAD,
            width: spot.width + SPOT_PAD * 2,
            height: spot.height + SPOT_PAD * 2,
          }}
        />
      )}
      <div
        ref={popoverRef}
        className="tour__card"
        role="dialog"
        aria-label={`Tour, step ${index + 1} of ${steps.length}`}
        tabIndex={-1}
        style={{ top: popover.top, left: popover.left, width: popover.width }}
      >
        <p className="tour__count">
          {index + 1} of {steps.length}
        </p>
        <h2 className="tour__title">{step.title}</h2>
        <p className="tour__body">{step.body}</p>
        <div className="tour__actions">
          <button type="button" className="link-button" onClick={close}>
            Skip tour
          </button>
          <span className="tour__nav">
            {index > 0 && (
              <button type="button" className="btn btn--secondary btn--small" onClick={() => setIndex(index - 1)}>
                Back
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => (last ? close() : setIndex(index + 1))}
            >
              {last ? 'Done' : 'Next'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
