import { pb } from "./pb";
import type { Plan } from "../store";

export interface Invoice {
  payUrl: string;
  invoiceId: string;
}

// Создаёт счёт на оплату тарифа через серверный хук PocketBase (тот, в свою
// очередь, обращается к Crypto Pay API с секретным токеном).
export async function createInvoice(plan: Exclude<Plan, "free">): Promise<Invoice> {
  if (!pb) throw new Error("Бэкенд не настроен");
  return pb.send("/pay/invoice", { method: "POST", body: { plan } });
}

// Проверяет статус счёта. Если оплачен — сервер сам поднимает тариф пользователю.
export async function checkInvoice(invoiceId: string): Promise<{ paid: boolean; plan?: Plan }> {
  if (!pb) return { paid: false };
  return pb.send("/pay/check", { method: "GET", query: { invoiceId } });
}

// Открыть ссылку оплаты во внешнем браузере/Телеграме.
export async function openExternal(url: string): Promise<void> {
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (isTauri) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      return;
    } catch { /* упадём на window.open */ }
  }
  window.open(url, "_blank");
}
