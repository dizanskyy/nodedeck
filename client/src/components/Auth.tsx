import { useState } from "react";
import { signIn, signInWithEmail, signUp, backendConfigured, type User } from "../lib/auth";
import { config, setBackendUrl } from "../lib/config";

// Экран входа. Кнопки Google и Discord. При настроенном Supabase —
// реальный OAuth; иначе локальный демо-вход.
export function Auth({ onSignedIn }: { onSignedIn: (u: User) => void }) {
  const [busy, setBusy] = useState<"google" | "discord" | "email" | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handle(provider: "google" | "discord") {
    setBusy(provider); setError(null);
    try {
      const u = await signIn(provider);
      if (u) onSignedIn(u);
    } catch (e) { setError((e as Error).message); }
    setBusy(null);
  }

  async function handleEmail() {
    if (!email || !password) return;
    if (password.length < 8) { setError("Пароль минимум 8 символов"); return; }
    setBusy("email"); setError(null);
    try {
      const u = mode === "register"
        ? await signUp(email, password)
        : await signInWithEmail(email, password);
      onSignedIn(u);
    } catch (e) {
      const base = mode === "register"
        ? "Не удалось создать аккаунт"
        : "Не удалось войти";
      const detail = (e as { message?: string })?.message || String(e);
      setError(`${base}: ${detail}`);
    }
    setBusy(null);
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="splash-mark" />
          <span className="display" style={{ fontSize: 28 }}>NodeDeck</span>
        </div>
        <p className="auth-lead">Войдите, чтобы управлять серверами, командами и подписками.</p>

        <button className="oauth-btn" disabled={!!busy} onClick={() => handle("google")}>
          <GoogleIcon />
          <span>{busy === "google" ? "Входим…" : "Продолжить с Google"}</span>
        </button>
        <button className="oauth-btn" disabled={!!busy} onClick={() => handle("discord")}>
          <DiscordIcon />
          <span>{busy === "discord" ? "Входим…" : "Продолжить с Discord"}</span>
        </button>

        <div className="auth-divider"><span>{mode === "login" ? "или по email" : "регистрация по email"}</span></div>
        <div className="field" style={{ marginBottom: 10 }}>
          <input className="input" type="email" placeholder="email" value={email}
                 onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <input className="input" type="password" placeholder={mode === "register" ? "пароль (мин. 8 символов)" : "пароль"} value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") handleEmail(); }} />
        </div>
        <button className="btn" style={{ width: "100%", justifyContent: "center" }}
                disabled={!!busy || !email || !password} onClick={handleEmail}>
          {busy === "email" ? "Секунду…" : mode === "register" ? "Создать аккаунт" : "Войти"}
        </button>
        <button className="auth-switch"
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
          {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>

        {error && <div className="auth-error">{error}</div>}

        <ServerConfig />

        {!backendConfigured && (
          <div className="auth-note">
            Демо-режим: адрес PocketBase не задан, вход эмулируется локально.
            Укажите адрес сервера ниже, чтобы включить реальный вход.
          </div>
        )}
        <div className="auth-legal">
          Продолжая, вы соглашаетесь с условиями использования и политикой конфиденциальности.
        </div>
      </div>
    </div>
  );
}

function ServerConfig() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(config.pocketbaseUrl);
  return (
    <div className="server-config">
      <button className="server-config-toggle" onClick={() => setOpen((o) => !o)}>
        {config.pocketbaseUrl
          ? `Сервер: ${config.pocketbaseUrl}`
          : "Настроить адрес сервера"}
      </button>
      {open && (
        <div className="server-config-body">
          <input className="input" placeholder="http://IP-сервера:8090" value={url}
                 onChange={(e) => setUrl(e.target.value)} />
          <button className="btn ghost" onClick={() => setBackendUrl(url)}>Сохранить</button>
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 009 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 010-3.44V4.95H.96a9 9 0 000 8.1l3.01-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 00.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}
function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.3 4.4A19.8 19.8 0 0015.4 3l-.2.4a18.3 18.3 0 015.5 2.7 13.5 13.5 0 00-4.9-1.6 13.6 13.6 0 00-1.6-.1c-.5 0-1 0-1.6.1A13.5 13.5 0 003.3 6.1 18.3 18.3 0 018.8 3.4L8.6 3A19.8 19.8 0 003.7 4.4C1.2 8.1.6 11.7.9 15.2a19.9 19.9 0 006 3l.8-1.3c-.7-.3-1.4-.6-2-1l.5-.4a14.2 14.2 0 0012 0l.5.4c-.6.4-1.3.7-2 1l.8 1.3a19.9 19.9 0 006-3c.4-4.1-.6-7.7-3.5-10.8zM9 13.4c-.9 0-1.7-.8-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.7 1.9-1.7 1.9zm6 0c-.9 0-1.7-.8-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.7 1.9-1.7 1.9z"/>
    </svg>
  );
}
