import { createRoot } from "react-dom/client";
import App from "./App";
import { installApiAuthFetch } from "@/lib/api-fetch";
import "./index.css";

// Patch fetch before React mounts so early /api calls get Clerk Bearer tokens (Cloudflare/proxy).
installApiAuthFetch();

createRoot(document.getElementById("root")!).render(<App />);
