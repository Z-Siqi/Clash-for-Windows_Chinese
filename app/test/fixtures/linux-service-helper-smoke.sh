#!/usr/bin/env bash

set -euo pipefail

REPOSITORY_ROOT="${1:?repository root is required}"
ARCHITECTURE="$(uname -m)"
HOST_OS="$(uname -s)"
case "$HOST_OS:$ARCHITECTURE" in
    Linux:x86_64|Linux:amd64)
        DEFAULT_TARGET_ROOT="$REPOSITORY_ROOT/app/clash_core/linux-x64/static/files/linux/x64"
        CLASH_NAME="clash-linux"
        MIHOMO_NAME="mihomo-linux-amd64"
        ;;
    Linux:aarch64|Linux:arm64)
        DEFAULT_TARGET_ROOT="$REPOSITORY_ROOT/app/clash_core/linux-arm64/static/files/linux/arm64"
        CLASH_NAME="clash-linux"
        MIHOMO_NAME="mihomo-linux-arm64"
        ;;
    Darwin:x86_64|Darwin:amd64)
        DEFAULT_TARGET_ROOT="$REPOSITORY_ROOT/app/clash_core/darwin-x64/static/files/darwin/x64"
        CLASH_NAME="clash-darwin"
        MIHOMO_NAME="mihomo-darwin-amd64"
        ;;
    Darwin:aarch64|Darwin:arm64)
        DEFAULT_TARGET_ROOT="$REPOSITORY_ROOT/app/clash_core/darwin-arm64/static/files/darwin/arm64"
        CLASH_NAME="clash-darwin"
        MIHOMO_NAME="mihomo-darwin-arm64"
        ;;
    *)
        printf 'SKIP: unsupported Service Mode host %s/%s\n' "$HOST_OS" "$ARCHITECTURE"
        exit 0
        ;;
esac
TARGET_ROOT="${2:-$DEFAULT_TARGET_ROOT}"

WORK_ROOT="$(mktemp -d)"
HELPER_PID=""
cleanup() {
    if [[ -n "${SERVICE_BASE_URL:-}" ]]; then
        curl --silent --max-time 1 "$SERVICE_BASE_URL/stop" >/dev/null 2>&1 || true
    fi
    if [[ -n "$HELPER_PID" ]]; then kill "$HELPER_PID" >/dev/null 2>&1 || true; fi
    rm -rf -- "$WORK_ROOT"
}
trap cleanup EXIT

mkdir -p "$WORK_ROOT/service" "$WORK_ROOT/cores" "$WORK_ROOT/profile/logs"
cp "$TARGET_ROOT/service/clash-core-service" "$WORK_ROOT/service/"
cp "$TARGET_ROOT/service/core-hashes.json" "$WORK_ROOT/service/"
cp "$TARGET_ROOT/$CLASH_NAME" "$WORK_ROOT/cores/"
cp "$TARGET_ROOT/$MIHOMO_NAME" "$WORK_ROOT/cores/"
chmod 755 "$WORK_ROOT/service/clash-core-service" "$WORK_ROOT/cores/$CLASH_NAME" "$WORK_ROOT/cores/$MIHOMO_NAME"

if [[ "$HOST_OS" == "Darwin" ]]; then
    mkdir -p "$WORK_ROOT/helpers"
    printf '%s\n' '#!/usr/bin/env bash' 'printf "%s\\n" "$@"' > "$WORK_ROOT/helpers/sysproxy"
    chmod 755 "$WORK_ROOT/helpers/sysproxy"
    python3 -c 'import hashlib,json,sys; manifest_path,helper_path=sys.argv[1:]; data=json.load(open(manifest_path)); data["helpers"]=[{"name":"sysproxy","sha256":hashlib.sha256(open(helper_path,"rb").read()).hexdigest()}]; open(manifest_path,"w").write(json.dumps(data))' \
        "$WORK_ROOT/service/core-hashes.json" "$WORK_ROOT/helpers/sysproxy"
fi

free_port() {
    python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'
}
MIXED_PORT="$(free_port)"
CONTROLLER_PORT="$(free_port)"
SERVICE_PORT="$(free_port)"
SERVICE_BASE_URL="http://127.0.0.1:$SERVICE_PORT"
printf '%s\n' \
    "mixed-port: $MIXED_PORT" \
    "external-controller: 127.0.0.1:$CONTROLLER_PORT" \
    'secret: smoke-test' \
    'mode: rule' \
    'log-level: silent' \
    'proxies: []' \
    'proxy-groups: []' \
    'rules:' \
    '  - MATCH,DIRECT' > "$WORK_ROOT/profile/config.yaml"

CFW_SERVICE_TEST_MODE=1 CFW_SERVICE_TEST_LISTEN_ADDRESS="127.0.0.1:$SERVICE_PORT" \
    "$WORK_ROOT/service/clash-core-service" >"$WORK_ROOT/helper.log" 2>&1 &
HELPER_PID="$!"
for _ in $(seq 1 50); do
    if curl --silent --fail --max-time 1 "$SERVICE_BASE_URL/ping" >/dev/null; then break; fi
    sleep 0.1
done
curl --silent --fail --max-time 1 "$SERVICE_BASE_URL/ping" >/dev/null

payload() {
    python3 -c 'import json,sys; print(json.dumps({"path":sys.argv[1],"cwd":sys.argv[2],"silent":True}))' "$1" "$WORK_ROOT/profile"
}
UNTRUSTED_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 2 \
    --request POST --header 'Content-Type: application/json' --data "$(payload /bin/true)" \
    "$SERVICE_BASE_URL/start")"
[[ "$UNTRUSTED_STATUS" == "403" ]]

if [[ "$HOST_OS" == "Darwin" ]]; then
    proxy_payload() {
        python3 -c 'import json,sys; print(json.dumps({"path":sys.argv[1],"args":sys.argv[2:]}))' "$@"
    }
    UNTRUSTED_PROXY_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 2 \
        --request POST --header 'Content-Type: application/json' \
        --data "$(proxy_payload /bin/true -show)" "$SERVICE_BASE_URL/system-proxy")"
    [[ "$UNTRUSTED_PROXY_STATUS" == "403" ]]
    INVALID_PROXY_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 2 \
        --request POST --header 'Content-Type: application/json' \
        --data "$(proxy_payload "$WORK_ROOT/helpers/sysproxy" -http 127.0.0.1:7890)" \
        "$SERVICE_BASE_URL/system-proxy")"
    [[ "$INVALID_PROXY_STATUS" == "400" ]]
    PROXY_OUTPUT="$(curl --silent --fail --max-time 3 --request POST --header 'Content-Type: application/json' \
        --data "$(proxy_payload "$WORK_ROOT/helpers/sysproxy" -show)" \
        "$SERVICE_BASE_URL/system-proxy")"
    [[ "$PROXY_OUTPUT" == *-show* ]]
    LEGACY_COMMAND_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 2 \
        --request POST --header 'Content-Type: application/json' --data '{}' \
        "$SERVICE_BASE_URL/command")"
    [[ "$LEGACY_COMMAND_STATUS" == "404" ]]
fi

curl --silent --fail --max-time 3 --request POST --header 'Content-Type: application/json' \
    --data "$(payload "$WORK_ROOT/cores/$CLASH_NAME")" "$SERVICE_BASE_URL/start" >/dev/null
for _ in $(seq 1 100); do
    if curl --silent --fail --max-time 1 --header 'Authorization: Bearer smoke-test' \
        "http://127.0.0.1:$CONTROLLER_PORT/version" >/dev/null; then break; fi
    sleep 0.1
done
pgrep -f "$WORK_ROOT/cores/$CLASH_NAME -d $WORK_ROOT/profile" >/dev/null

curl --silent --fail --max-time 3 --request POST --header 'Content-Type: application/json' \
    --data "$(payload "$WORK_ROOT/cores/$MIHOMO_NAME")" "$SERVICE_BASE_URL/start" >/dev/null
for _ in $(seq 1 100); do
    if pgrep -f "$WORK_ROOT/cores/$MIHOMO_NAME -d $WORK_ROOT/profile" >/dev/null; then break; fi
    sleep 0.1
done
if pgrep -f "$WORK_ROOT/cores/$CLASH_NAME -d $WORK_ROOT/profile" >/dev/null; then
    printf 'legacy core remained alive after switching to Mihomo\n' >&2
    exit 1
fi
pgrep -f "$WORK_ROOT/cores/$MIHOMO_NAME -d $WORK_ROOT/profile" >/dev/null
curl --silent --fail --max-time 2 "$SERVICE_BASE_URL/stop" >/dev/null

printf '%s Service Mode switched from Clash to Mihomo through the allow-listed helper\n' "$HOST_OS"
