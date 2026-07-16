import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "./index.css";
import App from "./App.tsx";
import { Toaster } from "@/components/ui/sonner";
import { registerSW } from "virtual:pwa-register";

// Register service worker - caches app shell for offline use, never caches API calls
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
      <Toaster position="bottom-left" duration={1000}/>
    </MotionConfig>
  </StrictMode>
);
