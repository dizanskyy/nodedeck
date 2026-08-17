# Автообновление NodeDeck — как выпускать релизы

Приложение при запуске проверяет GitHub Releases и, если есть новая версия,
показывает окно «Вышла новая версия X.Y.Z» с кнопкой **Установить**.

## Однократная настройка (делается один раз)

### 1. Указать свой репозиторий
В файле `client/src-tauri/tauri.conf.json` замените `OWNER/REPO` на свой
GitHub-репозиторий:

```
"endpoints": [
  "https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПО/releases/latest/download/latest.json"
]
```

Тот же `OWNER/REPO` использует воркфлоу `.github/workflows/release.yml` —
он публикует релиз именно в репозиторий, из которого запускается, отдельно менять не нужно.

### 2. Добавить секреты подписи в GitHub
Настройки репозитория → **Settings → Secrets and variables → Actions → New secret**:

| Имя секрета                          | Значение                                             |
|--------------------------------------|------------------------------------------------------|
| `TAURI_SIGNING_PRIVATE_KEY`          | всё содержимое файла `client/src-tauri/nodedeck_update.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | пустая строка (ключ создан без пароля)               |

> Приватный ключ `nodedeck_update.key` — СЕКРЕТНЫЙ. Не коммитьте его в репозиторий
> (он уже добавлен в `.gitignore`). Публичный ключ уже вшит в `tauri.conf.json`.

## Выпуск новой версии

1. Поднимите номер версии в двух местах (одинаково):
   - `client/package.json` → `"version"`
   - `client/src-tauri/tauri.conf.json` → `"version"`
   - `client/src-tauri/Cargo.toml` → `version`
2. Закоммитьте и создайте тег с этой версией:

   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

3. GitHub Actions сам соберёт подписанный установщик, создаст релиз `NodeDeck v1.2.3`
   и приложит `latest.json`. Через пару минут все установленные приложения при
   следующем запуске увидят обновление.

## Проверка вручную (без CI)
Локальная сборка с подписью:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content client\src-tauri\nodedeck_update.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
cd client; npm run app:build
```

Артефакты появятся в `client/src-tauri/target/release/bundle/` —
`.exe`, `.exe.sig` и `latest.json`. Их и нужно приложить к релизу, если публикуете руками.
