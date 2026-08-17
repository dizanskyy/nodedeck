import { useEffect, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { checkForUpdate, installUpdate } from "../lib/updater";

// Проверяет обновления при запуске и показывает окно установки, если апдейт есть.
export function UpdateGate() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { checkForUpdate().then(setUpdate); }, []);

  if (!update || dismissed) return null;

  async function install() {
    if (!update) return;
    setInstalling(true); setError(null);
    try {
      await installUpdate(update, setProgress);
    } catch (e) {
      setError((e as Error).message || String(e));
      setInstalling(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal update-modal">
        <div className="modal-header">Доступно обновление</div>
        <div className="modal-body">
          <p className="update-version">Вышла новая версия {update.version}</p>
          {update.body && <pre className="update-notes">{update.body}</pre>}
          {installing && (
            <div className="update-bar"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          )}
          {error && <div className="auth-error">{error}</div>}
        </div>
        <div className="modal-footer">
          {!installing && <button className="btn ghost" onClick={() => setDismissed(true)}>Позже</button>}
          <button className="btn" disabled={installing} onClick={install}>
            {installing ? `Установка… ${Math.round(progress * 100)}%` : "Установить"}
          </button>
        </div>
      </div>
    </div>
  );
}
