import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export default function InstallPromptBanner() {
  const isMobile = useIsMobile();
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (!isMobile) return;
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) return;

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // For iOS/Safari — show after 3s since there's no beforeinstallprompt
    const timer = setTimeout(() => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS && !dismissed) setShow(true);
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, [isMobile]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
    dismiss();
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!show || !isMobile) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] md:hidden bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-lg animate-fade-in">
      <Download className="h-5 w-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Install DoctorsBuddy</p>
        <p className="text-xs opacity-80">Add to home screen for quick access</p>
      </div>
      {deferredPrompt ? (
        <Button size="sm" variant="secondary" onClick={handleInstall} className="shrink-0 h-8">
          Install
        </Button>
      ) : (
        <p className="text-[10px] opacity-70 shrink-0">Use Share → Add to Home Screen</p>
      )}
      <button onClick={dismiss} className="shrink-0 p-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
