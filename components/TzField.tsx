'use client';
import { useEffect, useRef } from 'react';

/** Fills a hidden time-zone field from the browser. Falls back to UTC if unavailable. */
export function TzField({ name = 'timezone' }: { name?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (ref.current && tz) ref.current.value = tz;
    } catch {
      /* keep default */
    }
  }, []);
  return <input ref={ref} type="hidden" name={name} defaultValue="UTC" />;
}
