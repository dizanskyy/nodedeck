import { pb } from "./pb";
import type { Team } from "../store";

// Команда хранится как одна запись PocketBase: name + JSON-поле data,
// внутри которого владелец, участники, права и список серверов.
interface TeamData {
  ownerId: string;
  members: Team["members"];
  serverIds: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTeam(rec: any): Team {
  const d: TeamData = rec.data ?? {};
  return {
    id: rec.id,
    name: rec.name,
    ownerId: d.ownerId ?? "",
    members: d.members ?? [],
    serverIds: d.serverIds ?? [],
  };
}
function toData(t: Team): TeamData {
  return { ownerId: t.ownerId, members: t.members, serverIds: t.serverIds };
}

export const teamsBackend = !!pb;

export async function fetchTeams(): Promise<Team[]> {
  if (!pb) return [];
  const list = await pb.collection("teams").getFullList({ sort: "created" });
  return list.map(toTeam);
}

export async function createTeamRec(t: Omit<Team, "id">): Promise<Team> {
  const rec = await pb!.collection("teams").create({
    name: t.name,
    data: { ownerId: t.ownerId, members: t.members, serverIds: t.serverIds },
  });
  return toTeam(rec);
}

export async function saveTeamRec(t: Team): Promise<void> {
  if (!pb) return;
  await pb.collection("teams").update(t.id, { name: t.name, data: toData(t) });
}

export async function deleteTeamRec(id: string): Promise<void> {
  if (!pb) return;
  await pb.collection("teams").delete(id);
}
