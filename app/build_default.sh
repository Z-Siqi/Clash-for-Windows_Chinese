#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

pause_and_exit() {
    local status="$1"
    printf '\n'
    if [[ "${CFW_BUILD_NO_PAUSE:-0}" != "1" && -t 0 ]]; then
        read -r -n 1 -s -p "Press any key to exit..."
        printf '\n'
    fi
    exit "$status"
}

HOST_OS="$(uname -s)"
REPORTED_ARCH="$(uname -m)"
HOST_ARCH="$REPORTED_ARCH"

# A shell launched through Rosetta reports x86_64. Prefer the native Apple
# Silicon package when the device itself supports arm64.
if [[ "$HOST_OS" == "Darwin" && "$HOST_ARCH" == "x86_64" ]] \
    && command -v sysctl >/dev/null 2>&1 \
    && [[ "$(sysctl -n hw.optional.arm64 2>/dev/null || true)" == "1" ]]; then
    HOST_ARCH="arm64"
fi

case "$HOST_OS:$HOST_ARCH" in
    Linux:x86_64|Linux:amd64)
        BUILD_TARGET="package:linux-x64"
        PLATFORM_NAME="Linux"
        ;;
    Linux:aarch64|Linux:arm64)
        BUILD_TARGET="package:linux-arm64"
        PLATFORM_NAME="Linux"
        ;;
    Darwin:x86_64|Darwin:amd64)
        BUILD_TARGET="package:mac-x64"
        PLATFORM_NAME="macOS"
        ;;
    Darwin:aarch64|Darwin:arm64)
        BUILD_TARGET="package:mac-arm64"
        PLATFORM_NAME="macOS"
        ;;
    Linux:*|Darwin:*)
        printf 'ERROR: Unsupported %s architecture: %s\n' "$HOST_OS" "$HOST_ARCH" >&2
        printf 'Supported architectures: x86_64 and arm64.\n' >&2
        pause_and_exit 1
        ;;
    *)
        printf 'ERROR: build_default.sh supports Linux and macOS hosts only; found %s.\n' "$HOST_OS" >&2
        pause_and_exit 1
        ;;
esac

if ! command -v node >/dev/null 2>&1; then
    printf 'ERROR: Node.js 18 or newer was not found in PATH.\n' >&2
    pause_and_exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    printf 'ERROR: npm was not found in PATH.\n' >&2
    pause_and_exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ ! "$NODE_MAJOR" =~ ^[0-9]+$ || "$NODE_MAJOR" -lt 18 ]]; then
    printf 'ERROR: Node.js 18 or newer is required; found %s.\n' "$(node --version)" >&2
    pause_and_exit 1
fi

printf 'Detected %s architecture: %s\n' "$PLATFORM_NAME" "$HOST_ARCH"
if [[ "$HOST_ARCH" != "$REPORTED_ARCH" ]]; then
    printf 'Shell-reported architecture: %s (Rosetta translation detected)\n' "$REPORTED_ARCH"
fi
printf 'Selected native build target: %s\n\n' "$BUILD_TARGET"

if [[ "${CFW_BUILD_DETECT_ONLY:-0}" == "1" ]]; then
    pause_and_exit 0
fi

npm --prefix "$REPO_ROOT" run "$BUILD_TARGET"
BUILD_EXIT_CODE=$?

printf '\n'
if [[ "$BUILD_EXIT_CODE" -eq 0 ]]; then
    printf 'Build completed successfully: %s\n' "$BUILD_TARGET"
else
    printf 'Build failed with exit code %s: %s\n' "$BUILD_EXIT_CODE" "$BUILD_TARGET" >&2
fi

pause_and_exit "$BUILD_EXIT_CODE"
