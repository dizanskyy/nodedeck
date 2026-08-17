import { useStore } from "../../store";

export function DashboardView() {
  const { servers, teams, plan, user, setTab } = useStore();
  const online = servers.filter((s) => s.status === "online").length;
  const members = teams.reduce((n, t) => n + t.members.length, 0);

  const stats = [
    { idx: "01", label: "Серверов", value: String(servers.length), foot: `${online} онлайн` },
    { idx: "02", label: "Команд", value: String(teams.length), foot: `${members} участников` },
    { idx: "03", label: "Тариф", value: plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Team", foot: plan === "free" ? "базовый" : "активен" },
    { idx: "04", label: "Аккаунт", value: user?.provider === "discord" ? "Discord" : user?.provider === "google" ? "Google" : "Demo", foot: user?.email ?? "" },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Главная</div>
        <h1 className="page-title">Привет, {user?.name?.split(" ")[0] ?? "друг"}.</h1>
        <p className="page-sub">Обзор твоей инфраструктуры в одном окне.</p>
      </header>

      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.idx}>
            <span className="idx">{s.idx}</span>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-foot">{s.foot}</div>
          </div>
        ))}
      </div>

      <div className="section-label">Быстрые действия</div>
      <div className="quick-row">
        <button className="quick" onClick={() => setTab("servers")}>
          <b>Добавить сервер</b><span>Подключить хостинг по SSH</span>
        </button>
        <button className="quick" onClick={() => setTab("teams")}>
          <b>Создать команду</b><span>Пригласить людей и раздать права</span>
        </button>
        <button className="quick" onClick={() => setTab("subscriptions")}>
          <b>Открыть Premium</b><span>Больше серверов и команд</span>
        </button>
      </div>

      {servers.length > 0 && (
        <>
          <div className="section-label">Серверы</div>
          <div className="mini-list">
            {servers.slice(0, 6).map((s) => (
              <button key={s.id} className="mini-row" onClick={() => useStore.getState().openServer(s.id)}>
                <span className={`status-dot ${s.status}`} />
                <span className="mini-name">{s.name}</span>
                <span className="mini-host">{s.username}@{s.host}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
