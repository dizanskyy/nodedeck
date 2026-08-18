import { useEffect, useState } from "react";
import type { Server } from "../../../store";
import { sshExec, credsOf, winCmd, stripClixml, type OsKind } from "../../../lib/ssh";
import { IconRefresh } from "../../icons";

interface Svc { name: string; status: string; display: string; running: boolean }

function listCmd(os: OsKind): string {
  if (os === "windows") {
    return winCmd('Get-Service | ForEach-Object { "$($_.Name)|$($_.Status)|$($_.DisplayName)" }');
  }
  return "systemctl list-units --type=service --all --no-legend --no-pager 2>/dev/null | awk '{print $1\"|\"$4\"|\"$1}'";
}

function parse(out: string, os: OsKind): Svc[] {
  const res: Svc[] = [];
  for (const line of out.split("\n")) {
    const l = line.trim();
    if (!l || !l.includes("|")) continue;
    const [name, status, display] = l.split("|");
    if (!name) continue;
    const running = os === "windows" ? /running/i.test(status) : /running|active/i.test(status);
    res.push({ name, status: status || "", display: display || name, running });
  }
  return res;
}

function actionCmd(os: OsKind, name: string, action: "start" | "stop" | "restart"): string {
  if (os === "windows") {
    const map = { start: "Start-Service", stop: "Stop-Service", restart: "Restart-Service" };
    return winCmd(`${map[action]} -Name '${name.replace(/'/g, "''")}' -Force`);
  }
  return `systemctl ${action} '${name.replace(/'/g, "")}'`;
}

export function ServicesPanel({ server, os }: { server: Server; os: OsKind }) {
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await sshExec(credsOf(server), listCmd(os));
      setSvcs(parse(stripClixml(r.stdout), os));
    } catch (e) { setErr((e as Error).message || String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [server.id, os]);

  async function act(name: string, action: "start" | "stop" | "restart") {
    setActing(name + action);
    try { await sshExec(credsOf(server), actionCmd(os, name, action)); await load(); }
    catch (e) { setErr((e as Error).message || String(e)); }
    setActing(null);
  }

  const shown = svcs.filter((s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.display.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="detail-body">
      <div className="panel-head">
        <input className="input" placeholder="поиск службы…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 280 }} />
        <button className="btn ghost" onClick={load}><IconRefresh size={15} /> Обновить</button>
      </div>

      {loading && <div className="empty-block"><p>Загрузка служб…</p></div>}
      {err && <div className="empty-block"><p>Ошибка:</p><code>{err}</code>
        <p className="page-sub">На Linux управление службами обычно требует прав root.</p></div>}

      {!loading && !err && (
        <div className="svc-list">
          {shown.slice(0, 300).map((s) => (
            <div className="svc-row" key={s.name}>
              <span className={`status-dot ${s.running ? "online" : "offline"}`} />
              <div className="svc-main">
                <div className="svc-name">{s.display}</div>
                <div className="svc-sub">{s.name} · {s.status}</div>
              </div>
              <div className="svc-actions">
                <button disabled={acting !== null} onClick={() => act(s.name, "start")}>Старт</button>
                <button disabled={acting !== null} onClick={() => act(s.name, "stop")}>Стоп</button>
                <button disabled={acting !== null} onClick={() => act(s.name, "restart")}>Рестарт</button>
              </div>
            </div>
          ))}
          {shown.length === 0 && <div className="empty-block"><p>Ничего не найдено.</p></div>}
        </div>
      )}
    </div>
  );
}
