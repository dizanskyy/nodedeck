package main

import (
	"sort"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/process"
)

// collector хранит предыдущие счётчики, чтобы считать скорость (байт/сек),
// а не кумулятивные значения.
type collector struct {
	prevNet  map[string]uint64 // "rx"/"tx"
	prevDisk map[string][2]uint64
	prevAt   time.Time
}

func newMetricsCollector() *collector {
	return &collector{
		prevNet:  map[string]uint64{},
		prevDisk: map[string][2]uint64{},
	}
}

func (c *collector) collect(interval time.Duration) (*Metrics, error) {
	m := &Metrics{Timestamp: time.Now().UnixMilli()}

	// CPU: percpu=true даёт нагрузку по ядрам. Интервал 0 => дельта с прошлого
	// вызова, поэтому тикер задаёт частоту и мы не блокируем горутину.
	if p, err := cpu.Percent(0, true); err == nil {
		m.CPUPercent = p
	}
	if l, err := load.Avg(); err == nil {
		m.LoadAvg = [3]float64{l.Load1, l.Load5, l.Load15}
	}
	if v, err := mem.VirtualMemory(); err == nil {
		m.MemTotal, m.MemUsed, m.MemPercent = v.Total, v.Used, v.UsedPercent
	}
	if s, err := mem.SwapMemory(); err == nil {
		m.SwapUsed = s.Used
	}
	if h, err := host.Info(); err == nil {
		m.Hostname, m.UptimeSec = h.Hostname, h.Uptime
	}

	elapsed := interval.Seconds()
	if !c.prevAt.IsZero() {
		elapsed = time.Since(c.prevAt).Seconds()
	}
	if elapsed <= 0 {
		elapsed = 1
	}

	// Диски: только реальные точки монтирования (physical), без tmpfs/overlay.
	if parts, err := disk.Partitions(false); err == nil {
		ioCounters, _ := disk.IOCounters()
		for _, p := range parts {
			u, err := disk.Usage(p.Mountpoint)
			if err != nil {
				continue
			}
			d := DiskMetric{
				Mount: p.Mountpoint, Total: u.Total,
				Used: u.Used, UsedPercent: u.UsedPercent,
			}
			if io, ok := ioCounters[p.Device]; ok {
				if prev, ok := c.prevDisk[p.Device]; ok {
					d.ReadBps = rate(io.ReadBytes, prev[0], elapsed)
					d.WriteBps = rate(io.WriteBytes, prev[1], elapsed)
				}
				c.prevDisk[p.Device] = [2]uint64{io.ReadBytes, io.WriteBytes}
			}
			m.Disks = append(m.Disks, d)
		}
	}

	if counters, err := net.IOCounters(false); err == nil && len(counters) > 0 {
		rx, tx := counters[0].BytesRecv, counters[0].BytesSent
		if prevRx, ok := c.prevNet["rx"]; ok {
			m.Net.RxBps = rate(rx, prevRx, elapsed)
			m.Net.TxBps = rate(tx, c.prevNet["tx"], elapsed)
		}
		c.prevNet["rx"], c.prevNet["tx"] = rx, tx
	}

	m.TopProcs = topProcesses(15)
	c.prevAt = time.Now()
	return m, nil
}

func rate(cur, prev uint64, seconds float64) uint64 {
	if cur < prev { // счётчик сбросился (перезапуск интерфейса)
		return 0
	}
	return uint64(float64(cur-prev) / seconds)
}

// topProcesses — источник данных для «htop-панели» в UI.
func topProcesses(n int) []ProcessInfo {
	procs, err := process.Processes()
	if err != nil {
		return nil
	}
	out := make([]ProcessInfo, 0, len(procs))
	for _, p := range procs {
		cpuPct, err := p.CPUPercent()
		if err != nil {
			continue // процесс успел завершиться между вызовами — это норма
		}
		name, _ := p.Name()
		user, _ := p.Username()
		cmdline, _ := p.Cmdline()
		var rss uint64
		if mi, err := p.MemoryInfo(); err == nil && mi != nil {
			rss = mi.RSS
		}
		if len(cmdline) > 200 {
			cmdline = cmdline[:200]
		}
		out = append(out, ProcessInfo{
			PID: p.Pid, Name: name, User: user,
			CPU: cpuPct, MemRSS: rss, Cmdline: cmdline,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].CPU != out[j].CPU {
			return out[i].CPU > out[j].CPU
		}
		return out[i].MemRSS > out[j].MemRSS
	})
	if len(out) > n {
		out = out[:n]
	}
	return out
}
