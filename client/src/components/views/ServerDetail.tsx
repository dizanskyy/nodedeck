import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useStore, type Server } from "../../store";
import { sshExec, sshDisconnect, credsOf, parseMetrics, parseWinMetrics, detectOs, METRICS_CMD, WINDOWS_METRICS_CMD, type ParsedMetrics, type OsKind } from "../../lib/ssh";
import { ServicesPanel } from "./panels/ServicesPanel";
import { FilesPanel } from "./panels/FilesPanel";
import { SnippetsPanel } from "./panels/SnippetsPanel";
import { IconChevron } from "../icons";

const fmtBytes = (n: number) => {
  const u = ["Б", "КБ", "МБ", "ГБ", "ТБ"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
};
const fmtUptime = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}д ${h}ч` : h > 0 ? `${h}ч ${m}м` : `${m}м`;
};
const barCls = (p: number) => (p >= 90 ? "bar crit" : p >= 70 ? "bar warn" : "bar");

type Pane = "monitor" | "terminal" | "services" | "files" | "snippets";
const PANES: { id: Pane; label: string }[] = [
  { id: "monitor", label: "Мониторинг" },
  { id: "terminal", label: "Терминал" },
  { id: "services", label: "Службы" },
  { id: "files", label: "Файлы" },
  { id: "snippets", label: "Команды" },
];

export function ServerDetail({ server }: { server: Server }) {
  const { setServerStatus } = useStore();
  const [pane, setPane] = useState<Pane>("monitor");
  const [os, setOs] = useState<OsKind | null>(null);

  // Определяем ОС сервера один раз при открытии.
  useEffect(() => {
    let live = true;
    detectOs(credsOf(server)).then((o) => { if (live) setOs(o); });
    return () => { live = false; };
  }, [server.id]);

  // При уходе со страницы сервера закрываем живое подключение.
  useEffect(() => () => { void sshDisconnect(credsOf(server)); }, [server.id]);

  return (
    <div className="page detail">
      <header className="page-head row">
        <div className="detail-head">
          <button className="back" onClick={() => { useStore.setState({ activeServerId: undefined }); }}>
            <IconChevron size={16} /> Серверы
          </button>
          <div>
            <div className="eyebrow">{server.group}{os ? ` · ${os === "windows" ? "Windows" : "Linux"}` : ""}</div>
            <h1 className="page-title">{server.name}</h1>
            <div className="page-sub">{server.username}@{server.host}:{server.port}</div>
          </div>
        </div>
        <div className="seg detail-seg wide">
          {PANES.map((p) => (
            <button key={p.id} className={pane === p.id ? "active" : ""} onClick={() => setPane(p.id)}>{p.label}</button>
          ))}
        </div>
      </header>

      {pane === "monitor" && <MonitorPane server={server} onStatus={(s) => setServerStatus(server.id, s)} />}
      {pane === "terminal" && <TerminalPane server={server} />}
      {pane === "services" && (os ? <ServicesPanel server={server} os={os} /> : <OsLoading />)}
      {pane === "files" && (os ? <FilesPanel server={server} os={os} /> : <OsLoading />)}
      {pane === "snippets" && (os ? <SnippetsPanel server={server} os={os} /> : <OsLoading />)}
    </div>
  );
}

function OsLoading() {
  return <div className="detail-body"><div className="empty-block"><p>Определяем операционную систему сервера…</p></div></div>;
}

function MonitorPane({ server, onStatus }: { server: Server; onStatus: (s: "online" | "offline") => void }) {
  const [m, setM] = useState<ParsedMetrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [os, setOs] = useState<"linux" | "windows" | null>(null);
  const prev = useRef<ParsedMetrics | undefined>(undefined);
  const osRef = useRef<"linux" | "windows" | null>(null);

  useEffect(() => {
    let live = true;
    async function tick() {
      try {
        // 1) Пробуем Linux (или уже знаем, что Linux).
        // Засчитываем Linux только если реально пришли память И ядра —
        // иначе на Windows частичный вывод ложно определялся как Linux.
        if (osRef.current !== "windows") {
          const r = await sshExec(credsOf(server), METRICS_CMD);
          if (!live) return;
          const parsed = parseMetrics(r.stdout, prev.current);
          if (parsed.memTotal > 0 && parsed.cores > 0) {
            osRef.current = "linux"; setOs("linux");
            prev.current = parsed;
            setM(parsed); setErr(null); setRaw(null); onStatus("online");
            return;
          }
        }
        // 2) Не Linux — пробуем Windows (PowerShell).
        const rw = await sshExec(credsOf(server), WINDOWS_METRICS_CMD);
        if (!live) return;
        const pw = parseWinMetrics(rw.stdout);
        if (pw.host || pw.cores) {
          osRef.current = "windows"; setOs("windows");
          setM(pw); setErr(null); setRaw(null); onStatus("online");
          return;
        }
        // 3) Ни то, ни другое — показываем сырой ответ.
        setRaw((rw.stdout || "") + (rw.stderr ? "\n[stderr]\n" + rw.stderr : ""));
        onStatus("online");
      } catch (e) {
        if (!live) return;
        setErr((e as Error).message || String(e)); onStatus("offline");
      }
    }
    tick();
    const id = setInterval(tick, 3000);
    return () => { live = false; clearInterval(id); };
  }, [server.id]);

  if (err) return (
    <div className="empty-block">
      <p>Не удалось подключиться к серверу:</p>
      <code>{err}</code>
      <p className="page-sub" style={{ maxWidth: 460 }}>
        Проверьте: IP и порт (обычно 22), логин и пароль, что SSH-сервер запущен и порт 22 открыт в фаерволе.
      </p>
    </div>
  );
  if (raw !== null) return (
    <div className="empty-block">
      <p>Подключение есть, но метрики не собрались.</p>
      <p className="page-sub">Терминал при этом работает — переключитесь на вкладку «Терминал».</p>
      <code style={{ whiteSpace: "pre-wrap", textAlign: "left", maxWidth: 560 }}>{raw.slice(0, 400) || "(пустой ответ)"}</code>
    </div>
  );
  if (!m) return <div className="empty-block"><p>Подключение к {server.host}…</p></div>;

  return (
    <div className="detail-body">
      <div className="section-label" style={{ marginTop: 0 }}>{os === "windows" ? "Windows-сервер" : "Linux-сервер"}</div>
      <div className="metric-grid">
        <Card idx="01" label="CPU" value={m.cpuPercent.toFixed(0)} unit="%" percent={m.cpuPercent} foot={os === "windows" ? `${m.cores} ядер` : `${m.cores} ядер · load ${m.load.toFixed(2)}`} />
        <Card idx="02" label="Память" value={fmtBytes(m.memUsed)} unit={`/ ${fmtBytes(m.memTotal)}`} percent={m.memPercent} foot={`${m.memPercent.toFixed(0)}% занято`} />
        <Card idx="03" label="Диск /" value={fmtBytes(m.diskUsed)} unit={`/ ${fmtBytes(m.diskTotal)}`} percent={m.diskPercent} foot={`${m.diskPercent.toFixed(0)}% занято`} />
        <Card idx="04" label="Аптайм" value={fmtUptime(m.uptimeSec)} unit="" foot={m.host} />
      </div>

      <div className="section-label">Процессы</div>
      <table className="proc-table">
        <thead><tr><th>PID</th><th>Процесс</th><th style={{ textAlign: "right" }}>CPU %</th><th style={{ textAlign: "right" }}>Память</th><th></th></tr></thead>
        <tbody>
          {m.procs.map((p) => (
            <tr key={p.pid}>
              <td className="mono">{p.pid}</td>
              <td>{p.name}</td>
              <td style={{ textAlign: "right" }}>{p.cpu.toFixed(1)}</td>
              <td style={{ textAlign: "right" }}>{fmtBytes(p.rss)}</td>
              <td><button className="kill" onClick={() => sshExec(credsOf(server), os === "windows" ? `taskkill /PID ${p.pid} /F` : `kill ${p.pid}`)}>kill</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ idx, label, value, unit, percent, foot }: {
  idx: string; label: string; value: string; unit?: string; percent?: number; foot?: string;
}) {
  return (
    <div className="metric-card">
      <span className="idx">{idx}</span>
      <div className="label">{label}</div>
      <div className="value">{value} <small>{unit}</small></div>
      {percent !== undefined && <div className={barCls(percent)}><i style={{ width: `${Math.min(percent, 100)}%` }} /></div>}
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}

function TerminalPane({ server }: { server: Server }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const term = new Terminal({
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
      fontSize: 13, cursorBlink: true,
      theme: { background: "#0a0a0a", foreground: "#eaeaea", cursor: "#ffffff", selectionBackground: "#2a2a2a", black: "#1a1a1a", brightBlack: "#666666", green: "#22c55e", red: "#ef4444", yellow: "#eab308", blue: "#60a5fa", white: "#dddddd", brightWhite: "#ffffff" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit); term.open(host.current); fit.fit();

    const prompt = () => term.write(`\r\n\x1b[1m${server.username}@${server.name}\x1b[0m:~$ `);
    term.writeln("\x1b[90mNodeDeck SSH — каждая команда выполняется реальным подключением.\x1b[0m");
    term.writeln("\x1b[90mПримечание: сессия без состояния (cd между командами не сохраняется).\x1b[0m");
    prompt();

    let line = "";
    const disp = term.onData(async (d) => {
      if (d === "\r") {
        const cmd = line.trim(); line = "";
        if (!cmd) { prompt(); return; }
        term.writeln("");
        try {
          const r = await sshExec(credsOf(server), cmd);
          if (r.stdout) term.write(r.stdout.replace(/\n/g, "\r\n"));
          if (r.stderr) term.write(`\x1b[31m${r.stderr.replace(/\n/g, "\r\n")}\x1b[0m`);
          // На Windows многие команды при успехе молчат — подтверждаем явно.
          if (!r.stdout && !r.stderr) {
            term.write(r.exit_code === 0 ? "\x1b[90m(выполнено)\x1b[0m" : `\x1b[31m(код выхода ${r.exit_code})\x1b[0m`);
          }
        } catch (e) { term.writeln(`\x1b[31m${(e as Error).message || String(e)}\x1b[0m`); }
        prompt();
      } else if (d === "\x7f") { if (line) { line = line.slice(0, -1); term.write("\b \b"); } }
      else if (d >= " ") { line += d; term.write(d); }
    });
    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(host.current);
    return () => { disp.dispose(); ro.disconnect(); term.dispose(); };
  }, [server.id]);

  return <div className="detail-body"><div className="terminal-wrap"><div ref={host} style={{ height: "100%" }} /></div></div>;
}
