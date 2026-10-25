#!/bin/sh
set -eu

app_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
data_home=${XDG_DATA_HOME:-"$HOME/.local/share"}
applications_dir="$data_home/applications"
icons_dir="$data_home/icons/hicolor/512x512/apps"
desktop_file="$applications_dir/@CFW_DESKTOP_ID@.desktop"
icon_file="$icons_dir/@CFW_DESKTOP_ID@.png"
executable="$app_dir/cfw"
launcher="$app_dir/launch-cfw.sh"
sandbox="$app_dir/chrome-sandbox"

# Running the whole script with sudo used to install into /root's application
# list, which is invisible to the logged-in Ubuntu user.
if [ "$(id -u)" = '0' ]; then
    if [ -z "${SUDO_USER:-}" ] || [ "${SUDO_UID:-0}" = '0' ]; then
        printf 'Run this script as your desktop user, without sudo. It requests sudo only for the sandbox.\n' >&2
        exit 1
    fi
    [ -f "$sandbox" ] && [ ! -L "$sandbox" ]
    chown root:root -- "$sandbox"
    chmod 4755 -- "$sandbox"
    exec sudo -H -u "$SUDO_USER" -- env -u XDG_DATA_HOME sh "$0" "$@"
fi

mkdir -p "$applications_dir" "$icons_dir"
cp "$app_dir/resources/static/imgs/icon_512.png" "$icon_file"
# Admin-extracted portable folders can be root-owned but already executable.
[ -x "$executable" ] || chmod 0755 "$executable"
[ -x "$launcher" ] || chmod 0755 "$launcher"

if [ ! -f "$sandbox" ] || [ -L "$sandbox" ]; then
    printf 'Electron sandbox helper is missing or unsafe: %s\n' "$sandbox" >&2
    exit 1
fi
sandbox_owner=$(stat -c '%u' "$sandbox")
sandbox_mode=$(stat -c '%a' "$sandbox")
if [ "$sandbox_owner" != '0' ] || [ "$sandbox_mode" != '4755' ]; then
    if ! command -v sudo >/dev/null 2>&1; then
        printf 'sudo is required to configure %s as root:root mode 4755.\n' "$sandbox" >&2
        exit 1
    fi
    printf 'Configuring the Electron sandbox helper (sudo required)...\n'
    sudo chown root:root -- "$sandbox"
    sudo chmod 4755 -- "$sandbox"
fi
if [ "$(stat -c '%u:%g:%a' "$sandbox")" != '0:0:4755' ]; then
    printf 'Failed to configure Electron sandbox helper: %s\n' "$sandbox" >&2
    exit 1
fi

escaped_launcher=$(printf '%s' "$launcher" | sed 's/\\/\\\\/g; s/"/\\"/g; s/%/%%/g')
escaped_app_dir=$(printf '%s' "$app_dir" | sed 's/\\/\\\\/g')
escaped_icon_file=$(printf '%s' "$icon_file" | sed 's/\\/\\\\/g')
{
    printf '%s\n' '[Desktop Entry]'
    printf '%s\n' 'Type=Application'
    printf '%s\n' 'Version=1.5'
    printf '%s\n' 'Name=Clash for Windows'
    printf '%s\n' 'Comment=Rule-based proxy client'
    printf 'Exec="%s"\n' "$escaped_launcher"
    printf 'TryExec=%s\n' "$launcher"
    printf 'Path=%s\n' "$escaped_app_dir"
    printf 'Icon=%s\n' "$escaped_icon_file"
    printf '%s\n' 'StartupWMClass=@CFW_DESKTOP_ID@'
    printf '%s\n' 'Categories=Network;'
    printf '%s\n' 'StartupNotify=false'
    printf '%s\n' 'Terminal=false'
} > "$desktop_file"
chmod 0644 "$desktop_file" "$icon_file"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$applications_dir" >/dev/null 2>&1 || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t "$data_home/icons/hicolor" >/dev/null 2>&1 || true
fi
printf 'Installed %s\n' "$desktop_file"
