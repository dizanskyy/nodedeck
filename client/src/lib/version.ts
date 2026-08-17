// Версия приложения из Tauri (Cargo.toml). В браузере — заглушка.
export async function appVersion(): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("app_version");
  } catch {
    return "0.1.0";
  }
}

export const PUBLISHER = "Dizansky Development";
