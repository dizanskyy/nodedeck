import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Шрифты бандлятся локально (CSP в Tauri блокирует внешние источники).
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/unbounded/700.css";
import "@fontsource/unbounded/800.css";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
