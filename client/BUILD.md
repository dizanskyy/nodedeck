# Сборка NodeDeck (Windows)

Итог: файл `NodeDeck_0.1.0_x64-setup.exe` — мастер установки с экраном
принятия лицензии, ярлыком на рабочем столе и в меню Пуск.

## 1. Установить инструменты (один раз)

- **Node.js 20+** — https://nodejs.org
- **Rust** — https://rustup.rs (нужен для Tauri)
- **Microsoft C++ Build Tools** (Desktop development with C++) —
  https://visualstudio.microsoft.com/visual-cpp-build-tools/
- **WebView2** — на Windows 11 уже есть.

Проверка:
```bash
node --version
rustc --version
```

## 2. Установить зависимости и сгенерировать иконки

```bash
cd D:\NodeDeck\client
npm install
npm run tauri icon app-icon.svg
```

`tauri icon` создаёт все нужные форматы (`.ico`, `.png`, `.icns`) в
`src-tauri/icons/` из одного `app-icon.svg`. Без этого шага сборка упадёт.

## 3. Запуск в режиме разработки

```bash
npm run app:dev
```

Откроется окно приложения с hot-reload.

## 4. Сборка установщика

```bash
npm run app:build
```

Готовые файлы появятся здесь:
```
src-tauri/target/release/bundle/nsis/NodeDeck_0.1.0_x64-setup.exe   ← основной установщик
src-tauri/target/release/bundle/msi/NodeDeck_0.1.0_x64_en-US.msi     ← MSI (для GPO/корпоративной установки)
```

## Ярлык на рабочем столе

NSIS-установщик по умолчанию предлагает создать ярлык на рабочем столе и
в меню Пуск. Мастер: Язык → Лицензия (текст из `LICENSE_EULA.txt`) →
Папка установки → Установка → Готово.

## Подпись кода (для релиза, чтобы не было предупреждения SmartScreen)

Нужен сертификат Authenticode. Добавьте в `tauri.conf.json`:
```json
"windows": { "certificateThumbprint": "…", "digestAlgorithm": "sha256",
             "timestampUrl": "http://timestamp.digicert.com" }
```

## Замечания

- **WiX (MSI)** требует лицензию в формате **RTF**. Если нужен именно MSI с
  лицензией — сконвертируйте `LICENSE_EULA.txt` в `.rtf` и укажите его в
  `bundle.windows.wix.license`. Для NSIS (`.exe`) достаточно `.txt`.
- Версии npm/cargo-зависимостей указаны минимальные; `npm install` и
  `cargo` подтянут совместимые патч-версии.
