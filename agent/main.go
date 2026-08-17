// NodeDeck Agent — прототип.
//
// Слушает WSS с взаимной TLS-аутентификацией (mTLS) и обслуживает:
//   exec         — выполнение shell-команды
//   metrics.sub  — поток метрик CPU/RAM/Disk/Net/процессы
//   screen.shot  — снимок рабочего стола
//
// Запуск (dev, самоподписанные сертификаты см. certs/gen.sh):
//   go run . -listen :8443 -cert certs/agent.crt -key certs/agent.key -ca certs/ca.crt
//   go run . -listen :8443 -insecure   # без mTLS, ТОЛЬКО для локальной отладки
package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var (
	flagListen   = flag.String("listen", ":8443", "адрес прослушивания")
	flagCert     = flag.String("cert", "", "TLS-сертификат агента")
	flagKey      = flag.String("key", "", "приватный ключ агента")
	flagCA       = flag.String("ca", "", "CA для проверки клиентских сертификатов")
	flagInsecure = flag.Bool("insecure", false, "отключить TLS (только dev)")
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 32 * 1024,
	// Проверка Origin не нужна: доступ ограничен клиентским сертификатом.
	CheckOrigin: func(*http.Request) bool { return true },
}

func main() {
	flag.Parse()
	log.SetFlags(log.Ltime | log.Lmsgprefix)
	log.SetPrefix("[nodedeck-agent] ")

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/v1/connect", handleConnect)

	srv := &http.Server{
		Addr:              *flagListen,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	if *flagInsecure {
		log.Printf("ВНИМАНИЕ: TLS отключён. Слушаю ws://%s/v1/connect", *flagListen)
		log.Fatal(srv.ListenAndServe())
	}

	tlsCfg, err := buildTLS()
	if err != nil {
		log.Fatalf("tls: %v", err)
	}
	srv.TLSConfig = tlsCfg
	log.Printf("слушаю wss://%s/v1/connect (mTLS)", *flagListen)
	log.Fatal(srv.ListenAndServeTLS("", ""))
}

func buildTLS() (*tls.Config, error) {
	cert, err := tls.LoadX509KeyPair(*flagCert, *flagKey)
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	caPEM, err := os.ReadFile(*flagCA)
	if err != nil {
		return nil, err
	}
	pool.AppendCertsFromPEM(caPEM)
	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		ClientCAs:    pool,
		// Ключевая строка: без валидного клиентского сертификата соединения нет.
		ClientAuth: tls.RequireAndVerifyClientCert,
		MinVersion: tls.VersionTLS13,
	}, nil
}

// session — одно клиентское WebSocket-соединение.
type session struct {
	conn   *websocket.Conn
	writeM sync.Mutex // websocket не допускает конкурентную запись
	ctx    context.Context
	cancel context.CancelFunc
}

func handleConnect(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade: %v", err)
		return
	}
	ctx, cancel := context.WithCancel(r.Context())
	s := &session{conn: conn, ctx: ctx, cancel: cancel}
	defer func() {
		cancel()
		conn.Close()
	}()

	peer := "insecure"
	if r.TLS != nil && len(r.TLS.PeerCertificates) > 0 {
		peer = r.TLS.PeerCertificates[0].Subject.CommonName
	}
	log.Printf("клиент подключён: %s (%s)", peer, r.RemoteAddr)

	for {
		var f Frame
		if err := conn.ReadJSON(&f); err != nil {
			log.Printf("клиент отключён: %v", err)
			return
		}
		// Каждый кадр обрабатывается независимо — медленный screenshot
		// не блокирует поток метрик и ввод в терминал.
		go s.dispatch(f)
	}
}

func (s *session) send(f Frame) {
	s.writeM.Lock()
	defer s.writeM.Unlock()
	s.conn.SetWriteDeadline(time.Now().Add(15 * time.Second))
	if err := s.conn.WriteJSON(f); err != nil {
		log.Printf("write: %v", err)
	}
}

func (s *session) reply(id, typ string, v any) {
	payload, err := json.Marshal(v)
	if err != nil {
		s.fail(id, err)
		return
	}
	s.send(Frame{ID: id, Type: typ, Payload: payload})
}

func (s *session) fail(id string, err error) {
	s.send(Frame{ID: id, Type: TypeError, Error: err.Error()})
}

func (s *session) dispatch(f Frame) {
	switch f.Type {
	case TypeExec:
		var req ExecRequest
		if err := json.Unmarshal(f.Payload, &req); err != nil {
			s.fail(f.ID, err)
			return
		}
		res, err := runCommand(s.ctx, req)
		if err != nil {
			s.fail(f.ID, err)
			return
		}
		s.reply(f.ID, TypeExecResult, res)

	case TypeMetricsSub:
		var req MetricsSubRequest
		json.Unmarshal(f.Payload, &req)
		if req.IntervalMs < 250 {
			req.IntervalMs = 1000
		}
		go s.streamMetrics(f.ID, time.Duration(req.IntervalMs)*time.Millisecond)

	case TypeScreenshot:
		var req ScreenshotRequest
		json.Unmarshal(f.Payload, &req)
		res, err := captureScreen(req)
		if err != nil {
			s.fail(f.ID, err)
			return
		}
		s.reply(f.ID, TypeScreenData, res)

	default:
		s.send(Frame{ID: f.ID, Type: TypeError, Error: "неизвестный тип кадра: " + f.Type})
	}
}

func (s *session) streamMetrics(id string, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	c := newMetricsCollector()
	for {
		select {
		case <-s.ctx.Done():
			return
		case <-t.C:
			m, err := c.collect(interval)
			if err != nil {
				s.fail(id, err)
				return
			}
			s.reply(id, TypeMetricsTick, m)
		}
	}
}
