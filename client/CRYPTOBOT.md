# Оплата подписок через @CryptoBot (Crypto Pay)

Оплата встроена в PocketBase через хук `pb_hooks/pay.pb.js`. Секретный токен
живёт только на сервере (в приложение не попадает).

## 1. Получить API-токен @CryptoBot
1. В Telegram откройте **@CryptoBot** (для тестов — **@CryptoTestnetBot**).
2. Отправьте `/start` → **Crypto Pay** → **Create App**.
3. Задайте имя приложения → бот выдаст **API Token** (длинная строка).
   Скопируйте его. Никому не показывайте.

## 2. Добавить поле тарифа пользователю
Админка PocketBase → **Collections → users** → **+ New field**:
- `plan` — тип **Plain text**, значение по умолчанию (Default) — `free`.
Сохраните.

## 3. Положить хук на сервер
Файл `pocketbase/pb_hooks/pay.pb.js` (из проекта) скопируйте на сервер в папку
рядом с `pocketbase.exe`:
```
C:\NodeDeck\pocketbase\pb_hooks\pay.pb.js
```
(создайте папку `pb_hooks`, если её нет).

## 4. Запустить PocketBase с токеном
Остановите текущий процесс (Ctrl+C в его окне) и запустите так (подставьте свой токен):
```powershell
cd C:\NodeDeck\pocketbase
$env:CRYPTOBOT_TOKEN = "ВАШ_ТОКЕН_ОТ_CRYPTOBOT"
.\pocketbase.exe serve --http="0.0.0.0:8090"
```
В логах должно появиться, что хук `pay.pb.js` загружен.

Для службы (NSSM) переменную окружения задают так:
```powershell
nssm set NodeDeckPB AppEnvironmentExtra CRYPTOBOT_TOKEN=ВАШ_ТОКЕН
nssm restart NodeDeckPB
```

## 5. Цены
Меняются в начале файла `pay.pb.js`:
```js
const PRICES = { pro: "3", team: "8" };   // в USDT
```

## Как это работает
1. В приложении «Оформить Pro» → сервер создаёт счёт в @CryptoBot → открывается
   ссылка оплаты в Telegram.
2. Приложение опрашивает сервер, оплачен ли счёт.
3. Как только оплачено — сервер сам ставит пользователю `plan = pro/team`,
   приложение обновляет тариф.

## Тест без реальных денег
Используйте **@CryptoTestnetBot** и в `pay.pb.js` замените адрес на тестовый:
```js
const CRYPTO_API = "https://testnet-pay.crypt.bot/api";
```
Пополните тестовый баланс в @CryptoTestnetBot и проверьте полный цикл оплаты.
Для боевого режима верните `https://pay.crypt.bot/api`.
