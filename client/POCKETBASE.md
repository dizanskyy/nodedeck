# PocketBase на Windows Server 2022 (бэкенд NodeDeck)

Пока URL не задан, приложение работает в демо-режиме (вход локальный).
Ниже — как поднять реальный бэкенд на вашем Windows Server.

## 1. Скачать PocketBase
1. https://github.com/pocketbase/pocketbase/releases → возьмите
   `pocketbase_<версия>_windows_amd64.zip`.
2. Распакуйте, например, в `C:\NodeDeck\pocketbase\`. Внутри — `pocketbase.exe`.

## 2. Первый запуск
В PowerShell на сервере:
```powershell
cd C:\NodeDeck\pocketbase
.\pocketbase.exe serve --http="0.0.0.0:8090"
```
Откройте `http://<IP-сервера>:8090/_/` — создайте аккаунт администратора.

Откройте порт в брандмауэре:
```powershell
New-NetFirewallRule -DisplayName "PocketBase 8090" -Direction Inbound -Protocol TCP -LocalPort 8090 -Action Allow
```

## 3. Запуск как службы Windows (чтобы работало всегда)
Скачайте NSSM (https://nssm.cc), затем:
```powershell
nssm install NodeDeckPB "C:\NodeDeck\pocketbase\pocketbase.exe" "serve --http=0.0.0.0:8090"
nssm start NodeDeckPB
```
Теперь PocketBase стартует автоматически и переживает перезагрузку.

## 4. Коллекции (таблицы)
Админка → Settings → **Import collections** → вставьте
`pocketbase/pb_schema.json`. Создадутся коллекции `teams`, `team_members`,
`team_servers` с правилами доступа (кто что видит и меняет).

## 5. Вход Google / Discord
Админка → Collections → **users** → вкладка **Options → OAuth2**:

- **Google**: включите провайдера, вставьте Client ID/Secret из
  https://console.cloud.google.com. Redirect URL берётся из PocketBase.
- **Discord**: включите провайдера, Client ID/Secret из
  https://discord.com/developers/applications.

## 6. HTTPS (обязательно для продакшена)
PocketBase умеет сам получать сертификат Let's Encrypt, если запустить на
домене и порте 443:
```powershell
.\pocketbase.exe serve --http="0.0.0.0:80" --https="0.0.0.0:443"
```
(нужен домен, указывающий на IP сервера).

## 7. Подключить приложение
Создайте файл `.env` в папке `client`:
```
VITE_POCKETBASE_URL=https://ваш-домен-или-ip:8090
```
Пересоберите: `npm run app:build`. Кнопки Google/Discord начнут выполнять
реальный вход, команды и права будут храниться в PocketBase.

## Почему PocketBase
- Один бинарник, никакого Docker и отдельной БД — бэкап = папка `pb_data`.
- Auth Google/Discord и правила доступа встроены.
- Лёгкий: работает на самом скромном сервере, не падает.
- Данные только на вашем хосте.
