import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

const container = document.getElementById("root");
if (!container) throw new Error("Failed to find the root element");

createRoot(container).render(
  // Keep StrictMode in production only for this app.
  // In development, camera and ML pipelines are effect-heavy and should not be
  // double-mounted by React's dev-only strict effects.
  import.meta.env.PROD ? (
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  ) : (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  ),
);
