#!/usr/bin/env bash
# Генерация dev-PKI для mTLS: CA, сертификат агента, сертификат клиента.
# В продакшене эту роль выполняет энроллмент: агент шлёт CSR, control-plane подписывает.
set -euo pipefail
cd "$(dirname "$0")"

HOST="${1:-localhost}"

# CA
openssl req -x509 -newkey ed25519 -nodes -days 3650 \
  -keyout ca.key -out ca.crt -subj "/CN=NodeDeck Dev CA"

# Агент
openssl req -newkey ed25519 -nodes -keyout agent.key -out agent.csr -subj "/CN=$HOST"
openssl x509 -req -in agent.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days 825 -out agent.crt \
  -extfile <(printf "subjectAltName=DNS:%s,IP:127.0.0.1\nextendedKeyUsage=serverAuth" "$HOST")

# Клиент
openssl req -newkey ed25519 -nodes -keyout client.key -out client.csr -subj "/CN=nodedeck-client"
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days 825 -out client.crt \
  -extfile <(printf "extendedKeyUsage=clientAuth")

rm -f ./*.csr
echo "Готово: ca.crt, agent.crt/key, client.crt/key"
