import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Проверка наличия обновления. В браузере/при ошибке сети — тихо возвращает null.
export async function checkForUpdate(): Promise<Update | null> {
  try {
    const update = await check();
    return update ?? null;
  } catch {
    return null;
  }
}

// Скачивание и установка обновления с колбэком прогресса (0..1), затем перезапуск.
export async function installUpdate(update: Update, onProgress?: (p: number) => void): Promise<void> {
  let total = 0;
  let done = 0;
  await update.downloadAndInstall((ev) => {
    switch (ev.event) {
      case "Started":
        total = ev.data.contentLength ?? 0;
        break;
      case "Progress":
        done += ev.data.chunkLength;
        if (total) onProgress?.(done / total);
        break;
      case "Finished":
        onProgress?.(1);
        break;
    }
  });
  await relaunch();
}
