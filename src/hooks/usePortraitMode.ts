import { useState, useEffect } from 'react';

/**
 * Detects if the viewport is in portrait mode (height > width).
 * Updates on resize and orientation change.
 */
export function usePortraitMode(): boolean {
  const [isPortrait, setIsPortrait] = useState(() => {
    return window.innerHeight > window.innerWidth;
  });

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);

    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);

    // Also check via matchMedia for more reliable detection
    const mql = window.matchMedia('(orientation: portrait)');
    const handleChange = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mql.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
      mql.removeEventListener('change', handleChange);
    };
  }, []);

  return isPortrait;
}
