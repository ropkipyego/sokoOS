/**
 * Electron main-process stub.
 * Install `electron` when packaging; the Vite web app runs standalone without it.
 */

// Ambient types so this stub typechecks without the electron package installed.
declare module "electron" {
  export class BrowserWindow {
    constructor(options: Record<string, unknown>);
    loadFile(filePath: string): Promise<void>;
    static getAllWindows(): unknown[];
  }
  export const app: {
    whenReady(): Promise<void>;
    on(event: string, listener: () => void): void;
    quit(): void;
  };
}

import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "SokoOS POS",
  });

  const distIndex = path.join(__dirname, "..", "dist", "index.html");
  void win.loadFile(distIndex);
}

void app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
