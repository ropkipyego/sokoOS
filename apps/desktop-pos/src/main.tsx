import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PosApp } from "./PosApp";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <PosApp />
  </StrictMode>,
);
