import { useState } from "react";
import type { Server } from "../../../store";
import { sshExec, credsOf, winCmd, type OsKind } from "../../../lib/ssh";

interface Snippet { label: string; cmd: string }

const LINUX: Snippet[] = [
  { label: "Свободное место", cmd: "df -h" },
  { label: "Память", cmd: "free -h" },
  { label: "Открытые порты", cmd: "ss -tulnp 2>/dev/null || netstat -tulnp" },
  { label: "Топ процессов", cmd: "ps aux --sort=-%cpu | head -15" },
  { label: "Аптайм и нагрузка", cmd: "uptime" },
  { label: "Кто в системе", cmd: "who" },
  { label: "Ядро и ОС", cmd: "uname -a; cat /etc/os-release 2>/dev/null | head -2" },
  { label: "Обновить пакеты (apt)", cmd: "apt update" },
];

const WINDOWS: Snippet[] = [
  { label: "Диски", cmd: winCmd("Get-PSDrive -PSProvider FileSystem | Format-Table -Auto | Out-String") },
  { label: "Память", cmd: winCmd("Get-CimInstance Win32_OperatingSystem | Select-Object @{n='TotalMB';e={[int]($_.TotalVisibleMemorySize/1024)}},@{n='FreeMB';e={[int]($_.FreePhysicalMemory/1024)}} | Format-List | Out-String") },
  { label: "Открытые порты", cmd: winCmd("Get-NetTCPConnection -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess | Sort-Object LocalPort | Format-Table -Auto | Out-String") },
  { label: "Топ процессов", cmd: winCmd("Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 Name,Id,@{n='MB';e={[int]($_.WorkingSet64/1MB)}} | Format-Table -Auto | Out-String") },
  { label: "Сеть (ipconfig)", cmd: "ipconfig /all" },
  { label: "Аптайм", cmd: winCmd("(Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime | Select-Object Days,Hours,Minutes | Format-List | Out-String") },
  { label: "Инфо о системе", cmd: winCmd("Get-ComputerInfo | Select-Object OsName,OsVersion,CsName,CsProcessors | Format-List | Out-String") },
];

export function SnippetsPanel({ server, os }: { server: Server; os: OsKind }) {
  const list = os === "windows" ? WINDOWS : LINUX;
  const [out, setOut] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");

  async function run(label: string, cmd: string) {
    setBusy(true); setTitle(label); setOut("Выполняется…");
    try {
      const r = await sshExec(credsOf(server), cmd);
      setOut((r.stdout || "") + (r.stderr ? "\n" + r.stderr : "") || "(нет вывода)");
    } catch (e) { setOut("Ошибка: " + ((e as Error).message || String(e))); }
    setBusy(false);
  }

  return (
    <div className="detail-body">
      <div className="snip-grid">
        {list.map((s) => (
          <button key={s.label} className="snip-btn" disabled={busy} onClick={() => run(s.label, s.cmd)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="snip-custom">
        <input className="input" placeholder={os === "windows" ? "своя команда (PowerShell/cmd)…" : "своя команда…"}
               value={custom} onChange={(e) => setCustom(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) run("Своя команда", custom.trim()); }} />
        <button className="btn" disabled={busy || !custom.trim()} onClick={() => run("Своя команда", custom.trim())}>Запустить</button>
      </div>

      {title && (
        <>
          <div className="section-label">{title}</div>
          <pre className="snip-output">{out}</pre>
        </>
      )}
    </div>
  );
}
