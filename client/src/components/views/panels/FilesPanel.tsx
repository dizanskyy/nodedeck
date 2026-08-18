import { useEffect, useState } from "react";
import type { Server } from "../../../store";
import { sshExec, credsOf, winCmd, readFileText, writeFileText, type OsKind } from "../../../lib/ssh";
import { IconRefresh, IconTrash, IconPlus } from "../../icons";

interface Entry { name: string; dir: boolean; size: number }

const sep = (os: OsKind) => (os === "windows" ? "\\" : "/");

function join(os: OsKind, base: string, name: string): string {
  const s = sep(os);
  return base.endsWith(s) ? base + name : base + s + name;
}
function parentOf(os: OsKind, path: string): string {
  const s = sep(os);
  const trimmed = path.replace(new RegExp(`\\${s}+$`), "");
  const i = trimmed.lastIndexOf(s);
  if (i <= 0) return os === "windows" ? trimmed.slice(0, 3) : "/";
  return trimmed.slice(0, i) || (os === "windows" ? path.slice(0, 3) : "/");
}

function listCmd(os: OsKind, path: string): string {
  if (os === "windows") {
    return winCmd(`Get-ChildItem -Force -LiteralPath '${path.replace(/'/g, "''")}' | ForEach-Object { "$([int]$_.PSIsContainer)|$($_.Length)|$($_.Name)" }`);
  }
  return `ls -Ap --group-directories-first '${path.replace(/'/g, "")}' 2>&1`;
}

function parse(out: string, os: OsKind): Entry[] {
  const res: Entry[] = [];
  for (const line of out.split("\n")) {
    const l = line.replace(/\r$/, "");
    if (!l.trim()) continue;
    if (os === "windows") {
      const parts = l.split("|");
      if (parts.length < 3) continue;
      res.push({ dir: parts[0] === "1", size: +parts[1] || 0, name: parts.slice(2).join("|") });
    } else {
      const dir = l.endsWith("/");
      res.push({ dir, size: 0, name: dir ? l.slice(0, -1) : l });
    }
  }
  return res.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
}

const fmtSize = (n: number) => {
  if (!n) return "";
  const u = ["Б", "КБ", "МБ", "ГБ"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
};

interface Editing { name: string; path: string; content: string; dirty: boolean; isNew: boolean }

export function FilesPanel({ server, os }: { server: Server; os: OsKind }) {
  const [path, setPath] = useState(os === "windows" ? "C:\\" : "/");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [newDir, setNewDir] = useState("");

  async function load(p = path) {
    setLoading(true); setErr(null);
    try {
      const r = await sshExec(credsOf(server), listCmd(os, p));
      const parsed = parse(r.stdout, os);
      if (parsed.length === 0 && r.stdout && /no such|not exist|cannot|denied|ошибка/i.test(r.stdout)) {
        setErr(r.stdout.trim());
      } else {
        setEntries(parsed);
      }
    } catch (e) { setErr((e as Error).message || String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(path); /* eslint-disable-next-line */ }, [path, server.id]);

  async function openEntry(e: Entry) {
    if (e.dir) { setPath(join(os, path, e.name)); return; }
    const full = join(os, path, e.name);
    setEditErr(null);
    setEditing({ name: e.name, path: full, content: "Загрузка…", dirty: false, isNew: false });
    try {
      const content = await readFileText(credsOf(server), os, full);
      setEditing({ name: e.name, path: full, content, dirty: false, isNew: false });
    } catch (er) {
      setEditErr((er as Error).message || String(er));
      setEditing({ name: e.name, path: full, content: "", dirty: false, isNew: false });
    }
  }

  async function save() {
    if (!editing) return;
    setSaving(true); setEditErr(null);
    try {
      await writeFileText(credsOf(server), os, editing.path, editing.content);
      setEditing({ ...editing, dirty: false, isNew: false });
      load();
    } catch (er) { setEditErr((er as Error).message || String(er)); }
    setSaving(false);
  }

  function newFile() {
    const name = prompt("Имя нового файла (например notes.txt):");
    if (!name || !name.trim()) return;
    setEditErr(null);
    setEditing({ name: name.trim(), path: join(os, path, name.trim()), content: "", dirty: true, isNew: true });
  }

  async function rename(e: Entry) {
    const next = prompt(`Новое имя для «${e.name}»:`, e.name);
    if (!next || !next.trim() || next === e.name) return;
    const from = join(os, path, e.name);
    const to = join(os, path, next.trim());
    const cmd = os === "windows"
      ? winCmd(`Move-Item -LiteralPath '${from.replace(/'/g, "''")}' -Destination '${to.replace(/'/g, "''")}' -Force`)
      : `mv '${from.replace(/'/g, "")}' '${to.replace(/'/g, "")}'`;
    try { await sshExec(credsOf(server), cmd); load(); }
    catch (er) { setErr((er as Error).message || String(er)); }
  }

  async function del(e: Entry) {
    const full = join(os, path, e.name);
    if (!confirm(`Удалить «${e.name}»?`)) return;
    const cmd = os === "windows"
      ? winCmd(`Remove-Item -LiteralPath '${full.replace(/'/g, "''")}' -Recurse -Force`)
      : `rm -rf '${full.replace(/'/g, "")}'`;
    try { await sshExec(credsOf(server), cmd); load(); }
    catch (er) { setErr((er as Error).message || String(er)); }
  }

  async function mkdir() {
    if (!newDir.trim()) return;
    const full = join(os, path, newDir.trim());
    const cmd = os === "windows"
      ? winCmd(`New-Item -ItemType Directory -Force -Path '${full.replace(/'/g, "''")}'`)
      : `mkdir -p '${full.replace(/'/g, "")}'`;
    try { await sshExec(credsOf(server), cmd); setNewDir(""); load(); }
    catch (er) { setErr((er as Error).message || String(er)); }
  }

  function closeEditor() {
    if (editing?.dirty && !confirm("Есть несохранённые изменения. Закрыть без сохранения?")) return;
    setEditing(null); setEditErr(null);
  }

  return (
    <div className="detail-body">
      <div className="panel-head">
        <button className="btn ghost" onClick={() => setPath(parentOf(os, path))}>← Вверх</button>
        <input className="input" value={path} onChange={(e) => setPath(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter") load(path); }} />
        <button className="btn ghost" onClick={() => load(path)}><IconRefresh size={15} /></button>
      </div>

      <div className="mkdir-row">
        <input className="input" placeholder="имя новой папки" value={newDir}
               onChange={(e) => setNewDir(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") mkdir(); }} />
        <button className="btn ghost" onClick={mkdir}><IconPlus size={15} /> Папка</button>
        <button className="btn ghost" onClick={newFile}><IconPlus size={15} /> Файл</button>
      </div>

      {loading && <div className="empty-block"><p>Загрузка…</p></div>}
      {err && <div className="empty-block"><p>Ошибка:</p><code>{err}</code></div>}

      {!loading && !err && (
        <div className="file-list">
          {entries.map((e) => (
            <div className="file-row" key={e.name} onDoubleClick={() => openEntry(e)}>
              <span className="file-ico">{e.dir ? "📁" : "📄"}</span>
              <button className="file-name" onClick={() => openEntry(e)}>{e.name}</button>
              <span className="file-size">{fmtSize(e.size)}</span>
              <button className="row-act" title="Переименовать" onClick={() => rename(e)}>✎</button>
              <button className="row-del" title="Удалить" onClick={() => del(e)}><IconTrash size={15} /></button>
            </div>
          ))}
          {entries.length === 0 && <div className="empty-block"><p>Папка пуста.</p></div>}
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={closeEditor}>
          <div className="modal editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              {editing.isNew ? "Новый файл: " : "Редактирование: "}{editing.name}
              {editing.dirty && <span className="editor-dirty"> • не сохранено</span>}
            </div>
            <div className="modal-body">
              <textarea className="editor-area" value={editing.content} spellCheck={false}
                        onChange={(e) => setEditing({ ...editing, content: e.target.value, dirty: true })} />
              <div className="editor-path">{editing.path}</div>
              {editErr && <div className="auth-error">{editErr}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn ghost" onClick={closeEditor}>Закрыть</button>
              <button className="btn" disabled={saving || !editing.dirty} onClick={save}>
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
