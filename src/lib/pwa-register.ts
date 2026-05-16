// PWA registration with update prompts. Guards against running inside the
// Lovable preview iframe (which causes stale-cache & navigation issues).
import { toast } from "sonner";

function isPreviewOrIframe(): boolean {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com") || h === "localhost";
}

export async function registerPwa() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isPreviewOrIframe()) {
    // Aggressively clean up any SW previously registered in preview/iframe.
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch { /* ignore */ }
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      onNeedRefresh() {
        toast("New version available", {
          description: "Reload to get the latest update.",
          duration: Infinity,
          action: {
            label: "Reload",
            onClick: () => updateSW(true),
          },
        });
      },
      onOfflineReady() {
        toast.success("App ready to work offline");
      },
    });
  } catch (e) {
    console.warn("[pwa] registration failed", e);
  }
}
