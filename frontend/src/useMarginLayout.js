import { useEffect, useLayoutEffect } from 'react';

const WIDE_LAYOUT = '(min-width: 1100px)';
const GAP = 12;

// On a wide screen each section's notes hang in the margin beside it. Notes
// for a short section can be taller than the section itself, so every group is
// pushed down just far enough to clear the one above it.
function placeNotes(root) {
  const wide = window.matchMedia(WIDE_LAYOUT).matches;
  const origin = root.getBoundingClientRect().top;
  let floor = 0;

  for (const group of root.querySelectorAll('.notes')) {
    if (!wide) {
      group.style.transform = '';
      continue;
    }
    const anchor = group.parentElement.getBoundingClientRect().top - origin;
    const top = Math.max(anchor, floor);
    group.style.transform = top > anchor ? `translateY(${top - anchor}px)` : '';
    floor = top + group.offsetHeight + GAP;
  }

  root.style.minHeight = wide ? `${floor}px` : '';
}

export function useMarginLayout(ref) {
  useLayoutEffect(() => {
    placeNotes(ref.current);
  });

  useEffect(() => {
    const root = ref.current;
    const place = () => placeNotes(root);
    const observer = new ResizeObserver(place);
    observer.observe(root.querySelector('.sheet'));
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [ref]);
}
