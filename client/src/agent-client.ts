/**
 * NodeDeck — клиент агента.
 *
 * Транспорт: WebSocket (в Tauri — с mTLS через Rust-ядро; в браузере
 * клиентский сертификат подставляет сама ОС/WebView).
 * Модель: request/response по id + подписки на потоки (метрики, логи, PTY).
 */

export type FrameType =
  | "exec" | "exec.result"
  | "metrics.sub" | "metrics.tick"
  | "screen.shot" | "screen.data"
  | "error";

export interface Frame<P = unknown> {
  id: string;
  type: FrameType | string;
  channel?: string;
  payload?: P;
  error?: string;
}

export interface ExecResponse {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}

export interface Metrics {
  ts: number;
  hostname: string;
  uptime_sec: number;
  cpu_percent: number[];
  load_avg: [number, number, number];
  mem_total: number;
  mem_used: number;
  mem_percent: number;
  swap_used: number;
  disks: Array<{
    mount: string; total: number; used: number;
    used_percent: number; read_bps: number; write_bps: number;
  }>;
  net: { rx_bps: number; tx_bps: number };
  top_procs: Array<{
    pid: number; name: string; user: string;
    cpu: number; mem_rss: number; cmdline: string;
  }>;
}

export interface ScreenshotResponse {
  width: number; height: number; format: string; data: string;
}

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void; timer: number };

export interface AgentClientOptions {
  url: string;                    // wss://host:8443/v1/connect
  requestTimeoutMs?: number;      // по умолчанию 30 с
  reconnect?: boolean;            // экспоненциальный backoff
  onStatus?: (s: "connecting" | "open" | "closed") => void;
}

export class AgentClient {
  private ws?: WebSocket;
  private seq = 0;
  private pending = new Map<string, Pending>();
  private streams = new Map<string, (f: Frame<any>) => void>();
  private backoff = 500;
  private closedByUser = false;

  constructor(private opts: AgentClientOptions) {}

  connect(): Promise<void> {
    this.closedByUser = false;
    this.opts.onStatus?.("connecting");
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.opts.url);
      this.ws = ws;

      ws.onopen = () => {
        this.backoff = 500;
        this.opts.onStatus?.("open");
        resolve();
      };
      ws.onerror = () => reject(new Error(`не удалось подключиться к ${this.opts.url}`));
      ws.onmessage = (ev) => this.onFrame(JSON.parse(ev.data as string));
      ws.onclose = () => {
        this.opts.onStatus?.("closed");
        // Незавершённые запросы должны упасть, а не висеть вечно.
        for (const [, p] of this.pending) {
          clearTimeout(p.timer);
          p.reject(new Error("соединение закрыто"));
        }
        this.pending.clear();
        if (this.opts.reconnect && !this.closedByUser) {
          setTimeout(() => this.connect().catch(() => {}), this.backoff);
          this.backoff = Math.min(this.backoff * 2, 30_000);
        }
      };
    });
  }

  close() {
    this.closedByUser = true;
    this.ws?.close();
  }

  private onFrame(f: Frame<any>) {
    // Стрим (метрики/логи/PTY) живёт дольше одного ответа — проверяем его первым.
    const stream = this.streams.get(f.id);
    if (stream) { stream(f); return; }

    const p = this.pending.get(f.id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(f.id);
    if (f.type === "error") p.reject(new Error(f.error ?? "ошибка агента"));
    else p.resolve(f.payload);
  }

  private nextId() { return `r${++this.seq}`; }

  private request<T>(type: string, payload: unknown): Promise<T> {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("нет соединения с агентом"));
    }
    const id = this.nextId();
    const frame: Frame = { id, type, payload };
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`таймаут запроса ${type}`));
      }, this.opts.requestTimeoutMs ?? 30_000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  /** Выполнить shell-команду. args задан => без интерпретации оболочкой. */
  exec(command: string, opts: { args?: string[]; cwd?: string; timeoutMs?: number } = {}) {
    return this.request<ExecResponse>("exec", {
      command, args: opts.args, cwd: opts.cwd, timeout_ms: opts.timeoutMs,
    });
  }

  /** Подписка на поток метрик. Возвращает функцию отписки. */
  subscribeMetrics(onTick: (m: Metrics) => void, intervalMs = 1000): () => void {
    const id = this.nextId();
    this.streams.set(id, (f) => {
      if (f.type === "metrics.tick") onTick(f.payload as Metrics);
    });
    this.ws!.send(JSON.stringify({ id, type: "metrics.sub", payload: { interval_ms: intervalMs } }));
    return () => this.streams.delete(id);
  }

  /** Снимок рабочего стола. display = -1 — все мониторы. */
  async screenshot(display = 0, quality = 70): Promise<{ dataUrl: string; width: number; height: number }> {
    const r = await this.request<ScreenshotResponse>("screen.shot", { display, quality });
    return { dataUrl: `data:image/${r.format};base64,${r.data}`, width: r.width, height: r.height };
  }

  /** Один сниппет на нескольких серверах сразу — ядро фичи «команды в 1 клик». */
  static async runOnMany(clients: AgentClient[], command: string) {
    return Promise.allSettled(clients.map((c) => c.exec(command)));
  }
}
