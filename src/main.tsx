import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { registerServiceWorker } from "@/lib/pwa";
import "@/lib/sentry";

// Initialize platform services
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
