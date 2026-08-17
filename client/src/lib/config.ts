// Конфигурация бэкенда PocketBase (self-hosted на вашем хосте).
//
// Адрес можно задать двумя способами:
//   1) прямо в приложении (поле «Сервер» на экране входа) — сохраняется локально;
//   2) при сборке через .env: VITE_POCKETBASE_URL=https://ваш-хост:8090
//
// Пока адрес не задан — приложение работает в ДЕМО-режиме (вход эмулируется).
const LS_KEY = "nodedeck.pbUrl";

function readUrl(): string {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) return stored;
  } catch { /* localStorage недоступен */ }
  return import.meta.env.VITE_POCKETBASE_URL ?? "";
}

export const config = {
  pocketbaseUrl: readUrl(),
};

export const isBackendConfigured = Boolean(config.pocketbaseUrl);

// Сохранить адрес и перезагрузить приложение (чтобы пересоздать клиент PB).
export function setBackendUrl(url: string) {
  const clean = url.trim().replace(/\/+$/, "");
  if (clean) localStorage.setItem(LS_KEY, clean);
  else localStorage.removeItem(LS_KEY);
  location.reload();
}
