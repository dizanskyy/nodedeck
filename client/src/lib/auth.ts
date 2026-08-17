import { pb } from "./pb";
import { isBackendConfigured } from "./config";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider: "google" | "discord" | "demo";
}

const DEMO_KEY = "nodedeck.demo.user";

function fromRecord(rec: Record<string, unknown>, provider: User["provider"]): User {
  return {
    id: String(rec.id),
    email: String(rec.email ?? ""),
    name: String(rec.name || rec.username || rec.email || "user"),
    avatarUrl: (rec.avatarUrl as string) || (rec.avatar as string) || undefined,
    provider,
  };
}

// Текущий пользователь из сохранённой сессии PocketBase или демо-хранилища.
export async function getCurrentUser(): Promise<User | null> {
  if (pb) {
    if (!pb.authStore.isValid || !pb.authStore.record) return null;
    const r = pb.authStore.record as unknown as Record<string, unknown>;
    return fromRecord(r, (r.provider as User["provider"]) ?? "google");
  }
  const raw = localStorage.getItem(DEMO_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

// Вход через OAuth-провайдера. PocketBase сам открывает окно провайдера
// (authWithOAuth2) и сохраняет сессию. В демо-режиме — локальный пользователь.
export async function signIn(provider: "google" | "discord"): Promise<User | null> {
  if (pb) {
    const res = await pb.collection("users").authWithOAuth2({ provider });
    const r = res.record as unknown as Record<string, unknown>;
    return fromRecord(r, provider);
  }
  const user: User = {
    id: `demo-${provider}`,
    email: provider === "google" ? "you@gmail.com" : "you@discord",
    name: provider === "google" ? "Демо (Google)" : "Демо (Discord)",
    provider,
  };
  localStorage.setItem(DEMO_KEY, JSON.stringify(user));
  return user;
}

// Вход по email + паролю (быстрый способ проверить связку с PocketBase).
export async function signInWithEmail(email: string, password: string): Promise<User> {
  if (pb) {
    const res = await pb.collection("users").authWithPassword(email, password);
    const r = res.record as unknown as Record<string, unknown>;
    return fromRecord(r, "demo");
  }
  const user: User = { id: "demo-email", email, name: email.split("@")[0], provider: "demo" };
  localStorage.setItem(DEMO_KEY, JSON.stringify(user));
  return user;
}

// Саморегистрация: создаёт аккаунт и сразу входит.
export async function signUp(email: string, password: string, name?: string): Promise<User> {
  if (pb) {
    await pb.collection("users").create({
      email, password, passwordConfirm: password,
      name: name || email.split("@")[0],
    });
    const res = await pb.collection("users").authWithPassword(email, password);
    const r = res.record as unknown as Record<string, unknown>;
    return fromRecord(r, "demo");
  }
  const user: User = { id: "demo-email", email, name: name || email.split("@")[0], provider: "demo" };
  localStorage.setItem(DEMO_KEY, JSON.stringify(user));
  return user;
}

export async function signOut(): Promise<void> {
  if (pb) pb.authStore.clear();
  localStorage.removeItem(DEMO_KEY);
}

// Подписка на изменения сессии.
export function onAuthChange(cb: (u: User | null) => void): () => void {
  if (!pb) return () => {};
  return pb.authStore.onChange(() => { void getCurrentUser().then(cb); });
}

export const backendConfigured = isBackendConfigured;
