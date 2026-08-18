// Мост к Rust-командам SSH. В десктоп-приложении (Tauri) вызывает нативный
// код; в обычном браузере (dev-превью) Tauri нет — возвращаем заглушку,
// чтобы интерфейс не падал.
export interface SshCreds {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  keyPassphrase?: string;
}

export interface SshResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

// Динамический импорт, чтобы сборка в браузере не требовала Tauri.
async function invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const w = window as unknown as Record<string, unknown>;
  const isTauri = typeof window !== "undefined" && Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      return await invoke<T>(cmd, args);
    } catch (e) {
      // Tauri отклоняет промис строкой (текст ошибки из Rust) — оборачиваем в Error,
      // чтобы во всех местах читался .message.
      throw new Error(typeof e === "string" ? e : (e as { message?: string })?.message ?? JSON.stringify(e));
    }
  }
  // Демо-заглушка только для браузерного превью (в собранном приложении сюда не попадаем).
  if (cmd === "ssh_test") return true as T;
  return { stdout: `[demo] ${String(args.command ?? "")}\n(нет Tauri — вывод эмулирован)`, stderr: "", exit_code: 0 } as T;
}

export function sshTest(creds: SshCreds): Promise<boolean> {
  return invoke<boolean>("ssh_test", { creds });
}

export function sshExec(creds: SshCreds, command: string): Promise<SshResult> {
  return invoke<SshResult>("ssh_exec", { creds, command });
}

export function sshDisconnect(creds: SshCreds): Promise<void> {
  return invoke<void>("ssh_disconnect", { creds }).catch(() => undefined) as Promise<void>;
}

// Сбор базовых метрик одной командой в виде KEY=значение (легко парсить).
// Работает на большинстве Linux-серверов.
export const METRICS_CMD = [
  'echo "HOST=$(hostname)"',
  'echo "UP=$(awk \'{print int($1)}\' /proc/uptime)"',
  'echo "CORES=$(nproc)"',
  'echo "LOAD=$(awk \'{print $1}\' /proc/loadavg)"',
  'awk \'/MemTotal/{t=$2}/MemAvailable/{a=$2}END{print "MEMT="t; print "MEMA="a}\' /proc/meminfo',
  'head -1 /proc/stat | awk \'{print "CPU="$2","$3","$4","$5","$6","$7","$8}\'',
  'df -B1 --output=size,used / | tail -1 | awk \'{print "DISK="$1","$2}\'',
  'ps -eo pid,comm,%cpu,rss --sort=-%cpu | sed -n "2,9p" | awk \'{print "PROC="$1","$2","$3","$4}\'',
].join("; ");

export interface ParsedMetrics {
  host: string; uptimeSec: number; cores: number; load: number;
  memTotal: number; memUsed: number; memPercent: number;
  cpuTotal: number; cpuIdle: number; // сырые счётчики для диффа
  cpuPercent: number;                 // вычисляется между опросами
  diskTotal: number; diskUsed: number; diskPercent: number;
  procs: { pid: number; name: string; cpu: number; rss: number }[];
}

// prev — предыдущий разбор для вычисления % CPU по дельте счётчиков.
export function parseMetrics(out: string, prev?: ParsedMetrics): ParsedMetrics {
  const kv: Record<string, string> = {};
  const procs: ParsedMetrics["procs"] = [];
  for (const line of out.split("\n")) {
    const l = line.trim();
    if (l.startsWith("PROC=")) {
      const [pid, name, cpu, rss] = l.slice(5).split(",");
      procs.push({ pid: +pid, name, cpu: +cpu, rss: (+rss) * 1024 });
    } else {
      const i = l.indexOf("=");
      if (i > 0) kv[l.slice(0, i)] = l.slice(i + 1);
    }
  }
  const memTotal = (+kv.MEMT || 0) * 1024;
  const memAvail = (+kv.MEMA || 0) * 1024;
  const memUsed = Math.max(0, memTotal - memAvail);
  const cpuParts = (kv.CPU || "0,0,0,0,0,0,0").split(",").map(Number);
  const cpuIdle = cpuParts[3] + (cpuParts[4] || 0);
  const cpuTotal = cpuParts.reduce((a, b) => a + b, 0);
  let cpuPercent = 0;
  if (prev) {
    const dt = cpuTotal - prev.cpuTotal;
    const di = cpuIdle - prev.cpuIdle;
    if (dt > 0) cpuPercent = Math.max(0, Math.min(100, (100 * (dt - di)) / dt));
  }
  const [dTotal, dUsed] = (kv.DISK || "0,0").split(",").map(Number);
  return {
    host: kv.HOST || "", uptimeSec: +kv.UP || 0, cores: +kv.CORES || 1, load: +kv.LOAD || 0,
    memTotal, memUsed, memPercent: memTotal ? (memUsed / memTotal) * 100 : 0,
    cpuTotal, cpuIdle, cpuPercent,
    diskTotal: dTotal, diskUsed: dUsed, diskPercent: dTotal ? (dUsed / dTotal) * 100 : 0,
    procs,
  };
}

// ── Метрики Windows-сервера (через PowerShell) ─────────────────────
// Скрипт кодируется в Base64 (UTF-16LE) и запускается как -EncodedCommand,
// чтобы не мучиться с экранированием кавычек через SSH/cmd.
const WIN_PS = [
  "$ErrorActionPreference='SilentlyContinue'",
  "$os=Get-CimInstance Win32_OperatingSystem",
  "$cpu=(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average",
  "$cores=(Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum",
  "$disk=Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\"",
  "$up=[int]((Get-Date)-$os.LastBootUpTime).TotalSeconds",
  "\"HOST=$($os.CSName)\"",
  "\"UP=$up\"",
  "\"CORES=$cores\"",
  "\"CPU=$cpu\"",
  "\"MEMT=$([int64]$os.TotalVisibleMemorySize*1024)\"",
  "\"MEMU=$([int64]($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)*1024)\"",
  "\"DISK=$([int64]$disk.Size),$([int64]($disk.Size-$disk.FreeSpace))\"",
  "Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 8 | ForEach-Object { \"PROC=$($_.Id),$($_.ProcessName),0,$([int64]$_.WorkingSet64)\" }",
].join("; ");

function psEncode(script: string): string {
  let bin = "";
  for (let i = 0; i < script.length; i++) {
    const c = script.charCodeAt(i);
    bin += String.fromCharCode(c & 0xff, (c >> 8) & 0xff); // UTF-16LE
  }
  return btoa(bin);
}

export const WINDOWS_METRICS_CMD = `powershell -NoProfile -EncodedCommand ${psEncode(WIN_PS)}`;

// Разбор метрик Windows (память и CPU приходят готовыми, без дельты).
export function parseWinMetrics(out: string): ParsedMetrics {
  const kv: Record<string, string> = {};
  const procs: ParsedMetrics["procs"] = [];
  for (const line of stripClixml(out).split("\n")) {
    const l = line.trim();
    if (l.startsWith("PROC=")) {
      const [pid, name, cpu, rss] = l.slice(5).split(",");
      procs.push({ pid: +pid, name, cpu: +cpu, rss: +rss });
    } else {
      const i = l.indexOf("=");
      if (i > 0) kv[l.slice(0, i)] = l.slice(i + 1);
    }
  }
  const memTotal = +kv.MEMT || 0;
  const memUsed = +kv.MEMU || 0;
  const [dTotal, dUsed] = (kv.DISK || "0,0").split(",").map(Number);
  return {
    host: kv.HOST || "", uptimeSec: +kv.UP || 0, cores: +kv.CORES || 1, load: 0,
    memTotal, memUsed, memPercent: memTotal ? (memUsed / memTotal) * 100 : 0,
    cpuTotal: 0, cpuIdle: 0, cpuPercent: +kv.CPU || 0,
    diskTotal: dTotal, diskUsed: dUsed, diskPercent: dTotal ? (dUsed / dTotal) * 100 : 0,
    procs,
  };
}

export type OsKind = "linux" | "windows";

// Определение ОС сервера один раз при открытии.
export async function detectOs(creds: SshCreds): Promise<OsKind> {
  try {
    const r = await sshExec(creds, "uname -s");
    if (/linux|darwin|bsd/i.test(r.stdout)) return "linux";
  } catch { /* uname нет — значит Windows */ }
  return "windows";
}

// Обернуть PowerShell-скрипт в запускаемую через SSH команду (без мучений с кавычками).
// Гасим прогресс/ошибки, чтобы OpenSSH не заворачивал вывод в CLIXML.
export function winCmd(script: string): string {
  const wrapped = "$ProgressPreference='SilentlyContinue';$ErrorActionPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.Encoding]::UTF8;" + script;
  return `powershell -NoProfile -NonInteractive -EncodedCommand ${psEncode(wrapped)}`;
}

// PowerShell поверх OpenSSH иногда отдаёт вывод как CLIXML (#< CLIXML ... <S>строка</S>).
// Вытаскиваем реальные строки, если такое пришло.
export function stripClixml(s: string): string {
  if (!s || !s.includes("CLIXML")) return s;
  const parts = [...s.matchAll(/<S[^>]*>([\s\S]*?)<\/S>/g)].map((m) =>
    m[1]
      .replace(/_x000D_/g, "").replace(/_x000A_/g, "\n").replace(/_x0009_/g, "\t")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  );
  return parts.join("\n");
}

// base64 <-> строка с корректной обработкой UTF-8.
export function b64EncodeUtf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}
export function b64DecodeUtf8(b: string): string {
  try { return decodeURIComponent(escape(atob(b.replace(/\s+/g, "")))); }
  catch { return atob(b.replace(/\s+/g, "")); }
}

// Прочитать текстовый файл с хоста (через base64 — сохраняет кодировку).
export async function readFileText(creds: SshCreds, os: OsKind, path: string): Promise<string> {
  const cmd = os === "windows"
    ? winCmd(`[Convert]::ToBase64String([IO.File]::ReadAllBytes('${path.replace(/'/g, "''")}'))`)
    : `base64 '${path.replace(/'/g, "")}'`;
  const r = await sshExec(creds, cmd);
  const out = stripClixml(r.stdout || "").trim();
  if (!out && r.stderr) throw new Error(r.stderr.trim());
  return b64DecodeUtf8(out);
}

// Записать текст в файл на хосте (перезаписывает).
export async function writeFileText(creds: SshCreds, os: OsKind, path: string, content: string): Promise<void> {
  const b64 = b64EncodeUtf8(content);
  const cmd = os === "windows"
    ? winCmd(`try { [IO.File]::WriteAllBytes('${path.replace(/'/g, "''")}',[Convert]::FromBase64String('${b64}')); 'NDOK' } catch { Write-Output ('NDERR: ' + $_.Exception.Message) }`)
    : `printf '%s' '${b64}' | base64 -d > '${path.replace(/'/g, "")}' 2>&1`;
  const r = await sshExec(creds, cmd);
  const out = stripClixml(r.stdout || "");
  const marker = out.match(/NDERR:\s*(.+)/);
  if (marker) throw new Error(marker[1].trim());
  if (os !== "windows" && (r.stderr || out).trim()) throw new Error((r.stderr || out).trim());
}

export function credsOf(s: { host: string; port: number; username: string; authKind: "password" | "key"; password?: string; privateKey?: string }): SshCreds {
  return {
    host: s.host, port: s.port, username: s.username,
    password: s.authKind === "password" ? s.password : undefined,
    privateKey: s.authKind === "key" ? s.privateKey : undefined,
  };
}
