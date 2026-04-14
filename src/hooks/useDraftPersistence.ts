import { useEffect, useCallback, useRef } from "react";

/**
 * Auto-saves form state to localStorage. Debounced to avoid excessive writes.
 * Returns: { clearDraft } to call after successful submission.
 */
export function useDraftPersistence<T>(
  key: string,
  state: T,
  setState: (val: T) => void,
  debounceMs = 1000
) {
  const storageKey = `draft:${key}`;
  const initialized = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Restore draft on mount (once)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState(parsed);
      }
    } catch {
      // ignore
    }
  }, [storageKey]); // eslint-disable-line

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!initialized.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // storage full, ignore
      }
    }, debounceMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state, storageKey, debounceMs]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { clearDraft };
}
