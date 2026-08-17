/// <reference path="../pb_data/types.d.ts" />
// NodeDeck — оплата подписок через Crypto Pay API (@CryptoBot).
// Кладётся в папку pb_hooks рядом с pocketbase.exe.
// Токен берётся из переменной окружения CRYPTOBOT_TOKEN (в приложение не попадает).
//
// Цены в USDT — меняйте здесь.
const PRICES = { pro: "3", team: "8" };
const CRYPTO_API = "https://pay.crypt.bot/api";

// Создать счёт на оплату тарифа.
routerAdd("POST", "/pay/invoice", (e) => {
  const auth = e.auth;
  if (!auth) return e.json(401, { message: "Требуется вход" });

  const token = $os.getenv("CRYPTOBOT_TOKEN");
  if (!token) return e.json(500, { message: "CRYPTOBOT_TOKEN не задан на сервере" });

  const plan = e.requestInfo().body.plan;
  const amount = PRICES[plan];
  if (!amount) return e.json(400, { message: "Неизвестный тариф" });

  const res = $http.send({
    url: CRYPTO_API + "/createInvoice",
    method: "POST",
    headers: { "Crypto-Pay-API-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      currency_type: "crypto",
      asset: "USDT",
      amount: amount,
      description: "NodeDeck " + plan,
      payload: JSON.stringify({ userId: auth.id, plan: plan }),
      expires_in: 3600,
    }),
    timeout: 20,
  });

  const data = res.json;
  if (!data || !data.ok) return e.json(502, { message: "Ошибка CryptoBot", detail: data });
  return e.json(200, { payUrl: data.result.pay_url, invoiceId: String(data.result.invoice_id) });
});

// Проверить оплату счёта; если оплачен — активировать тариф пользователю.
routerAdd("GET", "/pay/check", (e) => {
  const auth = e.auth;
  if (!auth) return e.json(401, { message: "Требуется вход" });

  const token = $os.getenv("CRYPTOBOT_TOKEN");
  if (!token) return e.json(500, { message: "CRYPTOBOT_TOKEN не задан на сервере" });

  const invoiceId = e.requestInfo().query.invoiceId;
  if (!invoiceId) return e.json(400, { message: "нет invoiceId" });

  const res = $http.send({
    url: CRYPTO_API + "/getInvoices?invoice_ids=" + invoiceId,
    method: "GET",
    headers: { "Crypto-Pay-API-Token": token },
    timeout: 20,
  });

  const data = res.json;
  if (!data || !data.ok) return e.json(502, { message: "Ошибка CryptoBot" });

  const items = (data.result && data.result.items) || [];
  const inv = items[0];
  if (!inv || inv.status !== "paid") return e.json(200, { paid: false });

  let payload = {};
  try { payload = JSON.parse(inv.payload || "{}"); } catch (_) { /* ignore */ }
  if (payload.userId !== auth.id) return e.json(200, { paid: false });

  const user = $app.findRecordById("users", auth.id);
  user.set("plan", payload.plan);
  $app.save(user);
  return e.json(200, { paid: true, plan: payload.plan });
});
