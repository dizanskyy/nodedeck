// NodeDeck — точка входа Tauri.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ssh;

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            app_version,
            ssh::ssh_test,
            ssh::ssh_exec,
            ssh::ssh_disconnect,
        ])
        .run(tauri::generate_context!())
        .expect("ошибка запуска NodeDeck");
}
