import { useState } from "react";
import { useStore, type Server } from "../../store";
import { sshTest, credsOf } from "../../lib/ssh";
import { ServerDetail } from "./ServerDetail";
import { IconPlus, IconTrash, IconChevron } from "../icons";

export function ServersView() {
  const { servers, activeServerId, openServer, removeServer } = useStore();
  const [adding, setAdding] = useState(false);

  const active = servers.find((s) => s.id === activeServerId);
  if (active) return <ServerDetail server={active} />;

  return (
    <div className="page">
      <header className="page-head row">
        <div>
          <div className="eyebrow">Серверы</div>
          <h1 className="page-title">Все хостинги в одном окне.</h1>
        </div>
        <button className="btn" onClick={() => setAdding(true)}><IconPlus size={16} /> Добавить</button>
      </header>

      {servers.length === 0 && !adding && (
        <div className="empty-block">
          <p>Пока нет ни одного сервера. Подключите первый хостинг по SSH.</p>
          <button className="btn" onClick={() => setAdding(true)}>Добавить сервер →</button>
        </div>
      )}

      <div className="server-list">
        {servers.map((s) => (
          <div key={s.id} className="server-row" onClick={() => openServer(s.id)}>
            <span className={`status-dot ${s.status}`} />
            <div className="server-main">
              <div className="server-name">{s.name}</div>
              <div className="server-host">{s.username}@{s.host}:{s.port}</div>
            </div>
            <span className="server-group">{s.group}</span>
            <button className="row-del" title="Удалить" onClick={(e) => { e.stopPropagation(); removeServer(s.id); }}>
              <IconTrash size={16} />
            </button>
            <IconChevron size={16} />
          </div>
        ))}
      </div>

      {adding && <AddServerModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddServerModal({ onClose }: { onClose: () => void }) {
  const { addServer, openServer, setServerStatus } = useStore();
  const [f, setF] = useState({
    name: "", host: "", port: "22", username: "root", group: "Мои серверы",
    authKind: "password" as "password" | "key", password: "", privateKey: "",
  });
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const on = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  function build(): Omit<Server, "id" | "status"> {
    return {
      name: f.name || f.host, host: f.host, port: +f.port || 22, username: f.username,
      group: f.group || "Мои серверы", authKind: f.authKind,
      password: f.authKind === "password" ? f.password : undefined,
      privateKey: f.authKind === "key" ? f.privateKey : undefined,
    };
  }

  async function test() {
    setTesting(true); setResult(null);
    try {
      await sshTest(credsOf(build() as Server));
      setResult("ok");
    } catch (e) { setResult((e as Error)?.message || String(e) || "неизвестная ошибка"); }
    setTesting(false);
  }

  async function save() {
    const srv = addServer(build());
    // Пробуем подключиться в фоне, чтобы обновить индикатор.
    setServerStatus(srv.id, "connecting");
    sshTest(credsOf(srv)).then(
      () => setServerStatus(srv.id, "online"),
      () => setServerStatus(srv.id, "offline"),
    );
    openServer(srv.id);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">Добавить сервер</div>
        <div className="modal-body">
          <div className="field"><label>Имя</label><input className="input" placeholder="web-prod-01" value={f.name} onChange={on("name")} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="field" style={{ flex: 3 }}><label>Хост / IP</label><input className="input" placeholder="203.0.113.10" value={f.host} onChange={on("host")} autoFocus /></div>
            <div className="field" style={{ flex: 1 }}><label>Порт</label><input className="input" value={f.port} onChange={on("port")} /></div>
          </div>
          <div className="field"><label>Пользователь</label><input className="input" value={f.username} onChange={on("username")} /></div>

          <div className="seg">
            <button className={f.authKind === "password" ? "active" : ""} onClick={() => setF((p) => ({ ...p, authKind: "password" }))}>Пароль</button>
            <button className={f.authKind === "key" ? "active" : ""} onClick={() => setF((p) => ({ ...p, authKind: "key" }))}>Приватный ключ</button>
          </div>
          {f.authKind === "password"
            ? <div className="field"><label>Пароль</label><input className="input" type="password" value={f.password} onChange={on("password")} /></div>
            : <div className="field"><label>Приватный ключ (PEM)</label><textarea className="input" rows={4} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" value={f.privateKey} onChange={on("privateKey")} /></div>}

          {result && (
            <div className={`test-result ${result === "ok" ? "ok" : "err"}`}>
              {result === "ok" ? "Подключение успешно ✓" : `Ошибка: ${result}`}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn ghost" onClick={test} disabled={testing || !f.host}>{testing ? "Проверка…" : "Проверить"}</button>
          <button className="btn" onClick={save} disabled={!f.host}>Добавить</button>
        </div>
      </div>
    </div>
  );
}
