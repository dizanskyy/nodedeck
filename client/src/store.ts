import { create } from "zustand";
import type { User } from "./lib/auth";
import { fetchTeams, createTeamRec, saveTeamRec, deleteTeamRec, teamsBackend } from "./lib/teams";
import { pb } from "./lib/pb";

export type AppPhase = "splash" | "auth" | "app";
export type MainTab = "dashboard" | "servers" | "subscriptions" | "teams" | "profile";
export type ServerStatus = "online" | "offline" | "connecting";

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  group: string;
  authKind: "password" | "key";
  password?: string;      // хранится локально (в проде — OS Keyring)
  privateKey?: string;
  status: ServerStatus;
}

export type Role = "owner" | "admin" | "member";
export type Perm = "view" | "terminal" | "files" | "manage";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  perms: Perm[];
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  members: TeamMember[];
  serverIds: string[]; // какие серверы расшарены в команду
}

export type Plan = "free" | "pro" | "team";

interface State {
  phase: AppPhase;
  user: User | null;
  tab: MainTab;

  servers: Server[];
  teams: Team[];
  plan: Plan;

  activeServerId?: string;

  setPhase: (p: AppPhase) => void;
  setUser: (u: User | null) => void;
  setTab: (t: MainTab) => void;

  loadTeams: () => Promise<void>;
  loadPlan: () => void;

  addServer: (s: Omit<Server, "id" | "status">) => Server;
  removeServer: (id: string) => void;
  setServerStatus: (id: string, s: ServerStatus) => void;
  openServer: (id: string) => void;

  addTeam: (name: string) => void;
  removeTeam: (id: string) => void;
  addMember: (teamId: string, m: Omit<TeamMember, "id">) => void;
  setMemberPerms: (teamId: string, memberId: string, perms: Perm[]) => void;
  toggleTeamServer: (teamId: string, serverId: string) => void;
  _persist: (teamId: string) => void;

  setPlan: (p: Plan) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

// Серверы храним локально (в т.ч. с доступами) — приватность по умолчанию.
const SERVERS_KEY = "nodedeck.servers";
const loadServers = (): Server[] => {
  try { return JSON.parse(localStorage.getItem(SERVERS_KEY) ?? "[]"); } catch { return []; }
};
const saveServers = (s: Server[]) =>
  localStorage.setItem(SERVERS_KEY, JSON.stringify(s.map((x) => ({ ...x, status: "offline" }))));

export const useStore = create<State>((set, get) => ({
  phase: "splash",
  user: null,
  tab: "dashboard",
  servers: loadServers(),
  teams: [],
  plan: "free",

  setPhase: (phase) => set({ phase }),
  setUser: (user) => set({ user }),
  setTab: (tab) => set({ tab }),

  // Загрузка команд из PocketBase (если бэкенд настроен).
  loadTeams: async () => {
    if (!teamsBackend) return;
    try {
      const all = await fetchTeams();
      const me = get().user;
      // Показываем только команды, где пользователь владелец или участник.
      const mine = all.filter((t) =>
        t.ownerId === me?.id ||
        t.members.some((m) => m.id === me?.id || (!!m.email && m.email === me?.email)));
      set({ teams: mine });
    } catch { /* оффлайн — оставляем как есть */ }
  },
  // Тариф хранится в записи пользователя PocketBase.
  loadPlan: () => {
    const p = (pb?.authStore?.record as unknown as { plan?: string } | null)?.plan;
    if (p === "pro" || p === "team" || p === "free") set({ plan: p });
  },

  addServer: (s) => {
    const srv: Server = { ...s, id: uid(), status: "offline" };
    const servers = [...get().servers, srv];
    set({ servers });
    saveServers(servers);
    return srv;
  },
  removeServer: (id) => {
    const servers = get().servers.filter((x) => x.id !== id);
    set({ servers });
    saveServers(servers);
  },
  setServerStatus: (id, status) =>
    set((st) => ({ servers: st.servers.map((x) => (x.id === id ? { ...x, status } : x)) })),
  openServer: (id) => set({ activeServerId: id, tab: "servers" }),

  addTeam: (name) => {
    const st = get();
    const ownerId = st.user?.id ?? "me";
    const base: Omit<Team, "id"> = {
      name, ownerId, serverIds: [],
      members: [{ id: ownerId, name: st.user?.name ?? "Вы", email: st.user?.email ?? "", role: "owner", perms: ["view", "terminal", "files", "manage"] }],
    };
    if (teamsBackend) {
      // Создаём запись на сервере, затем добавляем с реальным id.
      createTeamRec(base).then((team) => set((s) => ({ teams: [...s.teams, team] })))
        .catch((e) => console.error("createTeam:", e));
    } else {
      set((s) => ({ teams: [...s.teams, { ...base, id: uid() }] }));
    }
  },
  removeTeam: (id) => {
    set((st) => ({ teams: st.teams.filter((t) => t.id !== id) }));
    if (teamsBackend) deleteTeamRec(id).catch((e) => console.error("deleteTeam:", e));
  },
  addMember: (teamId, m) => {
    set((st) => ({ teams: st.teams.map((t) => t.id === teamId ? { ...t, members: [...t.members, { ...m, id: uid() }] } : t) }));
    get()._persist(teamId);
  },
  setMemberPerms: (teamId, memberId, perms) => {
    set((st) => ({ teams: st.teams.map((t) => t.id === teamId
      ? { ...t, members: t.members.map((mm) => mm.id === memberId ? { ...mm, perms } : mm) } : t) }));
    get()._persist(teamId);
  },
  toggleTeamServer: (teamId, serverId) => {
    set((st) => ({ teams: st.teams.map((t) => t.id === teamId
      ? { ...t, serverIds: t.serverIds.includes(serverId) ? t.serverIds.filter((s) => s !== serverId) : [...t.serverIds, serverId] } : t) }));
    get()._persist(teamId);
  },
  _persist: (teamId: string) => {
    if (!teamsBackend) return;
    const team = get().teams.find((t) => t.id === teamId);
    if (team) saveTeamRec(team).catch((e) => console.error("saveTeam:", e));
  },

  setPlan: (plan) => set({ plan }),
}));
