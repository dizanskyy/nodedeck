import { useEffect, useRef, useState } from "react";
import { useStore, type Plan } from "../../store";
import { backendConfigured } from "../../lib/auth";
import { createInvoice, checkInvoice, openExternal } from "../../lib/pay";
import { IconCheck } from "../icons";

const plans: { id: Plan; name: string; price: string; usdt: string; period: string; features: string[]; cta: string }[] = [
  { id: "free", name: "Free", price: "0", usdt: "", period: "навсегда",
    features: ["До 3 серверов", "Терминал и мониторинг", "1 команда до 2 человек", "Локальное хранение доступов"], cta: "Текущий" },
  { id: "pro", name: "Pro", price: "3 USDT", usdt: "3", period: "в месяц",
    features: ["Безлимит серверов", "История метрик 30 дней", "Сниппеты и массовые команды", "Приоритетная поддержка"], cta: "Оформить Pro" },
  { id: "team", name: "Team", price: "8 USDT", usdt: "8", period: "в месяц",
    features: ["Всё из Pro", "Безлимит команд и участников", "Гранулярные права доступа", "Аудит-лог действий"], cta: "Оформить Team" },
];

type PayState = { plan: Exclude<Plan, "free">; invoiceId: string; payUrl: string } | null;

export function SubscriptionsView() {
  const { plan, setPlan } = useStore();
  const [pay, setPay] = useState<PayState>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(p: Plan) {
    if (p === "free") return;
    setError(null);
    if (!backendConfigured) { setPlan(p); return; } // демо
    try {
      const inv = await createInvoice(p);
      setPay({ plan: p, invoiceId: inv.invoiceId, payUrl: inv.payUrl });
      await openExternal(inv.payUrl);
    } catch (e) {
      setError("Не удалось создать счёт. Проверьте, что оплата настроена на сервере (CRYPTOBOT.md).");
      void e;
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Подписки</div>
        <h1 className="page-title">Выбери свой тариф.</h1>
        <p className="page-sub">Оплата криптой через Telegram (@CryptoBot). Отмена в любой момент.</p>
      </header>

      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="price-grid">
        {plans.map((p) => (
          <div className={`price-card ${plan === p.id ? "current" : ""} ${p.id === "pro" ? "featured" : ""}`} key={p.id}>
            {p.id === "pro" && <div className="price-badge">Популярный</div>}
            <div className="price-name">{p.name}</div>
            <div className="price-value">{p.price} <small>{p.usdt ? `/ ${p.period}` : p.period}</small></div>
            <ul className="price-feat">
              {p.features.map((f) => <li key={f}><IconCheck size={15} /> {f}</li>)}
            </ul>
            <button className={`btn ${p.id === "pro" ? "" : "ghost"}`} disabled={plan === p.id} onClick={() => buy(p.id)}>
              {plan === p.id ? "Текущий тариф" : p.cta}
            </button>
          </div>
        ))}
      </div>

      {!backendConfigured && (
        <p className="page-sub" style={{ marginTop: 20 }}>
          Демо-режим: оплата не подключена, тариф переключается локально.
          Реальная оплата включится после настройки сервера.
        </p>
      )}

      {pay && (
        <PayModal
          state={pay}
          onClose={() => setPay(null)}
          onPaid={(newPlan) => { setPlan(newPlan); setPay(null); }}
        />
      )}
    </div>
  );
}

function PayModal({ state, onClose, onPaid }: {
  state: NonNullable<PayState>; onClose: () => void; onPaid: (p: Plan) => void;
}) {
  const [status, setStatus] = useState<"waiting" | "paid">("waiting");
  const tries = useRef(0);

  useEffect(() => {
    const id = setInterval(async () => {
      tries.current++;
      try {
        const r = await checkInvoice(state.invoiceId);
        if (r.paid) { setStatus("paid"); clearInterval(id); setTimeout(() => onPaid(r.plan ?? state.plan), 1200); }
      } catch { /* продолжаем опрос */ }
      if (tries.current > 200) clearInterval(id); // ~10 минут
    }, 3000);
    return () => clearInterval(id);
  }, [state.invoiceId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">Оплата тарифа {state.plan === "pro" ? "Pro" : "Team"}</div>
        <div className="modal-body" style={{ textAlign: "center" }}>
          {status === "waiting" ? (
            <>
              <div className="pay-spinner" />
              <p style={{ margin: "14px 0" }}>Ожидаем оплату в Telegram…</p>
              <p className="page-sub" style={{ marginBottom: 14 }}>
                Если окно оплаты не открылось — нажмите кнопку ниже.
              </p>
              <button className="btn ghost" onClick={() => openExternal(state.payUrl)}>Открыть оплату</button>
            </>
          ) : (
            <>
              <div className="pay-ok"><IconCheck size={28} /></div>
              <p style={{ margin: "14px 0" }}>Оплата получена. Тариф активирован!</p>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
