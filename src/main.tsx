import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorHandlers } from "./lib/error-tracking";
import { initSentry } from "./lib/sentry";

initSentry();
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);
