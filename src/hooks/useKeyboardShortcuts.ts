import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+K → Global search (focus search input on patients page)
      if (isMod && e.key === "k") {
        e.preventDefault();
        navigate("/patients");
        setTimeout(() => {
          const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
          searchInput?.focus();
        }, 300);
        return;
      }

      // Single key shortcuts (no modifier)
      if (isMod || e.altKey || e.shiftKey) return;

      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          navigate("/patients");
          setTimeout(() => {
            const btn = document.querySelector<HTMLButtonElement>('button:has(.lucide-plus)');
            btn?.click();
          }, 300);
          break;
        case "q":
          e.preventDefault();
          navigate("/queue");
          break;
        case "d":
          e.preventDefault();
          navigate("/dashboard");
          break;
        case "a":
          e.preventDefault();
          navigate("/appointments");
          break;
        case "b":
          e.preventDefault();
          navigate("/billing");
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
}
