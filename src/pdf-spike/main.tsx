import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { SpikeApp } from "./SpikeApp";
import "@/styles/globals.css";

/** Entrada de `spike.html`, el laboratorio de la Fase 4. TEMPORAL: se borra en la Fase 5. */
const root = document.getElementById("root");
if (!root) throw new Error("spike.html no tiene #root");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <SpikeApp />
    </ErrorBoundary>
  </StrictMode>,
);
