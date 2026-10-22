# Windows TAP forwarder

`upstream.json` pins go-tun2socks v1.16.11 by commit and archive SHA-256. The
builder applies the two checked source edits and copies these small Go overlays.
It does not replace the upstream TCP, UDP, DNS or driver implementations.

The Windows reader discards IPv4 multicast (`224.0.0.0/4`) before passing packets
to lwIP or opening SOCKS flows. `-allowMulticast=true` deliberately preserves the
upstream behavior. IPv6 handling is unchanged. `-checkPacket HEX` classifies an IP
packet without opening a TAP adapter and is used by native compatibility tests.

Use Go **1.27.1**, LLVM-MinGW **20261020 UCRT**, and `tar`. The compiler archive used
for the packaged builds is `llvm-mingw-20261020-ucrt-x86_64.zip` from
https://github.com/mstorsjo/llvm-mingw/releases/tag/20261020, with SHA-256
`fd5462b7f5d93b2ff981fcd3f9c7e427e47f3203c64ea91c27bcc444eebd74cd`.

On Windows PowerShell, set `CFW_GO_PATH` to `go.exe` and `CFW_MINGW_BIN` to that
toolchain's `bin` directory, then run `npm run build:tap-forwarder`. Linux build
hosts can use matching LLVM-MinGW cross compilers through the same variables.
The build runs the portable Go packet tests with cgo disabled, builds both
Windows payloads, and updates the source/binary digests and packaged notices.
The ARM64 package retains its existing x86 helper architecture; its bundled TAP
kernel driver remains unsupported on ARM64.

`npm test` verifies the source and binary digests on every platform and exercises
both executables on Windows without touching an adapter. Actual TAP, routing and
LAN discovery tests belong in a disposable Windows VM. The route helper only
changes the managed TAP's active multicast route and restores an acquired value
only when no later actor has changed it. Filtering works even if route bypass
is unavailable without administrator privileges.
