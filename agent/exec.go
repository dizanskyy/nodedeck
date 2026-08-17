package main

import (
	"bytes"
	"context"
	"errors"
	"os/exec"
	"runtime"
	"time"
)

// runCommand выполняет команду в системной оболочке с таймаутом и лимитом вывода.
//
// ВАЖНО для продакшена: здесь обязателен слой авторизации — allow-list команд
// или проверка роли из клиентского сертификата. Прототип доверяет любому,
// кто прошёл mTLS, что приемлемо только потому, что сертификат выдаётся
// вручную при энроллменте.
func runCommand(parent context.Context, req ExecRequest) (*ExecResponse, error) {
	if req.Command == "" {
		return nil, errors.New("пустая команда")
	}
	timeout := time.Duration(req.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()

	var cmd *exec.Cmd
	if len(req.Args) > 0 {
		// Явный argv — безопасный путь, без интерпретации оболочкой.
		cmd = exec.CommandContext(ctx, req.Command, req.Args...)
	} else if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "powershell.exe",
			"-NoProfile", "-NonInteractive", "-Command", req.Command)
	} else {
		cmd = exec.CommandContext(ctx, "/bin/sh", "-c", req.Command)
	}
	cmd.Dir = req.Cwd

	const maxOutput = 4 << 20 // 4 МБ, чтобы `cat /dev/urandom` не съел память
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &limitedWriter{W: &stdout, N: maxOutput}
	cmd.Stderr = &limitedWriter{W: &stderr, N: maxOutput}

	start := time.Now()
	err := cmd.Run()
	res := &ExecResponse{
		Stdout:     stdout.String(),
		Stderr:     stderr.String(),
		DurationMs: time.Since(start).Milliseconds(),
	}
	var ee *exec.ExitError
	switch {
	case err == nil:
		res.ExitCode = 0
	case errors.As(err, &ee):
		res.ExitCode = ee.ExitCode()
	case ctx.Err() == context.DeadlineExceeded:
		res.ExitCode = -1
		res.Stderr += "\n[nodedeck] превышен таймаут выполнения"
	default:
		return nil, err
	}
	return res, nil
}

type limitedWriter struct {
	W interface{ Write([]byte) (int, error) }
	N int
}

func (l *limitedWriter) Write(p []byte) (int, error) {
	if l.N <= 0 {
		return len(p), nil // тихо отбрасываем хвост, но не роняем процесс
	}
	if len(p) > l.N {
		p = p[:l.N]
	}
	n, err := l.W.Write(p)
	l.N -= n
	return len(p), err
}
