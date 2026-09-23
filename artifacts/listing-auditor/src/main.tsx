import { createRoot } from "react-dom/client";
import App from "./App";
import { installApiAuthFetch } from "@/lib/api-fetch";
import { CHUNK_RELOAD_SESSION_KEY } from "@/lib/chunk-load-error";
import { initWebVitalsReporting } from "@/lib/report-web-vitals";
import "./index.css";

// Patch fetch before React mounts so early /api calls get Clerk Bearer tokens (Cloudflare/proxy).
installApiAuthFetch();
try {
  sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
} catch {
  /* ignore */
}
initWebVitalsReporting();

createRoot(document.getElementById("root")!).render(<App />);
