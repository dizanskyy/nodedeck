# NodeDeck

Кроссплатформенная платформа удалённого управления и мониторинга серверов.
Прототип: Go-агент + TypeScript-клиент.

## Структура

```
agent/           Go-агент (WSS + mTLS)
  protocol.go    кадры протокола (в проде -> protobuf)
  main.go        TLS/WebSocket-сервер, диспетчер кадров
  exec.go        выполнение shell-команд
  metrics.go     CPU / RAM / Disk / Net / процессы
  screen.go      снимок рабочего стола
  certs/gen.sh   dev-PKI
client/src/      клиент
  agent-client.ts  транспорт: request/response + подписки
  demo.ts          демонстрация
```

## Быстрый старт (dev, без TLS)

```bash
cd agent && go mod tidy && go run . -listen :8443 -insecure
```

```bash
cd client && npx tsx src/demo.ts ws://localhost:8443/v1/connect
```

## С mTLS

```bash
cd agent/certs && ./gen.sh localhost
cd .. && go run . -listen :8443 -cert certs/agent.crt -key certs/agent.key -ca certs/ca.crt
```

Node-клиенту при mTLS нужен `undici` с клиентским сертификатом либо Rust-ядро Tauri
(`tokio-tungstenite` + `rustls`) — браузерный `WebSocket` задать сертификат не умеет.

## Что прототип не делает

PTY-сессии, файловый менеджер (SFTP), стриминг логов, Docker, systemd,
relay для NAT, авторизация команд. См. Roadmap, фазы 2–4.
