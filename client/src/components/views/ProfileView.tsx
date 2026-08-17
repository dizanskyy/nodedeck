import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { signOut } from "../../lib/auth";
import { appVersion, PUBLISHER } from "../../lib/version";

export function ProfileView() {
  const { user, setUser, setPhase, servers } = useStore();
  const [name, setName] = useState(user?.name ?? "");
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => { appVersion().then(setVersion); }, []);

  function save() {
    if (user) setUser({ ...user, name });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  async function logout() {
    await signOut();
    setUser(null);
    setPhase("auth");
  }

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Профиль</div>
        <h1 className="page-title">Твой аккаунт.</h1>
      </header>

      <div className="profile-top">
        <div className="avatar big">
          {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{(user?.name ?? "U").slice(0, 1).toUpperCase()}</span>}
        </div>
        <div>
          <div className="profile-name">{user?.name}</div>
          <div className="profile-email">{user?.email}</div>
          <div className="profile-provider">Вход через {user?.provider === "discord" ? "Discord" : user?.provider === "google" ? "Google" : "демо"}</div>
        </div>
      </div>

      <div className="card-block">
        <div className="field">
          <label>Отображаемое имя</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" value={user?.email ?? ""} disabled />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn" onClick={save}>Сохранить</button>
          {saved && <span className="page-sub">Сохранено ✓</span>}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn ghost" onClick={logout}>Выйти из аккаунта</button>
      </div>

      <div className="app-footer">
        <span>Серверов: {servers.length}</span>
        <span className="dot">·</span>
        <span>v{version}</span>
        <span className="dot">·</span>
        <span>{PUBLISHER}</span>
      </div>
    </div>
  );
}
