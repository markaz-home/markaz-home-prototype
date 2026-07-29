'use client';

import { useEffect } from 'react';

const activeThemes = new Map<string, number>();

/**
 * Mirrors a route-group theme class onto body so Radix portals inherit the
 * same semantic tokens as their trigger. A reference count prevents a route
 * transition between two equally themed groups from removing the class early.
 */
export function BodyTheme({ className }: { className: 'theme-platform-gold' }) {
  useEffect(() => {
    const count = activeThemes.get(className) ?? 0;
    activeThemes.set(className, count + 1);
    document.body.classList.add(className);

    return () => {
      const nextCount = (activeThemes.get(className) ?? 1) - 1;
      if (nextCount <= 0) {
        activeThemes.delete(className);
        document.body.classList.remove(className);
      } else {
        activeThemes.set(className, nextCount);
      }
    };
  }, [className]);

  return null;
}
