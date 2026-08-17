package main

import "encoding/json"

// Прототип использует JSON поверх WebSocket ради читаемости.
// В продакшене этот файл заменяется сгенерированным protobuf-кодом
// (proto/nodedeck/v1/agent.proto) — те же поля, бинарный кадр.

type Frame struct {
	ID      string          `json:"id"`             // корреляция request/response
	Type    string          `json:"type"`           // см. константы ниже
	Channel string          `json:"channel,omitempty"` // id PTY-сессии или стрима
	Payload json.RawMessage `json:"payload,omitempty"`
	Error   string          `json:"error,omitempty"`
}

const (
	// client -> agent
	TypeExec        = "exec"         // одноразовая команда
	TypePTYOpen     = "pty.open"     // открыть интерактивный терминал
	TypePTYData     = "pty.data"     // ввод пользователя
	TypePTYResize   = "pty.resize"   // изменение размера окна
	TypePTYClose    = "pty.close"    //
	TypeMetricsSub  = "metrics.sub"  // подписка на поток метрик
	TypeScreenshot  = "screen.shot"  // снимок рабочего стола

	// agent -> client
	TypeExecResult  = "exec.result"
	TypePTYOutput   = "pty.output"
	TypePTYExit     = "pty.exit"
	TypeMetricsTick = "metrics.tick"
	TypeScreenData  = "screen.data"
	TypeError       = "error"
)

type ExecRequest struct {
	Command   string   `json:"command"`
	Args      []string `json:"args,omitempty"`
	Cwd       string   `json:"cwd,omitempty"`
	TimeoutMs int      `json:"timeout_ms,omitempty"`
}

type ExecResponse struct {
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	ExitCode   int    `json:"exit_code"`
	DurationMs int64  `json:"duration_ms"`
}

type PTYOpenRequest struct {
	Shell string `json:"shell,omitempty"`
	Cols  uint16 `json:"cols"`
	Rows  uint16 `json:"rows"`
	Cwd   string `json:"cwd,omitempty"`
}

type PTYResizeRequest struct {
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

type MetricsSubRequest struct {
	IntervalMs int `json:"interval_ms"`
}

type Metrics struct {
	Timestamp   int64          `json:"ts"`
	Hostname    string         `json:"hostname"`
	UptimeSec   uint64         `json:"uptime_sec"`
	CPUPercent  []float64      `json:"cpu_percent"` // на ядро
	LoadAvg     [3]float64     `json:"load_avg"`
	MemTotal    uint64         `json:"mem_total"`
	MemUsed     uint64         `json:"mem_used"`
	MemPercent  float64        `json:"mem_percent"`
	SwapUsed    uint64         `json:"swap_used"`
	Disks       []DiskMetric   `json:"disks"`
	Net         NetMetric      `json:"net"`
	TopProcs    []ProcessInfo  `json:"top_procs"`
}

type DiskMetric struct {
	Mount       string  `json:"mount"`
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
	ReadBps     uint64  `json:"read_bps"`
	WriteBps    uint64  `json:"write_bps"`
}

type NetMetric struct {
	RxBps uint64 `json:"rx_bps"`
	TxBps uint64 `json:"tx_bps"`
}

type ProcessInfo struct {
	PID     int32   `json:"pid"`
	Name    string  `json:"name"`
	User    string  `json:"user"`
	CPU     float64 `json:"cpu"`
	MemRSS  uint64  `json:"mem_rss"`
	Cmdline string  `json:"cmdline"`
}

type ScreenshotRequest struct {
	Display int `json:"display"` // индекс монитора, -1 = все
	Quality int `json:"quality"` // 1..100, JPEG
}

type ScreenshotResponse struct {
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Format string `json:"format"` // "jpeg"
	Data   string `json:"data"`   // base64
}
