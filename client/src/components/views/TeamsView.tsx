import { useState } from "react";
import { useStore, type Perm, type Team } from "../../store";
import { IconPlus, IconCheck, IconTrash } from "../icons";

const PERMS: { id: Perm; label: string; hint: string }[] = [
  { id: "view", label: "Просмотр", hint: "Видит статус и метрики" },
  { id: "terminal", label: "Терминал", hint: "Может выполнять команды" },
  { id: "files", label: "Файлы", hint: "Доступ к файловому менеджеру" },
  { id: "manage", label: "Управление", hint: "Меняет настройки и права" },
];

export function TeamsView() {
  const { teams, addTeam } = useStore();
  const [selected, setSelected] = useState<string | null>(teams[0]?.id ?? null);
  const [newName, setNewName] = useState("");

  const team = teams.find((t) => t.id === selected) ?? teams[0];

  return (
    <div className="page">
      <header className="page-head row">
        <div>
          <div className="eyebrow">Команды</div>
          <h1 className="page-title">Общий доступ с правами.</h1>
          <p className="page-sub">Создай команду, добавь людей и реши, кто чем управляет.</p>
        </div>
      </header>

      <div className="teams-layout">
        <aside className="teams-side">
          {teams.map((t) => (
            <button key={t.id} className={`team-pill ${team?.id === t.id ? "active" : ""}`} onClick={() => setSelected(t.id)}>
              <b>{t.name}</b><span>{t.members.length} чел.</span>
            </button>
          ))}
          <div className="team-create">
            <input className="input" placeholder="Название команды" value={newName}
                   onChange={(e) => setNewName(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) { addTeam(newName.trim()); setNewName(""); } }} />
            <button className="btn" onClick={() => { if (newName.trim()) { addTeam(newName.trim()); setNewName(""); } }}>
              <IconPlus size={16} /> Создать
            </button>
          </div>
        </aside>

        <section className="teams-main">
          {team ? <TeamPanel team={team} /> : (
            <div className="empty-block"><p>Создай первую команду слева.</p></div>
          )}
        </section>
      </div>
    </div>
  );
}

function TeamPanel({ team }: { team: Team }) {
  const { servers, addMember, setMemberPerms, toggleTeamServer, removeTeam, user } = useStore();
  const [email, setEmail] = useState("");

  // Управлять командой может только её владелец.
  const isOwner = team.ownerId === user?.id;

  function invite() {
    const name = email.split("@")[0] || "участник";
    if (!email) return;
    addMember(team.id, { name, email, role: "member", perms: ["view"] });
    setEmail("");
  }

  return (
    <div>
      <div className="teams-main-head">
        <h2 className="display" style={{ fontSize: 22 }}>{team.name}</h2>
        {isOwner && <button className="row-del" title="Удалить команду" onClick={() => removeTeam(team.id)}><IconTrash size={16} /></button>}
      </div>

      {!isOwner && (
        <div className="auth-note" style={{ marginBottom: 16 }}>
          Вы участник этой команды. Настраивать права и состав может только владелец.
        </div>
      )}

      <div className="section-label">Участники и права</div>
      <div className="perm-table">
        <div className="perm-row perm-head">
          <div className="perm-name">Участник</div>
          {PERMS.map((p) => <div key={p.id} className="perm-col" title={p.hint}>{p.label}</div>)}
        </div>
        {team.members.map((mm) => {
          const isOwnerRow = mm.role === "owner";
          return (
            <div className="perm-row" key={mm.id}>
              <div className="perm-name">
                <div className="avatar sm"><span>{mm.name.slice(0, 1).toUpperCase()}</span></div>
                <div>
                  <div className="pm-name">{mm.name} {isOwnerRow && <span className="tag">владелец</span>}</div>
                  <div className="pm-email">{mm.email || "—"}</div>
                </div>
              </div>
              {PERMS.map((p) => {
                const on = mm.perms.includes(p.id);
                return (
                  <div key={p.id} className="perm-col">
                    <button
                      className={`perm-box ${on ? "on" : ""}`}
                      // Права меняет только владелец команды; строку самого владельца не трогаем.
                      disabled={!isOwner || isOwnerRow}
                      onClick={() => {
                        const next = on ? mm.perms.filter((x) => x !== p.id) : [...mm.perms, p.id];
                        setMemberPerms(team.id, mm.id, next);
                      }}
                    >
                      {on && <IconCheck size={13} />}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {isOwner && (
        <div className="invite-row">
          <input className="input" placeholder="email участника" value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") invite(); }} />
          <button className="btn ghost" onClick={invite}>Пригласить</button>
        </div>
      )}

      <div className="section-label">Серверы команды</div>
      {servers.length === 0
        ? <p className="page-sub">Сначала добавьте серверы во вкладке «Серверы».</p>
        : (
          <div className="share-list">
            {servers.map((s) => {
              const shared = team.serverIds.includes(s.id);
              return (
                <button key={s.id} className={`share-item ${shared ? "on" : ""}`}
                        disabled={!isOwner}
                        onClick={() => isOwner && toggleTeamServer(team.id, s.id)}>
                  <span className={`perm-box ${shared ? "on" : ""}`}>{shared && <IconCheck size={13} />}</span>
                  <span className="share-name">{s.name}</span>
                  <span className="share-host">{s.host}</span>
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}
