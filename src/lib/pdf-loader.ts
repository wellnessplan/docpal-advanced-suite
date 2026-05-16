// Dynamic loader for jsPDF. Keeps the ~400KB library out of the initial bundle —
// only fetched when the user actually clicks Download/Preview.
import type JsPDFType from "jspdf";

let cached: typeof JsPDFType | null = null;
let inflight: Promise<typeof JsPDFType> | null = null;

export async function loadJsPdf(): Promise<typeof JsPDFType> {
  if (cached) return cached;
  if (!inflight) {
    inflight = import("jspdf").then((m) => {
      cached = m.default;
      return cached;
    });
  }
  return inflight;
}

// Preload jsPDF in idle time on routes that almost certainly need it
// (Billing, Reports). Use sparingly — calling this defeats the lazy benefit.
export function prefetchJsPdf() {
  if (cached || inflight) return;
  const idle = (cb: () => void) =>
    (window as any).requestIdleCallback
      ? (window as any).requestIdleCallback(cb, { timeout: 3000 })
      : setTimeout(cb, 1500);
  idle(() => { void loadJsPdf(); });
}
