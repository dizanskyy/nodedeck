import { useStore, type MainTab } from "../store";
import { signOut } from "../lib/auth";
import { IconDashboard, IconServers, IconCrown, IconTeam, IconUser, IconLogout } from "./icons";

const tabs: { id: MainTab; label: string; icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: "dashboard", label: "Главная", icon: IconDashboard },
  { id: "servers", label: "Серверы", icon: IconServers },
  { id: "subscriptions", label: "Подписки", icon: IconCrown },
  { id: "teams", label: "Команды", icon: IconTeam },
  { id: "profile", label: "Профиль", icon: IconUser },
];

export function Nav() {
  const { tab, setTab, user, setUser, setPhase } = useStore();

  async function logout() {
    await signOut();
    setUser(null);
    setPhase("auth");
  }

  return (
    <nav className="nav">
      <div className="nav-brand titlebar-drag">
        <span className="splash-mark" />
        <span className="nav-word">NodeDeck</span>
      </div>

      <div className="nav-items">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <Icon size={18} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="nav-foot">
        <div className="nav-user" onClick={() => setTab("profile")}>
          <div className="avatar">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" />
              : <span>{(user?.name ?? "U").slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="nav-user-info">
            <div className="nm">{user?.name}</div>
            <div className="em">{user?.email}</div>
          </div>
        </div>
        <button className="nav-logout" title="Выйти" onClick={logout}><IconLogout size={16} /></button>
      </div>
    </nav>
  );
}
