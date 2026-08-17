import { useEffect } from "react";
import { useStore } from "./store";
import { getCurrentUser, onAuthChange } from "./lib/auth";
import { Splash } from "./components/Splash";
import { Auth } from "./components/Auth";
import { Nav } from "./components/Nav";
import { DashboardView } from "./components/views/DashboardView";
import { ServersView } from "./components/views/ServersView";
import { SubscriptionsView } from "./components/views/SubscriptionsView";
import { TeamsView } from "./components/views/TeamsView";
import { ProfileView } from "./components/views/ProfileView";
import { UpdateGate } from "./components/UpdateGate";

export default function App() {
  const { phase, tab, user, setPhase, setUser, loadTeams, loadPlan } = useStore();

  // При старте: проверяем существующую сессию и подписываемся на OAuth-возврат.
  useEffect(() => {
    getCurrentUser().then((u) => { if (u) setUser(u); });
    return onAuthChange((u) => {
      if (u) { setUser(u); setPhase("app"); }
    });
  }, []);

  // После входа подгружаем команды и тариф из PocketBase.
  useEffect(() => {
    if (phase === "app" && user) { void loadTeams(); loadPlan(); }
  }, [phase, user]);

  if (phase === "splash") {
    return <Splash onDone={() => setPhase(user ? "app" : "auth")} />;
  }
  if (phase === "auth" || !user) {
    return <><UpdateGate /><Auth onSignedIn={(u) => { setUser(u); setPhase("app"); }} /></>;
  }

  return (
    <div className="shell">
      <UpdateGate />
      <Nav />
      <main className="shell-main">
        {tab === "dashboard" && <DashboardView />}
        {tab === "servers" && <ServersView />}
        {tab === "subscriptions" && <SubscriptionsView />}
        {tab === "teams" && <TeamsView />}
        {tab === "profile" && <ProfileView />}
      </main>
    </div>
  );
}
