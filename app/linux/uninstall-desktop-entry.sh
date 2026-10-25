#!/bin/sh
set -eu

if [ "$(id -u)" = '0' ]; then
    if [ -z "${SUDO_USER:-}" ] || [ "${SUDO_UID:-0}" = '0' ]; then
        printf 'Run this script as your desktop user, without sudo.\n' >&2
        exit 1
    fi
    exec sudo -H -u "$SUDO_USER" -- env -u XDG_DATA_HOME sh "$0" "$@"
fi

app_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
data_home=${XDG_DATA_HOME:-"$HOME/.local/share"}
applications_dir="$data_home/applications"
desktop_file="$applications_dir/@CFW_DESKTOP_ID@.desktop"
icon_file="$data_home/icons/hicolor/512x512/apps/@CFW_DESKTOP_ID@.png"

# Leave another installation's launcher (and its shared icon) intact.
if [ -e "$desktop_file" ] || [ -L "$desktop_file" ]; then
    if ! grep -Fqx -- "TryExec=$app_dir/launch-cfw.sh" "$desktop_file"; then
        printf 'Launcher belongs to another installation; leaving it intact: %s\n' "$desktop_file" >&2
        exit 1
    fi
    rm -f -- "$desktop_file" "$icon_file"
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$applications_dir" >/dev/null 2>&1 || true
    fi
    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
        gtk-update-icon-cache -q -t "$data_home/icons/hicolor" >/dev/null 2>&1 || true
    fi
fi
printf 'Removed portable launcher. Application files and user profiles are unchanged.\n'
