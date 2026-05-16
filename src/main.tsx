import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorHandlers } from "./lib/error-tracking";
import { initSentry } from "./lib/sentry";
import { registerPwa } from "./lib/pwa-register";

initSentry();
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker (no-op in dev / Lovable preview).
void registerPwa();
