import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { createPlatform } from "./platform";
import "./styles/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("index.html no tiene #root");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App platform={createPlatform()} />
    </ErrorBoundary>
  </StrictMode>,
);
